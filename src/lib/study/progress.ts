// ---------------------------------------------------------------------------
// PROGRESS WITHOUT SURVEILLANCE.
//
// A lecturer needs to know whether their cohort is reading the notes. They do
// not need to know that Joseph opened Lecture 04 at 02:14 and stopped after
// ninety seconds, and a platform that told them that would change what a
// student is willing to open.
//
// So two different things are recorded and they are kept apart:
//
//   THE STUDENT'S OWN RECORD — what they have read, listened to and been
//   tested on, shown to them, so "where was I?" has an answer.
//
//   THE COHORT'S SHAPE — how many have read this lecture's notes, how many
//   listened, how many sat the quiz and what the cohort scored. Counts, never
//   a name, never a time.
//
// The events are the same events. What differs is who may ask which question,
// and that is enforced in `service.ts` rather than left to a screen.
// ---------------------------------------------------------------------------

import type { ArtefactKind } from '../domain/types';

export type LearningEvent = 'read' | 'listened' | 'revised' | 'quiz-taken';

export interface ProgressRecord {
  id: string;
  personId: string;
  courseId: string;
  lectureId: string;
  /** Which artefact it was. Absent for a course-wide study aid. */
  artefactKind?: ArtefactKind;
  event: LearningEvent;
  /** For a quiz: what they scored out of what. */
  score?: number;
  outOf?: number;
  at: string;
}

export interface LectureProgress {
  lectureId: string;
  read: boolean;
  listened: boolean;
  revised: boolean;
  quizTaken: boolean;
  bestScore?: { score: number; outOf: number };
}

/** What one student has done, lecture by lecture. Theirs to see. */
export function myProgress(records: ProgressRecord[], lectureIds: string[]): LectureProgress[] {
  return lectureIds.map((lectureId) => {
    const mine = records.filter((r) => r.lectureId === lectureId);
    // SAT IS SAT, SCORED OR NOT. A quiz of written answers is not machine-
    // marked, so it has no score — and a student who sat it should not be told
    // by their own progress page that they have not.
    const sat = mine.filter((r) => r.event === 'quiz-taken');
    const scored = sat.filter((r) => (r.outOf ?? 0) > 0);
    const best = scored.sort((a, b) =>
      (b.score ?? 0) / (b.outOf ?? 1) - (a.score ?? 0) / (a.outOf ?? 1))[0];
    return {
      lectureId,
      read: mine.some((r) => r.event === 'read'),
      listened: mine.some((r) => r.event === 'listened'),
      revised: mine.some((r) => r.event === 'revised'),
      quizTaken: sat.length > 0,
      bestScore: best ? { score: best.score ?? 0, outOf: best.outOf ?? 0 } : undefined,
    };
  });
}

export interface CohortRow {
  lectureId: string;
  /** Distinct students, not events: one student reading twice is one reader. */
  readers: number;
  listeners: number;
  quizzesTaken: number;
  /** The cohort's average, where anybody has sat it. */
  averageScore?: number;
}

/**
 * What a lecturer sees. COUNTS ONLY, and the function cannot return a name
 * because it never receives one — `personId` is reduced to a set size here and
 * nothing downstream can recover it.
 */
export function cohortShape(records: ProgressRecord[], lectureIds: string[]): CohortRow[] {
  return lectureIds.map((lectureId) => {
    const mine = records.filter((r) => r.lectureId === lectureId);
    const distinct = (event: LearningEvent) =>
      new Set(mine.filter((r) => r.event === event).map((r) => r.personId)).size;

    const scored = mine.filter((r) => r.event === 'quiz-taken' && r.outOf);
    const average = scored.length
      ? scored.reduce((sum, r) => sum + (r.score ?? 0) / (r.outOf ?? 1), 0) / scored.length
      : undefined;

    return {
      lectureId,
      readers: distinct('read'),
      listeners: distinct('listened'),
      quizzesTaken: distinct('quiz-taken'),
      averageScore: average === undefined ? undefined : Math.round(average * 100),
    };
  });
}

/**
 * THE ONE THING WORTH INTERRUPTING A LECTURER FOR: a lecture the cohort has
 * not read. Not a ranking of students — a gap in delivery, which is the
 * lecturer's to fix.
 */
export function neglected(rows: CohortRow[], cohortSize: number, threshold = 0.4): CohortRow[] {
  if (!cohortSize) return [];
  return rows.filter((row) => row.readers / cohortSize < threshold);
}
