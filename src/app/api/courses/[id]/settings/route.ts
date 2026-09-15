import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import {
  Refused, setCompletionRule, setCourseTerminology, setCourseVoice, setInstitutionVoice,
} from '@/lib/service';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    switch (body.action) {
      case 'terminology':
        return NextResponse.json({
          course: await setCourseTerminology(store, actor, params.id, body.terms ?? []),
        });
      case 'completion':
        return NextResponse.json({
          course: await setCompletionRule(store, actor, params.id, body.rule ?? null),
        });
      case 'voice':
        return NextResponse.json({
          course: await setCourseVoice(store, actor, params.id, {
            defaultVoice: body.defaultVoice, allowedVoices: body.allowedVoices,
          }),
        });
      // The registry's, and kept here because it is the same screen the
      // lecturer reads the voices on — the refusal is in the service.
      case 'institution-voice':
        return NextResponse.json({
          university: await setInstitutionVoice(store, actor, body.voice ?? null),
        });
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
