// ---------------------------------------------------------------------------
// A LIMIT ON WHAT ONE ACCOUNT CAN SPEND IN AN HOUR.
//
// Every question to the Course AI is a model call, and every study aid is a
// larger one. Without a limit, one student with a script — or one student in a
// bad mood the night before an examination — can spend a department's budget
// before anybody notices.
//
// IN PROCESS, AND HONEST ABOUT IT. A single deployment is a single process and
// this is enough; two instances mean two buckets, so the effective limit is
// double. A deployment that needs a real limit replaces `Limiter` with one
// backed by whatever it already runs.
//
// AND THE REFUSAL IS A SENTENCE A STUDENT CAN ACT ON, not a 429: they are told
// how many they have had and when the next one is.
// ---------------------------------------------------------------------------

export interface Limit {
  /** How many in the window. */
  allowance: number;
  /** The window, in minutes. */
  windowMinutes: number;
}

/** What each act costs. Making a quiz is not a question. */
export const LIMITS: Record<'ask' | 'make' | 'transform', Limit> = {
  ask: { allowance: 60, windowMinutes: 60 },
  make: { allowance: 12, windowMinutes: 60 },
  transform: { allowance: 40, windowMinutes: 60 },
};

export interface Verdict {
  allowed: boolean;
  remaining: number;
  reason?: string;
  /** When the next one becomes available. */
  nextAt?: string;
}

export interface Limiter {
  take(personId: string, act: keyof typeof LIMITS, at?: Date): Verdict;
}

export function createLimiter(limits: Record<string, Limit> = LIMITS): Limiter {
  const seen = new Map<string, number[]>();

  return {
    take(personId, act, at = new Date()) {
      const limit = limits[act];
      const key = `${personId}:${act}`;
      const now = at.getTime();
      const window = limit.windowMinutes * 60_000;

      const recent = (seen.get(key) ?? []).filter((t) => now - t < window);
      if (recent.length >= limit.allowance) {
        const oldest = recent[0];
        const nextAt = new Date(oldest + window);
        seen.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          nextAt: nextAt.toISOString(),
          reason: `That is ${limit.allowance} in the last ${limit.windowMinutes} minutes, which is the limit. The next one is available at ${nextAt.toISOString().slice(11, 16)}.`,
        };
      }

      recent.push(now);
      seen.set(key, recent);
      return { allowed: true, remaining: limit.allowance - recent.length };
    },
  };
}
