'use client';

import { useRouter } from 'next/navigation';

export function MarkRead() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/notifications', { method: 'POST' });
        router.refresh();
      }}
      className="rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
    >
      Mark all as read
    </button>
  );
}
