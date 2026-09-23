import { IN_SHOP_STATUSES } from '@carnet/core';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
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

import { prisma } from '@carnet/db';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Reports') };
}
export const dynamic = 'force-dynamic';

/**
 * Operational reporting. FR-1403, FR-1407.
 *
 * Not financial reporting, which is Phase 3 and needs the ledger. What is here
 * is what a manager can act on this week: who is busy, which jobs are stuck,
 * and whether the passport is actually being fed.
 *
 * The coverage figure is the one nobody asks for and everybody needs. It is
 * the leading indicator for the entire product thesis: if completed jobs stop
 * producing passport entries, the differentiator quietly dies and nothing else
 * on this page would show it.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { db, orgId, region } = await requireSession('report:operational');
  const { days } = await searchParams;
  const t = await tFor();
  const window = Math.max(1, Number(days ?? 30) || 30);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (window - 1));

  const [jobs, technicians, timeEntries, completedJobs] = await Promise.all([
    db.job.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, status: true, createdAt: true, completedAt: true, receivedAt: true },
    }),
    db.membership.findMany({
      where: { role: 'TECHNICIAN', isActive: true },
      include: { user: { select: { id: true, name: true } } },
    }),
    // `TimeEntry` hangs off a job and carries no `orgId` of its own, so the
    // tenant extension has nothing to narrow it by: the job has to be named
    // here. Without it this read every workshop's clocked hours (Phase 64).
    db.timeEntry.findMany({
      where: { startedAt: { gte: since }, endedAt: { not: null }, job: { orgId } },
      select: { userId: true, minutes: true, jobId: true },
    }),
    db.job.findMany({
      where: { status: { in: ['COMPLETED', 'INVOICED', 'PAID'] }, completedAt: { gte: since } },
      select: { id: true, vehicleId: true, completedAt: true, estimatedHours: true },
    }),
  ]);

  // Passport coverage: of the jobs completed in this window, how many actually
  // wrote entries to their vehicle's history?
  const completedVehicleIds = [...new Set(completedJobs.map((job) => job.vehicleId))];
  const eventCounts = completedJobs.length
    ? await prisma.vehicleEvent.groupBy({
        by: ['vehicleId'],
        where: {
          vehicleId: { in: completedVehicleIds },
          recordedByOrgId: orgId,
          recordedAt: { gte: since },
        },
        _count: { _all: true },
      })
    : [];

  const eventsByVehicle = new Map(eventCounts.map((row) => [row.vehicleId, row._count._all]));
  const totalEvents = eventCounts.reduce((sum, row) => sum + row._count._all, 0);
  const jobsWithEvents = completedJobs.filter(
    (job) => (eventsByVehicle.get(job.vehicleId) ?? 0) > 0,
  ).length;

  const coveragePct = completedJobs.length
    ? Math.round((jobsWithEvents / completedJobs.length) * 100)
    : null;
  const eventsPerJob = completedJobs.length ? totalEvents / completedJobs.length : 0;

  // Technician workload.
  const byTechnician = technicians
    .map((membership) => {
      const entries = timeEntries.filter((entry) => entry.userId === membership.userId);
      const minutes = entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
      const jobIds = new Set(entries.map((entry) => entry.jobId));
      return {
        id: membership.userId,
        name: membership.user.name,
        hours: minutes / 60,
        jobs: jobIds.size,
        costRate: membership.costRate ? Number(membership.costRate) : null,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const totalHours = byTechnician.reduce((sum, row) => sum + row.hours, 0);

  // Jobs stuck waiting on somebody.
  const inShop = jobs.filter((job) => IN_SHOP_STATUSES.includes(job.status as never)).length;
  const awaiting = jobs.filter((job) => job.status === 'AWAITING_APPROVAL').length;

  // Median hours from arrival to completion, which is what a customer feels.
  const throughTimes = jobs
    .filter((job) => job.receivedAt && job.completedAt)
    .map((job) => (job.completedAt!.getTime() - job.receivedAt!.getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const medianThrough =
    throughTimes.length > 0 ? throughTimes[Math.floor(throughTimes.length / 2)]! : null;

  return (
    <>
      <PageHeader
        eyebrow={t('Reporting')}
        title={t('Operational reports')}
        description={t('Last {days} days', { days: window })}
        actions={
          <>
            {[7, 30, 90].map((option) => (
              <Link key={option} href={`/reports?days=${option}`}>
                <Button size="sm" variant={option === window ? 'primary' : 'secondary'}>
                  {t('{days}d', { days: option })}
                </Button>
              </Link>
            ))}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Jobs created')}
          value={jobs.length}
          note={t('In the last {days} days', { days: window })}
        />
        <StatTile
          label={t('Completed')}
          value={completedJobs.length}
          note={t('Reached completion')}
        />
        <StatTile label={t('In the shop')} value={inShop} note={t('Physically on site')} />
        <StatTile
          label={t('Awaiting approval')}
          value={awaiting}
          tone={awaiting > 0 ? 'warning' : 'neutral'}
          note={t('Blocked on the customer')}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Technicians')}
              description={t('Clocked time, not charged time. This is cost, not revenue.')}
            />
            {byTechnician.length === 0 ? (
              <EmptyState
                title={t('No technicians')}
                description={t('Add technicians in settings.')}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Technician')}</Th>
                      <Th numeric>{t('Hours clocked')}</Th>
                      <Th numeric>{t('Jobs')}</Th>
                      <Th numeric>{t('Hours per job')}</Th>
                      <Th numeric>{t('Labour cost')}</Th>
                      <Th>{t('Share of hours')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTechnician.map((row) => {
                      const share = totalHours > 0 ? (row.hours / totalHours) * 100 : 0;
                      return (
                        <Tr key={row.id}>
                          <Td className="font-medium">{row.name}</Td>
                          <Td numeric>{row.hours.toFixed(1)}</Td>
                          <Td numeric className="text-(--text-soft)">
                            {row.jobs}
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            {row.jobs > 0 ? (row.hours / row.jobs).toFixed(1) : '—'}
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            {row.costRate !== null ? (
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={row.hours * row.costRate}
                              />
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-(--surface-sunk)">
                                <div
                                  className="h-full rounded-full bg-(--brand)"
                                  style={{ width: `${Math.max(2, share)}%` }}
                                />
                              </div>
                              <span className="tabular text-[11px] text-(--text-faint)">
                                {share.toFixed(0)}%
                              </span>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('Flow')}
              description={t('How long a vehicle actually spends here')}
            />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="eyebrow mb-1">{t('Median time in the shop')}</p>
                <p className="font-display text-[24px] font-semibold tabular">
                  {medianThrough === null
                    ? '—'
                    : t('{hours} h', { hours: medianThrough.toFixed(1) })}
                </p>
                <p className="mt-1 text-[12px] text-(--text-faint)">
                  {throughTimes.length === 1
                    ? t('Arrival to completion, across 1 completed job.')
                    : t('Arrival to completion, across {count} completed jobs.', {
                        count: throughTimes.length,
                      })}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-1">{t('Completion rate')}</p>
                <p className="font-display text-[24px] font-semibold tabular">
                  {jobs.length ? Math.round((completedJobs.length / jobs.length) * 100) : 0}%
                </p>
                <p className="mt-1 text-[12px] text-(--text-faint)">
                  {t('Of jobs created in this window.')}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card
            className={
              coveragePct !== null && coveragePct < 60 ? 'border-(--danger)' : 'border-(--brand)'
            }
          >
            <CardHeader
              title={t('Passport coverage')}
              description={t('The leading indicator for the whole product')}
            />
            <CardBody className="grid gap-3">
              <div>
                <p className="eyebrow mb-1">{t('Completed jobs writing history')}</p>
                <p
                  className={`font-display text-[34px] font-semibold leading-none tabular ${
                    coveragePct !== null && coveragePct < 60
                      ? 'text-(--danger)'
                      : 'text-(--brand-text)'
                  }`}
                >
                  {coveragePct === null ? '—' : `${coveragePct}%`}
                </p>
              </div>

              <dl className="grid gap-1.5 border-t border-(--border) pt-3 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Entries written')}</dt>
                  <dd className="tabular">{totalEvents}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Per completed job')}</dt>
                  <dd className="tabular">{eventsPerJob.toFixed(1)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Vehicles touched')}</dt>
                  <dd className="tabular">{completedVehicleIds.length}</dd>
                </div>
              </dl>

              {coveragePct !== null && coveragePct < 60 ? (
                <p className="rounded-(--radius-sm) bg-(--danger-soft) px-2.5 py-2 text-[12px] leading-relaxed text-(--danger)">
                  {t(
                    'Below the 60% threshold. Jobs are completing without recording what was done, so those vehicles carry no history of this work. Usually it means inspections are being skipped on the shop floor.',
                  )}
                </p>
              ) : (
                <p className="text-[12px] leading-relaxed text-(--text-faint)">
                  {t(
                    'Every completed job should contribute at least three entries: the work, the parts, and the odometer reading.',
                  )}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('Not here yet')} />
            <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
              {t(
                'Revenue, gross profit and job profitability need the ledger, which arrives in Phase 3. Reporting figures that look financial but are not posted to accounts would be worse than absent.',
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
