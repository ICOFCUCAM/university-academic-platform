// ---------------------------------------------------------------------------
// The small pieces every screen uses. Deliberately few: this product's screens
// are documents and pipelines, not dashboards of widgets.
// ---------------------------------------------------------------------------

import type { ArtefactState } from '@/lib/domain/types';

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: {
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-page-line bg-page-card px-6 py-5 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] uppercase tracking-wide text-ink-faint">{eyebrow}</p>}
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

const STATE_STYLE: Record<ArtefactState, string> = {
  absent: 'bg-page text-ink-faint border-page-line',
  queued: 'bg-page text-ink-soft border-page-line',
  running: 'bg-brand-tint text-brand-dark border-brand/30',
  ready: 'bg-amber-50 text-warn border-amber-200',
  approved: 'bg-emerald-50 text-ok border-emerald-200',
  published: 'bg-emerald-600 text-white border-emerald-600',
  failed: 'bg-red-50 text-bad border-red-200',
};

const STATE_LABEL: Record<ArtefactState, string> = {
  absent: 'Not made',
  queued: 'Queued',
  running: 'Processing',
  ready: 'Awaiting review',
  approved: 'Approved',
  published: 'Published',
  failed: 'Failed',
};

export function StateBadge({ state }: { state: ArtefactState }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_STYLE[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-page-line bg-page-card ${className}`}>{children}</section>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-page-line bg-page-card px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{body}</p>
    </div>
  );
}
