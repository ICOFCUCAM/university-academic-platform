// ---------------------------------------------------------------------------
// TRANSCRIPTION AND SPEECH, AGAINST WHATEVER A UNIVERSITY ALREADY RUNS.
//
// This platform does not pick a vendor for anybody. Some universities will not
// let lecture audio leave their estate at all and will run a model on their own
// hardware; others have bought a transcription service already. So both
// adapters speak an ORDINARY HTTP SHAPE, configured by environment:
//
//   ACADEMIC_TRANSCRIBER      a URL that takes multipart audio and returns
//                             {text, segments:[{start,end,text,speaker?}]}
//                             — the shape Whisper-compatible services use,
//                             which most self-hosted runners also expose.
//   ACADEMIC_SPEECH           a URL that takes {text, voice} and returns audio
//                             bytes.
//
// Both take an optional bearer token and an optional model name. Nothing here
// is vendor-specific, and a service that speaks a different shape needs one
// file rather than a fork.
//
// WHAT THEY DO NOT DO IS GUESS. A transcriber that returns no timings gives a
// transcript with no timings, and a speech service that does not report a
// duration gives a lesson whose length is unknown — rather than a number
// computed from the byte count and shown as though somebody measured it.
// ---------------------------------------------------------------------------

import type {
  CompletionResult, SpeechRequest, SpeechResult, SpeechSynthesiser,
  Transcriber, TranscriptionRequest,
} from './provider';
import { storage } from '../storage/storage';

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

export interface TranscriptionResult extends CompletionResult {
  segments?: TranscriptSegment[];
}

function seconds(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Reads the segments a service reported, in the two shapes they come in, and
 * returns nothing where it reported none. Speaker labels are passed through
 * exactly as given — "SPEAKER_00" is not renamed to "The lecturer", because
 * the platform does not know which speaker the lecturer is.
 */
export function readSegments(payload: Record<string, unknown>): TranscriptSegment[] | undefined {
  const raw = (payload.segments ?? payload.words ?? payload.utterances) as unknown;
  if (!Array.isArray(raw) || !raw.length) return undefined;

  const segments: TranscriptSegment[] = [];
  for (const entry of raw) {
    const parsed = (() => {
      const item = entry as Record<string, unknown>;
      const start = seconds(item.start ?? item.start_time ?? item.from);
      const end = seconds(item.end ?? item.end_time ?? item.to);
      const text = typeof item.text === 'string' ? item.text
        : typeof item.transcript === 'string' ? item.transcript : '';
      if (start === undefined || !text.trim()) return null;
      const speaker = item.speaker ?? item.speaker_label ?? item.channel;
      const segment: TranscriptSegment = { start, end: end ?? start, text: text.trim() };
      if (typeof speaker === 'string' || typeof speaker === 'number') {
        segment.speaker = String(speaker);
      }
      return segment;
    })();
    if (parsed) segments.push(parsed);
  }

  return segments.length ? segments : undefined;
}

export function httpTranscriber(): Transcriber & {
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
} {
  const endpoint = process.env.ACADEMIC_TRANSCRIBER!;
  const key = process.env.ACADEMIC_TRANSCRIBER_KEY;
  const model = process.env.ACADEMIC_TRANSCRIBER_MODEL;

  return {
    id: endpoint,

    async transcribe(request) {
      const file = await storage().get(request.mediaPath);
      if (!file) {
        throw new Error(`The recording ${request.mediaPath} is not in the store, so it cannot be transcribed.`);
      }

      const form = new FormData();
      form.set('file', new Blob([new Uint8Array(file.data)], { type: file.contentType }), 'lecture');
      if (model) form.set('model', model);
      form.set('response_format', 'verbose_json');
      // The subject's own vocabulary, where the service accepts a hint: it is
      // what stops "rubisco" coming back as "rubisko".
      if (request.hint) form.set('prompt', request.hint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: key ? { authorization: `Bearer ${key}` } : undefined,
        body: form,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`The transcription service answered ${response.status}: ${detail}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      const segments = readSegments(payload);
      if (!text && !segments) throw new Error('The transcription service returned nothing.');

      return {
        text: text || segments!.map((s) => s.text).join(' '),
        producedBy: `${model ?? 'transcription'} via ${new URL(endpoint).host}`,
        segments,
        usage: { seconds: seconds(payload.duration) },
      };
    },
  };
}

export function httpSpeech(): SpeechSynthesiser {
  const endpoint = process.env.ACADEMIC_SPEECH!;
  const key = process.env.ACADEMIC_SPEECH_KEY;
  const model = process.env.ACADEMIC_SPEECH_MODEL;

  return {
    id: endpoint,

    async speak(request: SpeechRequest): Promise<SpeechResult> {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          input: request.script,
          text: request.script,
          voice: request.voice,
          model,
          format: 'mp3',
        }),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`The speech service answered ${response.status}: ${detail}`);
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.byteLength) throw new Error('The speech service returned no audio.');

      const stored = await storage().put({
        courseId: request.courseId ?? 'unfiled',
        lectureId: request.lectureId ?? 'unfiled',
        kind: 'audio',
        originalName: 'lesson.mp3',
        contentType: response.headers.get('content-type') ?? 'audio/mpeg',
        data: audio,
      });

      // The length is what the service reported, or unknown. Not a number
      // derived from the byte count and shown as though somebody measured it.
      const reported = seconds(response.headers.get('x-audio-seconds'));

      return {
        mediaPath: stored.key,
        seconds: reported ?? 0,
        producedBy: `${model ?? 'speech'} via ${new URL(endpoint).host}`,
      };
    },
  };
}
