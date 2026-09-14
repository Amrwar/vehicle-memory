import { toNumber } from '@carnet/core';
import {
  Badge,
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

import { PlanWall } from '@/components/plan-wall';
import { planIncludes, requireSession } from '@/lib/guard';
import { expiringCertifications, onSiteNow, teamProductivity } from '@/lib/people';

export const metadata: Metadata = { title: 'People' };
export const dynamic = 'force-dynamic';

/**
 * The team. FR-1601, FR-1604, FR-1607.
 *
 * Three hours per person and the two ratios between them. Utilisation is how
 * much of the paid day reached a vehicle; efficiency is how the work compared
 * with the time it was quoted at; productivity is what the two produce
 * together, and it is the only one that pays wages.
 *
 * All three are shown because showing efficiency alone is the standard way to
 * make an unprofitable workshop look well run.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; site?: string }>;
}) {
  const { orgId, plan, region } = await requireSession('people:read');

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'payroll')) {
    return <PlanWall feature="payroll" plan={plan} />;
  }
  const { days, site } = await searchParams;
  const window = Math.max(1, Number(days ?? 14) || 14);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (window - 1));
  const to = new Date();

  const locations = await prisma.location.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const siteFilter = site && locations.some((location) => location.id === site) ? site : null;

  const [team, certifications, onSite, employees] = await Promise.all([
    teamProductivity(orgId, { from, to }, siteFilter),
    expiringCertifications(orgId),
    onSiteNow(orgId, siteFilter),
    prisma.employee.findMany({
      where: { orgId, isActive: true, ...(siteFilter ? { locationId: siteFilter } : {}) },
      include: {
        location: { select: { name: true } },
        payRates: { where: { effectiveTo: null }, take: 1 },
      },
      orderBy: { displayName: 'asc' },
    }),
  ]);

  const expired = certifications.filter((certification) => certification.expired);
  const totals = team.totals;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Team"
        description={`Last ${window} days${siteFilter ? ` · ${locations.find((l) => l.id === siteFilter)?.name}` : ''}`}
        actions={
          <>
            {locations.length > 1 ? (
              <>
                <Link href={`/people?days=${window}`}>
                  <Button size="sm" variant={siteFilter ? 'secondary' : 'primary'}>
                    All sites
                  </Button>
                </Link>
                {locations.map((location) => (
                  <Link key={location.id} href={`/people?days=${window}&site=${location.id}`}>
                    <Button
                      size="sm"
                      variant={siteFilter === location.id ? 'primary' : 'secondary'}
                    >
                      {location.name.split(' ')[0]}
                    </Button>
                  </Link>
                ))}
              </>
            ) : null}
            {[7, 14, 30].map((option) => (
              <Link
                key={option}
                href={`/people?days=${option}${siteFilter ? `&site=${siteFilter}` : ''}`}
              >
                <Button size="sm" variant={option === window ? 'accent' : 'ghost'}>
                  {option}d
                </Button>
              </Link>
            ))}
          </>
        }
      />

      {expired.length > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {expired.length} qualification{expired.length === 1 ? ' has' : 's have'} expired.
            </strong>{' '}
            {expired.map((certification) => certification.employee.displayName).join(', ')} cannot
            legally sign off work covered by{' '}
            {expired.map((certification) => certification.name).join(', ')}. This is not a reminder,
            it is work that has to stop.
          </CardBody>
        </Card>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label="Utilisation"
          value={totals.utilisationPct === null ? '—' : `${totals.utilisationPct}%`}
          note="Paid time that reached a vehicle"
        />
        <StatTile
          label="Efficiency"
          value={totals.efficiencyPct === null ? '—' : `${totals.efficiencyPct}%`}
          note="Sold against clocked"
        />
        <StatTile
          label="Productivity"
          value={totals.productivityPct === null ? '—' : `${totals.productivityPct}%`}
          tone={
            totals.productivityPct === null
              ? 'neutral'
              : totals.productivityPct >= 75
                ? 'success'
                : 'warning'
          }
          note="Sold against paid. This one pays wages."
        />
        <StatTile
          label="Labour profit"
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={toNumber(totals.labourProfit)}
            />
          }
          tone={totals.labourProfit.minor >= 0 ? 'neutral' : 'danger'}
          note="Sold labour less the whole attended day"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Productivity"
              description="Three measures of the same day. The gaps between them are the finding."
            />
            {team.people.length === 0 ? (
              <EmptyState
                title="Nobody on the books yet"
                description="Add employees to see how the workshop's paid hours are spent."
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Person</Th>
                      <Th numeric>Attended</Th>
                      <Th numeric>Clocked</Th>
                      <Th numeric>Sold</Th>
                      <Th numeric>Util.</Th>
                      <Th numeric>Effic.</Th>
                      <Th numeric>Prod.</Th>
                      <Th numeric>Labour profit</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.people.map((person) => (
                      <Tr key={person.technicianId}>
                        <Td className="font-medium">
                          <Link
                            href={`/people/${person.technicianId}`}
                            className="hover:text-(--brand-text) hover:underline"
                          >
                            {person.technicianName}
                          </Link>
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {person.attendedHours}h
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {person.productiveHours}h
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {person.soldHours}h
                        </Td>
                        <Td numeric>{pct(person.utilisationPct)}</Td>
                        <Td numeric>{pct(person.efficiencyPct)}</Td>
                        <Td numeric>
                          <span
                            className={
                              person.productivityPct !== null && person.productivityPct < 60
                                ? 'font-medium text-(--warning)'
                                : 'font-medium'
                            }
                          >
                            {pct(person.productivityPct)}
                          </span>
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(person.labourProfit)}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-(--border-strong) bg-(--surface-sunk)">
                      <Td className="font-semibold">Team</Td>
                      <Td numeric className="font-medium">
                        {totals.attendedHours}h
                      </Td>
                      <Td numeric className="font-medium">
                        {totals.productiveHours}h
                      </Td>
                      <Td numeric className="font-medium">
                        {totals.soldHours}h
                      </Td>
                      <Td numeric className="font-medium">
                        {pct(totals.utilisationPct)}
                      </Td>
                      <Td numeric className="font-medium">
                        {pct(totals.efficiencyPct)}
                      </Td>
                      <Td numeric className="font-semibold">
                        {pct(totals.productivityPct)}
                      </Td>
                      <Td numeric className="font-semibold">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(totals.labourProfit)}
                        />
                      </Td>
                    </tr>
                  </tfoot>
                </Table>
              </TableWrap>
            )}
          </Card>

          {team.suspect.length > 0 ? (
            <Card className="border-(--warning)">
              <CardHeader
                title="Records that cannot be right"
                description="More job time clocked than attendance recorded"
              />
              <CardBody className="grid gap-2 text-[13px]">
                {team.suspect.map((person) => (
                  <p key={person.technicianId} className="text-(--text-soft)">
                    <span className="font-medium text-(--text)">{person.technicianName}</span>{' '}
                    clocked {person.productiveHours}h onto jobs but attended {person.attendedHours}
                    h. Somebody forgot to clock out of a shift, or onto one.
                  </p>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  These are left in the figures above rather than removed. Averaging them away would
                  make every other number on this page slightly wrong and give no clue why.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader title="Employees" description="Pay, site and contracted hours" />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Site</Th>
                    <Th numeric>Contracted</Th>
                    <Th numeric>Cost per hour</Th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <Tr key={employee.id}>
                      <Td className="font-medium">
                        <Link
                          href={`/people/${employee.id}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {employee.displayName}
                        </Link>
                      </Td>
                      <Td className="text-(--text-soft)">{employee.jobTitle ?? '—'}</Td>
                      <Td className="text-(--text-soft)">{employee.location?.name ?? 'Group'}</Td>
                      <Td numeric className="text-(--text-soft)">
                        {(employee.weeklyMinutes / 60).toFixed(1)}h
                      </Td>
                      <Td numeric>
                        {employee.payRates[0] ? (
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={Number(employee.payRates[0].costPerHour)}
                          />
                        ) : (
                          <span className="text-(--danger)">No rate set</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="On site now" description="Open shifts" />
            {onSite.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">Nobody is clocked in.</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {onSite.map((record) => {
                  const hours = (Date.now() - record.startedAt.getTime()) / 3_600_000;

                  return (
                    <li
                      key={record.id}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {record.employee.displayName}
                        </p>
                        <p className="text-[11px] text-(--text-faint)">
                          Since{' '}
                          {record.startedAt.toLocaleTimeString(region.locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {record.location ? ` · ${record.location.name}` : ''}
                        </p>
                      </div>
                      <span
                        className={`tabular shrink-0 text-[12px] ${hours > 16 ? 'font-medium text-(--warning)' : 'text-(--text-soft)'}`}
                      >
                        {hours.toFixed(1)}h
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className={certifications.length > 0 ? 'border-(--warning)' : undefined}>
            <CardHeader title="Qualifications" description="Expired, or expiring within 60 days" />
            {certifications.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                Nothing lapses in the next two months.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {certifications.map((certification) => (
                  <li key={certification.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium">{certification.name}</p>
                      <Badge tone={certification.expired ? 'danger' : 'warning'} size="sm">
                        {certification.expired
                          ? `${Math.abs(certification.daysRemaining)}d ago`
                          : `${certification.daysRemaining}d`}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-(--text-faint)">
                      {certification.employee.displayName}
                      {certification.authority ? ` · ${certification.authority}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="How to read this" />
            <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                <span className="font-medium text-(--text)">Utilisation</span> falls when people are
                waiting: for parts, for a decision, for a bay. It is a scheduling problem.
              </p>
              <p>
                <span className="font-medium text-(--text)">Efficiency</span> above 100% means
                beating the quoted time. It is a skill and estimating problem.
              </p>
              <p>
                <span className="font-medium text-(--text)">Productivity</span> is the two
                multiplied. Somebody can be 95% utilised and 110% efficient and the business still
                loses money, if the hours were never sold.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}
