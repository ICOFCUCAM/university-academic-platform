// ---------------------------------------------------------------------------
// THE COURSE KNOWLEDGE BASE.
//
// After twelve weeks the university has an academic representation of the
// whole course. The three things it can say that no single lecture can:
//
//   WHERE AN IDEA WAS INTRODUCED — the question a general assistant cannot
//   answer at all.
//   WHERE THE COURSE CONTRADICTS ITSELF — surfaced, never reconciled. Choosing
//   between two of a lecturer's definitions would be authorship.
//   WHAT THE COURSE USES AND NEVER DEFINES — the gap a lecturer cannot see
//   from inside any one lecture.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const K = await load('knowledge/build.ts');
const t = suite('The course knowledge base');

const lectures = [
  { id: 'l2', sequence: 2, title: 'Membranes' },
  { id: 'l6', sequence: 6, title: 'Photosynthesis' },
  { id: 'l9', sequence: 9, title: 'Respiration' },
  { id: 'l11', sequence: 11, title: 'Revision' },
];

const extracts = [
  {
    lectureId: 'l2', lectureSequence: 2, lectureTitle: 'Membranes',
    nodes: [
      { term: 'Diffusion', kind: 'definition', definition: 'Movement of a substance from high concentration to low concentration, without energy.', quote: 'Diffusion is movement down a gradient.', relatedTo: ['Osmosis'] },
      { term: 'Osmosis', kind: 'definition', definition: 'The diffusion of water across a partially permeable membrane.', quote: 'Osmosis is the diffusion of water.', relatedTo: [] },
    ],
  },
  {
    lectureId: 'l6', lectureSequence: 6, lectureTitle: 'Photosynthesis',
    nodes: [
      { term: 'Photosynthesis', kind: 'definition', definition: 'The conversion of light energy into chemical energy the cell can spend.', quote: 'Photosynthesis is the conversion of light energy into chemical energy.', relatedTo: ['ATP'] },
      // USED AND NEVER DEFINED, on this course, anywhere.
      { term: 'NADPH', kind: 'concept', definition: null, quote: 'its products are ATP and NADPH', relatedTo: ['Photosynthesis'] },
      { term: 'ATP', kind: 'definition', definition: 'The molecule the cell uses to carry energy between reactions.', quote: 'ATP carries energy between reactions.', relatedTo: [] },
    ],
  },
  {
    lectureId: 'l9', lectureSequence: 9, lectureTitle: 'Respiration',
    nodes: [
      // THE SAME TERM, A DIFFERENT MEANING, NINE WEEKS APART.
      { term: 'ATP', kind: 'definition', definition: 'A nucleotide that stores energy in the bonds between its three phosphate groups.', quote: 'ATP is a nucleotide with three phosphates.', relatedTo: ['Photosynthesis'] },
      { term: 'Photosynthesis', kind: 'concept', definition: null, quote: 'as we saw with photosynthesis', relatedTo: [] },
    ],
  },
];

const kb = K.buildKnowledgeBase({ courseId: 'c1', lectures, extracts, now: '2026-09-01T00:00:00.000Z' });
const node = (id) => kb.nodes.find((n) => n.id === id);

t.section('Every lecture contributes, and the course is the sum');
t.check('three lectures are in it', kb.lecturesIncluded, ['l2', 'l6', 'l9']);
t.check('and it holds every distinct idea — five, not the seven that were said',
  kb.nodes.map((n) => n.term).sort(), ['ATP', 'Diffusion', 'NADPH', 'Osmosis', 'Photosynthesis']);
t.check('a term is one node however many lectures use it', node('atp').mentions.length, 2);

t.section('Which lecture introduced this concept?');
t.check('photosynthesis — Lecture 06', node('photosynthesis').definedIn.lectureSequence, 6);
t.check('…with the lecturer’s own sentence as evidence',
  node('photosynthesis').definedIn.quote,
  'Photosynthesis is the conversion of light energy into chemical energy.');
t.check('ATP — Lecture 06, where it was defined first', node('atp').definedIn.lectureSequence, 6);

t.section('Where the course disagrees with itself, it says so');
t.check('one disagreement found', kb.disagreements.length, 1);
t.check('…over ATP', kb.disagreements[0].term, 'ATP');
t.check('…with both readings kept', kb.disagreements[0].readings.length, 2);
t.check('…and both lectures named',
  kb.disagreements[0].readings.map((r) => r.where.lectureSequence), [6, 9]);
// NOT RESOLVED. The first definition stands as the course's, because that is
// where a student met it; choosing the better one is the lecturer's to do.
t.check('the platform does not choose between them',
  node('atp').definition, 'The molecule the cell uses to carry energy between reactions.');
t.check('two lectures agreeing is not a disagreement',
  kb.disagreements.some((d) => d.term === 'Photosynthesis'), false);

t.section('What the course uses and never defines');
t.check('one term', kb.undefined.map((n) => n.term), ['NADPH']);
t.check('…and a term defined later is not in that list',
  kb.undefined.some((n) => n.term === 'Photosynthesis'), false);

t.section('Coverage: the lectures that have contributed nothing');
t.check('every lecture on the course appears', kb.coverage.length, 4);
t.check('Lecture 11 has nothing in the knowledge base',
  kb.coverage.find((c) => c.lectureSequence === 11).extracted, false);
t.check('Lecture 06 defined two of its three ideas',
  kb.coverage.find((c) => c.lectureSequence === 6).definitions, 2);

t.section('An empty course renders rather than crashing');
const empty = K.emptyKnowledgeBase('c2', '2026-09-01T00:00:00.000Z');
t.check('no nodes', empty.nodes, []);
t.check('no disagreements', empty.disagreements, []);

t.done();
