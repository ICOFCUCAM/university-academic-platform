import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { NewLectureForm } from '@/components/NewLectureForm';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function NewLecture({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const course = await getStore().course(params.id);
  if (!course) notFound();

  if (!course.lecturerIds.includes(actor.id)) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title="Not your course"
          body="Lectures are uploaded by the people who teach the course. The academic material is theirs."
        />
      </div>
    );
  }

  const existing = await getStore().lectures(course.id);

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="New lecture"
        subtitle="Upload the recording, or paste a transcript if it was made elsewhere. The pipeline is queued, not run here — a ninety-minute lecture is not processed inside a web request."
      />
      <div className="px-6 py-6 md:px-8">
        <NewLectureForm courseId={course.id} nextSequence={existing.length + 1} />
      </div>
    </div>
  );
}
