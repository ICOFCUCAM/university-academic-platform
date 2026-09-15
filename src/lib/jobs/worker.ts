// ---------------------------------------------------------------------------
// THE WORKER.
//
// Claims a job, runs the stage, records the outcome, moves on. It is the same
// `runStage` the screens call — there is one implementation of "make the
// notes", and the queue only decides when.
//
// In a single deployment this runs in the same process, started on demand. A
// larger one runs it as its own service against the same store and the same
// queue, and nothing in this file changes.
// ---------------------------------------------------------------------------

import type { Engine } from '../ai/provider';
import type { Store } from '../data/store';
import type { Actor } from '../domain/ownership';
import type { Role } from '../capabilities';
import { runStage } from '../service';
import type { JobQueue } from './queue';

export interface WorkerReport {
  ran: number;
  failed: number;
}

/** Runs until the queue is empty. Returns what it did. */
export async function drain(store: Store, engine: Engine, queue: JobQueue, limit = 50): Promise<WorkerReport> {
  const report: WorkerReport = { ran: 0, failed: 0 };

  for (let i = 0; i < limit; i++) {
    const job = await queue.claim();
    if (!job) break;

    const actor: Actor = { id: job.actorId, role: job.actorRole as Role };
    try {
      const artefact = await runStage(store, engine, actor, job.lectureId, job.kind, job.options ?? {});
      // `runStage` records a transformation failure ON THE ARTEFACT rather than
      // throwing — the lecturer has to be able to see what the model said. The
      // job has to fail too, or the queue would report a clean run.
      if (artefact.state === 'failed') {
        report.failed++;
        await queue.finish(job.id, { error: artefact.error ?? 'The stage did not finish.' });
      } else {
        report.ran++;
        await queue.finish(job.id, {});
      }
    } catch (error) {
      report.failed++;
      await queue.finish(job.id, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  return report;
}
