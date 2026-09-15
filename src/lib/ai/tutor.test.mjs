// ---------------------------------------------------------------------------
// THE COURSE AI, AND WHAT MAKES IT DIFFERENT FROM A CHAT WINDOW.
//
// The student's session, as the University described it:
//
//   "Explain photosynthesis based on our lectures."
//   "Which lecture introduced this concept?"          → Lecture 06, exactly
//   "Give me a simple explanation."
//   "Now the university-level explanation."
//   "Create a 10-question test."
//   "Create a 15-minute audio revision covering lectures 1–6."
//
// Every one of those is read here, from the words a student actually types.
// And the refusal is tested hardest: an assistant that answers a question the
// course does not cover is worse than no assistant, because the student cannot
// tell which answers came from their lectures.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const T = await load('ai/tutor.ts');
const t = suite('The Course AI');

t.section('It reads what the student asked for');
const intent = (q) => T.readIntent(q);
t.check('“Explain photosynthesis based on our lectures.”', intent('Explain photosynthesis based on our lectures.').kind, 'explain');
t.check('“Which lecture introduced this concept?”', intent('Which lecture introduced this concept?').kind, 'locate');
t.check('“Give me a simple explanation.”', intent('Give me a simple explanation.').register, 'plain');
t.check('“Now give me the university-level explanation.”', intent('Now give me the university-level explanation.').register, 'university');
t.check('“Create a 10-question test.”', intent('Create a 10-question test.'), { kind: 'test', questions: 10, lectures: null });
t.check('“Make me a 20 question quiz on lecture 6”',
  intent('Make me a 20 question quiz on lecture 6'), { kind: 'test', questions: 20, lectures: [6] });
t.check('“Create a 15-minute audio revision covering lectures 1–6.”',
  intent('Create a 15-minute audio revision covering lectures 1–6.'),
  { kind: 'audio', minutes: 15, lectures: [1, 2, 3, 4, 5, 6] });
t.check('“flashcards for lectures 2, 4, 9”',
  intent('flashcards for lectures 2, 4, 9'), { kind: 'flashcards', lectures: [2, 4, 9] });
t.check('a plain question carries no register', intent('What is the Calvin cycle?').register, null);

t.section('It reads a range the way a student writes one');
t.check('an en dash', T.lectureRange('lectures 1–6'), [1, 2, 3, 4, 5, 6]);
t.check('a hyphen', T.lectureRange('lectures 3-5'), [3, 4, 5]);
t.check('“to”', T.lectureRange('lectures 2 to 4'), [2, 3, 4]);
t.check('one lecture', T.lectureRange('lecture 6'), [6]);
t.check('none stated', T.lectureRange('everything so far'), null);
t.check('a backwards range is not a range', T.lectureRange('lectures 6-1'), null);

const passages = [
  { lectureId: 'l6', lectureSequence: 6, lectureTitle: 'Photosynthesis', artefactKind: 'structured_notes',
    text: 'Photosynthesis converts light energy into chemical energy. The light-dependent reaction occurs in the thylakoid membrane and produces ATP and NADPH.' },
  { lectureId: 'l6', lectureSequence: 6, lectureTitle: 'Photosynthesis', artefactKind: 'transcript',
    text: 'The Calvin cycle happens in the stroma and does not require light directly; it requires the ATP and NADPH from the first stage.' },
  { lectureId: 'l2', lectureSequence: 2, lectureTitle: 'Membranes', artefactKind: 'structured_notes',
    text: 'A membrane is a boundary that lets some things through. Osmosis is the diffusion of water across a partially permeable membrane.' },
];

t.section('It finds the passages that bear on the question');
t.check('photosynthesis reaches Lecture 06',
  T.retrieve(passages, 'Explain photosynthesis based on our lectures.').map((p) => p.lectureSequence)[0], 6);
t.check('osmosis reaches Lecture 02',
  T.retrieve(passages, 'what is osmosis').map((p) => p.lectureSequence)[0], 2);
t.check('…and the notes outrank the transcript on an equal match',
  T.retrieve(passages, 'ATP NADPH').map((p) => p.artefactKind)[0], 'structured_notes');

t.section('And says so when the course does not cover it');
t.check('a question off the course finds nothing',
  T.retrieve(passages, 'quantum chromodynamics'), []);
t.check('…which is what `covered` reports', T.covered([]), false);

t.section('“Which lecture introduced this concept?” — answered exactly, with no model');
const kb = {
  courseId: 'c1', builtAt: '', lecturesIncluded: [], threads: [], disagreements: [],
  undefined: [], openQuestions: [], coverage: [],
  nodes: [{
    id: 'photosynthesis', term: 'Photosynthesis', kind: 'definition',
    definition: 'The conversion of light energy into chemical energy.',
    definedIn: { lectureId: 'l6', lectureSequence: 6, lectureTitle: 'Photosynthesis', quote: 'Photosynthesis is the conversion of light energy.' },
    mentions: [
      { lectureId: 'l6', lectureSequence: 6, lectureTitle: 'Photosynthesis', quote: 'Photosynthesis is the conversion of light energy.' },
      { lectureId: 'l9', lectureSequence: 9, lectureTitle: 'Respiration', quote: 'as we saw with photosynthesis' },
    ],
    relatedTo: [],
  }],
};
const located = T.locate(kb, 'Which lecture introduced photosynthesis?');
t.check('it names Lecture 06', located.body.includes('Lecture 06 — Photosynthesis'), true);
t.check('…quotes the lecture', located.body.includes('Photosynthesis is the conversion of light energy.'), true);
t.check('…says where it comes back', located.body.includes('Lecture 09'), true);
t.check('…and did not consult a model', located.producedBy, 'course knowledge base');
t.check('a concept the course never taught is not located',
  T.locate(kb, 'Which lecture introduced mitosis?'), null);

t.section('The second boundary: general knowledge only when it is asked for');
// PRESERVE, DON'T INTERFERE — and its corollary for the tutor. A student who
// did not ask to leave their syllabus must never be answered from outside it.
for (const q of [
  'Can you explain X further using information outside this course?',
  'Explain that beyond our lectures',
  'Use your own knowledge to explain the Calvin cycle',
  'What does the wider literature say about this?',
]) t.check(`“${q}” opens the general door`, intent(q).kind, 'beyond');

for (const q of [
  'Explain photosynthesis based on our lectures.',
  'What did the lecturer say about the Calvin cycle?',
  'Tell me more about this',
  'Explain it in more detail',
  'Create a 10-question test.',
]) t.check(`“${q}” does NOT`, intent(q).kind === 'beyond', false);

t.done();
