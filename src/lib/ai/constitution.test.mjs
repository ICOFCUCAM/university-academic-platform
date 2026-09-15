// ---------------------------------------------------------------------------
// THE CONSTITUTION, AND THE PROOF THAT EACH ARTICLE IS ENFORCED SOMEWHERE.
//
// A constitution whose articles live only in a prompt is a request. Each
// article here names the files that make it true, and this test opens them.
// The seventh is the one people forget, and it is the one a student notices.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load, suite } from '../testkit.mjs';

const C = await load('ai/constitution.ts');
const T = await load('ai/terminology.ts');
const t = suite('The AI Transformation Constitution');
const lib = new URL('..', import.meta.url).pathname;

t.section('Seven articles, in order of precedence');
t.check('there are seven', C.CONSTITUTION.map((a) => a.n), [1, 2, 3, 4, 5, 6, 7]);
t.check('and they are the ones the University set', C.CONSTITUTION.map((a) => a.title), [
  'Source preservation', 'Meaning preservation', 'Terminology preservation',
  'No unrequested knowledge injection', 'No silent normalisation',
  'Traceability', 'Explicit separation',
]);

t.section('Every article names a file, and the file exists');
for (const article of C.CONSTITUTION) {
  t.check(`${article.n}. ${article.title} is enforced somewhere`, article.enforcedBy.length > 0, true);
  for (const file of article.enforcedBy) {
    t.check(`   ${file}`, existsSync(join(lib, file)), true);
  }
}

t.section('And it reaches the model at the head of the contract');
const contract = await load('ai/contract.ts');
t.check('the constitution is in the contract',
  contract.TRANSFORMATION_CONTRACT.includes('THE AI TRANSFORMATION CONSTITUTION'), true);
t.check('…with terminology preservation named',
  contract.TRANSFORMATION_CONTRACT.includes('Yahusha HaMashiach remains Yahusha HaMashiach'), true);
t.check('…and the order of precedence stated',
  contract.TRANSFORMATION_CONTRACT.includes('the lower number'), true);

console.log('\nArticle 3 is not enforced by asking\n');

// ---------------------------------------------------------------------------
// LECTURE → TRANSCRIPTION → TERM PROTECTION → AI → TERM VALIDATION → PUBLISHED
//
// A model that tries to normalise the lecturer's terms never sees them, and if
// one somehow comes back altered the output is rejected rather than published.
// ---------------------------------------------------------------------------
const lecture = 'We come to Yahuah, and to the covenant Yahuah made. Yahusha HaMashiach is the subject of the second half.';

t.section('Protection: the model never has the term in front of it');
const guarded = T.protectTerms(lecture, {});
t.check('no protected term is left in the text sent to the model',
  /Yahuah|Yahusha/.test(guarded.text), false);
t.check('…and the longer term is protected whole, not in pieces',
  Object.values(guarded.markers).includes('Yahusha HaMashiach'), true);
t.check('…and the markers are not words any vocabulary contains',
  /⟦T\d+⟧/.test(guarded.text), true);

t.section('Restoration: the lecturer’s exact term comes back');
const tidied = guarded.text.replace('covenant', 'covenant that'); // an allowed edit
const restored = T.restoreTerms(tidied, guarded.markers);
t.check('every term returns', restored.text.includes('Yahusha HaMashiach'), true);
t.check('…with nothing missing', restored.missing, []);
t.check('…and the permitted edit survives', restored.text.includes('covenant that'), true);

t.section('Validation: an altered term is rejected, not reviewed');
// A model that ignored the markers and normalised anyway.
const normalised = 'We come to Jehovah, and to the covenant Jehovah made. Jesus Christ is the subject.';
const rejected = T.validateTerminology(lecture, normalised, {});
t.check('the output is not ok', rejected.ok, false);
t.check('…and the rejection says what happened',
  rejected.rejection.includes('replaced “Yahuah” with “Jehovah”'), true);
t.check('…and says it was not published',
  rejected.rejection.includes('rejected rather than published'), true);

// A model that dropped the marker entirely: the term never came back.
const lost = T.restoreTerms(guarded.text.split('⟦T2⟧').join('the Lord'), guarded.markers);
const lostValidation = T.validateTerminology(lecture, lost.text, { missingProtected: lost.missing });
t.check('a protected term that did not come back is also a rejection', lostValidation.ok, false);
t.check('…naming the term', lostValidation.rejection.includes('Yahuah'), true);

t.section('And a faithful transformation passes');
const faithful = T.validateTerminology(lecture, restored.text, {});
t.check('it is ok', faithful.ok, true);
t.check('…with nothing to report', faithful.findings, []);
t.check('…and no rejection', faithful.rejection, undefined);

t.done();
