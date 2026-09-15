// ---------------------------------------------------------------------------
// A NINETY-MINUTE LECTURE IS NOT PROCESSED INSIDE AN HTTP REQUEST.
//
// Transcription is minutes of work; the correction pass on twelve thousand
// words is minutes more; the script and the speech are minutes again. A
// request that tried to hold all of that open would time out at the proxy, and
// the user would be told nothing except that it failed — after the money had
// been spent.
//
// So the upload creates JOBS and returns. The worker runs them in order, each
// one writing its artefact as it finishes, and the lecture page shows the
// pipeline filling in. If a job fails, only that job is retried; everything
// already made is kept.
//
// The queue is an INTERFACE. In process for a single deployment; a real broker
// for a large one — the worker does not know which it is talking to.
// ---------------------------------------------------------------------------

import type { ArtefactKind } from '../domain/types';
import type { AudioMode, Persona } from '../ai/audioModes';
import type { RevisionKind } from '../ai/prompts';

export type JobState = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  lectureId: string;
  courseId: string;
  /** The stage this job produces. */
  kind: ArtefactKind;
  /** Who asked for it — every act is still somebody's act. */
  actorId: string;
  actorRole: string;
  state: JobState;
  attempts: number;
  /** Jobs run in this order; the chain is the pipeline. */
  position: number;
  options?: { mode?: AudioMode; persona?: Persona; revision?: RevisionKind };
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface JobQueue {
  add(jobs: Omit<Job, 'id' | 'state' | 'attempts' | 'createdAt'>[]): Promise<Job[]>;
  /** The next job whose turn it is, marked running. Null when there is none. */
  claim(): Promise<Job | null>;
  finish(id: string, outcome: { error?: string }): Promise<void>;
  forLecture(lectureId: string): Promise<Job[]>;
  pending(): Promise<number>;
}

export function createMemoryQueue(): JobQueue {
  const jobs: Job[] = [];
  let counter = 0;
  const MAX_ATTEMPTS = 3;

  return {
    async add(incoming) {
      const made = incoming.map((job) => ({
        ...job,
        id: `job-${++counter}`,
        state: 'queued' as JobState,
        attempts: 0,
        createdAt: new Date().toISOString(),
      }));
      jobs.push(...made);
      return made;
    },

    async claim() {
      // IN ORDER, AND ONE LECTURE AT A TIME. A lecture whose notes job runs
      // before its correction job would produce notes from nothing.
      const next = jobs
        .filter((j) => j.state === 'queued')
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
        .find((j) => !jobs.some((other) =>
          other.lectureId === j.lectureId && other.state === 'running'));
      if (!next) return null;
      next.state = 'running';
      next.attempts += 1;
      next.startedAt = new Date().toISOString();
      return next;
    },

    async finish(id, outcome) {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      if (outcome.error) {
        // A FAILURE IS RETRIED, NOT SWALLOWED — and then it stops, with the
        // reason kept, rather than looping at somebody's expense.
        job.state = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
        job.error = outcome.error;
        if (job.state === 'failed') job.finishedAt = new Date().toISOString();
        // A stage that failed for good takes its dependents with it: notes
        // from a transcript that never arrived would be notes about nothing.
        if (job.state === 'failed') {
          for (const dependent of jobs) {
            if (dependent.lectureId === job.lectureId && dependent.state === 'queued'
              && dependent.position > job.position) {
              dependent.state = 'failed';
              dependent.error = `${job.kind} did not finish.`;
              dependent.finishedAt = new Date().toISOString();
            }
          }
        }
        return;
      }
      job.state = 'done';
      job.error = undefined;
      job.finishedAt = new Date().toISOString();
    },

    async forLecture(lectureId) {
      return jobs.filter((j) => j.lectureId === lectureId).sort((a, b) => a.position - b.position);
    },

    async pending() {
      return jobs.filter((j) => j.state === 'queued' || j.state === 'running').length;
    },
  };
}
