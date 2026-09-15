// ---------------------------------------------------------------------------
// RUNNING ONE STAGE OF THE PIPELINE.
//
// One place decides which prompt a stage uses, how much room it needs and how
// hard the model should think. A screen that chose for itself would be a
// second opinion about what "structured notes" means.
// ---------------------------------------------------------------------------

import type { ArtefactKind } from '../domain/types';
import type { LectureExtract } from '../knowledge/types';
import type { Engine } from './provider';
import { callAs, type RoleResult } from './roles';
import {
  correctedTextPrompt, knowledgeExtractionPrompt, revisionPrompt,
  structuredNotesPrompt, teachingScriptPrompt,
  type LectureContext, type RevisionKind,
} from './prompts';
import {
  MODE_BY_ID, PERSONA_BY_ID, sliceNotes,
  type AudioMode, type Persona, type Segment,
} from './audioModes';

export interface TransformInput {
  kind: ArtefactKind;
  context: LectureContext;
  /** The body of the artefact this one is made from. */
  source: string;
  /** The extraction, where the notes pass can be given it as a checklist. */
  knowledge?: string;
  /** The listener's choices: how the time is spent, and who is speaking. */
  mode?: AudioMode;
  persona?: Persona;
  /** Which revision object is wanted. */
  revision?: RevisionKind;
  /** Which part of a long lecture this lesson teaches. */
  segment?: Segment;
}

/** How much room and how much thought each pass needs. Measured, not guessed. */
const BUDGET: Partial<Record<ArtefactKind, { maxTokens: number; effort: 'low' | 'medium' | 'high' | 'xhigh' }>> = {
  // A lecture text is long and the judgement per sentence is small.
  corrected_text: { maxTokens: 32000, effort: 'medium' },
  // Deciding what a lecture actually teaches is the hardest call in the
  // pipeline, and it is the one the whole knowledge base is built on.
  knowledge_extract: { maxTokens: 16000, effort: 'xhigh' },
  structured_notes: { maxTokens: 16000, effort: 'high' },
  teaching_script: { maxTokens: 12000, effort: 'high' },
  revision_materials: { maxTokens: 12000, effort: 'high' },
};

export async function runTransformation(e: Engine, input: TransformInput): Promise<RoleResult> {
  const budget = BUDGET[input.kind] ?? { maxTokens: 16000, effort: 'high' as const };

  const prompt = (() => {
    switch (input.kind) {
      case 'corrected_text': return correctedTextPrompt(input.context, input.source);
      case 'knowledge_extract': return knowledgeExtractionPrompt(input.context, input.source);
      case 'structured_notes': return structuredNotesPrompt(input.context, input.source, input.knowledge);
      case 'teaching_script': return teachingScriptPrompt(
        input.context,
        input.segment ? sliceNotes(input.source, input.segment) : input.source,
        MODE_BY_ID[input.mode ?? 'lesson_15'],
        PERSONA_BY_ID[input.persona ?? 'tutor'],
        input.segment,
      );
      case 'revision_materials': return revisionPrompt(input.context, input.source, input.revision ?? 'full');
      default:
        throw new Error(`${input.kind} is not made by the language model.`);
    }
  })();

  // AS THE TRANSFORMATION ROLE, which refuses a prompt that does not carry the
  // contract. A stage added later without it does not run at all.
  return callAs(e, 'transformation', {
    system: prompt.system,
    user: prompt.user,
    maxTokens: budget.maxTokens,
    effort: budget.effort,
    json: input.kind === 'knowledge_extract',
  });
}

/**
 * The extraction comes back as JSON. A model that wraps it in a fence or adds
 * a sentence of preamble has still done the work, so the fence is stripped
 * rather than the run being thrown away; anything else is a real failure and
 * is reported as one, with the text kept so a person can see what came back.
 */
export function parseExtract(
  text: string,
  lecture: { id: string; sequence: number; title: string },
): LectureExtract {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start > 0 || end < body.length - 1) body = body.slice(start, end + 1);

  let parsed: { nodes?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('The extraction did not come back as JSON, so nothing was added to the knowledge base.');
  }
  if (!Array.isArray(parsed.nodes)) {
    throw new Error('The extraction came back without a `nodes` list.');
  }

  const nodes = (parsed.nodes as Record<string, unknown>[])
    .filter((n) => typeof n.term === 'string' && (n.term as string).trim())
    .map((n) => ({
      term: String(n.term).trim(),
      kind: (['concept', 'definition', 'claim', 'method', 'figure', 'question'] as const)
        .includes(n.kind as never) ? (n.kind as LectureExtract['nodes'][number]['kind']) : 'concept',
      definition: typeof n.definition === 'string' && n.definition.trim() ? n.definition.trim() : null,
      quote: typeof n.quote === 'string' ? n.quote.trim() : '',
      relatedTo: Array.isArray(n.relatedTo) ? n.relatedTo.map(String) : [],
    }));

  return {
    lectureId: lecture.id,
    lectureSequence: lecture.sequence,
    lectureTitle: lecture.title,
    nodes,
  };
}
