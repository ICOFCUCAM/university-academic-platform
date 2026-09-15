// ---------------------------------------------------------------------------
// The one store and the one queue this process is using.
//
// Module state, so a rebuild in development starts from the demonstration
// course again and a deployment points these two functions at its own
// implementations without touching a screen.
// ---------------------------------------------------------------------------

import { createMemoryStore } from './memory';
import { DEMO } from './seed';
import type { Store } from './store';
import { createMemoryQueue, type JobQueue } from '../jobs/queue';

declare global {
  // eslint-disable-next-line no-var
  var __academicStore: Store | undefined;
  // eslint-disable-next-line no-var
  var __academicQueue: JobQueue | undefined;
}

export function getStore(): Store {
  if (!globalThis.__academicStore) {
    globalThis.__academicStore = createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
  }
  return globalThis.__academicStore;
}

export function getQueue(): JobQueue {
  if (!globalThis.__academicQueue) globalThis.__academicQueue = createMemoryQueue();
  return globalThis.__academicQueue;
}
