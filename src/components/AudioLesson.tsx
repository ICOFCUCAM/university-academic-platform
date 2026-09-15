'use client';

import { useEffect, useRef, useState } from 'react';
import { Captions, Download, Headphones } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { SPEEDS } from '@/lib/voice/voices';

/**
 * PLAYING THE LESSON.
 *
 * A real player, because a lesson you cannot start is not a lesson: speed from
 * the student's own profile, parts for a long lecture, and a download so that
 * "listen anywhere" includes the parts of anywhere with no signal.
 *
 * It reports that it was listened to ONCE, when playback actually starts —
 * not when the page loads, because a page that counts itself as listened to
 * would tell a lecturer their cohort is studying when it is scrolling.
 */
export function AudioLesson({
  parts, speed, courseId, lectureId, script, captions,
}: {
  parts: { label: string; src: string; seconds?: number }[];
  speed: number;
  courseId: string;
  lectureId: string;
  /** The words that were spoken. Always available; how it is shown is a choice. */
  script?: string;
  /** From the listener's own profile: shown beside the audio, or behind a click. */
  captions?: boolean;
}) {
  const [at, setAt] = useState(0);
  const [rate, setRate] = useState(speed);
  const player = useRef<HTMLAudioElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    if (player.current) player.current.playbackRate = rate;
  }, [rate, at]);

  if (!parts.length) return null;
  const part = parts[at];

  return (
    <section className="rounded-lg border border-page-line bg-page-card px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Headphones size={16} className="text-brand" /> {part.label}
      </h3>

      <audio
        ref={player}
        src={part.src}
        controls
        className="mt-3 w-full"
        onPlay={() => {
          if (counted.current) return;
          counted.current = true;
          void fetch('/api/study', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ courseId, lectureId, event: 'listened' }),
          }).catch(() => {});
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {parts.length > 1 && parts.map((other, i) => (
          <button
            key={other.src} type="button" onClick={() => setAt(i)}
            className={`rounded border px-2.5 py-1 text-xs ${
              i === at ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
            }`}
          >
            Part {i + 1}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {SPEEDS.map((value) => (
            <button
              key={value} type="button" onClick={() => setRate(value)}
              className={`rounded border px-2 py-1 text-[11px] ${
                rate === value ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
              }`}
            >
              {value}×
            </button>
          ))}
          <a
            href={part.src} download
            className="ml-2 inline-flex items-center gap-1 rounded border border-page-line px-2 py-1 text-[11px] text-ink-soft"
          >
            <Download size={11} /> Download
          </a>
        </div>
      </div>

      {/* THE WORDS THAT WERE SPOKEN — always here, never hidden, and only the
          disclosure differs. NOT A TIMED CAPTION TRACK: the speech services
          return audio and a length, not word timings, so nothing highlights a
          word as it is said and this does not pretend to. */}
      {script && (captions ? (
        <div className="mt-4 border-t border-page-line pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
            <Captions size={12} /> What is said — the whole script, not timed to the audio
          </p>
          <Markdown source={script} />
        </div>
      ) : (
        <details className="mt-4 border-t border-page-line pt-4">
          <summary className="cursor-pointer text-xs text-ink-soft">
            Read what is said
          </summary>
          <div className="mt-3"><Markdown source={script} /></div>
        </details>
      ))}
    </section>
  );
}
