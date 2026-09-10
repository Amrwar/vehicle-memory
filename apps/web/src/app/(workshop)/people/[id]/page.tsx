import { explainCommission, toNumber } from '@carnet/core';
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
import { commissionFor, draftTimesheet, teamProductivity } from '@/lib/people';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { displayName: true },
  });

  return { title: employee?.displayName ?? 'Employee' };
}

/**
 * One person. FR-1602, FR-1603, FR-1605, FR-1606.
 *
 * The pay history is the part worth looking at. It is a list rather than a
 * field because a rise must not change what last year's jobs cost, and a
 * single editable number cannot express that.
 */
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId, plan } = await requireSession('people:read');

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
        <BackLink href="/people">Everyone</BackLink>
      </div>

      <PageHeader
        eyebrow={employee.reference}
        title={employee.displayName}
        description={[employee.jobTitle, employee.location?.name].filter(Boolean).join(' · ')}
        actions={
          <Badge tone={employee.isActive ? 'success' : 'neutral'}>
            {employee.isActive ? 'Active' : 'Left'}
          </Badge>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Utilisation"
          value={mine?.utilisationPct === null || !mine ? '—' : `${mine.utilisationPct}%`}
          note="Last 14 days"
        />
        <StatTile
          label="Efficiency"
          value={mine?.efficiencyPct === null || !mine ? '—' : `${mine.efficiencyPct}%`}
          note="Sold against clocked"
        />
        <StatTile
          label="Productivity"
          value={mine?.productivityPct === null || !mine ? '—' : `${mine.productivityPct}%`}
          tone={
            !mine || mine.productivityPct === null
              ? 'neutral'
              : mine.productivityPct >= 75
                ? 'success'
                : 'warning'
          }
          note="Sold against paid"
        />
        <StatTile
          label="Cost per hour"
          value={currentRate ? <Money amount={Number(currentRate.costPerHour)} /> : '—'}
          note={
            currentRate
              ? `Since ${currentRate.effectiveFrom.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
              : 'No rate set'
          }
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Pay history"
              description="A rate is closed and superseded, never edited"
            />
            {employee.payRates.length === 0 ? (
              <EmptyState
                title="No pay rate"
                description="Nothing this person works can be costed until a rate exists."
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>From</Th>
                      <Th>To</Th>
                      <Th numeric>Cost per hour</Th>
                      <Th numeric>Charge per hour</Th>
                      <Th numeric>Margin</Th>
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
                            {rate.effectiveFrom.toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Td>
                          <Td className="tabular text-(--text-soft)">
                            {rate.effectiveTo ? (
                              rate.effectiveTo.toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            ) : (
                              <Badge tone="brand" size="sm">
                                In force
                              </Badge>
                            )}
                          </Td>
                          <Td numeric>
                            <Money amount={cost} />
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            {charge > 0 ? <Money amount={charge} /> : '—'}
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
              Time worked last March is costed at March&rsquo;s rate. A rise does not travel
              backwards through jobs that have already been invoiced, which is what a single
              editable cost figure would have done, silently.
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="This week"
              description={`${periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to today, not yet submitted`}
            />
            <CardBody>
              <KeyValue
                items={[
                  {
                    label: 'Ordinary',
                    value: `${(timesheet.totals.ordinaryMinutes / 60).toFixed(1)}h`,
                  },
                  {
                    label: 'Overtime',
                    value: `${(timesheet.totals.overtimeMinutes / 60).toFixed(1)}h`,
                  },
                  {
                    label: 'Absence',
                    value: `${(timesheet.totals.absenceMinutes / 60).toFixed(1)}h`,
                  },
                  {
                    label: 'Ordinary pay',
                    value: <Money amount={toNumber(timesheet.totals.ordinaryPay)} />,
                  },
                  {
                    label: 'Overtime pay',
                    value: <Money amount={toNumber(timesheet.totals.overtimePay)} />,
                  },
                  {
                    label: 'Gross',
                    value: (
                      <Money amount={toNumber(timesheet.totals.gross)} className="font-medium" />
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
                title="Commission"
                description={`${commission.scheme.name} · last 14 days`}
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Basis</span>
                  <span>{humaniseBasis(commission.scheme.basis)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Basis total</span>
                  <Money amount={toNumber(commission.result.basisTotal)} />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-medium">
                  <span>Earned</span>
                  <Money amount={toNumber(commission.result.earned)} />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  {explainCommission(commission.result)}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Employment" />
            <CardBody>
              <KeyValue
                items={[
                  { label: 'Reference', value: employee.reference },
                  { label: 'Type', value: employee.employment.toLowerCase() },
                  {
                    label: 'Started',
                    value: employee.startedOn.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }),
                  },
                  {
                    label: 'Contracted',
                    value: `${(employee.weeklyMinutes / 60).toFixed(1)}h/week`,
                  },
                  { label: 'Holiday', value: `${Number(employee.holidayEntitlementDays)} days` },
                  { label: 'Account', value: employee.user?.email ?? 'No login' },
                ]}
                columns={1}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Qualifications" />
            {employee.certifications.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">None recorded.</CardBody>
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
                            {days < 0 ? 'Expired' : `${days}d`}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-(--text-faint)">
                        {[certification.authority, certification.reference]
                          .filter(Boolean)
                          .join(' · ') || 'No reference'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Timesheets" />
            {employee.timesheets.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">None yet.</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {employee.timesheets.map((sheet) => (
                  <li
                    key={sheet.id}
                    className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-[13px]">
                        {sheet.periodStart.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' – '}
                        {sheet.periodEnd.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-[11px] text-(--text-faint)">
                        {(sheet.ordinaryMinutes / 60).toFixed(1)}h
                        {sheet.overtimeMinutes > 0
                          ? ` + ${(sheet.overtimeMinutes / 60).toFixed(1)}h overtime`
                          : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money amount={Number(sheet.gross)} className="text-[13px]" />
                      <Badge
                        tone={sheet.status === 'PAID' ? 'success' : 'neutral'}
                        size="sm"
                        className="mt-0.5 block"
                      >
                        {sheet.status.toLowerCase()}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Absence" />
            {employee.absences.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">None booked.</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {employee.absences.map((absence) => (
                  <li
                    key={absence.id}
                    className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] capitalize">{absence.type.toLowerCase()}</p>
                      <p className="text-[11px] text-(--text-faint)">
                        {absence.startsOn.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' – '}
                        {absence.endsOn.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <span className="tabular text-[12px] text-(--text-soft)">
                      {Number(absence.days)}d
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

function humaniseBasis(basis: string): string {
  switch (basis) {
    case 'LABOUR_REVENUE':
      return 'Labour sold';
    case 'LABOUR_PROFIT':
      return 'Labour profit';
    case 'PARTS_PROFIT':
      return 'Parts margin';
    case 'JOB_PROFIT':
      return 'Whole job profit';
    case 'PER_JOB':
      return 'Per job completed';
    default:
      return basis;
  }
}
