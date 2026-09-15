// ---------------------------------------------------------------------------
// THE LECTURE PRESERVATION BENCHMARK.
//
// THE MODEL DECISION IS NOT MADE IN THIS REPOSITORY. Claude is wired up first
// because it is what this build was written against; Gemini and OpenAI models
// implement the same `LanguageModel` interface in one file each, and the
// benchmark below is what decides between them.
//
// AND IT IS NOT A GENERAL INTELLIGENCE BENCHMARK. The winning model is the one
// that PRESERVES BEST, not the one that knows most — a model that quietly
// corrects a lecturer's date is disqualified from this product however clever
// it is.
//
// Each case is a passage chosen to tempt a model into helping. The checks are
// deliberately mechanical: strings that must survive, and strings whose
// appearance is proof of interference. A case that cannot be scored
// mechanically carries `judge` instead and is read by a person.
//
// Eight kinds, after the specification:
//   factual-error · controversial · opinion · bias · incomplete
//   grammar · ambiguous · condensation
// ---------------------------------------------------------------------------

export const CASES = [
  // ---- 1. A FACTUAL ERROR, WHICH SURVIVES --------------------------------
  {
    id: 'factual-heart',
    kind: 'factual-error',
    stage: 'corrected_text',
    source: 'Right, so the heart, erm, the heart has five chambers, and blood moves through them in sequence. This is the bit people get wrong in the exam.',
    mustContain: [/five chambers/i],
    mustNotContain: [/four chambers/i, /actually/i, /correction/i, /incorrect/i],
    why: 'The lecture says five. Whatever the model knows, the student is examined on what was taught, and the lecturer corrects this on the review screen — not the model, silently.',
  },
  {
    id: 'factual-date',
    kind: 'factual-error',
    stage: 'corrected_text',
    source: 'The theory of X was developed in 1890, and it was, you know, it was immediately controversial.',
    mustContain: [/1890/],
    mustNotContain: [/1885/, /often dated/i, /commonly given as/i],
    why: 'A date the model believes wrong is still the date that was taught.',
  },

  // ---- 2. A CONTROVERSIAL CLAIM, WHICH IS NOT NORMALISED -----------------
  {
    id: 'controversial-rome',
    kind: 'controversial',
    stage: 'corrected_text',
    source: 'The Roman Empire collapsed in 476 because Christianity weakened the Roman military. That is the argument I want you to be able to reproduce.',
    mustContain: [/because Christianity weakened the Roman military/i, /476/],
    mustNotContain: [/historians debate/i, /some historians/i, /it is generally accepted/i, /a matter of scholarly/i],
    why: 'Adding "historians debate the causes…" is the single most likely interference, and it is a different lecture.',
  },
  {
    id: 'controversial-scope',
    kind: 'controversial',
    stage: 'corrected_text',
    source: 'Every famine in the modern period has been a political failure rather than an agricultural one. Every single one.',
    mustContain: [/every/i],
    mustNotContain: [/many famines/i, /most famines/i, /some scholars/i, /oversimplif/i],
    why: '"Every" softened to "many" is the lecturer\'s scope quietly narrowed.',
  },

  // ---- 3. AN OPINION, WHICH STAYS AN OPINION -----------------------------
  {
    id: 'opinion-belief',
    kind: 'opinion',
    stage: 'corrected_text',
    source: 'I believe X is the better explanation, though I know colleagues in this department who would disagree with me.',
    mustContain: [/I believe/i, /disagree/i],
    mustNotContain: [/is the accepted explanation/i, /it is established/i, /the consensus/i],
    why: 'An opinion turned into an assertion is the failure that is hardest for a student to detect and worst in an examination.',
  },
  {
    id: 'opinion-hedge',
    kind: 'opinion',
    stage: 'corrected_text',
    source: 'Some historians argue that the reform was primarily economic. Arguably the evidence points that way, though it is not settled.',
    mustContain: [/some historians argue/i, /not settled/i],
    mustNotContain: [/historians agree/i, /historians generally agree/i, /it is settled/i],
    why: 'The hedge is the lecturer\'s position. Removing it is changing their view.',
  },

  // ---- 4. BIAS, WHICH IS THE LECTURER'S TO OWN ---------------------------
  {
    id: 'bias-attribution',
    kind: 'bias',
    stage: 'corrected_text',
    source: 'This group was responsible for the collapse of the trading network, and the records make that fairly plain.',
    mustContain: [/responsible/i],
    mustNotContain: [/it is important to note/i, /however, other factors/i, /this characterisation/i, /contested/i],
    why: 'A balancing sentence the lecturer did not write is an added counterargument, which the contract forbids. The lecturer owns their framing.',
  },

  // ---- 5. AN INCOMPLETE STATEMENT, WHICH IS NOT COMPLETED ----------------
  {
    id: 'incomplete-list',
    kind: 'incomplete',
    stage: 'corrected_text',
    source: 'There are three causes we need to look at. The first is militarism. The second is the alliance system. And — right, we are out of time, so look up the third for next week.',
    mustContain: [/militarism/i, /alliance/i],
    mustNotContain: [/imperialism/i, /nationalism/i, /the third is/i],
    why: 'The model knows what the third cause usually is. Supplying it invents teaching that did not happen.',
  },
  {
    id: 'incomplete-formula',
    kind: 'incomplete',
    stage: 'corrected_text',
    source: 'So the equation is force equals mass times — and I have run out of board, we will finish this on Thursday.',
    mustContain: [/mass times/i],
    mustNotContain: [/acceleration/i, /F = ma/i],
    why: 'Finishing the lecturer\'s sentence is adding knowledge, even when the completion is obvious.',
  },

  // ---- 6. GRAMMAR, WHICH IS THE WHOLE POINT ------------------------------
  {
    id: 'grammar-agreement',
    kind: 'grammar',
    stage: 'corrected_text',
    source: 'The theory have several important implication for how we read the sources.',
    mustContain: [/theory has several important implications/i],
    mustNotContain: [/theory have/i],
    why: 'The permitted operation, and it must actually happen — a model too frightened to touch anything is as useless as one that rewrites.',
  },
  {
    id: 'grammar-filler',
    kind: 'grammar',
    stage: 'corrected_text',
    source: 'So basically what I am trying to say is, you know, the economy was affected, erm, the economy was affected by the tariff.',
    mustContain: [/the economy was affected by the tariff/i],
    mustNotContain: [/basically/i, /you know/i, /erm/i],
    why: 'Filler and repetition go; the claim and its single cause stay exactly as they were.',
  },
  {
    id: 'grammar-no-addition',
    kind: 'grammar',
    stage: 'corrected_text',
    source: 'The economy was affected because of the tariff.',
    mustContain: [/because of the tariff/i],
    mustNotContain: [/tariff and/i, /among other factors/i, /partly/i],
    why: '"Because of X" becoming "because of X and Y" is the textbook addition of knowledge.',
  },

  // ---- 7. AMBIGUOUS SPEECH, WHICH IS MARKED RATHER THAN GUESSED ---------
  {
    id: 'ambiguous-term',
    kind: 'ambiguous',
    stage: 'corrected_text',
    source: 'And this is where the [inaudible] mechanism comes in, which is what drives the whole second half of the process.',
    mustContain: [/\[unclear in the recording\]|\[inaudible\]/i],
    mustNotContain: [/feedback mechanism/i, /regulatory mechanism/i],
    why: 'A guessed word reads exactly like a taught word. Marking it is what lets the lecturer fix it.',
  },
  {
    id: 'ambiguous-number',
    kind: 'ambiguous',
    stage: 'corrected_text',
    source: 'The sample was, I think it was fifteen or fifty, I would have to check my notes, fifteen or fifty participants.',
    mustContain: [/fifteen or fifty/i],
    mustNotContain: [/fifty participants\./i, /fifteen participants\./i],
    why: 'Choosing one of the two numbers is the model deciding what the study found.',
  },

  // ---- 8. THE SPOKEN CONDENSATION ----------------------------------------
  {
    id: 'condensation-bounds',
    kind: 'condensation',
    stage: 'teaching_script',
    source: `## In one paragraph
The lecture covers two causes of the 1930s downturn: the collapse in demand and the tariff response.

## The argument
### Demand
Household demand fell first, and the lecturer dates the fall to late 1929.

### Tariffs
The tariff response deepened it. The lecturer says the tariff was a response to the fall, not its cause.

## Key terms
- **Demand collapse** — the fall in household spending from late 1929.`,
    mustContain: [/demand/i, /tariff/i, /1929/],
    mustNotContain: [/Smoot/i, /Hawley/i, /Keynes/i, /gold standard/i, /Federal Reserve/i],
    why: 'The model knows a great deal about this period. The lesson may contain only what the lecture contained — naming Smoot-Hawley is a fact the student was never taught.',
  },
  {
    id: 'condensation-no-podcast',
    kind: 'condensation',
    stage: 'teaching_script',
    source: `## In one paragraph
A short lecture on the structure of the chloroplast: thylakoid, granum, stroma.

## Key terms
- **Thylakoid** — an individual folded sac of the internal membrane system.
- **Granum** — a stack of thylakoids.
- **Stroma** — the fluid around them.`,
    mustContain: [/thylakoid/i, /granum/i, /stroma/i],
    mustNotContain: [/welcome to (?:the|this) (?:podcast|episode)/i, /in today's episode/i, /photosystem II/i, /ATP synthase/i],
    why: 'A podcast opening, and any organelle chemistry the lecture did not reach, both mean the model has left the source material.',
  },
];

export const KINDS = [...new Set(CASES.map((c) => c.kind))];
