import { getStore } from '@/lib/data';
import { verifyCertificate } from '@/lib/service';

export const dynamic = 'force-dynamic';

/**
 * CHECKING A CERTIFICATE WITH NO ACCOUNT.
 *
 * The one page in this platform that asks nobody who they are: a credential
 * nobody outside the university can verify is a picture of a credential. It
 * shows what the certificate attests and nothing else about the person — not
 * their email, not their other courses, not whether they are still enrolled.
 */
export default async function Verify({ searchParams }: { searchParams: { code?: string } }) {
  const code = searchParams.code?.trim();
  const found = code ? await verifyCertificate(getStore(), code) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Check a certificate</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Type the code printed on it. This page asks nothing about you.
      </p>

      <form className="mt-6 flex flex-wrap gap-2" method="get">
        <input
          name="code" defaultValue={code} placeholder="XXXX-XXXX-XXXX"
          className="min-w-[14rem] flex-1 rounded-md border border-page-line px-3.5 py-2.5 font-mono text-sm uppercase"
        />
        <button type="submit" className="rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white">
          Check
        </button>
      </form>

      {code && !found && (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink-soft">
          No certificate with that code was issued here. Check the code, or ask the person who gave
          it to you which institution issued it.
        </p>
      )}

      {found && (
        <article className={`mt-6 rounded-lg border px-6 py-5 ${
          found.revoked ? 'border-red-200 bg-red-50' : 'border-page-line bg-page-card'
        }`}>
          {found.revoked && (
            <p className="mb-3 font-medium text-bad">
              This certificate has been withdrawn.
              {found.revokedReason ? ` ${found.revokedReason}` : ''}
            </p>
          )}
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">
            {found.courseCode} · issued {new Date(found.issuedAt).toLocaleDateString()} by {found.issuedByName}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{found.studentName}</h2>
          <p className="text-sm text-ink-soft">{found.courseTitle}</p>

          <ul className="mt-4 space-y-1.5 text-sm">
            {found.attests.map((line, i) => <li key={i}>— {line}</li>)}
          </ul>

          <p className="mt-4 text-xs text-ink-faint">
            This is what the certificate attests, in full. It says what was done rather than
            awarding a word, so that a reader can decide what it is worth.
          </p>
        </article>
      )}
    </div>
  );
}
