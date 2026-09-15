import Link from 'next/link';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { Card, Empty, PageHeader, StateBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Lectures() {
  const actor = await currentActor();
  const store = getStore();
  const courses = await store.coursesFor(actor.id);
  const student = actor.role === 'student';

  const rows = [];
  for (const course of courses) {
    for (const lecture of await store.lectures(course.id)) {
      const artefacts = await store.artefacts(lecture.id);
      const shown = student ? artefacts.filter((a) => a.state === 'published') : artefacts;
      if (student && !shown.length) continue;
      rows.push({ course, lecture, artefacts: shown });
    }
  }

  return (
    <div>
      <PageHeader
        title="Lectures"
        subtitle={student
          ? 'Everything your lecturers have published, lecture by lecture.'
          : 'Every lecture you have uploaded, and where each one has got to.'}
      />
      <div className="px-6 py-6 md:px-8 space-y-2">
        {rows.length === 0
          ? <Empty title="No lectures" body="They appear here once a lecture has been uploaded." />
          : rows.map(({ course, lecture, artefacts }) => (
            <Link key={lecture.id} href={`/lectures/${lecture.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:border-brand/40">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                    {course.code} · Lecture {String(lecture.sequence).padStart(2, '0')}
                  </p>
                  <p className="font-medium">{lecture.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {artefacts.map((a) => (
                    <span key={a.id} className="flex items-center gap-1 text-[11px] text-ink-faint">
                      {a.kind.replace(/_/g, ' ')} <StateBadge state={a.state} />
                    </span>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
