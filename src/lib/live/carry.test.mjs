// ---------------------------------------------------------------------------
// LIVE IS WHERE THE RULES ARE EASIEST TO LOSE.
//
// In a recording, a substituted term is caught by the lecturer at review.
// Live, nobody is reading it. So the checks that matter here are the ones that
// watch the platform REFUSE to play something:
//
//   a translation that changed Yahuah does not go out;
//   a translation that arrives after the lecturer moved on does not go out;
//   and neither failure is silent — the student is told, in words.
//
// And one that watches it NOT refuse: a voice service that fails leaves the
// student the words, because reading the line beats being given nothing.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const C = await load('live/carry.ts');
const E = await load('live/engine.ts');
const t = suite('Carrying a lecture as it is given');

const segment = (over = {}) => ({
  id: 's1', sessionId: 'live-1', sequence: 1,
  heard: 'Yahuah is the name the lecturer uses, and Yahusha HaMashiach is how he says the other.',
  spokenAt: '2026-03-04T09:00:00.000Z', seconds: 6, ...over,
});

const options = { language: 'fr', floorLanguage: 'en' };

t.section('The ordinary case');

const plain = await C.carrySegment(E.rehearsalEngine(), segment(), options);
t.check('it is ready', plain.state, 'ready');
t.check('…with the terms still in it', plain.text.includes('Yahuah'), true);
t.check('…and the longer one whole', plain.text.includes('Yahusha HaMashiach'), true);
t.check('…and it was timed, not estimated', typeof plain.timing.msTotal, 'number');

t.section('A translation that changed a term does not go out');

// The engine substitutes, exactly as a pretrained habit would.
const substituting = E.rehearsalEngine({
  translate: (text) => text.replace(/⟦T1⟧/g, 'Jehovah'),
});
const refused = await C.carrySegment(substituting, segment(), options);
t.check('it is refused', refused.state, 'refused');
t.check('…and says which term was replaced', refused.refusal.includes('Jehovah'), true);
t.check('…and no text is carried forward', refused.text, undefined);

// AND A LOST TERM IS ALSO A REFUSAL. A marker that never came back means the
// term is simply gone from what the student would hear.
const dropping = E.rehearsalEngine({ translate: (text) => text.replace(/⟦T\d+⟧/g, '') });
const lost = await C.carrySegment(dropping, segment(), options);
t.check('a term that vanished is refused too', lost.state, 'refused');

t.section('A translation that arrives too late is not played');

let clock = 0;
const slow = E.rehearsalEngine();
const late = await C.carrySegment(slow, segment({ seconds: 1 }), {
  ...options,
  // Deadline of a second; the clock jumps four between calls.
  deadlineMs: 1000,
  now: () => { clock += 4000; return clock; },
});
t.check('it is marked late', late.state, 'late');
t.check('…and the words are kept, so the room can still show them',
  typeof late.text, 'string');

t.section('A voice that fails still leaves the student the words');

const mute = {
  ...E.rehearsalEngine(),
  speaker: { id: 'broken', async speak() { throw new Error('the speech service did not answer'); } },
};
const silentButRead = await C.carrySegment(mute, segment(), options);
t.check('it is still ready', silentButRead.state, 'ready');
t.check('…with text', silentButRead.text.includes('Yahuah'), true);
t.check('…and no audio', silentButRead.mediaPath, undefined);

t.section('The floor language is not a translation');

const floor = await C.carrySegment(E.rehearsalEngine(), segment(), { language: 'en', floorLanguage: 'en' });
t.check('it is passed through untouched', floor.text, segment().heard);
t.check('…and nothing was spent carrying it', floor.timing.msTotal, 0);

t.section('What the listener is actually given');

const heardRefused = C.hear(
  { sequence: 3, language: 'fr', state: 'refused', refusal: 'x' },
  { fallback: 'floor', floor: { text: 'the original English', mediaPath: 'floor/3.mp3' } },
);
t.check('with the floor policy they hear the lecturer', heardRefused.source, 'floor');
t.check('…and are told why', heardRefused.because.includes('withheld'), true);

const heardSilent = C.hear(
  { sequence: 3, language: 'fr', state: 'refused' },
  { fallback: 'silence', floor: { text: 'the original English' } },
);
t.check('with silence they get silence', heardSilent.source, 'silence');
// EVEN SILENCE IS EXPLAINED. A gap nobody accounts for reads as a broken
// platform, and a student who thinks it is broken stops using it.
t.check('…and are still told why', heardSilent.because.includes('withheld'), true);

const heardLate = C.hear(
  { sequence: 4, language: 'fr', state: 'late' },
  { fallback: 'notice', floor: { text: 'x' } },
);
t.check('a late passage says it was late', heardLate.because.includes('too late'), true);

t.section('Delivery is in order or not at all');

const carried = [
  { sequence: 1, state: 'ready' },
  { sequence: 2, state: 'refused' },
  { sequence: 3, state: 'carrying' },
  { sequence: 4, state: 'ready' },
];
t.check('the run stops at the segment still being carried',
  C.playable(carried, 1).map((c) => c.sequence), [1, 2]);
// A REFUSAL IS NOT A HOLE. It has an answer, so the run continues through it;
// only a segment that has not come back yet blocks the room.
t.check('…and a refusal does not block the run',
  C.playable(carried, 2).map((c) => c.sequence), [2]);
t.check('once it lands, the rest follows',
  C.playable(carried.map((c) => (c.sequence === 3 ? { ...c, state: 'ready' } : c)), 1)
    .map((c) => c.sequence), [1, 2, 3, 4]);

t.section('And with nothing configured, it refuses by name');

await t.refuses('no live service means no live translation', () =>
  C.carrySegment(E.noLiveEngine(), segment(), options).then((r) => {
    if (r.state === 'failed') throw new Error(r.refusal);
    return r;
  }));

t.done();
