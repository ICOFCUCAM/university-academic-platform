import Link from 'next/link';
import { Mic, Plus } from 'lucide-react';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { STAGES, STAGE_BY_KIND } from '@/lib/pipeline/stages';
import { Card, Empty, PageHeader } from '@/components/ui';
import { RegistryOverview } from '@/components/RegistryOverview';
import type { Artefact, Lecture } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

function pipelineSummary(artefacts: Artefact[]) {
  const made = new Set(artefacts.filter((a) => a.state !== 'absent' && a.state !== 'failed').map((a) => a.kind));
  const published = new Set(artefacts.filter((a) => a.state === 'published').map((a) => a.kind));
  return { made, published };
}

export default async function Dashboard() {
  const actor = await currentActor();
  const store = getStore();
  const courses = await store.coursesFor(actor.id);

  const rows: { lecture: Lecture; artefacts: Artefact[]; courseCode: string }[] = [];
  for (const course of courses) {
    for (const lecture of await store.lectures(course.id)) {
      rows.push({
        lecture,
        artefacts: await store.artefacts(lecture.id),
        courseCode: course.code,
      });
    }
  }
  rows.sort((a, b) => b.lecture.sequence - a.lecture.sequence);

  const student = actor.role === 'student';
  const administration = actor.role === 'registry' || actor.role === 'coordinator';

  if (administration) {
    const [university, faculties, departments, allCourses, people, enrolmentsPerCourse] = await Promise.all([
      store.university(), store.faculties(), store.departments(), store.courses(), store.people(),
      Promise.resolve(null),
    ]);
    const lectures = (await Promise.all(allCourses.map((c) => store.lectures(c.id)))).flat();
    const artefacts = (await Promise.all(allCourses.map((c) => store.artefactsForCourse(c.id)))).flat();
    const enrolments = (await Promise.all(allCourses.map((c) => store.enrolments(c.id)))).flat();
    void enrolmentsPerCourse;

    return (
      <div>
        <PageHeader
          eyebrow={university.name}
          title="Academic delivery"
          subtitle="Faculties, departments, courses and what has reached students. The university holds the environment; the academic material belongs to the lecturers who made it."
        />
        <div className="px-6 py-6 md:px-8">
          <RegistryOverview
            university={university} faculties={faculties} departments={departments}
            courses={allCourses} people={people} lectures={lectures}
            artefacts={artefacts} enrolments={enrolments}
          />
        </div>
      </div>
    );
  }
  const awaitingReview = rows.filter((r) => r.artefacts.some((a) => a.state === 'ready')).length;

  return (
    <div>
      <PageHeader
        eyebrow={student ? 'Your courses' : 'Your teaching'}
        title={student ? `Hello, ${actor.name.split(' ')[0]}` : actor.name}
        subtitle={student
          ? 'Everything your lecturers have published: notes to read, lessons to listen to, and a Course AI that answers out of your own lectures.'
          : 'Upload a lecture and it becomes a corrected text, structured notes, a teaching script, an audio lesson and revision material — each waiting for you to approve it.'}
        actions={!student && courses.length > 0 && (
          <Link
            href={`/courses/${courses[0].id}/new-lecture`}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            <Plus size={16} /> New lecture
          </Link>
        )}
      />

      <div className="px-6 py-6 md:px-8 space-y-6">
        {!student && awaitingReview > 0 && (
          <Card className="border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-warn">
              {awaitingReview} {awaitingReview === 1 ? 'lecture has' : 'lectures have'} material waiting for your review.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Nothing reaches your students until you have read it and published it under your name.
            </p>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            {student ? 'Enrolled courses' : 'Courses'}
          </h2>
          {courses.length === 0 ? (
            <Empty
              title="No courses yet"
              body={student
                ? 'When you are enrolled on a course, its lectures and its Course AI appear here.'
                : 'A course is opened by the university. Once you are assigned to one, it appears here.'}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`}>
                  <Card className="h-full px-5 py-4 transition hover:border-brand/40 hover:shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-brand">{course.code}</p>
                    <p className="mt-0.5 font-medium">{course.title}</p>
                    <p className="mt-2 text-xs text-ink-faint">
                      {rows.filter((r) => r.courseCode === course.code).length} lectures
                      {course.session ? ` · ${course.session}` : ''}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Recent lectures
          </h2>
          {rows.length === 0 ? (
            <Empty title="Nothing here yet" body="Lectures appear as they are uploaded and processed." />
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 8).map(({ lecture, artefacts, courseCode }) => {
                const { made, published } = pipelineSummary(artefacts);
                const visible = STAGES.filter((s) => s.kind !== 'recording');
                return (
                  <Link key={lecture.id} href={`/lectures/${lecture.id}`}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:border-brand/40">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                          {courseCode} · Lecture {String(lecture.sequence).padStart(2, '0')}
                          {lecture.sourceMinutes ? ` · ${lecture.sourceMinutes} min` : ''}
                        </p>
                        <p className="font-medium">{lecture.title}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {visible.map((stage) => (
                          <span
                            key={stage.kind}
                            title={stage.label}
                            className={`rounded px-2 py-0.5 text-[11px] ${
                              published.has(stage.kind) ? 'bg-emerald-600 text-white'
                                : made.has(stage.kind) ? 'bg-brand-tint text-brand-dark'
                                  : 'bg-page text-ink-faint'
                            }`}
                          >
                            {stage.label.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {!student && (
          <Card className="px-5 py-4">
            <div className="flex items-start gap-3">
              <Mic size={18} className="mt-0.5 text-ink-faint" />
              <div>
                <p className="text-sm font-medium">The pipeline, once</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {STAGES.map((s) => s.label).join(' → ')}. Each stage is its own artefact, each is
                  yours to correct, and everything below a correction is regenerated from it.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
