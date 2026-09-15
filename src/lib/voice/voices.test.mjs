// ---------------------------------------------------------------------------
// TWO LAYERS, AND ONE RULE THAT IS NOT A PREFERENCE.
//
//   WORKING LANGUAGE — the student's academic environment. One, chosen once,
//   changed by the registry with a reason. Everything arrives in it.
//   VOICE — how that environment sounds. The student's own, changeable
//   whenever they like, and it changes nothing about what is said.
//
// AND: A LECTURER'S VOICE IS NEVER SYNTHESISED WITHOUT THEIR AUTHORISATION.
// Not as a default, not as an experiment, not because the university would
// like it. It is the one act in this platform that withdrawing a page cannot
// undo.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const V = await load('voice/voices.ts');
const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const S = await load('service.ts');

const t = suite('Language is an environment; voice is a preference');
const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const lecturer = { id: 'person-lecturer', role: 'lecturer' };
const student = { id: 'person-student', role: 'student' };
const registry = { id: 'person-registry', role: 'registry' };

t.section('No consent, no voice — and the option says so rather than vanishing');
{
  const offers = V.voicesFor({ lecturerName: 'Dr Amara Okonjo', use: 'translated-audio' });
  const lecturerVoice = offers.find((o) => o.voice.kind === 'lecturer');
  t.check('the lecturer’s voice is offered', !!lecturerVoice, true);
  t.check('…and is not available', lecturerVoice.available, false);
  t.check('…and says exactly why',
    lecturerVoice.unavailableBecause,
    'Not available — the lecturer has not enabled voice preservation.');
  t.check('…while the platform’s own voices are', offers.filter((o) => o.available).length, 4);
}

t.section('Consent is narrow by default, and read at listening time');
{
  const translatedOnly = { authorisedAt: '2026-09-01', scope: 'translated-audio' };
  t.check('it holds for translated audio',
    V.consentHolds(translatedOnly, 'translated-audio'), true);
  t.check('…and not for the original', V.consentHolds(translatedOnly, 'original-audio'), false);
  t.check('…and the screen says which',
    V.voicesFor({ lecturerName: 'X', use: 'original-audio', lecturerConsent: translatedOnly })
      .find((o) => o.voice.kind === 'lecturer').unavailableBecause,
    'The lecturer authorised their voice for translated audio only.');

  const broad = { authorisedAt: '2026-09-01', scope: 'all-audio' };
  t.check('a broader authorisation covers both',
    [V.consentHolds(broad, 'translated-audio'), V.consentHolds(broad, 'original-audio')], [true, true]);

  // WITHDRAWN IS WITHDRAWN, including for audio already made — which is why
  // consent is read here rather than stamped on the file at generation.
  const withdrawn = { ...broad, revokedAt: '2026-10-01' };
  t.check('a withdrawal ends it', V.consentHolds(withdrawn, 'translated-audio'), false);
  t.check('…and says so', V.voicesFor({ lecturerName: 'X', use: 'translated-audio', lecturerConsent: withdrawn })
    .find((o) => o.voice.kind === 'lecturer').unavailableBecause,
    'The lecturer has withdrawn permission for their voice to be used.');
}

t.section('And the lecturer is the only person who can give it');
{
  const store = fresh();
  await t.refuses('the registry cannot authorise a lecturer’s voice',
    () => S.authoriseOwnVoice(store, registry, { scope: 'all-audio' }));
  await t.refuses('nor can a student, for themselves or anybody',
    () => S.authoriseOwnVoice(store, student, { scope: 'all-audio' }));

  const authorised = await S.authoriseOwnVoice(store, lecturer, { scope: 'translated-audio' });
  t.check('the lecturer can', authorised.voiceConsent.scope, 'translated-audio');
  t.check('…with a date on it', !!authorised.voiceConsent.authorisedAt, true);

  const revoked = await S.revokeOwnVoice(store, lecturer);
  t.check('…and can withdraw it', !!revoked.voiceConsent.revokedAt, true);
  t.check('…while the record of having given it is kept',
    !!revoked.voiceConsent.authorisedAt, true);
}

t.section('A working language is changed by the registry, with a reason');
{
  const store = fresh();
  t.check('the student starts in French',
    (await store.person('person-student')).workingLanguage, 'fr');

  await t.refuses('a student cannot change their own',
    () => S.setWorkingLanguage(store, student, 'person-student', 'es', 'I feel like it'));
  await t.refuses('nor can their lecturer',
    () => S.setWorkingLanguage(store, lecturer, 'person-student', 'es', 'convenience'));
  await t.refuses('and the registry must say why',
    () => S.setWorkingLanguage(store, registry, 'person-student', 'es', '   '));

  const moved = await S.setWorkingLanguage(
    store, registry, 'person-student', 'es', 'Transferred to the Madrid campus');
  t.check('the registry can', moved.workingLanguage, 'es');
  t.check('…and it is recorded with who and why',
    moved.workingLanguageHistory.at(-1).reason, 'Transferred to the Madrid campus');
  t.check('…and where they came from', moved.workingLanguageHistory.at(-1).from, 'fr');
}

t.section('Voice and speed are the student’s own, and need no ceremony');
{
  const store = fresh();
  const set = await S.setListeningPreference(store, student, { voice: 'platform-warm-f', speed: 1.25 });
  t.check('the voice is remembered', set.voicePreference, 'platform-warm-f');
  t.check('…and the speed', set.audioSpeed, 1.25);
}

t.done();
