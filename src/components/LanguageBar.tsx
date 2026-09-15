'use client';

import { Check, Globe, Languages, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { LANGUAGES, LANGUAGE_BY_CODE, STANDING_NOTE, type TranslationStanding } from '@/lib/i18n/languages';

export interface LanguageRow {
  code: string;
  /** Does anything exist in this language yet? */
  exists: boolean;
  standing?: TranslationStanding;
  published: number;
}

/**
 * MASTER, AND ITS DERIVATIVES.
 *
 *   MASTER — English, lecturer approved
 *      ├── French   ├── Spanish  ├── Portuguese
 *      ├── Arabic   ├── Chinese  └── Swahili …
 *
 * Every language hangs off the lecturer's approved original and none off
 * another, so a student in Nairobi and a student in Lyon are reading two
 * renderings of one lecture rather than the end of a chain.
 */
export function LanguageBar({
  original, rows, selected, offered, canTranslate, busy, onSelect, onTranslate,
}: {
  original: string;
  rows: LanguageRow[];
  selected: string;
  /** Languages this course means to be available in. */
  offered: string[];
  canTranslate: boolean;
  busy: string | null;
  onSelect: (code: string) => void;
  onTranslate: (code: string) => void;
}) {
  const known = (code: string) => LANGUAGE_BY_CODE[code] ?? { code, name: code, endonym: code, dir: 'ltr' as const };
  const row = (code: string) => rows.find((r) => r.code === code);

  const offer = [...new Set([original, ...offered, ...rows.map((r) => r.code)])];
  const addable = canTranslate
    ? LANGUAGES.filter((l) => l.code !== original && !offer.includes(l.code))
    : [];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-page-line bg-page-card px-6 py-3 md:px-8">
      <Globe size={15} className="text-ink-faint" />

      {offer.map((code) => {
        const language = known(code);
        const state = row(code);
        const isMaster = code === original;
        const active = selected === code;

        return (
          <button
            key={code}
            type="button"
            onClick={() => (state?.exists || isMaster ? onSelect(code) : onTranslate(code))}
            disabled={busy !== null}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              active ? 'border-brand bg-brand text-white'
                : state?.exists || isMaster ? 'border-page-line bg-white text-ink-soft hover:border-brand/40'
                  : 'border-dashed border-page-line bg-page text-ink-faint hover:border-brand/40'
            }`}
            title={state?.standing ? STANDING_NOTE[state.standing] : undefined}
          >
            {busy === code && <Loader2 size={12} className="animate-spin" />}
            <span>{language.endonym}</span>
            {isMaster ? (
              <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-faint'}`}>
                master
              </span>
            ) : state?.exists ? (
              state.standing === 'reviewed' ? <ShieldCheck size={12} className={active ? '' : 'text-ok'} />
                : state.standing === 'stale' ? <TriangleAlert size={12} className={active ? '' : 'text-bad'} />
                  : <span className={`text-[10px] ${active ? 'text-white/80' : 'text-ink-faint'}`}>unread</span>
            ) : (
              <Languages size={12} />
            )}
          </button>
        );
      })}

      {addable.length > 0 && (
        <select
          className="rounded-full border border-dashed border-page-line bg-page px-3 py-1.5 text-xs text-ink-soft"
          value=""
          onChange={(event) => event.target.value && onTranslate(event.target.value)}
          disabled={busy !== null}
        >
          <option value="">Add a language…</option>
          {addable.map((l) => <option key={l.code} value={l.code}>{l.name} — {l.endonym}</option>)}
        </select>
      )}
    </div>
  );
}

/**
 * What a reader of a translation is told, every time. Silence here would mean
 * a student in Nairobi could not tell an approved rendering from a machine's
 * first pass at one.
 */
export function StandingNote({
  standing, original, onReadOriginal,
}: {
  standing: TranslationStanding;
  original: string;
  onReadOriginal: () => void;
}) {
  const tone = standing === 'reviewed' ? 'border-emerald-200 bg-emerald-50'
    : standing === 'stale' ? 'border-red-200 bg-red-50'
      : 'border-amber-200 bg-amber-50';

  return (
    <div className={`rounded-md border px-4 py-3 text-sm text-ink-soft ${tone}`}>
      <p className="flex items-center gap-1.5">
        {standing === 'reviewed' ? <ShieldCheck size={14} className="text-ok" />
          : <TriangleAlert size={14} className={standing === 'stale' ? 'text-bad' : 'text-warn'} />}
        {STANDING_NOTE[standing]}
      </p>
      <button
        type="button" onClick={onReadOriginal}
        className="mt-1.5 text-xs font-medium text-brand hover:underline"
      >
        Read the {LANGUAGE_BY_CODE[original]?.name ?? original} original — it is what the lecturer taught
      </button>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text)}
      className="inline-flex items-center gap-1.5 rounded border border-page-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-brand/40"
    >
      <Check size={13} /> Copy
    </button>
  );
}
