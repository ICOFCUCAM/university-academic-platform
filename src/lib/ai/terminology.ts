// ---------------------------------------------------------------------------
// LECTURER TERMINOLOGY PRESERVATION.
//
// THE LECTURER'S TERMINOLOGY IS AUTHORITATIVE. A name is not a synonym, and a
// model's instinct to normalise one is the single most damaging thing it can do
// to a lecture — because the substitution is invisible. A student reading
// "Jesus Christ" where their lecturer said "Yahusha HaMashiach" has no way of
// knowing that the words in front of them were not the words that were taught,
// and they will reproduce the substitution in an examination sat by the person
// whose term was replaced.
//
//   Yahuah              → Yahuah.     NOT Jehovah, NOT Yahweh, NOT Lord.
//   Yahusha HaMashiach  → Yahusha HaMashiach.  NOT Jesus Christ.
//
// This file does two things, and the second is the one that matters:
//
//   1. It states the rule in every prompt, in the model's instructions.
//   2. IT CHECKS THE OUTPUT MECHANICALLY, WITHOUT A MODEL. A rule a model is
//      asked to follow is a rule nobody has watched. `checkTerminology`
//      counts the lecturer's terms in the source and in the result, finds the
//      substitutes that appeared from nowhere, and the review screen shows
//      what it found. No language model is consulted, so nothing here can be
//      talked round.
// ---------------------------------------------------------------------------

/** A term the lecturer uses, and the words a model is likely to reach for. */
export interface TermRule {
  term: string;
  /**
   * Words that must NOT appear in place of it. A substitute appearing in the
   * output while absent from the source is a substitution, and is reported
   * whether the model meant it or not.
   */
  substitutes: string[];
}

/**
 * The rules the specification names. A deployment adds its own — every
 * discipline has terms whose normalisation changes the teaching, and a
 * university sets them per course.
 */
export const DEFAULT_TERM_RULES: TermRule[] = [
  { term: 'Yahuah', substitutes: ['Jehovah', 'Yahweh', 'the LORD', 'Lord God'] },
  { term: 'Yahusha HaMashiach', substitutes: ['Jesus Christ', 'Jesus the Messiah', 'Christ Jesus'] },
  { term: 'Yahusha', substitutes: ['Jesus', 'Joshua'] },
];

export const TERMINOLOGY_RULE = `LECTURER TERMINOLOGY PRESERVATION

The lecturer's terminology is authoritative for transcription and
transformation.

Never substitute, normalise, translate, reinterpret or replace a proper name or
a technical, theological or disciplinary term used by the lecturer.

  Yahuah              → Yahuah
                        NOT Jehovah, NOT Yahweh, NOT Lord
  Yahusha HaMashiach  → Yahusha HaMashiach
                        NOT Jesus Christ

Preserve the exact lecturer-provided terminology everywhere: transcripts,
corrected text, notes, summaries, revision materials, teaching scripts, audio
lessons, and any answer built on this course's material. A spelling you would
have written differently is still theirs. An unfamiliar term is not an error.

If uncertain, preserve the original terminology rather than substituting an
alternative.`;

/**
 * Render the rule with this course's own glossary attached, so the lecturer's
 * terms are named in the instruction and not only in the check.
 */
export function terminologyBlock(glossary: string[] = []): string {
  if (!glossary.length) return TERMINOLOGY_RULE;
  return `${TERMINOLOGY_RULE}

TERMS THIS LECTURER USES, which appear exactly as written here and are never
replaced, regularised or expanded:
${glossary.map((term) => `  • ${term}`).join('\n')}`;
}

// ---------------------------------------------------------------------------
// TERM PROTECTION — before the model ever sees the text.
//
//   LECTURE → TRANSCRIPTION → TERM PROTECTION → AI TRANSFORMATION
//           → TERM VALIDATION → PUBLISHED CONTENT
//
// A rule in a prompt is a request. This is not a request: each protected term
// is replaced by an opaque marker before the text is sent, and restored after.
// The model never has the lecturer's term in front of it to normalise, and a
// marker is not a word any vocabulary contains, so there is nothing for a
// pretrained habit to reach for.
//
// WHY MARKERS AND NOT JUST CHECKING AFTERWARDS. Checking afterwards catches the
// substitution — and then the run is wasted, the lecturer is interrupted, and
// the cost has been paid. Protection means the common case never happens;
// validation is what catches the case where it somehow did.
// ---------------------------------------------------------------------------

export interface Protection {
  /** The text with each protected term replaced by its marker. */
  text: string;
  /** marker → the lecturer's exact term, capitalisation and all. */
  markers: Record<string, string>;
}

/**
 * Markers are deliberately ugly and deliberately stable: a model asked to
 * tidy prose leaves ⟦T1⟧ alone, and if it does not, `restoreTerms` can tell.
 */
const MARKER = (n: number) => `⟦T${n}⟧`;

export function protectTerms(
  text: string, options: { glossary?: string[]; rules?: TermRule[] } = {},
): Protection {
  const terms = [
    ...(options.rules ?? DEFAULT_TERM_RULES).map((r) => r.term),
    ...(options.glossary ?? []),
  ]
    // Longest first, so "Yahusha HaMashiach" is protected as one term rather
    // than as "Yahusha" followed by a word the model may then normalise.
    .sort((a, b) => b.length - a.length);

  const markers: Record<string, string> = {};
  let out = text;
  let n = 0;

  for (const term of terms) {
    if (!term.trim()) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
    if (!pattern.test(out)) continue;
    pattern.lastIndex = 0;
    const marker = MARKER(++n);
    markers[marker] = term;
    out = out.replace(pattern, marker);
  }

  return { text: out, markers };
}

export interface Restoration {
  text: string;
  /** Markers the model lost or mangled. Each one is a term that went missing. */
  missing: string[];
}

export function restoreTerms(text: string, markers: Record<string, string>): Restoration {
  let out = text;
  const missing: string[] = [];

  for (const [marker, term] of Object.entries(markers)) {
    if (!out.includes(marker)) {
      missing.push(term);
      continue;
    }
    out = out.split(marker).join(term);
  }

  // A marker the transformation invented, or mangled into ⟦T12⟧ from ⟦T1⟧:
  // left visible rather than silently deleted, because a reader seeing it
  // knows something went wrong, and a reader seeing nothing does not.
  return { text: out, missing };
}

export type FindingKind = 'substituted' | 'dropped' | 'respelled';

export interface TerminologyFinding {
  kind: FindingKind;
  term: string;
  /** The word that appeared instead, for a substitution. */
  instead?: string;
  inSource: number;
  inOutput: number;
  note: string;
}

const count = (haystack: string, needle: string, anyCase = false): number => {
  if (!needle.trim()) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Word boundaries so "Lord" does not match "Landlord".
  //
  // CASE MATTERS FOR A TERM AND NOT FOR A SUBSTITUTE. "yahuah" where the
  // lecturer wrote "Yahuah" is a respelling worth seeing; "the Lord" where the
  // lecturer wrote "Yahuah" is a substitution whether the model capitalised it
  // as "the LORD", "the Lord" or "the lord".
  return (haystack.match(new RegExp(`\\b${escaped}\\b`, anyCase ? 'gi' : 'g')) ?? []).length;
};

/**
 * Did the transformation keep the lecturer's words? Deterministic: no model,
 * no network, no judgement. It answers three questions and nothing else.
 */
export function checkTerminology(
  source: string, output: string,
  options: { glossary?: string[]; rules?: TermRule[] } = {},
): TerminologyFinding[] {
  const rules = options.rules ?? DEFAULT_TERM_RULES;
  const glossary = options.glossary ?? [];
  const findings: TerminologyFinding[] = [];

  // ---- 1. A SUBSTITUTE APPEARED WHERE THE TERM WAS -----------------------
  //
  // A SHORTER TERM INSIDE A LONGER ONE IS NOT A SECOND FINDING. "Yahusha"
  // occurs inside every "Yahusha HaMashiach", and reporting both would tell a
  // lecturer that two terms were substituted where one was — noise that makes
  // the panel worth ignoring.
  const occurrences = (text: string, term: string) => {
    const longer = rules
      .filter((other) => other.term !== term && other.term.includes(term))
      .reduce((sum, other) => sum + count(text, other.term), 0);
    return Math.max(0, count(text, term) - longer);
  };

  for (const rule of rules) {
    const inSource = occurrences(source, rule.term);
    if (!inSource) continue;
    const inOutput = occurrences(output, rule.term);

    for (const substitute of rule.substitutes) {
      // The same rule for substitutes: "Jesus" inside "Jesus Christ" is one
      // substitution, reported against the longer term.
      // Counted the same way on both sides: "Jesus" inside "Jesus Christ" is
      // one substitution, reported against the longer of the two.
      const everySubstitute = rules.flatMap((o) => o.substitutes);
      const standalone = (text: string) => {
        const longer = everySubstitute
          .filter((other) => other !== substitute && other.includes(substitute))
          .reduce((sum, other) => sum + count(text, other, true), 0);
        return Math.max(0, count(text, substitute, true) - longer);
      };
      const substituteInSource = standalone(source);
      const substituteInOutput = standalone(output);
      if (substituteInOutput > substituteInSource) {
        findings.push({
          kind: 'substituted',
          term: rule.term,
          instead: substitute,
          inSource,
          inOutput,
          note: `“${substitute}” appears ${substituteInOutput - substituteInSource} time(s) that the lecture does not. The lecturer said “${rule.term}”.`,
        });
      }
    }

    if (inOutput < inSource) {
      findings.push({
        kind: 'dropped',
        term: rule.term,
        inSource,
        inOutput,
        note: `“${rule.term}” appears ${inSource} time(s) in the lecture and ${inOutput} in this version.`,
      });
    }
  }

  // ---- 2. A GLOSSARY TERM LOST OR RESPELLED ------------------------------
  for (const term of glossary) {
    const inSource = count(source, term);
    if (!inSource) continue;
    const inOutput = count(output, term);
    if (inOutput >= inSource) continue;

    // Same letters, different capitals or spacing: a respelling rather than a
    // loss, and worth telling apart because the fix is different.
    const loose = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
    const looseInOutput = (output.match(loose) ?? []).length;

    findings.push({
      kind: looseInOutput >= inSource ? 'respelled' : 'dropped',
      term,
      inSource,
      inOutput,
      note: looseInOutput >= inSource
        ? `“${term}” is written differently in this version. The lecturer's spelling is authoritative.`
        : `“${term}” appears ${inSource} time(s) in the lecture and ${inOutput} in this version.`,
    });
  }

  return findings;
}


// ---------------------------------------------------------------------------
// TERM VALIDATION — after the model, before anything is published.
// ---------------------------------------------------------------------------

export interface Validation {
  ok: boolean;
  findings: TerminologyFinding[];
  /** Set when the output must be rejected rather than reviewed. */
  rejection?: string;
}

/**
 * THE HARD BOUNDARY. A substituted term or a protected term that did not come
 * back is not a finding for the lecturer to weigh: it is a failed
 * transformation, and the output is rejected rather than published.
 *
 * A dropped or respelled term short of that is reported and left to the
 * lecturer — a summary legitimately uses a term fewer times than the lecture
 * did, and rejecting on a count would make the layer unusable.
 */
export function validateTerminology(
  source: string, output: string,
  options: { glossary?: string[]; rules?: TermRule[]; missingProtected?: string[] } = {},
): Validation {
  const findings = checkTerminology(source, output, options);
  const substituted = findings.filter((f) => f.kind === 'substituted');
  const missing = options.missingProtected ?? [];

  if (substituted.length) {
    const first = substituted[0];
    return {
      ok: false,
      findings,
      rejection: `The transformation replaced “${first.term}” with “${first.instead}”. The lecturer’s terminology is authoritative, so this output was rejected rather than published.`,
    };
  }

  if (missing.length) {
    return {
      ok: false,
      findings,
      rejection: `The transformation lost ${missing.map((t) => `“${t}”`).join(', ')} — ${missing.length === 1 ? 'a protected term' : 'protected terms'} that must appear unchanged. This output was rejected rather than published.`,
    };
  }

  return { ok: true, findings };
}