// ---------------------------------------------------------------------------
// WHAT A LECTURE COST, AND WHAT AN ACCOUNT HAS SPENT.
//
// Two different questions, and a university buying this will ask both:
//
//   WHAT DOES PROCESSING A LECTURE COST US? Answered per run, from the
//   vendor's own reported usage — never from an estimate, because an estimate
//   is what a salesperson quotes and a bill is what arrives.
//
//   HAS THIS ACCOUNT USED WHAT IT PAID FOR? Answered in minutes of audio,
//   which is the thing that actually spends: transcription and speech are
//   billed by the minute, and a model pass over twelve thousand words is
//   billed by the token but scales with the same minutes.
//
// THE REFUSAL COMES BEFORE THE SPEND. `mayProcess` is called on the way in, so
// a student uploading ninety minutes with forty left is told while they can
// still do something about it.
// ---------------------------------------------------------------------------

export interface RunCost {
  id: string;
  courseId: string;
  lectureId: string;
  /** Which stage, so "the extraction is the expensive one" is answerable. */
  stage: string;
  /** What produced it — a model id, or the offline processor. */
  producedBy: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Characters in and out, always available, for when tokens are not. */
  charactersIn: number;
  charactersOut: number;
  at: string;
}

export interface UsageRecord {
  id: string;
  personId: string;
  /** YYYY-MM. Allowances are monthly, so the period is the key. */
  period: string;
  minutes: number;
  lectureId: string;
  at: string;
}

export function period(at = new Date()): string {
  return at.toISOString().slice(0, 7);
}

export function minutesUsedIn(records: UsageRecord[], personId: string, month = period()): number {
  return records
    .filter((r) => r.personId === personId && r.period === month)
    .reduce((sum, r) => sum + r.minutes, 0);
}

/**
 * What the runs on one lecture cost, added up. Tokens where the vendor said,
 * characters always — and the two are kept apart rather than one estimated
 * from the other, because a ratio that is right for English is wrong for
 * Chinese and nobody would notice.
 */
export function costOfLecture(costs: RunCost[], lectureId: string) {
  const mine = costs.filter((c) => c.lectureId === lectureId);
  return {
    runs: mine.length,
    inputTokens: mine.reduce((sum, c) => sum + (c.inputTokens ?? 0), 0),
    outputTokens: mine.reduce((sum, c) => sum + (c.outputTokens ?? 0), 0),
    charactersIn: mine.reduce((sum, c) => sum + c.charactersIn, 0),
    charactersOut: mine.reduce((sum, c) => sum + c.charactersOut, 0),
    /** True when no vendor reported tokens — so a screen can say "not billed". */
    unmetered: mine.every((c) => c.inputTokens === undefined),
    byStage: [...new Set(mine.map((c) => c.stage))].map((stage) => ({
      stage,
      runs: mine.filter((c) => c.stage === stage).length,
      outputTokens: mine.filter((c) => c.stage === stage)
        .reduce((sum, c) => sum + (c.outputTokens ?? 0), 0),
    })),
  };
}
