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
  /**
   * The institution's own approved voice, where it has one — the registry's to
   * set, because it speaks for the university rather than for a course. A
   * lecturer's voice is never this: that is consent, and consent is personal.
   */
  standardVoice?: import('../voice/voices').Voice;
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
  /**
   * WHO MAY READ WHAT HAS BEEN PUBLISHED.
   *
   *   enrolled  the cohort, and nobody else. A taught course.
   *   open      anybody signed in. An open course, continuing education, a
   *             university publishing internationally.
   *   paid      the cohort, where enrolment was bought. Payment is NOT built
   *             — this behaves exactly like `enrolled` and is here so the
   *             distinction exists in the data before it exists in a checkout.
   *
   * Access is the environment's, like enrolment: a lecturer decides what is
   * published, the institution decides who may see it.
   */
  access?: 'enrolled' | 'open' | 'paid';
  price?: { amount: number; currency: string };
  /**
   * Other publishers whose students may take this course — a partnership, a
   * shared library, a consortium. The federation that would synchronise them
   * is not built; this records the intent.
   */
  partners?: string[];
  /**
   * The voice this course is spoken in by default, where the lecturer has set
   * one, and the voices they permit on it. A student still chooses among what
   * is available to them — voice is how a lesson sounds, not what it says.
   */
  defaultVoice?: string;
  allowedVoices?: string[];
  /**
   * What completing this course means, if the lecturer has said. Absent means
   * no certificate can be issued: a course that has not said what completion
   * is does not certify anything, and the platform will not decide it.
   */
  completion?: import('../credential/certificate').CompletionRule;
  /** The university opens and closes the course; a lecturer never does. */
  status: 'draft' | 'running' | 'archived';
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  role: import('../capabilities').Role;

  // ---- THE STUDENT'S LEARNING PROFILE ------------------------------------
  //
  //   WORKING LANGUAGE — one, chosen when they join, and the whole academic
  //   environment arrives in it: notes, transcript, audio, quizzes,
  //   flashcards, the Course AI and the interface. There is no language
  //   switcher inside a course. A student hopping between languages mid-term
  //   revises from four half-remembered versions of one lecture, and the
  //   platform should not offer that as a convenience.
  //
  //   Changing it is an administrative act, not a click — see
  //   `service.setWorkingLanguage`.
  workingLanguage?: string;

  /**
   * VOICE IS A DIFFERENT LAYER. It changes how the audio is spoken and nothing
   * about what is said, so it is the student's to change whenever they like.
   */
  voicePreference?: string;
  audioSpeed?: number;

  /**
   * HOW THE PAGE IS PRESENTED TO THEM. Theirs alone: nobody sets these for
   * somebody else and no screen reports them to anybody — a lecturer reading
   * "this student uses the dyslexia-friendly typeface" would be reading a
   * disability that was disclosed to a stylesheet. See lib/access.
   */
  accessibility?: Partial<import('../access/accessibility').AccessibilitySettings>;

  /**
   * A LECTURER'S AUTHORISATION FOR THEIR OWN VOICE. Absent means no, and no is
   * the default for everybody, forever, until they say otherwise themselves.
   */
  voiceConsent?: import('../voice/voices').VoiceConsent;

  /**
   * What this account may process in a month. Absent means the institution's
   * licence, which is not metered by the minute — metering a lecturer's own
   * teaching would be absurd.
   */
  plan?: import('../billing/plans').PlanId;

  /**
   * Every change of working language, with who made it and why. A student who
   * finds their course in a different language next Monday is owed an answer
   * to "who did that, and when".
   */
  workingLanguageHistory?: {
    from?: string; to: string; by: string; byName?: string; reason: string; at: string;
  }[];
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

  /**
   * A TRANSCRIPT'S TIMINGS AND SPEAKERS, where the transcription service
   * reported them. Optional because most do not, and the screen says "no
   * timings" rather than showing 00:00 against every line — a timestamp
   * nobody measured is worse than none.
   */
  segments?: { start: number; end: number; speaker?: string; text: string }[];
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
  /**
   * WHO STANDS BEHIND IT — which is not the same question as who may see it.
   *
   * Everything here is built from material the lecturer already published, so
   * there is nothing personal in it and no reason to hide one student's quiz
   * from another. What differs is standing: a lecturer asked for this one and
   * it is course material; a student asked for that one and no academic has
   * read it, which is said on its face every time it is shown.
   *
   * IT IS ALSO WHY ONE FRENCH QUIZ SERVES TWENTY THOUSAND FRENCH STUDENTS.
   * Were a student's quiz private to them, the platform would generate the
   * same questions twenty thousand times — and two students in one seminar
   * would be revising from different papers.
   */
  standing: 'lecturer-requested' | 'unreviewed';
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

/** ---- Reading, set by the lecturer -------------------------------------- */

/**
 * A READING LIST IS NOT A TRANSFORMATION. Nothing is generated here and
 * nothing is translated: it is what the lecturer tells the cohort to read,
 * in the form they wrote it — a citation, a chapter, a link.
 *
 * It sits beside the lectures rather than inside the pipeline because it has
 * no source artefact, no approval chain and no master: a reading is published
 * or it is not.
 */
export interface Reading {
  id: string;
  courseId: string;
  /** Attached to one lecture, or to the course as a whole. */
  lectureId?: string;
  kind: 'book' | 'chapter' | 'article' | 'link' | 'document';
  /** The citation exactly as the lecturer gave it. Never reformatted. */
  citation: string;
  url?: string;
  /** Why they set it, in their words. */
  note?: string;
  /** Essential, or worth reading if there is time. */
  required: boolean;
  addedBy: string;
  addedAt: string;
  published: boolean;
}

/** ---- Assignments, which a person marks --------------------------------- */

/**
 * WHAT THE PLATFORM DOES NOT DO HERE IS THE POINT.
 *
 * It does not mark. Not a draft mark, not a suggested mark, not a rubric score
 * "for the lecturer to adjust" — because a mark is an academic judgement about
 * a student, and this platform's whole constitution is that AI transforms
 * material and does not adjudicate. A number a lecturer merely agreed to is a
 * number a model gave, and the student would have no way of knowing.
 *
 * So: the lecturer sets the work, the student hands it in, the lecturer marks
 * it with their own words and their own number, and the student sees both when
 * it is returned.
 */
export interface Assignment {
  id: string;
  courseId: string;
  lectureId?: string;
  title: string;
  /** The brief, as set. */
  brief: string;
  dueAt?: string;
  marksOutOf?: number;
  createdBy: string;
  createdAt: string;
  published: boolean;
}

export interface Submission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  body: string;
  submittedAt: string;
  late: boolean;
  /** Set only by a person, and only ever by a person. */
  mark?: number;
  feedback?: string;
  markedBy?: string;
  markedByName?: string;
  markedAt?: string;
  /** Marks exist before they are released; returning is a separate act. */
  returnedAt?: string;
}

/** ---- Sitting a quiz --------------------------------------------------- */

/**
 * One attempt at one quiz. Kept because "I got six out of ten last week" is
 * the whole point of sitting it twice — and because a cohort's average is what
 * tells a lecturer which lecture did not land.
 */
export interface QuizAttempt {
  id: string;
  studyAidId: string;
  courseId: string;
  lectureIds: string[];
  personId: string;
  /** Question number → the letter or the written answer they gave. */
  given: Record<number, string>;
  /** Marked automatically. Written answers are not machine-marked. */
  score: number;
  outOf: number;
  takenAt: string;
}

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
