// ---------------------------------------------------------------------------
// THE SHAPE OF THE PLATFORM.
//
//   UNIVERSITY
//   └── Faculty
//       └── Department
//           └── COURSE                 ← the central object. Everything hangs here.
//               ├── Lecturer(s)
//               ├── Lecture 01
//               │   ├── Recording               (the lecturer's own voice)
//               │   ├── Transcript              (machine)
//               │   ├── Corrected academic text (machine, lecturer corrects)
//               │   ├── Structured notes        (machine)
//               │   ├── 15-minute audio         (machine)
//               │   └── Revision materials      (machine)
//               ├── Lecture 02 …
//               └── COURSE AI           ← answers only out of this course's lectures
//   └── Students
//       └── Enrolled courses
//
// The distinction the University drew, and the reason it is in the type system
// rather than in a README:
//
//   THE LECTURER OWNS THE ACADEMIC SOURCE MATERIAL.
//   THE UNIVERSITY OWNS THE COURSE ENVIRONMENT.
//   AI TRANSFORMS THE MATERIAL.
//   STUDENTS CONSUME IT.
//
// So every artefact carries who owns it and what made it, and `ownership.ts`
// answers every question about who may touch what from those two fields. A
// screen that decided for itself would be a fourth opinion.
// ---------------------------------------------------------------------------

/** ---- Who publishes a course ------------------------------------------- */

/**
 * A UNIVERSITY IS NOT THE ONLY KIND OF TEACHER.
 *
 *   GLOBAL PLATFORM
 *        ├── universities   — faculties, departments, cohorts, a registry
 *        └── independent educators — one person, their own courses
 *
 * Both publish courses; everything downstream is identical, because the
 * pipeline, the approval layer and the Course AI never ask who employs the
 * lecturer. What differs is the environment ABOVE the course: a university has
 * faculties and departments and a registry that opens courses, and an
 * independent educator is the whole institution.
 */
export interface Publisher {
  id: string;
  kind: 'university' | 'independent';
  name: string;
  shortName?: string;
}

/** ---- The environment. The university's, in every deployment. ---------- */

export interface University {
  id: string;
  name: string;
  /** Shown on the masthead. No claim is made about the institution here. */
  shortName?: string;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  code?: string;
}

export interface Department {
  id: string;
  facultyId: string;
  name: string;
  code?: string;
}

/** The central object. */
export interface Course {
  id: string;
  /** Who publishes it. Absent means the deployment's own institution. */
  publisherId?: string;
  /**
   * Optional: an independent educator has no faculty and no department, and a
   * platform that required one would make them invent a fiction.
   */
  departmentId?: string;
  code: string;
  title: string;
  creditUnit?: number;
  session?: string;
  semester?: number;
  description?: string;
  /** Who teaches it. More than one, because co-teaching is normal. */
  lecturerIds: string[];
  /**
   * Terms this lecturer uses that must never be substituted, normalised,
   * translated or respelled — proper names, theological and disciplinary
   * terms. The lecturer maintains it; the transformation is held to it
   * mechanically, not asked to respect it.
   */
  terminology?: string[];
  /**
   * The language the lecture is GIVEN in. The original, and the one that
   * governs: where a translation and the original disagree, this is what the
   * lecturer taught and what the student is examined on.
   */
  originalLanguage?: string;
  /** Languages this course is offered in besides the original. */
  offeredLanguages?: string[];
  /** The university opens and closes the course; a lecturer never does. */
  status: 'draft' | 'running' | 'archived';
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  role: import('../capabilities').Role;
}

export interface Enrolment {
  id: string;
  courseId: string;
  studentId: string;
  status: 'registered' | 'completed' | 'withdrawn';
}

/** ---- The lecture, and what is made from it --------------------------- */

export interface Lecture {
  id: string;
  /**
   * The course this lecture belongs to — or the personal library of whoever
   * uploaded it. A STUDENT WHO RECORDS THEIR OWN LECTURE IS THE OWNER OF THAT
   * RECORDING and the whole pipeline is theirs: their notes, their audio,
   * their revision. Nobody approves it for them, because nobody else receives
   * it. The approval layer exists where material reaches a COHORT, and a
   * personal library reaches one person.
   */
  context: 'course' | 'personal';
  courseId: string;
  /** 01, 02, 03 — the order the course is taught in. */
  sequence: number;
  title: string;
  /** The lecturer's own framing. Not generated. */
  abstract?: string;
  deliveredOn?: string;
  /** Whose lecture this is: the lecturer who gave it, or the student who recorded it. */
  ownerId: string;
  createdBy: string;
  createdAt: string;
  /** What was uploaded, so the dashboard can say "74 min lecture". */
  sourceMinutes?: number;
}

/**
 * What a lecture becomes, in the order it is made. `recording` is the only one
 * a person supplies; every other is a transformation of the one before it,
 * which is why `stages.ts` can state the chain as data.
 *
 * THE ACADEMIC PROCESSOR IS THREE PASSES, NOT ONE. Grammar and language,
 * structure and formatting, and knowledge extraction are separate artefacts
 * because they fail separately, are corrected separately, and one of them —
 * the extraction — is not for reading at all. It is what the course's
 * knowledge base is built from.
 */
export const ARTEFACT_KINDS = [
  'recording',
  'transcript',
  'corrected_text',      // grammar & language
  'knowledge_extract',   // knowledge extraction  → the course knowledge base
  'structured_notes',    // structure & formatting
  'teaching_script',     // what will be read aloud
  'audio_15min',
  'revision_materials',
] as const;

export type ArtefactKind = (typeof ARTEFACT_KINDS)[number];

/**
 * WHO MADE IT — and therefore who may change it.
 *
 * `lecturer`  the academic source. Theirs, and it leaves with them.
 * `ai`        a transformation. Theirs too, as a derived work of their
 *             material, but it is a PROPOSAL until they have approved it.
 * `university` the environment: the course shell, the enrolment, the term.
 */
export type Origin = 'lecturer' | 'ai' | 'university';

export type ArtefactState =
  | 'absent'     // nothing has been made yet
  | 'queued'     // asked for, not started
  | 'running'    // the transformation is working
  | 'ready'      // made, and nobody has read it yet
  | 'approved'   // the lecturer has read it and stands behind it
  | 'published'  // students can see it
  | 'failed';    // the transformation could not finish

export interface Artefact {
  id: string;
  lectureId: string;
  courseId: string;
  kind: ArtefactKind;
  origin: Origin;
  /** The person whose material this is. Never the university, never the model. */
  ownerId: string;
  state: ArtefactState;

  /** The artefact this one was made from. Null only for a recording. */
  derivedFromId: string | null;

  /**
   * BCP-47. The original lecture's language, or the language this artefact was
   * translated into. Absent means the course's original language, so every
   * artefact made before this platform spoke more than one language still
   * reads correctly.
   */
  language?: string;
  /**
   * The approved artefact this is a translation of. TRANSLATION IS DERIVED
   * FROM AN APPROVAL, never from a draft: `derivedFromId` says which stage of
   * the pipeline it belongs to, and this says which approved original it
   * carries into another language.
   */
  translatedFromId?: string;
  /** Who, if anybody, has read this translation. See i18n/languages.ts. */
  translationStanding?: import('../i18n/languages').TranslationStanding;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;

  /** Text artefacts carry their body here; media artefacts carry a path. */
  body?: string;
  /**
   * A long lecture becomes SEVERAL fifteen-minute lessons rather than one
   * compressed list. Each part is its own script and its own recording, and
   * the student listens to part two on the way home.
   */
  parts?: { part: number; ofParts: number; label: string; body?: string; mediaPath?: string; seconds?: number }[];
  mediaPath?: string;
  mediaSeconds?: number;

  /** What made it, in the lecturer's words or the model's id. Never guessed. */
  producedBy?: string;
  /** Set when a transformation fails, and shown to the lecturer verbatim. */
  error?: string;

  /**
   * THE SECOND PASS. Whether the transformation introduced, removed or altered
   * a substantive claim — not whether the lecturer was right. Absent means it
   * has not been checked, which the review screen says out loud rather than
   * leaving blank.
   */
  verification?: import('../ai/verify').VerificationReport;

  /**
   * Where the lecturer's own terminology did not survive the transformation.
   * Found by counting, not by asking a model, so nothing here can be talked
   * round. Empty is the normal case and means the check ran and found nothing.
   */
  terminology?: import('../ai/terminology').TerminologyFinding[];

  /**
   * What the language-agnostic checks found: a protected term that did not
   * cross, a figure that vanished, a section that disappeared. Checked without
   * reading the language, because nobody here reads all seven.
   */
  translationFindings?: import('../i18n/validate').TranslationFinding[];

  /**
   * THE WORD CHECK. Set once a person has been through the words this system
   * could not place and has accepted or replaced each one. The audio stage
   * refuses to run without it: a mis-transcribed word in a text is a typo a
   * reader shrugs at, and in the audio it is a confident voice saying
   * something that was never taught.
   */
  wordCheck?: import('../ai/unusual').WordCheck;

  createdAt: string;
  updatedAt: string;

  // ---- THE APPROVAL LAYER, AS A RECORD RATHER THAN A FLAG ---------------
  //
  //   Lecture → AI → LECTURER REVIEW → Student
  //
  // never Lecture → AI → Student. The name is kept, not merely the fact:
  // a student reading these notes is told "Published by Dr Achebe", and the
  // university is answerable for material a named academic stood behind.
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  publishedAt?: string;

  // ---- VERSIONS ---------------------------------------------------------
  //
  //   Recording → Transcript v1 → AI processing v1 → lecturer corrections
  //             → Published v2
  //
  // `version` is the head. Every earlier body is kept in `ArtefactVersion`,
  // because "the lecturer corrected it" is a claim a university may one day
  // have to evidence — and because a correction that turns out to be wrong
  // has to be recoverable.
  version: number;
  /**
   * True once a person has edited this artefact. The AUTHORITATIVE version:
   * everything downstream is regenerated from it and never from the machine's
   * first draft again.
   */
  correctedByLecturer: boolean;
  /**
   * Set when something upstream changed after this was made. The screen says
   * "the notes were made from an older version of the text" and offers to
   * regenerate — silence here is how a corrected course keeps teaching the
   * uncorrected version.
   */
  staleSince?: string;
}

/**
 * One earlier state of an artefact. Kept in full: a diff cannot be published,
 * and a version you cannot open is not a version.
 */
export interface ArtefactVersion {
  id: string;
  artefactId: string;
  version: number;
  body?: string;
  mediaPath?: string;
  /** Who wrote this version — a person's id, or the model that produced it. */
  authoredBy: string;
  authoredByName?: string;
  origin: Origin;
  /** What changed, in the lecturer's words, where they said. */
  note?: string;
  createdAt: string;
}

/** ---- What the Course AI makes on request ------------------------------ */

/**
 * A test, a flashcard set, a cross-lecture audio revision — made on demand,
 * from the course knowledge base, over a stated range of lectures.
 *
 * WHO ASKED FOR IT DECIDES WHO SEES IT, and this is the approval layer
 * reaching into the Course AI. A lecturer's study aid is course material: it
 * goes through review and is published under their name. A student's is a
 * personal study aid, visible to them alone and labelled as unreviewed — the
 * alternative being machine-generated material circulating in a cohort with a
 * university's name on it and no academic behind it.
 */
export type StudyAidKind = 'test' | 'flashcards' | 'audio_revision' | 'summary';

export interface StudyAid {
  id: string;
  courseId: string;
  kind: StudyAidKind;
  title: string;
  /** Which lectures it draws on. "Lectures 1–6" is the student's own ask. */
  lectureIds: string[];
  requestedBy: string;
  audience: 'course' | 'private';
  state: ArtefactState;
  body?: string;
  mediaPath?: string;
  /** How many questions, which register — the ask, kept so it can be re-run. */
  brief?: { questions?: number; register?: Register; minutes?: number };
  approvedByName?: string;
  createdAt: string;

  // ---- ONE SET OF QUESTIONS, IN SEVERAL LANGUAGES ------------------------
  //
  //   Approved lecture → MASTER QUIZ → translation → localised quiz
  //
  // and never: translated notes → a quiz written from them. The second way
  // gives the French cohort different questions from the English one, drifting
  // a little further with every language, and the two cohorts sit the same
  // examination. So a quiz is written ONCE, from the master content, and then
  // carried across — the same academic questions, in the student's language.
  language?: string;
  /** The master study aid this one was translated from. */
  translatedFromId?: string;
  translationStanding?: import('../i18n/languages').TranslationStanding;
  /** What the language-agnostic validator found. Empty is the normal case. */
  translationFindings?: import('../i18n/validate').TranslationFinding[];
}

/**
 * "Give me a simple explanation." … "Now give me the university-level
 * explanation." The same material, two registers, and the student chooses.
 */
export type Register = 'plain' | 'university';

/** ---- The Course AI ---------------------------------------------------- */

export interface TutorCitation {
  lectureId: string;
  lectureSequence: number;
  lectureTitle: string;
  artefactKind: ArtefactKind;
  quote: string;
}

export interface TutorMessage {
  id: string;
  conversationId: string;
  role: 'student' | 'tutor';
  body: string;
  citations: TutorCitation[];
  /**
   * Why the tutor declined. The Course AI answers out of this course's
   * approved lectures and nothing else; when the material does not cover the
   * question it says so instead of reaching for what it happens to know.
   */
  refusedReason?: 'not-in-course-material' | 'not-enrolled' | 'nothing-published';
  /** The register the answer was given in, where the student asked for one. */
  register?: Register;
  /** Set when the turn produced something: a test, a revision audio. */
  studyAidId?: string;
  createdAt: string;
}

export interface TutorConversation {
  id: string;
  courseId: string;
  studentId: string;
  title?: string;
  createdAt: string;
}
