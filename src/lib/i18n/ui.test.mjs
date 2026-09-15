// ---------------------------------------------------------------------------
// THE INTERFACE IN THE STUDENT'S LANGUAGE — AND HONEST ABOUT HOW FAR IT GOT.
//
// The content has been translated for a while; every button was still English,
// which is a strange experience: French notes under a navigation bar reading
// "Lectures · Courses · Settings".
//
// Two things are checked here. Every language covers every key, so nothing
// falls back silently. And nothing ever renders a key: "nav.courses" on a
// screen is worse than a word in the wrong language.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const U = await load('i18n/ui.ts');
const L = await load('i18n/languages.ts');
const t = suite('The interface, translated');

t.section('Every language this platform offers has a bundle');
for (const language of L.LANGUAGES) {
  t.check(`${language.name} is covered`, U.UI_LANGUAGES.includes(language.code), true);
}

t.section('And every bundle covers every string');
for (const code of U.UI_LANGUAGES) {
  t.check(`${code}: nothing falls back to English`, U.missing(code), []);
}

t.section('A missing string renders in English, never as a key');
t.check('an unknown language falls back', U.translate('xx', 'nav.courses'), 'Courses');
t.check('…and a known one does not', U.translate('fr', 'nav.courses'), 'Cours');
t.check('nothing looks like a key',
  U.UI_LANGUAGES.every((code) => !U.translate(code, 'nav.dashboard').includes('.')), true);

t.section('And the platform says which languages a person has checked');
t.check('English is reviewed', U.coverage('en').reviewed, true);
// NOT REVIEWED BY NATIVE SPEAKERS, and recorded as such. Nobody is examined on
// the word for "Settings" — but an institution should see what it is getting.
t.check('the rest are not, and say so', U.coverage('ar').reviewed, false);
t.check('coverage is a number, not a feeling',
  U.coverage('sw').done, U.coverage('sw').total);

t.done();
