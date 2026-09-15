// ---------------------------------------------------------------------------
// THE QUEUE, AND WHERE IT STOPS.
//
// On a taught course the plan runs AS FAR AS THE GATE and no further: queueing
// the notes, the knowledge extraction and the audio behind an uncorrected
// transcript would spend a university's money producing material built on a
// draft nobody has read.
//
// In a personal library there is no cohort, so it runs end to end.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const P = await load('jobs/plan.ts');
const Q = await load('jobs/queue.ts');
const t = suite('Background processing');

t.section('What is queued when a lecture is uploaded');
t.check('a course lecture stops at the correction',
  P.planFor({ have: ['recording'], context: 'course', from: 'recording' }),
  ['transcript', 'corrected_text']);
t.check('…and a pasted transcript goes straight to it',
  P.planFor({ have: ['transcript'], context: 'course', from: 'transcript' }),
  ['corrected_text']);
t.check('a personal lecture runs the whole chain',
  P.planFor({ have: ['recording'], context: 'personal', from: 'recording' }),
  ['transcript', 'corrected_text', 'knowledge_extract', 'structured_notes',
    'teaching_script', 'audio_15min', 'revision_materials']);

t.section('And what the approval releases');
t.check('approving the corrected text releases everything built on it',
  P.planAfterApproval('corrected_text', []),
  ['knowledge_extract', 'structured_notes', 'teaching_script', 'audio_15min', 'revision_materials']);
t.check('…and does not re-make what already exists',
  P.planAfterApproval('corrected_text', ['knowledge_extract', 'structured_notes'])
    .includes('structured_notes'), false);

t.section('The queue runs a lecture in order, one stage at a time');
const queue = Q.createMemoryQueue();
const base = { lectureId: 'l1', courseId: 'c1', actorId: 'p1', actorRole: 'lecturer' };
await queue.add([
  { ...base, kind: 'transcript', position: 0 },
  { ...base, kind: 'corrected_text', position: 1 },
]);
const first = await queue.claim();
t.check('the first stage is claimed first', first.kind, 'transcript');
t.check('…and the second waits while it runs', await queue.claim(), null);
await queue.finish(first.id, {});
t.check('…then goes', (await queue.claim()).kind, 'corrected_text');

t.section('A failure is retried, then stops, and takes its dependents with it');
const q2 = Q.createMemoryQueue();
await q2.add([
  { ...base, kind: 'transcript', position: 0 },
  { ...base, kind: 'corrected_text', position: 1 },
]);
for (let i = 0; i < 3; i++) {
  const job = await q2.claim();
  await q2.finish(job.id, { error: 'the transcription service is down' });
}
const jobs = await q2.forLecture('l1');
t.check('it failed after three attempts', jobs[0].state, 'failed');
t.check('…keeping the reason', jobs[0].error, 'the transcription service is down');
t.check('…and the stage that depended on it never runs', jobs[1].state, 'failed');
t.check('…with a reason of its own', jobs[1].error, 'transcript did not finish.');
t.check('nothing is left pending', await q2.pending(), 0);

t.done();
