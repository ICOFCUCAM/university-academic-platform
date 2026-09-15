// ---------------------------------------------------------------------------
// A QUIZ YOU CAN ACTUALLY SIT.
//
// Until now a quiz was a page of text with the answers printed underneath it,
// which is a revision sheet rather than a test: a student reads the question,
// their eye falls on the answer, and they learn that they knew it.
//
// So the generated text is PARSED into questions a screen can ask one at a
// time, with the answers held back until they have committed to one.
//
// PARSED, NOT GENERATED AS JSON. The model is asked for a quiz in the form a
// lecturer would write one, because that form is also what prints, what a
// student pastes into their notes, and what survives being translated. A
// parser that fails on a question degrades to showing the text; a JSON schema
// that fails gives a student nothing.
// ---------------------------------------------------------------------------

export interface QuizOption {
  label: string;
  text: string;
}

export interface QuizQuestion {
  n: number;
  prompt: string;
  /** Empty for a short-answer question, which is marked by the student. */
  options: QuizOption[];
  /** The letter for multiple choice, or the written answer. */
  answer?: string;
  explanation?: string;
}

export interface ParsedQuiz {
  questions: QuizQuestion[];
  /** Anything the parser could not place, kept so nothing is lost silently. */
  remainder: string;
}

const ANSWER_HEADING = /^#{1,6}\s*(answers?|réponses?|respuestas?|respostas?|الإجابات|答案|majibu|antworten|svar)\b/i;

/**
 * Split the body at its answers section. Everything above is asked; everything
 * below is held back until a student has answered.
 */
function split(text: string): { questions: string; answers: string } {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => ANSWER_HEADING.test(line.trim()));
  if (at < 0) return { questions: text, answers: '' };
  return { questions: lines.slice(0, at).join('\n'), answers: lines.slice(at + 1).join('\n') };
}

const QUESTION_START = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const OPTION_LINE = /^\s*\(?([A-Da-d])[.)]\s+(.*)$/;
// "Q. …" / "A. …" pairs, the shape the revision set uses.
const QA_QUESTION = /^\s*Q[.):]\s*(.*)$/i;
const QA_ANSWER = /^\s*A[.):]\s*(.*)$/i;

function parseAnswers(text: string): Map<number, { answer: string; explanation?: string }> {
  const found = new Map<number, { answer: string; explanation?: string }>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const match = line.match(/^\(?(\d{1,2})[.)]\s*(.+)$/);
    if (!match) continue;
    const body = match[2].trim();
    // "3. B — because the Calvin cycle needs the products, not the light."
    const letter = body.match(/^\(?([A-Da-d])\)?(?:\s*[—–-]\s*(.*))?$/);
    found.set(Number(match[1]), letter
      ? { answer: letter[1].toUpperCase(), explanation: letter[2]?.trim() || undefined }
      : { answer: body });
  }
  return found;
}

export function parseQuiz(text: string): ParsedQuiz {
  const { questions: asked, answers } = split(text);
  const key = parseAnswers(answers);
  const questions: QuizQuestion[] = [];
  const unplaced: string[] = [];

  // ---- "A." IS AN OPTION OR AN ANSWER, DEPENDING ON THE QUESTION --------
  //
  // In a numbered multiple-choice question, "A. In the stroma" is option A.
  // In a "Q. … / A. …" pair it is the answer. The same three characters, and
  // reading them the wrong way round silently turns a four-option question
  // into a question with no options and a wrong answer attached.
  let current: (QuizQuestion & { source: 'numbered' | 'qa' }) | null = null;
  const close = () => {
    if (current) {
      const { source, ...question } = current;
      void source;
      questions.push(question);
    }
    current = null;
  };

  const lines = asked.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings are scaffolding, not questions.
    if (/^#{1,6}\s/.test(trimmed)) { close(); continue; }

    const numbered = trimmed.match(QUESTION_START);
    if (numbered && !OPTION_LINE.test(trimmed)) {
      close();
      current = { n: Number(numbered[1]), prompt: numbered[2].trim(), options: [], source: 'numbered' };
      continue;
    }

    const qa = trimmed.match(QA_QUESTION);
    if (qa) {
      close();
      current = { n: questions.length + 1, prompt: qa[1].trim(), options: [], source: 'qa' };
      continue;
    }

    // "A. …" directly under a "Q. …" is that question's answer, not an option.
    const qaAnswer = trimmed.match(QA_ANSWER);
    if (qaAnswer && current?.source === 'qa' && !current.answer) {
      current.answer = qaAnswer[1].trim();
      close();
      continue;
    }

    const option = trimmed.match(OPTION_LINE);
    if (option && current) {
      current.options.push({ label: option[1].toUpperCase(), text: option[2].trim() });
      continue;
    }

    if (current && !current.options.length) {
      // A question that ran onto a second line.
      current.prompt = `${current.prompt} ${trimmed}`.trim();
      continue;
    }

    unplaced.push(line);
  }
  close();

  for (const question of questions) {
    const fromKey = key.get(question.n);
    if (!fromKey) continue;
    question.answer = question.answer ?? fromKey.answer;
    question.explanation = fromKey.explanation;
  }

  return { questions, remainder: unplaced.join('\n').trim() };
}

export interface Marked {
  n: number;
  given: string;
  correct?: string;
  /** Null where nobody can mark it automatically — a written answer. */
  right: boolean | null;
}

/**
 * Marking, and what it refuses to do: a written answer is NOT marked by
 * matching strings. "The thylakoid membrane" and "in the thylakoid" are the
 * same answer, and a platform that scored one of them wrong would teach a
 * student that they had misunderstood their lecture. Multiple choice is
 * marked; the rest is shown beside the lecturer's answer for the student to
 * judge, which is what revision is.
 */
export function mark(quiz: ParsedQuiz, given: Record<number, string>): {
  marked: Marked[]; score: number; outOf: number;
} {
  const marked: Marked[] = quiz.questions.map((question) => {
    const answer = (given[question.n] ?? '').trim();
    const automatic = question.options.length > 0 && !!question.answer;
    return {
      n: question.n,
      given: answer,
      correct: question.answer,
      right: automatic ? answer.toUpperCase() === question.answer!.toUpperCase() : null,
    };
  });

  const markable = marked.filter((m) => m.right !== null);
  return {
    marked,
    score: markable.filter((m) => m.right).length,
    outOf: markable.length,
  };
}
