'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { mark, parseQuiz, type Marked } from '@/lib/study/quiz';
import { Markdown } from '@/components/Markdown';

/**
 * SITTING A QUIZ, AS OPPOSED TO READING ONE.
 *
 * The answers are held back until the student has committed. Multiple choice
 * is marked; a written answer is shown beside the lecturer's answer for the
 * student to judge, because "the thylakoid membrane" and "in the thylakoid"
 * are the same answer and a machine that scored one of them wrong would teach
 * a student they had misunderstood their lecture.
 */
export function QuizRunner({
  studyAidId, title, body, unreviewed, dir,
}: {
  studyAidId: string;
  title: string;
  body: string;
  unreviewed: boolean;
  dir: 'ltr' | 'rtl';
}) {
  const quiz = useMemo(() => parseQuiz(body), [body]);
  const [given, setGiven] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ marked: Marked[]; score: number; outOf: number } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!quiz.questions.length) {
    return (
      <div className="rounded-lg border border-page-line bg-page-card p-6">
        <p className="text-sm text-ink-soft">
          This one could not be read as questions, so here it is as written.
        </p>
        <div className="mt-3"><Markdown source={body} /></div>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch('/api/study', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sit-quiz', studyAidId, given }),
      });
      const payload = await response.json();
      setResult(payload.marked ?? mark(quiz, given));
    } catch {
      // Marked locally if the round trip fails: a student mid-revision should
      // not lose their answers to a network blip.
      setResult(mark(quiz, given));
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-page-line bg-page-card p-6" dir={dir}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {result && result.outOf > 0 && (
          <p className="text-sm font-medium">
            {result.score} / {result.outOf} marked automatically
          </p>
        )}
      </div>
      {unreviewed && (
        <p className="mt-1 text-xs text-warn">
          Built from your published lectures. No academic has read it.
        </p>
      )}

      <ol className="mt-4 space-y-5">
        {quiz.questions.map((question) => {
          const marking = result?.marked.find((m) => m.n === question.n);
          return (
            <li key={question.n}>
              <p className="font-medium">
                {question.n}. {question.prompt}
              </p>

              {question.options.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {question.options.map((option) => {
                    const chosen = given[question.n] === option.label;
                    const isAnswer = result && question.answer === option.label;
                    return (
                      <li key={option.label}>
                        <label className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                          isAnswer ? 'border-emerald-300 bg-emerald-50'
                            : chosen && marking?.right === false ? 'border-red-300 bg-red-50'
                              : chosen ? 'border-brand bg-brand-tint' : 'border-page-line'
                        }`}>
                          <input
                            type="radio" name={`q${question.n}`} className="mt-1"
                            disabled={!!result}
                            checked={chosen}
                            onChange={() => setGiven((g) => ({ ...g, [question.n]: option.label }))}
                          />
                          <span><strong>{option.label}.</strong> {option.text}</span>
                          {isAnswer && <Check size={14} className="ms-auto mt-0.5 shrink-0 text-ok" />}
                          {chosen && marking?.right === false && <X size={14} className="ms-auto mt-0.5 shrink-0 text-bad" />}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <textarea
                  className="mt-2 w-full rounded border border-page-line px-3 py-2 text-sm"
                  rows={2}
                  disabled={!!result}
                  value={given[question.n] ?? ''}
                  onChange={(event) => setGiven((g) => ({ ...g, [question.n]: event.target.value }))}
                  placeholder="Your answer"
                />
              )}

              {result && question.answer && (
                <div className="mt-2 rounded border border-page-line bg-page px-3 py-2 text-sm">
                  <p><strong>Answer:</strong> {question.answer}</p>
                  {question.explanation && <p className="mt-0.5 text-ink-soft">{question.explanation}</p>}
                  {marking?.right === null && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Written answers are not machine-marked — compare yours with the lecturer’s.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <button
          type="button" onClick={submit} disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Submit answers
        </button>
      )}

      {quiz.remainder && (
        <details className="mt-4 text-xs text-ink-faint">
          <summary>Part of this quiz could not be read as questions</summary>
          <pre className="mt-2 whitespace-pre-wrap">{quiz.remainder}</pre>
        </details>
      )}
    </div>
  );
}
