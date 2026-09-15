// ---------------------------------------------------------------------------
// THE LECTURER-APPROVED MASTER IS IMMUTABLE IN SUBSTANCE.
//
// This is the permanent principle of the platform, and it is the one that
// makes the global model possible: a lecture taught once in Lagos can be read
// in Lyon, listened to in Nairobi and revised from in Shanghai, and every one
// of those students is receiving what the lecturer approved — not what a model
// improved on the way.
//
//   AI MAY          transcribe → clean → structure → translate → synthesise
//                   → generate learning formats
//
//   AI MAY NOT      reinterpret → fact-check → alter → normalise → replace
//                   → inject its own position
//
// The left column is a pipeline; the right column is a list of ways to become
// the author of somebody else's teaching.
//
// WHAT THIS FILE ADDS to the prompts and the validators is the last hole they
// leave open: a model may not rewrite what a person has already approved. Not
// because it would be forbidden to try — the prompts handle that — but because
// a regeneration that quietly replaced approved, published, translated
// material would erase the approval and nobody would see it happen.
//
// So: an approved artefact may be regenerated, but never silently. The act is
// explicit, the approval is cleared by it, the translations go stale, and the
// version history keeps what was replaced.
// ---------------------------------------------------------------------------

import type { Artefact } from '../domain/types';

/** What AI does in this platform. Each verb is a stage that exists in code. */
export const AI_MAY = [
  'TRANSCRIBE',
  'CLEAN',
  'STRUCTURE',
  'TRANSLATE',
  'SYNTHESIZE',
  'GENERATE LEARNING FORMATS',
] as const;

/** What it does not, in any stage, in any language, at any point. */
export const AI_MAY_NOT = [
  'REINTERPRET',
  'FACT-CHECK',
  'ALTER',
  'NORMALIZE',
  'REPLACE',
  'INJECT ITS OWN POSITION',
] as const;

export const INTEGRITY_BLOCK = [
  'THE LECTURER-APPROVED MASTER IS IMMUTABLE IN SUBSTANCE.',
  '',
  `AI MAY:      ${AI_MAY.join(' → ')}`,
  `AI MAY NOT:  ${AI_MAY_NOT.join(' → ')}`,
  '',
  'The first list is a pipeline. The second is a list of ways to become the',
  'author of somebody else’s teaching, and none of them is yours.',
].join('\n');

export interface IntegrityDecision {
  allowed: boolean;
  reason?: string;
  /** True when going ahead costs the artefact its approval. */
  clearsApproval?: boolean;
}

/**
 * May a machine write over this artefact?
 *
 * Nothing, and an artefact nobody has approved: yes, that is the pipeline.
 * An artefact a person has approved: only when a person has asked for it again
 * in so many words, and the approval does not survive it.
 */
export function mayRegenerate(
  artefact: Artefact | undefined,
  asked: { explicitly?: boolean } = {},
): IntegrityDecision {
  if (!artefact) return { allowed: true };
  if (artefact.state !== 'approved' && artefact.state !== 'published') {
    return { allowed: true };
  }

  if (!asked.explicitly) {
    return {
      allowed: false,
      reason: artefact.state === 'published'
        ? 'Students are reading this. Regenerating it replaces approved material and clears your approval — ask for it again explicitly if that is what you want.'
        : 'You have approved this. Regenerating it replaces what you approved and clears the approval — ask for it again explicitly if that is what you want.',
    };
  }

  return { allowed: true, clearsApproval: true };
}

/**
 * What a regeneration does to the approval. Kept here rather than inline so
 * that "the approval did not survive" is one fact in one place — and so that
 * a screen can say so before the lecturer presses the button.
 */
export function clearApproval(artefact: Artefact): Artefact {
  return {
    ...artefact,
    state: 'ready',
    approvedBy: undefined,
    approvedByName: undefined,
    approvedAt: undefined,
    publishedAt: undefined,
    // The word check was a reading of words that no longer exist.
    wordCheck: undefined,
  };
}
