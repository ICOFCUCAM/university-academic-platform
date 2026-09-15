// ---------------------------------------------------------------------------
// ONE ACCOUNT CANNOT SPEND A DEPARTMENT'S BUDGET IN AN EVENING.
// ---------------------------------------------------------------------------

import { load, suite } from './testkit.mjs';

const L = await load('limits.ts');
const t = suite('Limits');

const limiter = L.createLimiter({ ask: { allowance: 3, windowMinutes: 60 } });
const at = (minutes) => new Date(Date.UTC(2026, 8, 15, 10, minutes));

t.section('Inside the allowance');
t.check('the first is allowed', limiter.take('p1', 'ask', at(0)).allowed, true);
t.check('…and says what is left', limiter.take('p1', 'ask', at(1)).remaining, 1);
t.check('the third is the last', limiter.take('p1', 'ask', at(2)).remaining, 0);

t.section('And past it');
const refused = limiter.take('p1', 'ask', at(3));
t.check('the fourth is refused', refused.allowed, false);
// NOT A 429. A student is told how many they have had and when the next one is.
t.check('…in a sentence they can act on', refused.reason.includes('which is the limit'), true);
t.check('…with the time the next one arrives', refused.reason.includes('11:00'), true);

t.section('The window moves');
t.check('an hour later they are allowed again', limiter.take('p1', 'ask', at(61)).allowed, true);

t.section('And it is per person');
t.check('somebody else is unaffected', limiter.take('p2', 'ask', at(3)).allowed, true);

t.done();
