# What is not built

An audit of every specification given for this platform against what is in the
repository. Written to be read before anybody demonstrates this to a customer,
because the fastest way to lose a university is to show them something that
only exists in a screenshot.

Three kinds of entry:

- **Not built** — named in a specification, absent from the code.
- **Stubbed** — the interface, the rules and the screens exist; the thing
  behind them does not.
- **Deviation** — built differently from the specification, deliberately, with
  the reason.

---

## 1. Vendors and infrastructure — nothing external is wired

| | State | What this blocks |
|---|---|---|
| **Transcription** | Stubbed — `Transcriber` interface, refuses by name | The pipeline cannot start from audio at all. Every demonstration begins from a pasted transcript. |
| **Speaker separation** | **Not built** | Named in the specification ("speaker separation where possible"); the transcript has no speaker field and no diarisation step. |
| **Timestamps in the transcript** | **Not built** | `stages.ts` describes the transcript as "every word, as spoken, **with timings**". There are no timings. Either the transcriber must supply them or that line is a lie. |
| **Text-to-speech** | Stubbed — `SpeechSynthesiser` refuses by name | No audio file has ever been produced. The 15-minute lesson exists as a script; the durations shown are *estimates* from a words-per-minute table. |
| **Voice synthesis / lecturer voice** | Stubbed — consent record, catalogue, UI | The consent layer is real and enforced. The cloning it governs does not exist. |
| **Audio player** | **Not built** | No player, no speed control applied to real audio, no download, no offline listening ("listen anywhere" is a promise on paper). |
| **File storage** | **Not built** | The upload form records a file *name*. MP3/M4A/WAV/video are not accepted, stored or served. |
| **Live microphone recording** | **Not built** | Named in the specification. |
| **Authentication** | Stubbed — a demonstration switcher, labelled as one | Supabase Auth, SSO, password reset, sessions: none. `src/lib/session.ts` is the only file that would change. |
| **Database** | Stubbed — in-process store with an optional JSON snapshot | Nothing survives a deployment. The `Store` interface is the seam; no Postgres/Supabase implementation exists. |
| **Job queue** | Stubbed — in-process, single worker, three retries | Survives neither a restart nor a second instance. No broker, no dead-letter handling, no back-pressure. |
| **Notifications** | **Not built** | "Notification" is the last box of the specification's job diagram. Nothing tells a lecturer their lecture finished processing. |

## 2. The student's learning objects

| | State |
|---|---|
| **Taking a quiz** | **Built.** `study/quiz.ts` parses the generated text into questions, holds the answers back, marks multiple choice and refuses to machine-mark a written answer; `QuizRunner` asks them and records the attempt. |
| **Flashcards as cards** | **Built.** `study/flashcards.ts` reads both generated shapes; `FlashcardDeck` shows one side at a time. No spaced repetition — "I knew it" is not yet remembered between sessions. |
| **Progress tracking** | **Built.** Read, listened, revised and quiz-taken, deduplicated per day, with a student's own record and a cohort shape that reduces `personId` to a set size so a lecturer cannot learn who. |
| **"Today's Learning" panel** | **Built** — the per-lecture `📖 Read · 🎧 Listen · 🧠 Revision · ❓ Quiz · 🤖 Ask` strip, with ticks against what is done. |
| **Spaced repetition** | **Not built.** Flashcard confidence is per session. |
| **Certificates** | **Not built.** Named in the business list. No completion model, no issuance, no verification. |

## 3. Lecturer features named in the specification and absent

| | State |
|---|---|
| **Reading materials** | **Not built.** "Add reading materials" appears in the lecturer's capability list. There is no artefact kind for a reading list or an uploaded document. |
| **Assignments** | **Not built.** Named in the same list. No submission, no marking, no due dates. |
| **Monitoring student engagement** | **Not built** beyond counts. `view-engagement` is held and the screens show enrolment numbers; there is no per-student or per-lecture engagement data because nothing is recorded (see progress tracking). |
| **A default voice per course** | Stubbed. `Course.defaultVoice` and `allowedVoices` exist in the model; no screen sets them. |
| **The university's own standard voice** | Stubbed. `voicesFor` accepts one; nothing configures it. |

## 4. The Course AI

| | State |
|---|---|
| **Scope ladder beyond the course** | Partial. `lecture → course` is built and tested. `department → university` is **not built**: there is no cross-course retrieval, and a question the course cannot answer stops at the course. |
| **Course knowledge base per language** | **Deviation.** One knowledge base, in the lecture's own language; the tutor translates as it answers. Two indexes could disagree, and reconciling them would be authorship. The cost: retrieval quality in a language the corpus is not written in is untested. |
| **Search across a course** | **Not built** as a screen. Retrieval exists inside the tutor; there is no search box over the course's material. |

## 5. Languages

| | State |
|---|---|
| **Transcript in the working language** | **Deviation.** The specification lists the transcript among the things that arrive in the student's language. It is not translated: it is working material, nobody revises from it, and translating every transcript in a university multiplies cost for a document with no reader. Revisit if students actually ask for it. |
| **Interface localisation** | **Not built.** Navigation, buttons and every label are in English regardless of working language. The specification asks for the interface too. This is a large, mechanical job (extract every string, add a catalogue) and none of it is done. |
| **Right-to-left layout** | Partial. Artefact bodies and the chat render `dir="rtl"`; the surrounding chrome does not mirror. |
| **A per-language audio duration** | Stubbed — estimated from a words-per-minute table, not measured, because no audio exists. |

## 6. Choosing the model — the work that must happen before production

| | State |
|---|---|
| **The preservation benchmark** | Built, **never run.** This environment has no API key. Nothing in `bench/` is a result. |
| **Case coverage** | 16 cases against the specification's ~50. All eight families are represented, two each. |
| **Gemini and OpenAI adapters** | **Not built.** Each is one file against `LanguageModel`; until they exist the benchmark can only score Claude. |
| **The scorecard** | Empty. No model has been measured on meaning preservation, unwanted corrections, hallucination, grammar or structure. |
| **The verification pass** | Built, never exercised against a live model. Its own accuracy — does it catch a real alteration, does it cry wolf — is unmeasured. |
| **Translation quality** | Unmeasured in every language. The validator checks structure, figures and terminology; nothing has checked whether a translation is *good*. |

## 7. The business layer

| | State |
|---|---|
| **Payments** | **Not built.** No checkout, no subscription, no invoices. `access: 'paid'` behaves exactly as enrolment-only, which is the safe direction. |
| **The minute meter** | **Not wired.** `billing/plans.ts` has the allowances and `mayProcess` computes a refusal — and nothing calls it. An upload is never checked against a plan. |
| **Credits** | **Not built.** |
| **Independent educators** | Stubbed. `Publisher` exists as a type and `departmentId` is optional; there is no sign-up, no publisher-owned tenancy, no isolation between publishers. |
| **Cross-university libraries / partnerships** | Stubbed. `Course.partners` records intent; no federation, no sharing, no sync. |
| **Revenue share, marketplace, catalogue browsing** | **Not built.** |
| **Open courses** | Built — `access: 'open'` is enforced in `mayAct` and tested. No public catalogue page to find one. |

## 8. Integration with the ICOF Global University system

| | State |
|---|---|
| **The mapping** | Written — `docs/INTEGRATION.md`, entity by entity. |
| **The Supabase adapter** | **Not built.** No `Store` implementation against their schema. |
| **The migration** | **Not written**, and must not be described as ready: in that repository a migration is handed over with bundles rebuilt, proved twice against a database shaped like theirs, and a readiness probe added. |
| **Row-level security** | **Not written.** The RLS must mirror `domain/ownership.ts` or the database will be more permissive than the product. |
| **A portal entry** | Not added to their `portalNav.tsx`; the snippet is in the integration document. |

## 9. Smaller debts, named so they are not discovered

- **The demonstration data is invented** — a university, a lecturer, a student, a French translation I wrote by hand. Nothing in `seed.ts` is a real institution or person, and the French notes are not machine output.
- **No accessibility section** in the learning profile, though the specification's sketch has one. No captions model, no dyslexia-friendly typography, no screen-reader audit has been done.
- **No audit log** of who read what. Reasonable for now; a university will ask.
- **No rate limiting** anywhere, including on the Course AI, which costs money per question.
- **No cost accounting per lecture** — nothing records what a transformation cost, which is what a university will want before it buys.
- **Deviation: the teaching script teaches** ("Before we get to the two stages…") rather than avoiding podcast framing, following the later specification over the earlier one.
- **Deviation: students do not upload lectures** on a course. A personal library exists in the model (`Lecture.context: 'personal'`) and has no screens — the specification moved to "the student is the consumer, not the supplier", and the code followed.

---

## What would have to be true to run a pilot

In order, because each one blocks the next:

1. A transcription vendor and an object store — without them the pipeline has no input.
2. A database implementation of `Store` and real authentication — without them nothing survives a restart and anybody can be anybody.
3. The benchmark run against Claude, Gemini and OpenAI, and a model chosen on preservation.
4. A speech vendor — the audio lesson is half the product's promise.
5. The meter wired to the plans, if anybody is paying.

Everything else on this page can wait for a second term.
