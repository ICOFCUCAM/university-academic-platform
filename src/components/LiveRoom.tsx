'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Circle, Loader2, Radio, ShieldAlert, Square } from 'lucide-react';
import { LANGUAGE_BY_CODE, direction } from '@/lib/i18n/languages';
import { Card } from '@/components/ui';

interface HeardLine {
  sequence: number;
  language: string;
  source: 'carried' | 'floor' | 'silence' | 'notice';
  text?: string;
  because?: string;
}

/**
 * THE ROOM.
 *
 * A lecturer speaks; everybody hears it in their own working language, and
 * nobody chooses a language during a lecture because their account already
 * said. What this screen is careful about is the failures: a passage whose
 * translation was withheld is shown as withheld, in words, rather than as a
 * gap the student reads as a broken platform.
 *
 * It also never lets a stand-in pass for a translator. When no live service is
 * configured the banner says so, and it says so to the student too.
 */
export function LiveRoom({
  courseId, session, teaching, engine,
}: {
  courseId: string;
  session: { id: string; title: string; floorLanguage: string; languages: string[]; state: string; fallback: string } | null;
  teaching: boolean;
  engine: { translator: string; speaker: string; live: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const [heard, setHeard] = useState<HeardLine[]>([]);
  const [language, setLanguage] = useState<string>(session?.floorLanguage ?? 'en');
  const [carriedByThePlatform, setCarried] = useState(false);

  const follow = useCallback(async () => {
    if (!session || session.state !== 'running') return;
    try {
      const response = await fetch(`/api/courses/${courseId}/live?session=${session.id}`);
      if (!response.ok) return;
      const payload = await response.json();
      setHeard(payload.heard ?? []);
      setLanguage(payload.language);
      setCarried(payload.carriedByThePlatform);
    } catch { /* the room is best-effort; a missed poll is the next poll */ }
  }, [courseId, session]);

  useEffect(() => {
    void follow();
    const timer = setInterval(() => { void follow(); }, 3000);
    return () => clearInterval(timer);
  }, [follow]);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/live`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return null; }
      return payload;
    } finally { setBusy(false); }
  }

  if (!session || session.state !== 'running') {
    return (
      <Card className="px-5 py-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Radio size={16} className="text-brand" /> No lecture is being given
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          When one is, it appears here in your working language. Nothing said in a live room is
          published: the recording goes through the ordinary pipeline afterwards, and what you
          revise from is still what your lecturer approved.
        </p>
        {teaching && (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const opened = await post({ action: 'open', title: form.get('title') });
              if (opened) router.refresh();
            }}
          >
            <input
              name="title" required placeholder="What this lecture is called"
              className="min-w-[18rem] flex-1 rounded-md border border-page-line px-3 py-2 text-sm"
            />
            <button
              type="submit" disabled={busy}
              className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Begin the lecture
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!engine.live && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-ink-soft">
          <span className="font-semibold uppercase tracking-wide text-warn">Not a translation</span>
          {' — no live translation service is configured, so nothing below was translated by one. '}
          It is the rehearsal stand-in, and it is marked as such so nobody mistakes it for a
          lecture in another language.
        </div>
      )}

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Circle size={10} className="fill-red-500 text-red-500" /> {session.title}
          </h2>
          <p className="text-xs text-ink-faint">
            Floor: {LANGUAGE_BY_CODE[session.floorLanguage]?.name ?? session.floorLanguage}
            {session.languages.length > 0 && ` · carried into ${session.languages
              .map((code) => LANGUAGE_BY_CODE[code]?.name ?? code).join(', ')}`}
          </p>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {carriedByThePlatform
            ? `You are hearing this in ${LANGUAGE_BY_CODE[language]?.endonym ?? language}, because that is your working language.`
            : 'You are hearing the lecture as it is being given.'}
        </p>
      </Card>

      {teaching && (
        <Card className="px-5 py-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!said.trim()) return;
              await post({ action: 'say', sessionId: session.id, heard: said, seconds: Math.max(2, said.split(/\s+/).length / 2.5) });
              setSaid('');
              void follow();
            }}
          >
            <input
              value={said} onChange={(e) => setSaid(e.target.value)}
              placeholder="What you just said — until a streaming transcriber is wired, this stands in for the microphone"
              className="min-w-[20rem] flex-1 rounded-md border border-page-line px-3 py-2 text-sm"
            />
            <button
              type="submit" disabled={busy}
              className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : 'Carry it'}
            </button>
            <button
              type="button" disabled={busy}
              onClick={async () => { await post({ action: 'close', sessionId: session.id }); router.refresh(); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft"
            >
              <Square size={13} /> End the lecture
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        </Card>
      )}

      <Card className="px-5 py-4" dir={direction(language)}>
        {heard.length === 0 ? (
          <p className="text-sm text-ink-faint">Nothing has been said yet.</p>
        ) : (
          <ol className="space-y-3">
            {heard.map((line) => (
              <li key={line.sequence} className="text-sm">
                {line.source === 'carried' && <span>{line.text}</span>}

                {/* A WITHHELD PASSAGE IS SHOWN AS WITHHELD. The student hears
                    the lecturer's own words for that stretch and is told why,
                    because a gap nobody explains reads as a broken platform. */}
                {line.source === 'floor' && (
                  <span>
                    <span className="text-ink-soft">{line.text}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-warn">
                      <ShieldAlert size={12} /> {line.because}
                    </span>
                  </span>
                )}

                {(line.source === 'silence' || line.source === 'notice') && (
                  <span className="flex items-center gap-1.5 text-[11px] text-warn">
                    <ShieldAlert size={12} /> {line.because}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
