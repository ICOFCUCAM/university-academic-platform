// ---------------------------------------------------------------------------
// WHICH ENGINE IS ACTUALLY WIRED UP. Server-side only.
// ---------------------------------------------------------------------------

import { anthropicConfigured, anthropicModel } from './anthropic';
import { offlineEngine, offlineSpeech, offlineTranscriber } from './offline';
import type { Engine } from './provider';

let cached: Engine | null = null;

export function engine(): Engine {
  if (cached) return cached;

  if (!anthropicConfigured()) {
    cached = offlineEngine();
    return cached;
  }

  const model = anthropicModel();
  // Transcription and speech have no default vendor. A university chooses one
  // — or keeps the audio inside its own estate and never sends it anywhere —
  // and until they do, those two stages say so instead of failing obscurely.
  cached = {
    model,
    transcriber: offlineTranscriber(),
    speech: offlineSpeech(),
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
