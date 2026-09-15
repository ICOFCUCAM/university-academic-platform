'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Pencil, Play, RotateCw, Send, Undo2 } from 'lucide-react';
import type { Artefact, ArtefactKind, Lecture } from '@/lib/domain/types';
import { MODES, PERSONAS, type AudioMode, type Persona } from '@/lib/ai/audioModes';
import { REVISION_LABEL, type RevisionKind } from '@/lib/ai/prompts';
import { Markdown } from '@/components/Markdown';
import { StateBadge } from '@/components/ui';

interface Stage {
  kind: ArtefactKind;
  label: string;
  purpose: string;
  from: ArtefactKind | null;
  requiresApprovedSource: boolean;
  studentFacing: boolean;
}

export function LectureWorkspace({
  lecture, stages, artefacts: initial, canEdit, student,
}: {
  lecture: Lecture;
  stages: Stage[];
  artefacts: Artefact[];
  canEdit: boolean;
  student: boolean;
}) {
  const router = useRouter();
  const [artefacts, setArtefacts] = useState(initial);
  const [busy, setBusy] = useState<ArtefactKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ArtefactKind>(() => {
    const published = initial.find((a) => a.kind === 'structured_notes' && a.state === 'published');
    return published ? 'structured_notes' : (initial[initial.length - 1]?.kind ?? 'transcript');
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<AudioMode>('lesson_15');
  const [persona, setPersona] = useState<Persona>('tutor');
  const [revision, setRevision] = useState<RevisionKind>('full');
  const [compare, setCompare] = useState(false);

  const byKind = useMemo(
    () => Object.fromEntries(artefacts.map((a) => [a.kind, a])) as Partial<Record<ArtefactKind, Artefact>>,
    [artefacts],
  );
  const shown = byKind[open];

  const replace = (artefact: Artefact) =>
    setArtefacts((list) => {
      const at = list.findIndex((a) => a.id === artefact.id || a.kind === artefact.kind);
      if (at < 0) return [...list, artefact];
      const next = [...list];
      next[at] = artefact;
      return next;
    });

  async function run(kind: ArtefactKind) {
    setBusy(kind); setError(null);
    try {
      const response = await fetch(`/api/lectures/${lecture.id}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, mode, persona, revision }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      replace(payload.artefact);
      setOpen(kind);
      if (payload.artefact.state === 'failed') setError(payload.artefact.error);
      router.refresh();
    } finally { setBusy(null); }
  }

  async function act(artefact: Artefact, action: string, body?: string) {
    setBusy(artefact.kind); setError(null);
    try {
      const response = await fetch(`/api/artefacts/${artefact.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, body }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      replace(payload.artefact);
      setDraft(null);
      router.refresh();
    } finally { setBusy(null); }
  }

  const source = shown ? stages.find((s) => s.kind === shown.kind)?.from : null;
  const sourceArtefact = source ? byKind[source] : undefined;

  return (
    <div className="grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[260px_1fr]">
      {/* ---- THE PIPELINE, AS A COLUMN YOU CAN WATCH FILL IN ------------- */}
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Pipeline</h2>
        {stages.map((stage) => {
          const artefact = byKind[stage.kind];
          const state = artefact?.state ?? 'absent';
          const blocked = stage.from
            ? !['ready', 'approved', 'published'].includes(byKind[stage.from]?.state ?? '')
              || (stage.requiresApprovedSource && byKind[stage.from]?.state === 'ready')
            : false;

          return (
            <div
              key={stage.kind}
              className={`rounded-md border px-3 py-2.5 ${
                open === stage.kind ? 'border-brand/50 bg-brand-tint' : 'border-page-line bg-page-card'
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => artefact && setOpen(stage.kind)}
                disabled={!artefact}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm ${artefact ? 'font-medium' : 'text-ink-faint'}`}>{stage.label}</span>
                  <StateBadge state={state} />
                </div>
                {artefact?.staleSince && (
                  <p className="mt-1 text-[11px] text-warn">
                    Made from an older version — regenerate.
                  </p>
                )}
              </button>

              {canEdit && stage.from && (
                <button
                  type="button"
                  onClick={() => run(stage.kind)}
                  disabled={busy !== null || blocked}
                  className="mt-2 inline-flex items-center gap-1.5 rounded border border-page-line bg-white px-2 py-1 text-[11px] text-ink-soft disabled:opacity-40 hover:border-brand/40"
                  title={blocked ? `${stages.find((s) => s.kind === stage.from)?.label} must be approved first` : ''}
                >
                  {busy === stage.kind ? <Loader2 size={12} className="animate-spin" /> : artefact ? <RotateCw size={12} /> : <Play size={12} />}
                  {artefact ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
          );
        })}

        {canEdit && (
          <div className="rounded-md border border-page-line bg-page-card px-3 py-3 space-y-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-ink-faint">Audio mode</label>
              <select
                className="mt-1 w-full rounded border border-page-line px-2 py-1 text-xs"
                value={mode} onChange={(e) => setMode(e.target.value as AudioMode)}
              >
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-ink-faint">
                {MODES.find((m) => m.id === mode)?.blurb}
              </p>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-ink-faint">Teaching voice</label>
              <select
                className="mt-1 w-full rounded border border-page-line px-2 py-1 text-xs"
                value={persona} onChange={(e) => setPersona(e.target.value as Persona)}
              >
                {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-ink-faint">Revision set</label>
              <select
                className="mt-1 w-full rounded border border-page-line px-2 py-1 text-xs"
                value={revision} onChange={(e) => setRevision(e.target.value as RevisionKind)}
              >
                {Object.entries(REVISION_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </aside>

      {/* ---- THE ARTEFACT ------------------------------------------------ */}
      <div className="min-w-0 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-bad">{error}</div>
        )}

        {!shown ? (
          <div className="rounded-lg border border-dashed border-page-line bg-page-card px-6 py-10 text-center text-sm text-ink-soft">
            Nothing has been made from this lecture yet.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {stages.find((s) => s.kind === shown.kind)?.label}
                </h2>
                <p className="text-xs text-ink-faint">
                  Version {shown.version}
                  {shown.correctedByLecturer ? ' · corrected by the lecturer' : ''}
                  {shown.producedBy ? ` · ${shown.producedBy}` : ''}
                  {shown.approvedByName ? ` · approved by ${shown.approvedByName}` : ''}
                </p>
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {sourceArtefact?.body && shown.kind === 'corrected_text' && (
                    <button
                      type="button" onClick={() => setCompare((v) => !v)}
                      className="rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-brand/40"
                    >
                      {compare ? 'Hide original' : 'Compare with transcript'}
                    </button>
                  )}
                  {draft === null ? (
                    <button
                      type="button" onClick={() => setDraft(shown.body ?? '')}
                      className="inline-flex items-center gap-1.5 rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-brand/40"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button" onClick={() => act(shown, 'edit', draft)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
                      >
                        <Check size={13} /> Save correction
                      </button>
                      <button
                        type="button" onClick={() => setDraft(null)}
                        className="rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {shown.state === 'ready' && (
                    <button
                      type="button" onClick={() => act(shown, 'approve')}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-ok"
                    >
                      <Check size={13} /> Approve
                    </button>
                  )}
                  {shown.state === 'approved' && (
                    <button
                      type="button" onClick={() => act(shown, 'publish')}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Send size={13} /> Publish to students
                    </button>
                  )}
                  {shown.state === 'published' && (
                    <button
                      type="button" onClick={() => act(shown, 'withdraw')}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft"
                    >
                      <Undo2 size={13} /> Withdraw
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* WHERE THIS CAME FROM, on the face of the material. Generated
                from the lecturer's own recording, language and structure
                processed, substance preserved — and an artefact the offline
                processor made says that instead. */}
            {shown.origin !== 'lecturer' && (
              <div className="rounded-md border border-page-line bg-page px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-semibold uppercase tracking-wide text-ink-faint">Lecture content</span>
                {' — generated from the lecturer’s recording. The AI processed the language and '}
                structure; the substance of the lecture is unchanged.
              </div>
            )}
            {shown.origin === 'lecturer' && shown.correctedByLecturer && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-semibold uppercase tracking-wide text-ok">Corrected by the lecturer</span>
                {' — this is the authoritative version. Everything built from it is regenerated from here.'}
              </div>
            )}

            {shown.state === 'ready' && canEdit && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink-soft">
                <strong className="text-warn">Not yet seen by anybody but you.</strong> Read it, correct
                anything the machine got wrong, then approve it. Students receive nothing until you publish.
              </div>
            )}

            {/* THE VERIFIER'S REPORT. Not "is the lecturer right" — "did
                anything the lecturer said move". */}
            {shown.verification && (
              <div className={`rounded-md border px-4 py-3 text-sm ${
                shown.verification.error ? 'border-page-line bg-page text-ink-soft'
                  : shown.verification.flagged > 0 ? 'border-amber-200 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50'
              }`}>
                {shown.verification.error ? (
                  <p><strong>Not verified.</strong> {shown.verification.error}</p>
                ) : (
                  <>
                    <p>
                      <strong>
                        {shown.verification.preserved} claim
                        {shown.verification.preserved === 1 ? '' : 's'} preserved
                      </strong>
                      {shown.verification.flagged > 0
                        ? `, ${shown.verification.flagged} changed by the transformation.`
                        : '. Nothing the lecturer said was introduced, removed or altered.'}
                    </p>
                    {shown.verification.checks.filter((c) => c.status !== 'preserved').map((c, i) => (
                      <div key={i} className="mt-2 border-l-2 border-amber-300 pl-3 text-xs">
                        <p className="font-medium uppercase tracking-wide text-warn">{c.status}</p>
                        {c.original && <p className="text-ink-soft">Lecture: “{c.original}”</p>}
                        {c.output && <p className="text-ink-soft">Now: “{c.output}”</p>}
                        {c.note && <p className="text-ink-faint">{c.note}</p>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {shown.error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-bad">
                {shown.error}
              </div>
            )}

            {/* ORIGINAL | CORRECTED. "Improve the language, preserve the
                meaning" is a rule somebody has to be able to CHECK. */}
            {compare && sourceArtefact?.body ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-page-line bg-page-card p-5">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">As transcribed</p>
                  <div className="prose-academic whitespace-pre-wrap text-ink-soft">{sourceArtefact.body}</div>
                </div>
                <div className="rounded-lg border border-page-line bg-page-card p-5">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">Corrected</p>
                  <div className="prose-academic whitespace-pre-wrap">{shown.body}</div>
                </div>
              </div>
            ) : draft !== null ? (
              <textarea
                className="h-[32rem] w-full rounded-lg border border-page-line bg-page-card p-5 font-mono text-[13px] leading-6"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            ) : (
              <article className="rounded-lg border border-page-line bg-page-card p-6 md:p-8">
                {shown.kind === 'audio_15min' ? (
                  <div className="text-sm text-ink-soft">
                    {shown.mediaPath
                      ? <audio controls src={shown.mediaPath} className="w-full" />
                      : 'No speech service is configured, so this lesson exists as a script rather than a recording.'}
                  </div>
                ) : shown.body ? (
                  <Markdown source={shown.body} />
                ) : (
                  <p className="text-sm text-ink-faint">Nothing in this artefact yet.</p>
                )}
              </article>
            )}

            {student && shown.state === 'published' && shown.approvedByName && (
              <p className="text-xs text-ink-faint">Published by {shown.approvedByName}.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
