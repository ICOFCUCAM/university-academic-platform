// ---------------------------------------------------------------------------
// WHAT THE SCHEDULE PROMISES.
//
// Three claims worth watching fail rather than reading:
//
//   a card got wrong goes back to the bottom, not down one step;
//   running the deck three times in an evening does not promote anything;
//   a deck with nothing due says so instead of inventing an evening's work.
//
// The third is the one a revision app usually gets wrong, because an empty
// screen looks like a bug and reshuffling looks like a feature.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const R = await load('study/repetition.ts');
const t = suite('Spaced repetition');

const recall = (over) => ({
  id: 'r1', personId: 'p', courseId: 'c', studyAidId: 'a',
  card: 'thylakoid', rung: 0, seen: 1, wrong: 0,
  lastAt: '2026-01-01T09:00:00.000Z', dueAt: '2026-01-02T09:00:00.000Z', ...over,
});

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

t.section('Climbing, and falling');

const first = R.schedule(undefined, { knew: true, at: '2026-01-01T09:00:00.000Z' });
t.check('a card answered for the first time starts on the first rung', first.rung, 1);
t.check('…and comes back in three days', days('2026-01-01T09:00:00.000Z', first.dueAt), 3);

const second = R.schedule(recall({ rung: 1, lastAt: '2026-01-01T09:00:00.000Z' }), { knew: true, at: '2026-01-04T09:00:00.000Z' });
t.check('right again climbs', second.rung, 2);
t.check('…to a week', days('2026-01-04T09:00:00.000Z', second.dueAt), 7);

const fell = R.schedule(recall({ rung: 4, seen: 9, lastAt: '2026-02-01T09:00:00.000Z' }), { knew: false, at: '2026-03-08T09:00:00.000Z' });
t.check('wrong drops to the bottom, not one rung', fell.rung, 0);
t.check('…and is asked again tomorrow', days('2026-03-08T09:00:00.000Z', fell.dueAt), 1);
t.check('…and the failure is counted', fell.wrong, 1);

t.section('Twice in an evening is once');

const evening = recall({ rung: 2, seen: 4, lastAt: '2026-01-10T19:00:00.000Z' });
const again = R.schedule(evening, { knew: true, at: '2026-01-10T21:30:00.000Z' });
t.check('a second correct answer the same day does not promote', again.rung, 2);
t.check('…though it is counted as seen', again.seen, 5);

const nextDay = R.schedule(evening, { knew: true, at: '2026-01-11T19:00:00.000Z' });
t.check('the next day does promote', nextDay.rung, 3);

const missed = R.schedule(evening, { knew: false, at: '2026-01-10T21:30:00.000Z' });
t.check('but getting it wrong the same day always counts', missed.rung, 0);

const corrected = R.schedule(
  recall({ rung: 0, wrong: 1, seen: 5, lastAt: '2026-01-10T21:30:00.000Z' }),
  { knew: true, at: '2026-01-10T21:35:00.000Z' },
);
t.check('and correcting it immediately climbs from the bottom', corrected.rung, 1);

t.section('The evening’s deck');

const cards = [
  { front: 'Thylakoid', back: 'A folded sac.' },
  { front: 'Stroma', back: 'The fluid around them.' },
  { front: 'Calvin cycle', back: 'The second stage.' },
];
const at = '2026-02-01T09:00:00.000Z';

const mixed = R.session(cards, [
  recall({ card: 'thylakoid', dueAt: '2026-01-20T09:00:00.000Z' }),
  recall({ card: 'stroma', dueAt: '2026-03-01T09:00:00.000Z' }),
], at);
t.check('the overdue card is due', mixed.due.map((c) => c.front), ['Thylakoid']);
t.check('the unseen card is fresh', mixed.fresh.map((c) => c.front), ['Calvin cycle']);
t.check('the held card is resting', mixed.resting, 1);
t.check('…and the deck knows when it returns', mixed.nextDueAt, '2026-03-01T09:00:00.000Z');

const overdue = R.session(cards, [
  recall({ card: 'thylakoid', dueAt: '2026-01-20T09:00:00.000Z' }),
  recall({ card: 'stroma', dueAt: '2026-01-05T09:00:00.000Z' }),
  recall({ card: 'calvin cycle', dueAt: '2026-01-31T09:00:00.000Z' }),
], at);
t.check('the longest overdue comes first', overdue.due.map((c) => c.front), ['Stroma', 'Thylakoid', 'Calvin cycle']);

const nothing = R.session(cards, cards.map((c, i) => recall({
  card: R.cardKey(c.front), dueAt: `2026-03-0${i + 1}T09:00:00.000Z`,
})), at);
t.check('nothing due is nothing due', nothing.due.length + nothing.fresh.length, 0);
t.check('…and the deck offers the date rather than a reshuffle', nothing.nextDueAt, '2026-03-01T09:00:00.000Z');

t.section('Which card is which');

t.check('whitespace and case are not the card',
  R.cardKey('  The   Calvin Cycle '), 'the calvin cycle');
const regenerated = R.session([{ front: 'the calvin CYCLE' }], [recall({ card: 'the calvin cycle', dueAt: '2026-03-01T09:00:00.000Z' })], at);
t.check('so a regenerated deck keeps its schedule', regenerated.resting, 1);

t.section('What the student is holding');

const held = R.holding(cards, [
  recall({ card: 'thylakoid', rung: 3 }),
  recall({ card: 'stroma', rung: 1 }),
]);
t.check('a card held for a week counts as held', held.held, 1);
t.check('one answered once is still being learned', held.learning, 1);
t.check('and one never seen is not counted against them', held.unseen, 1);

t.done();
