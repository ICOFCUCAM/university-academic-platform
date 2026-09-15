import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { auditLog, Refused } from '@/lib/service';
import { AUDITED_ACTS, describe } from '@/lib/audit/audit';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: { searchParams: { course?: string } }) {
  const actor = await currentActor();
  const store = getStore();

  let entries;
  try {
    entries = await auditLog(store, actor, searchParams.course);
  } catch (error) {
    return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title="Not yours to read"
          body={error instanceof Refused ? error.why : 'This record is not available to you.'}
        />
      </div>
    );
  }

  const courses = await store.courses();
  const named = (id?: string) => courses.find((c) => c.id === id)?.code;

  return (
    <div>
      <PageHeader
        title="Who did what"
        subtitle="Every act that changes what somebody else can see, do or claim, with a name against it. Reading is not here and never will be: what a student opened, and when, is not recorded anywhere in this platform."
      />

      <div className="px-6 py-6 md:px-8">
        <Card className="mb-4 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-brand" /> What is kept
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {Object.values(AUDITED_ACTS).join(' · ')}.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            There is no delete. A log somebody can tidy is not a log, so the store behind this has
            an append and a read and nothing else.
          </p>
        </Card>

        {searchParams.course && (
          <p className="mb-3 text-xs text-ink-soft">
            Showing {named(searchParams.course) ?? 'one course'} only ·{' '}
            <Link href="/audit" className="text-brand hover:underline">everything you may read</Link>
          </p>
        )}

        {entries.length === 0 ? (
          <Empty
            title="Nothing has been done yet"
            body="Approving, publishing, withdrawing, issuing a certificate or moving a working language all land here."
          />
        ) : (
          <ol className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card className="px-5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm">{describe(entry)}</p>
                    <p className="text-[11px] text-ink-faint">
                      {new Date(entry.at).toLocaleString()}
                      {entry.courseId && ` · ${named(entry.courseId) ?? entry.courseId}`}
                    </p>
                  </div>
                  {entry.detail && (
                    <p className="mt-1 text-xs text-ink-soft">“{entry.detail}”</p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
