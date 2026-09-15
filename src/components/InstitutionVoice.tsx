'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic2 } from 'lucide-react';
import { Card } from '@/components/ui';

/**
 * THE UNIVERSITY'S OWN VOICE — the registry's, because it speaks for the
 * institution rather than for a course.
 *
 * It sits in Settings rather than on a course, because a course screen belongs
 * to whoever teaches it and a registrar teaches nothing: putting this there
 * would have made it a setting nobody who may change it can reach.
 */
export function InstitutionVoice({
  voice, courseId,
}: {
  voice?: { id: string; label: string; blurb?: string };
  /** Any course: the route is per-course, the act is the institution's. */
  courseId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ id: voice?.id ?? '', label: voice?.label ?? '', blurb: voice?.blurb ?? '' });

  async function save(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card className="px-5 py-4 lg:col-span-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Mic2 size={16} className="text-brand" /> The university’s own voice
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Offered on every course alongside the platform’s voices. A lecturer’s voice is never this:
        that is consent, it is personal, and only they can give it.
      </p>

      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input
          className="rounded-md border border-page-line px-3 py-2 text-sm"
          placeholder="The id your speech service knows"
          value={draft.id}
          onChange={(event) => setDraft({ ...draft, id: event.target.value })}
        />
        <input
          className="rounded-md border border-page-line px-3 py-2 text-sm"
          placeholder="What a student sees"
          value={draft.label}
          onChange={(event) => setDraft({ ...draft, label: event.target.value })}
        />
        <input
          className="rounded-md border border-page-line px-3 py-2 text-sm"
          placeholder="A line about how it sounds"
          value={draft.blurb}
          onChange={(event) => setDraft({ ...draft, blurb: event.target.value })}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button" disabled={busy}
          onClick={() => save({ action: 'institution-voice', voice: draft })}
          className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {voice ? 'Change it' : 'Set it'}
        </button>
        {voice && (
          <button
            type="button" disabled={busy}
            onClick={() => { setDraft({ id: '', label: '', blurb: '' }); save({ action: 'institution-voice', voice: null }); }}
            className="rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft"
          >
            Remove it
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        {voice
          ? `Students are offered “${voice.label}” on every course.`
          : 'No institution voice is set, so students are offered the platform’s four.'}
      </p>
    </Card>
  );
}
