import { NextResponse } from 'next/server';
import { getQueue, getStore } from '@/lib/data';
import { engine } from '@/lib/ai/engine';
import { currentActor } from '@/lib/session';
import { addLecture, addSource, Refused } from '@/lib/service';
import { planFor } from '@/lib/jobs/plan';
import { drain } from '@/lib/jobs/worker';

/**
 * A lecture arrives. The recording or the transcript is stored, the pipeline
 * is QUEUED rather than run, and this returns — a ninety-minute lecture is not
 * processed inside an HTTP request.
 *
 * In this deployment the worker is then drained in the background of the same
 * process, which is honest for one installation and is the seam where a real
 * broker goes. See src/lib/jobs/queue.ts.
 */
export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    const lecture = await addLecture(store, actor, body.courseId, {
      title: body.title,
      abstract: body.abstract,
      minutes: body.minutes,
      personal: body.personal,
    });

    const from: 'recording' | 'transcript' = body.transcript ? 'transcript' : 'recording';
    await addSource(store, actor, lecture.id, {
      kind: from,
      body: body.transcript,
      mediaPath: body.mediaPath,
      seconds: body.minutes ? body.minutes * 60 : undefined,
    });

    const plan = planFor({ have: [from], context: lecture.context, from });
    await getQueue().add(plan.map((kind, position) => ({
      lectureId: lecture.id,
      courseId: lecture.courseId,
      kind,
      actorId: actor.id,
      actorRole: actor.role,
      position,
      options: body.options,
    })));

    // Fire and forget: the page polls the pipeline rather than waiting here.
    void drain(store, engine(), getQueue());

    return NextResponse.json({ lecture, queued: plan });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
