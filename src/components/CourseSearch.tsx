'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import type { Passage } from '@/lib/ai/tutor';
import { Empty } from '@/components/ui';

/**
 * SEARCH, WHICH IS NOT THE COURSE AI.
 *
 * The tutor answers; this finds. Somebody hunting a half-remembered sentence
 * wants the sentence, in the lecture it is in, not a paraphrase of it — and
 * they want it now, without a model call and without the cost of one.
 *
 * The ladder is offered rather than taken: widening to the department or the
 * university is something a person chooses, because a passage from another
 * course is not what they are examined on here.
 */
export function CourseSearch({ courseId, courseCode }: { courseId: string; courseCode: string }) {
  const [query, setQuery] = useState('');
  const [widenTo, setWidenTo] = useState<'course' | 'department' | 'university'>('course');
  const [results, setResults] = useState<Passage[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, query, widenTo }),
      });
      const payload = await response.json();
      setResults(payload.passages ?? []);
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={run} className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="A phrase you half-remember"
          className="min-w-[16rem] flex-1 rounded-md border border-page-line bg-white px-3.5 py-2.5 text-sm"
        />
        <select
          value={widenTo}
          onChange={(event) => setWidenTo(event.target.value as typeof widenTo)}
          className="rounded-md border border-page-line px-2.5 py-2.5 text-xs text-ink-soft"
        >
          <option value="course">This course</option>
          <option value="department">…and the department</option>
          <option value="university">…and the university</option>
        </select>
        <button
          type="submit" disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Find
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {results === null ? null : results.length === 0 ? (
          <Empty
            title="Nothing in the published lectures"
            body={`Nothing in ${courseCode} matches that. Widen the search, or ask the Course AI — it will tell you plainly if the course does not cover it.`}
          />
        ) : results.map((passage, i) => (
          <article key={i} className="rounded-lg border border-page-line bg-page-card px-5 py-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              {passage.courseCode && passage.courseCode !== courseCode && (
                <span className="me-1 rounded bg-amber-100 px-1.5 py-0.5 text-warn">
                  {passage.courseCode} — not this course
                </span>
              )}
              Lecture {String(passage.lectureSequence).padStart(2, '0')} — {passage.lectureTitle}
              {' · '}{passage.artefactKind.replace(/_/g, ' ')}
            </p>
            <p className="mt-1.5 text-sm">{passage.text}</p>
            <Link
              href={`/lectures/${passage.lectureId}`}
              className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
            >
              Open the lecture
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
