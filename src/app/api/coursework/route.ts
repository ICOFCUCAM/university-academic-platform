import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import {
  markWork, Refused, returnWork, setAssignment, setReading, submitWork,
} from '@/lib/service';

export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  try {
    switch (body.action) {
      case 'set-reading':
        return NextResponse.json({ reading: await setReading(store, actor, body.courseId, body) });
      case 'set-assignment':
        return NextResponse.json({ assignment: await setAssignment(store, actor, body.courseId, body) });
      case 'submit':
        return NextResponse.json({ submission: await submitWork(store, actor, body.assignmentId, body.body) });
      case 'mark':
        return NextResponse.json({
          submission: await markWork(store, actor, body.submissionId, {
            mark: body.mark, feedback: body.feedback ?? '', release: body.release,
          }),
        });
      case 'return':
        return NextResponse.json({ released: await returnWork(store, actor, body.assignmentId) });
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
