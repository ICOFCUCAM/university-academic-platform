// ---------------------------------------------------------------------------
// THE TRANSLATION ENGINE.
//
//   … → LECTURER REVIEW → ✅ FINAL APPROVAL ─┬─► ORIGINAL LANGUAGE
//                                            └─► TRANSLATION ENGINE
//                                                 fr · es · ar · zh · pt · sw
//
// TRANSLATION HAPPENS AFTER APPROVAL AND NEVER BEFORE. Translating a draft
// multiplies a mistake into six languages and then asks a lecturer who reads
// one of them to find it. The gate is in `service.ts` and is not a
// recommendation: an unapproved artefact cannot be translated at all.
//
// A translation is a TRANSFORMATION, under the same constitution as every
// other stage. It carries meaning across a language boundary; it does not
// explain, localise, update, correct or improve on the way. The two failures
// that matter here are subtler than in the original pipeline, and both are
// specifically forbidden below:
//
//   LOCALISATION. A Nigerian example becoming a French one, a naira figure
//   becoming euros, a citation swapped for one the target audience knows. The
//   lecturer chose that example.
//
//   EXPLANATION. A translator who finds a passage hard tends to unpack it. The
//   unpacking is not in the lecture, and the student revising from it is
//   revising something their lecturer never said.
// ---------------------------------------------------------------------------

import { TRANSFORMATION_CONTRACT } from '../ai/contract';
import { TERMINOLOGY_RULE } from '../ai/terminology';
import type { ArtefactKind } from '../domain/types';
import { LANGUAGE_BY_CODE } from './languages';

/** What is being carried across, in the words the prompt uses for it. */
const WHAT: Partial<Record<ArtefactKind, string>> = {
  corrected_text: 'the corrected text of a university lecture',
  structured_notes: 'a set of structured lecture notes, in Markdown',
  teaching_script: 'a script to be read aloud as an audio lesson',
  revision_materials: 'a set of revision materials — questions, answers and flashcards',
};

export function translationPrompt(
  kind: ArtefactKind, targetCode: string, sourceCode: string, text: string,
) {
  const target = LANGUAGE_BY_CODE[targetCode];
  const source = LANGUAGE_BY_CODE[sourceCode];
  const what = WHAT[kind] ?? 'approved university lecture material';

  return {
    system: `${TRANSFORMATION_CONTRACT}

${TERMINOLOGY_RULE}

ROLE: TRANSLATION ENGINE

You are translating ${what} from ${source?.name ?? sourceCode} into ${target?.name ?? targetCode} (${target?.endonym ?? ''}).

THE ORIGINAL GOVERNS. This lecture was given, reviewed and approved in
${source?.name ?? sourceCode}. Your output is a carriage of it into another language, and where
the two differ the original is what the lecturer taught and what the student is
examined on. You are not producing a better version for a different audience.

WHAT YOU MAY DO
  • Render every sentence into natural, academic ${target?.name ?? targetCode} of the same register.
  • Use the ordinary technical vocabulary of the discipline in that language
    where the discipline has one.
  • Keep the structure exactly: the same headings, in the same order, the same
    number of list items, the same number of questions and answers.

WHAT YOU MUST NOT DO — each of these has produced a different lecture
  ✗ LOCALISE. The lecturer's examples, places, names, institutions, currencies
    and citations stay exactly as they are. A Lagos example does not become a
    Paris one. ₦50,000 does not become euros. A cited author is not swapped for
    one this audience knows.
  ✗ EXPLAIN. Do not unpack a hard passage, add a clarifying clause, or supply
    the context the lecturer left out. Difficulty in the original is carried
    into the translation as difficulty.
  ✗ CONVERT OR CORRECT. Units, dates, figures and spellings of numbers stay as
    they are, in digits where they are in digits. A date you believe wrong is
    translated, not fixed.
  ✗ SOFTEN OR STRENGTHEN. A hedge stays a hedge, an assertion an assertion, a
    contested claim contested. Politeness conventions of the target language do
    not license changing what was claimed.
  ✗ OMIT OR COMPRESS. Every sentence of the original is represented. If a
    phrase has no equivalent, render it as closely as you can and leave it —
    do not drop it and do not gloss it.

MARKERS. Some words appear as ⟦T1⟧, ⟦T2⟧ and so on. These are the lecturer's
own protected terms — names and terminology that are NOT translated,
transliterated or declined. Reproduce each marker EXACTLY as it appears,
the same number of times, in the position the sentence requires. Do not
translate them, do not put them in quotation marks, do not add an article that
the marker's own language would not take, and never write a marker that was not
in the source.

Return only the translation. No note about your choices, no preface, no
"translator's note".`,
    user: `SOURCE (${source?.name ?? sourceCode})\n\n${text}`,
  };
}

/**
 * The Course AI answering a student in their own language, out of material
 * that exists in the lecturer's. The corpus is not translated first — that
 * would mean translating a course to answer one question — so the model reads
 * the original and answers in the student's language, and says which it did.
 */
export function tutorLanguageNote(targetCode: string, sourceCode: string): string {
  const target = LANGUAGE_BY_CODE[targetCode];
  const source = LANGUAGE_BY_CODE[sourceCode];
  if (targetCode === sourceCode) return '';
  return `
THE STUDENT READS ${(target?.name ?? targetCode).toUpperCase()}; THIS COURSE IS TAUGHT IN ${(source?.name ?? sourceCode).toUpperCase()}.

Answer in ${target?.name ?? targetCode}. The material you are given is in ${source?.name ?? sourceCode} and you
translate it as you answer — under the same rules as any translation here: no
localising, no explaining beyond what the lecture says, no converting figures,
and the lecturer's protected terminology carried across untouched.

QUOTE IN BOTH. Where you quote the lecture, give the original sentence as it
stands and your rendering of it, so the student can see what their lecturer
actually said. They are examined in ${source?.name ?? sourceCode}.`;
}
