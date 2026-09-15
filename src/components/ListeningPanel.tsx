'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Headphones, Lock, MicOff } from 'lucide-react';
import { LANGUAGE_BY_CODE } from '@/lib/i18n/languages';
import { SPEEDS } from '@/lib/voice/voices';

export interface VoiceOfferView {
  id: string;
  label: string;
  blurb: string;
  kind: 'lecturer' | 'university' | 'platform';
  available: boolean;
  unavailableBecause?: string;
}

/**
 * 🎧 LISTEN
 *
 *   Language   locked to the working language — it is the academic environment
 *   Voice      selectable — it is only how the environment sounds
 *   Speed      the same
 *
 * And the lecturer's own voice is offered ONLY where they have authorised it.
 * Where they have not, the option stays on the screen and says so, because an
 * option that silently disappears leaves a student wondering whether the
 * platform used it anyway.
 */
export function ListeningPanel({
  voices, language, lockedForStudent, preference, speed,
}: {
  voices: VoiceOfferView[];
  language: string;
  lockedForStudent: boolean;
  preference?: string;
  speed: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(preference ?? voices.find((v) => v.available)?.id);
  const [rate, setRate] = useState(speed);

  async function remember(next: { voice?: string; speed?: number }) {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'listening', ...next }),
    });
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-page-line bg-page-card px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Headphones size={16} className="text-brand" /> Listen
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">Language</span>
        <span className="rounded border border-page-line px-2 py-1">
          {LANGUAGE_BY_CODE[language]?.endonym ?? language}
        </span>
        {lockedForStudent && (
          <span className="flex items-center gap-1 text-ink-faint">
            <Lock size={11} /> locked to your working language
          </span>
        )}
      </div>

      <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-faint">Voice</p>
      <ul className="mt-1 space-y-1.5">
        {voices.map((voice) => (
          <li key={voice.id}>
            <label
              className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                !voice.available ? 'border-page-line bg-page text-ink-faint'
                  : chosen === voice.id ? 'border-brand bg-brand-tint' : 'border-page-line'
              }`}
            >
              <input
                type="radio" name="voice" className="mt-1"
                disabled={!voice.available}
                checked={chosen === voice.id}
                onChange={() => { setChosen(voice.id); void remember({ voice: voice.id }); }}
              />
              <span>
                <span className="font-medium">{voice.label}</span>
                <span className="block text-xs text-ink-soft">
                  {voice.available ? voice.blurb : voice.unavailableBecause}
                </span>
              </span>
              {!voice.available && <MicOff size={14} className="ml-auto mt-1 shrink-0" />}
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-faint">Speed</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {SPEEDS.map((value) => (
          <button
            key={value} type="button"
            onClick={() => { setRate(value); void remember({ speed: value }); }}
            className={`rounded border px-2.5 py-1 text-xs ${
              rate === value ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
            }`}
          >
            {value}×
          </button>
        ))}
      </div>
    </section>
  );
}
