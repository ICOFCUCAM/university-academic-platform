// ---------------------------------------------------------------------------
// WHO IS ASKING, WHEN IT IS NOT A DEMONSTRATION.
//
// Three modes, because a platform that mounts inside somebody else's
// university cannot insist on owning the login:
//
//   demo      the switcher. Labelled as one, and the default, so the product
//             opens and demonstrates with nothing configured.
//   header    the host authenticated the person and passes them across, signed.
//             This is how this platform sits behind a university's own SSO:
//             they already know who it is, and re-asking would be worse.
//   supabase  a Supabase access token, verified here against the project's
//             JWT secret — signature and expiry, not just decoded.
//
// THE DANGEROUS ONE IS `header`, AND IT IS THE POINT OF THE SIGNATURE. A
// header a browser can set is not authentication: `x-academic-user: registry`
// would be an administrator. So the host signs `user:role:issued` with a shared
// secret, the signature is compared in constant time, and anything older than
// the window is refused — a captured header is not a permanent key.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionMode = 'demo' | 'header' | 'supabase';

export interface SessionClaim {
  id: string;
  role?: string;
}

export interface SessionOutcome {
  claim?: SessionClaim;
  /** Why it was refused, for a log. Never shown to the person verbatim. */
  refused?: string;
}

const constantTimeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

export function sign(secret: string, user: string, role: string, issued: number): string {
  return createHmac('sha256', secret).update(`${user}:${role}:${issued}`).digest('hex');
}

/**
 * A person the host has already authenticated. Signed, fresh, and refused
 * otherwise — with no fallback to "well, the header said so".
 */
export function verifyHeaders(
  headers: { get(name: string): string | null },
  options: { secret?: string; windowSeconds?: number; now?: number },
): SessionOutcome {
  if (!options.secret) return { refused: 'no shared secret is configured' };

  const user = headers.get('x-academic-user');
  const role = headers.get('x-academic-role') ?? '';
  const issued = Number(headers.get('x-academic-issued'));
  const signature = headers.get('x-academic-signature');

  if (!user || !signature || !Number.isFinite(issued)) return { refused: 'incomplete' };

  const expected = sign(options.secret, user, role, issued);
  if (!constantTimeEqual(expected, signature)) return { refused: 'bad signature' };

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const window = options.windowSeconds ?? 300;
  // A CAPTURED HEADER IS NOT A PERMANENT KEY. Five minutes by default, and a
  // clock skew of a few seconds in the other direction is tolerated rather
  // than turning a slightly fast host into a locked-out university.
  if (issued > now + 60) return { refused: 'issued in the future' };
  if (now - issued > window) return { refused: 'expired' };

  return { claim: { id: user, role: role || undefined } };
}

/**
 * A Supabase access token: HS256, verified against the project's JWT secret.
 * Decoding without verifying would accept anything anybody typed, which is the
 * mistake this function exists to not make.
 */
export function verifySupabaseToken(
  token: string | undefined,
  options: { secret?: string; now?: number },
): SessionOutcome {
  if (!options.secret) return { refused: 'no JWT secret is configured' };
  if (!token) return { refused: 'no token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { refused: 'malformed' };
  const [header, payload, signature] = parts;

  const expected = createHmac('sha256', options.secret)
    .update(`${header}.${payload}`).digest('base64url');
  if (!constantTimeEqual(expected, signature)) return { refused: 'bad signature' };

  let claims: { sub?: string; exp?: number; role?: string; user_role?: string };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { refused: 'unreadable claims' };
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) return { refused: 'expired' };
  if (!claims.sub) return { refused: 'no subject' };

  // The ROLE comes from the university's own records, not from the token: a
  // claim in a JWT the host minted is the host's opinion about authentication,
  // and what somebody may do here is decided by `capabilities.ts`.
  return { claim: { id: claims.sub } };
}

export function sessionMode(): SessionMode {
  const mode = process.env.ACADEMIC_SESSION_MODE;
  return mode === 'header' || mode === 'supabase' ? mode : 'demo';
}
