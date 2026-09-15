import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { mayEnterCourse } from '@/lib/domain/ownership';
import { translate } from '@/lib/i18n/ui';
import { liveEngine } from '@/lib/live/wiring';
import { LiveRoom } from '@/components/LiveRoom';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Live({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  const enrolment = await store.enrolmentFor(course.id, actor.id);
  if (!mayEnterCourse(actor, course, enrolment)) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title={translate(actor.workingLanguage, 'course.notYours')}
          body={translate(actor.workingLanguage, 'course.notYoursBody')}
        />
      </div>
    );
  }

  const sessions = await store.liveSessions(course.id);
  const running = sessions.find((s) => s.state === 'running') ?? null;

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Live"
        subtitle="One lecture, heard in every language the cohort reads. Nothing said here is published: the recording goes through the ordinary pipeline afterwards, with the lecturer reading it."
      />
      <div className="px-6 py-6 md:px-8">
        <LiveRoom
          courseId={course.id}
          session={running}
          teaching={course.lecturerIds.includes(actor.id)}
          engine={liveEngine().describe()}
        />
      </div>
    </div>
  );
}
