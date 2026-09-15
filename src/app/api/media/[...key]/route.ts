import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { storage } from '@/lib/storage/storage';
import { currentActor } from '@/lib/session';
import { mayAct } from '@/lib/domain/ownership';

/**
 * Serving a recording — and asking the same question the rest of the platform
 * asks before it does.
 *
 * A media route that only needed the key would be an unlisted URL, which is
 * not access control: one shared link and a lecture nobody approved is public.
 * So the artefact is found, and `mayAct` decides.
 */
export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.join('/');
  const actor = await currentActor();
  const store = getStore();

  const artefact = (await store.artefactsByMediaKey(key))[0];
  if (!artefact) return new NextResponse('Not found', { status: 404 });

  const [lecture, course] = await Promise.all([
    store.lecture(artefact.lectureId), store.course(artefact.courseId),
  ]);
  if (!course) return new NextResponse('Not found', { status: 404 });
  const enrolment = await store.enrolmentFor(course.id, actor.id);

  const permitted = mayAct(actor, 'read', artefact, {
    course, enrolment, personal: lecture?.context === 'personal',
  });
  if (!permitted.allowed) return new NextResponse(permitted.reason, { status: 403 });

  const file = await storage().get(key);
  if (!file) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'content-type': file.contentType,
      'content-length': String(file.data.byteLength),
      // A lecture recording is not cached by a shared proxy: who may hear it
      // is decided per person, above.
      'cache-control': 'private, max-age=3600',
      'accept-ranges': 'none',
    },
  });
}
