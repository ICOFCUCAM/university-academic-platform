import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookMarked, Bot, FileText, Headphones, ListChecks, Plus, ScrollText, Search, SlidersHorizontal } from 'lucide-react';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { cohortOn, knowledgeBase, myProgressOn } from '@/lib/service';
import { TodaysLearning } from '@/components/TodaysLearning';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ICON = { structured_notes: FileText, audio_15min: Headphones, corrected_text: ScrollText };

export default async function CoursePage({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  const teaching = course.lecturerIds.includes(actor.id);
  const enrolment = await store.enrolmentFor(course.id, actor.id);
  const student = actor.role === 'student';
  if (student && !enrolment) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty title="Not your course" body="You are not enrolled on this course, so its material is not yours to read." />
      </div>
    );
  }

  const [lectures, artefacts, knowledge, people, enrolments] = await Promise.all([
    store.lectures(course.id), store.artefactsForCourse(course.id),
    knowledgeBase(store, course.id), store.people(), store.enrolments(course.id),
  ]);

  // What this person has done, and — for whoever teaches it — what the cohort
  // has done, in counts and never in names.
  const myWork = await myProgressOn(store, actor, course.id);
  const cohort = teaching ? await cohortOn(store, actor, course.id) : null;
  const lecturers = people.filter((p) => course.lecturerIds.includes(p.id));

  return (
    <div>
      <PageHeader
        eyebrow={`${course.session ?? ''} ${course.code}`.trim()}
        title={course.title}
        subtitle={course.description}
        actions={(
          <>
            <Link
              href={`/courses/${course.id}/search`}
              className="inline-flex items-center gap-2 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
            >
              <Search size={16} /> Search
            </Link>
            <Link
              href={`/courses/${course.id}/work`}
              className="inline-flex items-center gap-2 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
            >
              <BookMarked size={16} /> Reading and work
            </Link>
            <Link
              href={`/courses/${course.id}/study`}
              className="inline-flex items-center gap-2 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
            >
              <ListChecks size={16} /> Revision
            </Link>
            <Link
              href={`/courses/${course.id}/ai`}
              className="inline-flex items-center gap-2 rounded-md border border-brand/30 bg-brand-tint px-3.5 py-2 text-sm font-medium text-brand-dark hover:bg-brand/10"
            >
              <Bot size={16} /> Course AI
            </Link>
            {teaching && (
              <Link
                href={`/courses/${course.id}/settings`}
                className="inline-flex items-center gap-2 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
              >
                <SlidersHorizontal size={16} /> Set up
              </Link>
            )}
            {teaching && (
              <Link
                href={`/courses/${course.id}/new-lecture`}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                <Plus size={16} /> New lecture
              </Link>
            )}
          </>
        )}
      />

      <div className="grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Lectures</h2>
          {lectures.length === 0 ? (
            <Empty title="No lectures yet" body="Upload a recording or paste a transcript and the pipeline starts." />
          ) : lectures.map((lecture) => {
            const mine = artefacts.filter((a) => a.lectureId === lecture.id);
            // A STUDENT SEES WHAT WAS PUBLISHED. A lecturer sees everything,
            // including the three things still sitting in review.
            const visible = student ? mine.filter((a) => a.state === 'published') : mine;
            const published = mine.filter((a) => a.state === 'published');

            if (student && !published.length) return null;

            return (
              <Card key={lecture.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/lectures/${lecture.id}`} className="font-medium hover:text-brand">
                    Lecture {String(lecture.sequence).padStart(2, '0')} — {lecture.title}
                  </Link>
                  {!student && (
                    <span className="text-[11px] text-ink-faint">
                      {published.length} of {mine.length} published
                    </span>
                  )}
                </div>
                {lecture.abstract && <p className="mt-1 text-sm text-ink-soft">{lecture.abstract}</p>}
                {student && (
                  <TodaysLearning
                    courseId={course.id}
                    lectureId={lecture.id}
                    progress={myWork.find((p) => p.lectureId === lecture.id)}
                    language={actor.workingLanguage}
                    has={{
                      notes: published.some((a) => a.kind === 'structured_notes'),
                      audio: published.some((a) => a.kind === 'audio_15min'),
                      revision: published.some((a) => a.kind === 'revision_materials'),
                    }}
                  />
                )}

                {cohort && (() => {
                  const row = cohort.rows.find((r) => r.lectureId === lecture.id);
                  if (!row) return null;
                  const quiet = cohort.neglected.some((n) => n.lectureId === lecture.id);
                  return (
                    <p className={`mt-2 text-xs ${quiet ? 'text-warn' : 'text-ink-faint'}`}>
                      {row.readers} of {cohort.cohortSize} have read it
                      {row.listeners ? ` · ${row.listeners} listened` : ''}
                      {row.quizzesTaken ? ` · ${row.quizzesTaken} sat the quiz` : ''}
                      {row.averageScore !== undefined ? `, averaging ${row.averageScore}%` : ''}
                      {quiet && ' — worth a word in the next class'}
                    </p>
                  );
                })()}

                <div className="mt-3 flex flex-wrap gap-2">
                  {visible.map((a) => {
                    const Icon = ICON[a.kind as keyof typeof ICON] ?? FileText;
                    return (
                      <Link
                        key={a.id}
                        href={`/lectures/${lecture.id}#${a.kind}`}
                        className="inline-flex items-center gap-1.5 rounded border border-page-line px-2 py-1 text-xs text-ink-soft hover:border-brand/40 hover:text-brand-dark"
                      >
                        <Icon size={13} />
                        {a.kind.replace(/_/g, ' ')}
                        {a.state !== 'published' && !student && (
                          <span className="text-[10px] text-ink-faint">· {a.state}</span>
                        )}
                      </Link>
                    );
                  })}
                  {!visible.length && (
                    <span className="text-xs text-ink-faint">Nothing published from this lecture yet.</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold">Course knowledge base</h3>
            <p className="mt-1 text-xs text-ink-soft">
              Built from {knowledge.lecturesIncluded.length} of {lectures.length} lectures. This is
              what the Course AI answers out of.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Concepts</dt>
                <dd className="text-lg font-semibold">{knowledge.nodes.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Defined</dt>
                <dd className="text-lg font-semibold">
                  {knowledge.nodes.filter((n) => n.definition).length}
                </dd>
              </div>
            </dl>

            {!student && knowledge.undefined.length > 0 && (
              <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-warn">Used but never defined</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {knowledge.undefined.map((n) => n.term).join(', ')} — the course leans on{' '}
                  {knowledge.undefined.length === 1 ? 'this' : 'these'} and defines{' '}
                  {knowledge.undefined.length === 1 ? 'it' : 'them'} nowhere.
                </p>
              </div>
            )}

            {!student && knowledge.disagreements.length > 0 && (
              <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs font-medium text-bad">Lectures that disagree</p>
                {knowledge.disagreements.map((d) => (
                  <p key={d.nodeId} className="mt-1 text-xs text-ink-soft">
                    <strong>{d.term}</strong> is defined differently in{' '}
                    {d.readings.map((r) => `Lecture ${String(r.where.lectureSequence).padStart(2, '0')}`).join(' and ')}.
                    Both are kept; neither has been chosen for you.
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold">Taught by</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {lecturers.map((l) => <li key={l.id}>{l.name}</li>)}
            </ul>
            {!student && (
              <p className="mt-3 text-xs text-ink-faint">
                {enrolments.filter((e) => e.status === 'registered').length} students registered.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
