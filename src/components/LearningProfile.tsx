'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Accessibility, Globe, Headphones, Lock, Mic, ShieldCheck } from 'lucide-react';
import type { Person } from '@/lib/domain/types';
import { LANGUAGE_BY_CODE } from '@/lib/i18n/languages';
import { PLATFORM_VOICES, SPEEDS } from '@/lib/voice/voices';
import { ACCESSIBILITY_CHOICES, settingsOf } from '@/lib/access/accessibility';
import { Card } from '@/components/ui';

/**
 * MY LEARNING PROFILE.
 *
 *   Working language   one, and not a switcher. Locked, with who set it.
 *   Voice              the student's, changeable whenever they like.
 *   Speed              the same.
 *   Reading it         theirs alone, and reported to nobody.
 *
 * The two are different kinds of thing and the screen says so: one is the
 * academic environment, the other is how it sounds.
 */
export function LearningProfile({ person, isStudent }: { person: Person; isStudent: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = person.workingLanguage;
  const lastChange = person.workingLanguageHistory?.[person.workingLanguageHistory.length - 1];

  async function save(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/profile', {
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
    <div className="grid gap-4 lg:grid-cols-2">
      {error && (
        <p className="lg:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>
      )}

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe size={16} className="text-brand" /> Working language
        </h2>
        <p className="mt-2 text-2xl font-semibold">
          {language ? LANGUAGE_BY_CODE[language]?.endonym ?? language : 'Not set'}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
          <Lock size={12} />
          {isStudent
            ? 'Your notes, transcripts, audio, quizzes, flashcards and the Course AI all arrive in this language. Changing it is a registry matter, so that a term is studied in one language.'
            : 'The language this account works in.'}
        </p>
        {lastChange && (
          <p className="mt-2 rounded border border-page-line bg-page px-3 py-2 text-xs text-ink-soft">
            Changed to {LANGUAGE_BY_CODE[lastChange.to]?.name ?? lastChange.to}
            {lastChange.byName ? ` by ${lastChange.byName}` : ''} — “{lastChange.reason}”.
          </p>
        )}
      </Card>

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Headphones size={16} className="text-brand" /> Listening
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          A voice changes how a lesson sounds and nothing about what it says, so this one is yours
          to change whenever you like.
        </p>

        <label className="mt-3 block text-[11px] uppercase tracking-wide text-ink-faint">Preferred voice</label>
        <select
          className="mt-1 w-full rounded-md border border-page-line px-3 py-2 text-sm"
          value={person.voicePreference ?? ''}
          onChange={(event) => save({ action: 'listening', voice: event.target.value })}
          disabled={busy}
        >
          <option value="">No preference — the course’s own voice</option>
          <option value="lecturer">The lecturer’s voice, where they have authorised it</option>
          {PLATFORM_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label} — {v.blurb}</option>)}
        </select>

        <label className="mt-3 block text-[11px] uppercase tracking-wide text-ink-faint">Speed</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SPEEDS.map((speed) => (
            <button
              key={speed} type="button" disabled={busy}
              onClick={() => save({ action: 'listening', speed })}
              className={`rounded border px-2.5 py-1 text-xs ${
                (person.audioSpeed ?? 1) === speed
                  ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </Card>

      <Card className="px-5 py-4 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Accessibility size={16} className="text-brand" /> Reading and using this platform
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          These are yours. Nobody sets them for you, and no screen anywhere reports them to your
          lecturers or to the registry. They change how a page is presented and never a word of
          what it says.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACCESSIBILITY_CHOICES.map((choice) => {
            const current = settingsOf(person.accessibility)[choice.key];
            return (
              <div key={choice.key}>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">{choice.label}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {choice.options.map((option) => (
                    <button
                      key={String(option.value)} type="button" disabled={busy}
                      onClick={() => save({ action: 'accessibility', settings: { [choice.key]: option.value } })}
                      className={`rounded border px-2.5 py-1 text-xs ${
                        current === option.value
                          ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">{choice.blurb}</p>
              </div>
            );
          })}
        </div>

        {/* SAYING WHAT THIS IS NOT. A caption that claims to be synchronised
            and is not is worse than one that never claimed it. */}
        <p className="mt-4 rounded border border-page-line bg-page px-3 py-2 text-xs text-ink-soft">
          “Always shown” puts the spoken script beside the audio. It is not a timed caption track:
          the speech services this platform talks to return audio and a length, not word timings,
          so nothing here highlights a word as it is said.
        </p>
      </Card>

      {!isStudent && (
        <Card className="px-5 py-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Mic size={16} className="text-brand" /> Your voice
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            A voice is a person. This platform will never synthesise yours unless you authorise it
            here, and you can withdraw that at any time — including for audio that has already
            been made.
          </p>

          {person.voiceConsent && !person.voiceConsent.revokedAt ? (
            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm text-ok">
                <ShieldCheck size={14} />
                Authorised on {new Date(person.voiceConsent.authorisedAt).toLocaleDateString()} for{' '}
                {person.voiceConsent.scope === 'all-audio'
                  ? 'all lecture audio' : 'translated lecture audio only'}.
              </p>
              <button
                type="button" onClick={() => save({ action: 'revoke-voice' })} disabled={busy}
                className="mt-2 rounded border border-page-line bg-white px-3 py-1.5 text-xs text-ink-soft"
              >
                Withdraw permission
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button" disabled={busy}
                onClick={() => save({ action: 'authorise-voice', scope: 'translated-audio' })}
                className="rounded-md border border-page-line bg-white px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
              >
                Authorise for translated audio only
              </button>
              <button
                type="button" disabled={busy}
                onClick={() => save({ action: 'authorise-voice', scope: 'all-audio' })}
                className="rounded-md border border-page-line bg-white px-3.5 py-2 text-sm text-ink-soft hover:border-brand/40"
              >
                Authorise for all lecture audio
              </button>
              {person.voiceConsent?.revokedAt && (
                <p className="w-full text-xs text-ink-faint">
                  Withdrawn on {new Date(person.voiceConsent.revokedAt).toLocaleDateString()}. The
                  record is kept; the voice is not used.
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
