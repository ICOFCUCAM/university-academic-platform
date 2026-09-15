'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Loader2, ListChecks, Headphones } from 'lucide-react';
import { QuizRunner } from '@/components/QuizRunner';
import { FlashcardDeck } from '@/components/FlashcardDeck';
import { Markdown } from '@/components/Markdown';
import { Card, Empty } from '@/components/ui';

interface AidView {
  id: string; kind: string; title: string; body: string;
  language: string; unreviewed: boolean; translated: boolean;
}

/**
 * THE REVISION ROOM. Everything here is built from lectures the lecturer
 * published, and asked for in the student's own working language — which means
 * the same quiz the rest of their language's cohort is sitting, not one
 * generated for them alone.
 */
export function StudyRoom({
  courseId, language, dir, lectures, aids,
}: {
  courseId: string;
  language: string;
  dir: 'ltr' | 'rtl';
  lectures: { id: string; sequence: number; title: string }[];
  aids: AidView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(aids[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<number[]>(lectures.map((l) => l.sequence));

  async function make(kind: 'test' | 'flashcards' | 'audio_revision') {
    setBusy(kind); setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/study-aid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind, lectures: range, language,
          questions: kind === 'test' ? 10 : undefined,
          minutes: kind === 'audio_revision' ? 15 : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      setOpen(payload.aid.id);
      router.refresh();
    } finally { setBusy(null); }
  }

  const showing = aids.find((aid) => aid.id === open);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        <Card className="px-4 py-4">
          <h2 className="text-sm font-semibold">Make something</h2>
          <p className="mt-1 text-xs text-ink-soft">
            From the lectures you choose. If somebody on this course has already made it in your
            language, you get theirs — the same questions, not a different paper.
          </p>

          <div className="mt-3 flex flex-wrap gap-1">
            {lectures.map((lecture) => {
              const chosen = range.includes(lecture.sequence);
              return (
                <button
                  key={lecture.id} type="button"
                  onClick={() => setRange((r) => chosen
                    ? r.filter((n) => n !== lecture.sequence)
                    : [...r, lecture.sequence].sort((a, b) => a - b))}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    chosen ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
                  }`}
                  title={lecture.title}
                >
                  {String(lecture.sequence).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 space-y-1.5">
            {([
              ['test', 'A 10-question quiz', ListChecks],
              ['flashcards', 'Flashcards', Layers],
              ['audio_revision', 'A 15-minute audio revision', Headphones],
            ] as const).map(([kind, label, Icon]) => (
              <button
                key={kind} type="button" onClick={() => make(kind)}
                disabled={busy !== null || !range.length}
                className="flex w-full items-center gap-2 rounded border border-page-line bg-white px-3 py-2 text-xs text-ink-soft hover:border-brand/40 disabled:opacity-40"
              >
                {busy === kind ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                {label}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        </Card>

        {aids.length > 0 && (
          <Card className="px-4 py-4">
            <h2 className="text-sm font-semibold">On the shelf</h2>
            <ul className="mt-2 space-y-1">
              {aids.map((aid) => (
                <li key={aid.id}>
                  <button
                    type="button" onClick={() => setOpen(aid.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs ${
                      open === aid.id ? 'bg-brand-tint text-brand-dark' : 'text-ink-soft hover:bg-page'
                    }`}
                  >
                    {aid.title}
                    {aid.unreviewed && <span className="block text-[10px] text-ink-faint">not read by a lecturer</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>

      <div>
        {!showing ? (
          <Empty
            title="Nothing on the shelf yet"
            body="Choose the lectures you are revising and make a quiz, a set of flashcards, or an audio revision."
          />
        ) : showing.kind === 'test' ? (
          <QuizRunner
            studyAidId={showing.id} title={showing.title} body={showing.body}
            unreviewed={showing.unreviewed} dir={dir}
          />
        ) : showing.kind === 'flashcards' ? (
          <Card className="p-6">
            <h2 className="mb-4 font-semibold">{showing.title}</h2>
            <FlashcardDeck studyAidId={showing.id} body={showing.body} dir={dir} />
          </Card>
        ) : (
          <Card className="p-6" dir={dir}>
            <h2 className="mb-2 font-semibold">{showing.title}</h2>
            {showing.kind === 'audio_revision' && (
              <p className="mb-3 text-xs text-ink-faint">
                No speech service is configured, so this revision exists as a script to read.
              </p>
            )}
            <Markdown source={showing.body} />
          </Card>
        )}
      </div>
    </div>
  );
}
