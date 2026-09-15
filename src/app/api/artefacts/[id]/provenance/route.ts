import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { provenance, Refused } from '@/lib/service';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  try {
    return NextResponse.json(await provenance(getStore(), actor, params.id));
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
