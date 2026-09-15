'use client';

import { useRef, useState } from 'react';
import { Circle, Loader2, Square } from 'lucide-react';

/**
 * RECORDING THE LECTURE IN THE ROOM.
 *
 * The browser's own recorder, because the alternative — "export it from your
 * phone, find it in Downloads, upload it" — is three steps a lecturer does
 * once and then stops doing.
 *
 * WHAT IT DOES NOT DO: stream to the server as it goes. A ninety-minute
 * recording is held in the tab until the lecturer stops it, which is simple and
 * survives a dropped connection mid-lecture — and is why the button warns
 * about closing the tab rather than pretending the risk is not there.
 */
export function RecordLecture({ onRecorded }: { onRecorded: (file: File) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Let the browser choose what it can actually encode: forcing a MIME
      // type here is how this breaks on one browser in one lecture theatre.
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const type = media.mimeType || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        const extension = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
        onRecorded(new File([blob], `lecture.${extension}`, { type: type.split(';')[0] }));
        setState('idle');
      };
      media.start(5000);
      recorder.current = media;
      setState('recording');
      setSeconds(0);
      ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (failure) {
      setError(failure instanceof Error
        ? `The microphone could not be opened: ${failure.message}`
        : 'The microphone could not be opened.');
    }
  }

  function stop() {
    setState('saving');
    if (ticker.current) clearInterval(ticker.current);
    recorder.current?.stop();
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-md border border-page-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        {state === 'recording' ? (
          <button
            type="button" onClick={stop}
            className="inline-flex items-center gap-2 rounded bg-bad px-3 py-1.5 text-xs font-medium text-white"
          >
            <Square size={12} /> Stop — {clock}
          </button>
        ) : (
          <button
            type="button" onClick={start} disabled={state === 'saving'}
            className="inline-flex items-center gap-2 rounded border border-page-line px-3 py-1.5 text-xs text-ink-soft hover:border-brand/40"
          >
            {state === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Circle size={12} className="text-bad" />}
            Record in the room
          </button>
        )}
        {state === 'recording' && (
          <span className="text-xs text-ink-faint">
            Keep this tab open — the recording is held here until you stop it.
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
