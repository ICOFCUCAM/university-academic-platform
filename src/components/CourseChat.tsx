'use client';

import { useRef, useState } from 'react';
import { Bot, CornerDownLeft, Globe, Loader2 } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { direction, LANGUAGES, LANGUAGE_BY_CODE } from '@/lib/i18n/languages';

export interface Turn {
  role: 'student' | 'tutor';
  body: string;
  citations?: { lectureSequence: number; lectureTitle: string; artefactKind: string; quote: string }[];
  producedBy?: string;
  answeredIn?: 'this-lecture' | 'course';
  outsideCourse?: boolean;
  refused?: boolean;
  title?: string;
  audience?: 'course' | 'private';
}

/**
 * The Course AI, as a conversation. What makes it worth having is entirely in
 * what it will NOT do: it answers out of this course's published lectures, it
 * shows which lecture every answer came from, and when the course does not
 * cover something it says so rather than reaching for general knowledge.
 */
export function CourseChat({
  courseId, lectureSequence, suggestions, followUps = [], compact = false,
  courseLanguage = 'en', offeredLanguages = [],
}: {
  courseId: string;
  lectureSequence?: number;
  /** The language the course is taught in. Its answers are grounded there. */
  courseLanguage?: string;
  offeredLanguages?: string[];
  /** Shown before the first question: each has to stand on its own. */
  suggestions: string[];
  /**
   * Shown after an answer. "Give me a simple explanation" and "which lecture
   * introduced this?" refer to what is already on the screen, so offering
   * them cold produces a question with no subject.
   */
  followUps?: string[];
  compact?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState(courseLanguage);
  const box = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setTurns((t) => [...t, { role: 'student', body: text }]);
    setQuestion('');
    setBusy(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text, lectureSequence, language }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setTurns((t) => [...t, { role: 'tutor', body: payload.error, refused: true }]);
        return;
      }
      const a = payload.answer;
      setTurns((t) => [...t, {
        role: 'tutor',
        body: a.body,
        citations: a.citations,
        producedBy: a.producedBy,
        answeredIn: a.answeredIn,
        outsideCourse: a.outsideCourse,
        refused: !!a.refusedReason,
        title: a.title,
        audience: a.audience,
      }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight }));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={box} className={`flex-1 space-y-4 overflow-y-auto ${compact ? 'max-h-96' : ''}`}>
        {turns.length === 0 && (
          <div className="rounded-lg border border-page-line bg-page-card px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot size={16} className="text-brand" />
              {lectureSequence ? 'Ask about this lecture' : 'Ask this course'}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {lectureSequence
                ? 'Answered from this lecture first. If it is covered elsewhere on the course, I will say which lecture.'
                : 'Answered from this course’s published lectures. If the course does not cover it, I will say so rather than guess.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s} type="button" onClick={() => ask(s)}
                  className="rounded-full border border-page-line bg-white px-3 py-1.5 text-xs text-ink-soft hover:border-brand/40 hover:text-brand-dark"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          turn.role === 'student' ? (
            <p key={i} className="ml-auto max-w-[80%] rounded-lg bg-brand px-4 py-2.5 text-sm text-white">
              {turn.body}
            </p>
          ) : (
            <div
              key={i}
              className={`max-w-[95%] rounded-lg border px-5 py-4 ${
                turn.outsideCourse ? 'border-dashed border-ink-faint bg-white'
                  : turn.refused ? 'border-amber-200 bg-amber-50'
                    : 'border-page-line bg-page-card'
              }`}
            >
              {/* THE TWO KNOWLEDGE SOURCES ARE NEVER MIXED ON A PAGE. A
                  student revising a week later must be able to tell which
                  half their lecturer actually taught — they are examined on
                  one of the two. */}
              {turn.outsideCourse && (
                <div className="mb-3 rounded border border-ink-faint/40 bg-page px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    AI explanation — outside your course
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    You asked for information beyond this course. This is general knowledge, not
                    your lecturer’s teaching, and you are not examined on it.
                  </p>
                </div>
              )}
              {turn.title && (
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">
                  {turn.title}
                  {turn.audience === 'private' && ' · generated for you, not reviewed by your lecturer'}
                </p>
              )}
              {turn.answeredIn === 'this-lecture' && (
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ok">From this lecture</p>
              )}
              <div dir={direction(language)}>
                <Markdown source={turn.body} />
              </div>

              {turn.citations && turn.citations.length > 0 && (
                <div className="mt-3 border-t border-page-line pt-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">From your lectures</p>
                  <ul className="mt-1 space-y-1">
                    {[...new Map(turn.citations.map((c) => [c.lectureSequence, c])).values()].map((c) => (
                      <li key={c.lectureSequence} className="text-xs text-ink-soft">
                        Lecture {String(c.lectureSequence).padStart(2, '0')} — {c.lectureTitle}
                        <span className="text-ink-faint"> · {c.artefactKind.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        ))}

        {turns.length > 0 && !busy && followUps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {followUps.map((s) => (
              <button
                key={s} type="button" onClick={() => ask(s)}
                className="rounded-full border border-page-line bg-white px-3 py-1.5 text-xs text-ink-soft hover:border-brand/40 hover:text-brand-dark"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-ink-faint">
            <Loader2 size={14} className="animate-spin" /> Reading the course material…
          </p>
        )}
      </div>

      {/* THE COURSE IS TAUGHT IN ONE LANGUAGE AND ANSWERED IN THE STUDENT'S.
          The corpus is not translated to answer a question — the tutor reads
          the lecturer's original and quotes it beside its rendering, because
          the original sentence is the one the student is examined on. */}
      {[courseLanguage, ...offeredLanguages].length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Globe size={14} className="text-ink-faint" />
          {[...new Set([courseLanguage, ...offeredLanguages, ...LANGUAGES.map((l) => l.code)])]
            .filter((code) => [courseLanguage, ...offeredLanguages].includes(code))
            .map((code) => (
              <button
                key={code} type="button" onClick={() => setLanguage(code)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  language === code ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
                }`}
              >
                {LANGUAGE_BY_CODE[code]?.endonym ?? code}
                {code === courseLanguage && (
                  <span className={`ml-1 text-[10px] uppercase ${language === code ? 'text-white/70' : 'text-ink-faint'}`}>
                    taught in
                  </span>
                )}
              </button>
            ))}
        </div>
      )}

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => { event.preventDefault(); ask(question); }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={lectureSequence ? 'Ask about this lecture…' : 'Ask about this course…'}
          dir={direction(language)}
          className="flex-1 rounded-md border border-page-line bg-white px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit" disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <CornerDownLeft size={15} /> Ask
        </button>
      </form>
    </div>
  );
}
