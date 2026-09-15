// ---------------------------------------------------------------------------
// THE TRANSFORMATION ENGINE'S OWN RULES.
//
// Two of them carry the platform's credibility:
//
//   NOTHING IS BUILT ON AN UNAPPROVED CORRECTION. A mis-heard term in the
//   transcript, let through, arrives in the notes, the script, the audio, the
//   revision cards AND the course knowledge base — five copies of one error,
//   in a cohort's hands, under a lecturer's name.
//
//   A CORRECTION REACHES EVERYTHING MADE FROM IT. A lecturer who fixes the
//   text and finds the audio still saying the wrong thing has been given a
//   correction only they can see.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const S = await load('pipeline/stages.ts');
const t = suite('The AI transformation engine');

t.section('The chain, as the University drew it');
t.check('a recording is supplied, not made', S.STAGE_BY_KIND.recording.from, null);
t.check('the transcript comes from the recording', S.STAGE_BY_KIND.transcript.from, 'recording');
t.check('the corrected text from the transcript', S.STAGE_BY_KIND.corrected_text.from, 'transcript');
t.check('the knowledge extraction from the corrected text', S.STAGE_BY_KIND.knowledge_extract.from, 'corrected_text');
t.check('the notes from the corrected text', S.STAGE_BY_KIND.structured_notes.from, 'corrected_text');
t.check('the teaching script from the notes', S.STAGE_BY_KIND.teaching_script.from, 'structured_notes');
t.check('the audio from the script', S.STAGE_BY_KIND.audio_15min.from, 'teaching_script');
t.check('the revision materials from the notes', S.STAGE_BY_KIND.revision_materials.from, 'structured_notes');

t.section('The academic processor is three passes and they are separate artefacts');
t.check('grammar and language', S.STAGE_BY_KIND.corrected_text.by, 'language-model');
t.check('knowledge extraction', S.STAGE_BY_KIND.knowledge_extract.by, 'language-model');
t.check('structure and formatting', S.STAGE_BY_KIND.structured_notes.by, 'language-model');

t.section('What a student is given, and what is working material');
t.check('a transcript is not a handout', S.STAGE_BY_KIND.transcript.studentFacing, false);
t.check('nor is the extraction', S.STAGE_BY_KIND.knowledge_extract.studentFacing, false);
t.check('nor is the script — the audio is', S.STAGE_BY_KIND.teaching_script.studentFacing, false);
t.check('the notes are', S.STAGE_BY_KIND.structured_notes.studentFacing, true);
t.check('and the audio lesson is', S.STAGE_BY_KIND.audio_15min.studentFacing, true);

t.section('Nothing downstream runs on an unapproved correction');
t.check('the notes will not start from a draft corrected text',
  S.mayRun('structured_notes', 'ready').ready, false);
t.check('…and say why',
  S.mayRun('structured_notes', 'ready').blockedBy,
  'Approve the corrected academic text first — everything below is built on it.');
t.check('…and will start once it is approved', S.mayRun('structured_notes', 'approved').ready, true);
t.check('…and once it is published', S.mayRun('structured_notes', 'published').ready, true);
// THE KNOWLEDGE BASE IS THE STRICTEST, because a wrong extraction is answered
// to every student who ever asks the Course AI a question.
t.check('the extraction will not start from a draft either',
  S.mayRun('knowledge_extract', 'ready').ready, false);
// The correction itself is the FIRST judgement, so it runs on the raw
// transcript — there is nothing yet for a person to have approved.
t.check('the correction runs on the raw transcript', S.mayRun('corrected_text', 'ready').ready, true);
t.check('nothing runs on a missing source', S.mayRun('corrected_text', 'missing').ready, false);
t.check('nothing runs on a failed source', S.mayRun('transcript', 'failed').ready, false);
t.check('nothing runs while the source is still being made', S.mayRun('transcript', 'running').ready, false);

t.section('A correction reaches everything made from it');
t.check('correcting the text makes five things stale',
  S.staleAfterEdit('corrected_text').sort(),
  ['audio_15min', 'knowledge_extract', 'revision_materials', 'structured_notes', 'teaching_script']);
t.check('…correcting the notes, three',
  S.staleAfterEdit('structured_notes').sort(),
  ['audio_15min', 'revision_materials', 'teaching_script']);
t.check('…and correcting the revision cards, nothing', S.staleAfterEdit('revision_materials'), []);
t.check('replacing the recording restarts the lot', S.staleAfterEdit('recording').length, 7);

t.section('The states, and the ones that are refused');
t.check('made → approved', S.canTransition('ready', 'approved'), true);
t.check('approved → published', S.canTransition('approved', 'published'), true);
t.check('published → approved, when it is withdrawn', S.canTransition('published', 'approved'), true);
t.check('a draft cannot be published', S.canTransition('ready', 'published'), false);
t.check('nothing is published before it exists', S.canTransition('absent', 'published'), false);
t.check('a failed stage can be asked for again', S.canTransition('failed', 'queued'), true);

t.done();
