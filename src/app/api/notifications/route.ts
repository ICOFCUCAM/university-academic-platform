import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { myNotifications, readNotifications } from '@/lib/service';

export async function GET() {
  const actor = await currentActor();
  return NextResponse.json({ notifications: await myNotifications(getStore(), actor) });
}

export async function POST() {
  const actor = await currentActor();
  await readNotifications(getStore(), actor);
  return NextResponse.json({ ok: true });
}
