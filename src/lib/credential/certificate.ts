// ---------------------------------------------------------------------------
// A CERTIFICATE SAYS SOMETHING TRUE, OR IT SAYS NOTHING.
//
// The temptation with a platform like this is a certificate for finishing the
// videos. That is worth nothing, everybody knows it is worth nothing, and
// issuing it devalues the ones a university does mean.
//
// So three rules, all of them enforced below:
//
//   IT NAMES WHAT IT ATTESTS. Not "completed the course" — "read the notes for
//   eleven of twelve lectures, sat eight quizzes averaging 74%, and had three
//   assignments marked". A reader can decide for themselves what that is worth.
//
//   A PERSON ISSUES IT. Like a mark, never a machine: the criteria are checked
//   mechanically, and then somebody with the capability decides.
//
//   IT CAN BE CHECKED BY SOMEBODY WITH NO ACCOUNT. A credential nobody outside
//   the university can verify is a picture of a credential.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

export interface CompletionRule {
  /** Of the lectures published, how many must have been read. 0–1. */
  lecturesRead?: number;
  /** How many quizzes must have been sat. */
  quizzesTaken?: number;
  /** The average a student must reach across the quizzes they sat, 0–100. */
  quizAverage?: number;
  /** How many assignments must have been marked and returned. */
  assignmentsMarked?: number;
}

export interface Evidence {
  lecturesPublished: number;
  lecturesRead: number;
  quizzesTaken: number;
  quizAverage?: number;
  assignmentsMarked: number;
}

export interface Assessment {
  met: boolean;
  /** Each requirement, whether it was met, and what the student actually did. */
  lines: { requirement: string; met: boolean; actual: string }[];
}

/** Has this student done what the course asks? Mechanical, and shown in full. */
export function assess(rule: CompletionRule, evidence: Evidence): Assessment {
  const lines: Assessment['lines'] = [];

  if (rule.lecturesRead !== undefined) {
    const needed = Math.ceil(evidence.lecturesPublished * rule.lecturesRead);
    lines.push({
      requirement: `Read the notes for at least ${needed} of ${evidence.lecturesPublished} lectures`,
      met: evidence.lecturesRead >= needed,
      actual: `read ${evidence.lecturesRead}`,
    });
  }
  if (rule.quizzesTaken !== undefined) {
    lines.push({
      requirement: `Sit at least ${rule.quizzesTaken} quizzes`,
      met: evidence.quizzesTaken >= rule.quizzesTaken,
      actual: `sat ${evidence.quizzesTaken}`,
    });
  }
  if (rule.quizAverage !== undefined) {
    lines.push({
      requirement: `Average at least ${rule.quizAverage}% across them`,
      met: (evidence.quizAverage ?? 0) >= rule.quizAverage,
      actual: evidence.quizAverage === undefined ? 'sat none' : `averaged ${evidence.quizAverage}%`,
    });
  }
  if (rule.assignmentsMarked !== undefined) {
    lines.push({
      requirement: `Have ${rule.assignmentsMarked} assignments marked`,
      met: evidence.assignmentsMarked >= rule.assignmentsMarked,
      actual: `${evidence.assignmentsMarked} marked`,
    });
  }

  // A COURSE THAT ASKS FOR NOTHING CERTIFIES NOTHING. An empty rule is not
  // "everybody passes"; it is a course whose lecturer has not said what
  // completing it means, and the platform will not decide that for them.
  if (!lines.length) {
    return {
      met: false,
      lines: [{
        requirement: 'The course has not said what completing it means',
        met: false,
        actual: 'no completion rule is set',
      }],
    };
  }

  return { met: lines.every((line) => line.met), lines };
}

export interface Certificate {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  studentId: string;
  /** As the university records it. Never a name this platform invented. */
  studentName: string;
  /** What it attests, in sentences a reader can weigh. */
  attests: string[];
  issuedAt: string;
  issuedBy: string;
  issuedByName: string;
  /** What somebody with no account types in to check it. */
  code: string;
  revokedAt?: string;
  revokedReason?: string;
}

/**
 * The code on the certificate. Derived from the facts, so two certificates for
 * the same completion collide rather than multiplying, and short enough to be
 * read over a telephone.
 */
export function verificationCode(courseId: string, studentId: string, issuedAt: string): string {
  const digest = createHash('sha256').update(`${courseId}:${studentId}:${issuedAt}`).digest('hex');
  return digest.slice(0, 12).toUpperCase().replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');
}

/** The sentences the certificate carries. Facts, not adjectives. */
export function attestation(evidence: Evidence, assessment: Assessment): string[] {
  return [
    `Read the published notes for ${evidence.lecturesRead} of ${evidence.lecturesPublished} lectures.`,
    evidence.quizzesTaken
      ? `Sat ${evidence.quizzesTaken} quizzes${evidence.quizAverage !== undefined ? `, averaging ${evidence.quizAverage}%` : ''}.`
      : 'Sat no quizzes.',
    evidence.assignmentsMarked
      ? `Had ${evidence.assignmentsMarked} assignments marked by the lecturer.`
      : 'Had no assignments marked.',
    ...assessment.lines.map((line) => `${line.requirement}: ${line.actual}.`),
  ];
}
