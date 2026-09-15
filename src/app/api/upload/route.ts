import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { storage, Unsupported } from '@/lib/storage/storage';
import { addSource, Refused } from '@/lib/service';

/**
 * A recording arrives. Stored, attached to the lecture as its source, and
 * nothing more — transcription is a queued job, not something a browser waits
 * for with a file open.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();

  try {
    const form = await request.formData();
    const file = form.get('file');
    const lectureId = String(form.get('lectureId') ?? '');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });

    const lecture = await store.lecture(lectureId);
    if (!lecture) return NextResponse.json({ error: 'No such lecture.' }, { status: 404 });

    const stored = await storage().put({
      courseId: lecture.courseId,
      lectureId,
      kind: 'recording',
      originalName: file.name,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });

    const artefact = await addSource(store, actor, lectureId, {
      kind: 'recording',
      mediaPath: stored.key,
      // The minutes are unknown until something listens to it. Guessing from
      // the byte count would meter an account on a number nobody measured.
      seconds: undefined,
    });

    return NextResponse.json({ artefact, file: stored });
  } catch (error) {
    if (error instanceof Unsupported) return NextResponse.json({ error: error.message }, { status: 415 });
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
