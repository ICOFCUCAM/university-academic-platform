import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { answerCard, deckFor, recordStudy, Refused, sitQuiz } from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    if (body.action === 'sit-quiz') {
      return NextResponse.json(await sitQuiz(store, actor, body.studyAidId, body.given ?? {}));
    }
    if (body.action === 'answer-card') {
      await answerCard(store, actor, body.studyAidId, body.front, body.knew === true);
      return NextResponse.json({ deck: await deckFor(store, actor, body.studyAidId) });
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

/** The evening's deck. A GET because it reads a schedule and changes nothing. */
export async function GET(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const aid = new URL(request.url).searchParams.get('aid');
  if (!aid) return NextResponse.json({ error: 'Which set of cards?' }, { status: 400 });

  try {
    return NextResponse.json({ deck: await deckFor(store, actor, aid) });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
