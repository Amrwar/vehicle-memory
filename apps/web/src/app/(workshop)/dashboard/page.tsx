import { humanise, IN_SHOP_STATUSES, toneFor } from '@carnet/core';
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
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/**
 * The workshop dashboard.
 *
 * Action-oriented, not a wall of charts (persona P1). Ahmed opens this at
 * 7:40am and needs to know what requires him, not how last quarter went.
 * Every figure links to the records behind it (FR-1402).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const notice = await searchParams;
  const { db, user } = await requireSession('job:read');

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
    activity,
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
  ]);

  const revenueToday = Number(paymentsToday._sum.amount ?? 0);
  const greeting = greetingFor(new Date());

  return (
    <>
      <VerifyBanner sent={notice.verification === 'sent'} />

      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        actions={
          <>
            <Link href="/diary">
              <Button>Open diary</Button>
            </Link>
            <Link href="/jobs/new">
              <Button variant="primary">New job</Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-6">
        <Link href="/jobs" className="group">
          <StatTile label="Jobs today" value={todaysJobs} note="Created since midnight" />
        </Link>
        <Link href="/jobs?status=in-shop" className="group">
          <StatTile label="Vehicles in shop" value={inShop} note="Physically on site" />
        </Link>
        <Link href="/jobs?status=AWAITING_APPROVAL" className="group">
          <StatTile
            label="Awaiting approval"
            value={awaitingApproval}
            tone={awaitingApproval > 0 ? 'warning' : 'neutral'}
            note={awaitingApproval > 0 ? 'Work is blocked' : 'Nothing waiting'}
          />
        </Link>
        <Link href="/payments" className="group">
          <StatTile
            label="Taken today"
            value={<Money amount={revenueToday} />}
            tone={revenueToday > 0 ? 'success' : 'neutral'}
            note="Payments received"
          />
        </Link>
      </StatRow>

      <StatRow className="mb-6">
        <Link href="/purchasing" className="group">
          <StatTile
            label="Waiting for parts"
            value={waitingForParts}
            tone={waitingForParts > 0 ? 'warning' : 'neutral'}
            note="Approved, and nothing on the shelf"
          />
        </Link>
        <Link href="/jobs" className="group">
          <StatTile
            label="Past the promise"
            value={overdue}
            tone={overdue > 0 ? 'danger' : 'neutral'}
            note="Due back and not finished"
          />
        </Link>
        <Link href="/floor" className="group">
          <StatTile label="The floor" value="Open" note="What is in each bay now" />
        </Link>
        <Link href="/reminders" className="group">
          <StatTile label="Reminders" value="Due" note="What is about to be sent" />
        </Link>
      </StatRow>

      {/* What has happened, from the audit log. Every action in the product
          already writes to it and nothing had ever read it as a feed, so the
          one record of what the workshop did today was invisible to the people
          who did it. */}
      <Card className="mb-6">
        <CardHeader
          title="What's happening"
          description="Everything the workshop has done, newest first."
        />
        <CardBody className="p-0">
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-(--text-soft)">Nothing recorded yet today.</p>
          ) : (
            <ul className="divide-y divide-(--border-soft)">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-[13px]">
                    <span className="font-medium">{entry.actor?.name ?? 'The system'}</span>{' '}
                    <span className="text-(--text-soft)">{entry.action.replace(/[._]/g, ' ')}</span>{' '}
                    <span className="text-(--text-faint)">{entry.entityType.toLowerCase()}</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-(--text-faint)">
                    {entry.createdAt.toLocaleTimeString('en-GB', {
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

      {approvals.length > 0 ? (
        <Card className="mb-6 border-(--warning)">
          <CardHeader
            title="Approvals needed"
            description="Nothing can proceed on these until the customer decides."
            action={
              <Link href="/jobs?status=AWAITING_APPROVAL">
                <Button size="sm">See all</Button>
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
                      {waitingHours !== null ? ` · waiting ${waitingHours}h` : ''}
                    </p>
                  </div>

                  {estimate ? (
                    <span className="font-display text-[16px] font-semibold tabular">
                      <Money amount={Number(estimate.total)} currency={estimate.currency} />
                    </span>
                  ) : null}

                  <Link href={`/jobs/${job.id}`}>
                    <Button size="sm" variant="primary">
                      Review
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Today in the workshop"
          description={`${todaysBookings.length} booking${todaysBookings.length === 1 ? '' : 's'} scheduled`}
          action={
            <Link href="/diary">
              <Button size="sm">Diary</Button>
            </Link>
          }
        />

        {todaysBookings.length === 0 ? (
          <EmptyState
            title="Nothing booked today"
            description="An empty diary is as much of a problem as a full one."
            action={
              <Link href="/diary">
                <Button variant="primary">Add a booking</Button>
              </Link>
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Vehicle</Th>
                  <Th>Customer</Th>
                  <Th>Work</Th>
                  <Th>Technician</Th>
                  <Th>Bay</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {todaysBookings.map((booking) => (
                  <Tr key={booking.id}>
                    <Td className="datum whitespace-nowrap">
                      {booking.startAt.toLocaleTimeString('en-GB', {
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
                        <span className="text-(--text-faint)">Unassigned</span>
                      )}
                    </Td>
                    <Td className="text-(--text-soft)">{booking.bay?.name ?? '—'}</Td>
                    <Td>
                      {booking.job ? (
                        <Link href={`/jobs/${booking.job.id}`}>
                          <Badge tone={toneFor(booking.job.status)} dot>
                            {humanise(booking.job.status)}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge tone="neutral" dot>
                          Booked
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
    </>
  );
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
