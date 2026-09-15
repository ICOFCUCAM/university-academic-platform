'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, RotateCw } from 'lucide-react';
import { parseFlashcards, type Flashcard } from '@/lib/study/flashcards';

interface Deck {
  due: Flashcard[];
  fresh: Flashcard[];
  resting: number;
  nextDueAt?: string;
  held: number;
  learning: number;
  unseen: number;
  cards: number;
}

/**
 * ONE SIDE AT A TIME — a card whose answer is already visible teaches nothing —
 * and the deck is the one the schedule chose: what is due, then what is new.
 *
 * When neither has anything in it the deck says so and gives the date. It does
 * not reshuffle twelve cards the student answered an hour ago so that the
 * screen has something on it; "you are up to date" is the honest answer, and
 * the student can still ask for the whole set if they want it.
 */
export function FlashcardDeck({ studyAidId, body, dir }: { studyAidId: string; body: string; dir: 'ltr' | 'rtl' }) {
  const all = useMemo(() => parseFlashcards(body), [body]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [at, setAt] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const [everything, setEverything] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/study?aid=${encodeURIComponent(studyAidId)}`);
      if (!response.ok) throw new Error(String(response.status));
      const { deck: next } = (await response.json()) as { deck: Deck };
      setDeck(next);
      setQueue([...next.due, ...next.fresh]);
    } catch {
      // A schedule that cannot be read is not a reason to withhold the cards.
      setFailed(true);
      setQueue(all);
    }
  }, [studyAidId, all]);

  useEffect(() => { void load(); }, [load]);

  if (!all.length) {
    return <p className="text-sm text-ink-soft">No cards could be read from this set.</p>;
  }
  if (!deck && !failed) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 size={14} className="animate-spin" /> Working out what is due…
      </p>
    );
  }

  const done = at >= queue.length;

  const answer = async (knew: boolean) => {
    const card = queue[at];
    if (knew) setKnewCount((n) => n + 1);
    setShowBack(false);
    // A CARD YOU COULD NOT RECALL COMES BACK BEFORE YOU LEAVE. The schedule
    // says tomorrow; this sitting asks it again at the end, because the point
    // of turning a card over is to have learned it by the time you stop.
    setQueue((q) => (knew ? q : [...q, card]));
    setAt((i) => i + 1);

    if (!failed) {
      try {
        const response = await fetch('/api/study', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'answer-card', studyAidId, front: card.front, knew }),
        });
        if (response.ok) setDeck(((await response.json()) as { deck: Deck }).deck);
      } catch {
        // Losing the schedule for one card is a smaller harm than losing the
        // student's place in the deck, so this fails quietly.
      }
    }
  };

  const goThroughEverything = () => {
    setEverything(true);
    setQueue(all);
    setAt(0);
    setShowBack(false);
  };

  if (done) {
    const when = deck?.nextDueAt
      ? new Date(deck.nextDueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
      : null;
    return (
      <div dir={dir} className="rounded-lg border border-page-line bg-page-card p-8 text-center">
        <p className="font-medium">
          {queue.length ? 'That is this set done for today.' : 'Nothing is due from this set today.'}
        </p>
        {when && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-ink-soft">
            <CalendarClock size={14} /> {deck?.resting} card{deck?.resting === 1 ? '' : 's'} come back on {when}.
          </p>
        )}
        {deck && (
          <p className="mt-3 text-xs text-ink-faint">
            {deck.held} held · {deck.learning} still being learned · {deck.unseen} not yet seen
          </p>
        )}
        {!everything && (
          <button
            type="button"
            onClick={goThroughEverything}
            className="mt-5 rounded border border-page-line px-3.5 py-2 text-xs text-ink-soft hover:border-brand/40"
          >
            Go through all {all.length} anyway
          </button>
        )}
      </div>
    );
  }

  const card = queue[at];

  return (
    <div dir={dir}>
      {!failed && deck && at === 0 && !everything && (
        <p className="mb-3 text-xs text-ink-faint">
          {deck.due.length} due · {deck.fresh.length} new
          {deck.resting ? ` · ${deck.resting} resting` : ''}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowBack((v) => !v)}
        className="flex min-h-[10rem] w-full flex-col items-center justify-center rounded-lg border border-page-line bg-page-card p-8 text-center"
      >
        <p className="text-lg font-medium">{showBack ? card.back : card.front}</p>
        <p className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-faint">
          {/* What the label names is what turning it over will show, which
              reading the screen back makes ambiguous unless it says so. */}
          <RotateCw size={11} /> Turn it over for {showBack ? 'the term' : 'the definition'}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-faint">
          {at + 1} of {queue.length} · {knewCount} you knew
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { void answer(true); }}
            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-ok"
          >
            I knew it
          </button>
          <button
            type="button"
            onClick={() => { void answer(false); }}
            className="rounded border border-page-line px-3 py-1.5 text-xs text-ink-soft"
          >
            Again later
          </button>
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-xs text-ink-faint">
          Your schedule could not be read, so this is the whole set and nothing is being remembered.
        </p>
      )}
    </div>
  );
}
