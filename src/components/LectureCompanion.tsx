'use client';

import { CourseChat } from '@/components/CourseChat';

/**
 * LECTURE COMPANION. Open during the lecture or straight after it: the
 * recording, the transcript, the notes and the lesson are above; this is the
 * part that answers questions about what was just said.
 */
export function LectureCompanion({
  courseId, lectureSequence, lectureTitle,
}: {
  courseId: string; lectureSequence: number; lectureTitle: string;
}) {
  return (
    <section className="rounded-lg border border-page-line bg-page p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
        Ask about Lecture {String(lectureSequence).padStart(2, '0')}
      </h2>
      <div className="mt-3">
        <CourseChat
          courseId={courseId}
          lectureSequence={lectureSequence}
          compact
          suggestions={[
            `What was the main argument of ${lectureTitle}?`,
            'Create a 10-question test on this lecture.',
          ]}
          followUps={[
            'Give me a simple explanation.',
            'Now the university-level explanation.',
            'Which lecture introduced this concept?',
          ]}
        />
      </div>
    </section>
  );
}
