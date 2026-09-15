// ---------------------------------------------------------------------------
// "Lecturers teach. AI transforms. Students learn." — as a matrix.
//
// The interesting half is what each role is REFUSED, because that is where the
// sentence stops being a slogan: an administrator who could correct a lecture
// would be teaching, and a lecturer who could enrol a cohort would be the
// registry.
// ---------------------------------------------------------------------------

import { load, suite } from './testkit.mjs';

const C = await load('capabilities.ts');
const t = suite('Who may do what');

t.section('The lecturer holds the academic material, and only that');
const MAY = [
  ['upload their own recording', 'upload-source-material'],
  ['run the transformations', 'run-transformation'],
  ['correct what the model wrote', 'correct-derived-text'],
  ['approve it', 'approve-artefact'],
  ['publish it to their students', 'publish-to-students'],
  ['take their own material back', 'withdraw-own-material'],
  ['and leave with it', 'export-own-material'],
  ['see their courses', 'view-own-courses'],
  ['see who is on them', 'view-registered-students'],
  ['see what is being studied', 'view-engagement'],
  ['ask the Course AI', 'ask-course-ai'],
  ['change their own password, as every account may', 'change-own-password'],
  // ASKS FOR A TRANSLATION, AND DOES NOT VOUCH FOR IT. The pair below is the
  // whole multilingual rule in two lines.
  ['ask for their lecture to be translated', 'request-translation'],
  // THEIR OWN VOICE, AND NOBODY ELSE'S DECISION. A voice is a person; consent
  // to synthesise one is not an institutional decision about an employee.
  ['authorise the use of their own voice', 'authorise-own-voice'],
  ['set the reading', 'set-reading'],
  ['set an assignment', 'set-assignment'],
  // A MARK IS A PERSON'S ACT. There is no capability a machine can hold and
  // no screen that suggests a number.
  ['mark an assignment themselves', 'mark-assignment'],
];
const MAY_NOT = [
  // A lecturer who does not read Arabic cannot approve the Arabic, and a
  // platform that let them would be manufacturing an approval nobody gave.
  ['vouch for a translation they cannot read', 'approve-translation'],
  ['change a student’s working language', 'set-working-language'],
  ['open or retire a course', 'manage-courses'],
  ['say who teaches it', 'assign-lecturers'],
  ['enrol or remove a student', 'manage-enrolment'],
  ['open a faculty', 'manage-faculties'],
  ['administer accounts', 'manage-people'],
];
for (const [what, capability] of MAY) t.check(`a lecturer may ${what}`, C.can('lecturer', capability), true);
for (const [what, capability] of MAY_NOT) t.check(`a lecturer may NOT ${what}`, C.can('lecturer', capability), false);
// AND NOTHING BESIDE IT. A capability quietly added would pass both loops.
t.check('…and holds nothing else', C.capabilitiesOf('lecturer').length, MAY.length);

t.section('The university administers, and does not author');
for (const [what, capability] of [
  ['open faculties and departments', 'manage-faculties'],
  ['open courses', 'manage-courses'],
  ['assign lecturers', 'assign-lecturers'],
  ['enrol students', 'manage-enrolment'],
  ['change a student’s working language, with a reason', 'set-working-language'],
]) t.check(`the registry may ${what}`, C.can('registry', capability), true);

// AND NOT A VOICE. A university cannot consent on a lecturer's behalf to
// having their voice synthesised, however convenient that would be.
t.check('the registry may NOT authorise a lecturer’s voice',
  C.can('registry', 'authorise-own-voice'), false);

for (const [what, capability] of [
  ['upload a lecture', 'upload-source-material'],
  ['run a transformation', 'run-transformation'],
  ['correct academic text', 'correct-derived-text'],
  ['approve anything', 'approve-artefact'],
  ['publish to a cohort', 'publish-to-students'],
]) t.check(`the registry may NOT ${what}`, C.can('registry', capability), false);

t.section('A coordinator runs courses; they do not write them either');
t.check('may open a course', C.can('coordinator', 'manage-courses'), true);
t.check('may not approve academic material', C.can('coordinator', 'approve-artefact'), false);
t.check('may not administer accounts', C.can('coordinator', 'manage-people'), false);

t.section('An assistant prepares');
t.check('may upload', C.can('assistant', 'upload-source-material'), true);
t.check('may run the engine', C.can('assistant', 'run-transformation'), true);
t.check('may keep the reading list', C.can('assistant', 'set-reading'), true);
t.check('may not approve', C.can('assistant', 'approve-artefact'), false);
t.check('may not publish', C.can('assistant', 'publish-to-students'), false);
t.check('may not set work', C.can('assistant', 'set-assignment'), false);
t.check('may not mark it', C.can('assistant', 'mark-assignment'), false);

t.section('A translation reviewer vouches for one language, and authors nothing');
t.check('may approve a translation', C.can('translation-reviewer', 'approve-translation'), true);
t.check('may correct the translated text', C.can('translation-reviewer', 'correct-derived-text'), true);
t.check('may NOT publish', C.can('translation-reviewer', 'publish-to-students'), false);
t.check('may NOT upload a lecture', C.can('translation-reviewer', 'upload-source-material'), false);
t.check('may NOT approve the lecture itself', C.can('translation-reviewer', 'approve-artefact'), false);
t.check('may NOT ask for more translations', C.can('translation-reviewer', 'request-translation'), false);

t.section('A student consumes and interacts — and uploads nothing');
t.check('may study what was published', C.can('student', 'study-published-material'), true);
t.check('may ask the Course AI', C.can('student', 'ask-course-ai'), true);
t.check('may hand work in', C.can('student', 'submit-assignment'), true);
t.check('may not upload a lecture to a course', C.can('student', 'upload-source-material'), false);
t.check('may not mark anything', C.can('student', 'mark-assignment'), false);
// THE WORKING LANGUAGE IS NOT A SWITCH IN THE CORNER OF A COURSE. A student
// hopping between languages mid-term revises from four half-remembered
// versions of one lecture.
t.check('may not change their own working language', C.can('student', 'set-working-language'), false);
t.check('may not run a transformation on one', C.can('student', 'run-transformation'), false);
t.check('may not publish anything', C.can('student', 'publish-to-students'), false);
t.check('…and holds four capabilities, no more', C.capabilitiesOf('student').length, 4);

t.section('Every refusal can be explained to the person it refused');
for (const capability of ['correct-derived-text', 'approve-artefact', 'publish-to-students', 'manage-courses', 'manage-enrolment', 'assign-lecturers']) {
  t.check(`“${capability}” has words`, typeof C.REFUSAL[capability], 'string');
}

t.done();
