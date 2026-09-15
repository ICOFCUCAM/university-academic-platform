// ---------------------------------------------------------------------------
// THE WORD CHECK, AND WHY IT IS BEFORE THE AUDIO AND NOT AFTER IT.
//
// A mis-transcribed word in a text is a typo: a reader sees it and understands
// what was meant. The same word spoken aloud is a confident voice saying
// something that was never taught, to somebody walking to campus who cannot
// see that anything is wrong — and it goes into their notes and then into an
// examination answer.
//
// The detection is mechanical on purpose. A model asked "which words look odd
// here?" would flag the lecturer's own terminology, which is the one thing
// this platform must never change.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const U = await load('ai/unusual.ts');
const t = suite('Nothing is spoken that nobody has read');

const script = `Today we look at photosynthesis. The light-dependent reaction happens in the
thylakoid membrane. Carbon dioxide is fixed by the enzyme rubisko, which is slow. The
mitochondron is not our subject today. We will return to the Calvin cycle on Thursday.`;

// The course's other lectures, which are the vocabulary of this subject.
const corpus = `Lecture 02 covered the cell membrane and the enzyme families.
An enzyme lowers the activation energy of a reaction. A selective membrane lets
some things through; a selective boundary is the precondition for a cell.`;

const flagged = U.findUnusual(script, {
  glossary: ['thylakoid', 'rubisco', 'Calvin cycle'],
  courseTerms: ['photosynthesis', 'light-dependent reaction'],
  corpus,
});
const word = (w) => flagged.find((f) => f.word.toLowerCase() === w);

t.section('A slip one letter from a term the course teaches');
t.check('“rubisko” is flagged', !!word('rubisko'), true);
t.check('…with the lecturer’s own spelling offered', word('rubisko').suggestion, 'rubisco');
t.check('…and named as what it is', word('rubisko').reason, 'near-a-course-term');
t.check('…and those come first in the list', flagged[0].word.toLowerCase(), 'rubisko');
t.check('…with the sentence it appears in',
  word('rubisko').contexts[0].includes('Carbon dioxide is fixed'), true);

t.section('And a word the system simply cannot place');
t.check('“mitochondron” is flagged', !!word('mitochondron'), true);

t.section('What is NOT flagged, because a pane that cries wolf is closed unread');
for (const safe of ['thylakoid', 'photosynthesis', 'calvin', 'today', 'happens', 'membrane', 'thursday']) {
  t.check(`“${safe}” is not queried`, !!word(safe), false);
}
t.check('the lecturer’s glossary vouches for its own terms',
  U.findUnusual('The rubisco enzyme and the thylakoid membrane.',
    { glossary: ['rubisco', 'thylakoid'], corpus }), []);
// AND SO DOES THE COURSE'S OWN PROSE. The best evidence that a word belongs to
// a subject is that the subject has used it before — no dictionary required,
// and no vendor.
// "selective" is in no word list here; the course having used it twice is the
// whole of the evidence, and it is enough.
t.check('a word the course has used before is not queried again',
  U.findUnusual('The membrane is selective.', { corpus }), []);
t.check('…while the same word with no course behind it is queried',
  U.findUnusual('The membrane is selective.', {}).map((f) => f.word), ['selective']);
// The lecturer's unfamiliar terminology is exactly what must NOT be rewritten,
// so when it is in their glossary it never reaches the pane at all.
t.check('an unusual term the lecturer declared is never queried',
  U.findUnusual('Yahusha HaMashiach is the subject of the second half.',
    { glossary: ['Yahusha HaMashiach'] }), []);
// And when they have not declared it, it is QUERIED, never changed — the pane
// asks; it does not decide.
const undeclared = U.findUnusual('Yahusha HaMashiach is the subject.', {});
t.check('…and when they have not, it is asked about', undeclared.map((f) => f.word),
  ['Yahusha', 'HaMashiach']);
// NEVER ALTERED, though: there is no suggestion to accept, because nothing in
// this course is one letter away from it. The pane asks; it does not decide.
t.check('…and never altered', undeclared.map((f) => f.suggestion), [undefined, undefined]);

t.section('Applying what the lecturer decided');
const applied = U.applyDecisions(script, [
  { word: 'rubisko', action: 'replaced', replacement: 'rubisco' },
  { word: 'mitochondron', action: 'accepted' },
]);
t.check('the replacement lands', applied.includes('enzyme rubisco'), true);
t.check('…everywhere it appeared', applied.includes('rubisko'), false);
t.check('…and an accepted word is untouched', applied.includes('mitochondron'), true);
t.check('nothing else moved',
  applied.replace('rubisco', 'rubisko') === script, true);

t.done();
