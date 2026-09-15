import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { STAGES } from '@/lib/pipeline/stages';
import { mayAct } from '@/lib/domain/ownership';
import { LectureWorkspace } from '@/components/LectureWorkspace';
import { LectureCompanion } from '@/components/LectureCompanion';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LecturePage({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const lecture = await store.lecture(params.id);
  if (!lecture) notFound();

  const course = await store.course(lecture.courseId);
  if (!course) notFound();
  const enrolment = await store.enrolmentFor(course.id, actor.id);
  const scene = { course, enrolment, personal: lecture.context === 'personal' };

  const all = await store.artefacts(lecture.id);
  // ONE RULE, ASKED PER ARTEFACT. The page does not decide what a student may
  // see; it asks the same function the API asks.
  const visible = all.filter((a) => mayAct(actor, 'read', a, scene).allowed);
  if (!visible.length && actor.role === 'student') {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title="Nothing published from this lecture yet"
          body="Your lecturer reviews everything the AI produces before you receive it. When they publish, it appears here."
        />
      </div>
    );
  }

  const canEdit = all.some((a) => mayAct(actor, 'edit', a, scene).allowed)
    || lecture.ownerId === actor.id;
  const student = actor.role === 'student';

  return (
    <div>
      <PageHeader
        eyebrow={(
          <>
            <Link href={`/courses/${course.id}`} className="hover:text-brand">{course.code}</Link>
            {` · Lecture ${String(lecture.sequence).padStart(2, '0')}`}
            {lecture.sourceMinutes ? ` · ${lecture.sourceMinutes} min recording` : ''}
          </>
        ) as unknown as string}
        title={lecture.title}
        subtitle={lecture.abstract}
      />

      <LectureWorkspace
        lecture={lecture}
        stages={STAGES.map((s) => ({
          kind: s.kind, label: s.label, purpose: s.purpose, from: s.from,
          requiresApprovedSource: s.requiresApprovedSource, studentFacing: s.studentFacing,
        }))}
        artefacts={student ? visible : all}
        canEdit={canEdit}
        student={student}
      />

      {/* THE LECTURE COMPANION. "Ask about this lecture" means this lecture —
          the question is answered from here first, and only widens to the rest
          of the course when this lecture does not cover it. */}
      <div className="px-6 pb-10 md:px-8">
        <LectureCompanion courseId={course.id} lectureSequence={lecture.sequence} lectureTitle={lecture.title} />
      </div>
    </div>
  );
}
