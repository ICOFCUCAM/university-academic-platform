// ---------------------------------------------------------------------------
// SETTINGS THAT ARE NOT A PLACE TO PUT ARBITRARY STRINGS.
//
// These land in an attribute on <body> which a stylesheet reads, so what is
// stored has to be one of the values the screen offers — and the defence is
// here, not in the screen that happens to be posting.
//
// And the one rule that separates these from the working language: nobody
// sets somebody else's, and nobody reads them at all.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const A = await load('access/accessibility.ts');
const t = suite('Reading this platform when the default does not work');

t.section('What is stored');

t.check('nothing stored is the standard everything', A.settingsOf(undefined), A.DEFAULT_ACCESSIBILITY);
t.check('a value nobody offered falls back to the default',
  A.settingsOf({ contrast: 'neon' }).contrast, 'standard');
t.check('…and does not take the rest with it',
  A.settingsOf({ contrast: 'neon', textSize: 'larger' }).textSize, 'larger');
t.check('a key nobody defined is simply not there',
  Object.keys(A.settingsOf({ nonsense: true })).includes('nonsense'), false);

t.section('What the page is told');

t.check('the standard profile still names every attribute it sets',
  Object.keys(A.bodyAttributes(A.DEFAULT_ACCESSIBILITY)).sort(),
  ['data-contrast', 'data-text', 'data-typeface']);

// FOLLOW MY SYSTEM MEANS LEAVE IT ALONE. Writing data-motion="system" would
// beat the media query with a value that means "I have no opinion".
t.check('“follow my system” sets no motion attribute at all',
  'data-motion' in A.bodyAttributes(A.settingsOf({ motion: 'system' })), false);
t.check('choosing reduced does set one',
  A.bodyAttributes(A.settingsOf({ motion: 'reduced' }))['data-motion'], 'reduced');
t.check('and so does choosing full, so it can overrule the system',
  A.bodyAttributes(A.settingsOf({ motion: 'full' }))['data-motion'], 'full');

t.check('underlined links are announced to the stylesheet',
  A.bodyAttributes(A.settingsOf({ underlineLinks: true }))['data-links'], 'underlined');

// CAPTIONS ARE NOT A CSS MATTER. They change what a component renders, not
// how the page is painted, so they have no attribute.
t.check('captions are not one of the body’s attributes',
  JSON.stringify(A.bodyAttributes(A.settingsOf({ captions: true }))).includes('caption'), false);

t.section('Whether anything is chosen at all');

t.check('a fresh account has chosen nothing', A.anythingChosen(A.DEFAULT_ACCESSIBILITY), false);
t.check('one choice is something', A.anythingChosen(A.settingsOf({ textSize: 'large' })), true);

t.done();
