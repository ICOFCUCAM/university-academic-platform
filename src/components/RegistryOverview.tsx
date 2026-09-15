import Link from 'next/link';
import { Card } from '@/components/ui';
import type { Artefact, Course, Department, Enrolment, Faculty, Lecture, Person, University } from '@/lib/domain/types';

/**
 * THE UNIVERSITY'S VIEW: the estate, and delivery across it.
 *
 * Counts, coverage and where material has got to — never the material itself.
 * An administrator who could read an unapproved draft from this screen would
 * be reading a machine's first pass at somebody's speech, and the line this
 * platform draws would be drawn in the prospectus only.
 */
export function RegistryOverview({
  university, faculties, departments, courses, people, lectures, artefacts, enrolments,
}: {
  university: University;
  faculties: Faculty[];
  departments: Department[];
  courses: Course[];
  people: Person[];
  lectures: Lecture[];
  artefacts: Artefact[];
  enrolments: Enrolment[];
}) {
  const published = artefacts.filter((a) => a.state === 'published');
  const awaiting = artefacts.filter((a) => a.state === 'ready');
  const processed = new Set(artefacts.filter((a) => a.state !== 'absent').map((a) => a.lectureId));

  const stat = [
    { label: 'Faculties', value: faculties.length },
    { label: 'Departments', value: departments.length },
    { label: 'Courses', value: courses.length },
    { label: 'Lecturers', value: people.filter((p) => p.role === 'lecturer').length },
    { label: 'Students', value: people.filter((p) => p.role === 'student').length },
    { label: 'Enrolments', value: enrolments.filter((e) => e.status === 'registered').length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat.map((s) => (
          <Card key={s.label} className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="px-5 py-4">
          <h2 className="text-sm font-semibold">Academic content</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Lectures recorded</dt>
              <dd className="font-medium">{lectures.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Lectures processed</dt>
              <dd className="font-medium">{processed.size}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Artefacts published</dt>
              <dd className="font-medium">{published.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Awaiting a lecturer’s review</dt>
              <dd className="font-medium text-warn">{awaiting.length}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-faint">
            Delivery, not content. What a lecture says is the lecturer’s, and this screen does
            not open it.
          </p>
        </Card>

        <Card className="px-5 py-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">{university.name}</h2>
          <div className="mt-3 space-y-3">
            {faculties.map((faculty) => (
              <div key={faculty.id}>
                <p className="text-sm font-medium">{faculty.name}</p>
                {departments.filter((d) => d.facultyId === faculty.id).map((department) => (
                  <div key={department.id} className="ml-4 mt-1">
                    <p className="text-sm text-ink-soft">{department.name}</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      {courses.filter((c) => c.departmentId === department.id).map((course) => {
                        const mine = lectures.filter((l) => l.courseId === course.id);
                        const live = published.filter((a) => a.courseId === course.id).length;
                        return (
                          <li key={course.id} className="text-sm">
                            <Link href={`/courses/${course.id}`} className="text-brand hover:underline">
                              {course.code}
                            </Link>
                            <span className="text-ink-soft"> — {course.title}</span>
                            <span className="text-xs text-ink-faint">
                              {' '}· {mine.length} lectures · {live} published artefacts
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
