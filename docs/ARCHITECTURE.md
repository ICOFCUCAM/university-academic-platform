# Architecture

**Lecturers teach. AI transforms. Students learn.**

That sentence is the architecture, not the tagline. Each clause is enforced in
a different file, and the tests are written against the clauses rather than
against the code.

---

## 0. The AI Transformation Constitution

The rules every AI operation obeys, whichever model is eventually chosen. They
are in `src/lib/ai/constitution.ts`, in order of precedence, and each article
**names the files that enforce it** — `constitution.test.mjs` opens them.

| | Article | Enforced by |
|---|---|---|
| 1 | **Source preservation** — the lecturer's recording and transcript are the source; everything is derived from them and owned by them | `domain/ownership.ts`, `pipeline/stages.ts` |
| 2 | **Meaning preservation** — language and structure may improve; meaning may not change | `ai/contract.ts`, `ai/operations.ts`, `ai/verify.ts` |
| 3 | **Terminology preservation** — names, terms, spellings and capitalisation are preserved exactly | `ai/terminology.ts` |
| 4 | **No unrequested knowledge injection** — no outside fact, correction, opinion, counterargument or explanation | `ai/contract.ts`, `ai/operations.ts`, `ai/roles.ts` |
| 5 | **No silent normalisation** — unfamiliar terminology is never replaced with something more conventional | `ai/terminology.ts`, `ai/unusual.ts` |
| 6 | **Traceability** — every note, script and lesson traces to the lecture, the artefact and the version it came from | `domain/types.ts`, `pipeline/stages.ts` |
| 7 | **Explicit separation** — general knowledge only when a student asks, and always labelled | `ai/roles.ts`, `ai/tutor.ts` |

> Yahuah remains Yahuah. Yahusha HaMashiach remains Yahusha HaMashiach. No model
> overrides that because of its pretrained vocabulary.

### Article 3 is not enforced by asking

```
LECTURE → TRANSCRIPTION → TERM PROTECTION → AI TRANSFORMATION
                        → TERM VALIDATION → PUBLISHED CONTENT
```

**Protection**: every protected term is replaced by an opaque marker before the
text is sent. The model never has the lecturer's term in front of it, so there
is nothing for a pretrained habit to reach for, and the longest term is
protected whole — `Yahusha HaMashiach` is one marker, never `Yahusha` followed
by a word the model may then normalise.

**Validation**: after restoration, a substituted term or a protected term that
did not come back is **not a finding for the lecturer to weigh**. The output is
rejected: the stage reads as failed, with the reason on it, and nothing is
published. A dropped or respelled term short of that is reported and left to
the lecturer, because a summary legitimately uses a term fewer times than the
lecture did.

## 0b. The multilingual layer

```
LECTURER REVIEW → ✅ FINAL APPROVAL ─┬─► ORIGINAL LANGUAGE (the MASTER)
                                     └─► TRANSLATION ENGINE
                                          fr · es · pt · ar · zh · sw · de · no
                                              ↓
                                     NOTES · AUDIO · QUIZ · COURSE AI
```

Article 8 of the constitution, in three rules:

1. **Translation follows approval.** `translateArtefact` refuses an artefact
   that is not `approved` or `published`. A draft translated into six languages
   is one mistake in six places, found by nobody.
2. **Every translation derives from the master.** Translating a translation is
   refused outright, so languages cannot drift down a chain.
3. **The original governs.** Every translated page says so and links to it.

**What is carried across**: corrected text, structured notes, teaching script,
revision materials. Not the transcript (working material) and not the knowledge
extraction — the Course AI reads one index, in the lecture's own language, and
two indexes could disagree.

**How a translation is checked when nobody here reads the language**
(`i18n/validate.ts`): the lecturer's protected terms (as markers, so the check
is about markers and not about the target language's orthography), every figure
the lecture states (Eastern Arabic and full-width digits normalised first), the
same headings, the same number of list items and question lines, and a length
ratio that is not absurd. A lost marker, a lost figure, a lost heading or a
translation under 45% of the original's length is a **rejection**; the rest are
warnings for whoever reviews.

**Who vouches for it**: `approve-translation` is held by a translation reviewer
and by nobody else — not by the lecturer, who in general cannot read the
language and must not be able to manufacture that approval. A translation
nobody has read is still publishable, because it is usually better than nothing
for a student who cannot read the original, and it is labelled `unreviewed`
every time it is shown.

**Audio**: each language has its own speech rate (`languages.ts`), so a
fifteen-minute lesson is about fifteen minutes in each — 15:00, 15:12, 15:20 —
and the estimate is shown rather than a promise of exactness.

## 1. The four products inside this one

| | What it is | Where it lives |
|---|---|---|
| 🎙️ **Lecture Intelligence** | Turns teaching into structured academic content | `src/lib/pipeline/`, `src/lib/ai/` |
| 📚 **Academic Knowledge** | Builds the course knowledge base out of every processed lecture | `src/lib/knowledge/` |
| 🎧 **Learning Transformation** | Notes, audio, summaries, revision, flashcards, quizzes | `src/lib/ai/prompts.ts`, `src/lib/ai/audioModes.ts` |
| 🤖 **Course AI** | Lets students interact with their own university's material | `src/lib/ai/tutor.ts` |

They share one object. The **Course** is the centre of the model; everything
else hangs from it.

```
UNIVERSITY
├── Faculty
│   └── Department
│       └── COURSE
│           ├── Lecturer(s)
│           ├── Lecture 01 ── Recording · Transcript · Corrected text ·
│           │                 Knowledge · Notes · Script · Audio · Revision
│           ├── Lecture 02 …
│           └── COURSE AI
└── Students
    └── Enrolled courses
```

## 2. The ownership line, as code

`src/lib/domain/ownership.ts` holds one function, `mayAct(actor, act, artefact,
scene)`, and every route, screen and store call goes through it.

- **The lecturer owns the academic source material.** The recording is theirs;
  every artefact derived from it inherits `ownerId` from it. They may correct,
  approve, publish, withdraw, export and delete.
- **The university owns the course environment.** Faculties, departments,
  courses, who teaches, who is enrolled. The registry may read what has been
  *published* and may not read a draft, edit a word, approve, publish, or
  delete a recording. The delete line is the one that decides whether "the
  lecturer owns it" is true.
- **AI transforms.** It produces artefacts in `ready`. There is no path from
  `ready` to `published` that does not pass through a person.
- **Students consume.** Published artefacts, on courses they are enrolled on,
  and the Course AI.

`ownership.test.mjs` proves each of those by watching it refuse.

## 3. The pipeline is data

`src/lib/pipeline/stages.ts` states the chain, what each stage is made from,
which stages need an *approved* source, and which are student-facing. Adding a
ninth artefact is one entry in that array.

Two rules carry the platform's credibility:

1. **Nothing downstream runs on an unapproved correction.** A mis-heard term
   let through arrives in the notes, the script, the audio, the revision cards
   *and* the knowledge base — one error, five copies, a cohort's hands.
2. **A correction reaches everything made from it.** `staleAfterEdit` walks the
   graph; the screen offers to regenerate. A correction only the lecturer can
   see is not a correction.

## 4. Why the academic processor is three passes

Grammar, structure and knowledge fail differently and are corrected
differently. A mis-heard word is a language fault; a missing section is a
structural one; a concept the lecture never taught, extracted into the
knowledge base, is neither — and it would poison every answer the Course AI
gives for the rest of the session. Three artefacts, three reviews.

## 5. The knowledge base is a merge, and the merge is the point

Each lecture's extraction is nodes with provenance: term, kind, the lecturer's
definition, the lecturer's own sentence as evidence. `buildKnowledgeBase`
merges them, and three findings fall out that no single lecture can show:

- **Which lecture introduced a concept** — answered exactly, with no model call.
- **Where the course contradicts itself** — surfaced with both readings and both
  lectures named, and *never reconciled*. Choosing between two of a lecturer's
  definitions is authorship.
- **What the course uses and never defines** — the gap invisible from inside any
  one lecture.

## 5b. RBAC for AI — the deepest principle in the product

The platform does not rely on *"please behave yourself, AI"*. A model call is
made **as a role**, and the role has a permission boundary enforced at the call
site, exactly as `capabilities.ts` and `ownership.ts` do for people.
`src/lib/ai/roles.ts`:

| Role | May | May not |
|---|---|---|
| **Transformation** | change grammar, improve readability, structure information, summarise, hand text to speech | fact-check, debate, correct knowledge, inject outside information, reinterpret or challenge the lecturer, silently change claims |
| **Verifier** | compare claims, report what moved | judge whether a claim is true, edit anything, recommend a correction |
| **Course tutor** | answer from this course's published lectures, cite, refuse | use knowledge from outside the course, predict examination questions, do assessed work |
| **General explainer** | use general knowledge — only when a student explicitly asked | run without that request, reach a page unlabelled, silently contradict the lecturer |

`callAs(engine, role, request, grants)` makes it a boundary rather than a
description, with four structural refusals:

1. a transformation whose prompt does not carry the contract **cannot run**;
2. the tutor **cannot run with an empty corpus** — a tutor with no course
   material answers from the model's own knowledge and sounds identical;
3. the general explainer **cannot run** unless the grant "the student asked to
   go beyond the course" is passed at the call site;
4. every result is **stamped with its role**, so the screen can label it and the
   two knowledge sources never merge on a page.

`roles.test.mjs` proves each refusal, and then greps the whole source tree to
check that nothing calls the model directly around the gate.

## 5c. The lecturer's terminology is authoritative

A name is not a synonym, and normalising one is the most damaging thing a
transformation can do — because the substitution is invisible to the person it
damages. A student reading *Jesus Christ* where their lecturer said *Yahusha
HaMashiach* has no way of knowing the words are not the words that were taught,
and will reproduce the substitution in an examination sat by the person whose
term was replaced.

```
Yahuah              → Yahuah              NOT Jehovah, NOT Yahweh, NOT Lord
Yahusha HaMashiach  → Yahusha HaMashiach  NOT Jesus Christ
```

`src/lib/ai/terminology.ts` does two things, and the second is the one that
matters:

1. The rule is stated in **every** prompt — pipeline, Course AI and general
   explainer alike, so it holds in transcripts, corrected text, notes,
   summaries, revision material, teaching scripts, audio and every answer built
   on course material.
2. **The output is checked by counting, with no model consulted.** A rule a
   model is merely asked to follow is a rule nobody has watched refuse
   anything. The check reports a substitution (a replacement word appearing
   from nowhere), a dropped term, or a respelling, and the review screen shows
   it above everything else.

Each course carries its own glossary (`Course.terminology`) — every discipline
has terms whose normalisation changes the teaching.

## 6. Two passes, and a third that checks the second

**Pass 1 — a faithful transcript.** Speech to text, no interpretation.

**Pass 2 — a constrained linguistic transformation.** Not "correct the
transcript" — that invites the model to use what it knows. The instruction
names the operations it may perform (`src/lib/ai/operations.ts`):

```
ALLOWED    grammar · spelling · punctuation · sentence structure ·
           remove filler · remove repetition · paragraphing · headings ·
           bullet structure

FORBIDDEN  factual correction · fact checking · adding knowledge ·
           removing knowledge · changing opinions · changing interpretations ·
           adding counterarguments · adding context ·
           normalising controversial claims ·
           replacing claims with "more accurate" claims
```

**Pass 3 — verification** (`src/lib/ai/verify.ts`). One question, and it is
not "is the lecturer correct?":

> Did the transformed version introduce, remove or alter any substantive claim?

```
Original claim:  Christianity weakened the Roman military.
Output claim:    Christianity weakened the Roman military.
STATUS:          ✓ Preserved
```

A claim the verifier believes false is still **preserved** if it survived
unchanged. The report reaches the review screen as "sixteen claims preserved,
one altered — here it is", so a lecturer reads a diff of claims rather than
twelve thousand words against twelve thousand words. A verifier that could not
run says *not verified*; it never reads as a clean bill of health.

The audio inherits the same discipline: the script prompt asks for *a spoken
condensation of the supplied lecture content, using only information contained
in the source material* — never "an educational podcast about this topic",
which is an instruction to use general knowledge. The speech engine needs to
know nothing about the subject; it speaks an approved script.

## 6b. The model is not chosen yet

`bench/` is the **Lecture Preservation Benchmark**: sixteen passages chosen to
tempt a model into helping, scored mechanically. Claude is wired first because
this build was written against it; Gemini and OpenAI models are one file each
against the same `LanguageModel` interface. **The winner is the model that
preserves best, not the one that knows most**, and any case where the model
changed what was taught is disqualifying. See `bench/README.md`. It has not
been run: this environment has no API key.

## 7. The engine is behind an interface

`src/lib/ai/provider.ts` names three machines — transcription, a language
model, speech — and `engine.ts` resolves what is actually configured.
`anthropic.ts` is the language model (server-only; the key never reaches a
browser). `offline.ts` implements all three without a network so the product
opens, demonstrates and tests itself with no keys — and stamps everything it
produces `offline processor (no language model configured)`.

Every prompt in `prompts.ts` carries the same rule: **improve the language,
preserve the meaning.** The model may reorganise and may not add — no date, no
citation, no example, no definition the lecturer did not give. Where the
material is thin it writes `[unclear in the recording]` rather than filling the
gap, and the review screen offers **original | corrected** side by side so the
rule can be checked rather than trusted.

## 8. A ninety-minute lecture is not processed in an HTTP request

`src/lib/jobs/` — the upload creates jobs and returns; a worker runs them in
order; each writes its artefact as it finishes. A failure is retried three
times, then stops with its reason kept, and takes its dependents with it. On a
taught course the plan stops at the approval gate; in a personal library it
runs end to end.

## 9. What is not built

Named plainly, because a roadmap read as a feature list is how software gets
bought twice:

- **No transcription or speech vendor is wired in.** The interfaces exist and
  are called; the adapters are one file each.
- **No file storage.** The upload form records a file name; the working path is
  a pasted transcript.
- **No authentication.** `src/lib/session.ts` is a demonstration switcher, and
  says so. Mounted in a university, the host's session is the source of truth.
- **No assignments, no engagement analytics beyond counts, no payment
  processing.** The plans in `src/lib/billing/plans.ts` are the shape of
  metering, not a billing integration.
