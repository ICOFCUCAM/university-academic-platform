// ---------------------------------------------------------------------------
// THE ENGINE, BEHIND AN INTERFACE.
//
// Three machines are needed and none of them is this platform's business to
// be: something that turns speech into text, something that transforms text,
// and something that turns text into speech. Each is named here and supplied
// at the edge, for two reasons.
//
// A UNIVERSITY MAY NOT USE OURS. Some will require the audio never to leave
// their estate, or will have bought a transcription service already. An
// adapter is a file; a hard-coded vendor is a rebuild.
//
// AND THE PLATFORM MUST RUN WITH NOTHING CONFIGURED. `offline.ts` implements
// all three without a network, so the product opens, demonstrates and tests
// itself on a laptop with no keys — and says plainly, on every artefact it
// produces, that no language model was involved. Silence there would be the
// worst failure this platform could have: a lecturer approving machine prose
// that no machine wrote.
// ---------------------------------------------------------------------------

export interface CompletionRequest {
  system: string;
  user: string;
  /** Long-form artefacts (a 2,100-word script) need room. */
  maxTokens?: number;
  /** How hard to think. The correction pass is not the extraction pass. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh';
  /** The prompt demands JSON; the adapter may help the model keep its word. */
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  /** What actually produced it, recorded on the artefact. Never guessed. */
  producedBy: string;
  /**
   * WHAT IT COST, as the vendor reported it — not as we estimated it. A
   * university asked to buy this will ask what a lecture costs to process, and
   * the only honest answer comes from the meter the vendor billed.
   *
   * Absent where the engine cannot report it (the offline processor, a
   * transcription service that does not say).
   */
  usage?: { inputTokens?: number; outputTokens?: number; seconds?: number };
}

export interface LanguageModel {
  id: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export interface TranscriptionRequest {
  mediaPath: string;
  /** Subject vocabulary helps every transcriber that accepts a hint. */
  hint?: string;
}

export interface Transcriber {
  id: string;
  transcribe(request: TranscriptionRequest): Promise<CompletionResult>;
}

export interface SpeechRequest {
  script: string;
  voice?: string;
}

export interface SpeechResult {
  mediaPath: string;
  seconds: number;
  producedBy: string;
}

export interface SpeechSynthesiser {
  id: string;
  speak(request: SpeechRequest): Promise<SpeechResult>;
}

export interface Engine {
  model: LanguageModel;
  transcriber: Transcriber;
  speech: SpeechSynthesiser;
  /**
   * False when any part of the engine is the offline stand-in. Every artefact
   * produced by a dead engine says so on its face, and the review screen
   * refuses to describe it as AI-generated.
   */
  live: boolean;
  /** Shown in Settings so nobody has to guess what is wired up. */
  describe(): { model: string; transcription: string; speech: string; live: boolean };
}
