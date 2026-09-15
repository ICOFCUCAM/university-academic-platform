// ---------------------------------------------------------------------------
// THE LANGUAGES A LECTURE REACHES — AND THE ONE IT CAME FROM.
//
// One asymmetry runs through this whole layer and is worth stating before any
// code: THE ORIGINAL GOVERNS. A translation is a derived work of an approved
// lecture, it is always one click from the original, and where the two
// disagree the original is what the lecturer taught and what the student is
// examined on. Every screen that shows a translation says so.
//
// The second asymmetry is about who can vouch for what. A lecturer approves
// their own lecture; almost none of them can approve its Arabic. So a
// translation carries the approval of whoever actually read it — a reviewer who
// reads that language, or nobody, and "nobody" is said out loud on the page
// rather than implied by silence.
// ---------------------------------------------------------------------------

export interface Language {
  /** BCP-47. Stored on every artefact. */
  code: string;
  /** In English, for the lecturer's screens. */
  name: string;
  /** In the language itself, for the student's. */
  endonym: string;
  dir: 'ltr' | 'rtl';
  /**
   * How fast this language is spoken, for estimating a lesson's length.
   * Words a minute, except where `perCharacter` says the unit is characters —
   * counting "words" in Chinese would report a fifteen-minute lesson as four.
   *
   * A "15-minute lesson" means ABOUT fifteen minutes. The same lecture is
   * 15:00 in English, 15:12 in French and 15:20 in Arabic, and that is not a
   * fault to be corrected: faithfulness to what was taught beats hitting a
   * round number, and trimming the Arabic to 15:00 would mean cutting a
   * sentence the lecturer said.
   */
  rate: number;
  perCharacter?: boolean;
  /**
   * Whether a speech vendor for this language is a separate question from
   * whether the text exists. A translated lesson with no voice is still a
   * translated lesson, and the screen must not offer a play button for it.
   */
  speech: 'unknown';
}

/**
 * The set the University named, with English as the original of this build.
 * A deployment adds to this list; nothing else changes.
 */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', endonym: 'English', dir: 'ltr', rate: 140, speech: 'unknown' },
  { code: 'fr', name: 'French', endonym: 'Français', dir: 'ltr', rate: 150, speech: 'unknown' },
  { code: 'es', name: 'Spanish', endonym: 'Español', dir: 'ltr', rate: 160, speech: 'unknown' },
  { code: 'pt', name: 'Portuguese', endonym: 'Português', dir: 'ltr', rate: 155, speech: 'unknown' },
  { code: 'ar', name: 'Arabic', endonym: 'العربية', dir: 'rtl', rate: 130, speech: 'unknown' },
  { code: 'zh', name: 'Chinese', endonym: '中文', dir: 'ltr', rate: 240, perCharacter: true, speech: 'unknown' },
  { code: 'sw', name: 'Swahili', endonym: 'Kiswahili', dir: 'ltr', rate: 135, speech: 'unknown' },
  { code: 'de', name: 'German', endonym: 'Deutsch', dir: 'ltr', rate: 130, speech: 'unknown' },
  { code: 'no', name: 'Norwegian', endonym: 'Norsk', dir: 'ltr', rate: 140, speech: 'unknown' },
];

export const LANGUAGE_BY_CODE: Record<string, Language> =
  Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

export function languageName(code: string): string {
  return LANGUAGE_BY_CODE[code]?.name ?? code;
}

export function direction(code: string): 'ltr' | 'rtl' {
  return LANGUAGE_BY_CODE[code]?.dir ?? 'ltr';
}

/**
 * WHO STOOD BEHIND THIS TRANSLATION. Three states, and the difference between
 * them is the whole honesty of the feature.
 */
export type TranslationStanding =
  /** A person who reads this language approved it. */
  | 'reviewed'
  /** Machine translation of an approved original, read by nobody. */
  | 'unreviewed'
  /** Its source changed after it was made. */
  | 'stale';

export const STANDING_NOTE: Record<TranslationStanding, string> = {
  reviewed: 'Translated from the lecturer’s approved original and checked by a reviewer who reads this language.',
  unreviewed: 'Machine translation of the lecturer’s approved original. Nobody who reads this language has checked it yet — where it differs from the original, the original is what was taught.',
  stale: 'The original has been corrected since this translation was made. Read the original until this is remade.',
};


/**
 * How long this will take to say. Used for the "🎧 15:12" beside a lesson, and
 * for telling a lecturer that the Swahili came out at eleven minutes — which
 * usually means something was dropped, and is worth a look before it is voiced.
 */
export function estimateSeconds(text: string, code: string): number {
  const language = LANGUAGE_BY_CODE[code] ?? LANGUAGE_BY_CODE.en;
  const units = language.perCharacter
    ? (text.match(/[\u3400-\u9fff\u3040-\u30ff]/g) ?? []).length || text.replace(/\s/g, '').length
    : (text.match(/\S+/g) ?? []).length;
  return Math.round((units / language.rate) * 60);
}

/** 15:12, not "912 seconds". */
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * THE MASTER IS THE LECTURER'S APPROVED ORIGINAL. Every translation is a
 * derivative of it, and none is a derivative of another — so six languages are
 * six renderings of one lecture rather than a chain in which the sixth has
 * drifted from what was taught.
 */
export function isMaster(artefact: { translatedFromId?: string }): boolean {
  return !artefact.translatedFromId;
}


/**
 * The artefacts a student reads or listens to, and therefore the ones carried
 * into other languages. The transcript is working material nobody revises
 * from; the knowledge extraction is the course's own index, read by the Course
 * AI in the lecture's own language — two indexes could disagree.
 */
export const TRANSLATABLE = [
  'corrected_text', 'structured_notes', 'teaching_script', 'revision_materials',
] as const;
