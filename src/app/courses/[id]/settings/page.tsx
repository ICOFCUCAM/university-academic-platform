import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { costsOn } from '@/lib/service';
import { PLATFORM_VOICES } from '@/lib/voice/voices';
import { CourseSettings } from '@/components/CourseSettings';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CourseSettingsPage({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const course = await store.course(params.id);
  if (!course) notFound();

  // THE SAME RULE THE SERVICE ASKS. The screen does not decide who may set up
  // a course; it refuses for the same reason the service would.
  if (!course.lecturerIds.includes(actor.id)) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title="Not your course to set up"
          body="A course is set up by the people who teach it."
        />
      </div>
    );
  }

  const [costs, lectures] = await Promise.all([
    costsOn(store, actor, course.id), store.lectures(course.id),
  ]);

  // The same shape `costOfLecture` gives for one lecture, summed across all
  // of them, so a lecturer sees which stage is the expensive one.
  const across = {
    runs: costs.length,
    unmetered: costs.length > 0 && costs.every((c) => c.inputTokens === undefined),
    outputTokens: costs.reduce((sum, c) => sum + (c.outputTokens ?? 0), 0),
    charactersOut: costs.reduce((sum, c) => sum + c.charactersOut, 0),
    byStage: [...new Set(costs.map((c) => c.stage))].map((stage) => ({
      stage,
      runs: costs.filter((c) => c.stage === stage).length,
      outputTokens: costs.filter((c) => c.stage === stage)
        .reduce((sum, c) => sum + (c.outputTokens ?? 0), 0),
    })),
  };

  return (
    <div>
      <PageHeader
        eyebrow={course.code}
        title="Setting up the course"
        subtitle="The terms nothing may change, what completing it means, and what it is spoken in. Who may enrol and whether it is running are the institution’s, and are not here."
      />
      <div className="px-6 py-6 md:px-8">
        <CourseSettings
          courseId={course.id}
          terminology={course.terminology ?? []}
          completion={course.completion}
          defaultVoice={course.defaultVoice}
          allowedVoices={course.allowedVoices ?? []}
          voices={PLATFORM_VOICES.map((v) => ({ id: v.id, label: v.label, blurb: v.blurb }))}
          costs={across}
          lectures={lectures.length}
        />
      </div>
    </div>
  );
}
