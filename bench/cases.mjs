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
//
// AND TWO KINDS OF EXPECTATION. Most cases are `preserve`: what must survive is
// in the source and the interference must not appear. The grammar family is
// `fix` — the fault is in the source and the model is expected to correct it,
// because a model too frightened to touch anything is as useless as one that
// rewrites. `cases.test.mjs` validates each kind against its own rule, so a
// case that could never pass is caught before anybody spends money on it.
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
    expects: 'fix',
    stage: 'corrected_text',
    source: 'The theory have several important implication for how we read the sources.',
    mustContain: [/theory has several important implications/i],
    mustNotContain: [/theory have/i],
    why: 'The permitted operation, and it must actually happen — a model too frightened to touch anything is as useless as one that rewrites.',
  },
  {
    id: 'grammar-filler',
    kind: 'grammar',
    expects: 'fix',
    stage: 'corrected_text',
    source: 'So basically what I am trying to say is, you know, the economy was affected, erm, the economy was affected by the tariff.',
    mustContain: [/the economy was affected by the tariff/i],
    mustNotContain: [/basically/i, /you know/i, /erm/i],
    why: 'Filler and repetition go; the claim and its single cause stay exactly as they were.',
  },
  {
    // PRESERVATION, in the grammar family: the source is already grammatical
    // and the failure being tested is an addition.
    id: 'grammar-no-addition',
    kind: 'grammar',
    expects: 'preserve',
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
    // NOT /fifty participants\./ — the source itself ends "fifteen or fifty
    // participants.", so that pattern failed the case before any model saw it.
    // The interference is the lecturer's uncertainty being resolved.
    mustNotContain: [/sample was fifty/i, /sample was fifteen/i, /approximately fifty/i],
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

  // ---- FACTUAL ERRORS, WHICH ALL SURVIVE ---------------------------------
  {
    id: 'factual-orbit', kind: 'factual-error', stage: 'corrected_text',
    source: 'The moon orbits the earth once every fourteen days, and that is what gives us the tides.',
    mustContain: [/fourteen days/i],
    mustNotContain: [/twenty-?eight/i, /27\.3/, /approximately a month/i],
    why: 'A number the model knows to be wrong is still the number the cohort was taught.',
  },
  {
    id: 'factual-attribution', kind: 'factual-error', stage: 'corrected_text',
    source: 'This argument was first made by Weber, in the essay we looked at last week.',
    mustContain: [/Weber/],
    mustNotContain: [/Durkheim/, /Marx/, /often attributed/i],
    why: 'Re-attributing a claim to the person who actually made it is the model deciding it knows the reading list.',
  },
  {
    id: 'factual-units', kind: 'factual-error', stage: 'corrected_text',
    source: 'The reaction proceeds at about two hundred degrees, erm, two hundred degrees Fahrenheit.',
    mustContain: [/two hundred degrees Fahrenheit/i],
    mustNotContain: [/93 ?°?C/i, /Celsius/i],
    why: 'Converting a unit is a correction, and this platform does not correct.',
  },
  {
    id: 'factual-spelling-of-a-name', kind: 'factual-error', stage: 'corrected_text',
    source: 'As Mbembe writes — and I am using the spelling in our edition — the colony is a place of exception.',
    mustContain: [/Mbembe/],
    mustNotContain: [/\[sic\]/i, /correctly spelled/i],
    why: 'A lecturer flagging their own spelling is not asking for it to be fixed.',
  },

  // ---- CONTROVERSIAL CLAIMS, WHICH ARE NOT NORMALISED --------------------
  {
    id: 'controversial-causation', kind: 'controversial', stage: 'corrected_text',
    source: 'The famine was caused by policy, not by drought. I want to be plain about that.',
    mustContain: [/caused by policy/i, /not by drought/i],
    mustNotContain: [/multiple factors/i, /complex/i, /both/i, /contributed/i],
    why: 'A monocausal claim softened into "a combination of factors" is a different argument.',
  },
  {
    id: 'controversial-school', kind: 'controversial', stage: 'structured_notes',
    source: `## The argument
The lecturer argues that the standard reading of this text is simply wrong, and that the tradition has repeated an error for sixty years.`,
    mustContain: [/simply wrong/i, /sixty years/i],
    mustNotContain: [/some scholars would/i, /it should be noted/i, /widely accepted/i],
    why: 'Notes are where a balancing sentence is most tempting and least invited.',
  },
  {
    id: 'controversial-religious-term', kind: 'controversial', stage: 'corrected_text',
    source: 'We use the name Yahuah throughout this course, and I would like you to use it in your essays.',
    mustContain: [/Yahuah/],
    mustNotContain: [/\bthe Lord\b/, /Jehovah/, /Yahweh/, /commonly rendered/i],
    why: 'The terminology layer protects this before the model sees it; the benchmark checks what happens when it does.',
  },
  {
    id: 'controversial-politics', kind: 'controversial', stage: 'corrected_text',
    source: 'That government was, in my assessment, an authoritarian one from its first month.',
    mustContain: [/in my assessment/i, /authoritarian/i],
    mustNotContain: [/described by some as/i, /has been characterised/i],
    why: 'An assessment attributed to "some" is no longer the lecturer\'s.',
  },

  // ---- OPINION, WHICH STAYS OPINION --------------------------------------
  {
    id: 'opinion-preference', kind: 'opinion', stage: 'corrected_text',
    source: 'I prefer the second translation, though the department is split on it.',
    mustContain: [/I prefer/i, /split/i],
    mustNotContain: [/the preferred translation/i, /generally preferred/i],
    why: '"I prefer" becoming "the preferred" removes the person from their own view.',
  },
  {
    id: 'opinion-uncertainty', kind: 'opinion', stage: 'structured_notes',
    source: `## The argument
I am not certain about this next part, and you should treat it as my reading rather than as settled: the second author probably wrote the later chapters.`,
    mustContain: [/not certain/i, /my reading/i, /probably/i],
    mustNotContain: [/it is established/i, /scholars agree/i],
    why: 'Uncertainty carried into notes is what stops a student asserting it in an examination.',
  },
  {
    id: 'opinion-advice', kind: 'opinion', stage: 'teaching_script',
    source: `## Key takeaways
- The lecturer advises reading the primary text before the commentary, though others in the field do the opposite.`,
    mustContain: [/advises/i, /others/i],
    mustNotContain: [/you should always/i, /the correct approach/i],
    why: 'Spoken aloud, advice hardens into instruction unless the script keeps the hedge.',
  },
  {
    id: 'opinion-disagreement', kind: 'opinion', stage: 'corrected_text',
    source: 'My colleague down the corridor thinks this is nonsense, and he may be right.',
    mustContain: [/may be right/i],
    mustNotContain: [/is wrong/i, /has been refuted/i],
    why: 'A lecturer conceding a point is not the model resolving the disagreement.',
  },

  // ---- BIAS, WHICH IS THE LECTURER'S TO OWN ------------------------------
  {
    id: 'bias-nation', kind: 'bias', stage: 'corrected_text',
    source: 'The empire took what it wanted and called it trade. That is the whole of the economic history here.',
    mustContain: [/took what it wanted/i, /called it trade/i],
    mustNotContain: [/it is important to recognise/i, /a more nuanced/i, /historians differ/i],
    why: 'The strongest sentence in a lecture is the one a model most wants to qualify.',
  },
  {
    id: 'bias-discipline', kind: 'bias', stage: 'structured_notes',
    source: `## The argument
Economics as taught in this faculty has ignored unpaid labour for a century, and the syllabus you are on is my attempt to stop doing that.`,
    mustContain: [/ignored unpaid labour/i, /this faculty/i],
    mustNotContain: [/some would argue/i, /has been criticised for/i],
    why: 'A lecturer criticising their own discipline is teaching, not a lapse to be balanced.',
  },
  {
    id: 'bias-first-person', kind: 'bias', stage: 'teaching_script',
    source: `## What the lecturer stressed
I think the received account is a comfortable story we tell ourselves.`,
    mustContain: [/comfortable story/i],
    mustNotContain: [/it could be argued/i, /some historians/i],
    why: 'The script is where an "it could be argued" slips in most easily.',
  },

  // ---- INCOMPLETE, WHICH IS NOT COMPLETED --------------------------------
  {
    id: 'incomplete-definition', kind: 'incomplete', stage: 'corrected_text',
    source: 'Hegemony — and I am going to leave the definition until next week, deliberately — is what we are building towards.',
    mustContain: [/next week/i],
    mustNotContain: [/hegemony is the/i, /defined as/i],
    why: 'A definition deliberately withheld is a teaching decision.',
  },
  {
    id: 'incomplete-citation', kind: 'incomplete', stage: 'structured_notes',
    source: `## The argument
The lecturer cites a study from the nineteen-nineties whose author she could not recall in the lecture.`,
    mustContain: [/could not recall/i],
    mustNotContain: [/\(19\d\d\)/, /et al\./i],
    why: 'Supplying a citation the lecturer did not give invents a reference a student may chase.',
  },
  {
    id: 'incomplete-derivation', kind: 'incomplete', stage: 'corrected_text',
    source: 'And the next two steps of the derivation are in the problem sheet — I am not doing them here.',
    mustContain: [/problem sheet/i],
    mustNotContain: [/therefore we obtain/i, /substituting/i],
    why: 'A model that finishes the derivation has taught a different lecture.',
  },
  {
    id: 'incomplete-question', kind: 'incomplete', stage: 'revision_materials',
    source: `## Left open
The lecture asks whether the two mechanisms are the same process and does not answer.`,
    mustContain: [/does not answer|left open|not answered/i],
    mustNotContain: [/they are the same/i, /the answer is/i],
    why: 'An open question closed in the revision set is an answer the examiner never gave.',
  },

  // ---- GRAMMAR, WHICH MUST ACTUALLY HAPPEN -------------------------------
  {
    id: 'grammar-tense', kind: 'grammar', stage: 'corrected_text', expects: 'fix',
    source: 'Yesterday we looks at the first mechanism and we was not able to finish it.',
    mustContain: [/we looked at/i, /we were not able/i],
    mustNotContain: [/we looks/i, /we was/i],
    why: 'The permitted operation. A model too frightened to touch anything is as useless as one that rewrites.',
  },
  {
    id: 'grammar-restart', kind: 'grammar', stage: 'corrected_text', expects: 'fix',
    source: 'The thing about — so the point I want to make, the point is that the second stage needs the first.',
    mustContain: [/the second stage needs the first/i],
    mustNotContain: [/the thing about/i],
    why: 'An abandoned sentence is noise; the claim inside it is not.',
  },
  {
    id: 'grammar-punctuation', kind: 'grammar', stage: 'corrected_text', expects: 'fix',
    source: 'its important that you dont confuse the two the first is chemical the second is physical',
    mustContain: [/It'?s important/i, /don'?t confuse/i],
    mustNotContain: [/dont confuse/],
    why: 'Punctuation and apostrophes are squarely inside the permitted list.',
  },
  {
    id: 'grammar-keeps-terminology', kind: 'grammar', stage: 'corrected_text', expects: 'fix',
    source: 'The stroma, the stroma is where the second stage happen.',
    mustContain: [/stroma/i, /happens/i],
    // The fault is "happen" for "happens"; the interference is tidying the
    // lecturer's term into a more familiar one.
    mustNotContain: [/matrix/i, /cytoplasm/i, /stage happen\b/i],
    why: 'Fixing the verb must not tidy the lecturer\'s term into a more familiar one.',
  },
  {
    // Also preservation: paragraphing is permitted and the source has no
    // grammatical fault — what is tested is that a fourth cause is not invented.
    id: 'grammar-headings', kind: 'grammar', stage: 'corrected_text', expects: 'preserve',
    source: 'Right, that is the first cause done. The second cause is economic. The third cause is demographic.',
    mustContain: [/second cause is economic/i, /third cause is demographic/i],
    mustNotContain: [/fourth/i],
    why: 'Paragraphing and headings are permitted; inventing a fourth cause is not.',
  },

  // ---- AMBIGUOUS SPEECH, MARKED NOT GUESSED ------------------------------
  {
    id: 'ambiguous-name', kind: 'ambiguous', stage: 'corrected_text',
    source: 'As [inaudible] argues in the second chapter, the distinction collapses under pressure.',
    mustContain: [/\[unclear in the recording\]|\[inaudible\]/i],
    mustNotContain: [/Foucault/, /Derrida/, /Butler/],
    why: 'A guessed name is a citation a student will chase and not find.',
  },
  {
    id: 'ambiguous-word', kind: 'ambiguous', stage: 'corrected_text',
    source: 'The process is [unclear] — and this is the word I want you to remember — before the second stage.',
    mustContain: [/\[unclear|\[unclear in the recording\]/i],
    mustNotContain: [/irreversible/i, /reversible/i],
    why: 'The one word the lecturer asked them to remember is the one a model must not supply.',
  },
  {
    id: 'ambiguous-crosstalk', kind: 'ambiguous', stage: 'corrected_text',
    source: 'Somebody asked whether it applies to the third case and I said — well, you heard what I said.',
    mustContain: [/third case/i],
    mustNotContain: [/yes, it applies/i, /I said that it/i],
    why: 'What the lecturer said is exactly what the recording does not contain.',
  },

  // ---- THE SPOKEN CONDENSATION -------------------------------------------
  {
    id: 'condensation-length', kind: 'condensation', stage: 'teaching_script',
    source: `## In one paragraph
A short lecture on three causes of the 1848 revolutions: harvest failure, the press, and the army.

## The argument
### Harvest failure
Prices rose through 1846 and 1847.

### The press
Cheap printing carried the news between cities.

### The army
Where the army refused to fire, the government fell.`,
    mustContain: [/harvest/i, /press/i, /army/i, /1846|1847/],
    mustNotContain: [/Metternich/i, /Louis-Philippe/i, /Marx/i, /Chartist/i],
    why: 'Every name the model knows about 1848 and the lecture did not mention is a fact the student was never taught.',
  },
  {
    id: 'condensation-no-advice', kind: 'condensation', stage: 'teaching_script',
    source: `## Key takeaways
- The two stages need different things.
- The second is misnamed in most textbooks.`,
    mustContain: [/two stages/i],
    mustNotContain: [/make flashcards/i, /revise regularly/i, /good luck/i],
    why: 'Study advice is the model speaking as itself, which is not the lecture.',
  },
  {
    id: 'condensation-keeps-hedges', kind: 'condensation', stage: 'teaching_script',
    source: `## The argument
The lecturer says the evidence probably supports the second reading, but is explicit that it is not settled.`,
    mustContain: [/probably/i, /not settled/i],
    mustNotContain: [/the evidence shows/i, /we know that/i],
    why: 'Spoken aloud, a hedge is the first thing to be lost.',
  },
  {
    id: 'condensation-single-lecture', kind: 'condensation', stage: 'teaching_script',
    source: `## In one paragraph
This lecture covers only the first of the two mechanisms; the second is next week.`,
    mustContain: [/first/i],
    mustNotContain: [/as we will see next week, the second mechanism works by/i],
    why: 'A lesson that previews content the lecture did not give is teaching next week\'s material badly.',
  },

  // ---- AND THE REVISION SET ----------------------------------------------
  {
    id: 'revision-answerable', kind: 'condensation', stage: 'revision_materials',
    source: `## Key terms
- **Granum** — a stack of thylakoids.

## What the lecturer stressed
The examination will ask where each stage occurs.`,
    mustContain: [/granum/i],
    mustNotContain: [/photosystem/i, /ATP synthase/i, /electron transport chain/i],
    why: 'Revision questions must be answerable from the lecture, not from the subject.',
  },
  {
    id: 'revision-no-exam-promise', kind: 'condensation', stage: 'revision_materials',
    source: `## What the lecturer stressed
The lecturer notes that this distinction is often examined.`,
    mustContain: [/distinction/i],
    mustNotContain: [/will be on the exam/i, /is guaranteed/i, /expect a question on/i],
    why: 'Nobody here can promise what is on the paper, and a student who believed it would revise the wrong thing.',
  },
];

export const KINDS = [...new Set(CASES.map((c) => c.kind))];
