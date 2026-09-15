import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { currentActor } from '@/lib/session';
import { getStore } from '@/lib/data';
import { unread } from '@/lib/notify/notifications';

export const metadata: Metadata = {
  title: 'Lecture Studio',
  description: 'Turn every lecture into a lesson you can read, listen to and revise.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const people = await getStore().people();
  const waiting = unread(await getStore().notifications(actor.id));

  return (
    <html lang="en">
      <body>
        <AppShell actor={actor} people={people} unread={waiting}>{children}</AppShell>
      </body>
    </html>
  );
}
