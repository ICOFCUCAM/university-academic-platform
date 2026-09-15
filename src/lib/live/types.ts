// ---------------------------------------------------------------------------
// V4 — A LECTURE BEING GIVEN, HEARD IN ANOTHER LANGUAGE.
//
// `docs/DELIVERY.md` is the map. This is the part of it that is ours: the
// session, the segments, the ordering, and what happens when a translation is
// refused. The vendors — streaming transcription, translation, speech — sit
// behind `LiveEngine` and none of them is wired.
//
// Three rules are structural here rather than aspirational, because live is
// where they are easiest to lose:
//
//   A LIVE STREAM IS A DELIVERY, NEVER A VERSION. Nothing said here becomes a
//   published artefact. When the session ends it leaves a recording, and that
//   recording enters the ordinary pipeline — transcription, cleanup, LECTURER
//   REVIEW, approval. A student heard the lecture live; the course still only
//   holds what its lecturer approved.
//
//   VALIDATION REJECTS, IT DOES NOT REPORT. In a recording, a substituted term
//   is caught by the lecturer at review. Live, nobody is reading it, so the
//   segment does not go out — and what the student hears instead is a decision
//   made here rather than an accident. See `FallbackPolicy`.
//
//   A LATE SEGMENT IS DROPPED, NOT PLAYED. A translation that arrives after
//   the lecturer has moved on is worse than a gap: the student hears the
//   answer to a question that has already been asked and answered.
// ---------------------------------------------------------------------------

export type LiveState = 'scheduled' | 'running' | 'ended' | 'abandoned';

export interface LiveSession {
  id: string;
  courseId: string;
  /** The lecture this becomes when it ends. Absent until it does. */
  lectureId?: string;
  title: string;
  lecturerId: string;
  /** The language being spoken in the room. */
  floorLanguage: string;
  /**
   * The languages being carried. Derived from who is enrolled, not chosen by
   * the lecturer: the cohort's working languages are what the room owes.
   */
  languages: string[];
  state: LiveState;
  startedAt?: string;
  endedAt?: string;
  /** What a listener hears when a segment is refused. See below. */
  fallback: FallbackPolicy;
  /** Where the floor recording is kept, once there is one. */
  mediaPath?: string;
}

/**
 * WHAT A STUDENT HEARS WHEN A SEGMENT IS REFUSED.
 *
 * `docs/DELIVERY.md` says this has to be decided before V4 ships rather than
 * discovered after it. It is decided here:
 *
 *   floor    they hear the lecturer's own voice, in the floor language, for
 *            that stretch. The default, because the lecturer's actual words
 *            are never the wrong thing to play.
 *   silence  nothing. For a room where hearing an unexpected language would
 *            be worse than a gap.
 *   notice   a short spoken line saying the translation was withheld.
 *
 * In every case the listener is TOLD, in their own language, on the screen.
 * A gap nobody explains is read as a fault in the platform, and a student who
 * thinks the platform is broken stops using it.
 */
export type FallbackPolicy = 'floor' | 'silence' | 'notice';

export type SegmentState =
  /** Heard on the floor, not yet carried anywhere. */
  | 'heard'
  /** Out with the engine. */
  | 'carrying'
  /** Carried, validated, ready to play. */
  | 'ready'
  /** Refused: a protected term was substituted or lost. */
  | 'refused'
  /** Carried, but too late to be worth playing. */
  | 'late'
  /** The engine failed. Different from refused, and said differently. */
  | 'failed';

export interface LiveSegment {
  id: string;
  sessionId: string;
  /** Monotonic within a session. Delivery is in this order or not at all. */
  sequence: number;
  /** What was said on the floor, as the transcriber heard it. */
  heard: string;
  /** When the lecturer said it, by the floor's clock. */
  spokenAt: string;
  /** How long the speech lasted, which is the budget for carrying it. */
  seconds: number;
}

export interface CarriedSegment {
  id: string;
  segmentId: string;
  sessionId: string;
  sequence: number;
  language: string;
  state: SegmentState;
  /** The translated text. Absent when refused or failed. */
  text?: string;
  /** Where the spoken audio is, once a speech service has made it. */
  mediaPath?: string;
  /** Why it was refused, in the words the terminology layer produced. */
  refusal?: string;
  /** What each stage cost in milliseconds — measured, never estimated. */
  timing?: { heardAt: string; readyAt?: string; msTranslate?: number; msSpeak?: number };
}

/** What a listener is given for one moment of the lecture. */
export interface Heard {
  sequence: number;
  language: string;
  /** 'carried' — their own language. 'floor' — the lecturer's own voice. */
  source: 'carried' | 'floor' | 'silence' | 'notice';
  text?: string;
  mediaPath?: string;
  /** Said on screen, in their language, whenever it is not the carried one. */
  because?: string;
}
