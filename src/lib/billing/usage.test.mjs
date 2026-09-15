// ---------------------------------------------------------------------------
// THE METER, AND THE REFUSAL THAT COMES BEFORE THE SPEND.
//
// A student uploading ninety minutes with forty left in the month is told
// while they can still do something about it — not after the transcript is
// half made and the money gone. The check was written weeks before it was
// called from anywhere, which is exactly the kind of gap this suite exists to
// close.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const U = await load('billing/usage.ts');
const P = await load('billing/plans.ts');
const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const S = await load('service.ts');

const t = suite('What it costs, and what is left');
const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const lecturer = { id: 'person-lecturer', role: 'lecturer' };

t.section('Minutes are counted per account, per month');
const month = U.period(new Date('2026-09-15'));
t.check('the period is the month', month, '2026-09');
const records = [
  { id: '1', personId: 'p1', period: '2026-09', minutes: 50, lectureId: 'l1', at: '' },
  { id: '2', personId: 'p1', period: '2026-09', minutes: 45, lectureId: 'l2', at: '' },
  { id: '3', personId: 'p1', period: '2026-08', minutes: 90, lectureId: 'l0', at: '' },
  { id: '4', personId: 'p2', period: '2026-09', minutes: 60, lectureId: 'l3', at: '' },
];
t.check('this month, this person', U.minutesUsedIn(records, 'p1', '2026-09'), 95);
t.check('…last month is last month', U.minutesUsedIn(records, 'p1', '2026-08'), 90);
t.check('…and somebody else is somebody else', U.minutesUsedIn(records, 'p2', '2026-09'), 60);

t.section('And the plan refuses before the work starts');
const free = P.PLAN_BY_ID.free;
t.check('inside the allowance, it runs',
  P.mayProcess(free, { minutesUsed: 0, periodStart: month }, 60).allowed, true);
t.check('…and says what is left', P.mayProcess(free, { minutesUsed: 0, periodStart: month }, 60).remaining, 60);
const over = P.mayProcess(free, { minutesUsed: 80, periodStart: month }, 90);
t.check('over the allowance, it does not', over.allowed, false);
t.check('…and says how much is left rather than "no"',
  over.reason.includes('40 are left this month'), true);
t.check('a single lecture longer than the plan allows is refused too',
  P.mayProcess(free, { minutesUsed: 0, periodStart: month }, 200).allowed, false);
t.check('an institutional licence is not metered by the minute',
  P.mayProcess(P.PLAN_BY_ID.institution, { minutesUsed: 99999, periodStart: month }, 300).allowed, true);

t.section('The meter is actually called — which it was not, for weeks');
{
  const store = fresh();
  await store.savePerson({ ...(await store.person('person-lecturer')), plan: 'free' });

  await S.addLecture(store, lecturer, 'course-biol101', { title: 'One', minutes: 90 });
  t.check('the first lecture is recorded against the account',
    U.minutesUsedIn(await store.usage('person-lecturer'), 'person-lecturer'), 90);

  await t.refuses('and the second is refused, before anything is processed',
    () => S.addLecture(store, lecturer, 'course-biol101', { title: 'Two', minutes: 90 }));

  t.check('…with a notification rather than only an error',
    (await store.notifications('person-lecturer')).some((n) => n.kind === 'allowance-spent'), true);
  t.check('…and nothing was charged for the refused one',
    U.minutesUsedIn(await store.usage('person-lecturer'), 'person-lecturer'), 90);
}

t.section('What a lecture cost, from the vendor’s own numbers');
const costs = [
  { id: '1', courseId: 'c1', lectureId: 'l1', stage: 'corrected_text', producedBy: 'claude', inputTokens: 4000, outputTokens: 3000, charactersIn: 16000, charactersOut: 12000, at: '' },
  { id: '2', courseId: 'c1', lectureId: 'l1', stage: 'knowledge_extract', producedBy: 'claude', inputTokens: 3000, outputTokens: 900, charactersIn: 12000, charactersOut: 3600, at: '' },
  { id: '3', courseId: 'c1', lectureId: 'l2', stage: 'corrected_text', producedBy: 'claude', inputTokens: 1000, outputTokens: 800, charactersIn: 4000, charactersOut: 3200, at: '' },
];
const one = U.costOfLecture(costs, 'l1');
t.check('two runs on that lecture', one.runs, 2);
t.check('…and the tokens added up', [one.inputTokens, one.outputTokens], [7000, 3900]);
t.check('…broken down by stage', one.byStage.map((s) => s.stage), ['corrected_text', 'knowledge_extract']);
t.check('…and it is not reported as unmetered', one.unmetered, false);
// AND WHERE NO VENDOR REPORTED TOKENS, the screen must say so rather than
// showing a confident zero.
t.check('an offline run is unmetered, not free',
  U.costOfLecture([{ ...costs[0], inputTokens: undefined, outputTokens: undefined }], 'l1').unmetered, true);

t.done();
