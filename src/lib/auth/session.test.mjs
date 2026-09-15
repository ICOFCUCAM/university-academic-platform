// ---------------------------------------------------------------------------
// A HEADER A BROWSER CAN SET IS NOT AUTHENTICATION.
//
// `x-academic-user: registry` would otherwise be an administrator. Every check
// below is a refusal, because that is what this module is for.
// ---------------------------------------------------------------------------

import { createHmac } from 'node:crypto';
import { load, suite } from '../testkit.mjs';

const A = await load('auth/session.ts');
const t = suite('Sessions');

const secret = 'a shared secret between the host and this platform';
const at = 1_770_000_000;
const headers = (values) => ({ get: (name) => values[name] ?? null });

const good = {
  'x-academic-user': 'person-lecturer',
  'x-academic-role': 'lecturer',
  'x-academic-issued': String(at),
  'x-academic-signature': A.sign(secret, 'person-lecturer', 'lecturer', at),
};

t.section('A signed, fresh header is accepted');
t.check('the person comes through',
  A.verifyHeaders(headers(good), { secret, now: at + 5 }).claim,
  { id: 'person-lecturer', role: 'lecturer' });

t.section('And everything else is refused');
t.check('an unsigned header is not a person',
  A.verifyHeaders(headers({ ...good, 'x-academic-signature': null }), { secret, now: at }).claim, undefined);
t.check('…a forged signature is refused',
  A.verifyHeaders(headers({ ...good, 'x-academic-signature': 'deadbeef' }), { secret, now: at }).refused,
  'bad signature');
// THE ESCALATION THIS PREVENTS: changing the role changes what is signed.
t.check('…and promoting yourself invalidates it',
  A.verifyHeaders(headers({ ...good, 'x-academic-role': 'registry' }), { secret, now: at }).refused,
  'bad signature');
t.check('…an old header is not a permanent key',
  A.verifyHeaders(headers(good), { secret, now: at + 3600 }).refused, 'expired');
t.check('…nor one from the future',
  A.verifyHeaders(headers(good), { secret, now: at - 3600 }).refused, 'issued in the future');
t.check('…and with no secret configured, nothing is trusted',
  A.verifyHeaders(headers(good), { now: at }).refused, 'no shared secret is configured');

t.section('A Supabase token is verified, not merely decoded');
const token = (payload, signWith = secret) => {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signWith).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
};

t.check('a valid token gives the subject',
  A.verifySupabaseToken(token({ sub: 'user-1', exp: at + 600 }), { secret, now: at }).claim,
  { id: 'user-1' });
// DECODING WITHOUT VERIFYING WOULD ACCEPT ANYTHING ANYBODY TYPED.
t.check('a token signed with another secret is refused',
  A.verifySupabaseToken(token({ sub: 'user-1', exp: at + 600 }, 'not the secret'), { secret, now: at }).refused,
  'bad signature');
t.check('…an expired one is refused',
  A.verifySupabaseToken(token({ sub: 'user-1', exp: at - 1 }), { secret, now: at }).refused, 'expired');
t.check('…a malformed one is refused', A.verifySupabaseToken('nonsense', { secret }).refused, 'malformed');
t.check('…and one with no subject is nobody',
  A.verifySupabaseToken(token({ exp: at + 600 }), { secret, now: at }).refused, 'no subject');

t.section('And the role never comes from the token');
// What somebody may do is decided by capabilities.ts against the university's
// own records — not by a claim in a token the host minted.
t.check('a role claim is ignored',
  A.verifySupabaseToken(token({ sub: 'user-1', role: 'registry', exp: at + 600 }), { secret, now: at }).claim,
  { id: 'user-1' });

t.done();
