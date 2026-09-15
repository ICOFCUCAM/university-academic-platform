// ---------------------------------------------------------------------------
// THE BENCHMARK'S OWN CASES, CHECKED BEFORE ANYBODY SPENDS MONEY ON THEM.
//
// A case whose `mustContain` does not appear in its own source is a case that
// can never pass, and forty-nine of those would look exactly like a model that
// preserves nothing. This suite runs in milliseconds and catches it.
// ---------------------------------------------------------------------------

import { CASES, KINDS } from './cases.mjs';
import { suite } from '../src/lib/testkit.mjs';

const t = suite('The preservation benchmark’s cases');

t.section('Shape');
t.check('forty-nine cases', CASES.length, 49);
t.check('…across all eight families', KINDS.length, 8);
t.check('…with unique ids', new Set(CASES.map((c) => c.id)).size, CASES.length);
t.check('…and at least four of each family',
  KINDS.every((kind) => CASES.filter((c) => c.kind === kind).length >= 4), true);

t.section('A preservation case can actually pass, and can actually fail');
for (const testCase of CASES.filter((c) => (c.expects ?? 'preserve') === 'preserve')) {
  // WHAT MUST SURVIVE HAS TO BE THERE TO SURVIVE. A pattern that does not
  // match its own source is a case no model can pass, and a benchmark full of
  // them reads as a model that preserves nothing.
  t.check(`${testCase.id}: what must survive is in the source`,
    testCase.mustContain.filter((pattern) => !pattern.test(testCase.source)).map(String), []);
  // …and the interference must not already be there, or the case fails
  // whatever the model does.
  t.check(`${testCase.id}: the interference is not pre-baked`,
    testCase.mustNotContain.filter((pattern) => pattern.test(testCase.source)).map(String), []);
}

t.section('And a grammar case has a fault in it to fix');
for (const testCase of CASES.filter((c) => c.expects === 'fix')) {
  // THE OTHER HALF OF THE BENCHMARK. These are the cases where the model is
  // expected to CHANGE something, so the fault must be in the source and the
  // corrected form must not.
  t.check(`${testCase.id}: the fault is in the source`,
    testCase.mustNotContain.some((pattern) => pattern.test(testCase.source)), true);
}
t.check('the grammar family is the fixing one',
  [...new Set(CASES.filter((c) => c.expects === 'fix').map((c) => c.kind))], ['grammar']);

t.section('And says what it is for');
for (const testCase of CASES) {
  t.check(`${testCase.id}: has a reason`, typeof testCase.why === 'string' && testCase.why.length > 30, true);
  t.check(`${testCase.id}: names a real stage`,
    ['corrected_text', 'structured_notes', 'teaching_script', 'revision_materials'].includes(testCase.stage), true);
}

t.done();
