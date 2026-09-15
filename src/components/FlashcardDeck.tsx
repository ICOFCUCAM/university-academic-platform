'use client';

import { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { parseFlashcards } from '@/lib/study/flashcards';

/** One side at a time: a card whose answer is already visible teaches nothing. */
export function FlashcardDeck({ body, dir }: { body: string; dir: 'ltr' | 'rtl' }) {
  const cards = useMemo(() => parseFlashcards(body), [body]);
  const [at, setAt] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [knew, setKnew] = useState<Record<number, boolean>>({});

  if (!cards.length) {
    return <p className="text-sm text-ink-soft">No cards could be read from this set.</p>;
  }

  const card = cards[at % cards.length];
  const move = (by: number) => { setAt((i) => (i + by + cards.length) % cards.length); setShowBack(false); };
  const knewCount = Object.values(knew).filter(Boolean).length;

  return (
    <div dir={dir}>
      <button
        type="button"
        onClick={() => setShowBack((v) => !v)}
        className="flex min-h-[10rem] w-full flex-col items-center justify-center rounded-lg border border-page-line bg-page-card p-8 text-center"
      >
        <p className="text-lg font-medium">{showBack ? card.back : card.front}</p>
        <p className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-faint">
          <RotateCw size={11} /> {showBack ? 'the term' : 'the definition'}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} className="rounded border border-page-line px-3 py-1.5 text-xs">Back</button>
          <button type="button" onClick={() => move(1)} className="rounded border border-page-line px-3 py-1.5 text-xs">Next</button>
        </div>
        <p className="text-xs text-ink-faint">
          {(at % cards.length) + 1} of {cards.length} · {knewCount} you knew
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setKnew((k) => ({ ...k, [at]: true })); move(1); }}
            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-ok"
          >
            I knew it
          </button>
          <button
            type="button"
            onClick={() => { setKnew((k) => ({ ...k, [at]: false })); move(1); }}
            className="rounded border border-page-line px-3 py-1.5 text-xs text-ink-soft"
          >
            Again later
          </button>
        </div>
      </div>
    </div>
  );
}
