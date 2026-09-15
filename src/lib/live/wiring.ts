// ---------------------------------------------------------------------------
// WHICH LIVE ENGINE IS RUNNING, and the honest default.
//
// Nothing is wired. `ACADEMIC_LIVE=rehearsal` gives the stand-in, which marks
// everything it produces and reports `live: false`, so a demonstration can be
// walked through without anybody being shown a translation that no translator
// made. Anything else gets a refusal by name.
//
// A streaming vendor arrives here as one more branch, the way transcription
// and speech already do.
// ---------------------------------------------------------------------------

import { noLiveEngine, rehearsalEngine, type LiveEngine } from './engine';

export function liveEngine(): LiveEngine {
  if (process.env.ACADEMIC_LIVE === 'rehearsal') return rehearsalEngine();

  // A STAND-IN THAT DRIFTS ON PURPOSE. `ACADEMIC_LIVE=rehearsal-drift`
  // substitutes a protected term exactly as a pretrained habit would, so the
  // terminology layer can be watched refusing a passage in a live room rather
  // than only in a test. A guard nobody has seen refuse anything is a guard
  // nobody believes.
  if (process.env.ACADEMIC_LIVE === 'rehearsal-drift') {
    return rehearsalEngine({
      translate: (text, to) => `[${to}] ${text.replace(/⟦T1⟧/g, 'Jehovah')}`,
    });
  }

  return noLiveEngine();
}
