import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import {
  authoriseOwnVoice, Refused, revokeOwnVoice, setListeningPreference, setWorkingLanguage,
} from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    switch (body.action) {
      // The student's own: how the audio sounds, not what it says.
      case 'listening':
        return NextResponse.json({
          person: await setListeningPreference(store, actor, { voice: body.voice, speed: body.speed }),
        });

      // The registry's, with a reason recorded.
      case 'working-language':
        return NextResponse.json({
          person: await setWorkingLanguage(store, actor, body.personId, body.language, body.reason ?? ''),
        });

      // The lecturer's own, and nobody else's to give.
      case 'authorise-voice':
        return NextResponse.json({
          person: await authoriseOwnVoice(store, actor, { scope: body.scope, note: body.note }),
        });
      case 'revoke-voice':
        return NextResponse.json({ person: await revokeOwnVoice(store, actor) });

      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
