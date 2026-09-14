import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Mileage,
  Money,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireUser } from '@/lib/guard';
import { pointsForPortalUser } from '@/lib/loyalty';
import { referralsForPortalUser } from '@/lib/referrals';
import { ThemeToggle } from '@/components/theme-toggle';
import { Mark } from '@/components/marketing';

export const metadata: Metadata = { title: 'My vehicles' };
export const dynamic = 'force-dynamic';

/**
 * The customer portal.
 *
 * Maria (persona P4) knows nothing about cars and does not want to. Every
 * status is in plain language, every figure is explained, and the whole thing
 * works on a phone in a supermarket car park.
 */
export default async function PortalPage() {
  const user = await requireUser();

  // A portal user is linked to customer records across any number of
  // workshops. This is the point of the model: her history is hers, not one
  // garage's.
  const customers = await prisma.customer.findMany({
    where: { portalUserId: user.userId },
    include: {
      org: { select: { name: true, phone: true } },
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          vehicle: true,
          estimates: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true, total: true, currency: true },
          },
          invoices: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  const ownerships = await prisma.vehicleOwnership.findMany({
    where: { ownerUserId: user.userId, endedAt: null },
    include: {
      vehicle: {
        include: {
          _count: { select: { events: true } },
          recalls: { where: { status: 'OPEN' }, select: { id: true } },
        },
      },
    },
  });

  const [points, referrals] = await Promise.all([
    pointsForPortalUser(user.userId),
    referralsForPortalUser(user.userId),
  ]);

  const activeJobs = customers.flatMap((customer) =>
    customer.jobs
      .filter((job) => !['PAID', 'CANCELLED', 'INVOICED'].includes(job.status))
      .map((job) => ({ job, orgName: customer.org.name })),
  );

  const awaiting = activeJobs.filter(({ job }) => job.status === 'AWAITING_APPROVAL');

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Mark size={18} className="text-(--brand)" />
            <span className="font-display text-[14px] font-semibold">Carnet</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="w-[6.5rem]" />
            <form action="/api/sign-out" method="post">
              <button type="submit" className="text-[13px] text-(--text-faint) underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-display text-[24px] font-semibold leading-tight">
          Hello, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-[14px] text-(--text-soft)">
          {awaiting.length > 0
            ? `${awaiting.length} ${awaiting.length === 1 ? 'estimate needs' : 'estimates need'} your decision.`
            : 'Nothing needs your attention right now.'}
        </p>

        {awaiting.length > 0 ? (
          <section className="mt-5 grid gap-3">
            {awaiting.map(({ job, orgName }) => {
              const estimate = job.estimates[0];

              return (
                <Card key={job.id} className="border-(--warning)">
                  <CardHeader
                    title={`${job.vehicle.make} ${job.vehicle.model}`}
                    description={`${orgName} · ${job.shortDescription}`}
                    action={
                      <Badge tone="warning" dot>
                        Needs your approval
                      </Badge>
                    }
                  />
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow">Estimated total</p>
                      <p className="font-display text-[24px] font-semibold">
                        {estimate ? (
                          <Money amount={Number(estimate.total)} currency={estimate.currency} />
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    {estimate ? (
                      // The account route, not the share link. A share id is
                      // not the capability token and never opened anything;
                      // somebody signed in is entitled to the quote without
                      // needing the link that was emailed to them.
                      <Link href={`/portal/estimates/${estimate.id}`}>
                        <Button variant="primary" size="lg">
                          Review and decide
                        </Button>
                      </Link>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })}
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[17px] font-semibold">My vehicles</h2>
            {ownerships.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/portal/claim">
                  <Button size="sm">Add another car</Button>
                </Link>
                <Link href="/portal/book">
                  <Button size="sm" variant="primary">
                    Book a visit
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>

          {ownerships.length === 0 ? (
            <EmptyState
              className="mt-3 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
              title="No vehicles yet"
              description="Add your car by entering its registration. The garage that last worked on it confirms the car is yours."
              action={
                <Link href="/portal/claim">
                  <Button variant="primary">Add your car</Button>
                </Link>
              }
            />
          ) : (
            <ul className="mt-3 grid gap-3">
              {ownerships.map(({ vehicle, id }) => {
                const active = activeJobs.find(({ job }) => job.vehicleId === vehicle.id);

                return (
                  <li key={id}>
                    <Card>
                      <CardBody>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-[17px] font-semibold">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </h3>
                              {vehicle.registration ? (
                                <Registration value={vehicle.registration} />
                              ) : null}
                            </div>
                            <p className="mt-1 text-[13px] text-(--text-faint)">
                              <Mileage km={vehicle.lastOdometerKm} /> · {vehicle._count.events}{' '}
                              entries on record
                            </p>
                          </div>

                          {active ? (
                            <Badge tone={toneFor(active.job.status as JobStatus)} dot>
                              {humanise(active.job.status as JobStatus)}
                            </Badge>
                          ) : (
                            <Badge tone="success" dot>
                              Nothing due
                            </Badge>
                          )}
                        </div>

                        {vehicle.recalls.length > 0 ? (
                          <p className="mt-3 rounded-(--radius-sm) bg-(--danger-soft) px-2.5 py-1.5 text-[13px] text-(--danger)">
                            This vehicle has an outstanding safety recall. Contact your workshop.
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/portal/vehicles/${vehicle.id}`}>
                            <Button size="touch">View history</Button>
                          </Link>
                          {/* Both of these were buttons with nothing behind
                              them. Sharing lives on the vehicle's own page,
                              because the moment somebody wants to share a
                              car's history is the moment they are looking at
                              it. */}
                          <Link href={`/portal/vehicles/${vehicle.id}#share`}>
                            <Button size="touch">Share with a buyer</Button>
                          </Link>
                          <Link href={`/portal/book?vehicle=${vehicle.id}`}>
                            <Button size="touch">Book a service</Button>
                          </Link>
                        </div>
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Points are per workshop, because each workshop runs its own
            scheme and pays for it. Shown only where there is something to
            show; a row of zeros is a sales pitch, not information. */}
        {points.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-[17px] font-semibold">Your points</h2>
            <ul className="mt-3 grid gap-2">
              {points.map((card) => (
                <li
                  key={card.customerId}
                  className="flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{card.workshop}</p>
                    <p className="text-[12px] text-(--text-faint)">
                      Worth <Money amount={card.valueMinor / 100} /> off your next bill there. Ask
                      at the counter to use them.
                    </p>
                    {card.expiring.points > 0 && card.expiring.on ? (
                      <p className="mt-1 text-[12px] text-(--warning)">
                        {card.expiring.points.toLocaleString('en-GB')} expire on{' '}
                        {card.expiring.on.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        .
                      </p>
                    ) : null}
                  </div>
                  <p className="font-display text-[22px] font-semibold tabular-nums">
                    {card.balance.toLocaleString('en-GB')}
                    <span className="ml-1 text-[12px] font-normal text-(--text-faint)">points</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* A code per workshop, with the rule in the same breath. It pays
            once the friend has had work done, and saying so here is what
            stops a friend expecting points for signing up. */}
        {referrals.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-[17px] font-semibold">Bring a friend</h2>
            <ul className="mt-3 grid gap-2">
              {referrals.map((card) => (
                <li
                  key={card.customerId}
                  className="flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{card.workshop}</p>
                    <p className="text-[12px] text-(--text-faint)">
                      Give this code to somebody who has not been there. Once they have had{' '}
                      <Money amount={card.minimumMinor / 100} /> of work done, you both get{' '}
                      {card.pointsEachSide} points.
                    </p>
                  </div>
                  <p className="datum text-[20px] font-semibold tracking-[0.2em]">{card.code}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-[17px] font-semibold">Recent work</h2>
          <ul className="mt-3 grid gap-2">
            {customers
              .flatMap((customer) =>
                customer.jobs.map((job) => ({ job, orgName: customer.org.name })),
              )
              .slice(0, 8)
              .map(({ job, orgName }) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--border) bg-(--surface) px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{job.shortDescription}</p>
                    <p className="text-[12px] text-(--text-faint)">
                      {job.vehicle.make} {job.vehicle.model} · {orgName} ·{' '}
                      <time className="datum">
                        {job.createdAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                    </p>
                  </div>
                  {job.invoices[0] ? (
                    <span className="text-[14px] font-medium">
                      <Money
                        amount={Number(job.invoices[0].total)}
                        currency={job.invoices[0].currency}
                      />
                    </span>
                  ) : null}
                  <Badge tone={toneFor(job.status as JobStatus)} size="sm">
                    {humanise(job.status as JobStatus)}
                  </Badge>
                </li>
              ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
