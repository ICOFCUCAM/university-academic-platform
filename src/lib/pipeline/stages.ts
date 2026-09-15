// ---------------------------------------------------------------------------
// THE AI TRANSFORMATION ENGINE — the heart of the platform.
//
//   LECTURE (audio / video)
//        │
//        ▼
//   TRANSCRIPTION
//        │
//        ▼
//   AI ACADEMIC PROCESSOR ─────────┬──────────────────┐
//        │                         │                  │
//   Grammar & Language     Knowledge Extraction   Structure & Formatting
//   (corrected academic      (concepts, claims,    (structured notes)
//    text)                    definitions)              │
//        │                         │                    │
//        │                         ▼                    │
//        │               COURSE KNOWLEDGE BASE ◄────────┘
//        │                  (every lecture adds to it)
//        ▼
//   AI TEACHING SCRIPT ──► 15-MINUTE AUDIO LESSON
//                     └──► REVISION MATERIALS
//
// The chain is DATA, not a function that knows what comes next. Every screen,
// every queue and every test reads it from here, so a new artefact is one
// entry in this file.
//
// WHY THE PROCESSOR IS THREE PASSES AND NOT ONE. Grammar, structure and
// knowledge fail differently and are corrected differently. A mis-heard term
// is a language fault the lecturer fixes in one place; a missing section is a
// structural one; an extracted concept that the lecture never taught is
// neither, and it would go on to poison the course's knowledge base and
// everything the Course AI says out of it. One pass producing one artefact
// would make all three the same problem, and a lecturer correcting the notes
// would still be teaching against an extraction nobody had read.
//
// THE CORRECTION IS THE HINGE. Everything downstream is made from the
// corrected text a person approved and never from the raw transcript: a
// mis-heard term repeated into the notes, the script, the audio, the revision
// cards and the knowledge base is one error in a student's hands five times.
// ---------------------------------------------------------------------------

import type { ArtefactKind, ArtefactState } from '../domain/types';

export interface Stage {
  kind: ArtefactKind;
  label: string;
  /** One line, in the lecturer's language, for the screen. */
  purpose: string;
  /** What it is made from. Null for the one a person supplies. */
  from: ArtefactKind | null;
  /** Who makes it. */
  by: 'lecturer' | 'transcription' | 'language-model' | 'speech';
  /**
   * Must the source be APPROVED, or merely present? True only where a
   * person's academic judgement stands between the machine and the student.
   */
  requiresApprovedSource: boolean;
  /** What students get. A transcript is working material; notes are not. */
  studentFacing: boolean;
}

export const STAGES: Stage[] = [
  {
    kind: 'recording',
    label: 'Recording',
    purpose: 'The lecture as it was given. Yours, and the source of everything below.',
    from: null,
    by: 'lecturer',
    requiresApprovedSource: false,
    studentFacing: true,
  },
  {
    kind: 'transcript',
    label: 'Transcript',
    purpose: 'Every word, as spoken, with timings. Working material, not a handout.',
    from: 'recording',
    by: 'transcription',
    requiresApprovedSource: false,
    studentFacing: false,
  },
  {
    kind: 'corrected_text',
    label: 'Corrected academic text',
    purpose: 'The transcript in academic prose — terms spelled right, repetition gone, meaning untouched.',
    from: 'transcript',
    by: 'language-model',
    requiresApprovedSource: false,
    studentFacing: true,
  },
  {
    kind: 'knowledge_extract',
    label: 'Knowledge extraction',
    purpose: 'The concepts, definitions and claims this lecture actually teaches — what the course knowledge base is built from.',
    from: 'corrected_text',
    by: 'language-model',
    // THE GATE, and it is here for the knowledge base's sake. An extraction
    // taken from an uncorrected draft carries the mis-heard term into every
    // answer the Course AI will ever give.
    requiresApprovedSource: true,
    // Not a handout. A student is given the notes; this is the machine-readable
    // layer beneath them.
    studentFacing: false,
  },
  {
    kind: 'structured_notes',
    label: 'Structured notes',
    purpose: 'Headings, key concepts, definitions and worked points a student can revise from.',
    from: 'corrected_text',
    by: 'language-model',
    requiresApprovedSource: true,
    studentFacing: true,
  },
  {
    kind: 'teaching_script',
    label: 'Teaching script',
    purpose: 'The fifteen-minute lesson as written words, before anybody speaks them. Read it before it is voiced.',
    from: 'structured_notes',
    by: 'language-model',
    requiresApprovedSource: true,
    studentFacing: false,
  },
  {
    kind: 'audio_15min',
    label: '15-minute audio lesson',
    purpose: 'The lecture condensed to a quarter of an hour, for the walk to campus.',
    from: 'teaching_script',
    by: 'speech',
    // SPOKEN WORDS CANNOT BE PROOFREAD BY THE LISTENER. The script is approved
    // before it is voiced, which is the whole reason the script is its own
    // artefact rather than a hidden step inside the audio.
    requiresApprovedSource: true,
    studentFacing: true,
  },
  {
    kind: 'revision_materials',
    label: 'Revision materials',
    purpose: 'Key terms, questions to test yourself, and what to read next.',
    from: 'structured_notes',
    by: 'language-model',
    requiresApprovedSource: true,
    studentFacing: true,
  },
];

export const STAGE_BY_KIND: Record<ArtefactKind, Stage> =
  Object.fromEntries(STAGES.map((s) => [s.kind, s])) as Record<ArtefactKind, Stage>;

/** What is made from this one, if anything. */
export function stagesFrom(kind: ArtefactKind): Stage[] {
  return STAGES.filter((s) => s.from === kind);
}

// ---------------------------------------------------------------------------
// THE STATE MACHINE
//
//   absent → queued → running → ready → approved → published
//                        └────────────────────────────► failed
//
// `published` goes back to `approved` when the lecturer withdraws it, and a
// `failed` stage can be asked for again. Nothing else moves.
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<ArtefactState, ArtefactState[]> = {
  absent: ['queued'],
  queued: ['running', 'failed'],
  running: ['ready', 'failed'],
  // A re-run replaces what is there: ready → queued is how a lecturer says
  // "do that again, the recording was wrong".
  ready: ['approved', 'queued', 'failed'],
  // Approved → queued too: a lecturer who corrects the text re-makes what
  // was built from it. `staleAfterEdit` below is how the screen knows.
  approved: ['published', 'queued'],
  published: ['approved', 'queued'],
  failed: ['queued'],
};

export function canTransition(from: ArtefactState, to: ArtefactState): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface Readiness {
  ready: boolean;
  /** Why not, in the lecturer's language. Null when it can run. */
  blockedBy: string | null;
}

/**
 * May this stage run now? The source has to exist, and where the stage says so
 * it has to have been approved by a person.
 */
export function mayRun(
  kind: ArtefactKind,
  sourceState: ArtefactState | 'missing',
  /**
   * False in a personal library, where the owner is the only reader and there
   * is no cohort to protect: the pipeline runs end to end and the student
   * edits and regenerates whatever they disagree with. True on a taught
   * course, where a person's approval stands between the machine and a
   * hundred students.
   */
  gated = true,
): Readiness {
  const stage = STAGE_BY_KIND[kind];
  if (!stage.from) {
    return { ready: false, blockedBy: 'A recording is uploaded, not generated.' };
  }
  const source = STAGE_BY_KIND[stage.from];
  if (sourceState === 'missing' || sourceState === 'absent') {
    return { ready: false, blockedBy: `${source.label} has not been made yet.` };
  }
  if (sourceState === 'running' || sourceState === 'queued') {
    return { ready: false, blockedBy: `${source.label} is still being made.` };
  }
  if (sourceState === 'failed') {
    return { ready: false, blockedBy: `${source.label} did not finish.` };
  }
  if (gated && stage.requiresApprovedSource && sourceState === 'ready') {
    return {
      ready: false,
      blockedBy: `Approve the ${source.label.toLowerCase()} first — everything below is built on it.`,
    };
  }
  return { ready: true, blockedBy: null };
}

/**
 * The lecturer has just changed an artefact. Which of the ones made from it
 * are now out of date?
 *
 * A correction that does not reach the notes, the audio and the revision cards
 * is a correction only the lecturer can see.
 */
export function staleAfterEdit(kind: ArtefactKind): ArtefactKind[] {
  const out: ArtefactKind[] = [];
  const walk = (k: ArtefactKind) => {
    for (const child of stagesFrom(k)) {
      out.push(child.kind);
      walk(child.kind);
    }
  };
  walk(kind);
  return out;
}

/** What a student may be shown of a lecture, once published. */
export function studentFacingKinds(): ArtefactKind[] {
  return STAGES.filter((s) => s.studentFacing).map((s) => s.kind);
}
