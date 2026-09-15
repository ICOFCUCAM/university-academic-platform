'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, SpellCheck } from 'lucide-react';

interface Flagged {
  word: string;
  contexts: string[];
  occurrences: number;
  reason: 'near-a-course-term' | 'unknown-word' | 'said-once';
  suggestion?: string;
}

const REASON: Record<Flagged['reason'], string> = {
  'near-a-course-term': 'One or two letters from a term this course teaches',
  'said-once': 'Said once, and not a word this system knows',
  'unknown-word': 'Not a word this system knows',
};

/**
 * THE PROOFREADING PANE, BEFORE ANYTHING IS SPOKEN.
 *
 * Every word the system could not place, in its own sentence, with the
 * course's own vocabulary offered where it is one slip away. Accept it — it is
 * the lecturer's word and the system simply did not know it — or replace it.
 *
 * The machine flags; the person decides. It cannot decide for itself without
 * risking the one thing this platform refuses to do, which is to change the
 * lecturer's terminology.
 */
export function WordCheck({
  artefactId, onDone,
}: {
  artefactId: string;
  onDone: () => void;
}) {
  const [words, setWords] = useState<Flagged[] | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/artefacts/${artefactId}/words`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) setError(payload.error);
        else setWords(payload.words);
      });
  }, [artefactId]);

  async function save() {
    if (!words) return;
    setBusy(true); setError(null);
    try {
      const decisions = words.map((w) => {
        const replacement = (choices[w.word] ?? '').trim();
        return replacement && replacement.toLowerCase() !== w.word.toLowerCase()
          ? { word: w.word, action: 'replaced' as const, replacement }
          : { word: w.word, action: 'accepted' as const };
      });
      const response = await fetch(`/api/artefacts/${artefactId}/words`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisions }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      onDone();
    } finally { setBusy(false); }
  }

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-bad">{error}</div>;
  }

  if (!words) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-faint">
        <Loader2 size={14} className="animate-spin" /> Reading the script…
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-page-line bg-page-card p-5">
      <div className="flex items-start gap-2">
        <SpellCheck size={18} className="mt-0.5 text-brand" />
        <div>
          <h3 className="text-sm font-semibold">Check the words before this is spoken</h3>
          <p className="mt-1 text-sm text-ink-soft">
            A mis-heard word in a text is a typo a reader shrugs at. Spoken aloud it is a confident
            voice saying something that was never taught, to somebody who cannot see that it is wrong.
          </p>
        </div>
      </div>

      {words.length === 0 ? (
        <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-ok">
          Nothing to query — every word in this script is either common English, one of your own
          terms, or something this course already teaches.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {words.map((word) => (
            <li key={word.word} className="rounded border border-page-line px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  <mark className="bg-amber-100 px-1">{word.word}</mark>
                  <span className="ml-2 text-xs font-normal text-ink-faint">
                    {word.occurrences === 1 ? 'once' : `${word.occurrences} times`}
                  </span>
                </p>
                <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-warn">
                  <AlertTriangle size={12} /> {REASON[word.reason]}
                </p>
              </div>

              {word.contexts.slice(0, 2).map((context, i) => (
                <p key={i} className="mt-1 text-xs italic text-ink-soft">“{context}”</p>
              ))}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {word.suggestion && (
                  <button
                    type="button"
                    onClick={() => setChoices((c) => ({ ...c, [word.word]: word.suggestion! }))}
                    className="rounded border border-brand/40 bg-brand-tint px-2 py-1 text-xs text-brand-dark"
                  >
                    Did you mean “{word.suggestion}”?
                  </button>
                )}
                <input
                  value={choices[word.word] ?? ''}
                  onChange={(e) => setChoices((c) => ({ ...c, [word.word]: e.target.value }))}
                  placeholder="Replace with…"
                  className="w-52 rounded border border-page-line px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setChoices((c) => ({ ...c, [word.word]: '' }))}
                  className={`rounded border px-2 py-1 text-xs ${
                    (choices[word.word] ?? '') === ''
                      ? 'border-emerald-300 bg-emerald-50 text-ok'
                      : 'border-page-line text-ink-soft'
                  }`}
                >
                  Keep it — it’s my word
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button" onClick={save} disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {words.length === 0 ? 'Confirm and open the audio stage' : 'Apply and open the audio stage'}
      </button>
    </div>
  );
}
