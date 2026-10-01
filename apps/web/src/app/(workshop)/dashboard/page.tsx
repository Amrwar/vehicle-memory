import { describeFollowUp, hoursOf, humanise, standingOf, toneFor } from '@carnet/core';
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

import { JobStandingBand } from '@/components/job-standing';
import { KeepsCurrent } from '@/components/keeps-current';
import { VerifyBanner } from '@/components/verify-banner';
import { revenueObservations } from '@/lib/answers';
import { theTower } from '@/lib/control-tower';
import { followUpsDue } from '@/lib/followups';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { ownerDay } from '@/lib/owner';
import { setupFor } from '@/lib/onboarding';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Dashboard') };
}
export const dynamic = 'force-dynamic';

/** How often the page re-reads itself while somebody is looking. */
const EVERY_MINUTES = 5;

/**
 * The control tower. Phase 98, and item 39 of the thirty-nine: "the screen an
 * owner leaves open all day."
 *
 * Action-oriented, not a wall of charts (persona P1). Ahmed opens this at
 * 7:40am and leaves it open until six, and what he needs from it changes by
 * the hour: at eight, who is in and what is booked; at eleven, which estimate
 * nobody has answered; at three, which part is late for the car on ramp two;
 * at five, which finished car is still here and not paid for.
 *
 * Six bands, in the order a tower answers them: what is at risk before the
 * doors shut, then what is in the building and what blocks each of it, then
 * what today can hold, then who is waiting on us, then the money, then the
 * parts holding up cars already on the ramps. Every figure links to the
 * records behind it (FR-1402).
 *
 * Nothing on this page is stored or newly computed. The building is the same
 * function the `/now` board and every job's own band read, so the tower cannot
 * disagree with the job. Capacity is the planner's. The rota is opening-up's.
 * The morning's list is `/morning`'s. The page re-reads itself every five
 * minutes while it is visible, and says when it last did.
 *
 * Phase 40 arranged the earlier dashboard in the order an owner runs the
 * business in; this keeps that order inside each band and the business and
 * inventory blocks it added, and puts the building first because that is what
 * a tower is for.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const notice = await searchParams;
  const { db, user, orgId, region } = await requireSession('job:read');
  const t = await tFor();

  // What is left to set up, read from the workshop's own data. It disappears
  // by itself when there is nothing left, and can be put away before that.
  // Phase 45.
  const setup = await setupFor(orgId);

  const seesBusiness = can(user.role, 'report:operational');
  const seesInventory = can(user.role, 'inventory:read');

  const now = new Date();

  // The tower first, because its window -- the workshop's own day, on its own
  // clock -- is what "today" means for everything else on the page. The old
  // page took midnight from the server, which is three hours out in Riyadh.
  const tower = await theTower(orgId, user.locationId, region.timezone, now);

  const [todaysBookings, approvals, activity, observations, day, chasing] = await Promise.all([
    db.booking.findMany({
      where: { startAt: { gte: tower.window.from, lt: tower.window.to } },
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
    // Late, or due today. Everything further out lives on the job it belongs
    // to, where somebody sees it when they are looking at that car.
    followUpsDue(orgId, { limit: 8 }),
  ]);

  // The workshop's hour, not the server's: "good afternoon" at seven in the
  // evening was the first thing the design shot showed.
  const hour =
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: region.timezone,
        hour: 'numeric',
        hour12: false,
      }).format(now),
    ) % 24;
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
  const clock = (at: Date) =>
    at.toLocaleTimeString(region.locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: region.timezone,
    });
  const hoursAndMinutes = (minutes: number) =>
    minutes >= 60
      ? t('{hours}h {minutes}m', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : t('{minutes}m', { minutes });

  const { building, day: today, customers, parts, risk } = tower;

  const section = (title: string) => (
    <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-(--text-faint)">
      {title}
    </h2>
  );

  return (
    <>
      <KeepsCurrent everyMinutes={EVERY_MINUTES} />
      <VerifyBanner sent={notice.verification === 'sent'} />

      <PageHeader
        eyebrow={now.toLocaleDateString(region.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        title={greeting}
        description={
          <>
            {t(tower.headline.key, tower.headline.vars)}{' '}
            <span className="text-(--text-faint)">
              {t('As of {time}; this screen reads itself again every {minutes} minutes.', {
                time: clock(tower.asOf),
                minutes: EVERY_MINUTES,
              })}
            </span>
          </>
        }
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

      {setup.showOnDashboard ? (
        <Card className="mb-5 border-(--brand)">
          <CardHeader
            title={t('Getting started')}
            description={t(setup.summary)}
            action={
              <Link href="/start">
                <Button size="sm" variant="secondary">
                  {t('The setup list')}
                </Button>
              </Link>
            }
          />
          {setup.next ? (
            <CardBody className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="font-medium">{t(setup.next.title)}</span>
              <span className="text-(--text-soft)">{t(setup.next.why)}</span>
              <Link href={setup.next.href} className="ms-auto">
                <Button size="sm">{t('Do it')}</Button>
              </Link>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      {/* ---------------- at risk before closing ---------------- */}
      <Card
        id="risk"
        className={`mb-6 ${
          risk.some((one) => one.tone === 'danger')
            ? 'border-(--danger)'
            : risk.length > 0
              ? 'border-(--warning)'
              : ''
        }`}
      >
        <CardHeader
          title={t('Before the doors shut')}
          description={t(
            'What will have cost the workshop something by closing time if nobody looks. The one already costing comes first.',
          )}
          action={
            <Link href="/morning">
              <Button size="sm">{t('The morning’s list')}</Button>
            </Link>
          }
        />
        {risk.length === 0 ? (
          <CardBody>
            <p className="text-[14px] text-(--success)">{t('Nothing is at risk today.')}</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-(--border)">
            {risk.map((one) => (
              <li key={one.kind}>
                <Link
                  href={one.href}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-(--surface-sunken)"
                >
                  <Badge tone={one.tone} size="sm" dot>
                    {one.tone === 'danger' ? t('Costing you now') : t('Will by tonight')}
                  </Badge>
                  <span className="min-w-0 flex-1">{t(one.what.key, one.what.vars)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- in the building ---------------- */}
      {section(t('In the building'))}
      <StatRow className="mb-3">
        <Link href="/jobs?status=in-shop" className="group">
          <StatTile
            label={t('Vehicles in shop')}
            value={building.inShop}
            note={t('Physically on site')}
          />
        </Link>
        <Link href="/now" className="group">
          <StatTile
            label={t('Ours to move')}
            value={building.ours}
            tone={building.ours > 0 ? 'brand' : 'neutral'}
            note={t('Nothing is stopping these but us')}
          />
        </Link>
        <Link href="/now" className="group">
          <StatTile
            label={t('Waiting on a customer')}
            value={building.customer}
            tone={building.customer > 0 ? 'warning' : 'neutral'}
            note={t('A decision we cannot make for them')}
          />
        </Link>
        <Link href="/now" className="group">
          <StatTile
            label={t('Waiting on a supplier')}
            value={building.supplier}
            tone={building.supplier > 0 ? 'warning' : 'neutral'}
            note={t('A part that is not here yet')}
          />
        </Link>
        <Link href="/now" className="group">
          <StatTile
            label={t('Past the promise')}
            value={building.late}
            tone={building.late > 0 ? 'danger' : 'neutral'}
            note={t('Due back and not finished')}
          />
        </Link>
      </StatRow>

      <Card className="mb-6">
        <CardHeader
          title={t('What blocks each of them')}
          description={t(
            'Every car in the building that somebody is waiting on, hardest first, with the one thing that moves it.',
          )}
          action={
            <Link href="/now">
              <Button size="sm">{t('The whole board')}</Button>
            </Link>
          }
        />
        {building.inShop === 0 ? (
          <EmptyState
            title={t('Nothing in the building')}
            description={t('Every car has been collected, or none has arrived yet.')}
          />
        ) : building.blocked.length === 0 ? (
          <CardBody>
            <p className="text-[14px] text-(--text-soft)">
              {t('Nothing in the building is waiting on anybody.')}
            </p>
          </CardBody>
        ) : (
          <CardBody className="grid gap-2">
            {building.blocked.map((job) => (
              <div key={job.id} className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-(--brand-text) hover:underline"
                  >
                    #{job.number}
                  </Link>
                  {job.registration ? <Registration value={job.registration} /> : null}
                  <span className="min-w-0 truncate">{job.vehicle}</span>
                  {job.who ? (
                    <span className="truncate text-(--text-faint)">· {job.who}</span>
                  ) : null}
                  <Badge tone="neutral">{job.what}</Badge>
                </div>
                <JobStandingBand
                  href={`/jobs/${job.id}`}
                  standing={job.standing}
                  currency={region.currency}
                  locale={region.locale}
                />
              </div>
            ))}
            {building.more > 0 ? (
              <Link href="/now" className="text-[13px] text-(--brand-text) hover:underline">
                {building.more === 1
                  ? t('And 1 more on the board')
                  : t('And {count} more on the board', { count: building.more })}
              </Link>
            ) : null}
          </CardBody>
        )}
      </Card>

      {/* ---------------- today ---------------- */}
      {section(t('Today'))}
      <StatRow className="mb-3">
        <Link href="/capacity" className="group">
          <StatTile
            label={t('Hours promised')}
            value={t('{booked}h of {available}h', {
              booked: hoursOf(today.bookedMinutes),
              available: hoursOf(today.effectiveMinutes),
            })}
            tone={
              today.overbookedMinutes > 0
                ? 'danger'
                : today.bookedMinutes >= today.effectiveMinutes * 0.9
                  ? 'warning'
                  : 'neutral'
            }
            note={
              today.overbookedMinutes > 0
                ? t('{hours}h more than the building can do', {
                    hours: hoursOf(today.overbookedMinutes),
                  })
                : today.constrainedBy === 'BAYS'
                  ? t('The bays are the limit today')
                  : today.constrainedBy === 'PEOPLE'
                    ? t('The people are the limit today')
                    : t('Room to spare')
            }
          />
        </Link>
        <Link href="/opening" className="group">
          <StatTile
            label={t('In today')}
            value={t('{here} of {expected}', { here: today.here, expected: today.expected })}
            tone={today.notIn.length > 0 ? 'warning' : 'neutral'}
            note={
              today.notIn.length === 0
                ? t('Everybody expected has clocked on')
                : t('Not yet in: {names}', { names: today.notIn.join(', ') })
            }
          />
        </Link>
        <Link href="/diary" className="group">
          <StatTile
            label={t('Booked today')}
            value={today.booked}
            note={
              today.nextAt
                ? t('Next at {time}', { time: clock(today.nextAt) })
                : t('Nothing more due in today')
            }
          />
        </Link>
        <Link href="/diary" className="group">
          <StatTile
            label={t('Not arrived')}
            value={today.notArrived.length}
            tone={today.notArrived.length > 0 ? 'warning' : 'neutral'}
            note={t('Booked for earlier today and not received')}
          />
        </Link>
      </StatRow>

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
                {todaysBookings.map((booking) => {
                  const missed = today.notArrived.some((one) => one.id === booking.id);
                  return (
                    <Tr key={booking.id}>
                      <Td className="datum whitespace-nowrap">{clock(booking.startAt)}</Td>
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
                        ) : missed ? (
                          <Badge tone="warning" dot>
                            {t('Not arrived')}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            {t('Booked')}
                          </Badge>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* ---------------- the customers waiting ---------------- */}
      {section(t('Customers waiting'))}
      <StatRow className="mb-3">
        <Link href="/jobs?status=AWAITING_APPROVAL" className="group">
          <StatTile
            label={t('Deciding on an estimate')}
            value={customers.deciding}
            tone={customers.deciding > 0 ? 'warning' : 'neutral'}
            note={
              customers.decidingLongestMinutes === null
                ? t('Nothing waiting')
                : t('The longest for {time}', {
                    time: hoursAndMinutes(customers.decidingLongestMinutes),
                  })
            }
          />
        </Link>
        <Link href="/inbox" className="group">
          <StatTile
            label={t('Waiting for a reply')}
            value={customers.unanswered}
            tone={
              customers.unansweredLongestMinutes !== null &&
              customers.unansweredLongestMinutes >= 120
                ? 'danger'
                : customers.unanswered > 0
                  ? 'warning'
                  : 'neutral'
            }
            note={
              customers.unansweredLongestMinutes === null
                ? t('Every message has been answered')
                : t('The longest for {time}', {
                    time: hoursAndMinutes(customers.unansweredLongestMinutes),
                  })
            }
          />
        </Link>
        <Link href="/jobs?status=COMPLETED" className="group">
          <StatTile
            label={t('Ready to collect')}
            value={customers.readyToCollect}
            tone={customers.readyAndUnpaid > 0 ? 'warning' : 'neutral'}
            note={
              customers.readyAndUnpaid === 0
                ? t('Finished, and paid for')
                : customers.readyAndUnpaid === 1
                  ? t('1 not yet paid for')
                  : t('{count} not yet paid for', { count: customers.readyAndUnpaid })
            }
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
                ? Math.floor((now.getTime() - estimate.sentAt.getTime()) / 3_600_000)
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
      ) : (
        <div className="mb-3" />
      )}

      {/* ---------------- the money ---------------- */}
      {seesBusiness ? (
        <>
          {section(t('The money'))}
          <StatRow className="mb-3">
            <Link href="/payments" className="group">
              <StatTile
                label={t('Taken today')}
                value={money(tower.money.takenToday)}
                tone={tower.money.takenToday > 0 ? 'success' : 'neutral'}
                note={t('Payments received')}
              />
            </Link>
            <Link href="/jobs?status=COMPLETED" className="group">
              <StatTile
                label={t('To invoice')}
                value={money(tower.money.toInvoice)}
                tone={tower.money.toInvoiceCount > 0 ? 'warning' : 'neutral'}
                note={
                  tower.money.toInvoiceCount === 0
                    ? t('Every finished job is billed')
                    : tower.money.toInvoiceCount === 1
                      ? t('1 finished job with no bill raised')
                      : t('{count} finished jobs with no bill raised', {
                          count: tower.money.toInvoiceCount,
                        })
                }
              />
            </Link>
            <Link href="/payments" className="group">
              <StatTile
                label={t('Owed to you')}
                value={money(tower.money.owed)}
                note={t('Issued and not yet paid')}
              />
            </Link>
            <Link href="/financials" className="group">
              <StatTile
                label={t('Overdue')}
                value={money(tower.money.overdue)}
                tone={tower.money.overdue > 0 ? 'danger' : 'neutral'}
                note={
                  tower.money.overdueCount === 0
                    ? t('Nothing past its due date')
                    : tower.money.overdueCount === 1
                      ? t('1 invoice past its due date')
                      : t('{count} invoices past their due date', {
                          count: tower.money.overdueCount,
                        })
                }
              />
            </Link>
          </StatRow>

          {day ? (
            <StatRow className="mb-3">
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
          ) : null}

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

      {/* ---------------- parts in the way ---------------- */}
      {seesInventory && day ? (
        <>
          {section(t('Parts'))}
          <Card id="parts" className="mb-3">
            <CardHeader
              title={t('Parts holding up cars in the building')}
              description={t(
                'Every part on order for a car already on the ramps, with the day the supplier promised. Late first.',
              )}
              action={
                <Link href="/purchasing">
                  <Button size="sm">{t('Purchasing')}</Button>
                </Link>
              }
            />
            {parts.length === 0 ? (
              <CardBody>
                <p className="text-[14px] text-(--text-soft)">
                  {t('No car in the building is waiting on a part.')}
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {parts.map((part) => (
                  <li
                    key={`${part.jobId}:${part.part}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
                  >
                    <Badge
                      tone={
                        part.standing === 'LATE'
                          ? 'danger'
                          : part.standing === 'NOT_ORDERED'
                            ? 'danger'
                            : part.standing === 'TODAY'
                              ? 'warning'
                              : 'neutral'
                      }
                      size="sm"
                      dot
                    >
                      {part.standing === 'LATE'
                        ? t('Late')
                        : part.standing === 'NOT_ORDERED'
                          ? t('No order found')
                          : part.standing === 'TODAY'
                            ? t('Due today')
                            : t('Due later')}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{part.part}</span>
                    <Link href={`/jobs/${part.jobId}`} className="flex items-center gap-1.5">
                      <span className="datum text-(--text-faint)">#{part.number}</span>
                      {part.registration ? <Registration value={part.registration} /> : null}
                      <span className="text-(--text-soft)">{part.vehicle}</span>
                    </Link>
                    <span className="text-[12px] text-(--text-faint)">
                      {part.orderId ? (
                        <Link href={`/purchasing/${part.orderId}`} className="hover:underline">
                          {part.expectedAt
                            ? t('{supplier}, promised {date}', {
                                supplier: part.supplier ?? '',
                                date: part.expectedAt.toLocaleDateString(region.locale, {
                                  day: 'numeric',
                                  month: 'short',
                                  timeZone: region.timezone,
                                }),
                              })
                            : t('{supplier}, no date promised', { supplier: part.supplier ?? '' })}
                        </Link>
                      ) : (
                        t('Marked on order, and no open order has it')
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

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
            <Link href="#chasing" className="group">
              <StatTile
                label={t('To chase')}
                value={chasing.length}
                tone={
                  chasing.some((one) => standingOf(one) === 'OVERDUE')
                    ? 'danger'
                    : chasing.length > 0
                      ? 'warning'
                      : 'neutral'
                }
                note={t('Late, or due today')}
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

          {/* The whole point of a follow-up is that somebody does it. A flag
              on a job nobody opens again is a note in a drawer, so what is
              late or due today is listed here, where the day starts. Phase 66. */}
          {chasing.length > 0 ? (
            <Card id="chasing" className="mb-3 border-(--warning)">
              <CardHeader
                title={t('To chase')}
                description={t('Work that was put off until later, and later is now.')}
              />
              <CardBody className="grid gap-2 text-[13px]">
                {chasing.map((one) => (
                  <Link
                    key={one.id}
                    href={`/jobs/${one.job.id}#followup`}
                    className="flex flex-wrap items-center gap-2 rounded-(--radius-sm) px-1 py-1 hover:bg-(--surface-sunken)"
                  >
                    <Badge tone={standingOf(one) === 'OVERDUE' ? 'danger' : 'warning'} size="sm">
                      {t(describeFollowUp(one))}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{one.note}</span>
                    <span className="text-[12px] text-(--text-faint)">
                      {one.job.registration
                        ? `${one.job.registration} · #${one.job.number}`
                        : `#${one.job.number}`}
                      {one.assignedTo ? ` · ${one.assignedTo.name}` : ''}
                    </span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}

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
                    {clock(entry.createdAt)}
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
