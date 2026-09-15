// ---------------------------------------------------------------------------
// THE LOG, AND THE LINE IT MUST NOT CROSS.
//
// The check that matters here is negative: no act on the list is a reading
// act, and there is no way to add one without this failing. A log of
// administrative acts is what a university needs; a log of who opened which
// notes at what hour is surveillance wearing the same word.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const A = await load('audit/audit.ts');
const t = suite('The audit log');

t.section('What may be recorded');

const acts = Object.keys(A.AUDITED_ACTS);
t.check('there are acts on the list', acts.length > 8, true);

// THE GUARD. Every act name and every phrase is held against the words that
// would mean somebody's reading was being kept.
const reading = acts.filter((act) => A.NEVER_AUDITED.some((word) =>
  act.toLowerCase().includes(word) || A.AUDITED_ACTS[act].toLowerCase().includes(word)));
t.check('none of them records that somebody read, opened or listened to anything', reading, []);

t.check('an act on the list is audited', A.isAudited('artefact.published'), true);
t.check('one nobody defined is refused', A.isAudited('artefact.read'), false);
t.check('…and so is a made-up one', A.isAudited('whatever.happened'), false);

// PROVING THE GUARD BY BREAKING IT: if a reading act were ever added to the
// list, the filter above would catch it. Here is that filter, shown refusing.
const pretend = { ...A.AUDITED_ACTS, 'artefact.read': 'read the notes' };
const caught = Object.keys(pretend).filter((act) => A.NEVER_AUDITED.some((word) =>
  act.toLowerCase().includes(word) || pretend[act].toLowerCase().includes(word)));
t.check('and the check would catch one if somebody added it', caught, ['artefact.read']);

t.section('How a line reads');

const entry = {
  id: 'a1', at: '2026-03-04T09:00:00.000Z', act: 'artefact.withdrawn',
  actorId: 'person-lecturer', actorName: 'Dr Amara Okonjo', actorRole: 'lecturer',
  subject: 'structured notes, version 2', courseId: 'course-biol101',
};
t.check('it is a sentence, not a row of columns', A.describe(entry),
  'Dr Amara Okonjo (lecturer) withdrew it from the cohort — structured notes, version 2');

t.section('Who may read it');

const entries = [
  entry,
  { ...entry, id: 'a2', courseId: 'course-chem101', actorName: 'Somebody Else' },
  { ...entry, id: 'a3', courseId: undefined, act: 'language.changed', subject: 'a student' },
];

t.check('the registry reads all of it',
  A.visibleTo(entries, { role: 'registry', coursesTaught: [], everything: true }).length, 3);
t.check('a lecturer reads their own course’s acts',
  A.visibleTo(entries, { role: 'lecturer', coursesTaught: ['course-biol101'], everything: false })
    .map((e) => e.id), ['a1']);
t.check('…and not another course’s',
  A.visibleTo(entries, { role: 'lecturer', coursesTaught: ['course-biol101'], everything: false })
    .some((e) => e.courseId === 'course-chem101'), false);
// AN ENTRY WITH NO COURSE IS THE INSTITUTION'S. A lecturer has no standing to
// read that a registrar changed somebody's working language.
t.check('…and not an act that belongs to no course',
  A.visibleTo(entries, { role: 'lecturer', coursesTaught: ['course-biol101'], everything: false })
    .some((e) => e.id === 'a3'), false);

t.done();
