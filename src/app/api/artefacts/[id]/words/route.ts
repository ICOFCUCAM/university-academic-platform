import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { recordWordCheck, Refused, wordCheckFor } from '@/lib/service';

/** The words this system could not place, in their sentences. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  try {
    return NextResponse.json(await wordCheckFor(getStore(), actor, params.id));
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** What the lecturer decided about each of them. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const body = await request.json();
  try {
    const artefact = await recordWordCheck(getStore(), actor, params.id, body.decisions ?? []);
    return NextResponse.json({ artefact });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
