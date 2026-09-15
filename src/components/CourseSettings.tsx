'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Coins, Mic2, Tags } from 'lucide-react';
import type { CompletionRule } from '@/lib/credential/certificate';
import { Card } from '@/components/ui';

interface VoiceOption { id: string; label: string; blurb: string }

/**
 * SETTING UP A COURSE — the half of it that is the lecturer's.
 *
 * The terms that are never substituted, what completing it means, and what it
 * is spoken in. Not who may enrol and not whether it is running: those are the
 * institution's, and this screen does not offer them.
 */
export function CourseSettings({
  courseId, terminology, completion, defaultVoice, allowedVoices, voices, costs, lectures,
}: {
  courseId: string;
  terminology: string[];
  completion?: CompletionRule;
  defaultVoice?: string;
  allowedVoices: string[];
  voices: VoiceOption[];
  costs: { runs: number; unmetered: boolean; outputTokens: number; charactersOut: number; byStage: { stage: string; runs: number; outputTokens: number }[] };
  lectures: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(terminology.join('\n'));
  const [rule, setRule] = useState<CompletionRule>(completion ?? {});

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

  const number = (value: string) => (value.trim() === '' ? undefined : Number(value));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad lg:col-span-2">{error}</p>
      )}

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Tags size={16} className="text-brand" /> Terms that are never changed
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          One per line. These are held mechanically: the transformation is not asked to respect
          them, it is checked afterwards and its output is rejected if a term came back
          substituted, translated or respelled. A term that is not here is a term nothing defends.
        </p>
        <textarea
          value={terms}
          onChange={(event) => setTerms(event.target.value)}
          rows={6}
          className="mt-3 w-full rounded-md border border-page-line px-3 py-2 font-mono text-sm"
          placeholder={'Yahuah\nYahusha HaMashiach'}
        />
        <button
          type="button" disabled={busy}
          onClick={() => save({ action: 'terminology', terms: terms.split('\n') })}
          className="mt-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Save the list
        </button>
      </Card>

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Mic2 size={16} className="text-brand" /> The voice this course is spoken in
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          A voice changes how a lesson sounds and nothing about what it says, so a student still
          chooses among what you allow here. Your own voice is not on this list: that is consent,
          and it is given in your profile, by you.
        </p>

        <label className="mt-3 block text-[11px] uppercase tracking-wide text-ink-faint">Default</label>
        <select
          className="mt-1 w-full rounded-md border border-page-line px-3 py-2 text-sm"
          value={defaultVoice ?? ''} disabled={busy}
          onChange={(event) => save({ action: 'voice', defaultVoice: event.target.value || null })}
        >
          <option value="">No default — the platform’s first voice</option>
          {voices.map((v) => <option key={v.id} value={v.id}>{v.label} — {v.blurb}</option>)}
        </select>

        <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-faint">Allowed on this course</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {voices.map((voice) => {
            const on = allowedVoices.length === 0 || allowedVoices.includes(voice.id);
            return (
              <button
                key={voice.id} type="button" disabled={busy}
                onClick={() => {
                  const base = allowedVoices.length ? allowedVoices : voices.map((v) => v.id);
                  const next = on ? base.filter((id) => id !== voice.id) : [...base, voice.id];
                  save({ action: 'voice', allowedVoices: next });
                }}
                className={`rounded border px-2.5 py-1 text-xs ${
                  on ? 'border-brand bg-brand text-white' : 'border-page-line text-ink-soft'
                }`}
              >
                {voice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          {allowedVoices.length ? `${allowedVoices.length} allowed.` : 'All of them, because none have been ruled out.'}
        </p>

      </Card>

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Award size={16} className="text-brand" /> What completing this course means
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Until you say, no certificate can be issued on this course — a course that has not said
          what completion is does not certify anything, and the platform will not decide it for
          you. Leave a box empty to leave that requirement out.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            ['lecturesRead', 'Proportion of lectures read', '0.8', 'Of the lectures published. 0.8 is four in five.'],
            ['quizzesTaken', 'Quizzes sat', '3', 'However many they sit, of the ones this course offers.'],
            ['quizAverage', 'Average across them, %', '60', 'Only the quizzes that were machine-marked count.'],
            ['assignmentsMarked', 'Assignments marked and returned', '1', 'Marked by a person, not by the platform.'],
          ] as const).map(([key, label, placeholder, blurb]) => (
            <div key={key}>
              <label className="block text-[11px] uppercase tracking-wide text-ink-faint">{label}</label>
              <input
                type="number" step="any" min={0} placeholder={placeholder}
                className="mt-1 w-full rounded-md border border-page-line px-3 py-2 text-sm"
                value={rule[key] ?? ''}
                onChange={(event) => setRule({ ...rule, [key]: number(event.target.value) })}
              />
              <p className="mt-1 text-xs text-ink-faint">{blurb}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button" disabled={busy}
            onClick={() => save({ action: 'completion', rule })}
            className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Save what completion means
          </button>
          {completion && (
            <button
              type="button" disabled={busy}
              onClick={() => { setRule({}); save({ action: 'completion', rule: null }); }}
              className="rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft"
            >
              Certify nothing on this course
            </button>
          )}
        </div>
      </Card>

      <Card className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Coins size={16} className="text-brand" /> What this course has cost to process
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every run, from what the service itself reported — never an estimate. Where a service
          reported no usage this says so rather than showing a confident zero.
        </p>

        {costs.runs === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            Nothing has been processed on this course yet.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Runs</dt>
                <dd className="text-lg font-semibold">{costs.runs}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Across</dt>
                <dd className="text-lg font-semibold">{lectures} lectures</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Output</dt>
                <dd className="text-lg font-semibold">
                  {costs.unmetered
                    ? `${Math.round(costs.charactersOut / 1000)}k chars`
                    : `${costs.outputTokens.toLocaleString()} tokens`}
                </dd>
              </div>
            </dl>

            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              {costs.byStage.map((row) => (
                <li key={row.stage} className="flex justify-between border-b border-page-line py-1">
                  <span>{row.stage.replace(/_/g, ' ')}</span>
                  <span>
                    {row.runs} run{row.runs === 1 ? '' : 's'}
                    {costs.unmetered ? '' : ` · ${row.outputTokens.toLocaleString()} tokens out`}
                  </span>
                </li>
              ))}
            </ul>

            {costs.unmetered && (
              <p className="mt-3 rounded border border-page-line bg-page px-3 py-2 text-xs text-ink-soft">
                No service reported token usage for these runs — they were made by the offline
                processor, which costs nothing and is not what production will look like. Tokens
                and characters, not money: this platform does no currency conversion.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
