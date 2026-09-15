import { humanise, IN_SHOP_STATUSES, toneFor } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { VerifyBanner } from '@/components/verify-banner';
import { revenueObservations } from '@/lib/answers';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { ownerDay } from '@/lib/owner';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Dashboard') };
}
export const dynamic = 'force-dynamic';

/**
 * The workshop dashboard.
 *
 * Action-oriented, not a wall of charts (persona P1). Ahmed opens this at
 * 7:40am and needs to know what requires him, not how last quarter went.
 * Every figure links to the records behind it (FR-1402).
 *
 * Phase 40 reviewed it against the order an owner runs the business in:
 * today, then the jobs waiting on somebody, then the people, then the money
 * owed and what came back, then the shelf. Two tiles that showed a word
 * instead of a figure ("Open", "Due") were replaced by figures, and the
 * business and inventory blocks were added with the comeback rate, the
 * satisfaction trend, what is owed and overdue, what is short, which orders
 * are late, and what is sitting on the shelf.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const notice = await searchParams;
  const { db, user, orgId, region } = await requireSession('job:read');
  const t = await tFor();

  const seesBusiness = can(user.role, 'report:operational');
  const seesInventory = can(user.role, 'inventory:read');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const [
    todaysJobs,
    inShop,
    awaitingApproval,
    paymentsToday,
    todaysBookings,
    approvals,
    waitingForParts,
    overdue,
    clockedOn,
    activity,
    observations,
    day,
  ] = await Promise.all([
    db.job.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } }),
    db.job.count({ where: { status: { in: [...IN_SHOP_STATUSES] } } }),
    db.job.count({ where: { status: 'AWAITING_APPROVAL' } }),
    db.payment.aggregate({
      where: { receivedAt: { gte: startOfDay, lt: endOfDay } },
      _sum: { amount: true },
    }),
    db.booking.findMany({
      where: { startAt: { gte: startOfDay, lt: endOfDay } },
      orderBy: { startAt: 'asc' },
      take: 12,
      include: {
        customer: { select: { displayName: true } },
        vehicle: { select: { id: true, make: true, model: true, registration: true } },
        technician: { select: { name: true } },
        bay: { select: { name: true } },
        job: { select: { id: true, number: true, status: true } },
      },
    }),
    db.job.findMany({
      where: { status: 'AWAITING_APPROVAL' },
      orderBy: { updatedAt: 'asc' },
      take: 6,
      include: {
        customer: { select: { displayName: true } },
        vehicle: { select: { make: true, model: true, registration: true } },
        estimates: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { total: true, sentAt: true, currency: true },
        },
      },
    }),
    // Work that cannot proceed because something is on order. A job blocked
    // on a part looks identical, on every other screen, to one somebody has
    // simply not started.
    db.job.count({
      where: {
        status: { in: ['APPROVED', 'IN_PROGRESS'] },
        partLines: { some: { product: { stockLevels: { some: { onHand: { lte: 0 } } } } } },
      },
    }),
    // Past the day it was promised for and still not finished. The figure
    // nobody keeps and every customer remembers.
    db.job.count({
      where: {
        promisedAt: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'] },
      },
    }),
    // The people: who is clocked on to a job right now.
    prisma.timeEntry.findMany({
      where: { endedAt: null, job: { orgId } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    // The audit log already records everything a feed would show, and
    // nothing has ever read it that way.
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    // Arithmetic with a sentence around it: this month against last, from the
    // same figures the reports page shows.
    seesBusiness ? revenueObservations(orgId) : Promise.resolve([] as string[]),
    seesBusiness || seesInventory ? ownerDay(orgId) : Promise.resolve(null),
  ]);

  const revenueToday = Number(paymentsToday._sum.amount ?? 0);
  const hour = new Date().getHours();
  const firstName = user.name.split(' ')[0] ?? user.name;
  const greeting =
    hour < 12
      ? t('Good morning, {name}', { name: firstName })
      : hour < 18
        ? t('Good afternoon, {name}', { name: firstName })
        : t('Good evening, {name}', { name: firstName });

  const money = (amount: number) => (
    <Money currency={region.currency} locale={region.locale} amount={amount} />
  );

  return (
    <>
      <VerifyBanner sent={notice.verification === 'sent'} />

      <PageHeader
        eyebrow={new Date().toLocaleDateString(region.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        title={greeting}
        actions={
          <>
            <Link href="/diary">
              <Button>{t('Open diary')}</Button>
            </Link>
            <Link href="/jobs/new">
              <Button variant="primary">{t('New job')}</Button>
            </Link>
          </>
        }
      />

      {/* ---------------- today ---------------- */}
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-(--text-faint)">
        {t('Today')}
      </h2>
      <StatRow className="mb-3">
        <Link href="/jobs" className="group">
          <StatTile label={t('Jobs today')} value={todaysJobs} note={t('Created since midnight')} />
        </Link>
        <Link href="/jobs?status=in-shop" className="group">
          <StatTile label={t('Vehicles in shop')} value={inShop} note={t('Physically on site')} />
        </Link>
        <Link href="/jobs?status=AWAITING_APPROVAL" className="group">
          <StatTile
            label={t('Awaiting approval')}
            value={awaitingApproval}
            tone={awaitingApproval > 0 ? 'warning' : 'neutral'}
            note={awaitingApproval > 0 ? t('Work is blocked') : t('Nothing waiting')}
          />
        </Link>
        <Link href="/payments" className="group">
          <StatTile
            label={t('Taken today')}
            value={money(revenueToday)}
            tone={revenueToday > 0 ? 'success' : 'neutral'}
            note={t('Payments received')}
          />
        </Link>
      </StatRow>
      <StatRow className="mb-6">
        <Link href="/jobs" className="group">
          <StatTile
            label={t('Past the promise')}
            value={overdue}
            tone={overdue > 0 ? 'danger' : 'neutral'}
            note={t('Due back and not finished')}
          />
        </Link>
        <Link href="/diary" className="group">
          <StatTile
            label={t('Booked today')}
            value={todaysBookings.length}
            note={t('Appointments in the diary')}
          />
        </Link>
        <Link href="/people" className="group">
          <StatTile
            label={t('On the clock')}
            value={clockedOn.length}
            note={t('Clocked on to a job now')}
          />
        </Link>
      </StatRow>

      {approvals.length > 0 ? (
        <Card className="mb-6 border-(--warning)">
          <CardHeader
            title={t('Approvals needed')}
            description={t('Nothing can proceed on these until the customer decides.')}
            action={
              <Link href="/jobs?status=AWAITING_APPROVAL">
                <Button size="sm">{t('See all')}</Button>
              </Link>
            }
          />
          <ul className="divide-y divide-(--border)">
            {approvals.map((job) => {
              const estimate = job.estimates[0];
              const waitingHours = estimate?.sentAt
                ? Math.floor((Date.now() - estimate.sentAt.getTime()) / 3_600_000)
                : null;

              return (
                <li key={job.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-[14px] font-medium hover:underline"
                      >
                        {job.vehicle.make} {job.vehicle.model}
                      </Link>
                      {job.vehicle.registration ? (
                        <Registration value={job.vehicle.registration} />
                      ) : null}
                      <span className="datum text-[11px] text-(--text-faint)">#{job.number}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-(--text-faint)">
                      {job.customer.displayName} &middot; {job.shortDescription}
                      {waitingHours !== null
                        ? ` · ${t('waiting {hours}h', { hours: waitingHours })}`
                        : ''}
                    </p>
                  </div>

                  {estimate ? (
                    <span className="font-display text-[16px] font-semibold tabular">
                      <Money amount={Number(estimate.total)} currency={estimate.currency} />
                    </span>
                  ) : null}

                  <Link href={`/jobs/${job.id}`}>
                    <Button size="sm" variant="primary">
                      {t('Review')}
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader
          title={t('Today in the workshop')}
          description={
            todaysBookings.length === 1
              ? t('1 booking scheduled')
              : t('{count} bookings scheduled', { count: todaysBookings.length })
          }
          action={
            <Link href="/diary">
              <Button size="sm">{t('Diary')}</Button>
            </Link>
          }
        />

        {todaysBookings.length === 0 ? (
          <EmptyState
            title={t('Nothing booked today')}
            description={t('An empty diary is as much of a problem as a full one.')}
            action={
              <Link href="/diary">
                <Button variant="primary">{t('Add a booking')}</Button>
              </Link>
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Time')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Customer')}</Th>
                  <Th>{t('Work')}</Th>
                  <Th>{t('Technician')}</Th>
                  <Th>{t('Bay')}</Th>
                  <Th>{t('Status')}</Th>
                </tr>
              </thead>
              <tbody>
                {todaysBookings.map((booking) => (
                  <Tr key={booking.id}>
                    <Td className="datum whitespace-nowrap">
                      {booking.startAt.toLocaleTimeString(region.locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/vehicles/${booking.vehicle.id}`}
                          className="font-medium hover:underline"
                        >
                          {booking.vehicle.make} {booking.vehicle.model}
                        </Link>
                        {booking.vehicle.registration ? (
                          <Registration value={booking.vehicle.registration} />
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-(--text-soft)">{booking.customer.displayName}</Td>
                    <Td className="max-w-[18rem] truncate text-(--text-soft)">
                      {booking.description}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {booking.technician?.name ?? (
                        <span className="text-(--text-faint)">{t('Unassigned')}</span>
                      )}
                    </Td>
                    <Td className="text-(--text-soft)">{booking.bay?.name ?? '—'}</Td>
                    <Td>
                      {booking.job ? (
                        <Link href={`/jobs/${booking.job.id}`}>
                          <Badge tone={toneFor(booking.job.status)} dot>
                            {t(humanise(booking.job.status))}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge tone="neutral" dot>
                          {t('Booked')}
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* ---------------- the business ---------------- */}
      {seesBusiness && day ? (
        <>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-(--text-faint)">
            {t('The business')}
          </h2>
          <StatRow className="mb-3">
            <Link href="/payments" className="group">
              <StatTile
                label={t('Owed to you')}
                value={money(day.owed)}
                note={t('Issued and not yet paid')}
              />
            </Link>
            <Link href="/financials" className="group">
              <StatTile
                label={t('Overdue')}
                value={money(day.overdue)}
                tone={day.overdue > 0 ? 'danger' : 'neutral'}
                note={
                  day.overdueCount === 0
                    ? t('Nothing past its due date')
                    : day.overdueCount === 1
                      ? t('1 invoice past its due date')
                      : t('{count} invoices past their due date', { count: day.overdueCount })
                }
              />
            </Link>
            <Link href="/reports/business?range=quarter#comebacks" className="group">
              <StatTile
                label={t('Comebacks')}
                value={
                  day.comebacks.value === null
                    ? String(day.comebacks.part)
                    : `${day.comebacks.value}%`
                }
                tone={day.comebacks.part > 0 ? 'warning' : 'neutral'}
                note={
                  day.comebacks.value === null
                    ? t('Back out of {base} finished in 90 days, too few for a rate', {
                        base: day.comebacks.base,
                      })
                    : t('{part} back out of {base} finished in 90 days', {
                        part: day.comebacks.part,
                        base: day.comebacks.base,
                      })
                }
              />
            </Link>
            <Link href="/reputation#trend" className="group">
              <StatTile
                label={t('Satisfaction')}
                value={day.satisfaction.current === null ? '—' : String(day.satisfaction.current)}
                tone={
                  day.satisfaction.direction === 'down'
                    ? 'danger'
                    : day.satisfaction.direction === 'up'
                      ? 'success'
                      : 'neutral'
                }
                note={
                  day.satisfaction.direction === 'up'
                    ? t('Improving on the 90 days before')
                    : day.satisfaction.direction === 'down'
                      ? t('Falling on the 90 days before')
                      : day.satisfaction.direction === 'steady'
                        ? t('Steady on the 90 days before')
                        : t('Too few answers to compare')
                }
              />
            </Link>
          </StatRow>

          <Card className="mb-6">
            <CardHeader
              title={t('This month')}
              description={t(
                'Arithmetic with a sentence around it, from the same figures as the reports.',
              )}
              action={
                <Link href="/ask">
                  <Button size="sm" variant="primary">
                    {t('Ask a question')}
                  </Button>
                </Link>
              }
            />
            <CardBody>
              <ul className="grid gap-1.5 text-[14px] leading-relaxed">
                {observations.map((line) => (
                  <li key={line}>{t(line)}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      ) : null}

      {/* ---------------- inventory ---------------- */}
      {seesInventory && day ? (
        <>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-(--text-faint)">
            {t('Inventory')}
          </h2>
          <StatRow className="mb-3">
            <Link href="/parts" className="group">
              <StatTile
                label={t('Short')}
                value={day.short.length}
                tone={day.short.length > 0 ? 'warning' : 'neutral'}
                note={t('Below reorder point, nothing on order')}
              />
            </Link>
            <Link href="/purchasing" className="group">
              <StatTile
                label={t('Orders late')}
                value={day.lateOrders}
                tone={day.lateOrders > 0 ? 'danger' : 'neutral'}
                note={t('Past the day the supplier promised')}
              />
            </Link>
            <Link href="/purchasing" className="group">
              <StatTile
                label={t('Waiting for parts')}
                value={waitingForParts}
                tone={waitingForParts > 0 ? 'warning' : 'neutral'}
                note={t('Approved, and nothing on the shelf')}
              />
            </Link>
            <Link href="/parts" className="group">
              <StatTile
                label={t('Stock value')}
                value={money(day.stockValue)}
                note={t('On the shelf at average cost')}
              />
            </Link>
          </StatRow>

          {day.short.length > 0 ? (
            <Card className="mb-6 overflow-hidden">
              <CardHeader
                title={t('Short now')}
                description={t('Each opens the part, with every supplier side by side.')}
              />
              <ul className="divide-y divide-(--border)">
                {day.short.slice(0, 6).map((part) => (
                  <li key={part.id}>
                    <Link
                      href={`/parts/${part.id}#suppliers`}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 hover:bg-(--surface-sunk)"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium">{part.name}</span>
                        <span className="datum block text-[11px] text-(--text-faint)">
                          {part.partNumber}
                        </span>
                      </span>
                      <span className="text-[12px] tabular-nums text-(--text-soft)">
                        {t('{available} available, reorder at {point}', {
                          available: part.available,
                          point: part.reorderPoint,
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <div className="mb-6" />
          )}
        </>
      ) : null}

      {/* What has happened, from the audit log. Every action in the product
          already writes to it and nothing had ever read it as a feed, so the
          one record of what the workshop did today was invisible to the people
          who did it. */}
      <Card>
        <CardHeader
          title={t("What's happening")}
          description={t('Everything the workshop has done, newest first.')}
        />
        <CardBody className="p-0">
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-(--text-soft)">
              {t('Nothing recorded yet today.')}
            </p>
          ) : (
            <ul className="divide-y divide-(--border-soft)">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-[13px]">
                    <span className="font-medium">{entry.actor?.name ?? t('The system')}</span>{' '}
                    <span className="text-(--text-soft)">
                      {t(entry.action.replace(/[._]/g, ' '))}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums text-(--text-faint)">
                    {entry.createdAt.toLocaleTimeString(region.locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
