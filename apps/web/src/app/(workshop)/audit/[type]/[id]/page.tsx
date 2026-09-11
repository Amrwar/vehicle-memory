import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { chainProvenance, lifeFor } from '@/lib/provenance';

export const metadata: Metadata = { title: 'How this came to be' };
export const dynamic = 'force-dynamic';

/**
 * One record read as its own history. FR-3401.
 *
 * The audit log has recorded who, what, when, before and after on every
 * meaningful action since Phase 1, and nothing has ever read it back except a
 * page that mixes the whole organisation together. That page answers "what
 * happened this morning". This one answers "what happened to this quote",
 * which is the question somebody actually asks, usually while a customer is
 * on the telephone disputing something.
 *
 * Oldest first, unlike the customer thread. A thread is caught up with; a
 * life is read from the beginning, because the question is how it got here.
 */
function when(value: Date): string {
  return value.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function LifePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { orgId } = await requireSession('audit:read');
  const { type, id } = await params;

  const life = await lifeFor(orgId, type, id);
  if (!life) notFound();

  // Only a vehicle carries a hash chain, and only there is it worth showing
  // beside the audit entries. Everywhere else the audit log is the whole
  // account of what happened.
  const chain = type === 'Vehicle' ? await chainProvenance(id, 20) : [];

  return (
    <>
      <div className="mb-3">
        <BackLink href="/audit">The audit log</BackLink>
      </div>

      <PageHeader
        eyebrow={life.label}
        title="How this record came to be"
        description={life.summary}
        actions={
          life.href ? (
            <Link
              href={life.href}
              className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken)"
            >
              Open the {life.label.toLowerCase()}
            </Link>
          ) : null
        }
      />

      <Card className="mb-5">
        <CardBody className="grid gap-2 text-[13px] sm:grid-cols-3">
          <div>
            <span className="block text-[11px] tracking-wide text-(--text-faint) uppercase">
              First recorded
            </span>
            {life.createdAt ? when(life.createdAt) : 'Never'}
          </div>
          <div>
            <span className="block text-[11px] tracking-wide text-(--text-faint) uppercase">
              Last touched
            </span>
            {life.lastTouchedAt ? when(life.lastTouchedAt) : 'Never'}
          </div>
          <div>
            <span className="block text-[11px] tracking-wide text-(--text-faint) uppercase">
              Hands it passed through
            </span>
            {life.hands.length > 0 ? life.hands.join(', ') : 'Nobody'}
          </div>
        </CardBody>
      </Card>

      <div className={chain.length > 0 ? 'grid gap-5 lg:grid-cols-[1.2fr_1fr]' : ''}>
        <Card className="overflow-hidden">
          <CardHeader
            title="What happened, in order"
            description="Every recorded action, with what it changed and where it came from."
          />
          {life.events.length === 0 ? (
            <EmptyState
              title="Nothing recorded against this"
              description="Either it predates the audit log, or nothing has been done to it since it was created."
            />
          ) : (
            <ol className="divide-y divide-(--border)">
              {life.events.map((event) => (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className={`text-[13px] ${event.milestone ? 'font-semibold' : 'font-medium'}`}
                    >
                      {event.title}
                    </span>
                    {event.milestone ? (
                      <Badge tone="brand" size="sm">
                        milestone
                      </Badge>
                    ) : null}
                    <span className="ml-auto datum text-[12px] text-(--text-faint)">
                      {when(event.at)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[12px] text-(--text-soft)">
                    {event.actorName}
                    {event.origin ? ` · from ${event.origin}` : ''}
                  </p>

                  {event.changes.length > 0 ? (
                    <ul className="mt-2 grid gap-1">
                      {event.changes.map((change) => (
                        <li key={change.field} className="text-[12px]">
                          <span className="text-(--text-faint)">{change.field}</span>{' '}
                          {change.added ? (
                            <span className="text-(--success)">set to {change.to}</span>
                          ) : change.removed ? (
                            <span className="text-(--danger)">cleared, was {change.from}</span>
                          ) : (
                            <>
                              <span className="text-(--text-faint) line-through">
                                {change.from}
                              </span>{' '}
                              <span aria-hidden>to</span>{' '}
                              <span className="font-medium">{change.to}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {chain.length > 0 ? (
          <Card className="overflow-hidden">
            <CardHeader
              title="Fixed in the vehicle's record"
              description="A different kind of claim: not that somebody did something, but that a fact was recorded and cannot now be altered."
            />
            <ol className="divide-y divide-(--border)">
              {chain.map((event) => (
                <li key={event.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium">{event.title}</span>
                    <span className="datum text-[11px] text-(--text-faint)">#{event.sequence}</span>
                  </div>
                  <p className="text-[12px] text-(--text-soft)">
                    {event.recordedByOrg?.name ?? 'Unknown workshop'}
                    {event.recordedByUser?.name ? ` · ${event.recordedByUser.name}` : ''} ·{' '}
                    {event.occurredAt.toLocaleDateString('en-GB')}
                  </p>
                  <p className="datum text-[11px] break-all text-(--text-faint)">
                    {event.fingerprint}…
                  </p>
                </li>
              ))}
            </ol>
            <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
              Each entry is linked to the one before it, so none can be altered or removed without
              breaking every entry after it. The vehicle&rsquo;s own page recomputes the whole chain
              and says whether it holds.
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
