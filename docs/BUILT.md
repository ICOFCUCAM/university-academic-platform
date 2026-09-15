# What is built

The companion to `GAPS.md`, and its opposite: that page is an audit of what is
absent, this one is an audit of what is here. Both exist for the same reason —
the fastest way to lose a university is to show them something that only exists
in a screenshot, and the second fastest is to fail to show them something that
does.

**Every number on this page was counted from the repository, not remembered**,
and `npm run check:built` recounts them: add a screen without updating this
page and it fails. An audit written once is accurate once, and a customer
reading a stale figure is being misled whether or not anybody meant it.

Every row names the file that does the work and the test that watches it.

---

## The shape of it

| | |
|---|---|
| Source files (TypeScript/TSX, excluding tests) | **119**, 19,020 lines |
| Test files | **34**, 3,621 lines |
| Checks that must pass for `npm test` to succeed | **1,186** |
| Of those, **refusals** — a rule watched turning something down | **53** |
| Screens | **18** |
| API routes | **18** |
| React components | **25** |
| Postgres tables in the migration | **22**, under **36** row-level-security policies |
| Languages the interface speaks | **9** |
| Interface strings per language | **114** |
| Preservation-benchmark cases | **49**, across 8 families |

A test here is not a coverage statistic. The suite is written against the
*claims* — a rule that nobody has watched refuse anything is a rule nobody has
tested — which is why the refusal count is the one worth reading.

---

## 1. The rules, as code rather than as prose

| What | Where | Watched by |
|---|---|---|
| **The AI Transformation Constitution** — 9 articles, each naming the files that enforce it | `ai/constitution.ts` | `constitution.test.mjs` (71 checks) — it opens every named file |
| **Capabilities** — 27 of them across 6 roles, the lecturer's list deliberately closed | `capabilities.ts` | `capabilities.test.mjs` (70) |
| **Ownership** — one function every route, screen and adapter asks | `domain/ownership.ts` | `ownership.test.mjs` (36) |
| **The pipeline as data** — 8 stages, each declaring what it needs and whether it faces students | `pipeline/stages.ts` | `stages.test.mjs` (35) |
| **AI role gate** — four structural refusals, in code rather than in a prompt | `ai/roles.ts` | `roles.test.mjs` (20) |
| **Master integrity** — what AI may and may not do to an approved lecture | `ai/masterIntegrity.ts` | in `service.test.mjs` |

The three that matter most, stated as the tests state them: a university
administrator cannot delete a lecturer's recording; a university administrator
cannot read an unpublished draft; and nobody publishes what nobody has
approved.

## 2. Terminology — the layer that rejects rather than reports

```
LECTURE → TRANSCRIPTION → TERM PROTECTION → AI → TERM VALIDATION → PUBLISHED
```

`ai/terminology.ts`, 20 checks. Protected terms are replaced by opaque markers
before the model sees the text, so there is nothing for a pretrained habit to
reach for, and the longest term is protected whole — `Yahusha HaMashiach` is one
marker, never `Yahusha` followed by a word a model may then normalise. After
restoration, a substituted term is **not a finding for the lecturer to weigh**:
the output is rejected and nothing is published.

It runs in the live path too (§9), where it matters more because nobody is
reading the output before a student hears it.

## 3. The pipeline, end to end

`service.ts` — 136 checks in `service.test.mjs`, the largest suite in the
repository.

Recording → transcript → corrected text → **lecturer review** → structured
notes → teaching script → 15-minute audio → revision materials, with
translation hanging off the approved master rather than off any draft. A
correction mints a new version, keeps the old body openable, and marks
everything downstream stale — never silently regenerating it, because that
would throw away a lecturer's own corrections further down.

- **Knowledge base** — `knowledge/build.ts` (19). A merge across lectures that
  reports what is used but never defined, and keeps two lectures that disagree
  as a disagreement rather than choosing.
- **Course AI** — `ai/tutor.ts` (34). One corpus, citations, and a scope ladder
  `lecture → course → department → university` that only the asker may open.
- **Word check before speech** — `ai/unusual.ts` (23). Unfamiliar terms are put
  to the lecturer before anything is spoken aloud.
- **Offline processor** — `ai/offline.ts` (17). The product opens, demonstrates
  and tests itself with no key and no network, and says so on every artefact.
- **Jobs** — `jobs/` (13). A ninety-minute lecture is not processed inside an
  HTTP request.

## 4. Languages

`i18n/` — 51 checks on translation, 24 on the interface catalogue.

One approved master, one version per language, never a translation of a
translation. Quizzes are written from the master and then carried across, so a
student in Lyon and a student in Lagos answer the same academic questions.
Validation is language-agnostic: markers, figures including Eastern Arabic
digits, structure and length ratio.

The interface speaks 9 languages across 114 strings, `reviewed: false` recorded
for all eight non-English ones because no native speaker has checked a word of
them. Right-to-left is **measured, not assumed** — `npm run check:rtl` drives a
browser and asserts the document direction, the side the navigation sits on,
the edge its rule is on, and that English text inside an Arabic page resolves
its own direction.

## 5. What a student actually does

| | Where | Checks |
|---|---|---|
| Sit a quiz, marked, with written answers refused rather than string-matched | `study/quiz.ts` | 22 |
| Flashcards, one side at a time | `study/flashcards.ts` | 7 |
| **Spaced repetition** — a six-rung ladder, wrong drops to the bottom, twice in an evening promotes nothing, and nothing-due says so | `study/repetition.ts` | 24 |
| Progress **without surveillance** — their own record, and a cohort shape that reduces `personId` to a set size | `study/progress.ts` | 19 |
| Reading lists, assignments, marking by a person | `coursework/` | 23 |
| Certificates, and public verification that asks nothing about whoever is looking | `credential/certificate.ts` | 19 |
| Accessibility: text size, typeface, contrast, motion, captions, links — theirs alone, reported to nobody | `access/accessibility.ts` | 12 |

## 6. Voice, and consent

`voice/voices.ts` (30). A voice is a person: this platform never synthesises a
lecturer's unless they authorised it themselves, in their own profile, with a
dated record and a scope. Revocation is honoured at listening time, so audio
already made stops being offered. A course setting cannot switch it on — the
service refuses that, and a test watches it refuse.

## 7. Infrastructure behind seams

| | State |
|---|---|
| **Storage** | Disk and an S3-compatible object store (AWS, R2, MinIO, B2, Supabase), 19 + 17 checks. The signer is pinned to AWS's own published test vector. Keys are minted by the platform, so a filename never reaches the path. |
| **Database** | A `Store` interface with an in-memory implementation and a Supabase adapter, held to the same conformance suite (32 checks). 22 tables, 36 RLS policies mirroring `ownership.ts`. |
| **Sessions** | Three modes — demonstration switcher, HMAC-signed host header, verified Supabase JWT — with **no fallback** outside demo (13 checks). |
| **Vendors** | Transcription and speech against ordinary HTTP contracts (15), plus OpenAI and Gemini adapters for the benchmark. |
| **Metering** | Plans, a minute meter that refuses *before* the spend, per-run cost from the vendor's own reported usage (19 + 8). |
| **Notifications, audit** | In-app notifications; an audit log of administrative acts that **cannot record reading** — the act list is closed and a test holds it against the words that would mean somebody's reading was kept (11). |

## 8. Provenance

```
Lecture 08 → Approved master v3 → French translation v2 → Notes v2
```

`service.provenance()` walks it, and the artefact screen shows it. Every link
is a field written when the thing was made, not an inference: `derivedFromId`,
`translatedFromId`, `version`, and an `ArtefactVersion` row keeping each earlier
body in full. A study aid records `builtFrom` — which approved texts, at which
version. No bodies come back from the walk, so a student may read their own
provenance without it becoming a way to open a draft.

## 9. Live — V4's platform half

`live/` (24 checks) and `/courses/[id]/live`.

A lecturer opens a room; the languages it carries are taken from the working
languages of the people enrolled, not chosen. Each stretch of speech goes
through protection → translation → restoration → validation, and a substituted
term **does not go out**. What the student hears instead is decided rather than
discovered: by default the lecturer's own words for that stretch, always with
the reason on screen in their own language. Delivery is in order or not at all;
a late translation is dropped; a refusal is not a hole.

Closing the room leaves a recording and a lecture — and not one published word.
A live stream is a delivery of a lecture, never a version of it.

## 10. Documentation that is part of the product

- `ARCHITECTURE.md` — the constitution, the ownership line, the pipeline, where
  a sentence came from.
- `DELIVERY.md` — V1 to V5, with every diagram carrying its state.
- `GAPS.md` — what is not built, what is stubbed, what is a deliberate
  deviation, and what would have to be true to run a pilot.
- `INTEGRATION.md` — mounting inside an existing university system.
- `bench/` — 49 preservation cases, validated by a test that has already caught
  three cases which could never have passed.

---

## What this page is not

It is not a claim that the product is ready. **No vendor has ever been run
here**: not a transcriber, not a speech service, not a bucket, not a live
translator, and no language model — `bench/` holds no results and no model has
been chosen. Everything above is the half of the system that is ours, built
against interfaces and proved against fakes.

`GAPS.md` is the other half of the truth, and the two should always be read
together.
