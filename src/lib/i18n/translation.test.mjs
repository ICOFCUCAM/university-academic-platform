// ---------------------------------------------------------------------------
// THE MULTILINGUAL LAYER.
//
//   … → LECTURER REVIEW → ✅ FINAL APPROVAL ─┬─► ORIGINAL LANGUAGE
//                                            └─► TRANSLATION ENGINE → fr es ar…
//
// THE GATE IS THE FEATURE. Translating a draft multiplies one mistake into six
// languages and then asks a lecturer who reads one of them to find it. So the
// first section below is a refusal, and the rest is what protects a student
// reading a language nobody at this university can check.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const V = await load('i18n/validate.ts');
const L = await load('i18n/languages.ts');
const TR = await load('i18n/translate.ts');
const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const { offlineEngine } = await load('ai/offline.ts');
const S = await load('service.ts');

// ---------------------------------------------------------------------------
// A STAND-IN TRANSLATOR, because the offline processor refuses to translate —
// correctly, since a mangled translation would be published to the one cohort
// nobody here can check. This one does what a well-behaved translator does:
// leaves the markers alone, keeps the shape, and keeps the figures.
// ---------------------------------------------------------------------------
const translator = (transform) => ({
  ...offlineEngine(),
  live: true,
  model: {
    id: 'stand-in',
    async complete(request) {
      if (!request.system.includes('ROLE: TRANSLATION ENGINE')) {
        return offlineEngine().model.complete(request);
      }
      const source = request.user.slice(request.user.indexOf('\n\n') + 2);
      return { text: transform(source), producedBy: 'stand-in translator' };
    },
  },
});

// Faithful: every line kept, markers and figures untouched.
const faithful = translator((source) => source.split('\n').map((line) =>
  line.startsWith('#') || !line.trim() ? line : `«${line}»`).join('\n'));
const e2 = faithful;

const t = suite('Translation happens after approval, and never before');
const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const e = faithful;
const lecturer = { id: 'person-lecturer', role: 'lecturer' };
const student = { id: 'person-student', role: 'student' };
const reviewer = { id: 'person-reviewer', role: 'translation-reviewer' };

t.section('The gate');
{
  const store = fresh();
  // Lecture 04's transcript is a draft: nothing has been approved on it.
  const draft = (await store.artefacts('lecture-04')).find((a) => a.kind === 'transcript');
  const corrected = await S.runStage(store, e, lecturer, 'lecture-04', 'corrected_text');
  await t.refuses('an unapproved artefact cannot be translated',
    () => S.translateArtefact(store, e, lecturer, corrected.id, 'fr'));

  await S.approve(store, lecturer, corrected.id);
  const french = await S.translateArtefact(store, e, lecturer, corrected.id, 'fr');
  t.check('…and an approved one can', french.language, 'fr');
  t.check('…recorded as a translation of that original', french.translatedFromId, corrected.id);
  t.check('…still owned by the lecturer', french.ownerId, 'person-lecturer');
  t.check('…and read by nobody yet', french.translationStanding, 'unreviewed');

  await t.refuses('a translation of a translation is refused',
    () => S.translateArtefact(store, e, lecturer, french.id, 'es'));
  await t.refuses('a student cannot ask for one',
    () => S.translateArtefact(store, e, student, corrected.id, 'es'));
  void draft;
}

t.section('Who may vouch for it');
{
  const store = fresh();
  const notes = (await store.artefacts('lecture-06')).find((a) => a.kind === 'structured_notes');
  const arabic = await S.translateArtefact(store, e, lecturer, notes.id, 'ar');

  // THE LINE THIS WHOLE ROLE EXISTS FOR. A lecturer who does not read Arabic
  // cannot say the Arabic says what they taught, and the platform does not let
  // them manufacture that approval.
  await t.refuses('the lecturer cannot approve a language they do not read',
    () => S.approveTranslation(store, lecturer, arabic.id));

  const vouched = await S.approveTranslation(store, reviewer, arabic.id);
  t.check('a reviewer can', vouched.translationStanding, 'reviewed');
  t.check('…and their name is kept', vouched.reviewedByName, 'Nadia Haddad');
}

t.section('A correction to the original reaches every language');
{
  const store = fresh();
  const notes = (await store.artefacts('lecture-06')).find((a) => a.kind === 'structured_notes');
  const french = await S.translateArtefact(store, e, lecturer, notes.id, 'fr');
  await S.approveTranslation(store, reviewer, french.id);

  await S.editArtefact(store, lecturer, notes.id, `${notes.body}\n\nAn afterthought.`, 'A correction');
  const after = (await store.artefacts('lecture-06')).find((a) => a.id === french.id);
  t.check('the translation is stale', !!after.staleSince, true);
  t.check('…and says so rather than looking approved', after.translationStanding, 'stale');
  await t.refuses('…and cannot be vouched for while it is',
    () => S.approveTranslation(store, reviewer, after.id));
}

console.log('\nChecking a translation without reading the language\n');

const source = `## Causes
The war began in 1914. Some historians argue that ⟦T1⟧ was decisive.

- Militarism
- Alliances
- Imperialism`;

t.section('The lecturer’s protected terms cross untouched');
t.check('a marker that did not cross is a rejection',
  V.validateTranslation(source, '## Causes\nLa guerre a commencé en 1914. Certains historiens soutiennent que le Seigneur a été décisif.\n\n- Militarisme\n- Alliances\n- Impérialisme').ok,
  false);
t.check('…and one that did is fine',
  V.validateTranslation(source, '## Causes\nLa guerre a commencé en 1914. Certains historiens soutiennent que ⟦T1⟧ a été décisif.\n\n- Militarisme\n- Alliances\n- Impérialisme').ok,
  true);
t.check('a marker the translation invented is also a rejection',
  V.validateTranslation(source, '## Causes\n1914. ⟦T1⟧ ⟦T7⟧.\n\n- Militarisme\n- Alliances\n- Impérialisme').findings
    .some((f) => f.kind === 'marker-invented'), true);

t.section('Every figure the lecture states is in the translation');
t.check('a year that vanished is a fact that vanished',
  V.validateTranslation(source, '## Causes\nLa guerre a commencé. Certains historiens soutiennent que ⟦T1⟧ a été décisif.\n\n- Militarisme\n- Alliances\n- Impérialisme').findings
    .some((f) => f.kind === 'figure-lost'), true);
// AND ARABIC NUMERALS ARE THE SAME NUMBERS. A checker that called ١٩١٤ a lost
// figure would make the Arabic unusable, which is the opposite of the point.
t.check('١٩١٤ is 1914', V.figures('في عام ١٩١٤'), ['1914']);
t.check('…and 1,000 is 1000', V.figures('about 1,000 people'), ['1000']);

t.section('The same shape');
t.check('a lost heading is a lost section',
  V.validateTranslation(source, 'La guerre a commencé en 1914. ⟦T1⟧.\n\n- Militarisme\n- Alliances\n- Impérialisme').ok,
  false);
t.check('a merged bullet is a warning, not a rejection',
  V.validateTranslation(source, '## Causes\nLa guerre a commencé en 1914. Certains historiens soutiennent que ⟦T1⟧ a été décisif.\n\n- Militarisme et alliances\n- Impérialisme').findings
    .filter((f) => f.severity === 'reject').length, 0);

t.section('And is it plausibly the same lecture at all?');
t.check('a translation that stopped a third of the way through is rejected',
  V.validateTranslation('x'.repeat(1000), 'y'.repeat(200)).ok, false);
t.check('…and one that explained rather than translated is a warning',
  V.validateTranslation('x'.repeat(400), 'y'.repeat(1400)).findings
    .some((f) => f.kind === 'length' && f.severity === 'warn'), true);

t.section('What the translation prompt forbids');
const prompt = TR.translationPrompt('structured_notes', 'fr', 'en', 'text');
for (const [what, marker] of [
  ['localising the lecturer’s examples', 'LOCALISE'],
  ['explaining a hard passage', 'EXPLAIN'],
  ['converting units or fixing dates', 'CONVERT OR CORRECT'],
  ['softening a claim', 'SOFTEN OR STRENGTHEN'],
  ['dropping a sentence', 'OMIT OR COMPRESS'],
]) t.check(`it forbids ${what}`, prompt.system.includes(marker), true);
t.check('it carries the constitution', prompt.system.includes('THE AI TRANSFORMATION CONSTITUTION'), true);
t.check('…and the terminology rule', prompt.system.includes('LECTURER TERMINOLOGY PRESERVATION'), true);
t.check('…and says the original governs', prompt.system.includes('THE ORIGINAL GOVERNS'), true);

t.section('The languages themselves');
t.check('Arabic is right to left', L.direction('ar'), 'rtl');
t.check('French is not', L.direction('fr'), 'ltr');
t.check('an unknown code does not crash the page', L.direction('xx'), 'ltr');
t.check('each language names itself', L.LANGUAGE_BY_CODE.zh.endonym, '中文');
t.check('and an unread translation says so',
  L.STANDING_NOTE.unreviewed.includes('Nobody who reads this language has checked it'), true);

t.done();
