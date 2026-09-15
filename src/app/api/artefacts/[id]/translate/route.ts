import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { engine } from '@/lib/ai/engine';
import { currentActor } from '@/lib/session';
import { approveTranslation, Refused, translateArtefact } from '@/lib/service';

/**
 * Translate an APPROVED artefact into one more language, or vouch for a
 * translation somebody has read. Both go through the service, which holds the
 * gate: a draft is not translated, and a language the actor cannot read is not
 * approved by them.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const body = await request.json();
  try {
    if (body.action === 'approve') {
      return NextResponse.json({ artefact: await approveTranslation(getStore(), actor, params.id) });
    }
    const artefact = await translateArtefact(getStore(), engine(), actor, params.id, body.language);
    return NextResponse.json({ artefact });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
