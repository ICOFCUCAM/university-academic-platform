// ---------------------------------------------------------------------------
// THE PRINCIPLE THE PLATFORM IS BUILT ON, AND THE ONLY PROOF THAT IT HOLDS.
//
//   The lecturer owns the academic source material.
//   The university owns the course environment.
//   AI transforms the material.
//   Students consume it.
//
// Every check below is a REFUSAL as much as a permission, because a principle
// that only ever grants is not a principle. The three that matter most:
//
//   A UNIVERSITY ADMINISTRATOR CANNOT DELETE A LECTURER'S RECORDING. If they
//   could, the lecturer would not own it, whatever the prospectus says.
//
//   A UNIVERSITY ADMINISTRATOR CANNOT READ AN UNPUBLISHED DRAFT. Delivery is
//   theirs to see; a half-corrected transcript of somebody's speech is not.
//
//   NOBODY PUBLISHES WHAT NOBODY HAS APPROVED. Lecture → AI → Student is the
//   workflow this platform refuses to have.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const O = await load('domain/ownership.ts');
const t = suite('Whose thing is this?');

const course = { id: 'c1', departmentId: 'd1', code: 'BIOL 101', title: 'Cell Biology', lecturerIds: ['lect-1'], status: 'running' };
const enrolled = { id: 'e1', courseId: 'c1', studentId: 'stu-1', status: 'registered' };

const artefact = (over = {}) => ({
  id: 'a1', lectureId: 'l1', courseId: 'c1', kind: 'structured_notes', origin: 'ai',
  ownerId: 'lect-1', state: 'ready', derivedFromId: 'a0', body: '…',
  createdAt: '', updatedAt: '', version: 1, correctedByLecturer: false, ...over,
});

const lecturer = { id: 'lect-1', role: 'lecturer' };
const colleague = { id: 'lect-2', role: 'lecturer' };
const registry = { id: 'reg-1', role: 'registry' };
const assistant = { id: 'ta-1', role: 'assistant' };
const student = { id: 'stu-1', role: 'student' };
const stranger = { id: 'stu-9', role: 'student' };

const may = (actor, act, over, over2) =>
  O.mayAct(actor, act, artefact(over), { course: { ...course, ...(over2?.course ?? {}) }, enrolment: over2?.enrolment ?? null }).allowed;

t.section('The lecturer owns the academic source material');
t.check('their own recording is theirs to withdraw', may(lecturer, 'withdraw', { kind: 'recording', origin: 'lecturer' }), true);
t.check('…and to export', may(lecturer, 'export', {}), true);
t.check('…and to correct', may(lecturer, 'edit', {}), true);
t.check('a colleague on the course can read it', may(colleague, 'read', {}, { course: { lecturerIds: ['lect-1', 'lect-2'] } }), true);
t.check('…and cannot change it', may(colleague, 'edit', {}, { course: { lecturerIds: ['lect-1', 'lect-2'] } }), false);
t.check('a lecturer off the course cannot even read it', may(colleague, 'read', {}), false);

t.section('The university owns the environment — and not one word of the content');
t.check('the registry may read what has been published', may(registry, 'read', { state: 'published' }), true);
t.check('…and may NOT read an unpublished draft', may(registry, 'read', { state: 'ready' }), false);
t.check('…may not edit', may(registry, 'edit', { state: 'published' }), false);
t.check('…may not approve', may(registry, 'approve', {}), false);
t.check('…may not publish on the lecturer’s behalf', may(registry, 'publish', { state: 'approved' }), false);
// THE LINE THAT DECIDES WHETHER "THE LECTURER OWNS IT" IS TRUE.
t.check('…and may NOT delete the recording', may(registry, 'delete', { kind: 'recording', origin: 'lecturer' }), false);
t.check('a coordinator is no different', may({ id: 'co-1', role: 'coordinator' }, 'edit', {}), false);

t.section('AI proposes; a person approves');
t.check('an unapproved artefact cannot be published', may(lecturer, 'publish', { state: 'ready' }), false);
t.check('…and an approved one can', may(lecturer, 'publish', { state: 'approved' }), true);
t.check('the refusal says why', O.mayAct(lecturer, 'publish', artefact({ state: 'ready' }), { course, enrolment: null }).reason,
  'Approve it first: publishing puts it in front of students under your name.');

t.section('An assistant prepares and never releases');
const onCourse = { course: { lecturerIds: ['lect-1', 'ta-1'] } };
t.check('may run a transformation', may(assistant, 'transform', {}, onCourse), true);
t.check('may not approve', may(assistant, 'approve', {}, onCourse), false);
t.check('may not publish', may(assistant, 'publish', { state: 'approved' }, onCourse), false);
t.check('may not correct the academic text', may(assistant, 'edit', {}, onCourse), false);

t.section('Students consume what was published, on courses they are on');
t.check('an enrolled student reads published notes', may(student, 'read', { state: 'published' }, { enrolment: enrolled }), true);
t.check('…and not a draft', may(student, 'read', { state: 'ready' }, { enrolment: enrolled }), false);
// APPROVED IS NOT PUBLISHED. A lecturer who has read the notes and stands
// behind them has not necessarily decided the cohort should have them yet —
// the material may be for a lecture they have not given.
t.check('…and not an approved one the lecturer has not released', may(student, 'read', { state: 'approved' }, { enrolment: enrolled }), false);
t.check('…a student not on the course reads nothing', may(stranger, 'read', { state: 'published' }, { enrolment: null }), false);
t.check('…a withdrawn student reads nothing', may(student, 'read', { state: 'published' }, { enrolment: { ...enrolled, status: 'withdrawn' } }), false);
t.check('…and no student edits anything', may(student, 'edit', { state: 'published' }, { enrolment: enrolled }), false);

t.done();
