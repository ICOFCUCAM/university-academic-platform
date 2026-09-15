// ---------------------------------------------------------------------------
// TWO DIFFERENT PERSONALISATION LAYERS, AND THEY ARE NOT THE SAME KIND OF THING.
//
//   WORKING LANGUAGE   the student's academic environment. One language,
//                      chosen once, changed by an administrator and not by the
//                      student mid-course. Notes, transcript, audio, quizzes,
//                      flashcards, the Course AI and the interface all arrive
//                      in it. See `i18n/profile.ts`.
//
//   VOICE              a listening preference. It changes how the audio is
//                      spoken and nothing about what is said, so a student may
//                      change it whenever they like, as often as they like.
//
// AND ONE RULE THAT IS NOT A PREFERENCE AT ALL:
//
//   A LECTURER'S VOICE IS NEVER SYNTHESISED WITHOUT THEIR AUTHORISATION.
//   Not as a default, not as an experiment, not because the university would
//   like it. A voice is a person; using one without consent is impersonation,
//   and it is the one thing in this platform that cannot be undone by
//   withdrawing a page. Where a lecturer has not enabled it, the option says
//   so in words rather than quietly disappearing, so nobody wonders whether
//   the platform did it anyway.
// ---------------------------------------------------------------------------

export type VoiceKind = 'lecturer' | 'university' | 'platform';

export interface Voice {
  id: string;
  kind: VoiceKind;
  label: string;
  /** What it sounds like, in the words a student picks from. */
  blurb: string;
}

/**
 * The platform's own voices. A deployment swaps this list for whatever its
 * speech vendor offers; nothing else changes.
 */
export const PLATFORM_VOICES: Voice[] = [
  { id: 'platform-academic-f', kind: 'platform', label: 'Academic female', blurb: 'Measured, formal, unhurried.' },
  { id: 'platform-academic-m', kind: 'platform', label: 'Academic male', blurb: 'Measured, formal, unhurried.' },
  { id: 'platform-warm-f', kind: 'platform', label: 'Warm female', blurb: 'Conversational, closer to a tutorial than a lecture.' },
  { id: 'platform-warm-m', kind: 'platform', label: 'Warm male', blurb: 'Conversational, closer to a tutorial than a lecture.' },
];

/**
 * THE LECTURER'S OWN CONSENT, recorded as a fact with a date on it rather than
 * as a checkbox somewhere. Revocable, and revocation is honoured everywhere the
 * voice would otherwise be used — including audio already generated, which is
 * why `revokedAt` is checked at listening time and not only at generation.
 */
export interface VoiceConsent {
  authorisedAt: string;
  /** What they agreed to. Narrower than "anything the platform likes". */
  scope: 'translated-audio' | 'all-audio';
  revokedAt?: string;
  /** Their own words, kept so the agreement can be read back to them. */
  note?: string;
}

export function consentHolds(consent: VoiceConsent | undefined, use: 'translated-audio' | 'original-audio'): boolean {
  if (!consent || consent.revokedAt) return false;
  if (consent.scope === 'all-audio') return true;
  return use === 'translated-audio';
}

export interface VoiceOffer {
  voice: Voice;
  available: boolean;
  /** Why not, in words. Never a silently missing option. */
  unavailableBecause?: string;
}

export interface VoiceContext {
  /** The lecturer whose lecture this is. */
  lecturerName: string;
  lecturerConsent?: VoiceConsent;
  /** Is this the original audio, or audio of a translation? */
  use: 'translated-audio' | 'original-audio';
  /** The institution's own approved voice, where it has one. */
  universityVoice?: Voice;
  /** What the lecturer allows on this course; empty means all platform voices. */
  allowed?: string[];
}

/**
 * What a student may choose between, and what they are told about what they
 * may not.
 */
export function voicesFor(context: VoiceContext): VoiceOffer[] {
  const offers: VoiceOffer[] = [];

  const lecturerVoice: Voice = {
    id: 'lecturer',
    kind: 'lecturer',
    label: `${context.lecturerName}’s voice`,
    blurb: 'The lecturer’s own voice, with their authorisation.',
  };

  if (consentHolds(context.lecturerConsent, context.use)) {
    offers.push({ voice: lecturerVoice, available: true });
  } else {
    offers.push({
      voice: lecturerVoice,
      available: false,
      unavailableBecause: context.lecturerConsent?.revokedAt
        ? 'The lecturer has withdrawn permission for their voice to be used.'
        : context.lecturerConsent
          ? 'The lecturer authorised their voice for translated audio only.'
          : 'Not available — the lecturer has not enabled voice preservation.',
    });
  }

  if (context.universityVoice) offers.push({ voice: context.universityVoice, available: true });

  for (const voice of PLATFORM_VOICES) {
    if (context.allowed?.length && !context.allowed.includes(voice.id)) continue;
    offers.push({ voice, available: true });
  }

  return offers;
}

/** Playback speeds a student can choose. Not a property of the material. */
export const SPEEDS = [0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2] as const;
export type Speed = (typeof SPEEDS)[number];
