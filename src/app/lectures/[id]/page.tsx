import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { STAGES } from '@/lib/pipeline/stages';
import { mayAct } from '@/lib/domain/ownership';
import { can } from '@/lib/capabilities';
import { voicesFor } from '@/lib/voice/voices';
import { settingsOf } from '@/lib/access/accessibility';
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
  const me = await store.person(actor.id);

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

  // ---- WHAT THIS LECTURE MAY BE SPOKEN IN --------------------------------
  //
  // Computed here, from the lecturer's own consent record, so that a voice
  // nobody authorised is never even sent to the browser as an option.
  const lecturer = await store.person(lecture.ownerId);
  const listeningLanguage = student ? actor.workingLanguage ?? course.originalLanguage ?? 'en' : course.originalLanguage ?? 'en';
  const university = await store.university();
  const voices = voicesFor({
    lecturerName: lecturer?.name ?? 'The lecturer',
    lecturerConsent: lecturer?.voiceConsent,
    use: listeningLanguage === (course.originalLanguage ?? 'en') ? 'original-audio' : 'translated-audio',
    universityVoice: university.standardVoice,
    allowed: course.allowedVoices,
  }).map((offer) => ({
    id: offer.voice.id,
    label: offer.voice.label,
    blurb: offer.voice.blurb,
    kind: offer.voice.kind,
    available: offer.available,
    unavailableBecause: offer.unavailableBecause,
  }));

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
        originalLanguage={course.originalLanguage ?? 'en'}
        offeredLanguages={course.offeredLanguages ?? []}
        canTranslate={can(actor.role, 'request-translation') && course.lecturerIds.includes(actor.id)}
        canApproveTranslation={can(actor.role, 'approve-translation')}
        workingLanguage={actor.workingLanguage}
        voices={voices}
        voicePreference={actor.voicePreference}
        audioSpeed={actor.audioSpeed}
        captions={settingsOf(me?.accessibility).captions}
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
