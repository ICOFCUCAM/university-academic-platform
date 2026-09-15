import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { recordStudy, Refused, sitQuiz } from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    if (body.action === 'sit-quiz') {
      return NextResponse.json(await sitQuiz(store, actor, body.studyAidId, body.given ?? {}));
    }
    // Recording that somebody read a page is best-effort by design: it must
    // never be the reason a page fails to load.
    await recordStudy(store, actor, {
      courseId: body.courseId, lectureId: body.lectureId,
      artefactKind: body.artefactKind, event: body.event,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
