// ---------------------------------------------------------------------------
// SPACED REPETITION.
//
// A deck that shows every card every time is a deck nobody finishes twice. The
// point of revision is to spend the hour on the cards that are going, not on
// the twelve that are already held.
//
// What is kept is deliberately small: for each card, how far up the ladder it
// has climbed and when it is next worth asking. Not how long the student
// hesitated, not the hour of the night they revised, not which card defeated
// them — only the schedule, and only to the student themself. A lecturer
// reading "Joseph cannot hold the definition of a thylakoid" would be reading
// something the student never offered them, so `service.ts` gives the recall
// record to its owner and to nobody else, with no cohort shape over it. The
// cohort's shape is what `progress.ts` is for, and it counts at the lecture,
// never at the card.
//
// THE CARD'S IDENTITY IS ITS FRONT, not an id, because the deck is generated
// and regenerated and no id survives that. A translated deck is a different
// study aid with different fronts, so a student revising in French builds a
// French schedule; that is correct rather than unfortunate — they are
// recalling the French words.
// ---------------------------------------------------------------------------

export interface Recall {
  id: string;
  personId: string;
  courseId: string;
  studyAidId: string;
  /** The card's front, normalised. See above. */
  card: string;
  /** How far up the ladder: 0 is the bottom, seen but not yet held. */
  rung: number;
  seen: number;
  wrong: number;
  lastAt: string;
  dueAt: string;
}

/**
 * Days between askings. Chosen to be legible rather than optimal: a student
 * who asks why a card came back after a week can be told "because you got it
 * right twice", which is a better answer than a half-life.
 *
 * The top rung does not retire the card. A card nobody is ever asked again is
 * a card the course has quietly decided the student knows forever, which is
 * a claim no revision system is entitled to make.
 */
export const LADDER = [1, 3, 7, 16, 35, 90];

const DAY = 86_400_000;

/** Whitespace and case are not the card. Punctuation and wording are. */
export function cardKey(front: string): string {
  return front.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * WRONG DROPS TO THE BOTTOM, not down one rung. A card you could not recall
 * after sixteen days is not a card you nearly knew; it is a card you do not
 * know, and pretending otherwise is how a deck fills up with things that are
 * scheduled as held and are not.
 */
export function nextRung(rung: number, knew: boolean): number {
  if (!knew) return 0;
  return Math.min(rung + 1, LADDER.length - 1);
}

export interface Answer {
  knew: boolean;
  at: string;
}

/**
 * What the record becomes after one answer.
 *
 * TWICE IN AN EVENING IS ONCE. A card answered correctly again on the same day
 * it was already answered correctly does not climb: the ladder measures days
 * between recalls, and a student who runs the deck three times before bed has
 * proved they can hold it for an evening, which the schedule already assumed.
 * Getting it wrong always counts, same day or not — a failure is never a
 * repetition artefact.
 */
export function schedule(existing: Recall | undefined, answer: Answer): Pick<Recall, 'rung' | 'seen' | 'wrong' | 'lastAt' | 'dueAt'> {
  const sameDay = existing ? existing.lastAt.slice(0, 10) === answer.at.slice(0, 10) : false;
  const held = answer.knew && sameDay && (existing?.seen ?? 0) > 0 && !wasWrongToday(existing, answer.at);

  const rung = held ? (existing?.rung ?? 0) : nextRung(existing?.rung ?? 0, answer.knew);
  const dueAt = new Date(Date.parse(answer.at) + LADDER[rung] * DAY).toISOString();

  return {
    rung,
    seen: (existing?.seen ?? 0) + 1,
    wrong: (existing?.wrong ?? 0) + (answer.knew ? 0 : 1),
    lastAt: answer.at,
    dueAt,
  };
}

/**
 * A card got wrong today and then got right today climbs from the bottom,
 * rather than being frozen by the same-day rule at the rung it just fell off.
 * Without this, failing a card and immediately correcting it would leave it at
 * rung 0 for a day whatever the student did.
 */
function wasWrongToday(existing: Recall | undefined, at: string): boolean {
  if (!existing) return false;
  return existing.rung === 0 && existing.wrong > 0 && existing.lastAt.slice(0, 10) === at.slice(0, 10);
}

export interface Session<Card> {
  /** Cards whose day has come, oldest due first. */
  due: Card[];
  /** Cards this student has never answered. */
  fresh: Card[];
  /** Answered, held, and not due yet. */
  resting: number;
  /** When the earliest resting card comes back. Absent if none are resting. */
  nextDueAt?: string;
}

/**
 * The evening's deck: what is due, then what is new.
 *
 * DUE BEFORE NEW, because forgetting what you learned last week costs more
 * than meeting a card a day late. And NOTHING DUE IS AN ANSWER — when both
 * lists come back empty the deck says so and offers the date, rather than
 * reshuffling twelve cards the student answered an hour ago so the screen has
 * something on it.
 */
export function session<Card extends { front: string }>(
  cards: Card[], recalls: Recall[], at: string,
): Session<Card> {
  const by = new Map(recalls.map((r) => [r.card, r]));
  const now = Date.parse(at);

  const due: { card: Card; dueAt: string }[] = [];
  const fresh: Card[] = [];
  const resting: string[] = [];

  for (const card of cards) {
    const recall = by.get(cardKey(card.front));
    if (!recall) { fresh.push(card); continue; }
    if (Date.parse(recall.dueAt) <= now) due.push({ card, dueAt: recall.dueAt });
    else resting.push(recall.dueAt);
  }

  due.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  resting.sort();

  return {
    due: due.map((d) => d.card),
    fresh,
    resting: resting.length,
    nextDueAt: resting[0],
  };
}

/** How much of the deck this student is holding, for their own profile. */
export function holding(cards: { front: string }[], recalls: Recall[]): {
  held: number; learning: number; unseen: number;
} {
  const by = new Map(recalls.map((r) => [r.card, r]));
  let held = 0; let learning = 0; let unseen = 0;
  for (const card of cards) {
    const recall = by.get(cardKey(card.front));
    if (!recall) unseen += 1;
    // HELD MEANS A WEEK, not "answered once". Rung 2 is the first interval
    // long enough that getting it right means something beyond short memory.
    else if (recall.rung >= 2) held += 1;
    else learning += 1;
  }
  return { held, learning, unseen };
}
