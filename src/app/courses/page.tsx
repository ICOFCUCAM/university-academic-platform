import Link from 'next/link';
import { Globe } from 'lucide-react';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { direction } from '@/lib/i18n/languages';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Courses() {
  const actor = await currentActor();
  const store = getStore();
  const [courses, departments, faculties, university] = await Promise.all([
    store.coursesFor(actor.id), store.departments(), store.faculties(), store.university(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={university.name}
        title="Courses"
        subtitle="A course is the central object: its lectures, everything made from them, and a Course AI that answers out of that material and nothing else."
        actions={(
          <Link
            href="/catalogue"
            className="inline-flex items-center gap-2 rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
          >
            <Globe size={16} /> Open courses
          </Link>
        )}
      />
      <div className="px-6 py-6 md:px-8">
        {courses.length === 0 ? (
          <Empty title="No courses" body="Courses you teach or are enrolled on appear here." />
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const department = departments.find((d) => d.id === course.departmentId);
              const faculty = faculties.find((f) => f.id === department?.facultyId);
              return (
                <Link key={course.id} href={`/courses/${course.id}`}>
                  {/* THE CARD IS IN THE COURSE'S OWN LANGUAGE. A title and a
                      description that were written in English do not become
                      Arabic because the reader is: telling the browser
                      otherwise puts the full stop on the wrong side. */}
                  <Card
                    className="px-5 py-4 transition hover:border-brand/40"
                    lang={course.originalLanguage ?? 'en'}
                    dir={direction(course.originalLanguage ?? 'en')}
                  >
                    {/* An independent educator has no faculty and no
                        department, and the line simply does not appear. */}
                    {(faculty || department) && (
                      <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                        {[faculty?.name, department?.name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="mt-0.5 font-medium">
                      <span className="text-brand">{course.code}</span> — {course.title}
                    </p>
                    {course.description && (
                      <p className="mt-1 text-sm text-ink-soft">{course.description}</p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
