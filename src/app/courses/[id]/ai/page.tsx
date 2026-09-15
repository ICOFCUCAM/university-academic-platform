import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { knowledgeBase } from '@/lib/service';
import { CourseChat } from '@/components/CourseChat';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CourseAIPage({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  const enrolment = await store.enrolmentFor(course.id, actor.id);
  const teaching = course.lecturerIds.includes(actor.id);
  if (!teaching && !enrolment) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty title="Not your course" body="The Course AI answers for the people on the course." />
      </div>
    );
  }

  const knowledge = await knowledgeBase(store, course.id);
  const lectures = await store.lectures(course.id);
  const last = Math.max(1, ...knowledge.coverage.filter((c) => c.extracted).map((c) => c.lectureSequence));
  // The opening suggestion names something this course actually teaches, so a
  // student's first question is answerable rather than a demonstration of the
  // refusal.
  const topics = knowledge.nodes.filter((n) => n.definedIn).map((n) => n.term);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        eyebrow={course.code}
        title={`${course.title} — Course AI`}
        subtitle={`Answers out of ${knowledge.lecturesIncluded.length} processed lectures on this course. Not from the internet, and not from what a model happens to know about the subject.`}
      />
      <div className="flex-1 overflow-hidden px-6 py-6 md:px-8">
        <CourseChat
          courseId={course.id}
          courseLanguage={course.originalLanguage ?? 'en'}
          offeredLanguages={course.offeredLanguages ?? []}
          suggestions={[
            ...(topics.length ? [`Explain ${topics[0].toLowerCase()} based on our lectures.`] : []),
            'Create a 10-question test.',
            `Create a 15-minute audio revision covering lectures 1–${Math.min(last, lectures.length)}.`,
          ]}
          followUps={[
            'Which lecture introduced this concept?',
            'Give me a simple explanation.',
            'Now the university-level explanation.',
          ]}
        />
      </div>
    </div>
  );
}
