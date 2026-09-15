// ---------------------------------------------------------------------------
// PROGRESS WITHOUT SURVEILLANCE.
//
// A lecturer needs to know whether the cohort is reading Lecture 04. They do
// not need to know that Joseph opened it at two in the morning and stopped
// after ninety seconds — and a platform that told them would change what a
// student is willing to open.
//
// The proof that the line holds is the last section: `cohortShape` cannot
// return a name, because it reduces `personId` to a set size and nothing
// downstream can recover it.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const P = await load('study/progress.ts');
const t = suite('Progress without surveillance');

const record = (personId, lectureId, event, extra = {}) => ({
  id: `${personId}-${lectureId}-${event}-${extra.at ?? ''}`,
  personId, courseId: 'c1', lectureId, event, at: '2026-09-10T10:00:00.000Z', ...extra,
});

const records = [
  record('stu-1', 'l1', 'read'), record('stu-1', 'l1', 'listened'),
  record('stu-1', 'l1', 'quiz-taken', { score: 8, outOf: 10 }),
  record('stu-1', 'l1', 'quiz-taken', { score: 9, outOf: 10, at: '2026-09-11T10:00:00.000Z' }),
  record('stu-2', 'l1', 'read'),
  record('stu-2', 'l1', 'read', { at: '2026-09-12T10:00:00.000Z' }),
  record('stu-3', 'l2', 'read'),
];

t.section('What a student sees of their own work');
const mine = P.myProgress(records.filter((r) => r.personId === 'stu-1'), ['l1', 'l2']);
t.check('Lecture 01 is read', mine[0].read, true);
t.check('…and listened to', mine[0].listened, true);
t.check('…and sat', mine[0].quizTaken, true);
t.check('…with their best attempt, not their last', mine[0].bestScore, { score: 9, outOf: 10 });
t.check('Lecture 02 is untouched', mine[1], { lectureId: 'l2', read: false, listened: false, revised: false, quizTaken: false, bestScore: undefined });

// AND A QUIZ WITH NOTHING TO MARK WAS STILL SAT. Written answers carry no
// score; a progress page that called that "not taken" would be telling a
// student they had not done the work they had just done.
t.check('an unscored attempt still counts as sat',
  P.myProgress([record('stu-9', 'l3', 'quiz-taken', { score: 0, outOf: 0 })], ['l3'])[0].quizTaken, true);
t.check('…with no best score to show',
  P.myProgress([record('stu-9', 'l3', 'quiz-taken', { score: 0, outOf: 0 })], ['l3'])[0].bestScore, undefined);

t.section('What a lecturer sees of the cohort');
const shape = P.cohortShape(records, ['l1', 'l2']);
t.check('two students read Lecture 01', shape[0].readers, 2);
// ONE STUDENT READING TWICE IS ONE READER. Counting events would tell a
// lecturer their cohort is twice its size on a lecture people re-read.
t.check('…and re-reading does not make three', shape[0].readers, 2);
t.check('one listened', shape[0].listeners, 1);
t.check('one sat the quiz', shape[0].quizzesTaken, 1);
t.check('…and the cohort averaged 85%', shape[0].averageScore, 85);
t.check('Lecture 02 has one reader and no quiz', [shape[1].readers, shape[1].quizzesTaken], [1, 0]);
t.check('…and no average where nobody sat it', shape[1].averageScore, undefined);

t.section('And it cannot tell them who');
// The proof, and it is structural: every key of a cohort row is a number.
t.check('a row is counts and a lecture id, nothing else',
  Object.keys(shape[0]).sort(), ['averageScore', 'lectureId', 'listeners', 'quizzesTaken', 'readers']);
t.check('…and no name survives the reduction',
  JSON.stringify(shape).includes('stu-'), false);

t.section('What is worth interrupting a lecturer for');
const gaps = P.neglected(shape, 5);
t.check('a lecture two of five have read is not flagged',
  gaps.some((row) => row.lectureId === 'l1'), false);
t.check('…one of five is', gaps.some((row) => row.lectureId === 'l2'), true);
t.check('an empty cohort flags nothing', P.neglected(shape, 0), []);

t.done();
