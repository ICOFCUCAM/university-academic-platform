// ---------------------------------------------------------------------------
// THE LECTURER'S TERMINOLOGY IS AUTHORITATIVE.
//
// A substitution is the most damaging thing a transformation can do, because
// it is invisible to the person it damages: a student reading "Jesus Christ"
// where their lecturer said "Yahusha HaMashiach" has no way of knowing the
// words in front of them are not the words that were taught — and they will
// reproduce the substitution in an examination sat by the person whose term
// was replaced.
//
// SO IT IS CHECKED BY COUNTING, NOT BY ASKING. Every check below runs without a
// model, without a network and without judgement. A rule a model is merely
// asked to follow is a rule nobody has watched refuse anything.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const T = await load('ai/terminology.ts');
const t = suite('Lecturer terminology preservation');

const lecture = 'We come to Yahuah, and the covenant Yahuah made. Yahusha HaMashiach is the subject of the second half.';

t.section('A substitution is found');
const swapped = T.checkTerminology(lecture,
  'We come to Jehovah, and the covenant Jehovah made. Jesus Christ is the subject of the second half.');
t.check('two of the lecturer’s terms are reported',
  [...new Set(swapped.map((f) => f.term))].sort(), ['Yahuah', 'Yahusha HaMashiach']);
t.check('…the substitute is named',
  swapped.find((f) => f.term === 'Yahuah' && f.kind === 'substituted').instead, 'Jehovah');
t.check('…and so is the one for the second term',
  swapped.find((f) => f.term === 'Yahusha HaMashiach' && f.kind === 'substituted').instead, 'Jesus Christ');
t.check('…and the finding says what the lecturer actually said',
  swapped[0].note.includes('The lecturer said “Yahuah”'), true);

t.section('Every named substitute is caught, one at a time');
for (const [term, substitute] of [
  ['Yahuah', 'Jehovah'], ['Yahuah', 'Yahweh'],
  ['Yahusha HaMashiach', 'Jesus Christ'], ['Yahusha', 'Jesus'],
]) {
  const source = `The lecture turns on ${term} throughout.`;
  const found = T.checkTerminology(source, `The lecture turns on ${substitute} throughout.`);
  t.check(`“${term}” → “${substitute}” is reported`,
    found.some((f) => f.term === term && f.instead === substitute), true);
}

// AND THE NESTED PAIR IS ONE FINDING, NOT TWO. "Yahusha" occurs inside every
// "Yahusha HaMashiach"; reporting both would tell a lecturer that two terms
// were substituted where one was, and a panel that cries twice is ignored.
const nested = T.checkTerminology(
  'Yahusha HaMashiach is the subject.', 'Jesus Christ is the subject.');
t.check('one substitution, named against the longer term',
  nested.filter((f) => f.kind === 'substituted').map((f) => `${f.term} → ${f.instead}`),
  ['Yahusha HaMashiach → Jesus Christ']);

t.section('And a faithful transformation is clean');
t.check('the grammar fixed, the terms kept',
  T.checkTerminology(lecture,
    'We come to Yahuah, and to the covenant that Yahuah made. Yahusha HaMashiach is the subject of the second half.'),
  []);

t.section('A term quietly dropped is not a clean run either');
const dropped = T.checkTerminology(lecture, 'We come to Yahuah, and the covenant made. The second half follows.');
t.check('the loss is reported', dropped.some((f) => f.kind === 'dropped'), true);
t.check('…with both counts', dropped.find((f) => f.kind === 'dropped').inSource, 2);

t.section('The course’s own glossary, whatever the discipline');
const bio = 'The thylakoid sits inside the granum, and the granum inside the stroma.';
t.check('a respelling is told apart from a loss',
  T.checkTerminology(bio, 'The Thylakoid sits inside the Granum, and the Granum inside the Stroma.',
    { glossary: ['thylakoid', 'granum'] }).map((f) => f.kind),
  ['respelled', 'respelled']);
t.check('…and a term simply gone is a loss',
  T.checkTerminology(bio, 'The sac sits inside the stack, and the stack inside the fluid.',
    { glossary: ['thylakoid', 'granum'] }).every((f) => f.kind === 'dropped'), true);
t.check('an untouched glossary passes',
  T.checkTerminology(bio, 'The thylakoid sits inside the granum. The granum sits inside the stroma.',
    { glossary: ['thylakoid', 'granum', 'stroma'] }), []);

t.section('Word boundaries, so the check is not superstitious');
t.check('“Lord” inside “Landlord” is not a substitution',
  T.checkTerminology('Yahuah is named here.', 'Yahuah is named here. The landlord is not.').length, 0);
t.check('…and a substitute the LECTURE itself used is not one either',
  T.checkTerminology('Yahuah, whom others call Jehovah.', 'Yahuah, whom others call Jehovah.'), []);

t.section('The rule is stated to the model as well as checked afterwards');
t.check('the rule names the examples',
  T.TERMINOLOGY_RULE.includes('Yahusha HaMashiach  → Yahusha HaMashiach'), true);
t.check('…and says what to do when unsure',
  T.TERMINOLOGY_RULE.includes('preserve the original terminology rather than substituting'), true);
t.check('a course glossary is rendered into the instruction',
  T.terminologyBlock(['Yahuah', 'Yahusha']).includes('• Yahuah'), true);

t.done();
