import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { readingFor, workFor } from '@/lib/service';
import { Coursework } from '@/components/Coursework';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Work({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  const teaching = course.lecturerIds.includes(actor.id);
  const enrolment = await store.enrolmentFor(course.id, actor.id);
  if (!teaching && !enrolment && course.access !== 'open') {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty title="Not your course" body="Reading and assignments are for the people on the course." />
      </div>
    );
  }

  const [readings, assignments, lectures, people] = await Promise.all([
    readingFor(store, actor, course.id), store.assignments(course.id),
    store.lectures(course.id), store.people(),
  ]);

  const visible = teaching ? assignments : assignments.filter((a) => a.published);
  const submissions = await Promise.all(
    visible.map(async (assignment) => ({
      assignmentId: assignment.id,
      list: await workFor(store, actor, assignment.id),
    })),
  );

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Reading and work"
        subtitle={teaching
          ? 'What you have set, and what has come in. Nothing here is marked by a machine — a mark is an academic judgement about a student.'
          : 'What your lecturer has set you to read, and the work to hand in.'}
      />
      <div className="px-6 py-6 md:px-8">
        <Coursework
          courseId={course.id}
          teaching={teaching}
          readings={readings}
          assignments={visible}
          submissions={submissions}
          lectures={lectures.map((l) => ({ id: l.id, sequence: l.sequence, title: l.title }))}
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          me={actor.id}
        />
      </div>
    </div>
  );
}
