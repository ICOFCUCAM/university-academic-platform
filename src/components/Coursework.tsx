'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookMarked, Loader2, Send } from 'lucide-react';
import type { Assignment, Reading, Submission } from '@/lib/domain/types';
import { Card, Empty } from '@/components/ui';

/**
 * READING AND WORK.
 *
 * The one thing this screen never shows is a suggested mark. A lecturer marks
 * with their own number and their own words, and the student sees both —
 * because a mark a lecturer merely agreed to is a mark a model gave, and the
 * student would have no way of telling which it was.
 */
export function Coursework({
  courseId, teaching, readings, assignments, submissions, lectures, people, me,
}: {
  courseId: string;
  teaching: boolean;
  readings: Reading[];
  assignments: Assignment[];
  submissions: { assignmentId: string; list: Submission[] }[];
  lectures: { id: string; sequence: number; title: string }[];
  people: { id: string; name: string }[];
  me: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [marking, setMarking] = useState<Record<string, { mark?: string; feedback: string }>>({});

  async function send(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/coursework', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return false; }
      router.refresh();
      return true;
    } finally { setBusy(false); }
  }

  const lectureLabel = (id?: string) => {
    const lecture = lectures.find((l) => l.id === id);
    return lecture ? `Lecture ${String(lecture.sequence).padStart(2, '0')}` : 'The course';
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {error && <p className="lg:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Reading</h2>
        {readings.length === 0 ? (
          <Empty title="Nothing set yet" body="Reading your lecturer sets appears here, in their own words." />
        ) : readings.map((reading) => (
          <Card key={reading.id} className="px-5 py-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              {lectureLabel(reading.lectureId)} · {reading.kind}
              {reading.required ? ' · essential' : ' · if you have time'}
              {teaching && !reading.published ? ' · not published' : ''}
            </p>
            <p className="mt-1 flex items-start gap-2 font-medium">
              <BookMarked size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              {reading.url
                ? <a href={reading.url} className="text-brand hover:underline" target="_blank" rel="noreferrer">{reading.citation}</a>
                : reading.citation}
            </p>
            {reading.note && <p className="mt-1 text-sm text-ink-soft">{reading.note}</p>}
            {teaching && !reading.published && (
              <button
                type="button" disabled={busy}
                onClick={() => send({ ...reading, action: 'set-reading', courseId, published: true })}
                className="mt-2 rounded border border-page-line px-2.5 py-1 text-xs text-ink-soft"
              >
                Publish to the cohort
              </button>
            )}
          </Card>
        ))}

        {teaching && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-medium">Add a reading</h3>
            <form
              className="mt-2 space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const ok = await send({
                  action: 'set-reading', courseId,
                  kind: form.get('kind'), citation: form.get('citation'),
                  url: form.get('url') || undefined, note: form.get('note') || undefined,
                  required: form.get('required') === 'on', published: true,
                });
                if (ok) (event.target as HTMLFormElement).reset();
              }}
            >
              <input name="citation" required placeholder="The citation, as you would write it"
                className="w-full rounded border border-page-line px-3 py-2 text-sm" />
              <input name="url" placeholder="A link, if there is one"
                className="w-full rounded border border-page-line px-3 py-2 text-sm" />
              <input name="note" placeholder="Why you set it"
                className="w-full rounded border border-page-line px-3 py-2 text-sm" />
              <div className="flex items-center gap-3">
                <select name="kind" className="rounded border border-page-line px-2 py-1.5 text-sm">
                  <option value="chapter">Chapter</option>
                  <option value="book">Book</option>
                  <option value="article">Article</option>
                  <option value="link">Link</option>
                  <option value="document">Document</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <input type="checkbox" name="required" defaultChecked /> Essential
                </label>
                <button type="submit" disabled={busy}
                  className="ms-auto rounded bg-brand px-3 py-1.5 text-xs font-medium text-white">
                  Add
                </button>
              </div>
            </form>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Assignments</h2>
        {assignments.length === 0 ? (
          <Empty title="Nothing set yet" body="Work your lecturer sets appears here." />
        ) : assignments.map((assignment) => {
          const list = submissions.find((s) => s.assignmentId === assignment.id)?.list ?? [];
          const mine = list.find((s) => s.studentId === me);
          return (
            <Card key={assignment.id} className="px-5 py-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                {lectureLabel(assignment.lectureId)}
                {assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleDateString()}` : ''}
                {assignment.marksOutOf ? ` · out of ${assignment.marksOutOf}` : ''}
                {teaching && !assignment.published ? ' · not set yet' : ''}
              </p>
              <p className="mt-0.5 font-medium">{assignment.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{assignment.brief}</p>

              {teaching ? (
                <div className="mt-3 space-y-2">
                  {!assignment.published && (
                    <button type="button" disabled={busy}
                      onClick={() => send({ ...assignment, action: 'set-assignment', courseId, published: true })}
                      className="rounded border border-page-line px-2.5 py-1 text-xs text-ink-soft">
                      Set it
                    </button>
                  )}
                  <p className="text-xs text-ink-faint">{list.length} handed in</p>
                  {list.map((submission) => {
                    const who = people.find((p) => p.id === submission.studentId)?.name ?? 'A student';
                    const state = marking[submission.id] ?? { feedback: submission.feedback ?? '' };
                    return (
                      <div key={submission.id} className="rounded border border-page-line px-3 py-2">
                        <p className="text-xs font-medium">
                          {who}
                          {submission.late ? ' · late' : ''}
                          {submission.markedAt ? ` · marked${submission.returnedAt ? ' and returned' : ', not returned'}` : ''}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{submission.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="number" placeholder="Mark" defaultValue={submission.mark}
                            className="w-20 rounded border border-page-line px-2 py-1 text-xs"
                            onChange={(e) => setMarking((m) => ({ ...m, [submission.id]: { ...state, mark: e.target.value } }))}
                          />
                          <input
                            placeholder="Your feedback — a mark with no words teaches nobody"
                            defaultValue={submission.feedback}
                            className="min-w-[16rem] flex-1 rounded border border-page-line px-2 py-1 text-xs"
                            onChange={(e) => setMarking((m) => ({ ...m, [submission.id]: { ...state, feedback: e.target.value } }))}
                          />
                          <button
                            type="button" disabled={busy}
                            onClick={() => send({
                              action: 'mark', submissionId: submission.id,
                              mark: state.mark ? Number(state.mark) : undefined,
                              feedback: state.feedback,
                            })}
                            className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Mark
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {list.some((s) => s.markedAt && !s.returnedAt) && (
                    <button
                      type="button" disabled={busy}
                      onClick={() => send({ action: 'return', assignmentId: assignment.id })}
                      className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-ok"
                    >
                      Return the marked work to the cohort
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  {mine?.returnedAt && (
                    <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                      <p className="font-medium text-ok">
                        {mine.mark !== undefined ? `${mine.mark}${assignment.marksOutOf ? ` / ${assignment.marksOutOf}` : ''}` : 'Marked'}
                        {mine.markedByName ? ` — ${mine.markedByName}` : ''}
                      </p>
                      <p className="mt-1 text-ink-soft">{mine.feedback}</p>
                    </div>
                  )}
                  <textarea
                    rows={4}
                    defaultValue={mine?.body}
                    disabled={!!mine?.markedAt}
                    onChange={(e) => setDraft((d) => ({ ...d, [assignment.id]: e.target.value }))}
                    placeholder="Your answer"
                    className="w-full rounded border border-page-line px-3 py-2 text-sm"
                  />
                  {!mine?.markedAt && (
                    <button
                      type="button" disabled={busy}
                      onClick={() => send({
                        action: 'submit', assignmentId: assignment.id,
                        body: draft[assignment.id] ?? mine?.body ?? '',
                      })}
                      className="mt-2 inline-flex items-center gap-1.5 rounded bg-brand px-3.5 py-2 text-sm font-medium text-white"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {mine ? 'Hand it in again' : 'Hand it in'}
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {teaching && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-medium">Set work</h3>
            <form
              className="mt-2 space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const ok = await send({
                  action: 'set-assignment', courseId,
                  title: form.get('title'), brief: form.get('brief'),
                  marksOutOf: form.get('marksOutOf') ? Number(form.get('marksOutOf')) : undefined,
                  dueAt: form.get('dueAt') ? new Date(String(form.get('dueAt'))).toISOString() : undefined,
                  published: true,
                });
                if (ok) (event.target as HTMLFormElement).reset();
              }}
            >
              <input name="title" required placeholder="Title"
                className="w-full rounded border border-page-line px-3 py-2 text-sm" />
              <textarea name="brief" required rows={3} placeholder="The brief, in your words"
                className="w-full rounded border border-page-line px-3 py-2 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <input name="marksOutOf" type="number" placeholder="Out of"
                  className="w-24 rounded border border-page-line px-2 py-1.5 text-sm" />
                <input name="dueAt" type="date"
                  className="rounded border border-page-line px-2 py-1.5 text-sm" />
                <button type="submit" disabled={busy}
                  className="ms-auto rounded bg-brand px-3 py-1.5 text-xs font-medium text-white">
                  Set it
                </button>
              </div>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}
