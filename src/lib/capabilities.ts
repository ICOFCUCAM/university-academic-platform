// ---------------------------------------------------------------------------
// WHAT SOMEBODY MAY DO — AND, THE HALF THAT CARRIES THE WEIGHT, MAY NOT.
//
// The platform's principle, in four lines:
//
//   The lecturer owns the academic source material.
//   The university owns the course environment.
//   AI transforms the material.
//   Students consume, study and interact with it.
//
// Those four lines are a separation of powers, so they are written as one:
// nobody holds a capability that would let them do somebody else's half. The
// university administrator can open a course and enrol a cohort and cannot
// write a word of its academic content. The lecturer owns every word and
// cannot enrol a student. The model transforms and approves nothing.
//
// Read `can(role, capability)` as the only answer. `ownership.ts` then decides
// whether this particular person may touch this particular artefact — a
// capability says what kind of act is yours, ownership says whose thing it is,
// and both have to agree.
// ---------------------------------------------------------------------------

export const CAPABILITIES = [
  // ---- The environment. The university's. --------------------------------
  'manage-faculties',        // open a faculty or a department
  'manage-courses',          // open, retire and describe a course
  'assign-lecturers',        // say who teaches it
  'manage-enrolment',        // put students on it and take them off
  'manage-people',           // accounts

  // ---- The academic material. The lecturer's. ----------------------------
  'upload-source-material',  // the recording, the slides, their own notes
  'run-transformation',      // ask the AI to make the next artefact
  'correct-derived-text',    // edit what the AI proposed
  'approve-artefact',        // stand behind it
  'publish-to-students',     // release it to the cohort
  'withdraw-own-material',   // take it back — it was never the university's
  'export-own-material',     // and leave with it

  // ---- Reaching students who do not read the lecture's language ----------
  //
  // Translation is a thing done TO an approved lecture, so asking for one is
  // the lecturer's. Vouching for the result is not: a lecturer who does not
  // read Arabic cannot approve the Arabic, and a platform that let them
  // would be manufacturing an approval nobody gave.
  'request-translation',
  'approve-translation',

  // ---- What the lecturer sets around the material ------------------------
  'set-reading',
  'set-assignment',
  // MARKING IS A PERSON'S ACT. There is no capability for a machine to hold,
  // and no screen offers a suggested mark: a mark a lecturer merely agreed to
  // is a mark a model gave, and the student could not tell.
  'mark-assignment',
  'submit-assignment',

  // ---- Teaching around the material --------------------------------------
  'view-own-courses',
  'view-registered-students',
  'view-engagement',         // who has studied what. Not surveillance: counts.

  // ---- The student's side -------------------------------------------------
  'study-published-material',
  'ask-course-ai',

  // ---- The student's environment, which is not theirs to change mid-course -
  //
  // A working language is chosen once and changed by an administrator with a
  // reason. The student's own screens have no switcher: four half-remembered
  // versions of one lecture is not a feature.
  'set-working-language',

  // ---- The lecturer's own voice -------------------------------------------
  //
  // Held by the lecturer alone. Not by the university, not by the registry: a
  // voice is a person, and consent to synthesise one is not an institutional
  // decision about an employee.
  'authorise-own-voice',

  // ---- Everybody ----------------------------------------------------------
  'change-own-password',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type Role =
  | 'registry'     // the university's administration: the environment, nothing else
  | 'coordinator'  // runs a department's courses. Environment, not content.
  | 'lecturer'     // owns the academic material of their courses
  | 'assistant'    // helps a lecturer. Never approves, never publishes.
  | 'translation-reviewer' // reads one language, and vouches for what it says
  | 'student';

/**
 * THE LECTURER, and the list is deliberately closed. A capability added here
 * is a power moved from one owner to another, and `capabilities.test.mjs`
 * counts the list so it cannot be done quietly.
 */
export const LECTURER_CAPABILITIES: Capability[] = [
  'upload-source-material',
  'run-transformation',
  'correct-derived-text',
  'approve-artefact',
  'publish-to-students',
  'withdraw-own-material',
  'export-own-material',
  'view-own-courses',
  'view-registered-students',
  'view-engagement',
  'ask-course-ai',
  'change-own-password',
  // Asks for the translation; does not vouch for it.
  'request-translation',
  // Their own voice, and nobody else's decision.
  'authorise-own-voice',
  // What they set around the lecture, and the marking of it.
  'set-reading', 'set-assignment', 'mark-assignment',
];

const MATRIX: Record<Role, Capability[]> = {
  // The university's environment, and not one line of anybody's lecture.
  // `correct-derived-text` and `approve-artefact` are absent on purpose: an
  // administrator who could edit a lecture would be authoring a course in a
  // lecturer's name.
  registry: [
    'manage-faculties', 'manage-courses', 'assign-lecturers', 'manage-enrolment',
    'manage-people', 'view-registered-students', 'view-engagement',
    'change-own-password',
    // A student's working language is changed here, with a reason recorded —
    // not by the student, mid-term, on a whim.
    'set-working-language',
  ],

  // A department's courses — the same environment powers, narrower, and
  // still no authorship.
  coordinator: [
    'manage-courses', 'assign-lecturers', 'manage-enrolment',
    'view-registered-students', 'view-engagement', 'change-own-password',
  ],

  lecturer: [...LECTURER_CAPABILITIES],

  // Prepares, never releases. An assistant can upload a recording and run the
  // transformations; approving the academic text and publishing it to a cohort
  // stay with the person whose lecture it is.
  assistant: [
    'upload-source-material', 'run-transformation',
    'view-own-courses', 'view-registered-students', 'change-own-password',
    // Keeps the reading list; does not set work and does not mark it.
    'set-reading',
  ],

  // READS ONE LANGUAGE AND VOUCHES FOR WHAT IT SAYS. Not a second author: they
  // cannot correct the lecturer's original, cannot publish it, and cannot
  // touch a course they were not asked onto. What they can do is say "this
  // Arabic says what the English says", which is the one thing a lecturer who
  // does not read Arabic cannot say.
  'translation-reviewer': [
    'approve-translation', 'correct-derived-text',
    'view-own-courses', 'study-published-material', 'change-own-password',
  ],

  student: [
    'study-published-material', 'ask-course-ai', 'change-own-password',
    'submit-assignment',
  ],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

export function capabilitiesOf(role: Role): Capability[] {
  return [...MATRIX[role]];
}

export const ROLE_LABEL: Record<Role, string> = {
  registry: 'Registry',
  coordinator: 'Coordinator',
  lecturer: 'Lecturer',
  assistant: 'Teaching assistant',
  'translation-reviewer': 'Translation reviewer',
  student: 'Student',
};

/**
 * Why a control is missing, in words. A control that simply vanishes teaches
 * nobody the rule; one that says who does hold it teaches it once.
 */
export const REFUSAL: Partial<Record<Capability, string>> = {
  'correct-derived-text': 'The academic text belongs to the lecturer who gave the lecture.',
  'approve-artefact': 'Only the lecturer whose lecture this is can stand behind it.',
  'publish-to-students': 'Releasing material to a cohort is the lecturer’s act.',
  'manage-courses': 'The course environment is opened and closed by the university.',
  'manage-enrolment': 'Enrolment is held by the registry.',
  'assign-lecturers': 'Who teaches a course is the university’s decision.',
  'approve-translation': 'A translation is vouched for by somebody who reads that language.',
  'request-translation': 'Translation is asked for by the lecturer whose lecture it is.',
  'set-working-language': 'Your working language is changed by the registry, so that a term is studied in one language.',
  'authorise-own-voice': 'Only the person whose voice it is can authorise its use.',
  'mark-assignment': 'A mark is an academic judgement about a student. It is the lecturer’s, and this platform never suggests one.',
  'set-assignment': 'Work is set by the people who teach the course.',
};
