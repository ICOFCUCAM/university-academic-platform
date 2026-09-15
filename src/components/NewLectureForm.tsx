'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload } from 'lucide-react';

/**
 * The upload. MP3, M4A, WAV and video are what a lecture arrives as; a
 * transcript is what it arrives as when the university transcribes elsewhere,
 * or when the lecture was not recorded at all and somebody has the text.
 *
 * NOTHING IS UPLOADED FROM THIS DEMONSTRATION — there is no object store wired
 * up, so the file's name is recorded and the transcript box is the working
 * path. See INTEGRATION.md §4 for where storage plugs in. Saying so here is
 * better than a progress bar that means nothing.
 */
export function NewLectureForm({ courseId, nextSequence }: { courseId: string; nextSequence: number }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [minutes, setMinutes] = useState(50);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, title, abstract, minutes, transcript: transcript || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      router.push(`/lectures/${payload.lecture.id}`);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-lg border border-page-line bg-page-card p-6">
      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}

      <div>
        <label className="block text-sm font-medium">Lecture {String(nextSequence).padStart(2, '0')} — title</label>
        <input
          required value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Evolution"
          className="mt-1 w-full rounded-md border border-page-line px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Your own framing <span className="font-normal text-ink-faint">(optional)</span></label>
        <textarea
          value={abstract} onChange={(e) => setAbstract(e.target.value)}
          rows={2}
          placeholder="What this lecture is for, in your words. The AI is given it as context and never rewrites it."
          className="mt-1 w-full rounded-md border border-page-line px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Length (minutes)</label>
          <input
            type="number" min={1} max={300} value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 w-28 rounded-md border border-page-line px-3 py-2 text-sm"
          />
        </div>
        <label className="flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-page-line px-3 py-2 text-sm text-ink-faint">
          <Upload size={15} />
          MP3, M4A, WAV or video — storage not configured in this build
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium">Transcript</label>
        <p className="text-xs text-ink-faint">
          Paste the transcript to start the pipeline now. With a transcription service configured,
          this is filled in from the recording instead.
        </p>
        <textarea
          value={transcript} onChange={(e) => setTranscript(e.target.value)}
          rows={10}
          className="mt-1 w-full rounded-md border border-page-line px-3 py-2 font-mono text-[13px]"
        />
      </div>

      <button
        type="submit" disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        Start processing
      </button>
      <p className="text-xs text-ink-faint">
        The correction runs first. Everything after it waits for you to approve that text — the
        notes, the knowledge base, the audio and the revision are all built on it.
      </p>
    </form>
  );
}
