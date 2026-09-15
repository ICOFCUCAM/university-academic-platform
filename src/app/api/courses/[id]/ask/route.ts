import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { engine } from '@/lib/ai/engine';
import { currentActor } from '@/lib/session';
import { askCourseAI, makeStudyAid, Refused } from '@/lib/service';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    const result = await askCourseAI(store, engine(), actor, params.id, body.question, {
      register: body.register ?? null,
      conversationId: body.conversationId,
      scope: body.lectureSequence ? { lectureSequence: body.lectureSequence } : undefined,
      language: body.language,
    });

    // The ask was for something to be MADE — a test, an audio revision — so
    // the Course AI hands it to the same generator the lecturer uses.
    if ('make' in result && result.make) {
      const made = result.make;
      const aid = await makeStudyAid(store, engine(), actor, params.id, {
        kind: made.kind === 'test' ? 'test' : made.kind === 'audio' ? 'audio_revision' : 'flashcards',
        lectures: 'lectures' in made ? made.lectures : null,
        questions: made.kind === 'test' ? made.questions : undefined,
        minutes: made.kind === 'audio' ? made.minutes : undefined,
        // Written from the master, then carried across — so a student in Lyon
        // and one in Lagos answer the same academic questions.
        language: body.language,
      });
      return NextResponse.json({
        answer: {
          body: aid.body,
          citations: [],
          producedBy: 'generated from this course’s lectures',
          studyAidId: aid.id,
          title: aid.title,
          standing: aid.standing,
          language: aid.language,
          translatedFromId: aid.translatedFromId,
          outsideCourse: false,
        },
      });
    }

    return NextResponse.json({ answer: result });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
