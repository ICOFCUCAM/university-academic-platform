// ---------------------------------------------------------------------------
// WHAT THE TRANSFORMATION IS PERMITTED TO DO, AS AN ENUMERATED LIST.
//
// "Correct the transcript" is an invitation. Correct it against what? A model
// asked to correct something will reach for what it knows, and what it knows
// is not what the lecturer taught.
//
// So the instruction is not "correct". It is: PERFORM A CONSTRAINED LINGUISTIC
// TRANSFORMATION, and here are the only operations you may perform — and,
// spelled out because a model will otherwise supply them helpfully, here are
// the ones you may not.
//
// Kept as data rather than prose so every prompt renders the same list and
// `prompts.test.mjs` can count it.
// ---------------------------------------------------------------------------

export const ALLOWED_OPERATIONS = [
  'GRAMMAR',
  'SPELLING',
  'PUNCTUATION',
  'SENTENCE STRUCTURE',
  'REMOVE FILLER WORDS',
  'REMOVE REPETITION',
  'PARAGRAPH STRUCTURING',
  'HEADINGS',
  'BULLET STRUCTURE',
] as const;

export const FORBIDDEN_OPERATIONS = [
  'FACTUAL CORRECTION',
  'FACT CHECKING',
  'ADDING KNOWLEDGE',
  'REMOVING KNOWLEDGE',
  'CHANGING OPINIONS',
  'CHANGING INTERPRETATIONS',
  'ADDING COUNTERARGUMENTS',
  'ADDING CONTEXT',
  'NORMALIZING CONTROVERSIAL CLAIMS',
  'REPLACING CLAIMS WITH "MORE ACCURATE" CLAIMS',
] as const;

export function operationsBlock(): string {
  return [
    'PERFORM A CONSTRAINED LINGUISTIC TRANSFORMATION.',
    '',
    'You are not correcting the material. You are performing a fixed set of',
    'operations on its language, and nothing else.',
    '',
    'ALLOWED TRANSFORMATIONS — these, and only these:',
    ...ALLOWED_OPERATIONS.map((op) => `  ✓ ${op}`),
    '',
    'FORBIDDEN TRANSFORMATIONS — each of these produces a different lecture:',
    ...FORBIDDEN_OPERATIONS.map((op) => `  ✗ ${op}`),
    '',
    'Worked example. The lecturer says:',
    '  "The Roman Empire collapsed in 476 because Christianity weakened the',
    '   Roman military."',
    '',
    'You produce:',
    '  "The Roman Empire collapsed in 476 because Christianity weakened the',
    '   Roman military."',
    '',
    'You do NOT produce "Historians debate the causes of the Roman Empire\'s',
    'decline…", because that is not what the lecturer said. Whether the claim is',
    'sound is not your question and is not this system\'s question; what was',
    'taught is.',
  ].join('\n');
}
