import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { currentActor } from '@/lib/session';
import { getStore } from '@/lib/data';
import { unread } from '@/lib/notify/notifications';
import { bodyAttributes, settingsOf } from '@/lib/access/accessibility';

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
  const presentation = bodyAttributes(settingsOf(me?.accessibility));

  return (
    <html lang={actor.workingLanguage ?? 'en'}>
      <body {...presentation}>
        <AppShell actor={actor} people={people} unread={waiting}>{children}</AppShell>
      </body>
    </html>
  );
}
