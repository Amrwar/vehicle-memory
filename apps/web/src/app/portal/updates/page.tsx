import { customerProgressFor } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { updatesFor } from '@/lib/portal';
import { regionForUser } from '@/lib/region';

export const metadata: Metadata = { title: 'Updates' };
export const dynamic = 'force-dynamic';

/**
 * What is going on with the car. FR-2304.
 *
 * The question the portal exists to answer, and the one a status badge on a
 * card does not. Somebody whose car went in this morning wants to know whether
 * anybody has looked at it yet, and every workshop in the country answers that
 * question by telephone because there was nowhere else to put it.
 *
 * Every status is written from the customer's side. "Quality check" is precise
 * to a service manager and meaningless to the person waiting, whose only
 * question is when they can have it back.
 *
 * Anything needing an answer comes first and says what to do about it. A
 * timeline that reports without asking is a timeline nobody opens twice.
 */
function when(value: Date, locale: string): string {
  const days = Math.floor((Date.now() - value.getTime()) / 86_400_000);

  if (days === 0) {
    return `today at ${value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  return value.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

export default async function PortalUpdatesPage() {
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const jobs = await updatesFor(user.userId);

  const waiting = jobs.filter((job) => job.estimates.length > 0);
  const active = jobs.filter(
    (job) => job.estimates.length === 0 && !customerProgressFor(job.status).done,
  );
  const finished = jobs.filter(
    (job) => job.estimates.length === 0 && customerProgressFor(job.status).done,
  );

  return (
    <PortalShell active="updates">
      <h1 className="font-display text-[24px] font-semibold leading-tight">Updates</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {waiting.length > 0
          ? `${waiting.length} ${waiting.length === 1 ? 'quote needs' : 'quotes need'} your answer.`
          : active.length > 0
            ? `${active.length} ${active.length === 1 ? 'visit is' : 'visits are'} under way.`
            : 'Nothing is happening right now.'}
      </p>

      {jobs.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title="Nothing yet"
          description="Once one of your vehicles is booked in, everything that happens to it appears here."
        />
      ) : null}

      {waiting.length > 0 ? (
        <section className="mt-6 grid gap-3">
          <h2 className="font-display text-[17px] font-semibold">Waiting on you</h2>
          {waiting.map((job) => {
            const estimate = job.estimates[0]!;

            return (
              <Card key={job.id} className="border-(--warning)">
                <CardHeader
                  title={
                    `${job.vehicle.make ?? ''} ${job.vehicle.model ?? ''}`.trim() || 'Your vehicle'
                  }
                  description={`${job.org.name} · ${job.shortDescription}`}
                  action={
                    <Badge tone="warning" dot>
                      Needs your answer
                    </Badge>
                  }
                />
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Quoted</p>
                    <p className="font-display text-[22px] font-semibold">
                      <Money amount={Number(estimate.total)} currency={estimate.currency} />
                    </p>
                  </div>
                  <Link href={`/portal/estimates/${estimate.id}`}>
                    <Button variant="primary" size="lg">
                      Review and decide
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </section>
      ) : null}

      {active.length > 0 ? (
        <section className="mt-7 grid gap-3">
          <h2 className="font-display text-[17px] font-semibold">Under way</h2>
          {active.map((job) => {
            const progress = customerProgressFor(job.status);

            return (
              <Card key={job.id}>
                <CardHeader
                  title={
                    `${job.vehicle.make ?? ''} ${job.vehicle.model ?? ''}`.trim() || 'Your vehicle'
                  }
                  description={`${job.org.name} · ${job.shortDescription}`}
                  action={
                    <Badge tone="brand" dot>
                      {progress.label}
                    </Badge>
                  }
                />
                <CardBody className="grid gap-3">
                  <p className="text-[14px] text-(--text-soft)">
                    {progress.detail}
                    {job.promisedAt
                      ? ` Promised for ${job.promisedAt.toLocaleDateString(region.locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}.`
                      : ''}
                  </p>

                  {job.vehicle.registration ? (
                    <Registration value={job.vehicle.registration} />
                  ) : null}

                  {job.statusEvents.length > 0 ? (
                    <ol className="grid gap-1.5 border-t border-(--border) pt-3 text-[13px]">
                      {job.statusEvents.map((event) => (
                        <li key={event.id} className="flex flex-wrap justify-between gap-2">
                          <span>{customerProgressFor(event.toStatus).label}</span>
                          <span className="text-(--text-faint)">
                            {when(event.createdAt, region.locale)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {job.org.phone ? (
                    <p className="text-[12px] text-(--text-faint)">
                      Any questions, ring {job.org.name} on {job.org.phone}.
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display text-[17px] font-semibold">Done</h2>
          <ul className="mt-3 grid gap-2">
            {finished.map((job) => {
              const progress = customerProgressFor(job.status);
              const invoice = job.invoices[0];

              return (
                <li
                  key={job.id}
                  className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{job.shortDescription}</span>
                    <span className="text-[13px] text-(--text-soft)">{progress.label}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-(--text-soft)">
                    {job.org.name} · {when(job.updatedAt, region.locale)}
                    {invoice ? (
                      <>
                        {' · '}
                        <Money amount={Number(invoice.total)} currency={invoice.currency} />
                      </>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PortalShell>
  );
}
