# Lecture Studio

**Lecturers teach. AI transforms. Students learn.**

Every lecture taught becomes structured, searchable, accessible academic
knowledge — a corrected academic text, structured notes, a taught audio lesson,
revision material, and one more entry in a knowledge base the course's own AI
answers out of.

It is not a transcription tool. The transformation is:

```
VOICE → KNOWLEDGE → NOTES → AUDIO → REVISION
```

---

## The pipeline

```
LECTURE  (mp3 · m4a · wav · video · a pasted transcript)
   │
   ▼
TRANSCRIPTION
   │
   ▼
AI ACADEMIC PROCESSOR  ─── three passes, three artefacts
   │
   ├── Grammar & language  ──► Corrected academic text
   ├── Knowledge extraction ─► the COURSE KNOWLEDGE BASE
   └── Structure & format  ──► Structured notes
   │
   ▼
AI TEACHING SCRIPT   ──► 15-MINUTE AUDIO LESSON   (a long lecture becomes several)
   │
   └──────────────────► REVISION  (flashcards · quiz · MCQ · exam questions ·
                                   terminology · what you must remember · 5-minute)
```

Each stage is its own artefact with its own version history, its own state and
its own review. Nothing is a hidden step inside something else, because a
lecturer cannot correct what they cannot see.

## The workflow is never Lecture → AI → Student

```
Lecture → AI → LECTURER REVIEW → Student
```

The lecturer reads what the model produced, corrects anything it got wrong,
approves it, and publishes it. Students then see **Published by Dr —**, and the
university has a named academic answerable for every word. The platform
enforces this rather than recommending it: an unapproved artefact cannot be
published, and `src/lib/domain/ownership.test.mjs` is where that is held shut.

A correction makes everything built on it **stale** and offers to regenerate:

```
Recording → Transcript v1 → AI processing v1 → lecturer corrections → Published v2
                                                     └──► notes, script, audio,
                                                          quiz and flashcards
                                                          regenerate from the
                                                          corrected authoritative
                                                          version
```

## The AI's job is transformation, not adjudication

The processing model works under a contract (`src/lib/ai/contract.ts`), prefixed
verbatim to every transformation, and `prompts.test.mjs` fails if any stage is
missing it:

> **ROLE: LECTURE TRANSFORMATION ENGINE.** You are NOT a fact checker. You are
> NOT an academic reviewer. You are NOT permitted to correct factual claims,
> add information that was not in the lecture, or remove a claim because you
> believe it incorrect, controversial, biased, incomplete or unconventional.
> When uncertain whether a change would alter meaning, preserve the original
> wording.

It is not asked to *correct* anything. It is asked to perform a **constrained
linguistic transformation** with an enumerated list of permitted operations —
grammar, spelling, punctuation, sentence structure, filler, repetition,
paragraphing, headings, bullets — and an equally explicit list of forbidden
ones, factual correction and adding context among them.

Then a **verification pass** asks the only question worth asking about the
result: *did it introduce, remove or alter any substantive claim?* Not whether
the lecturer is right. The review screen shows the diff of claims.

If the lecturer taught that the Roman Empire fell because Christianity weakened
its military, that is what the student receives. Whether it is sound is the
lecturer's business, on the review screen, in their own words.

**There is a constitution, and it is enforced in code.** Seven articles —
source preservation, meaning preservation, terminology preservation, no
unrequested knowledge injection, no silent normalisation, traceability,
explicit separation — each naming the files that make it true, with a test that
opens them (`src/lib/ai/constitution.ts`).

**The lecturer's terminology is authoritative.** `Yahuah` stays `Yahuah`, never
`Jehovah`, `Yahweh` or `Lord`; `Yahusha HaMashiach` is never `Jesus Christ`. The
rule is in every prompt — and then the output is **checked by counting**, with
no model consulted, because a rule a model is asked to follow is a rule nobody
has watched. A substituted, dropped or respelled term is shown to the lecturer
above everything else on the review screen, since the student who reads the
substitution cannot see it.

**The AI has permissions.** Think of it as RBAC for AI: every model call is
made as a role — transformation, verifier, course tutor, general explainer —
and `callAs` refuses the call when the role's conditions are not met. A
transformation prompt missing the contract will not run; the tutor will not run
with an empty corpus; general knowledge is unreachable unless a student
explicitly asked for it. Not "please behave yourself", but a defined permission
boundary.

**The model is not chosen yet.** `bench/` is a preservation benchmark — sixteen
passages written to tempt a model into being helpful, scored mechanically.
Claude is wired first; another vendor is one file against the same interface.
The winner is the model that preserves best, not the one that knows most.

## Who owns what

| | Owns |
|---|---|
| **Lecturer** | The academic source material, and everything the AI makes from it. It is theirs; it leaves with them. |
| **University** | The course environment: faculties, departments, courses, who teaches, who is enrolled. |
| **AI** | Nothing. It transforms, and proposes. It never approves and never publishes. |
| **Student** | Consumes what was published on a course they are on, and asks the Course AI. |

An administrator cannot edit a lecture, approve one, publish one, delete a
recording, or read an unapproved draft. That is not a setting.

## One lecture. Every language.

**Teach once. Learn everywhere.** A lecturer teaches in their own language; a
student in Brazil, France, Kenya or China gets the same course — notes to read
and copy, a lesson to listen to, a quiz, and the Course AI — in theirs.

```
MASTER — English, lecturer approved
   ├── Français   ├── Español    ├── Português
   ├── العربية    ├── 中文        ├── Kiswahili
   ├── Deutsch    └── Norsk …
```

**Translation happens only after the lecturer has approved the original.**
Translating a draft multiplies one mistake into six languages and then asks a
lecturer who reads one of them to find it. The gate refuses it.

Every language is a derivative of the **master**, never of another translation,
so six languages are six renderings of one lecture rather than a chain that has
drifted. The original governs: where a translation differs, the original is what
was taught and what the student is examined on, and it is one click away on
every translated page.

- **Terminology crosses untouched.** The same protection layer runs here, and
  for a sharper reason: a model translating *Yahusha HaMashiach* will otherwise
  reach for the target language's conventional name. It never sees the term —
  only a marker — and a translation that lost one is rejected.
- **Checked without reading the language.** Nobody here reads all nine, so the
  validator checks what is true in every language: the lecturer's protected
  terms, every figure the lecture states (١٩١٤ counts as 1914), the same
  headings, the same number of questions, and a length that is not absurd.
- **Who read it is on the page.** A lecturer cannot approve a language they do
  not read — the capability is held by a translation reviewer — so a
  translation nobody has checked says exactly that, every time it is shown.
- **A correction to the original makes every translation stale**, and says so
  rather than continuing to look approved.
- **Audio in each language.** "15-minute lesson" means *about* fifteen minutes:
  the same lecture is 15:00 in English, 15:12 in French, 15:20 in Arabic.
  Trimming the Arabic would mean cutting a sentence the lecturer said.

## The Course AI

Restricted to **one course's published lectures**. Ask it:

- *"Explain photosynthesis based on our lectures."* — answered from the course, with the lectures cited
- *"Which lecture introduced this concept?"* — **Lecture 06**, straight from the knowledge base, with no model call
- *"Give me a simple explanation."* / *"Now the university-level explanation."* — same material, the register the student asked for
- *"Create a 10-question test."* — built from the lectures, not from the internet
- *"Create a 15-minute audio revision covering lectures 1–6."*
- …and it answers in the student's language while quoting the lecturer's own sentence beside its rendering, because that sentence is the one they are examined on.

And when the course does not cover it, it says so and names what the course
*does* cover. A confident answer from outside the syllabus is how a student
revises the wrong thing.

Asked from inside a lecture (**Lecture Companion**), the ladder runs
`this lecture → the course`, and an answer found elsewhere says which lecture it
came from.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # seven suites, no network, no keys
npm run build
```

It runs with nothing configured: the offline processor stands in for the
language model, and **stamps every artefact it produces** so nobody approves
machine prose believing a machine wrote it. Transcription and speech have no
default vendor and say so instead of failing obscurely.

```bash
ANTHROPIC_API_KEY=...        # the real pipeline
ACADEMIC_AI_MODEL=claude-opus-5
ACADEMIC_DATA_DIR=./.data    # persist the demonstration across restarts
NEXT_PUBLIC_BASE_PATH=/academic   # when mounted inside another site
```

See `docs/ARCHITECTURE.md` for the four products inside this one, and
`docs/INTEGRATION.md` for mounting it inside an existing university system.
