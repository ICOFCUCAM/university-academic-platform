// ---------------------------------------------------------------------------
// RBAC FOR AI, AND THE PROOF THAT IT IS A BOUNDARY RATHER THAN A DESCRIPTION.
//
// The platform does not rely on "please behave yourself, AI". A model call is
// made AS A ROLE, and `callAs` refuses the call when the role's conditions are
// not met. Each refusal below corresponds to a way this product could have
// failed quietly:
//
//   a transformation prompt written without the contract — the one stage where
//   the lecturer's teaching becomes the model's;
//   a tutor called with no course material — which answers from the model's own
//   knowledge and sounds exactly the same;
//   general knowledge reached without a student asking for it — which is the
//   two knowledge sources merging on a page, invisibly.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const R = await load('ai/roles.ts');
const C = await load('ai/contract.ts');
const t = suite('The AI has permissions');

// A model that records what it was asked and answers predictably.
const asked = [];
const engine = {
  model: { id: 'test', async complete(request) { asked.push(request); return { text: 'answer', producedBy: 'test' }; } },
  transcriber: { id: 'test', async transcribe() { throw new Error('no'); } },
  speech: { id: 'test', async speak() { throw new Error('no'); } },
  live: true,
  describe: () => ({ model: 'test', transcription: 'test', speech: 'test', live: true }),
};

t.section('The boundaries are declared, not implied');
t.check('transformation may change grammar',
  R.AI_ROLES.transformation.may.includes('change grammar'), true);
for (const forbidden of [
  'fact-check', 'debate', 'correct knowledge', 'inject outside information',
  'reinterpret the lecturer', 'challenge the lecturer', 'silently change claims',
]) {
  t.check(`transformation may NOT ${forbidden}`,
    R.AI_ROLES.transformation.mayNot.includes(forbidden), true);
}
t.check('the verifier may not judge whether a claim is true',
  R.AI_ROLES.verifier.mayNot.includes('judge whether a claim is true'), true);
t.check('the tutor may not use knowledge from outside the course',
  R.AI_ROLES['course-tutor'].mayNot.includes('use knowledge from outside the course'), true);
t.check('only one role uses general knowledge at all',
  Object.values(R.AI_ROLES).filter((r) => r.usesGeneralKnowledge).map((r) => r.id),
  ['general-explainer']);
t.check('…and what it produces must be labelled',
  R.AI_ROLES['general-explainer'].labelAsOutsideCourse, true);

t.section('And they are enforced at the call, not requested in the prompt');

await t.refuses('a transformation without the contract does not run', () =>
  R.callAs(engine, 'transformation', { system: 'Tidy this up a bit.', user: '…' }));

t.check('…and with it, it does',
  (await R.callAs(engine, 'transformation',
    { system: `${C.TRANSFORMATION_CONTRACT}\n\nNow do the work.`, user: '…' })).role,
  'transformation');

await t.refuses('the tutor cannot run with an empty corpus', () =>
  R.callAs(engine, 'course-tutor', { system: 'You are the course assistant.', user: '…' }));

t.check('…and runs when the course supplied material',
  (await R.callAs(engine, 'course-tutor',
    { system: 'You are the course assistant.', user: '…' }, { corpusSize: 4 })).role,
  'course-tutor');

await t.refuses('general knowledge is closed unless a student opened it', () =>
  R.callAs(engine, 'general-explainer', { system: 'Explain.', user: '…' }));

const general = await R.callAs(engine, 'general-explainer',
  { system: 'Explain.', user: '…' }, { studentAskedToGoBeyondTheCourse: true });
t.check('…and when they do, the answer is stamped as outside the course',
  general.outsideCourse, true);
t.check('…while a course answer is not',
  (await R.callAs(engine, 'course-tutor', { system: 's', user: 'u' }, { corpusSize: 1 })).outsideCourse,
  false);

t.section('Every model call in the platform names a role');
const { readFileSync, readdirSync } = await import('node:fs');
const { join } = await import('node:path');
const here = new URL('.', import.meta.url).pathname;
const roots = [join(here, '..'), join(here, '.'), join(here, '../../components')];
const offenders = [];
for (const root of roots) {
  for (const name of readdirSync(root)) {
    if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
    // `roles.ts` is where the one permitted call lives, and `offline.ts` /
    // `anthropic.ts` ARE the model.
    if (['roles.ts', 'offline.ts', 'anthropic.ts', 'engine.ts', 'provider.ts'].includes(name)) continue;
    const source = readFileSync(join(root, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    if (/\.model\.complete\(/.test(source)) offenders.push(name);
  }
}
t.check('nothing calls the model directly', offenders, []);

t.done();
