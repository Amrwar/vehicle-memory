import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Mileage,
  Money,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { pointsForPortalUser } from '@/lib/loyalty';
import { invoicesFor } from '@/lib/portal';
import { referralsForPortalUser } from '@/lib/referrals';
import { regionForUser } from '@/lib/region';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Home') };
}
export const dynamic = 'force-dynamic';

/**
 * The customer's home. Redesigned in Phase 32.5.
 *
 * Maria (persona P4) knows nothing about cars and does not want to. The
 * page answers one question first, "does anything need me?", with each
 * answer carrying its own button: decide an estimate, pay an invoice, ring
 * about a recall. Then her cars, each one a card with one way in. Then what
 * has happened lately. Rewards live on their own page and get one line here,
 * because a referral code in the middle of somebody's service history read
 * as an advertisement.
 */
export default async function PortalPage() {
  const t = await tFor();
  const user = await requireUser();
  const region = await regionForUser(user.userId);

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

  const [points, referrals, invoices] = await Promise.all([
    pointsForPortalUser(user.userId),
    referralsForPortalUser(user.userId),
    invoicesFor(user.userId),
  ]);

  const activeJobs = customers.flatMap((customer) =>
    customer.jobs
      .filter((job) => !['PAID', 'CANCELLED', 'INVOICED'].includes(job.status))
      .map((job) => ({ job, orgName: customer.org.name })),
  );
  const awaiting = activeJobs.filter(({ job }) => job.status === 'AWAITING_APPROVAL');
  const owing = invoices.filter((invoice) => invoice.outstanding > 0.005);
  const owedTotal = owing.reduce((total, invoice) => total + invoice.outstanding, 0);
  const recalled = ownerships.filter(({ vehicle }) => vehicle.recalls.length > 0);
  const attention = awaiting.length + owing.length + recalled.length;
  const totalPoints = points.reduce((n, card) => n + card.balance, 0);

  const recent = customers
    .flatMap((customer) => customer.jobs.map((job) => ({ job, orgName: customer.org.name })))
    .sort((a, b) => b.job.createdAt.getTime() - a.job.createdAt.getTime())
    .slice(0, 6);

  return (
    <PortalShell active="home" wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold leading-tight">
            {t('Hello, {name}', { name: user.name.split(' ')[0] ?? '' })}
          </h1>
          <p className="mt-1 text-[14px] text-(--text-soft)">
            {attention === 0
              ? t('Nothing needs your attention right now.')
              : attention === 1
                ? t('One thing needs your attention.')
                : t('{count} things need your attention.', { count: attention })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/portal/claim">
            <Button variant="secondary">{t('Add a car')}</Button>
          </Link>
          <Link href="/portal/book">
            <Button variant="primary">{t('Book a visit')}</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem] lg:gap-10">
        <div className="min-w-0">
          {attention > 0 ? (
            <section aria-labelledby="attention">
              <h2 id="attention" className="eyebrow mb-3">
                {t('Needs you')}
              </h2>
              <ul className="grid gap-3">
                {awaiting.map(({ job, orgName }) => {
                  const estimate = job.estimates[0];
                  return (
                    <li key={job.id}>
                      <Card className="border-(--warning)">
                        <CardBody className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-0">
                            <Badge tone="warning" size="sm" dot>
                              {t('Estimate to approve')}
                            </Badge>
                            <p className="mt-2 text-[15px] font-semibold">
                              {job.vehicle.make} {job.vehicle.model} · {job.shortDescription}
                            </p>
                            <p className="text-[13px] text-(--text-soft)">
                              {orgName}
                              {estimate ? (
                                <>
                                  {' · '}
                                  {t('estimated {amount}')
                                    .split('{amount}')
                                    .flatMap((part, index) =>
                                      index === 0
                                        ? [part]
                                        : [
                                            <span key={index} className="font-medium text-(--text)">
                                              <Money
                                                amount={Number(estimate.total)}
                                                currency={estimate.currency}
                                              />
                                            </span>,
                                            part,
                                          ],
                                    )}
                                </>
                              ) : null}
                            </p>
                          </div>
                          {estimate ? (
                            <Link href={`/portal/estimates/${estimate.id}`}>
                              <Button variant="primary" size="lg">
                                {t('Review and decide')}
                              </Button>
                            </Link>
                          ) : null}
                        </CardBody>
                      </Card>
                    </li>
                  );
                })}

                {owing.length > 0 ? (
                  <li>
                    <Card className="border-(--warning)">
                      <CardBody className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Badge tone="warning" size="sm" dot>
                            {owing.length === 1
                              ? t('Invoice to pay')
                              : t('{count} invoices to pay', { count: owing.length })}
                          </Badge>
                          <p className="mt-2 font-display text-[24px] font-semibold leading-none">
                            <Money amount={owedTotal} currency={owing[0]!.currency} />
                          </p>
                          <p className="mt-1 text-[13px] text-(--text-soft)">
                            {owing.length === 1
                              ? t('{invoice} from {workshop}', {
                                  invoice: owing[0]!.number ?? t('Invoice'),
                                  workshop: owing[0]!.org.name,
                                })
                              : t('From {workshops}', {
                                  workshops: [...new Set(owing.map((i) => i.org.name))].join(', '),
                                })}
                          </p>
                        </div>
                        <Link href="/portal/invoices">
                          <Button variant="primary" size="lg">
                            {t('Pay by card')}
                          </Button>
                        </Link>
                      </CardBody>
                    </Card>
                  </li>
                ) : null}

                {recalled.map(({ vehicle, id }) => (
                  <li key={id}>
                    <Card className="border-(--danger)">
                      <CardBody className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Badge tone="danger" size="sm" dot>
                            {t('Safety recall')}
                          </Badge>
                          <p className="mt-2 text-[15px] font-semibold">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-[13px] text-(--text-soft)">
                            {t(
                              'The manufacturer has an open safety recall on this car. The fix is free; book it in.',
                            )}
                          </p>
                        </div>
                        <Link href={`/portal/book?vehicle=${vehicle.id}`}>
                          <Button variant="secondary" size="lg">
                            {t('Book the recall')}
                          </Button>
                        </Link>
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="vehicles" className={attention > 0 ? 'mt-8' : ''}>
            <h2 id="vehicles" className="eyebrow mb-3">
              {t('My cars')}
            </h2>
            {ownerships.length === 0 ? (
              <EmptyState
                className="rounded-(--radius-lg) border border-(--border) bg-(--surface)"
                title={t('No cars yet')}
                description={t(
                  'Add your car by entering its registration. The garage that last worked on it confirms it is yours.',
                )}
                action={
                  <Link href="/portal/claim">
                    <Button variant="primary">{t('Add your car')}</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {ownerships.map(({ vehicle, id }) => {
                  const active = activeJobs.find(({ job }) => job.vehicleId === vehicle.id);
                  return (
                    <li key={id}>
                      <Link
                        href={`/portal/vehicles/${vehicle.id}`}
                        className="group block h-full rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4 transition-[border-color,box-shadow] hover:border-(--brand) hover:shadow-(--shadow-md)"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium tracking-wide text-(--text-faint) uppercase">
                              {vehicle.year}
                            </p>
                            <h3 className="font-display text-[18px] font-semibold leading-tight group-hover:text-(--brand-text)">
                              {vehicle.make} {vehicle.model}
                            </h3>
                          </div>
                          {vehicle.registration ? (
                            <Registration value={vehicle.registration} />
                          ) : null}
                        </div>
                        <p className="mt-3 text-[13px] text-(--text-soft)">
                          <Mileage km={vehicle.lastOdometerKm} t={t} /> ·{' '}
                          {vehicle._count.events === 1
                            ? t('1 entry on its passport')
                            : t('{count} entries on its passport', {
                                count: vehicle._count.events,
                              })}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          {active ? (
                            <Badge tone={toneFor(active.job.status as JobStatus)} dot>
                              {t(humanise(active.job.status as JobStatus))}
                            </Badge>
                          ) : vehicle.recalls.length > 0 ? (
                            <Badge tone="danger" dot>
                              {t('Recall open')}
                            </Badge>
                          ) : (
                            <Badge tone="success" dot>
                              {t('Nothing due')}
                            </Badge>
                          )}
                          <span className="text-[13px] font-medium text-(--brand-text)">
                            {t('Open →')}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {recent.length > 0 ? (
            <section aria-labelledby="recent" className="mt-8">
              <h2 id="recent" className="eyebrow mb-3">
                {t('Recent work')}
              </h2>
              <Card>
                <ul className="divide-y divide-(--border)">
                  {recent.map(({ job, orgName }) => (
                    <li key={job.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium">{job.shortDescription}</p>
                        <p className="text-[12px] text-(--text-faint)">
                          {job.vehicle.make} {job.vehicle.model} · {orgName} ·{' '}
                          <time className="datum">
                            {job.createdAt.toLocaleDateString(region.locale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </time>
                        </p>
                      </div>
                      {job.invoices[0] ? (
                        <span className="text-[14px] font-medium tabular-nums">
                          <Money
                            amount={Number(job.invoices[0].total)}
                            currency={job.invoices[0].currency}
                          />
                        </span>
                      ) : null}
                      <Badge tone={toneFor(job.status as JobStatus)} size="sm">
                        {t(humanise(job.status as JobStatus))}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          {points.length > 0 || referrals.length > 0 ? (
            <Link
              href="/portal/rewards"
              className="block rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4 transition-[border-color,box-shadow] hover:border-(--brand) hover:shadow-(--shadow-md)"
            >
              <p className="eyebrow">{t('Rewards')}</p>
              <p className="mt-1 font-display text-[22px] font-semibold leading-none">
                {totalPoints.toLocaleString(region.locale)}
                <span className="ms-1 text-[12px] font-normal text-(--text-faint)">
                  {t('points')}
                </span>
              </p>
              <p className="mt-2 text-[12px] text-(--text-soft)">
                {referrals.length > 0
                  ? t('Your points and a code that brings a friend.')
                  : t('Your points, workshop by workshop.')}
              </p>
            </Link>
          ) : null}

          <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
            <p className="eyebrow">{t('Your passports')}</p>
            <p className="mt-2 text-[13px] text-(--text-soft)">
              {t(
                "Every car's full history, verified, in one place. Share it with a buyer when you sell.",
              )}
            </p>
            <Link href="/portal/passports" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                {t('See passports')}
              </Button>
            </Link>
          </div>

          <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
            <p className="eyebrow">{customers.length > 0 ? t('Your workshops') : t('Workshops')}</p>
            {customers.length > 0 ? (
              <ul className="mt-2 grid gap-2 text-[13px]">
                {customers.map((customer) => (
                  <li key={customer.id}>
                    <p className="font-medium">{customer.org.name}</p>
                    {customer.org.phone ? (
                      <a
                        href={`tel:${customer.org.phone}`}
                        className="text-(--text-soft) underline"
                      >
                        {customer.org.phone}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-(--text-soft)">
                {t('Any workshop on Carnet can take your car, and its history goes with you.')}
              </p>
            )}
            <Link href="/portal/workshops" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                {t('Find a workshop')}
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
