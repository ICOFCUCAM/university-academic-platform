// ---------------------------------------------------------------------------
// THE OFFLINE ENGINE, AND THE TWO THINGS IT MUST NEVER DO.
//
// It exists so the product opens, demonstrates and tests itself with no keys.
// That is only safe while it is honest about what it is:
//
//   IT NEVER CLAIMS TO BE A LANGUAGE MODEL. Every artefact it produces is
//   stamped, so nobody approves machine prose believing a machine wrote it.
//   IT NEVER PRODUCES THE WRONG ARTEFACT QUIETLY. It guessed which prompt it
//   had been given by matching a word that appears in several of them, and
//   returned a set of revision questions where a teaching script was asked
//   for — which then went to the audio stage looking like a lesson.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const O = await load('ai/offline.ts');
const P = await load('ai/prompts.ts');
const M = await load('ai/audioModes.ts');
const t = suite('The offline engine is honest');

const context = {
  courseCode: 'BIOL 101', courseTitle: 'Cell Biology',
  lectureSequence: 6, lectureTitle: 'Photosynthesis',
};
const source = 'Photosynthesis is the conversion of light energy. Erm, the Calvin cycle is the second stage. It happens in the stroma.';
const model = O.offlineModel();

t.section('Each prompt gets the artefact it asked for');
const notes = await model.complete(P.structuredNotesPrompt(context, source));
t.check('the notes are notes', notes.text.includes('## In one paragraph'), true);

const script = await model.complete(
  P.teachingScriptPrompt(context, notes.text, M.MODE_BY_ID.lesson_15, M.PERSONA_BY_ID.tutor));
t.check('the script is prose, not a question sheet', script.text.includes('Q.'), false);
t.check('…and not a heading sheet either', script.text.includes('## '), false);

const revision = await model.complete(P.revisionPrompt(context, notes.text));
t.check('the revision set is questions', revision.text.includes('## Recall'), true);

const corrected = await model.complete(P.correctedTextPrompt(context, source));
t.check('the correction removes the filler', corrected.text.includes('Erm'), false);
t.check('…and keeps the claim', corrected.text.includes('Calvin cycle is the second stage'), true);

const extract = await model.complete(P.knowledgeExtractionPrompt(context, source));
t.check('the extraction is JSON', Array.isArray(JSON.parse(extract.text).nodes), true);

t.section('And every one of them says what made it');
for (const [name, result] of Object.entries({ notes, script, revision, corrected, extract })) {
  t.check(`${name} is stamped`, result.producedBy, 'offline processor (no language model configured)');
}

t.section('What it refuses rather than faking');
await t.refuses('a recording cannot be transcribed by rule',
  () => O.offlineTranscriber().transcribe({ mediaPath: 'lecture.m4a' }));
await t.refuses('and a script cannot be voiced',
  () => O.offlineSpeech().speak({ script: 'a hundred words' }));
const aid = await model.complete({
  system: 'You make study material for one university course out of that course’s own lectures.',
  user: 'Write a test of 10 questions.',
});
t.check('a test it cannot write says so rather than mangling one',
  aid.text.includes('no language model is configured'), true);

t.section('And the engine declares itself dead');
t.check('not live', O.offlineEngine().live, false);
t.check('…and says so in Settings', O.offlineEngine().describe().model,
  'offline processor (no language model configured)');

t.done();
