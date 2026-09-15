// ---------------------------------------------------------------------------
// WHO IS ASKING.
//
// THIS IS NOT AN AUTHENTICATION SYSTEM AND DOES NOT PRETEND TO BE. Standalone,
// the demonstration lets you choose whose eyes you are looking through, so the
// ownership rules can be SEEN refusing things. Mounted inside a university, the
// host's session is the source of truth and this module reads it — see
// INTEGRATION.md §3. Nothing else in the platform reads a cookie.
// ---------------------------------------------------------------------------

import { cookies } from 'next/headers';
import type { Actor } from './domain/ownership';
import type { Role } from './capabilities';
import { getStore } from './data';

const COOKIE = 'academic_actor';
const DEFAULT_ACTOR = 'person-lecturer';

export async function currentActor(): Promise<Actor & { name: string }> {
  const id = cookies().get(COOKIE)?.value ?? DEFAULT_ACTOR;
  const store = getStore();
  const person = (await store.person(id)) ?? (await store.person(DEFAULT_ACTOR));
  if (!person) throw new Error('No people are configured in this workspace.');
  return { id: person.id, role: person.role as Role, name: person.name };
}

export const ACTOR_COOKIE = COOKIE;
