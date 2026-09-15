// ---------------------------------------------------------------------------
// THE LIVE VENDORS, BEHIND AN INTERFACE — and none of them is wired.
//
// Three machines, mirroring `ai/provider.ts` and for the same reasons: a
// university may not use ours, and the platform must run with nothing
// configured. The difference is that these are asked for a sentence at a time
// while somebody is still talking, so each one carries a deadline and is
// allowed to say it missed it.
//
// NOTHING HERE HAS BEEN RUN. There is no streaming transcription service, no
// live translation service and no live speech service configured in this
// repository, and `noLiveEngine()` refuses by name rather than pretending.
// ---------------------------------------------------------------------------

export interface CarryRequest {
  /** What was said, already term-protected: markers, not the lecturer's terms. */
  text: string;
  from: string;
  to: string;
  /**
   * Milliseconds this may take before the result is worthless. The engine is
   * expected to abandon rather than deliver late — see `types.ts`.
   */
  deadlineMs: number;
}

export interface CarryResult {
  text: string;
  producedBy: string;
  /** The vendor's own reported latency where it gives one. */
  ms?: number;
}

export interface LiveTranslator {
  id: string;
  carry(request: CarryRequest): Promise<CarryResult>;
}

export interface LiveSpeechRequest {
  text: string;
  language: string;
  voice?: string;
  deadlineMs: number;
}

export interface LiveSpeechResult {
  mediaPath: string;
  seconds: number;
  producedBy: string;
  ms?: number;
}

export interface LiveSpeaker {
  id: string;
  speak(request: LiveSpeechRequest): Promise<LiveSpeechResult>;
}

export interface LiveEngine {
  translator: LiveTranslator;
  speaker: LiveSpeaker;
  /** False when any part is the stand-in. Every screen showing live says so. */
  live: boolean;
  describe(): { translator: string; speaker: string; live: boolean };
}

export class NoLiveEngine extends Error {}

/**
 * What runs when nothing is configured: a refusal by name. Not silence, and
 * not a stand-in that quietly plays the floor language while the screen says
 * "French" — which is the failure this file exists to make impossible.
 */
export function noLiveEngine(): LiveEngine {
  const refuse = (): never => {
    throw new NoLiveEngine(
      'No live translation service is configured, so this lecture cannot be carried into '
      + 'another language as it is given. The recording will be processed afterwards in the '
      + 'ordinary way, and the notes, audio and quiz will arrive in every language the course offers.',
    );
  };
  return {
    translator: { id: 'none', async carry() { return refuse(); } },
    speaker: { id: 'none', async speak() { return refuse(); } },
    live: false,
    describe: () => ({ translator: 'not configured', speaker: 'not configured', live: false }),
  };
}

/**
 * A stand-in for tests and for a demonstration, which is HONEST ABOUT BEING
 * ONE: it marks the text it produces, and `live` is false, so nothing it makes
 * can be shown to a student as a translation.
 */
export function rehearsalEngine(options: { delayMs?: number; translate?: (text: string, to: string) => string } = {}): LiveEngine {
  const delay = options.delayMs ?? 0;
  const wait = async () => { if (delay) await new Promise((r) => setTimeout(r, delay)); };

  return {
    translator: {
      id: 'rehearsal',
      async carry(request) {
        await wait();
        return {
          text: options.translate
            ? options.translate(request.text, request.to)
            : `[${request.to}] ${request.text}`,
          producedBy: 'rehearsal (no live translation service configured)',
          ms: delay,
        };
      },
    },
    speaker: {
      id: 'rehearsal',
      async speak(request) {
        await wait();
        return {
          mediaPath: `rehearsal/${request.language}/${Date.now()}.txt`,
          seconds: Math.max(1, Math.round(request.text.split(/\s+/).length / 2.4)),
          producedBy: 'rehearsal (no live speech service configured)',
          ms: delay,
        };
      },
    },
    live: false,
    describe: () => ({ translator: 'rehearsal', speaker: 'rehearsal', live: false }),
  };
}
