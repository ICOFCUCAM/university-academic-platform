// ---------------------------------------------------------------------------
// WHAT TO QUEUE WHEN SOMETHING IS UPLOADED.
//
// The plan differs by where the lecture lives, and the difference is the
// approval layer:
//
//   A PERSONAL LIBRARY runs end to end. The student is the only reader, so
//   there is nobody to protect from an unreviewed draft, and stopping halfway
//   to ask them to approve their own notes would be ceremony.
//
//   A TAUGHT COURSE runs AS FAR AS THE GATE and stops. The corrected academic
//   text is where a person's judgement is needed, and everything after it —
//   the knowledge that feeds the Course AI, the notes the cohort revises from,
//   the audio they listen to — waits there until the lecturer has read it.
// ---------------------------------------------------------------------------

import type { ArtefactKind } from '../domain/types';
import { STAGES, STAGE_BY_KIND } from '../pipeline/stages';

export interface PlanInput {
  /** What already exists, so a re-upload does not redo the whole chain. */
  have: ArtefactKind[];
  context: 'course' | 'personal';
  /** Where to start: the recording, or a transcript supplied from elsewhere. */
  from: 'recording' | 'transcript';
}

export function planFor(input: PlanInput): ArtefactKind[] {
  const order = STAGES.map((s) => s.kind).filter((k) => k !== 'recording');
  const start = order.indexOf(input.from === 'recording' ? 'transcript' : 'corrected_text');
  const plan: ArtefactKind[] = [];

  for (const kind of order.slice(start)) {
    // The gate: on a course, nothing downstream of the corrected text is
    // queued, because the lecturer has not seen the corrected text yet.
    if (input.context === 'course' && STAGE_BY_KIND[kind].requiresApprovedSource) break;
    plan.push(kind);
  }
  return plan;
}

/** After an approval, what becomes runnable that was not before. */
export function planAfterApproval(approved: ArtefactKind, have: ArtefactKind[]): ArtefactKind[] {
  const order = STAGES.map((s) => s.kind).filter((k) => k !== 'recording');
  const plan: ArtefactKind[] = [];
  for (const kind of order) {
    const stage = STAGE_BY_KIND[kind];
    if (!stage.from) continue;
    const dependsOnApproved = stage.from === approved
      || (plan.includes(stage.from) && stage.requiresApprovedSource);
    if (dependsOnApproved && !have.includes(kind)) plan.push(kind);
  }
  return plan;
}
