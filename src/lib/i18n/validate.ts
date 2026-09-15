// ---------------------------------------------------------------------------
// VALIDATING A TRANSLATION WITHOUT READING THE LANGUAGE.
//
// Nobody at this university reads all seven languages, and the platform cannot
// wait for somebody who does before it knows whether a translation is broken.
// So this file checks the things that are TRUE IN EVERY LANGUAGE:
//
//   the lecturer's protected terms are there, the same number of times;
//   every figure in the lecture is in the translation;
//   the structure is the same shape — the same headings, the same number of
//   questions, the same number of list items;
//   and the length is not absurd, because a translation half the length of its
//   original has dropped something and one twice the length has explained.
//
// None of that tells you the translation is GOOD. It tells you it is not
// obviously broken, which is a different and much cheaper claim, and it is the
// claim that decides whether a human reviewer is asked to spend an hour on it.
//
// A REJECTION HERE IS A REJECTION, not a note for somebody to weigh: the
// artefact fails and is not published. A warning is shown to whoever reviews.
// ---------------------------------------------------------------------------

export type Severity = 'reject' | 'warn';

export interface TranslationFinding {
  severity: Severity;
  kind: 'marker-lost' | 'marker-invented' | 'figure-lost' | 'structure' | 'length';
  note: string;
}

/**
 * Eastern Arabic and Devanagari digits are the same numbers. A translation
 * that writes ١٩٤٥ for 1945 is right, and a checker that called it a lost
 * figure would make the Arabic unusable.
 */
function asciiDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
}

/** Every figure the lecture states: years, counts, percentages, amounts. */
export function figures(text: string): string[] {
  const normalised = asciiDigits(text)
    // 1,000 and 1 000 and 1.000 are one number written three ways.
    .replace(/(\d)[ ,  ](\d{3})\b/g, '$1$2');
  return (normalised.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((n) => n.replace(/[.,]0+$/, ''));
}

function markers(text: string): string[] {
  return (text.match(/⟦T\d+⟧/g) ?? []);
}

function headings(text: string): number {
  return (text.match(/^#{1,6}\s+\S/gm) ?? []).length;
}

function listItems(text: string): number {
  return (text.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm) ?? []).length;
}

/**
 * Question/answer pairs, in any of the languages here: the marker is the
 * structure ("Q." / "A.", "1." … ) rather than the word, because "Question"
 * is "سؤال" in the Arabic and counting English words would find none.
 */
function qaPairs(text: string): number {
  return (text.match(/^\s*(?:Q|A)[.):]\s+\S/gm) ?? []).length;
}

export interface TranslationValidation {
  ok: boolean;
  findings: TranslationFinding[];
  /** Set when the translation must be rejected rather than reviewed. */
  rejection?: string;
}

export function validateTranslation(source: string, translation: string): TranslationValidation {
  const findings: TranslationFinding[] = [];

  // ---- 1. THE LECTURER'S PROTECTED TERMS --------------------------------
  const sourceMarkers = markers(source);
  const outMarkers = markers(translation);
  const countOf = (list: string[]) => list.reduce((map, m) => map.set(m, (map.get(m) ?? 0) + 1), new Map<string, number>());
  const before = countOf(sourceMarkers);
  const after = countOf(outMarkers);

  before.forEach((n, marker) => {
    const got = after.get(marker) ?? 0;
    if (got < n) {
      findings.push({
        severity: 'reject',
        kind: 'marker-lost',
        note: `A protected term appears ${n} time(s) in the original and ${got} in the translation. The lecturer's terminology is not translated, transliterated or dropped.`,
      });
    }
  });
  after.forEach((_n, marker) => {
    if (!before.has(marker)) {
      findings.push({
        severity: 'reject',
        kind: 'marker-invented',
        note: 'The translation contains a protected-term marker that is not in the original.',
      });
    }
  });

  // ---- 2. EVERY FIGURE THE LECTURE STATES -------------------------------
  //
  // A figure that vanished is a fact that vanished, and it is the failure a
  // reader of the translation is least able to notice: there is nothing on the
  // page where the number used to be.
  const sourceFigures = figures(source);
  const outFigures = new Set(figures(translation));
  const lost = [...new Set(sourceFigures)].filter((n) => !outFigures.has(n));
  if (lost.length) {
    findings.push({
      severity: 'reject',
      kind: 'figure-lost',
      note: `${lost.length === 1 ? 'A figure is' : `${lost.length} figures are`} in the lecture and not in the translation: ${lost.slice(0, 8).join(', ')}.`,
    });
  }

  // ---- 3. THE SAME SHAPE -------------------------------------------------
  const shape = [
    ['headings', headings(source), headings(translation)],
    ['list items', listItems(source), listItems(translation)],
    ['question and answer lines', qaPairs(source), qaPairs(translation)],
  ] as const;

  for (const [what, a, b] of shape) {
    if (a === b) continue;
    // A heading lost is a section lost. An item lost might be two bullets
    // merged by a translator with a long sentence — worth seeing, not worth
    // throwing the run away.
    const severity: Severity = what === 'headings' ? 'reject' : 'warn';
    findings.push({
      severity,
      kind: 'structure',
      note: `The original has ${a} ${what}; the translation has ${b}.`,
    });
  }

  // ---- 4. AND IS IT PLAUSIBLY THE SAME THING AT ALL? --------------------
  //
  // Ratios are wide on purpose: Chinese is far shorter than English in
  // characters and Arabic is longer, and neither is a fault. What this catches
  // is a translation that stopped a third of the way through, or one that
  // turned four hundred words into a two-thousand-word explanation.
  const ratio = translation.trim().length / Math.max(1, source.trim().length);
  if (ratio < 0.45 || ratio > 2.6) {
    findings.push({
      severity: ratio < 0.45 ? 'reject' : 'warn',
      kind: 'length',
      note: ratio < 0.45
        ? `The translation is ${Math.round(ratio * 100)}% of the length of the original, which means something was left out.`
        : `The translation is ${Math.round(ratio * 100)}% of the length of the original, which usually means something was explained rather than translated.`,
    });
  }

  const rejections = findings.filter((f) => f.severity === 'reject');
  return {
    ok: rejections.length === 0,
    findings,
    rejection: rejections.length
      ? `${rejections[0].note} This translation was rejected rather than published.`
      : undefined,
  };
}
