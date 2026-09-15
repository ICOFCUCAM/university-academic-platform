// ---------------------------------------------------------------------------
// WHAT AN ACCOUNT MAY PROCESS.
//
// Transcription and speech cost real money per minute of audio, and a model
// pass over twelve thousand words costs real money per lecture. So the meter
// is on MINUTES OF AUDIO PROCESSED, which is the thing that actually spends,
// rather than on notes or questions, which are cheap once the transcript
// exists.
//
// THE REFUSAL COMES BEFORE THE UPLOAD, NOT AFTER THE SPEND. A student who
// uploads a ninety-minute lecture with forty minutes left in the month is told
// so while they can still do something about it — not after the money is gone
// and the transcript is half-made.
//
// Prices are configuration, not truth: a university licences this per seat, a
// consumer pays monthly, a reseller charges what they like. What is fixed is
// the SHAPE — an allowance, a set of features, and a meter that cannot be
// overrun silently.
// ---------------------------------------------------------------------------

export type PlanId = 'free' | 'student' | 'pro' | 'institution';

export interface Plan {
  id: PlanId;
  label: string;
  /** Minutes of audio a month. Null means the licence does not meter it. */
  minutesPerMonth: number | null;
  /** The longest single upload. A four-hour file is usually a mistake. */
  maxMinutesPerLecture: number;
  audioModes: 'basic' | 'all';
  revision: 'basic' | 'all';
  courseAI: boolean;
  /** Price in minor units, in whatever currency the deployment sells in. */
  price: number | null;
  currency: string;
  blurb: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    label: 'Free',
    minutesPerMonth: 120,
    maxMinutesPerLecture: 90,
    audioModes: 'basic',
    revision: 'basic',
    courseAI: false,
    price: 0,
    currency: 'EUR',
    blurb: 'Two hours of lectures a month, notes and one audio lesson each.',
  },
  {
    id: 'student',
    label: 'Student',
    minutesPerMonth: 1200,
    maxMinutesPerLecture: 180,
    audioModes: 'all',
    revision: 'all',
    courseAI: true,
    price: 999,
    currency: 'EUR',
    blurb: 'Twenty hours a month, every audio mode, the full revision set and the Course AI.',
  },
  {
    id: 'pro',
    label: 'Pro',
    minutesPerMonth: 3000,
    maxMinutesPerLecture: 300,
    audioModes: 'all',
    revision: 'all',
    courseAI: true,
    price: 1999,
    currency: 'EUR',
    blurb: 'Fifty hours a month, for a full timetable and exam season.',
  },
  {
    id: 'institution',
    label: 'Institution',
    // A university licence is negotiated per seat or per department; metering
    // a lecturer's own teaching by the minute would be absurd.
    minutesPerMonth: null,
    maxMinutesPerLecture: 300,
    audioModes: 'all',
    revision: 'all',
    courseAI: true,
    price: null,
    currency: 'EUR',
    blurb: 'Licensed to the institution. Lecturers, cohorts, approval and the Course AI.',
  },
];

export const PLAN_BY_ID: Record<PlanId, Plan> =
  Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

export interface Usage {
  /** Minutes already processed in the current period. */
  minutesUsed: number;
  periodStart: string;
}

export interface Allowance {
  allowed: boolean;
  reason?: string;
  remaining: number | null;
}

export function mayProcess(plan: Plan, usage: Usage, minutes: number): Allowance {
  if (minutes > plan.maxMinutesPerLecture) {
    return {
      allowed: false,
      reason: `That recording is ${Math.round(minutes)} minutes. The longest single lecture on ${plan.label} is ${plan.maxMinutesPerLecture}.`,
      remaining: plan.minutesPerMonth === null ? null : plan.minutesPerMonth - usage.minutesUsed,
    };
  }
  if (plan.minutesPerMonth === null) return { allowed: true, remaining: null };

  const remaining = plan.minutesPerMonth - usage.minutesUsed;
  if (minutes > remaining) {
    return {
      allowed: false,
      reason: remaining <= 0
        ? `This month’s ${plan.minutesPerMonth} minutes are used up.`
        : `That is ${Math.round(minutes)} minutes and ${Math.round(remaining)} are left this month.`,
      remaining,
    };
  }
  return { allowed: true, remaining: remaining - minutes };
}

/** Which audio modes an account may choose. Free gets the fifteen-minute one. */
export function modesFor(plan: Plan): 'basic' | 'all' {
  return plan.audioModes;
}
