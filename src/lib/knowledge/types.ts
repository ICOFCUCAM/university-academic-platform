// ---------------------------------------------------------------------------
// THE COURSE KNOWLEDGE BASE.
//
// After twelve weeks the university does not have twelve recordings. It has an
// academic representation of the whole course that a machine can read: what
// this course teaches, where each idea was taught, how the ideas connect, and
// what it leaves open.
//
// It is built by MERGING what each lecture's knowledge extraction found. That
// merge is where the interesting things surface, and they are the things no
// single lecture can show you:
//
//   A CONCEPT USED AND NEVER DEFINED. Lecture 03 leans on "hypostatic union"
//   and no lecture on the course defines it. The lecturer knows; the cohort
//   does not.
//
//   TWO LECTURES THAT DISAGREE. Lecture 02 and Lecture 09 define the same term
//   differently. The platform does NOT reconcile them — it shows both to the
//   lecturer and says which lecture said what. Reconciling somebody's course
//   for them is exactly the authorship this platform does not do.
//
//   AN IDEA THAT RUNS THROUGH THE COURSE. A thread: the lectures that build on
//   each other, in order.
// ---------------------------------------------------------------------------

export type NodeKind =
  | 'concept'     // an idea the course teaches
  | 'definition'  // a term given a meaning
  | 'claim'       // something asserted, that a student could be asked to defend
  | 'method'      // a procedure, a way of working
  | 'figure'      // a person, text or event the course treats as material
  | 'question';   // something the lecturer raised and left open

/** Where something was said. Every node carries at least one. */
export interface Provenance {
  lectureId: string;
  lectureSequence: number;
  lectureTitle: string;
  /** The lecturer's own sentence. Short: this is evidence, not an excerpt. */
  quote: string;
}

export interface KnowledgeNode {
  /** Normalised from the term, so two lectures naming the same thing merge. */
  id: string;
  term: string;
  kind: NodeKind;
  /**
   * In the lecturer's words, from the lecture that defined it. Null where the
   * course uses the term and never defines it — which is a finding, not a gap
   * for the platform to fill.
   */
  definition: string | null;
  definedIn: Provenance | null;
  mentions: Provenance[];
  /** Other node ids this one was taught alongside or in terms of. */
  relatedTo: string[];
}

/** Two lectures, one term, two meanings. Never merged, never chosen between. */
export interface Disagreement {
  nodeId: string;
  term: string;
  readings: { definition: string; where: Provenance }[];
}

/** An idea that runs across lectures, in the order the course builds it. */
export interface Thread {
  id: string;
  title: string;
  nodeIds: string[];
  lectureSequence: number[];
}

export interface CoverageRow {
  lectureId: string;
  lectureSequence: number;
  lectureTitle: string;
  /** Has this lecture contributed to the knowledge base at all? */
  extracted: boolean;
  concepts: number;
  definitions: number;
  openQuestions: number;
}

export interface CourseKnowledgeBase {
  courseId: string;
  builtAt: string;
  /** Lectures whose extraction was approved and therefore counted. */
  lecturesIncluded: string[];
  nodes: KnowledgeNode[];
  threads: Thread[];
  disagreements: Disagreement[];
  /** Used somewhere on the course, defined nowhere on it. */
  undefined: KnowledgeNode[];
  openQuestions: KnowledgeNode[];
  coverage: CoverageRow[];
}

/**
 * What one lecture's extraction pass returns, before merging. This is the
 * shape the model is held to — see `knowledge/extract.ts`.
 */
export interface LectureExtract {
  lectureId: string;
  lectureSequence: number;
  lectureTitle: string;
  nodes: {
    term: string;
    kind: NodeKind;
    definition: string | null;
    quote: string;
    relatedTo: string[];
  }[];
}

/** 'The Hypostatic Union' and 'hypostatic union' are one idea. */
export function nodeId(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
