import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { Refused, searchCourse } from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const body = await request.json();
  try {
    const passages = await searchCourse(getStore(), actor, body.courseId, body.query ?? '', {
      widenTo: body.widenTo,
    });
    return NextResponse.json({ passages });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
