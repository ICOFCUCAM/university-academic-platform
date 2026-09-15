import { NextResponse } from 'next/server';
import { getQueue, getStore } from '@/lib/data';
import { engine } from '@/lib/ai/engine';
import { currentActor } from '@/lib/session';
import { Refused, runStage } from '@/lib/service';

/** Run one stage now. The lecturer pressed a button; they are watching. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json().catch(() => ({}));

  try {
    const artefact = await runStage(store, engine(), actor, params.id, body.kind, {
      mode: body.mode, persona: body.persona, revision: body.revision,
      // The approved master is immutable in substance: writing over it takes a
      // second, explicit act, and the service refuses without this.
      regenerate: body.regenerate === true,
    });
    // A transformation failure is recorded ON the artefact, not thrown: the
    // lecturer has to be able to read what the model actually said.
    return NextResponse.json({ artefact }, { status: artefact.state === 'failed' ? 200 : 200 });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ jobs: await getQueue().forLecture(params.id) });
}
