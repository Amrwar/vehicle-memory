import { explainCommission, toNumber, type Translator } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
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
import { notFound } from 'next/navigation';

import { prisma } from '@carnet/db';

import { PlanWall } from '@/components/plan-wall';
import { BackLink } from '@/components/back-link';
import { planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { commissionFor, draftTimesheet, teamProductivity } from '@/lib/people';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await tFor();
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { displayName: true },
  });

  return { title: employee?.displayName ?? t('Employee') };
}

/**
 * One person. FR-1602, FR-1603, FR-1605, FR-1606.
 *
 * The pay history is the part worth looking at. It is a list rather than a
 * field because a rise must not change what last year's jobs cost, and a
 * single editable number cannot express that.
 */
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId, plan, region } = await requireSession('people:read');
  const t = await tFor();

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'payroll')) {
    return <PlanWall feature="payroll" plan={plan} />;
  }
  const { id } = await params;

  const employee = await prisma.employee.findFirst({
    where: { id, orgId },
    include: {
      location: { select: { name: true } },
      user: { select: { name: true, email: true } },
      payRates: { orderBy: { effectiveFrom: 'desc' } },
      certifications: { orderBy: { expiresOn: 'asc' } },
      absences: { orderBy: { startsOn: 'desc' }, take: 8 },
      timesheets: { orderBy: { periodStart: 'desc' }, take: 6 },
      commissionAwards: {
        orderBy: { periodStart: 'desc' },
        take: 4,
        include: { scheme: { select: { name: true, basis: true } } },
      },
    },
  });

  if (!employee) notFound();

  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 13);

  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - 6);

  const [team, timesheet, scheme] = await Promise.all([
    teamProductivity(orgId, { from, to }, employee.locationId),
    draftTimesheet(orgId, employee.id, { from: periodStart, to }),
    prisma.commissionScheme.findFirst({ where: { orgId, isActive: true } }),
  ]);

  const mine = team.people.find((person) => person.technicianId === employee.id);

  const commission =
    scheme && employee.userId
      ? await commissionFor(orgId, employee.id, scheme.id, { from, to })
      : null;

  const currentRate = employee.payRates.find((rate) => rate.effectiveTo === null);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/people">{t('Everyone')}</BackLink>
      </div>

      <PageHeader
        eyebrow={employee.reference}
        title={employee.displayName}
        description={[employee.jobTitle, employee.location?.name].filter(Boolean).join(' · ')}
        actions={
          <Badge tone={employee.isActive ? 'success' : 'neutral'}>
            {employee.isActive ? t('Active') : t('Left')}
          </Badge>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Utilisation')}
          value={mine?.utilisationPct === null || !mine ? '—' : `${mine.utilisationPct}%`}
          note={t('Last 14 days')}
        />
        <StatTile
          label={t('Efficiency')}
          value={mine?.efficiencyPct === null || !mine ? '—' : `${mine.efficiencyPct}%`}
          note={t('Sold against clocked')}
        />
        <StatTile
          label={t('Productivity')}
          value={mine?.productivityPct === null || !mine ? '—' : `${mine.productivityPct}%`}
          tone={
            !mine || mine.productivityPct === null
              ? 'neutral'
              : mine.productivityPct >= 75
                ? 'success'
                : 'warning'
          }
          note={t('Sold against paid')}
        />
        <StatTile
          label={t('Cost per hour')}
          value={
            currentRate ? (
              <Money
                currency={region.currency}
                locale={region.locale}
                amount={Number(currentRate.costPerHour)}
              />
            ) : (
              '—'
            )
          }
          note={
            currentRate
              ? t('Since {time}', {
                  time: currentRate.effectiveFrom.toLocaleDateString(region.locale, {
                    month: 'short',
                    year: 'numeric',
                  }),
                })
              : t('No rate set')
          }
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Pay history')}
              description={t('A rate is closed and superseded, never edited')}
            />
            {employee.payRates.length === 0 ? (
              <EmptyState
                title={t('No pay rate')}
                description={t('Nothing this person works can be costed until a rate exists.')}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('From')}</Th>
                      <Th>{t('To')}</Th>
                      <Th numeric>{t('Cost per hour')}</Th>
                      <Th numeric>{t('Charge per hour')}</Th>
                      <Th numeric>{t('Margin')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.payRates.map((rate) => {
                      const cost = Number(rate.costPerHour);
                      const charge = Number(rate.chargePerHour);
                      const margin = charge > 0 ? ((charge - cost) / charge) * 100 : null;

                      return (
                        <Tr key={rate.id}>
                          <Td className="tabular">
                            {rate.effectiveFrom.toLocaleDateString(region.locale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Td>
                          <Td className="tabular text-(--text-soft)">
                            {rate.effectiveTo ? (
                              rate.effectiveTo.toLocaleDateString(region.locale, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            ) : (
                              <Badge tone="brand" size="sm">
                                {t('In force')}
                              </Badge>
                            )}
                          </Td>
                          <Td numeric>
                            <Money
                              currency={region.currency}
                              locale={region.locale}
                              amount={cost}
                            />
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            {charge > 0 ? (
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={charge}
                              />
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            {margin === null ? '—' : `${margin.toFixed(0)}%`}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Time worked last March is costed at March’s rate. A rise does not travel backwards through jobs that have already been invoiced, which is what a single editable cost figure would have done, silently.',
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('This week')}
              description={t('{date} to today, not yet submitted', {
                date: periodStart.toLocaleDateString(region.locale, {
                  day: 'numeric',
                  month: 'short',
                }),
              })}
            />
            <CardBody>
              <KeyValue
                t={t}
                items={[
                  {
                    label: t('Ordinary'),
                    value: t('{hours}h', {
                      hours: (timesheet.totals.ordinaryMinutes / 60).toFixed(1),
                    }),
                  },
                  {
                    label: t('Overtime'),
                    value: t('{hours}h', {
                      hours: (timesheet.totals.overtimeMinutes / 60).toFixed(1),
                    }),
                  },
                  {
                    label: t('Absence'),
                    value: t('{hours}h', {
                      hours: (timesheet.totals.absenceMinutes / 60).toFixed(1),
                    }),
                  },
                  {
                    label: t('Ordinary pay'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(timesheet.totals.ordinaryPay)}
                      />
                    ),
                  },
                  {
                    label: t('Overtime pay'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(timesheet.totals.overtimePay)}
                      />
                    ),
                  },
                  {
                    label: t('Gross'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(timesheet.totals.gross)}
                        className="font-medium"
                      />
                    ),
                  },
                ]}
                columns={3}
              />
            </CardBody>
          </Card>

          {commission ? (
            <Card>
              <CardHeader
                title={t('Commission')}
                description={`${commission.scheme.name} · ${t('last 14 days')}`}
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">{t('Basis')}</span>
                  <span>{humaniseBasis(commission.scheme.basis, t)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">{t('Basis total')}</span>
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={toNumber(commission.result.basisTotal)}
                  />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-medium">
                  <span>{t('Earned')}</span>
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={toNumber(commission.result.earned)}
                  />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  {t(explainCommission(commission.result))}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title={t('Employment')} />
            <CardBody>
              <KeyValue
                t={t}
                items={[
                  { label: t('Reference'), value: employee.reference },
                  { label: t('Type'), value: t(employee.employment.toLowerCase()) },
                  {
                    label: t('Joined'),
                    value: employee.startedOn.toLocaleDateString(region.locale, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }),
                  },
                  {
                    label: t('Contracted'),
                    value: t('{hours}h/week', { hours: (employee.weeklyMinutes / 60).toFixed(1) }),
                  },
                  {
                    label: t('Holiday'),
                    value: t('{days} days', { days: Number(employee.holidayEntitlementDays) }),
                  },
                  { label: t('Account'), value: employee.user?.email ?? t('No login') },
                ]}
                columns={1}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('Qualifications')} />
            {employee.certifications.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">{t('None recorded.')}</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {employee.certifications.map((certification) => {
                  const days = certification.expiresOn
                    ? Math.ceil((certification.expiresOn.getTime() - Date.now()) / 86_400_000)
                    : null;

                  return (
                    <li key={certification.id} className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-medium">{certification.name}</p>
                        {days !== null ? (
                          <Badge
                            tone={days < 0 ? 'danger' : days < 60 ? 'warning' : 'neutral'}
                            size="sm"
                          >
                            {days < 0 ? t('Expired') : t('{days}d', { days })}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-(--text-faint)">
                        {[certification.authority, certification.reference]
                          .filter(Boolean)
                          .join(' · ') || t('No reference')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Timesheets')} />
            {employee.timesheets.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">{t('None yet.')}</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {employee.timesheets.map((sheet) => (
                  <li
                    key={sheet.id}
                    className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-[13px]">
                        {sheet.periodStart.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' – '}
                        {sheet.periodEnd.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-[11px] text-(--text-faint)">
                        {t('{hours}h', { hours: (sheet.ordinaryMinutes / 60).toFixed(1) })}
                        {sheet.overtimeMinutes > 0
                          ? ` + ${t('{hours}h overtime', { hours: (sheet.overtimeMinutes / 60).toFixed(1) })}`
                          : ''}
                      </p>
                    </div>
                    <div className="text-end">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(sheet.gross)}
                        className="text-[13px]"
                      />
                      <Badge
                        tone={sheet.status === 'PAID' ? 'success' : 'neutral'}
                        size="sm"
                        className="mt-0.5 block"
                      >
                        {t(sheet.status.toLowerCase())}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Absence')} />
            {employee.absences.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">{t('None booked.')}</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {employee.absences.map((absence) => (
                  <li
                    key={absence.id}
                    className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] capitalize">{t(absence.type.toLowerCase())}</p>
                      <p className="text-[11px] text-(--text-faint)">
                        {absence.startsOn.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' – '}
                        {absence.endsOn.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <span className="tabular text-[12px] text-(--text-soft)">
                      {t('{days}d', { days: Number(absence.days) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function humaniseBasis(basis: string, t: Translator): string {
  switch (basis) {
    case 'LABOUR_REVENUE':
      return t('Labour sold');
    case 'LABOUR_PROFIT':
      return t('Labour profit');
    case 'PARTS_PROFIT':
      return t('Parts margin');
    case 'JOB_PROFIT':
      return t('Whole job profit');
    case 'PER_JOB':
      return t('Per job completed');
    default:
      return basis;
  }
}
