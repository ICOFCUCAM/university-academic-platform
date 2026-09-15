// ---------------------------------------------------------------------------
// RBAC FOR AI.
//
// The platform does not rely on "please behave yourself". A model call is made
// AS A ROLE, and the role has a permission boundary that is enforced at the
// call site — the same way `capabilities.ts` and `ownership.ts` decide what a
// person may do.
//
//   TRANSFORMATION      may change grammar, improve readability, structure,
//                       summarise, and hand text to a speech engine.
//                       May NOT fact-check, debate, correct knowledge, inject
//                       outside information, reinterpret or challenge the
//                       lecturer, or silently change a claim.
//
//   VERIFIER            may compare claims and report differences.
//                       May NOT judge whether a claim is true, edit anything,
//                       or recommend a correction.
//
//   COURSE TUTOR        may answer from this course's published material, cite
//                       it, and refuse.
//                       May NOT use knowledge from outside the course.
//
//   GENERAL EXPLAINER   may use general knowledge — and ONLY when a student has
//                       explicitly asked to go beyond their course.
//                       May NOT reach a page unlabelled, and may not silently
//                       contradict the lecturer.
//
// WHAT MAKES IT A BOUNDARY RATHER THAN A DESCRIPTION is `callAs`. Four
// structural checks, each of which has a failure it prevents:
//
//   1. A transformation whose prompt does not carry the contract cannot run.
//      A stage written without it is the one place the lecturer's teaching
//      quietly becomes the model's.
//   2. The tutor cannot run without course material. A tutor with an empty
//      corpus answers from the model's own knowledge and sounds identical.
//   3. The general explainer cannot run unless the student opened the door,
//      and the grant has to be passed explicitly at the call site.
//   4. Every result is stamped with the role that produced it, so the screen
//      can label it and the two knowledge sources never merge on a page.
// ---------------------------------------------------------------------------

import { TRANSFORMATION_CONTRACT } from './contract';
import type { CompletionRequest, CompletionResult, Engine } from './provider';

export type AIRole = 'transformation' | 'verifier' | 'course-tutor' | 'general-explainer';

export interface RoleBoundary {
  id: AIRole;
  label: string;
  may: string[];
  mayNot: string[];
  /** Does a call in this role have to carry the transformation contract? */
  requiresContract: boolean;
  /** Must the caller supply course material for the model to work from? */
  requiresCourseCorpus: boolean;
  /** Can this role use knowledge from outside the course at all? */
  usesGeneralKnowledge: boolean;
  /** Must what it produces be labelled as not being the lecturer's teaching? */
  labelAsOutsideCourse: boolean;
}

export const AI_ROLES: Record<AIRole, RoleBoundary> = {
  transformation: {
    id: 'transformation',
    label: 'Transformation',
    may: [
      'change grammar', 'improve readability', 'structure information',
      'summarise', 'convert text to speech',
    ],
    mayNot: [
      'fact-check', 'debate', 'correct knowledge', 'inject outside information',
      'reinterpret the lecturer', 'challenge the lecturer', 'silently change claims',
    ],
    requiresContract: true,
    requiresCourseCorpus: false,
    usesGeneralKnowledge: false,
    labelAsOutsideCourse: false,
  },
  verifier: {
    id: 'verifier',
    label: 'Claim verifier',
    may: ['compare claims', 'report what was introduced, removed or altered'],
    mayNot: [
      'judge whether a claim is true', 'edit anything', 'recommend a correction',
      'inject outside information',
    ],
    requiresContract: false,
    requiresCourseCorpus: false,
    usesGeneralKnowledge: false,
    labelAsOutsideCourse: false,
  },
  'course-tutor': {
    id: 'course-tutor',
    label: 'Course AI',
    may: ['answer from this course’s published lectures', 'cite them', 'refuse'],
    mayNot: [
      'use knowledge from outside the course', 'predict examination questions',
      'do a student’s assessed work', 'contradict the lecturer',
    ],
    requiresContract: false,
    requiresCourseCorpus: true,
    usesGeneralKnowledge: false,
    labelAsOutsideCourse: false,
  },
  'general-explainer': {
    id: 'general-explainer',
    label: 'General explanation',
    may: ['use general knowledge, when a student has explicitly asked for it'],
    mayNot: [
      'run without that explicit request', 'reach a page unlabelled',
      'silently contradict the lecturer', 'replace what the course taught',
    ],
    requiresContract: false,
    requiresCourseCorpus: false,
    usesGeneralKnowledge: true,
    labelAsOutsideCourse: true,
  },
};

export class RoleViolation extends Error {
  constructor(public readonly role: AIRole, message: string) {
    super(`${AI_ROLES[role].label}: ${message}`);
  }
}

export interface Grants {
  /** Passages of this course's own material, for the tutor. */
  corpusSize?: number;
  /**
   * The student asked, in their own words, to go beyond the course. Set at the
   * one call site that reads the question; nothing else may set it.
   */
  studentAskedToGoBeyondTheCourse?: boolean;
}

export interface RoleResult extends CompletionResult {
  role: AIRole;
  /** True where the screen must label this as not the lecturer's teaching. */
  outsideCourse: boolean;
}

/**
 * Every model call in this platform goes through here. A call that cannot name
 * its role does not run.
 */
export async function callAs(
  e: Engine, role: AIRole, request: CompletionRequest, grants: Grants = {},
): Promise<RoleResult> {
  const boundary = AI_ROLES[role];

  if (boundary.requiresContract && !request.system.includes(TRANSFORMATION_CONTRACT)) {
    throw new RoleViolation(role,
      'this prompt does not carry the transformation contract, so it cannot be run as a transformation.');
  }

  if (boundary.requiresCourseCorpus && !grants.corpusSize) {
    throw new RoleViolation(role,
      'no course material was supplied. A tutor with an empty corpus answers from the model’s own knowledge and sounds exactly the same.');
  }

  if (boundary.usesGeneralKnowledge && !grants.studentAskedToGoBeyondTheCourse) {
    throw new RoleViolation(role,
      'general knowledge is reachable only when a student has explicitly asked to go beyond their course.');
  }

  const result = await e.model.complete(request);
  return { ...result, role, outsideCourse: boundary.labelAsOutsideCourse };
}
