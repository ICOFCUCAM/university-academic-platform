'use client';

import { useState } from 'react';
import { ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import { LANGUAGE_BY_CODE } from '@/lib/i18n/languages';

interface Step {
  artefactId: string;
  kind: string;
  language: string;
  version: number;
  state: string;
  origin: string;
  producedBy?: string;
  correctedByLecturer: boolean;
  approvedByName?: string;
  approvedAt?: string;
  reviewedByName?: string;
  translationOf?: string;
  versionsKept: number;
  staleSince?: string;
}

/**
 * WHERE THIS CAME FROM, as a chain rather than a claim.
 *
 *   Lecture 08 → Approved master v3 → French translation v2 → Notes v2
 *
 * Closed by default, because a lecturer reading their own notes does not need
 * it and a university auditing a disputed sentence does. Every line is a field
 * that was written when the thing was made: no bodies come back, so opening
 * this is never a way to read a draft nobody published.
 */
export function Provenance({ artefactId }: { artefactId: string }) {
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen((v) => !v);
    if (chain || error) return;
    try {
      const response = await fetch(`/api/artefacts/${artefactId}/provenance`);
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      setChain(payload.chain);
    } catch {
      setError('The chain could not be read.');
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button" onClick={load}
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-brand-dark"
      >
        <GitBranch size={13} />
        Where this came from
        <ChevronDown size={13} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-page-line bg-page px-4 py-3">
          {error && <p className="text-xs text-bad">{error}</p>}
          {!chain && !error && (
            <p className="flex items-center gap-2 text-xs text-ink-soft">
              <Loader2 size={12} className="animate-spin" /> Reading the chain…
            </p>
          )}
          {chain && (
            <ol className="space-y-2">
              {chain.map((step, i) => (
                <li key={step.artefactId} className="flex gap-3 text-xs">
                  <span className="w-4 shrink-0 text-ink-faint">{i + 1}</span>
                  <span>
                    <strong className="font-medium">{step.kind.replace(/_/g, ' ')}</strong>
                    <span className="text-ink-faint"> · v{step.version}</span>
                    <span className="text-ink-faint">
                      {' · '}{LANGUAGE_BY_CODE[step.language]?.name ?? step.language}
                    </span>
                    {step.translationOf && <span className="text-ink-faint"> · translation</span>}
                    <span className="block text-ink-soft">
                      {/* WHO WROTE IT: the model, or the person who took it over. */}
                      {step.correctedByLecturer
                        ? 'corrected by the lecturer, which makes this the authoritative version'
                        : step.origin === 'lecturer' ? 'the lecturer’s own'
                          : `made by ${step.producedBy ?? 'the engine'}`}
                      {step.approvedByName && ` · approved by ${step.approvedByName}`}
                      {step.reviewedByName && ` · read by ${step.reviewedByName}`}
                      {step.versionsKept > 0 && ` · ${step.versionsKept} earlier version${step.versionsKept === 1 ? '' : 's'} kept`}
                    </span>
                    {step.staleSince && (
                      <span className="block text-warn">
                        the step it was made from has changed since
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
