import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { approve, editArtefact, publish, Refused, withdraw } from '@/lib/service';

/**
 * The review layer, as four verbs. Each one goes through `mayAct` inside the
 * service — this route does not decide anything, it only names the act.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    switch (body.action) {
      case 'edit':
        return NextResponse.json({ artefact: await editArtefact(store, actor, params.id, body.body, body.note) });
      case 'approve':
        return NextResponse.json({ artefact: await approve(store, actor, params.id) });
      case 'publish':
        return NextResponse.json({ artefact: await publish(store, actor, params.id) });
      case 'withdraw':
        return NextResponse.json({ artefact: await withdraw(store, actor, params.id) });
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
