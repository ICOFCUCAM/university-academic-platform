// ---------------------------------------------------------------------------
// THE COURSE AI.
//
// A student opens BIOLOGY 101 — Course AI and asks:
//
//   "Explain photosynthesis based on our lectures."   → answered from the
//                                                        course, with citations
//   "Which lecture introduced this concept?"          → Lecture 06, from the
//                                                        knowledge base, with
//                                                        no model call at all
//   "Give me a simple explanation."                   → same material, plain
//   "Now the university-level explanation."           → same material, formal
//   "Create a 10-question test."                      → made from lectures
//   "A 15-minute audio revision covering lectures 1–6" → made from a range
//
// WHAT MAKES IT WORTH MORE THAN A CHAT WINDOW is the last clause of the first
// question: *based on our lectures*. This assistant has one corpus — the
// lectures of this course that the lecturer approved and published — and when
// the question falls outside it, the answer is "this course's lectures do not
// cover that". A student who cannot tell whether an answer came from their
// course or from the internet cannot revise from either.
//
// The retrieval and the intent reading are pure functions. They are where this
// gets things wrong, so they are where the tests are.
// ---------------------------------------------------------------------------

import type { ArtefactKind, Register, TutorCitation } from '../domain/types';
import type { CourseKnowledgeBase } from '../knowledge/types';
import { GENERAL_AI_SYSTEM, generalUserTurn, TUTOR_SYSTEM, tutorUserTurn } from './prompts';
import type { Engine } from './provider';

export interface Passage {
  lectureId: string;
  lectureSequence: number;
  lectureTitle: string;
  artefactKind: ArtefactKind;
  text: string;
}

export type Intent =
  | { kind: 'explain'; register: Register | null; topic: string }
  /**
   * THE SECOND BOUNDARY. The student has explicitly asked to go outside their
   * course. Nothing else opens this door: not a question the course fails to
   * cover, not a follow-up, not a request for more detail. Only an explicit
   * ask, because a student who did not ask to leave their syllabus must never
   * be given an answer from outside it and not know.
   */
  | { kind: 'beyond'; topic: string }
  | { kind: 'locate'; topic: string }
  | { kind: 'test'; questions: number; lectures: number[] | null }
  | { kind: 'audio'; minutes: number; lectures: number[] | null }
  | { kind: 'flashcards'; lectures: number[] | null };

const STOP = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'what', 'which', 'when',
  'give', 'show', 'tell', 'explain', 'about', 'please', 'our', 'your', 'can',
  'you', 'how', 'why', 'does', 'did', 'was', 'are', 'were', 'have', 'has',
  'lecture', 'lectures', 'course', 'based', 'simple', 'university', 'level',
]);

export function terms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** "lectures 1–6", "lectures 1 to 6", "lecture 4". Null when unstated. */
export function lectureRange(question: string): number[] | null {
  const span = question.match(/lectures?\s*(\d{1,2})\s*(?:-|–|—|to|through|until)\s*(\d{1,2})/i);
  if (span) {
    const from = Number(span[1]);
    const to = Number(span[2]);
    if (from <= to) return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  const list = question.match(/lectures?\s*((?:\d{1,2}\s*,\s*)+\d{1,2})/i);
  if (list) return list[1].split(',').map((n) => Number(n.trim()));
  const one = question.match(/lecture\s*(\d{1,2})/i);
  if (one) return [Number(one[1])];
  return null;
}

const BEYOND = [
  /\boutside (?:this|the|my|our) (?:course|lecture|lectures|syllabus|module)\b/,
  /\bbeyond (?:this|the|my|our) (?:course|lecture|lectures|syllabus|module)\b/,
  /\bnot (?:just|only) (?:from )?(?:this|the|our) (?:course|lectures)\b/,
  /\b(?:general|wider|external|outside) (?:ai |knowledge|literature|reading|sources?)\b/,
  /\buse (?:your own|general|outside) knowledge\b/,
];

export function readIntent(question: string): Intent {
  const q = question.toLowerCase();

  // Checked first: "create a test using information outside this course" is a
  // request to leave the syllabus before it is a request for a test.
  if (BEYOND.some((pattern) => pattern.test(q))) return { kind: 'beyond', topic: question };

  const test = q.match(/(\d{1,3})[\s-]*(?:question|item|mcq)/);
  if (test || /\b(test|quiz|exam practice|practice questions)\b/.test(q)) {
    return { kind: 'test', questions: test ? Number(test[1]) : 10, lectures: lectureRange(question) };
  }

  if (/\b(flashcard|flash card|cue card)/.test(q)) {
    return { kind: 'flashcards', lectures: lectureRange(question) };
  }

  const minutes = q.match(/(\d{1,3})[\s-]*minute/);
  if (/\b(audio|listen|podcast|spoken)\b/.test(q)) {
    return { kind: 'audio', minutes: minutes ? Number(minutes[1]) : 15, lectures: lectureRange(question) };
  }

  // "Which lecture introduced this?" — the knowledge base answers this one
  // exactly, which no general assistant can do.
  if (/\bwhich lecture\b|\bwhere (?:was|did) (?:this|it|that)\b|\bwhen (?:was|did) (?:this|it) (?:introduced|covered|taught)\b/.test(q)) {
    return { kind: 'locate', topic: question };
  }

  const register: Register | null =
    /\b(simple|simply|plain|plainly|in simple terms|like i'm new|beginner)\b/.test(q) ? 'plain'
      : /\b(university[- ]level|academic|formal|rigorous|technical|advanced)\b/.test(q) ? 'university'
        : null;

  return { kind: 'explain', register, topic: question };
}

/**
 * Which passages bear on the question. Term overlap, weighted so that a
 * lecture's own notes outrank the transcript of an aside.
 *
 * NOT AN EMBEDDING SEARCH, and deliberately: it runs with no vendor, no
 * index to rebuild and no drift, and a course is a few hundred passages, not
 * a web corpus. A deployment that wants vectors replaces this one function.
 */
const KIND_WEIGHT: Partial<Record<ArtefactKind, number>> = {
  structured_notes: 1.3,
  corrected_text: 1.15,
  revision_materials: 1.0,
  teaching_script: 0.9,
  transcript: 0.7,
};

export function retrieve(passages: Passage[], question: string, limit = 8): Passage[] {
  const wanted = terms(question);
  if (!wanted.length) return [];
  const scored = passages.map((p) => {
    const words = terms(p.text);
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of new Set(wanted)) {
      const hits = counts.get(w) ?? 0;
      if (hits) score += 1 + Math.log(hits);
    }
    // Long passages match everything; normalise so they do not crowd out the
    // paragraph that actually answers the question.
    score = score / Math.log(10 + words.length);
    return { p, score: score * (KIND_WEIGHT[p.artefactKind] ?? 1) };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}

/** Does the course cover this at all? The threshold for answering. */
export function covered(hits: Passage[]): boolean {
  return hits.length > 0;
}

export interface AnswerInput {
  question: string;
  passages: Passage[];
  knowledge: CourseKnowledgeBase;
  register?: Register | null;
  /** The last few turns, so "give me a simple explanation" has a subject. */
  history?: { role: 'student' | 'tutor'; body: string }[];
}

export interface AnswerResult {
  body: string;
  citations: TutorCitation[];
  /**
   * True when this came from general knowledge rather than from the course.
   * The screen labels it, loudly and separately: a student cannot be left
   * unable to tell which half their lecturer actually taught.
   */
  outsideCourse?: boolean;
  refusedReason?: 'not-in-course-material';
  register?: Register;
  producedBy: string;
  /** Set where the ask was for something to be made rather than said. */
  make?: Intent;
}

const REGISTER_NOTE: Record<Register, string> = {
  plain: `THE STUDENT ASKED FOR A SIMPLE EXPLANATION. Everyday words, short
sentences, an analogy only if the lecturer used one. Do not leave anything out
that the lecture treats as essential — simplify the language, never the claim.
Keep the technical term and gloss it, so what they revise is still what they
will be examined on.`,
  university: `THE STUDENT ASKED FOR THE UNIVERSITY-LEVEL EXPLANATION. The
lecturer's own terminology, the distinctions they drew, the qualifications they
made. Where the lecture cited a figure, a text or a school of thought, name it.
Write as the lecture wrote.`,
};

/**
 * "Which lecture introduced this?" — answered from the knowledge base without
 * a model call. It is exact, it is instant, and it is the question a general
 * assistant fundamentally cannot answer.
 */
export function locate(knowledge: CourseKnowledgeBase, question: string, recentTopic?: string): AnswerResult | null {
  const wanted = terms(`${question} ${recentTopic ?? ''}`);
  if (!wanted.length) return null;

  const scored = knowledge.nodes
    .map((node) => {
      const nodeTerms = terms(node.term);
      const overlap = nodeTerms.filter((t) => wanted.includes(t)).length;
      return { node, overlap: overlap / Math.max(1, nodeTerms.length) };
    })
    .filter((s) => s.overlap >= 0.5)
    .sort((a, b) => b.overlap - a.overlap);

  if (!scored.length) return null;
  const node = scored[0].node;

  const first = node.definedIn ?? node.mentions[0];
  const others = node.mentions
    .filter((m) => m.lectureId !== first.lectureId)
    .sort((a, b) => a.lectureSequence - b.lectureSequence);

  const lines = [
    `**${node.term}** is introduced in Lecture ${String(first.lectureSequence).padStart(2, '0')} — ${first.lectureTitle}.`,
    '',
    `> ${first.quote}`,
  ];
  if (node.definition) lines.push('', `As the lecture puts it: ${node.definition}`);
  if (others.length) {
    lines.push('', 'It comes back in ' + others
      .map((m) => `Lecture ${String(m.lectureSequence).padStart(2, '0')}`)
      .join(', ') + '.');
  }

  return {
    body: lines.join('\n'),
    citations: [first, ...others].map((m) => ({
      lectureId: m.lectureId,
      lectureSequence: m.lectureSequence,
      lectureTitle: m.lectureTitle,
      artefactKind: 'structured_notes' as ArtefactKind,
      quote: m.quote,
    })),
    producedBy: 'course knowledge base',
  };
}

export async function answer(e: Engine, input: AnswerInput): Promise<AnswerResult> {
  const intent = readIntent(input.question);

  // The register carries across turns: "give me a simple explanation" refers
  // to what was just being discussed, so the subject comes from the history.
  const lastStudentTurn = [...(input.history ?? [])].reverse().find((h) => h.role === 'student');

  if (intent.kind === 'locate') {
    const found = locate(input.knowledge, input.question, lastStudentTurn?.body);
    if (found) return found;
  }

  // ---- THE SECOND BOUNDARY, AND IT IS A DOOR THE STUDENT OPENS ----------
  if (intent.kind === 'beyond') {
    const context = retrieve(input.passages, input.question, 4)
      .map((p) => `Lecture ${String(p.lectureSequence).padStart(2, '0')} — ${p.lectureTitle}: ${p.text.slice(0, 400)}`)
      .join('\n\n');
    const general = await e.model.complete({
      system: GENERAL_AI_SYSTEM,
      user: generalUserTurn(input.question, context),
      maxTokens: 4000,
      effort: 'medium',
    });
    return {
      body: general.text,
      citations: [],
      outsideCourse: true,
      producedBy: general.producedBy,
    };
  }

  if (intent.kind === 'test' || intent.kind === 'audio' || intent.kind === 'flashcards') {
    return {
      body: '',
      citations: [],
      producedBy: 'course knowledge base',
      make: intent,
    };
  }

  const searchText = terms(input.question).length >= 2
    ? input.question
    : `${lastStudentTurn?.body ?? ''} ${input.question}`;
  const hits = retrieve(input.passages, searchText);

  if (!covered(hits)) {
    const nearby = input.knowledge.nodes.slice(0, 6).map((n) => n.term);
    return {
      body: [
        'This course’s lectures do not cover that.',
        nearby.length
          ? `\nWhat the course does cover nearby: ${nearby.join(', ')}. Ask me about any of those and I will answer from the lectures themselves.`
          : '',
      ].join('\n'),
      citations: [],
      refusedReason: 'not-in-course-material',
      producedBy: 'course knowledge base',
    };
  }

  const register: Register | undefined =
    input.register ?? (intent.kind === 'explain' ? intent.register ?? undefined : undefined);
  const system = register ? `${TUTOR_SYSTEM}\n\n${REGISTER_NOTE[register]}` : TUTOR_SYSTEM;

  const result = await e.model.complete({
    system,
    user: tutorUserTurn(
      hits.map((h) => ({
        label: `Lecture ${String(h.lectureSequence).padStart(2, '0')} — ${h.lectureTitle} (${h.artefactKind.replace(/_/g, ' ')})`,
        text: h.text,
      })),
      input.question,
    ),
    maxTokens: 8000,
    effort: 'medium',
  });

  return {
    body: result.text,
    // EVERY PASSAGE THAT FED THE ANSWER IS SHOWN, so a student can go and read
    // the lecture rather than taking the assistant's word for it.
    citations: hits.map((h) => ({
      lectureId: h.lectureId,
      lectureSequence: h.lectureSequence,
      lectureTitle: h.lectureTitle,
      artefactKind: h.artefactKind,
      quote: h.text.slice(0, 240),
    })),
    register,
    producedBy: result.producedBy,
  };
}
