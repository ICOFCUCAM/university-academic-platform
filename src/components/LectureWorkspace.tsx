'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Languages, Loader2, Pencil, Play, RotateCw, Send, Undo2 } from 'lucide-react';
import type { Artefact, ArtefactKind, Lecture } from '@/lib/domain/types';
import { MODES, PERSONAS, type AudioMode, type Persona } from '@/lib/ai/audioModes';
import { REVISION_LABEL, type RevisionKind } from '@/lib/ai/prompts';
import { Markdown } from '@/components/Markdown';
import { WordCheck } from '@/components/WordCheck';
import { StateBadge } from '@/components/ui';
import { CopyButton, LanguageBar, LockedLanguage, StandingNote, type LanguageRow } from '@/components/LanguageBar';
import { ListeningPanel, type VoiceOfferView } from '@/components/ListeningPanel';
import { clock, direction, estimateSeconds, LANGUAGE_BY_CODE, TRANSLATABLE } from '@/lib/i18n/languages';

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
  originalLanguage, offeredLanguages, canTranslate, canApproveTranslation,
  workingLanguage, voices, voicePreference, audioSpeed,
}: {
  lecture: Lecture;
  stages: Stage[];
  artefacts: Artefact[];
  canEdit: boolean;
  student: boolean;
  originalLanguage: string;
  offeredLanguages: string[];
  canTranslate: boolean;
  canApproveTranslation: boolean;
  /** The student's own, from their learning profile. Locked for them. */
  workingLanguage?: string;
  voices: VoiceOfferView[];
  voicePreference?: string;
  audioSpeed?: number;
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
  const [checkingWords, setCheckingWords] = useState(false);
  // A student is in their working language and stays there. Staff move
  // between languages because reviewing them is their job.
  const [language, setLanguage] = useState(
    student ? workingLanguage ?? originalLanguage : originalLanguage,
  );
  const [translating, setTranslating] = useState<string | null>(null);
  const [showMaster, setShowMaster] = useState(false);
  const [confirming, setConfirming] = useState<ArtefactKind | null>(null);

  // ---- MASTER, AND ITS DERIVATIVES ---------------------------------------
  //
  // The lecturer's approved original is the master; every translation hangs
  // off it. Selecting a language selects which rendering of the lecture is on
  // the screen — never a different lecture.
  const inLanguage = useMemo(
    () => artefacts.filter((a) => (a.language ?? originalLanguage) === language
      && (language === originalLanguage ? !a.translatedFromId : !!a.translatedFromId)),
    [artefacts, language, originalLanguage],
  );
  const masters = useMemo(
    () => Object.fromEntries(artefacts.filter((a) => !a.translatedFromId).map((a) => [a.kind, a])) as Partial<Record<ArtefactKind, Artefact>>,
    [artefacts],
  );
  const byKind = useMemo(
    () => Object.fromEntries(inLanguage.map((a) => [a.kind, a])) as Partial<Record<ArtefactKind, Artefact>>,
    [inLanguage],
  );
  const shown = byKind[open];
  const master = masters[open];

  const languageRows: LanguageRow[] = useMemo(() => {
    const rows = new Map<string, LanguageRow>();
    rows.set(originalLanguage, { code: originalLanguage, exists: true, published: 0 });
    for (const artefact of artefacts) {
      const code = artefact.language ?? originalLanguage;
      const row = rows.get(code) ?? { code, exists: true, published: 0 };
      row.exists = true;
      if (artefact.state === 'published') row.published += 1;
      if (artefact.translationStanding) {
        row.standing = row.standing === 'stale' || artefact.translationStanding === 'stale' ? 'stale'
          : row.standing === 'unreviewed' || artefact.translationStanding === 'unreviewed' ? 'unreviewed'
            : artefact.translationStanding;
      }
      rows.set(code, row);
    }
    return [...rows.values()];
  }, [artefacts, originalLanguage]);

  const replace = (artefact: Artefact) =>
    setArtefacts((list) => {
      const at = list.findIndex((a) => a.id === artefact.id || a.kind === artefact.kind);
      if (at < 0) return [...list, artefact];
      const next = [...list];
      next[at] = artefact;
      return next;
    });

  async function run(kind: ArtefactKind, regenerate = false) {
    setBusy(kind); setError(null); setConfirming(null);
    try {
      const response = await fetch(`/api/lectures/${lecture.id}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, mode, persona, revision, regenerate }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      replace(payload.artefact);
      setOpen(kind);
      if (payload.artefact.state === 'failed') setError(payload.artefact.error);
      router.refresh();
    } finally { setBusy(null); }
  }

  async function translateKind(kind: ArtefactKind, code: string) {
    const source = masters[kind];
    if (!source) { setError('There is nothing approved to translate yet.'); return; }
    setTranslating(code); setError(null);
    try {
      const response = await fetch(`/api/artefacts/${source.id}/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: code }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      setArtefacts((list) => [...list.filter((a) => a.id !== payload.artefact.id), payload.artefact]);
      setLanguage(code);
      setOpen(kind);
      if (payload.artefact.state === 'failed') setError(payload.artefact.error);
      router.refresh();
    } finally { setTranslating(null); }
  }

  async function translate(code: string) {
    // TRANSLATED FROM THE MASTER, ALWAYS. Never from whatever happens to be on
    // the screen — a translation of a translation is how six languages become
    // six different lectures.
    const source = masters[open] ?? masters.structured_notes ?? masters.corrected_text;
    if (!source) { setError('There is nothing approved to translate yet.'); return; }
    setTranslating(code); setError(null);
    try {
      const response = await fetch(`/api/artefacts/${source.id}/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: code }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      setArtefacts((list) => [...list.filter((a) => a.id !== payload.artefact.id), payload.artefact]);
      setLanguage(code);
      setOpen(payload.artefact.kind);
      if (payload.artefact.state === 'failed') setError(payload.artefact.error);
      router.refresh();
    } finally { setTranslating(null); }
  }

  async function vouch(artefact: Artefact) {
    setBusy(artefact.kind); setError(null);
    try {
      const response = await fetch(`/api/artefacts/${artefact.id}/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); return; }
      replace(payload.artefact);
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

  const translated = language !== originalLanguage;
  const dir = direction(language);

  return (
    <>
    {student ? <LockedLanguage code={language} /> : <LanguageBar
      original={originalLanguage}
      rows={languageRows}
      selected={language}
      offered={offeredLanguages}
      canTranslate={canTranslate}
      busy={translating}
      onSelect={(code) => { setLanguage(code); setShowMaster(false); }}
      onTranslate={translate}
    />}
    <div className="grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[260px_1fr]">
      {/* ---- THE PIPELINE, AS A COLUMN YOU CAN WATCH FILL IN ------------- */}
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Pipeline</h2>
        {translated && (
          <p className="rounded-md border border-page-line bg-page px-3 py-2 text-[11px] text-ink-soft">
            Renderings of the master. A stage that is not here has not been
            translated — the lecture itself is on the English tab.
          </p>
        )}
        {stages.filter((stage) => !translated
          || (TRANSLATABLE as readonly string[]).includes(stage.kind)).map((stage) => {
          const artefact = byKind[stage.kind];
          const state = artefact?.state ?? 'absent';
          const source = stage.from ? byKind[stage.from] : undefined;
          // THE AUDIO HAS A SECOND GATE: the words of the script have to have
          // been read by a person. A voice cannot be proofread by its listener.
          const wordsUnchecked = !translated && stage.kind === 'audio_15min' && !source?.wordCheck;
          const blocked = stage.from
            ? !['ready', 'approved', 'published'].includes(source?.state ?? '')
              || (stage.requiresApprovedSource && source?.state === 'ready')
              || wordsUnchecked
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
                {wordsUnchecked && !artefact && (
                  <p className="mt-1 text-[11px] text-warn">
                    Check the script’s words first.
                  </p>
                )}
              </button>

              {translated && canTranslate && (
                <button
                  type="button"
                  onClick={() => translateKind(stage.kind, language)}
                  disabled={translating !== null || !masters[stage.kind]
                    || !['approved', 'published'].includes(masters[stage.kind]!.state)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded border border-page-line bg-white px-2 py-1 text-[11px] text-ink-soft disabled:opacity-40 hover:border-brand/40"
                  title={!masters[stage.kind] || !['approved', 'published'].includes(masters[stage.kind]!.state)
                    ? 'The original has to be approved before it is translated'
                    : ''}
                >
                  {translating === language ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                  {artefact ? 'Translate again' : 'Translate'}
                </button>
              )}
              {!translated && canEdit && stage.from && (() => {
                // ---- WRITING OVER AN APPROVAL IS A SECOND, DELIBERATE ACT --
                //
                // The approved master is immutable in substance, so the button
                // does not simply do it: it says what it will cost first, and
                // the lecturer presses again.
                const approved = artefact?.state === 'approved' || artefact?.state === 'published';
                const asking = confirming === stage.kind;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => (approved && !asking
                        ? setConfirming(stage.kind)
                        : run(stage.kind, approved))}
                      disabled={busy !== null || blocked}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] disabled:opacity-40 ${
                        asking ? 'border-red-300 bg-red-50 text-bad' : 'border-page-line bg-white text-ink-soft hover:border-brand/40'
                      }`}
                      title={wordsUnchecked
                        ? 'Check the words of the script first — a spoken mistake cannot be seen'
                        : blocked ? `${stages.find((s) => s.kind === stage.from)?.label} must be approved first` : ''}
                    >
                      {busy === stage.kind ? <Loader2 size={12} className="animate-spin" /> : artefact ? <RotateCw size={12} /> : <Play size={12} />}
                      {asking ? 'Yes — replace it' : artefact ? 'Regenerate' : 'Generate'}
                    </button>
                    {asking && (
                      <p className="mt-1 text-[11px] text-bad">
                        {artefact?.state === 'published'
                          ? 'Students are reading this. It will be withdrawn, your approval cleared, and every translation of it marked stale.'
                          : 'Your approval will be cleared and every translation of it marked stale.'}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}

        {canEdit && !translated && (
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
                  {LANGUAGE_BY_CODE[language]?.name ?? language}
                  {translated ? '' : ' · master'}
                  {' · '}Version {shown.version}
                  {shown.correctedByLecturer ? ' · corrected by the lecturer' : ''}
                  {shown.producedBy ? ` · ${shown.producedBy}` : ''}
                  {!translated && shown.approvedByName ? ` · approved by ${shown.approvedByName}` : ''}
                  {translated
                    ? shown.reviewedByName
                      ? ` · checked by ${shown.reviewedByName}`
                      : ' · read by nobody who speaks it'
                    : ''}
                  {/* "15-minute lesson" means ABOUT fifteen minutes: the same
                      lecture is 15:00 in English and 15:20 in Arabic, and
                      trimming the Arabic would mean cutting a sentence the
                      lecturer said. */}
                  {(shown.kind === 'teaching_script' || shown.kind === 'audio_15min') && shown.body
                    ? ` · 🎧 about ${clock(estimateSeconds(shown.body, language))}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {shown.body && <CopyButton text={shown.body} />}
                {translated && canApproveTranslation && shown.translationStanding !== 'reviewed' && (
                  <button
                    type="button" onClick={() => vouch(shown)} disabled={busy !== null}
                    className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-ok"
                  >
                    This says what the original says
                  </button>
                )}
                {translated && master && (
                  <button
                    type="button" onClick={() => setShowMaster((v) => !v)}
                    className="rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-brand/40"
                  >
                    {showMaster ? 'Hide the original' : 'Beside the original'}
                  </button>
                )}
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
                  {shown.kind === 'teaching_script' && (
                    <button
                      type="button" onClick={() => setCheckingWords((v) => !v)}
                      className={`rounded border px-2.5 py-1.5 text-xs ${
                        shown.wordCheck
                          ? 'border-emerald-300 bg-emerald-50 text-ok'
                          : 'border-amber-300 bg-amber-50 text-warn'
                      }`}
                    >
                      {shown.wordCheck ? `Words checked by ${shown.wordCheck.checkedBy}` : 'Check the words'}
                    </button>
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
            {shown.origin !== 'lecturer' && !translated && (
              <div className="rounded-md border border-page-line bg-page px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-semibold uppercase tracking-wide text-ink-faint">Lecture content</span>
                {' — generated from the lecturer’s recording. The AI processed the language and '}
                structure; the substance of the lecture is unchanged.
              </div>
            )}
            {translated && (
              <div className="rounded-md border border-page-line bg-page px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-semibold uppercase tracking-wide text-ink-faint">Translation</span>
                {' — carried from the '}
                {LANGUAGE_BY_CODE[originalLanguage]?.name ?? originalLanguage}
                {' master that '}
                {master?.approvedByName ?? 'the lecturer'}
                {' approved. The academic content is the same; only the language changes.'}
              </div>
            )}
            {shown.origin === 'lecturer' && shown.correctedByLecturer && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-ink-soft">
                <span className="font-semibold uppercase tracking-wide text-ok">Corrected by the lecturer</span>
                {' — this is the authoritative version. Everything built from it is regenerated from here.'}
              </div>
            )}

            {(shown.kind === 'audio_15min' || shown.kind === 'teaching_script') && (
              <ListeningPanel
                voices={voices}
                language={language}
                lockedForStudent={student}
                preference={voicePreference}
                speed={audioSpeed ?? 1}
              />
            )}

            {checkingWords && shown.kind === 'teaching_script' && (
              <WordCheck
                artefactId={shown.id}
                onDone={() => { setCheckingWords(false); router.refresh(); }}
              />
            )}

            {shown.state === 'ready' && canEdit && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink-soft">
                <strong className="text-warn">Not yet seen by anybody but you.</strong> Read it, correct
                anything the machine got wrong, then approve it. Students receive nothing until you publish.
              </div>
            )}

            {translated && shown.translationStanding && (
              <StandingNote
                standing={shown.translationStanding}
                original={originalLanguage}
                onReadOriginal={() => { setLanguage(originalLanguage); setShowMaster(false); }}
              />
            )}

            {shown.translationFindings && shown.translationFindings.length > 0 && (
              <div className="rounded-md border border-page-line bg-page px-4 py-3 text-sm">
                <p className="font-medium">What the language-agnostic checks found</p>
                <ul className="mt-1 space-y-1 text-xs text-ink-soft">
                  {shown.translationFindings.map((finding, i) => (
                    <li key={i}>
                      <span className={`font-medium uppercase tracking-wide ${
                        finding.severity === 'reject' ? 'text-bad' : 'text-warn'
                      }`}>
                        {finding.severity === 'reject' ? 'rejected' : 'check'}
                      </span>
                      {' · '}{finding.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* THE LECTURER'S OWN WORDS. Counted, not judged — and shown
                first, because a substituted name is invisible to the student
                who reads it and obvious to the lecturer who wrote it. */}
            {shown.terminology && shown.terminology.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm">
                <p className="font-medium text-bad">
                  {shown.terminology.length === 1
                    ? 'One of your terms did not survive this transformation.'
                    : `${shown.terminology.length} of your terms did not survive this transformation.`}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                  {shown.terminology.map((finding, i) => (
                    <li key={i}>
                      <span className="font-medium uppercase tracking-wide text-bad">{finding.kind}</span>
                      {' · '}{finding.note}
                    </li>
                  ))}
                </ul>
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
            ) : showMaster && master?.body ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-lg border border-page-line bg-page-card p-5">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">
                    {LANGUAGE_BY_CODE[originalLanguage]?.name ?? originalLanguage} — master, what the lecturer taught
                  </p>
                  <Markdown source={master.body} />
                </article>
                <article className="rounded-lg border border-page-line bg-page-card p-5" dir={dir}>
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint" dir="ltr">
                    {LANGUAGE_BY_CODE[language]?.name ?? language}
                  </p>
                  <Markdown source={shown.body ?? ''} />
                </article>
              </div>
            ) : (
              <article className="rounded-lg border border-page-line bg-page-card p-6 md:p-8" dir={dir}>
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

            {student && shown.state === 'published' && (
              <p className="text-xs text-ink-faint">
                {translated
                  ? `Translated from the original published by ${master?.approvedByName ?? shown.approvedByName ?? 'the lecturer'}.`
                  : shown.approvedByName ? `Published by ${shown.approvedByName}.` : null}
              </p>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}
