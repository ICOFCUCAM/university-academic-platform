import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { direction } from '@/lib/i18n/languages';
import { mayEnterCourse } from '@/lib/domain/ownership';
import { StudyRoom } from '@/components/StudyRoom';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Study({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  const enrolment = await store.enrolmentFor(course.id, actor.id);
  const teaching = course.lecturerIds.includes(actor.id);
  if (!mayEnterCourse(actor, course, enrolment)) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty title="Not your course" body="Revision material is for the people on the course." />
      </div>
    );
  }

  const language = actor.workingLanguage ?? course.originalLanguage ?? 'en';
  const [aids, lectures] = await Promise.all([
    store.studyAids(course.id, actor.id), store.lectures(course.id),
  ]);

  // A student is shown what exists in their working language; staff see
  // everything, because reviewing it is their job.
  const visible = aids.filter((aid) => teaching
    || (aid.language ?? course.originalLanguage ?? 'en') === language)
    .filter((aid) => aid.state !== 'failed');

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Revision"
        subtitle="Quizzes, flashcards and audio revision, built from this course’s own lectures — and from nothing else."
      />
      <div className="px-6 py-6 md:px-8">
        <StudyRoom
          courseId={course.id}
          language={language}
          dir={direction(language)}
          lectures={lectures.map((l) => ({ id: l.id, sequence: l.sequence, title: l.title }))}
          aids={visible.map((aid) => ({
            id: aid.id, kind: aid.kind, title: aid.title, body: aid.body ?? '',
            language: aid.language ?? course.originalLanguage ?? 'en',
            unreviewed: aid.standing === 'unreviewed',
            translated: !!aid.translatedFromId,
          }))}
        />
      </div>
    </div>
  );
}
