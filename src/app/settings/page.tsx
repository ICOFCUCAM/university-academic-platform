import { engine } from '@/lib/ai/engine';
import { getQueue, getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { PLANS } from '@/lib/billing/plans';
import { STAGES } from '@/lib/pipeline/stages';
import { capabilitiesOf, ROLE_LABEL } from '@/lib/capabilities';
import { Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const actor = await currentActor();
  const store = getStore();
  const wired = engine().describe();
  const pending = await getQueue().pending();

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="What is wired up, what is not, and what this account may do. Nothing here is guessed — an engine that is not configured says so rather than failing quietly later."
      />
      <div className="grid gap-4 px-6 py-6 md:px-8 lg:grid-cols-2">
        <Card className="px-5 py-4">
          <h2 className="text-sm font-semibold">The engine</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Language model</dt>
              <dd className="text-right font-medium">{wired.model}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Transcription</dt>
              <dd className="text-right font-medium">{wired.transcription}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Speech</dt>
              <dd className="text-right font-medium">{wired.speech}</dd>
            </div>
          </dl>
          {!wired.live && (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-ink-soft">
              No language model is configured, so transformations are produced by the offline
              processor and are stamped as such on every artefact. Set <code>ANTHROPIC_API_KEY</code>{' '}
              to run the real pipeline.
            </p>
          )}
        </Card>

        <Card className="px-5 py-4">
          <h2 className="text-sm font-semibold">This workspace</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Store</dt>
              <dd className="font-medium">{store.id === 'memory' ? 'In process (demonstration)' : store.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Jobs pending</dt>
              <dd className="font-medium">{pending}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Signed in as</dt>
              <dd className="font-medium">{actor.name} — {ROLE_LABEL[actor.role]}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-faint">
            {capabilitiesOf(actor.role).length} capabilities held:{' '}
            {capabilitiesOf(actor.role).join(', ')}.
          </p>
        </Card>

        <Card className="px-5 py-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">The pipeline</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {STAGES.map((stage, i) => (
              <li key={stage.kind} className="flex gap-3">
                <span className="w-5 shrink-0 text-ink-faint">{i + 1}</span>
                <span>
                  <strong className="font-medium">{stage.label}</strong>
                  <span className="text-ink-soft"> — {stage.purpose}</span>
                  {stage.requiresApprovedSource && (
                    <span className="ml-1 text-[11px] text-warn">· waits for the lecturer’s approval</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="px-5 py-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Plans</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Metered on minutes of audio, because that is what actually costs money. The refusal
            comes before the upload, never after the spend.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className="rounded border border-page-line px-3 py-3">
                <p className="text-sm font-medium">{plan.label}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {plan.price === null ? 'Licensed' : plan.price === 0 ? 'Free'
                    : `€${(plan.price / 100).toFixed(2)}/month`}
                </p>
                <p className="mt-2 text-xs text-ink-soft">{plan.blurb}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
