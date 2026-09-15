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

  // ---- Teaching around the material --------------------------------------
  'view-own-courses',
  'view-registered-students',
  'view-engagement',         // who has studied what. Not surveillance: counts.

  // ---- The student's side -------------------------------------------------
  'study-published-material',
  'ask-course-ai',

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

  student: ['study-published-material', 'ask-course-ai', 'change-own-password'],
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
};
