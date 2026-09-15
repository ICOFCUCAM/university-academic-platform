// ---------------------------------------------------------------------------
// THE WORD CHECK, BEFORE ANYTHING IS SPOKEN.
//
// A mis-transcribed word in a text is a typo: a reader sees it, shrugs, and
// understands what was meant. THE SAME WORD IN THE AUDIO IS NOT RECOVERABLE.
// A listener walking to campus hears a confident voice say a word that does
// not exist, or the wrong name pronounced perfectly, and has no way to see
// that anything is wrong. It then goes into their notes and into an
// examination answer.
//
// So before a script becomes speech, the lecturer is shown every word the
// system cannot account for — in its sentence, with a suggestion where there
// is an obvious one — and accepts it or replaces it. Like a proofreader's
// pane, and for exactly that reason: the machine flags, the person decides.
//
// THE DETECTION IS MECHANICAL. No model is asked which words look odd — a
// model asked that question would flag the lecturer's own terminology, which
// is the one thing that must never be changed. A word is flagged when the
// system cannot place it, and the lecturer's glossary and the course's own
// knowledge base are the first two places it looks.
// ---------------------------------------------------------------------------

/**
 * A working vocabulary. Not a dictionary — a dictionary would be megabytes and
 * would still miss every technical term. The rule is the other way round:
 * anything NOT here is shown to the lecturer, who knows whether it is a word.
 * Common enough that ordinary prose passes almost entirely.
 */
const COMMON = new Set<string>(`a about above across after again against all almost alone along already also
although always am among an and another any anything are around as at away back be became because become been
before began begin behind being below beside best better between beyond both bring but by call came can cannot
come could courseday did different do does doing done down during each early either else end enough even ever
every example few find first for form found four from full further gave get give given go going good got great
had half has have he held help her here high him his hold how however if in indeed instead into is it its
itself just keep kept kind know known large last later least left less let like little long look made make many
may me mean means might more most much must my near need never new next no not nothing now number of off often
on once one only open or order other others our out over own part people perhaps place point possible present
put question quite rather really right said same saw say see seem seen set several shall she should show side
since small so some something sometimes soon still such take taken tell than that the their them then there
these they thing think this those though three through time to together too took toward turn two under until
up upon us use used very want was way we well went were what when where whether which while who whole why will
with within without work world would year yes yet you your
above according actually addition against already although always analysis answer appear applied approach area
argue argument article assume available based basic become begin believe better call case cause central certain
chapter claim clear common complete complex concept conclusion condition consider contain context continue
control course create data define definition degree describe detail determine develop difference discuss
distinguish effect element evidence examine example except exist experience explain factor figure final follow
force function general give group human idea identify important include increase individual information issue
知 knowledge language later level likely limit line list main major material matter measure method model natural
nature necessary note object observe occur original particular pattern period position practice principle
problem process produce provide purpose range reason record reduce refer relation report require research
result role section sense series significant similar simple social source specific stage standard state
structure study subject suggest support system term test theory thought total type understand unit value view
whether word write
lecture lecturer student students university course seminar exam examination term semester week reading notes
today tomorrow yesterday
monday tuesday wednesday thursday friday saturday sunday january february march april june july august september
october november december morning afternoon evening night hour minute second third fourth fifth sixth seventh
eighth ninth tenth hundred thousand million billion
able above accept across actually addition agree allow almost already answer appear apply around arrive ask
attempt away become before begin behind believe belong below beside between bring build carry catch cause
certain change check choose class close common compare complete consider contain continue correct decide
describe develop difference difficult direct discuss divide draw drop early easy effect either enough enter
equal especially event exactly expect explain express fact fail fall famous feel field fill final find finish
follow forget form forward free friend front future gather general happen happens hard head hear heavy help
history hold hope idea imagine important improve include increase indicate interest involve join keep kind
knowledge language large late lead learn leave length letter light limit listen live local lose main manage
mark matter mean measure meet member mention method middle mind minute miss moment money move music name
nature near necessary need normal notice number object offer often open operate opinion order organise
particular pass past pay perhaps period person picture piece plan play please point popular position possible
power practice prefer prepare present press prevent probably problem produce provide public pull purpose push
quality quarter question quick quiet raise range reach read ready real reason receive recent recognise record
reduce refer regard relate remain remember remove repeat reply report represent require rest result return
rise round rule safe save scene school science search season seat second section seem sell send sense
separate serious serve service settle share short shout show side sign similar simple single situation size
sleep slow social soft sort sound space speak special speed spend stand start state stay step stop store
story straight strange strong student study subject succeed suggest suit summer supply suppose sure surface
surprise system table teach teacher team tell test thank theory thing think though throw title touch trade
train travel treat trouble true trust truth understand university usual value various view visit voice wait
walk want warm watch water weather week weight welcome whole wide win window winter wish wonder wood word
work worth write wrong young
membrane enzyme cell cells energy water oxygen carbon light stage stages process reaction chemical molecule
run runs running gone goes doing does said says told sees looks takes gives makes comes puts gets lets
above beyond towards despite besides throughout whereas whenever wherever moreover furthermore nevertheless`.split(/\s+/).filter(Boolean));

export interface UnusualWord {
  word: string;
  /** Every sentence it appears in, so the lecturer can judge in context. */
  contexts: string[];
  occurrences: number;
  reason: 'near-a-course-term' | 'unknown-word' | 'said-once';
  /**
   * Where the word is one or two letters from a term this course teaches, the
   * likely intended word. A transcription that heard "rubisko" for "rubisco"
   * is the ordinary case, and the fix is one click.
   */
  suggestion?: string;
  /** True when the lecturer's glossary vouches for it — never flagged. */
  known?: boolean;
}

/** Levenshtein, capped: beyond two edits it is a different word, not a slip. */
function distance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
    if (Math.min(...current) > cap) return cap + 1;
  }
  return previous[b.length];
}

/**
 * The forms of a word that might be in the list. "Requirements" is not there;
 * "require" is, and a pane that queries "requirements" is a pane nobody reads
 * to the end.
 */
function forms(word: string): string[] {
  const lower = word.toLowerCase().replace(/[’']s$/, '');
  const out = new Set([lower]);
  const suffixes = ['ments', 'ment', 'ations', 'ation', 'tions', 'tion', 'ings', 'ing',
    'ness', 'able', 'ible', 'ally', 'ly', 'ies', 'es', 'ed', 's'];
  for (const suffix of suffixes) {
    if (!lower.endsWith(suffix) || lower.length - suffix.length < 3) continue;
    const stem = lower.slice(0, -suffix.length);
    out.add(stem);
    out.add(`${stem}e`);          // requir(e) + ments, mov(e) + ing
    out.add(`${stem}y`);          // stud(y) + ies
    if (stem.length > 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      out.add(stem.slice(0, -1)); // stopp(ed) → stop
    }
  }
  return [...out];
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface CheckVocabulary {
  /** The lecturer's own terms. Never flagged, and used as suggestions. */
  glossary?: string[];
  /** Terms the course knowledge base already holds. Same treatment. */
  courseTerms?: string[];
  /**
   * THE COURSE'S OWN PROSE — its other published lectures. The best evidence
   * that a word belongs to this subject is that this subject has used it
   * before, and it needs no dictionary: "membrane" is attested by Lecture 02
   * and "rubisko" by nothing.
   */
  corpus?: string;
}

/**
 * Words this system cannot account for, in the order they appear.
 *
 * DELIBERATELY NOT CLEVER. It does not try to decide whether a word is real;
 * it reports what it could not place, because the person reading the list
 * wrote the lecture and can answer in a second what no heuristic can.
 */
export function findUnusual(text: string, vocabulary: CheckVocabulary = {}): UnusualWord[] {
  const glossary = (vocabulary.glossary ?? []).map((t) => t.toLowerCase());
  const courseTerms = (vocabulary.courseTerms ?? []).map((t) => t.toLowerCase());
  const vouched = new Set([...glossary, ...courseTerms].flatMap((t) => t.split(/\s+/)));

  // Words the course has used elsewhere. Twice, so that one earlier
  // mis-transcription does not vouch for the next one.
  const attested = new Set<string>();
  if (vocabulary.corpus) {
    const counts = new Map<string, number>();
    for (const raw of vocabulary.corpus.match(/[A-Za-z][A-Za-z’'-]*/g) ?? []) {
      const lower = raw.toLowerCase();
      counts.set(lower, (counts.get(lower) ?? 0) + 1);
    }
    counts.forEach((n, w) => { if (n >= 2) attested.add(w); });
  }

  const lines = sentences(text);
  const seen = new Map<string, UnusualWord>();

  lines.forEach((sentence) => {
    const words = sentence.match(/[A-Za-z][A-Za-z’'-]*/g) ?? [];
    for (const raw of words) {
      const lower = raw.toLowerCase();
      if (lower.length < 4) continue;
      if (forms(raw).some((form) => COMMON.has(form))) continue;
      if (vouched.has(lower)) continue;
      if (attested.has(lower)) continue;

      const existing = seen.get(lower);
      if (existing) {
        existing.occurrences += 1;
        if (existing.contexts.length < 3) existing.contexts.push(sentence);
        continue;
      }

      // ---- NEAR A TERM THIS COURSE TEACHES ------------------------------
      //
      // The most useful finding in the list: "rubisko" beside a course that
      // teaches "rubisco" is a transcription slip with an obvious fix, and
      // the audio would otherwise say it out loud with total confidence.
      const near = [...vouched]
        .filter((term) => term.length > 3 && distance(lower, term) <= (lower.length > 7 ? 2 : 1))
        .sort((a, b) => distance(lower, a) - distance(lower, b))[0];

      seen.set(lower, {
        word: raw,
        contexts: [sentence],
        occurrences: 1,
        reason: near ? 'near-a-course-term' : 'unknown-word',
        suggestion: near,
      });
    }
  });

  // A WORD SAID ONCE IS THE SUSPICIOUS ONE. A term the lecture uses six times
  // is the lecture's vocabulary, whatever this file's word list thinks of it;
  // reporting it six times over would make the pane worth closing unread.
  return [...seen.values()]
    .map((found) => (found.reason === 'unknown-word' && found.occurrences === 1
      ? { ...found, reason: 'said-once' as const }
      : found))
    .sort((a, b) => {
      const rank = { 'near-a-course-term': 0, 'said-once': 1, 'unknown-word': 2 };
      return rank[a.reason] - rank[b.reason] || b.occurrences - a.occurrences;
    });
}

/** What the lecturer decided about each word. */
export interface WordDecision {
  word: string;
  action: 'accepted' | 'replaced';
  replacement?: string;
}

export interface WordCheck {
  checkedAt: string;
  checkedBy: string;
  decisions: WordDecision[];
  /** How many were flagged when they checked, so a later re-run can tell. */
  flagged: number;
}

/**
 * Apply the replacements to the text. Whole words only, every occurrence, and
 * the original capitalisation of each occurrence is not preserved — the
 * lecturer typed the replacement they want, and second-guessing their capitals
 * is the kind of helpfulness this platform is built to refuse.
 */
export function applyDecisions(text: string, decisions: WordDecision[]): string {
  let out = text;
  for (const decision of decisions) {
    if (decision.action !== 'replaced' || !decision.replacement) continue;
    const escaped = decision.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), decision.replacement);
  }
  return out;
}
