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
import { tFor } from '@/lib/i18n';
import { expiringCertifications, onSiteNow, teamProductivity } from '@/lib/people';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('People') };
}
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
  const t = await tFor();

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
        eyebrow={t('People')}
        title={t('Team')}
        description={`${t('Last {days} days', { days: window })}${siteFilter ? ` · ${locations.find((l) => l.id === siteFilter)?.name}` : ''}`}
        actions={
          <>
            {locations.length > 1 ? (
              <>
                <Link href={`/people?days=${window}`}>
                  <Button size="sm" variant={siteFilter ? 'secondary' : 'primary'}>
                    {t('All sites')}
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
                  {t('{days}d', { days: option })}
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
              {expired.length === 1
                ? t('1 qualification has expired.')
                : t('{count} qualifications have expired.', { count: expired.length })}
            </strong>{' '}
            {t('{people} cannot legally sign off work covered by {qualifications}.', {
              people: expired.map((certification) => certification.employee.displayName).join(', '),
              qualifications: expired.map((certification) => certification.name).join(', '),
            })}{' '}
            {t('This is not a reminder, it is work that has to stop.')}
          </CardBody>
        </Card>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Utilisation')}
          value={totals.utilisationPct === null ? '—' : `${totals.utilisationPct}%`}
          note={t('Paid time that reached a vehicle')}
        />
        <StatTile
          label={t('Efficiency')}
          value={totals.efficiencyPct === null ? '—' : `${totals.efficiencyPct}%`}
          note={t('Sold against clocked')}
        />
        <StatTile
          label={t('Productivity')}
          value={totals.productivityPct === null ? '—' : `${totals.productivityPct}%`}
          tone={
            totals.productivityPct === null
              ? 'neutral'
              : totals.productivityPct >= 75
                ? 'success'
                : 'warning'
          }
          note={t('Sold against paid. This one pays wages.')}
        />
        <StatTile
          label={t('Labour profit')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={toNumber(totals.labourProfit)}
            />
          }
          tone={totals.labourProfit.minor >= 0 ? 'neutral' : 'danger'}
          note={t('Sold labour less the whole attended day')}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Productivity')}
              description={t(
                'Three measures of the same day. The gaps between them are the finding.',
              )}
            />
            {team.people.length === 0 ? (
              <EmptyState
                title={t('Nobody on the books yet')}
                description={t('Add employees to see how the workshop’s paid hours are spent.')}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Person')}</Th>
                      <Th numeric>{t('Attended')}</Th>
                      <Th numeric>{t('Clocked')}</Th>
                      <Th numeric>{t('Sold')}</Th>
                      <Th numeric>{t('Util.')}</Th>
                      <Th numeric>{t('Effic.')}</Th>
                      <Th numeric>{t('Prod.')}</Th>
                      <Th numeric>{t('Labour profit')}</Th>
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
                          {t('{hours}h', { hours: person.attendedHours })}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {t('{hours}h', { hours: person.productiveHours })}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {t('{hours}h', { hours: person.soldHours })}
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
                      <Td className="font-semibold">{t('Team')}</Td>
                      <Td numeric className="font-medium">
                        {t('{hours}h', { hours: totals.attendedHours })}
                      </Td>
                      <Td numeric className="font-medium">
                        {t('{hours}h', { hours: totals.productiveHours })}
                      </Td>
                      <Td numeric className="font-medium">
                        {t('{hours}h', { hours: totals.soldHours })}
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
                title={t('Records that cannot be right')}
                description={t('More job time clocked than attendance recorded')}
              />
              <CardBody className="grid gap-2 text-[13px]">
                {team.suspect.map((person) => (
                  <p key={person.technicianId} className="text-(--text-soft)">
                    <span className="font-medium text-(--text)">{person.technicianName}</span>{' '}
                    {t('clocked {productive}h onto jobs but attended {attended}h.', {
                      productive: person.productiveHours,
                      attended: person.attendedHours,
                    })}{' '}
                    {t('Somebody forgot to clock out of a shift, or onto one.')}
                  </p>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  {t(
                    'These are left in the figures above rather than removed. Averaging them away would make every other number on this page slightly wrong and give no clue why.',
                  )}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader title={t('Employees')} description={t('Pay, site and contracted hours')} />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Name')}</Th>
                    <Th>{t('Role')}</Th>
                    <Th>{t('Site')}</Th>
                    <Th numeric>{t('Contracted')}</Th>
                    <Th numeric>{t('Cost per hour')}</Th>
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
                      <Td className="text-(--text-soft)">
                        {employee.location?.name ?? t('Group')}
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {t('{hours}h', { hours: (employee.weeklyMinutes / 60).toFixed(1) })}
                      </Td>
                      <Td numeric>
                        {employee.payRates[0] ? (
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={Number(employee.payRates[0].costPerHour)}
                          />
                        ) : (
                          <span className="text-(--danger)">{t('No rate set')}</span>
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
            <CardHeader title={t('On site now')} description={t('Open shifts')} />
            {onSite.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                {t('Nobody is clocked in.')}
              </CardBody>
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
                          {t('Since {time}', {
                            time: record.startedAt.toLocaleTimeString(region.locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })}
                          {record.location ? ` · ${record.location.name}` : ''}
                        </p>
                      </div>
                      <span
                        className={`tabular shrink-0 text-[12px] ${hours > 16 ? 'font-medium text-(--warning)' : 'text-(--text-soft)'}`}
                      >
                        {t('{hours}h', { hours: hours.toFixed(1) })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className={certifications.length > 0 ? 'border-(--warning)' : undefined}>
            <CardHeader
              title={t('Qualifications')}
              description={t('Expired, or expiring within 60 days')}
            />
            {certifications.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                {t('Nothing lapses in the next two months.')}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {certifications.map((certification) => (
                  <li key={certification.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium">{certification.name}</p>
                      <Badge tone={certification.expired ? 'danger' : 'warning'} size="sm">
                        {certification.expired
                          ? t('{days}d ago', { days: Math.abs(certification.daysRemaining) })
                          : t('{days}d', { days: certification.daysRemaining })}
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
            <CardHeader title={t('How to read this')} />
            <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                <span className="font-medium text-(--text)">{t('Utilisation')}</span>{' '}
                {t(
                  'falls when people are waiting: for parts, for a decision, for a bay. It is a scheduling problem.',
                )}
              </p>
              <p>
                <span className="font-medium text-(--text)">{t('Efficiency')}</span>{' '}
                {t(
                  'above 100% means beating the quoted time. It is a skill and estimating problem.',
                )}
              </p>
              <p>
                <span className="font-medium text-(--text)">{t('Productivity')}</span>{' '}
                {t(
                  'is the two multiplied. Somebody can be 95% utilised and 110% efficient and the business still loses money, if the hours were never sold.',
                )}
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
