// ---------------------------------------------------------------------------
// RUN THE STORE CONTRACT AGAINST A REAL DATABASE.
//
//   SUPABASE_URL=… SUPABASE_KEY=… SUPABASE_ACCESS_TOKEN=… \
//     node src/lib/data/supabase.conformance.mjs
//
// It is not part of `npm test`, because `npm test` must run on a laptop with
// no network and no project. Until somebody runs this against a database and
// it passes, `data/supabase.ts` is a draft — and this file is how that stops
// being a matter of opinion.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';
import { conformance } from './conformance.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error(
    '\nSUPABASE_URL and SUPABASE_KEY are not set, so there is no database to check.\n' +
    'This is the suite that decides whether the Postgres adapter works; it has\n' +
    'never been run. Set them, apply docs/integration/001_lecture_studio.sql, and\n' +
    'run it again.\n',
  );
  process.exit(2);
}

const { createSupabaseStore } = await load('data/supabase.ts');
const t = suite('The store contract, against Postgres');

await conformance(() => createSupabaseStore({
  url, key,
  accessToken: process.env.SUPABASE_ACCESS_TOKEN,
  university: { id: 'host', name: process.env.ACADEMIC_UNIVERSITY ?? 'The university' },
}), 'supabase', t);

t.done();
