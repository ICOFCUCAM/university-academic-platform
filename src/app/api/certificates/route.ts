import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { completionOf, issueCertificate, Refused } from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const body = await request.json();
  try {
    if (body.action === 'check') {
      return NextResponse.json(await completionOf(getStore(), actor, body.courseId, body.studentId));
    }
    return NextResponse.json({
      certificate: await issueCertificate(getStore(), actor, body.courseId, body.studentId),
    });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
