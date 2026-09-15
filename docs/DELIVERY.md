# Delivery — how a lecture reaches a student, and how far that can go

**The lecturer-approved master is the source of truth for what was taught. AI
may transform its language, structure, translation and delivery, but it may not
alter its substance.**

That sentence governs this document as it governs the rest of the repository.
Everything below is a *delivery layer*: a new way to get the master to a
student. None of it is a new way to decide what the master says.

This document is a **map and a roadmap**. Stages V1–V3 are built and are
described in `ARCHITECTURE.md`; stages V4 and V5 are **not built**, and this
page exists so that nobody reads an architecture diagram as a feature list.

---

## The five stages

| | Stage | State |
|---|---|---|
| **V1** | Recorded lecture → approved master → notes, script, revision | **Built** |
| **V2** | Multilingual playback — one approved master, one version per language | **Built** |
| **V3** | Lecturer-authorised voice | **Consent built and enforced; no cloning vendor wired** |
| **V4** | Live translated audio over a live lecture | **Not built** |
| **V5** | Live translated video with AI lip synchronisation | **Not built** |

The order is not a guess about difficulty. It is the order in which each stage
stops being useful without the one before it: live translation of a lecture
nobody has approved is exactly the thing this platform refuses to do to a
recording, and a lip-synchronised video of the wrong words is worse than no
video at all.

---

## What already exists, and why it is the foundation

```
                    LECTURER
                       │
                       ▼
                 RAW LECTURE
                       │
                       ▼
                 TRANSCRIPTION
                       │
                       ▼
             AI LANGUAGE CLEANUP
                       │
                       ▼
              LECTURER REVIEW
                       │
                       ▼
              🔒 APPROVED MASTER
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
   TRANSLATION       STRUCTURE       KNOWLEDGE
       │               │                │
       └───────────────┼────────────────┘
                       ▼
              LANGUAGE VERSIONS
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
      NOTES           AUDIO          QUIZ
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  COURSE AI
                       │
                       ▼
                    STUDENT
```

The lock on the master is the whole design. Every later stage — including the
two that are not built — hangs off it, which is why the work went here first.

---

## V4 — live translated audio

The lecturer speaks; a student hears their own working language.

```
🎥 CAMERA
   │
   ├── VIDEO ───────────────────────────────┐
   │                                        │
   ▼                                        │
🎙️ MICROPHONE                                │
   │                                        │
   ▼                                        │
Speech recognition                          │
   │                                        │
   ▼                                        │
English speech/text                         │
   │                                        │
   ▼                                        │
Translation engine                          │
   │                                        │
   ▼                                        │
French text                                 │
   │                                        │
   ▼                                        │
French speech generation                    │
   │                                        │
   ▼                                        │
French audio                                │
   │                                        │
   └────────────────┐                       │
                    ▼                       ▼
              Audio + video          (V5: lip-sync engine)
                    │                       │
                    └───────────┬───────────┘
                                ▼
                         🇫🇷 French lecture
```

The video is the original video. The lecturer's mouth is visibly speaking
English; the student hears French. That is the honest version of live
translation and it is already most of the value.

### One video, several audio tracks

```
VIDEO
  │
  ├── English audio
  ├── French audio
  ├── Spanish audio
  ├── Swahili audio
  └── Arabic audio
```

Nobody picks a language during the lecture. The account already says:

```
Working language: French
```

so the French track follows the student in, the same way the French notes do.
One video stream with several audio tracks is a fraction of the infrastructure
of several video streams, and it is the reason V4 is affordable and V5 is not.

```
                  LECTURER
                     │
               English audio
                     │
           ┌─────────┼─────────┐
           ▼         ▼         ▼
        French    Spanish    Swahili
           │         │         │
           ▼         ▼         ▼
        Student    Student    Student
           A         B          C
```

### What is hard about it

- **Latency.** A recording can take five minutes to process and nobody minds.
  A lecture cannot be paused while the system thinks, and a translation that
  arrives fifteen seconds late is a lecture nobody can follow.
- **Word order.** Translation quality wants a finished sentence; latency wants
  the first three words. Those pull against each other, and where a language
  puts the verb decides how badly.
- **Speech that sounds like teaching.** Pacing, pauses, emphasis, the
  pronunciation of names. Fast and robotic is a different failure from slow and
  natural, and both lose the room.
- **Terminology, with nobody reviewing.** See below. This is the one that
  matters most here.

---

## V5 — live lip synchronisation

```
                    LECTURER
                       │
                 Live camera
                       │
             ┌─────────┴─────────┐
             │                   │
          VIDEO                AUDIO
             │                   │
             │              Speech-to-text
             │                   │
             │              Translation
             │                   │
             │              Voice generation
             │                   │
             │                   ▼
             │              French audio
             │                   │
             └──────────┬────────┘
                        ▼
                  AI LIP SYNC
                        │
                        ▼
                 French video
```

The lecturer's visible mouth is made to match the French words. This is a
separate technology from translation — visual dubbing — and it is the stage to
postpone, not because it does not exist but because it is hard in ways the
others are not:

- The mouth shapes for a French sentence are not the mouth shapes for the
  English one it came from, so the face has to be **generated**, continuously,
  and still be recognisably that person.
- **The lecturer moves.** Facing the camera and still is one problem. Turning
  to a board, walking, gesturing, drinking water, being interrupted by a
  student — that is a different problem, and it is what a lecture actually
  looks like.
- **Each language needs its own rendered stream.** The audio-track trick above
  does not work: nine languages is nine videos. That is a premium capability,
  not a default.

So V5 is a paid, advanced layer over a live lecture, and it should reach this
platform as a **vendor API consumed behind an interface**, exactly as
transcription and speech already are. The competitive advantage of this product
is not a lip-sync network; it is the academic chain around it —

```
University → Course → Lecturer → Approved lecture → Knowledge base
          → Languages → Voices → Students
```

— which is the part nobody else has built.

---

## The rule that does not relax because it is live

Live translation is where the constitution is easiest to lose, because there is
no lecturer reading the output before a student hears it.

```
LECTURER SPEAKS
       ↓
Speech recognition
       ↓
SOURCE TRANSCRIPT
       ↓
TRANSLATION
       ↓
TARGET-LANGUAGE AUDIO
```

The translation engine translates **what the lecturer actually said**. It does
not correct, improve, soften, update or complete it. In a recorded lecture the
lecturer catches an alteration at review; live, nobody does, so the mechanical
guards matter more rather than less:

- **Term protection runs in the live path.** `Yahuah` remains `Yahuah` —
  never Jehovah, never Yahweh, never Lord. `Yahusha HaMashiach` remains
  `Yahusha HaMashiach`. The markers go in before the model sees the text and
  come out after, exactly as `ai/terminology.ts` does today.
- **Validation still rejects.** A substituted term is not a note for somebody
  to weigh later; the segment does not go out. What a student hears instead —
  the original audio for that stretch, silence, or a spoken notice — is a
  product decision that has to be made before V4 ships, and it must be made
  deliberately rather than discovered.
- **Nothing live becomes a master.** A live translated stream is a delivery of
  the lecture, not a version of it. The master is still what the lecturer
  approves afterwards, and the recorded pipeline still runs.

---

## Distribution, and what it is not

A public broadcast — YouTube or anything like it — can carry the stream and,
where the platform supports them, localised audio tracks. That makes it a
**distribution channel**. It is not the academic system: the notes, the
questions, the Course AI, the quiz, the attendance and the certificate stay
here, because they are the things that require knowing who the student is and
what they are enrolled on.

---

## What this document does not claim

No part of V4 or V5 is built. There is no live transport, no streaming
transcription, no live translation, no lip synchronisation, and no vendor is
wired for any of it. Specific products have been named in conversation as
candidates — a live speech-to-speech service, a lip-sync API — and **none has
been evaluated here**: this environment has never held a key for one. When one
is chosen it arrives the way the others do, behind an interface, with a test
that watches it refuse.

The way to read this page: V1–V3 are what the platform does, V4 and V5 are what
it is shaped to accept.
