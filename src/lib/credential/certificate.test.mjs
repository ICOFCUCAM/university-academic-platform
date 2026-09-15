// ---------------------------------------------------------------------------
// A CERTIFICATE SAYS SOMETHING TRUE, OR IT SAYS NOTHING.
//
// The temptation is a certificate for finishing the videos: worth nothing,
// known by everybody to be worth nothing, and corrosive to the ones a
// university does mean. So it names what it attests, a person issues it, and
// somebody with no account can check it.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const C = await load('credential/certificate.ts');
const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const S = await load('service.ts');

const t = suite('Certificates');
const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const lecturer = { id: 'person-lecturer', role: 'lecturer' };
const student = { id: 'person-student', role: 'student' };

t.section('A course that has not said what completion means certifies nothing');
// AN EMPTY RULE IS NOT "EVERYBODY PASSES". It is a lecturer who has not said
// what finishing their course means, and the platform will not decide that.
const nothing = C.assess({}, {
  lecturesPublished: 10, lecturesRead: 10, quizzesTaken: 5, quizAverage: 90, assignmentsMarked: 3,
});
t.check('even a perfect record is not enough', nothing.met, false);
t.check('…and the reason is the course, not the student',
  nothing.lines[0].requirement, 'The course has not said what completing it means');

t.section('And where it has, each requirement is shown with what was actually done');
const rule = { lecturesRead: 0.8, quizzesTaken: 3, quizAverage: 60 };
const short = C.assess(rule, {
  lecturesPublished: 10, lecturesRead: 6, quizzesTaken: 3, quizAverage: 71, assignmentsMarked: 0,
});
t.check('not met', short.met, false);
t.check('…and it says which line failed',
  short.lines.filter((l) => !l.met).map((l) => l.actual), ['read 6']);
t.check('…with what was needed', short.lines[0].requirement,
  'Read the notes for at least 8 of 10 lectures');

const done = C.assess(rule, {
  lecturesPublished: 10, lecturesRead: 9, quizzesTaken: 4, quizAverage: 71, assignmentsMarked: 1,
});
t.check('met when every line is met', done.met, true);

t.section('What it attests are facts, not adjectives');
const attests = C.attestation({
  lecturesPublished: 10, lecturesRead: 9, quizzesTaken: 4, quizAverage: 71, assignmentsMarked: 1,
}, done);
t.check('the reading is stated', attests[0], 'Read the published notes for 9 of 10 lectures.');
t.check('…and the quizzes, with the average', attests[1], 'Sat 4 quizzes, averaging 71%.');
t.check('nothing says "completed" on its own',
  attests.some((line) => /^completed/i.test(line)), false);

t.section('A person issues it, and only when the record supports it');
{
  const store = fresh();
  await t.refuses('a student cannot certify themselves',
    () => S.issueCertificate(store, student, 'course-biol101', 'person-student'));
  await t.refuses('and a lecturer cannot issue one the record does not support',
    () => S.issueCertificate(store, lecturer, 'course-biol101', 'person-student'));

  // Do the work: read the published lectures and sit some quizzes.
  for (const lectureId of ['lecture-05', 'lecture-06']) {
    await S.recordStudy(store, student, { courseId: 'course-biol101', lectureId, event: 'read' });
  }
  for (let i = 0; i < 3; i++) {
    await store.recordProgress({
      id: `q${i}`, personId: 'person-student', courseId: 'course-biol101',
      lectureId: 'lecture-06', event: 'quiz-taken', score: 8, outOf: 10,
      at: new Date().toISOString(),
    });
  }

  const certificate = await S.issueCertificate(store, lecturer, 'course-biol101', 'person-student');
  t.check('it carries the name the university records', certificate.studentName, 'Joseph Adeyemi');
  t.check('…and who issued it', certificate.issuedByName, 'Dr Amara Okonjo');
  t.check('…and what it attests', certificate.attests.some((line) => line.includes('averaging 80%')), true);
  t.check('…with a code that can be read over a telephone',
    /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(certificate.code), true);

  t.section('And somebody with no account can check it');
  const checked = await S.verifyCertificate(store, certificate.code.toLowerCase());
  t.check('the code is found however it is typed', checked.courseCode, 'BIOL 101');
  t.check('…and shows what it attests', checked.attests.length > 0, true);
  // NOTHING ELSE ABOUT THE PERSON. Not their email, not their other courses,
  // not whether they are still enrolled.
  t.check('…and nothing else about the person',
    Object.keys(checked).sort(),
    ['attests', 'courseCode', 'courseTitle', 'issuedAt', 'issuedByName', 'revoked', 'revokedReason', 'studentName']);
  t.check('a code that was never issued is simply not found',
    await S.verifyCertificate(store, 'FFFF-FFFF-FFFF'), null);
}

t.done();
