// ---------------------------------------------------------------------------
// WHAT ANY STORE MUST DO.
//
// One suite, run against every implementation. The in-memory store passes it
// here; a Postgres or Supabase store must pass the same suite against a real
// database before anybody points a university at it — which is the difference
// between "we wrote an adapter" and "the adapter works".
//
// Exported as a function so that a deployment can run it against its own
// implementation with one file:
//
//   import { conformance } from './conformance.mjs';
//   await conformance(() => myStore(), 'my store');
// ---------------------------------------------------------------------------

export async function conformance(make, label, t) {
  t.section(`${label}: courses, people and enrolment`);
  {
    const store = await make();
    const courses = await store.courses();
    t.check('courses come back', Array.isArray(courses), true);

    const one = courses[0];
    t.check('…and one by id', (await store.course(one.id)).id, one.id);
    t.check('…and a missing one is null, not a throw', await store.course('nope'), null);

    const person = (await store.people())[0];
    t.check('people come back', !!person.name, true);
    const renamed = await store.savePerson({ ...person, name: 'Renamed' });
    t.check('…and can be saved', renamed.name, 'Renamed');
    t.check('…and stay saved', (await store.person(person.id)).name, 'Renamed');
  }

  t.section(`${label}: lectures and artefacts`);
  {
    const store = await make();
    const course = (await store.courses())[0];
    const lectures = await store.lectures(course.id);
    t.check('lectures come back in order',
      lectures.map((l) => l.sequence), [...lectures.map((l) => l.sequence)].sort((a, b) => a - b));

    const artefacts = await store.artefactsForCourse(course.id);
    t.check('artefacts for a course', artefacts.length > 0, true);
    const one = artefacts[0];
    t.check('…and for one lecture',
      (await store.artefacts(one.lectureId)).every((a) => a.lectureId === one.lectureId), true);

    const edited = { ...one, body: 'Changed.' };
    await store.saveArtefact(edited);
    t.check('an artefact saves', (await store.artefact(one.id)).body, 'Changed.');

    // A STORE MUST NOT HAND OUT ITS OWN OBJECTS. A caller mutating what it got
    // back would change the database without saving, which is the kind of bug
    // that only appears under load.
    const fetched = await store.artefact(one.id);
    fetched.body = 'Mutated in the caller.';
    t.check('…and the store is not changed by mutating a result',
      (await store.artefact(one.id)).body, 'Changed.');

    await store.addVersion({
      id: 'v-test', artefactId: one.id, version: 99, body: 'A version.',
      authoredBy: 'test', origin: 'ai', createdAt: new Date().toISOString(),
    });
    t.check('versions come back for the artefact',
      (await store.versions(one.id)).some((v) => v.version === 99), true);
  }

  t.section(`${label}: study, work and everything counted`);
  {
    const store = await make();
    const course = (await store.courses())[0];
    const lecture = (await store.lectures(course.id))[0];

    await store.recordProgress({
      id: 'p-test', personId: 'person-student', courseId: course.id,
      lectureId: lecture.id, event: 'read', at: new Date().toISOString(),
    });
    t.check('progress is recorded', (await store.progress(course.id)).length, 1);
    t.check('…and filtered by person',
      (await store.progress(course.id, 'somebody-else')).length, 0);

    await store.saveReading({
      id: 'r-test', courseId: course.id, kind: 'chapter', citation: 'A citation.',
      required: true, addedBy: 'person-lecturer', addedAt: '', published: true,
    });
    t.check('a reading is kept', (await store.readings(course.id))[0].citation, 'A citation.');

    await store.saveAssignment({
      id: 'a-test', courseId: course.id, title: 'A title', brief: 'A brief',
      createdBy: 'person-lecturer', createdAt: '', published: true,
    });
    t.check('an assignment is kept', (await store.assignment('a-test')).title, 'A title');

    await store.saveSubmission({
      id: 's-test', assignmentId: 'a-test', courseId: course.id,
      studentId: 'person-student', body: 'Work.', submittedAt: '', late: false,
    });
    t.check('a submission is kept', (await store.submissionById('s-test')).body, 'Work.');
    t.check('…and found by assignment', (await store.submissions('a-test')).length, 1);
    t.check('…and by student', (await store.submissions('a-test', 'nobody')).length, 0);

    await store.recordCost({
      id: 'c-test', courseId: course.id, lectureId: lecture.id, stage: 'corrected_text',
      producedBy: 'test', charactersIn: 10, charactersOut: 20, at: '',
    });
    t.check('a cost is recorded', (await store.costs(course.id)).length, 1);

    await store.notify({
      id: 'n-test', personId: 'person-lecturer', kind: 'processing-finished',
      title: 'Done', at: new Date().toISOString(),
    });
    t.check('a notification is delivered', (await store.notifications('person-lecturer')).length, 1);
    await store.markNotificationsRead('person-lecturer');
    t.check('…and can be marked read',
      !!(await store.notifications('person-lecturer'))[0].readAt, true);
  }

  t.section(`${label}: nothing leaks between people`);
  {
    const store = await make();
    const course = (await store.courses())[0];
    await store.saveAttempt({
      id: 'at-1', studyAidId: 'aid-1', courseId: course.id, lectureIds: [],
      personId: 'person-student', given: {}, score: 1, outOf: 2, takenAt: '',
    });
    t.check('an attempt is found for its own student',
      (await store.attempts('aid-1', 'person-student')).length, 1);
    t.check('…and not for somebody else',
      (await store.attempts('aid-1', 'person-other')).length, 0);

    const recall = {
      id: 'rc-1', personId: 'person-student', courseId: course.id, studyAidId: 'aid-1',
      card: 'thylakoid', rung: 1, seen: 1, wrong: 0,
      lastAt: '2026-01-01T09:00:00.000Z', dueAt: '2026-01-04T09:00:00.000Z',
    };
    await store.saveRecall(recall);
    t.check('a schedule is kept for its own student',
      (await store.recalls('person-student', 'aid-1')).length, 1);
    t.check('…and is invisible to anybody else',
      (await store.recalls('person-other')).length, 0);

    // ANSWERING AGAIN REWRITES THE ROW. If this appended instead, the schedule
    // would become a log of somebody's evening, which is the one thing
    // study/repetition.ts sets out not to keep.
    await store.saveRecall({ ...recall, rung: 2, seen: 2, dueAt: '2026-01-11T09:00:00.000Z' });
    const after = await store.recalls('person-student', 'aid-1');
    t.check('and the card has one row, not two', after.length, 1);
    t.check('…which is the new schedule', after[0].rung, 2);
  }

  t.section(`${label}: the record only grows`);
  {
    const store = await make();
    const course = (await store.courses())[0];
    const entry = (id, act) => ({
      id, at: '2026-03-04T09:00:00.000Z', act,
      actorId: 'person-lecturer', actorName: 'Dr Amara Okonjo', actorRole: 'lecturer',
      subject: 'structured notes', courseId: course.id,
    });

    await store.appendAudit(entry('e1', 'artefact.published'));
    await store.appendAudit(entry('e2', 'artefact.withdrawn'));

    const all = await store.auditEntries();
    t.check('both are kept', all.length, 2);
    // SAME MILLISECOND, RIGHT ORDER. Two acts a second apart is the easy
    // case; two in the same tick is the one that misreports a withdrawal as
    // having come before the publication it undid.
    t.check('…newest first even at the same instant', all[0].id, 'e2');
    t.check('and a course narrows it',
      (await store.auditEntries(course.id)).length, 2);
    t.check('…to that course only',
      (await store.auditEntries('course-that-is-not-real')).length, 0);
  }
}
