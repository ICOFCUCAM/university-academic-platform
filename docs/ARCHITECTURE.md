# Architecture

**Lecturers teach. AI transforms. Students learn.**

That sentence is the architecture, not the tagline. Each clause is enforced in
a different file, and the tests are written against the clauses rather than
against the code.

---

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

## 6. The engine is behind an interface

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

## 7. A ninety-minute lecture is not processed in an HTTP request

`src/lib/jobs/` — the upload creates jobs and returns; a worker runs them in
order; each writes its artefact as it finishes. A failure is retried three
times, then stops with its reason kept, and takes its dependents with it. On a
taught course the plan stops at the approval gate; in a personal library it
runs end to end.

## 8. What is not built

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
