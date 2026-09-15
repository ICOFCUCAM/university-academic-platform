import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { closeLive, followLive, openLive, Refused, speakIntoLive } from '@/lib/service';
import { liveEngine } from '@/lib/live/wiring';

export async function GET(request: Request) {
  const actor = await currentActor();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  if (!sessionId) return NextResponse.json({ error: 'Which lecture?' }, { status: 400 });

  try {
    return NextResponse.json(await followLive(
      getStore(), actor, sessionId, Number(url.searchParams.get('from') ?? 1),
    ));
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    switch (body.action) {
      case 'open':
        return NextResponse.json({
          session: await openLive(store, actor, params.id, {
            title: body.title ?? '', fallback: body.fallback,
          }),
        });
      case 'say':
        return NextResponse.json(await speakIntoLive(store, liveEngine(), actor, body.sessionId, {
          heard: body.heard ?? '', seconds: Number(body.seconds ?? 4),
        }));
      case 'close':
        return NextResponse.json(await closeLive(store, actor, body.sessionId));
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
