import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { currentActor } from '@/lib/session';
import { getStore } from '@/lib/data';
import { unread } from '@/lib/notify/notifications';
import { bodyAttributes, settingsOf } from '@/lib/access/accessibility';
import { can } from '@/lib/capabilities';
import { direction } from '@/lib/i18n/languages';

export const metadata: Metadata = {
  title: 'Lecture Studio',
  description: 'Turn every lecture into a lesson you can read, listen to and revise.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const people = await getStore().people();
  const waiting = unread(await getStore().notifications(actor.id));

  // ON THE SERVER, NOT IN AN EFFECT. A student who needs larger text or a
  // different face should never watch the page arrive in the one they cannot
  // read and then correct itself.
  const me = await getStore().person(actor.id);
  // Whoever may read the record is offered it; nobody else is shown the door.
  const mine = await getStore().coursesFor(actor.id);
  const canReadRecord = can(actor.role, 'manage-people')
    || mine.some((course) => course.lecturerIds.includes(actor.id));
  const presentation = bodyAttributes(settingsOf(me?.accessibility));

  return (
    // THE DOCUMENT IS WHAT IS RIGHT-TO-LEFT, not a div inside it. With `dir`
    // on an inner element the scrollbar, the native form controls and
    // anything rendered outside that div stay left-to-right, which is how a
    // page ends up half-mirrored.
    <html lang={actor.workingLanguage ?? 'en'} dir={direction(actor.workingLanguage ?? 'en')}>
      <body {...presentation}>
        <AppShell actor={actor} people={people} unread={waiting} canReadRecord={canReadRecord}>{children}</AppShell>
      </body>
    </html>
  );
}
