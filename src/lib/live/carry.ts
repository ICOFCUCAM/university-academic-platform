// ---------------------------------------------------------------------------
// CARRYING ONE SEGMENT INTO ONE LANGUAGE.
//
//   heard on the floor
//        │
//        ▼
//   TERM PROTECTION            markers in, before any model sees the words
//        │
//        ▼
//   translation                with a deadline
//        │
//        ▼
//   TERM RESTORATION           markers out
//        │
//        ▼
//   TERM VALIDATION            substituted or lost ⇒ REFUSED, not reported
//        │
//        ▼
//   speech                     with what is left of the deadline
//        │
//        ▼
//   ready, or late, and a late one is never played
//
// The whole of this file is the recorded pipeline's rules applied to something
// nobody is reviewing. That is the only difference, and it is the reason the
// refusals are harder here rather than softer.
// ---------------------------------------------------------------------------

import { protectTerms, restoreTerms, validateTerminology } from '../ai/terminology';
import type { LiveEngine } from './engine';
import type { CarriedSegment, LiveSegment, SegmentState } from './types';

export interface CarryOptions {
  language: string;
  floorLanguage: string;
  /** The lecturer's own terms, from the course. Never substituted. */
  glossary?: string[];
  voice?: string;
  /**
   * How long after the lecturer stopped speaking a translation is still worth
   * playing. Beyond this it is dropped: see `types.ts`.
   *
   * Two seconds of slack over the length of the speech itself, because the
   * carried audio has to be spoken as well as made, and a student listening to
   * a forty-second passage will tolerate the gap that produced it.
   */
  deadlineMs?: number;
  /** Injectable so a test can drive the clock rather than sleep. */
  now?: () => number;
}

const SLACK_MS = 2000;

export interface Carried {
  state: SegmentState;
  text?: string;
  mediaPath?: string;
  refusal?: string;
  timing: { msTranslate?: number; msSpeak?: number; msTotal: number };
  producedBy?: string;
}

/**
 * One segment, one language. Returns rather than throws: a refusal is an
 * outcome the room has to handle, not an error the room should stop for.
 */
export async function carrySegment(
  engine: LiveEngine, segment: LiveSegment, options: CarryOptions,
): Promise<Carried> {
  const clock = options.now ?? (() => Date.now());
  const started = clock();
  const deadline = options.deadlineMs ?? (segment.seconds * 1000 + SLACK_MS);

  // A SEGMENT IS NEVER CARRIED INTO THE LANGUAGE IT IS ALREADY IN. The floor
  // language listener hears the floor, which is not a translation and must not
  // be labelled as one.
  if (options.language === options.floorLanguage) {
    return { state: 'ready', text: segment.heard, timing: { msTotal: 0 } };
  }

  // ---- PROTECTION -------------------------------------------------------
  //
  // The same markers as the recorded pipeline. The model never has the
  // lecturer's term in front of it, so there is nothing for a pretrained habit
  // to reach for — and live, that habit is the whole risk, because nobody is
  // reading the output before a student hears it.
  const protection = protectTerms(segment.heard, { glossary: options.glossary });

  let translated;
  const beforeTranslate = clock();
  try {
    translated = await engine.translator.carry({
      text: protection.text,
      from: options.floorLanguage,
      to: options.language,
      deadlineMs: deadline,
    });
  } catch (error) {
    return {
      state: 'failed',
      refusal: error instanceof Error ? error.message : String(error),
      timing: { msTotal: clock() - started },
    };
  }
  const msTranslate = clock() - beforeTranslate;

  const restored = restoreTerms(translated.text, protection.markers);
  const validation = validateTerminology(segment.heard, restored.text, {
    glossary: options.glossary,
    missingProtected: restored.missing,
  });

  // ---- REFUSAL ----------------------------------------------------------
  //
  // Not a finding for somebody to weigh later. The words do not go out.
  if (!validation.ok) {
    return {
      state: 'refused',
      refusal: validation.rejection,
      timing: { msTranslate, msTotal: clock() - started },
      producedBy: translated.producedBy,
    };
  }

  // Late before the speech is even attempted: stop here rather than spend a
  // vendor call on audio nobody will hear.
  if (clock() - started >= deadline) {
    return {
      state: 'late', text: restored.text,
      timing: { msTranslate, msTotal: clock() - started },
      producedBy: translated.producedBy,
    };
  }

  const beforeSpeak = clock();
  let spoken;
  try {
    spoken = await engine.speaker.speak({
      text: restored.text,
      language: options.language,
      voice: options.voice,
      deadlineMs: deadline - (clock() - started),
    });
  } catch (error) {
    // THE WORDS SURVIVE A FAILED VOICE. A student reading the line is better
    // served than one given nothing because a speech service was busy.
    return {
      state: 'ready', text: restored.text,
      refusal: error instanceof Error ? error.message : String(error),
      timing: { msTranslate, msTotal: clock() - started },
      producedBy: translated.producedBy,
    };
  }
  const msSpeak = clock() - beforeSpeak;
  const msTotal = clock() - started;

  if (msTotal >= deadline) {
    return {
      state: 'late', text: restored.text, mediaPath: spoken.mediaPath,
      timing: { msTranslate, msSpeak, msTotal },
      producedBy: translated.producedBy,
    };
  }

  return {
    state: 'ready',
    text: restored.text,
    mediaPath: spoken.mediaPath,
    timing: { msTranslate, msSpeak, msTotal },
    producedBy: translated.producedBy,
  };
}

/**
 * WHAT ONE LISTENER GETS FOR ONE SEGMENT, given what the carrying produced and
 * what the room decided to do about refusals.
 *
 * Every branch says *why* on the screen. A gap nobody explains is read as a
 * fault in the platform, and a student who thinks the platform is broken stops
 * using it — so "the translation of this passage was withheld" is a better
 * product than a silence that means the same thing.
 */
export function hear(
  carried: Pick<CarriedSegment, 'sequence' | 'language' | 'state' | 'text' | 'mediaPath' | 'refusal'>,
  options: { fallback: 'floor' | 'silence' | 'notice'; floor: { text: string; mediaPath?: string } },
) {
  if (carried.state === 'ready') {
    return {
      sequence: carried.sequence, language: carried.language,
      source: 'carried' as const, text: carried.text, mediaPath: carried.mediaPath,
    };
  }

  const because = carried.state === 'refused'
    ? 'The translation of this passage was withheld: it changed one of the lecturer’s terms.'
    : carried.state === 'late'
      ? 'The translation of this passage arrived too late to play.'
      : carried.state === 'failed'
        ? 'The translation service did not answer for this passage.'
        : 'This passage has not been carried yet.';

  if (options.fallback === 'floor') {
    return {
      sequence: carried.sequence, language: carried.language,
      source: 'floor' as const,
      text: options.floor.text, mediaPath: options.floor.mediaPath, because,
    };
  }
  if (options.fallback === 'notice') {
    return {
      sequence: carried.sequence, language: carried.language,
      source: 'notice' as const, because,
    };
  }
  return {
    sequence: carried.sequence, language: carried.language,
    source: 'silence' as const, because,
  };
}

/**
 * DELIVERY IS IN ORDER OR NOT AT ALL.
 *
 * Segments are carried in parallel — they have to be, or the room falls
 * behind — and they finish out of order, because a long sentence takes longer
 * than a short one. Playing them as they finish would reorder the lecture.
 *
 * So a listener is given the longest run that is contiguous from where they
 * are, and anything past a hole waits for it. A segment that will never
 * arrive — refused, late or failed — is not a hole: it has an answer, and the
 * run continues through it.
 */
export function playable<T extends { sequence: number; state: SegmentState }>(
  carried: T[], from: number,
): T[] {
  const bySequence = new Map(carried.map((c) => [c.sequence, c]));
  const run: T[] = [];
  for (let at = from; ; at += 1) {
    const next = bySequence.get(at);
    if (!next) break;
    if (next.state === 'heard' || next.state === 'carrying') break;
    run.push(next);
  }
  return run;
}
