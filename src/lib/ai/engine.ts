// ---------------------------------------------------------------------------
// WHICH ENGINE IS ACTUALLY WIRED UP. Server-side only.
// ---------------------------------------------------------------------------

import { anthropicConfigured, anthropicModel } from './anthropic';
import { httpSpeech, httpTranscriber } from './httpVendors';
import { offlineEngine, offlineSpeech, offlineTranscriber } from './offline';
import type { Engine } from './provider';

let cached: Engine | null = null;

export function engine(): Engine {
  if (cached) return cached;

  // Transcription and speech are configured independently of the language
  // model: a university may run its own transcription and no model at all, or
  // the other way round, and neither should switch the other off.
  const transcriber = process.env.ACADEMIC_TRANSCRIBER ? httpTranscriber() : offlineTranscriber();
  const speech = process.env.ACADEMIC_SPEECH ? httpSpeech() : offlineSpeech();

  if (!anthropicConfigured()) {
    const offline = offlineEngine();
    cached = {
      ...offline,
      transcriber,
      speech,
      describe: () => ({
        ...offline.describe(),
        transcription: transcriber.id,
        speech: speech.id,
      }),
    };
    return cached;
  }

  const model = anthropicModel();
  // Transcription and speech have no default vendor. A university chooses one
  // — or keeps the audio inside its own estate and never sends it anywhere —
  // and until they do, those two stages say so instead of failing obscurely.
  cached = {
    model,
    transcriber,
    speech,
    live: true,
    describe: () => ({
      model: model.id,
      transcription: process.env.ACADEMIC_TRANSCRIBER ?? 'not configured',
      speech: process.env.ACADEMIC_SPEECH ?? 'not configured',
      live: true,
    }),
  };
  return cached;
}

/** Tests build their own engines. */
export function resetEngine() { cached = null; }
