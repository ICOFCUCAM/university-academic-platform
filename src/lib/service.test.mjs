// ---------------------------------------------------------------------------
// THE WHOLE WORKFLOW, END TO END, WITH NOTHING MOCKED EXCEPT THE VENDOR.
//
//   Lecture → AI → LECTURER REVIEW → Student
//
// and the versioning underneath it:
//
//   Recording → Transcript v1 → AI processing v1 → lecturer corrections
//             → Published v2, and everything built on it marked stale.
//
// Runs against the offline engine, so it is deterministic, free, and passes on
// a machine with no keys and no network.
// ---------------------------------------------------------------------------

import { load, suite } from './testkit.mjs';

const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const { offlineEngine } = await load('ai/offline.ts');
const S = await load('service.ts');

const t = suite('Lecture → AI → Lecturer review → Student');

const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const e = offlineEngine();

const lecturer = { id: 'person-lecturer', role: 'lecturer' };
const student = { id: 'person-student', role: 'student' };
const registry = { id: 'person-registry', role: 'registry' };

t.section('The lecturer’s material goes through the engine');
{
  const store = fresh();
  // Lecture 04 has a transcript and nothing else.
  const corrected = await S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text');
  t.check('the corrected text is made', corrected.state, 'ready');
  t.check('…as version 1', corrected.version, 1);
  t.check('…owned by the lecturer, not the model', corrected.ownerId, 'person-lecturer');
  t.check('…and it says what made it',
    corrected.producedBy, 'offline processor (no language model configured)');
  t.check('…with the filler taken out of the speech', corrected.body.includes('erm'), false);

  // THE GATE. The notes are not built on a draft nobody has read.
  await t.refuses('the notes will not run on the unapproved text',
    () => S.runStage(store, e, lecturer, 'lecture-04', 'structured_notes'));

  await S.approve(store, lecturer, corrected.id);
  const notes = await S.runStage(store, e, lecturer, 'lecture-04', 'structured_notes');
  t.check('…and run once the lecturer has approved it', notes.state, 'ready');

  t.check('a version was recorded for each', (await store.versions(corrected.id)).length, 1);
}

t.section('Nobody but the lecturer runs the engine on their material');
{
  const store = fresh();
  await t.refuses('the registry cannot transform a lecture',
    () => S.runStage(store, e, registry, 'lecture-04', 'corrected_text'));
  await t.refuses('a student certainly cannot',
    () => S.runStage(store, e, student, 'lecture-04', 'corrected_text'));
}

t.section('Review, and only then the cohort');
{
  const store = fresh();
  const made = await S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text');
  await t.refuses('it cannot be published unapproved',
    () => S.publish(store, lecturer, made.id));

  const approved = await S.approve(store, lecturer, made.id);
  t.check('approval carries a name, not a flag', approved.approvedByName, 'Dr Amara Okonjo');

  const published = await S.publish(store, lecturer, approved.id);
  t.check('and then it is published', published.state, 'published');
  t.check('…still under that name', published.approvedByName, 'Dr Amara Okonjo');

  const withdrawn = await S.withdraw(store, lecturer, published.id);
  t.check('the lecturer can take it back', withdrawn.state, 'approved');
}

t.section('A correction becomes the authoritative version, and everything below knows');
{
  const store = fresh();
  // Lecture 06 is published end to end.
  const before = (await store.artefacts('lecture-06'));
  const text = before.find((a) => a.kind === 'corrected_text');
  const notes = before.find((a) => a.kind === 'structured_notes');
  t.check('the notes start current', notes.staleSince, undefined);

  const edited = await S.editArtefact(store, lecturer, text.id,
    text.body.replace('rubisco', 'RuBisCO'), 'Capitalisation of the enzyme');
  t.check('the text is at version 2', edited.version, 2);
  t.check('…and is now the lecturer’s, not the machine’s', edited.origin, 'lecturer');
  t.check('…marked as corrected by a person', edited.correctedByLecturer, true);
  t.check('…with both versions kept', (await store.versions(edited.id)).length, 1);

  const after = await store.artefacts('lecture-06');
  t.check('the notes are now stale',
    !!after.find((a) => a.kind === 'structured_notes').staleSince, true);
  t.check('…and so are the revision materials',
    !!after.find((a) => a.kind === 'revision_materials').staleSince, true);
  // AND THE PUBLISHED NOTES ARE STILL PUBLISHED. Staleness is a flag for the
  // lecturer, not a withdrawal the students experience as a disappearance.
  t.check('the cohort has not lost them meanwhile',
    after.find((a) => a.kind === 'structured_notes').state, 'published');
}

t.section('What the Course AI is allowed to read');
{
  const store = fresh();
  const passages = await S.coursePassages(store, 'course-biol101');
  t.check('every passage comes from a published artefact',
    passages.every((p) => p.text.length > 0), true);
  t.check('…and none from Lecture 04, which is still in draft',
    passages.some((p) => p.lectureSequence === 4), false);
  t.check('…and none from a transcript, which is working material',
    passages.some((p) => p.artefactKind === 'transcript'), false);
  t.check('Lecture 06 is in there', passages.some((p) => p.lectureSequence === 6), true);
}

t.section('And who may ask it');
{
  const store = fresh();
  const answer = await S.askCourseAI(store, e, student, 'course-biol101',
    'Explain quantum chromodynamics.');
  t.check('a question the course does not cover is refused',
    answer.refusedReason, 'not-in-course-material');
  t.check('…and the refusal points at what the course does cover',
    answer.body.includes('What the course does cover nearby'), true);

  const located = await S.askCourseAI(store, e, student, 'course-biol101',
    'Which lecture introduced photosynthesis?');
  t.check('“which lecture introduced this?” is answered from the knowledge base',
    located.body.includes('Lecture 06'), true);

  await t.refuses('a student not enrolled is refused',
    () => S.askCourseAI(store, e, { id: 'person-nobody', role: 'student' }, 'course-biol101', 'anything'));
}

t.section('The knowledge base, built from the lectures that have been extracted');
{
  const store = fresh();
  const kb = await S.knowledgeBase(store, 'course-biol101');
  t.check('two lectures have contributed', kb.lecturesIncluded.length, 2);
  t.check('…and the course knows where photosynthesis was introduced',
    kb.nodes.find((n) => n.id === 'photosynthesis').definedIn.lectureSequence, 6);
  t.check('…and that NADPH is used and never defined',
    kb.undefined.map((n) => n.term), ['NADPH']);
  t.check('…and that four of its six lectures have no extraction yet',
    kb.coverage.filter((c) => !c.extracted).length, 4);
}

t.section('The approved master is immutable in substance');
{
  const store = fresh();
  const made = await S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text');
  await S.approve(store, lecturer, made.id);
  await S.publish(store, lecturer, made.id);

  // A MODEL DOES NOT WRITE OVER AN APPROVAL. Not because the prompt forbids
  // it — because the act is refused unless a person asks a second time.
  await t.refuses('a regeneration of published material is refused',
    () => S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text'));

  const again = await S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text', { regenerate: true });
  t.check('asked for explicitly, it runs', again.state, 'ready');
  t.check('…and the approval did not survive it', again.approvedByName, undefined);
  t.check('…nor the publication', again.publishedAt, undefined);
  t.check('…and the old text is still in the history',
    (await store.versions(again.id)).length >= 2, true);
  t.check('…with the reason recorded',
    (await store.versions(again.id)).some((v) => v.note.includes('the approval was cleared by it')), true);
}

t.done();
