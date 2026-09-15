// ---------------------------------------------------------------------------
// THE RULE IS IN EVERY PROMPT, OR IT IS IN NONE OF THEM.
//
// "Preserve. Don't interfere." is a hard system instruction throughout the
// architecture for a reason: a general-purpose model will naturally try to
// improve factual content, and a single prompt written without the rule is a
// stage where the lecturer's teaching silently becomes the model's.
//
// So this counts. Every transformation prompt carries the rule; the one prompt
// that is allowed outside the course carries the labelling instead; and no
// pipeline prompt carries the general-knowledge licence.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const P = await load('ai/prompts.ts');
const M = await load('ai/audioModes.ts');
const t = suite('Preserve. Don’t interfere.');

const context = {
  courseCode: 'BIOL 101', courseTitle: 'Cell Biology',
  lectureSequence: 6, lectureTitle: 'Photosynthesis',
};

const prompts = {
  'corrected text': P.correctedTextPrompt(context, 'the lecture'),
  'knowledge extraction': P.knowledgeExtractionPrompt(context, 'the lecture'),
  'structured notes': P.structuredNotesPrompt(context, 'the lecture'),
  'teaching script': P.teachingScriptPrompt(context, 'the notes', M.MODE_BY_ID.lesson_15, M.PERSONA_BY_ID.tutor),
  'revision materials': P.revisionPrompt(context, 'the notes'),
};

t.section('Every transformation carries the contract, word for word');
const C = await load('ai/contract.ts');
for (const [name, prompt] of Object.entries(prompts)) {
  // THE WHOLE CONTRACT, not a paraphrase of it. A prompt that restated the
  // role boundary in its own words would be a second, drifting copy.
  t.check(`${name}: the role boundary, verbatim`,
    prompt.system.includes(C.TRANSFORMATION_CONTRACT), true);
  t.check(`${name}: not a fact checker`, prompt.system.includes('You are NOT a fact checker.'), true);
  t.check(`${name}: may not correct factual claims`,
    prompt.system.includes('NOT permitted to correct factual claims'), true);
  t.check(`${name}: may not drop a claim it dislikes`,
    prompt.system.includes('controversial, biased, incomplete or unconventional'), true);
  t.check(`${name}: when in doubt, preserve`,
    prompt.system.includes('preserve the original\nwording'), true);
  t.check(`${name}: preserve, don’t interfere`, prompt.system.includes('PRESERVE. DO NOT INTERFERE.'), true);
  t.check(`${name}: adds no fact`, /may NOT|not allowed|NOT ALLOWED/i.test(prompt.system), true);
  t.check(`${name}: a hedge survives`, prompt.system.includes('"I believe X."'), true);
  t.check(`${name}: does not correct the lecturer`, prompt.system.includes('NOT YOURS TO CORRECT'), true);
  t.check(`${name}: marks a gap rather than filling it`,
    prompt.system.includes('[unclear in the recording]'), true);
}

t.section('And none of them is licensed to use general knowledge');
for (const [name, prompt] of Object.entries(prompts)) {
  t.check(`${name}: no general-knowledge licence`,
    prompt.system.includes('no longer restricted to their lectures'), false);
}

t.section('The Course AI answers from the course, or says it cannot');
t.check('it has one corpus', P.TUTOR_SYSTEM.includes('That is the whole of\nyour knowledge for this conversation.'), true);
t.check('…and a refusal in the lecturer’s favour',
  P.TUTOR_SYSTEM.includes("This course's lectures do not cover that."), true);
t.check('…and does not answer from general knowledge',
  P.TUTOR_SYSTEM.includes('Do not answer from general knowledge'), true);

t.section('The general door, when a student opens it, is labelled');
t.check('it names the difference rather than overruling the lecturer',
  P.GENERAL_AI_SYSTEM.includes('NEVER CONTRADICT THEIR LECTURER SILENTLY'), true);
t.check('…and keeps the two apart', P.GENERAL_AI_SYSTEM.includes('SAY WHICH IS WHICH'), true);

t.section('The audio is the lecture condensed, not a lesson about the subject');
const script = P.teachingScriptPrompt(context, 'notes', M.MODE_BY_ID.lesson_15, M.PERSONA_BY_ID.professor);
t.check('traceable to the notes', script.system.includes('Everything you say must be traceable to the notes'), true);
t.check('…and what the lecturer left out stays out', script.system.includes('it stays out'), true);

t.section('The transformation is an enumerated set of operations, not "correct this"');
const O = await load('ai/operations.ts');
const corrected = prompts['corrected text'].system;
t.check('it is named as a constrained transformation',
  corrected.includes('PERFORM A CONSTRAINED LINGUISTIC TRANSFORMATION.'), true);
for (const op of O.ALLOWED_OPERATIONS) {
  t.check(`allowed: ${op}`, corrected.includes(`✓ ${op}`), true);
}
for (const op of O.FORBIDDEN_OPERATIONS) {
  t.check(`forbidden: ${op}`, corrected.includes(`✗ ${op}`), true);
}
t.check('nine operations are permitted', O.ALLOWED_OPERATIONS.length, 9);
t.check('…and ten are named as forbidden', O.FORBIDDEN_OPERATIONS.length, 10);
t.check('the Roman example is in the prompt, not only in the documentation',
  corrected.includes('Historians debate the causes'), true);

t.section('The verifier asks whether a claim moved — not whether it is true');
const V = await load('ai/verify.ts');
t.check('its question', V.VERIFIER_SYSTEM.includes('did the transformation introduce, remove or alter any\nsubstantive claim?'), true);
t.check('…and explicitly not the other one',
  V.VERIFIER_SYSTEM.includes('YOU ARE NOT ASKING WHETHER THE LECTURER IS CORRECT'), true);
t.check('a false claim that survived is preserved',
  V.VERIFIER_SYSTEM.includes('still PRESERVED if\nit survived the transformation unchanged'), true);
t.check('a lost hedge is an alteration',
  V.VERIFIER_SYSTEM.includes('Losing the hedge') && V.VERIFIER_SYSTEM.includes('is ALTERED'), true);

// A verifier that cannot run must never read as a clean bill of health.
const summary = V.summarise([
  { original: 'a', output: 'a', status: 'preserved' },
  { original: 'b', output: 'b and c', status: 'altered' },
  { original: '', output: 'd', status: 'added' },
]);
t.check('it counts what was preserved', summary.preserved, 1);
t.check('…and flags everything else', summary.flagged, 2);

t.section('The audio is a condensation of supplied material, not a programme');
t.check('it says so in the first line',
  script.system.startsWith('Create a spoken condensation of the supplied lecture content.'), true);
t.check('…and bounds the source',
  script.system.includes('Use only information contained in the source material'), true);

t.done();
