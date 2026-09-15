// ---------------------------------------------------------------------------
// THE VERIFICATION PASS.
//
// A second model call whose only question is:
//
//   "Did the transformed version introduce, remove or alter any substantive
//    claim?"
//
// NOT "is the lecturer correct?" — that question is not this system's to ask,
// and asking it is exactly the failure the contract exists to prevent. The
// verifier is a diff over claims, not a reviewer of them.
//
//   Original claim:  Christianity weakened the Roman military.
//   Output claim:    Christianity weakened the Roman military.
//   STATUS:          ✓ Preserved
//
// It runs after the transformation and before the lecturer reviews, so the
// review screen can say "sixteen claims preserved, one altered — here it is"
// instead of asking a busy academic to read twelve thousand words twice.
// ---------------------------------------------------------------------------

import type { CompletionResult, Engine } from './provider';

export type ClaimStatus = 'preserved' | 'altered' | 'added' | 'removed';

export interface ClaimCheck {
  /** The claim as the lecturer made it. Empty for an ADDED claim. */
  original: string;
  /** The claim as it now reads. Empty for a REMOVED one. */
  output: string;
  status: ClaimStatus;
  /** What changed, in one line. Only for altered, added and removed. */
  note?: string;
}

export interface VerificationReport {
  checks: ClaimCheck[];
  preserved: number;
  /** Anything that is not `preserved`. The number a lecturer looks at. */
  flagged: number;
  producedBy: string;
  /** Set when the verifier itself could not run. Never silently "clean". */
  error?: string;
  checkedAt: string;
}

export const VERIFIER_SYSTEM = `ROLE: CLAIM PRESERVATION VERIFIER

Two texts are given to you: a lecture transcript, and a transformed version of
it produced by another system. That system was permitted to change grammar,
spelling, punctuation, sentence structure, filler, repetition, paragraphing and
headings — and nothing else.

YOUR ONLY QUESTION: did the transformation introduce, remove or alter any
substantive claim?

YOU ARE NOT ASKING WHETHER THE LECTURER IS CORRECT. A claim you believe to be
false, biased, controversial, outdated or unconventional is still PRESERVED if
it survived the transformation unchanged. Judging the lecturer is not your
function and is not this system's function; the lecturer's teaching is
authoritative for the purpose of representing what was taught.

A SUBSTANTIVE CLAIM is anything a student could be examined on or could be
wrong about: a fact, a date, a figure, a name, a causal statement, a
definition, an attribution, an evaluation, a hedge ("some argue", "I believe",
"roughly", "arguably") or a scope ("all", "most", "in Europe").

Rewording is not alteration. "The theory have several implication" becoming
"The theory has several implications" is PRESERVED. Losing the hedge — "some
historians argue X" becoming "historians agree X" — is ALTERED, and so is
"because of X" becoming "because of X and Y".

Return JSON only, of this shape:

{"checks":[{"original":"…","output":"…","status":"preserved|altered|added|removed","note":"…"}]}

  • one entry per substantive claim in the ORIGINAL, in the order it appears;
  • plus one entry per claim in the OUTPUT that is not in the original, with
    status "added" and an empty "original";
  • "note" only for altered, added and removed — one line, naming what moved.

Quote both sides briefly rather than summarising them: a lecturer reading your
report has to be able to see the change without opening the two texts.`;

function parse(text: string): ClaimCheck[] {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) body = body.slice(start, end + 1);

  const parsed = JSON.parse(body) as { checks?: unknown };
  if (!Array.isArray(parsed.checks)) throw new Error('no `checks` list');

  return (parsed.checks as Record<string, unknown>[]).map((c) => ({
    original: typeof c.original === 'string' ? c.original : '',
    output: typeof c.output === 'string' ? c.output : '',
    status: (['preserved', 'altered', 'added', 'removed'] as const)
      .includes(c.status as never) ? (c.status as ClaimStatus) : 'altered',
    note: typeof c.note === 'string' && c.note.trim() ? c.note.trim() : undefined,
  }));
}

export function summarise(checks: ClaimCheck[]) {
  const preserved = checks.filter((c) => c.status === 'preserved').length;
  return { preserved, flagged: checks.length - preserved };
}

export async function verifyTransformation(
  e: Engine, original: string, transformed: string,
): Promise<VerificationReport> {
  const checkedAt = new Date().toISOString();

  let result: CompletionResult;
  try {
    result = await e.model.complete({
      system: VERIFIER_SYSTEM,
      user: `ORIGINAL TRANSCRIPT\n\n${original}\n\n---\n\nTRANSFORMED VERSION\n\n${transformed}`,
      maxTokens: 16000,
      // The hardest judgement in the system: whether a rewording moved a claim.
      effort: 'xhigh',
      json: true,
    });
  } catch (error) {
    // A VERIFIER THAT FAILED IS NOT A CLEAN BILL. It says so, and the review
    // screen shows "not verified" rather than nothing.
    return {
      checks: [], preserved: 0, flagged: 0, producedBy: 'none',
      error: error instanceof Error ? error.message : String(error),
      checkedAt,
    };
  }

  try {
    const checks = parse(result.text);
    return { checks, ...summarise(checks), producedBy: result.producedBy, checkedAt };
  } catch (error) {
    return {
      checks: [], preserved: 0, flagged: 0, producedBy: result.producedBy,
      error: `The verifier's report could not be read (${error instanceof Error ? error.message : error}).`,
      checkedAt,
    };
  }
}
