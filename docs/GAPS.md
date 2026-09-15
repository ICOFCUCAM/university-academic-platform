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
| **Transcription** | **Built against a configured service.** `ACADEMIC_TRANSCRIBER` — an ordinary multipart endpoint returning `{text, segments}`, which is what Whisper-compatible services and most self-hosted runners speak. Tested against a fake server; **never run against a paid vendor**. |
| **Speaker separation** | **Built where the service reports it.** Speaker labels pass through exactly as given — `SPEAKER_00` is not renamed, because the platform does not know which speaker is the lecturer. No diarisation of our own. |
| **Timestamps in the transcript** | **Built where the service reports them**, shown beside each line, and absent where it does not — never 00:00 against every line. |
| **Text-to-speech** | **Built against a configured service.** `ACADEMIC_SPEECH` — `{text, voice}` in, audio bytes out, stored and served. Untested against a paid vendor. Duration is what the service reported, or unknown. |
| **Voice synthesis / lecturer voice** | Stubbed — consent record, catalogue, UI | The consent layer is real and enforced. No cloning vendor is wired; the voice id is passed to the speech service and what it does with it is its business. |
| **Audio player** | **Built.** Parts, speed from the student's profile, download, and "listened" recorded when playback starts rather than when the page loads. |
| **File storage** | **Built twice, behind one interface.** Disk (`ACADEMIC_MEDIA_DIR`) for a university that will not let lecture audio leave its estate, and an S3-compatible object store (`ACADEMIC_S3_*`) for anybody running two instances, since the second cannot read what the first wrote to its own disk — AWS, R2, MinIO, B2 and Supabase Storage all speak it, and no SDK is pulled in for forty lines of HMAC. Keys are minted by the platform so a filename can never reach the path, and everything is served through a route that asks `mayAct` rather than relying on an unguessable URL. **The object store has never run against a real bucket**: the signer is pinned to AWS's own published test vector and the requests are read by a fake server, which catches a signature wrong in shape and does not promise it authenticates. |
| **Live microphone recording** | **Built, in the browser.** `RecordLecture` uses `MediaRecorder` with the browser's own container, keeps the take in the page while it runs, and hands the result to the upload path as an ordinary file — so a recording and an uploaded file land in the same store by the same route. The tab must stay open; the page says so. No resumable upload, no recovery of a take lost to a closed tab. |
| **Authentication** | **Built for a mounted deployment.** Three modes: the demonstration switcher (default), a signed host header (`ACADEMIC_SESSION_MODE=header` + shared secret, HMAC, five-minute window), and a verified Supabase access token (signature and expiry, not merely decoded). No fallback outside `demo`. No login screen of its own, no password reset, no SSO client — the host owns those. |
| **Database** | **Adapter written, never run.** `data/supabase.ts` against the tables in `docs/integration/001_lecture_studio.sql`, with `data/conformance.mjs` as the suite it must pass — `npm run conformance:supabase` against a real project. Until that passes it is a draft, and the in-memory store is what runs. |
| **Job queue** | Stubbed — in-process, single worker, three retries | Survives neither a restart nor a second instance. No broker, no dead-letter handling, no back-pressure. |
| **Notifications** | **Built, in-app.** A bell with a count, raised when a stage finishes or fails, a translation is ready, work is set or returned, or an allowance runs out. No email or push (a vendor and a consent conversation). |

## 2. The student's learning objects

| | State |
|---|---|
| **Taking a quiz** | **Built.** `study/quiz.ts` parses the generated text into questions, holds the answers back, marks multiple choice and refuses to machine-mark a written answer; `QuizRunner` asks them and records the attempt. |
| **Flashcards as cards** | **Built.** `study/flashcards.ts` reads both generated shapes; `FlashcardDeck` shows one side at a time, in the order the schedule chose — due first, then new. |
| **Progress tracking** | **Built.** Read, listened, revised and quiz-taken, deduplicated per day, with a student's own record and a cohort shape that reduces `personId` to a set size so a lecturer cannot learn who. |
| **"Today's Learning" panel** | **Built** — the per-lecture `📖 Read · 🎧 Listen · 🧠 Revision · ❓ Quiz · 🤖 Ask` strip, with ticks against what is done. |
| **Spaced repetition** | **Built.** `study/repetition.ts` keeps one row per card per student — how far up a six-rung ladder it has climbed and when it is next worth asking — and nothing else: no history, no timings, no cohort view, and an RLS policy that lets the card's owner read it and nobody else. A card got wrong falls to the bottom rather than down one rung, running the deck three times in an evening promotes nothing, and a deck with nothing due says so and gives the date instead of reshuffling. |
| **Certificates** | **Built.** `credential/certificate.ts` reads the course's completion rule against what the student actually did — no rule certifies nothing, deliberately — and `issue-certificate` belongs to the lecturer and the registry, never a student or an assistant. Verification is a public page that asks nothing about whoever is looking and returns only the attestation. No printed artefact, no signing key, no external registry. |

## 3. Lecturer features named in the specification and absent

| | State |
|---|---|
| **Reading materials** | **Built.** A reading list the lecturer sets, kept in their own citation style and published like everything else. No uploaded documents (no storage). |
| **Assignments** | **Built.** Set, published, handed in, marked by a person with words, released deliberately. No file attachments, no plagiarism checking, no rubrics. |
| **Monitoring student engagement** | **Built** as counts per lecture — readers, listeners, quizzes sat and the cohort's average — with the lectures the cohort has not read flagged as a gap in delivery. Never a name; `cohortShape` cannot return one. |
| **A default voice per course** | **Built.** A “Set up the course” screen for whoever teaches it: the default voice, which voices are allowed on it, the terms nothing may substitute, and what completing the course means. A course cannot switch on the lecturer’s own voice — consent is given in their profile, by them, and a course setting that could turn it on would be a way round that, including on a course somebody else co-teaches. |
| **The university’s own standard voice** | **Built**, in Settings rather than on a course — a registrar teaches nothing, so a course screen would have put it where nobody who may change it can reach. Offered on every course beside the platform’s voices, and a course’s allowed list narrows the platform’s voices without removing the institution’s. |

## 4. The Course AI

| | State |
|---|---|
| **Scope ladder beyond the course** | **Built.** `lecture → course → department → university`, one rung at a time, each only tried when the one before could not answer. It is opened by the asker, never by the platform, and an answer from another course says which course and that it is not what they are examined on here. |
| **Course knowledge base per language** | **Deviation.** One knowledge base, in the lecture's own language; the tutor translates as it answers. Two indexes could disagree, and reconciling them would be authorship. The cost: retrieval quality in a language the corpus is not written in is untested. |
| **Search across a course** | **Built.** A search screen over the published lectures — no model, no cost, the passage shown as it is — with the same ladder offered rather than taken. |

## 5. Languages

| | State |
|---|---|
| **Transcript in the working language** | **Deviation, and the University has since ratified it.** The student's language package is notes, audio, quiz, revision and the Course AI; the transcript stays as the source artefact, in the language it was spoken, available under the same permissions as anything else. Translating every transcript in a university multiplies cost for a document with no reader. Revisit only if students actually ask for it. |
| **Interface localisation** | **Built for the student's path**, in all nine languages: navigation, the learning strip, the Course AI's labels, the revision room, the flashcard deck, the learning profile — including every accessibility control, because a student who needs the dyslexia-friendly typeface needs the control offering it to be in their language more than most — the open catalogue, and the refusals a student can actually reach. The line is deliberate: **the student's screens are in the student's language; the lecturer's workbench is in the course's language**, since a lecturer reviewing an English lecture is working in English. Still English: the lecturer's review panel, coursework, Settings and the audit log. `coverage()` reports how far each language got, and `reviewed: false` is recorded for all eight because no native speaker has checked one string of them. |
| **Right-to-left layout** | **Built, and measured rather than reasoned about** — `npm run check:rtl` drives a browser and asserts it. The document itself carries `dir`, not a div inside it, so the scrollbar and the native controls mirror too; the chrome uses logical properties throughout, so the navigation's rule sits on the edge facing the content instead of the screen edge; each course card says which language it is in and is laid out in that one, not the reader's; and untranslated English sentences resolve their own direction per paragraph rather than arriving with the full stop on the left. What is still not done: the strings themselves, on the deeper screens, are English — that is the localisation row above, not this one. |
| **A per-language audio duration** | Stubbed — estimated from a words-per-minute table, not measured, because no audio exists. |

## 6. Choosing the model — the work that must happen before production

| | State |
|---|---|
| **The preservation benchmark** | Built, **never run.** This environment has no API key. Nothing in `bench/` is a result. |
| **Case coverage** | **49 cases**, four to eight per family, each validated in milliseconds by `npm run test:bench` — which caught three cases that could never have passed. |
| **Gemini and OpenAI adapters** | **Built** (`ai/otherVendors.ts`), one REST call each, driven by `--vendor=`. Not verified against either service: no keys here. |
| **The scorecard** | Empty. No model has been measured on meaning preservation, unwanted corrections, hallucination, grammar or structure. |
| **The verification pass** | Built, never exercised against a live model. Its own accuracy — does it catch a real alteration, does it cry wolf — is unmeasured. |
| **Translation quality** | Unmeasured in every language. The validator checks structure, figures and terminology; nothing has checked whether a translation is *good*. |

## 7. The business layer

| | State |
|---|---|
| **Payments** | **Not built.** No checkout, no subscription, no invoices. `access: 'paid'` behaves exactly as enrolment-only, which is the safe direction. |
| **The minute meter** | **Wired.** `addLecture` checks the account's plan before anything is processed, records the minutes, and notifies when the allowance is spent. |
| **Credits** | **Not built.** |
| **Independent educators** | Stubbed. `Publisher` exists as a type and `departmentId` is optional; there is no sign-up, no publisher-owned tenancy, no isolation between publishers. |
| **Cross-university libraries / partnerships** | Stubbed. `Course.partners` records intent; no federation, no sharing, no sync. |
| **Revenue share, marketplace, catalogue browsing** | **Not built.** |
| **Open courses** | **Built, and now findable.** `/catalogue` lists what the institution has opened, asks nothing about whoever is reading, and counts only the lectures and languages that actually have something published — a language a course is "offered in" with nothing in it is a promise, not a catalogue entry. A paid course appears with its price and the plain sentence that this platform takes no payments, because a catalogue implying otherwise would be the one page here that lied. Building it caught a real defect: five course screens each decided enrolment for themselves, two had never heard of `access: 'open'`, and the catalogue's own "Open the course" button led to "you are not enrolled". They now all ask `mayEnterCourse`. |

## 8. Integration with the ICOF Global University system

| | State |
|---|---|
| **The mapping** | Written — `docs/INTEGRATION.md`, entity by entity. |
| **The Supabase adapter** | **Written, unverified.** Reads their `courses`, `course_offerings`, `lecturers`, `students` and `course_roll`; keeps this platform's own objects in `ls_*`. Never returned a row. |
| **The migration** | **Written, never run** — `docs/integration/001_lecture_studio.sql`. It is not idempotent-proved, has not been loaded against a database shaped like theirs, and no readiness probe reports it. It must not be described as ready. |
| **Row-level security** | **Written** in the same file, mirroring `domain/ownership.ts` policy for policy — a student sees a published artefact and nothing else, the owner alone may write, and `ls_cohort_shape` has no `person_id` so a lecturer cannot learn who. Unverified like the rest. |
| **A portal entry** | Not added to their `portalNav.tsx`; the snippet is in the integration document. |

## 9. Content lineage and AI integrity

The section the University asked for, because this is what a university's
lawyers ask about rather than what its lecturers ask about. **The states below
are read from the code as it stands, not from the copy of this audit that was
circulated** — several of those rows describe the repository as it was before
this term's work and would understate it.

The question the whole section exists to answer:

> *Where did this sentence in the French notes come from?*

```
Lecture 08 → Approved master v3 → French translation v2 → Notes v2
```

| Requirement | State |
|---|---|
| **Raw recording preserved** | **Built.** Stored as its own artefact with the bytes behind it — disk or an S3-compatible bucket — and never overwritten by anything downstream. |
| **Raw transcript preserved** | **Built.** The transcript is its own stage: the cleaned text is a *new* artefact derived from it, so "what was actually said" survives the cleanup that follows it. |
| **Lecturer-approved master** | **Built.** `approve` records who and when; nothing publishes without it, and no later stage runs on an unapproved source. |
| **Immutable approved version** | **Built, in the only sense that is honest.** The substance is not frozen — a lecturer may correct their own material, and must be able to — but it cannot change *quietly*: a correction mints a new version, the old body is kept openable, everything downstream is marked stale, and a regeneration over an approval clears the approval and says so in the version history and the audit log. |
| **Derived content linked to master** | **Built.** `derivedFromId` is required on everything except the recording. |
| **Translation linked to master** | **Built.** `translatedFromId` names the *approved* original, never a draft, and a translation of a translation is refused. |
| **Audio script linked to source** | **Built.** Script derives from the notes, audio from the script, each part from its own slice. |
| **Quiz linked to source** | **Built.** A study aid records `builtFrom` — the artefacts it was written out of **and the version each was at** — because the lecturer may correct the notes next week and the question was asked from the text as it stood that day. |
| **Terminology protection** | **Built and mechanical.** Markers in before the model sees the text, counted on the way out; a substitution is rejected rather than reported. |
| **Transformation validation** | **Built, never exercised against a live model.** Its own accuracy — does it catch a real alteration, does it cry wolf — is unmeasured, and that is the benchmark's job. |
| **AI prohibited from factual correction** | **Structural, then unproven.** Four refusals live in the role gate rather than the prompt, and the forbidden operations are enumerated in code. But whether a given model *obeys* under load is exactly what has not been measured: no model has been chosen and `bench/` holds no results. |
| **Output traceability** | **Built.** `service.provenance()` walks the chain and the artefact screen shows it, with the language, version, who approved it, who read the translation and how many earlier versions are kept. No bodies come back, so a student may read their own provenance without it becoming a way to open a draft. |
| **Version history** | **Built.** Every earlier body kept in full — a diff cannot be published, and a version you cannot open is not a version. |
| **Who did what** | **Built.** Approving, publishing, withdrawing, regenerating, issuing a certificate and moving a working language are recorded with a name. Reading is deliberately not recorded and cannot be — see the audit-log entry in §11. |

## 10. Live delivery — not built, and mapped

`docs/DELIVERY.md` is the map. V1 recorded multilingual lectures, V2
multilingual playback, V3 the lecturer's authorised voice: built, except that
no cloning vendor is wired. **V4 live translated audio and V5 live translated
video with lip synchronisation: not built at all** — no transport, no streaming
transcription, no live translation, no lip-sync, and no vendor evaluated for
any of it. Candidates have been named in conversation; none has been run here,
and this environment has never held a key for one.

Two things that page settles rather than leaves open, because they are
decisions and not engineering:

- **A live stream is a delivery of a lecture, never a version of it.** The
  master is still what the lecturer approves afterwards, and the recorded
  pipeline still runs.
- **Term protection runs in the live path, and validation still rejects.** What
  a student hears when a segment is rejected — the original audio, silence, or
  a spoken notice — has to be decided before V4 ships rather than discovered
  after it.

## 11. Smaller debts, named so they are not discovered

- **The demonstration data is invented** — a university, a lecturer, a student, a French translation I wrote by hand. Nothing in `seed.ts` is a real institution or person, and the French notes are not machine output.
- **Accessibility is built**, in the learning profile: text size, a dyslexia-friendly typeface, high contrast, motion, always-underlined links, and the spoken script shown beside the audio rather than behind a click. The settings are the person's own — no parameter exists for setting somebody else's, and no screen reports them, because a typeface is a disclosure made to a stylesheet. They are applied on the server so the first paint is already right, and the palette moved to CSS variables so high contrast is a swap rather than a second stylesheet. Measured with `getComputedStyle` rather than reasoned about: 15px → 19px, `rgb(18,22,31)` → `rgb(0,0,0)`, links underlined, motion stopped. **What is still not done:** the captions are the whole script, not a timed track — the speech services return audio and a length, not word timings, and the screen says so rather than claiming synchronisation. No screen-reader audit has been done, and no native speaker has checked any of it in the other eight languages.
- **The audit log is built**, and the shape of it is the point: it records acts that change what somebody else can see, do or claim — approved, published, withdrawn, regenerated, translation vouched for, certificate issued, enrolment changed, working language moved, voice authorised or withdrawn, the terms, the completion rule, the voices — each with a name, a time, and the reason where one was given. **It does not record reading**, and cannot: `AUDITED_ACTS` is a closed list, `record` refuses anything not on it, and a test holds every act name and phrase against the words that would mean somebody's reading was being kept, so adding `artefact.read` fails the suite. The store has an append and a read and no delete; the Postgres table has no insert, update or delete policy at all. The registry reads the institution's record, a lecturer reads their own courses', and nobody else is even shown the door.
- **Rate limiting** is per process: one deployment is one bucket, two instances are two. Enough for a single installation, replaceable by design.
- **Cost accounting** has a screen now, on the course set-up page: runs, which stage each belongs to, and output in tokens — or in characters, with the reason said out loud, where no vendor reported any. It records every run from the vendor's own reported usage and says *unmetered* rather than showing a confident zero. No currency conversion: tokens and characters, not dollars.
- **Deviation: the teaching script teaches** ("Before we get to the two stages…") rather than avoiding podcast framing, following the later specification over the earlier one.
- **Deviation: students do not upload lectures** on a course. A personal library exists in the model (`Lecture.context: 'personal'`) and has no screens — the specification moved to "the student is the consumer, not the supplier", and the code followed.

---

## What would have to be true to run a pilot

In order, because each one blocks the next:

1. A transcription vendor, and the object store pointed at a real bucket — the adapter is written and signature-checked, never authenticated.
2. A database implementation of `Store` and real authentication — without them nothing survives a restart and anybody can be anybody.
3. The benchmark run against Claude, Gemini and OpenAI, and a model chosen on preservation.
4. A speech vendor — the audio lesson is half the product's promise.
5. The meter wired to the plans, if anybody is paying.

Everything else on this page can wait for a second term.
