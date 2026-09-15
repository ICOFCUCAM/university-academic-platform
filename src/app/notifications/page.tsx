import Link from 'next/link';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { myNotifications } from '@/lib/service';
import { MarkRead } from '@/components/MarkRead';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Notifications() {
  const actor = await currentActor();
  const notifications = await myNotifications(getStore(), actor);

  return (
    <div>
      <PageHeader
        title="What happened"
        subtitle="Work that finished somewhere else while you were doing something else. Nobody is told what a student read — that would be the surveillance this platform refuses to be."
        actions={notifications.some((n) => !n.readAt) ? <MarkRead /> : undefined}
      />
      <div className="px-6 py-6 md:px-8 space-y-2">
        {notifications.length === 0 ? (
          <Empty title="Nothing yet" body="When a lecture finishes processing, or work comes back marked, it appears here." />
        ) : notifications.map((notification) => (
          <Card key={notification.id} className={`px-5 py-4 ${notification.readAt ? '' : 'border-brand/40'}`}>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              {new Date(notification.at).toLocaleString()}
              {!notification.readAt && ' · new'}
            </p>
            <p className="mt-0.5 font-medium">
              {notification.link
                ? <Link href={notification.link} className="hover:text-brand">{notification.title}</Link>
                : notification.title}
            </p>
            {notification.body && <p className="mt-1 text-sm text-ink-soft">{notification.body}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
