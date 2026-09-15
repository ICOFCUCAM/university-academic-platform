import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { CourseSearch } from '@/components/CourseSearch';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Search({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const course = await getStore().course(params.id);
  if (!course) notFound();

  const enrolment = await getStore().enrolmentFor(course.id, actor.id);
  const teaching = course.lecturerIds.includes(actor.id);
  if (!teaching && !enrolment && course.access !== 'open') {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty title="Not your course" body="Search is for the people on the course." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Search the course"
        subtitle="The lectures themselves, shown as they are. No model, no waiting — for when you half-remember a sentence and want to find it."
      />
      <div className="px-6 py-6 md:px-8">
        <CourseSearch courseId={course.id} courseCode={course.code} />
      </div>
    </div>
  );
}
