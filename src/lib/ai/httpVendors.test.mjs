// ---------------------------------------------------------------------------
// THE VENDORS, AGAINST A SERVICE THAT IS ACTUALLY RUNNING.
//
// A fake one, started here, speaking the ordinary shapes: multipart audio in,
// {text, segments} out; {text, voice} in, audio bytes out. That is enough to
// prove the two things that matter — the adapters parse what a real service
// sends, and they refuse rather than inventing when it sends something else.
//
// What this does NOT prove is that any particular vendor speaks this shape.
// Nothing in this repository has been run against a paid service.
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, suite } from '../testkit.mjs';

const t = suite('Transcription and speech');

// ---- A SERVICE THAT BEHAVES, AND ONE THAT DOES NOT ------------------------
let mode = 'good';
const server = createServer(async (request, response) => {
  if (mode === 'broken') {
    response.writeHead(503, { 'content-type': 'text/plain' });
    response.end('the model is loading');
    return;
  }

  if (request.url === '/transcribe') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      text: 'Photosynthesis happens in two stages.',
      duration: 3123,
      segments: [
        { start: 0, end: 4.2, speaker: 'SPEAKER_00', text: 'Photosynthesis happens in two stages.' },
        { start: 4.2, end: 9.0, speaker: 'SPEAKER_01', text: 'Is the Calvin cycle one of them?' },
      ],
    }));
    return;
  }

  if (request.url === '/speak') {
    response.writeHead(200, { 'content-type': 'audio/mpeg', 'x-audio-seconds': '912' });
    response.end(Buffer.from('audio bytes, pretend'));
    return;
  }

  response.writeHead(404);
  response.end();
});
await new Promise((done) => server.listen(0, done));
const base = `http://127.0.0.1:${server.address().port}`;

process.env.ACADEMIC_MEDIA_DIR = mkdtempSync(join(tmpdir(), 'academic-media-'));
process.env.ACADEMIC_TRANSCRIBER = `${base}/transcribe`;
process.env.ACADEMIC_SPEECH = `${base}/speak`;
process.env.ACADEMIC_TRANSCRIBER_MODEL = 'whisper-large';

const V = await load('ai/httpVendors.ts');
const S = await load('storage/storage.ts');

const store = S.storage();
const stored = await store.put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: 'lecture.mp3', contentType: 'audio/mpeg',
  data: Buffer.from('pretend this is a lecture'),
});

t.section('A recording goes up and a transcript comes back');
const result = await V.httpTranscriber().transcribe({ mediaPath: stored.key, hint: 'rubisco, thylakoid' });
t.check('the text is there', result.text, 'Photosynthesis happens in two stages.');
t.check('…and says what produced it', result.producedBy.startsWith('whisper-large via'), true);
t.check('…with timings', result.segments.map((s) => s.start), [0, 4.2]);
// SPEAKER LABELS PASS THROUGH EXACTLY. "SPEAKER_00" is not renamed to "The
// lecturer", because the platform does not know which speaker the lecturer is.
t.check('…and speaker labels as the service gave them',
  result.segments.map((s) => s.speaker), ['SPEAKER_00', 'SPEAKER_01']);
t.check('…and the length it reported', result.usage.seconds, 3123);

t.section('A script goes down and audio comes back');
const spoken = await V.httpSpeech().speak({
  script: 'Today we look at photosynthesis.', voice: 'platform-academic-f',
  courseId: 'c1', lectureId: 'l1',
});
t.check('the audio was stored', !!(await store.get(spoken.mediaPath)), true);
t.check('…under the lecture', spoken.mediaPath.startsWith('c1/l1/audio-'), true);
t.check('…with the length the service reported', spoken.seconds, 912);

t.section('And what they do when the service does not behave');
mode = 'broken';
await t.refuses('a failing transcription says what the service said',
  () => V.httpTranscriber().transcribe({ mediaPath: stored.key }));
await t.refuses('…and so does speech', () => V.httpSpeech().speak({ script: 'x' }));
mode = 'good';
await t.refuses('a recording that is not in the store is not invented',
  () => V.httpTranscriber().transcribe({ mediaPath: 'c1/l1/missing.mp3' }));

t.section('Segments are read where they exist, and not where they do not');
t.check('no segments means no timings', V.readSegments({ text: 'Just words.' }), undefined);
t.check('an empty list is the same', V.readSegments({ segments: [] }), undefined);
t.check('another service’s field names are read too',
  V.readSegments({ utterances: [{ start_time: 2, end_time: 5, transcript: 'Hello.', speaker_label: 'A' }] })[0],
  { start: 2, end: 5, text: 'Hello.', speaker: 'A' });
t.check('a segment with no text is dropped rather than shown blank',
  V.readSegments({ segments: [{ start: 1, text: '   ' }, { start: 2, text: 'Real.' }] }).length, 1);

server.close();
t.done();
