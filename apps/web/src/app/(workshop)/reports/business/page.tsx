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

import { describeRate, type GroupRate, type Translator } from '@carnet/core';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { comebackPicture } from '@/lib/owner';
import {
  bySource,
  partsProfitability,
  periodFor,
  retention,
  revenueByServiceType,
} from '@/lib/reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Business reports') };
}
export const dynamic = 'force-dynamic';

/**
 * The reports a workshop runs on a Monday. FR-1404, FR-1405, FR-1406.
 *
 * Four questions: what kind of work pays, which parts earn, who has stopped
 * coming, and where the work comes from. Every one of them is exportable,
 * because the version that ends up in an accountant's inbox is the one that
 * has to be right.
 *
 * Each table leads with what is wrong rather than what is largest. A list
 * sorted by revenue tells somebody what they already know; the loss-making
 * part and the lapsed customer are what they came for.
 */
export default async function BusinessReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { orgId, region } = await requireSession('report:operational');
  const { range } = await searchParams;
  const t = await tFor();

  const key = range === 'month' || range === 'quarter' ? range : 'year';
  const period = periodFor(key);

  const [serviceTypes, parts, customers, sources, comebacks] = await Promise.all([
    revenueByServiceType(orgId, period),
    partsProfitability(orgId, period),
    retention(orgId, 25),
    bySource(orgId, period),
    comebackPicture(orgId, { days: key === 'month' ? 30 : key === 'quarter' ? 90 : 365 }),
  ]);

  const losing = parts.filter((row) => row.marginPct !== null && row.marginPct < 0);
  const lapsing = customers.filter((row) => row.lapsing);

  const revenue = serviceTypes.reduce((total, row) => total + row.revenueMinor, 0);
  const cost = serviceTypes.reduce((total, row) => total + row.costMinor, 0);

  const download = (report: string) => `/api/reports/${report}?range=${key}`;

  return (
    <>
      <PageHeader
        eyebrow={t('Reporting')}
        title={t('Business reports')}
        description={t(period.label)}
        actions={
          <>
            {(['month', 'quarter', 'year'] as const).map((option) => (
              <Link key={option} href={`/reports/business?range=${option}`}>
                <Button size="sm" variant={option === key ? 'primary' : 'secondary'}>
                  {option === 'month'
                    ? t('Month')
                    : option === 'quarter'
                      ? t('Quarter')
                      : t('Year')}
                </Button>
              </Link>
            ))}
            <Link href="/reports/tax">
              <Button size="sm" variant="ghost">
                {t('Tax')}
              </Button>
            </Link>
            <Link href="/reports">
              <Button size="sm" variant="ghost">
                {t('Operational')}
              </Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Revenue')}
          value={<Money currency={region.currency} locale={region.locale} amount={revenue / 100} />}
          note={t('Work completed in this period')}
        />
        <StatTile
          label={t('Gross margin')}
          value={revenue === 0 ? '—' : `${Math.round(((revenue - cost) / revenue) * 100)}%`}
          tone="brand"
          note={t('After parts and clocked labour')}
        />
        <StatTile
          label={t('Parts sold at a loss')}
          value={losing.length}
          tone={losing.length > 0 ? 'danger' : 'neutral'}
          note={t('Sell price below cost')}
        />
        <StatTile
          label={t('Customers lapsing')}
          value={lapsing.length}
          tone={lapsing.length > 0 ? 'warning' : 'neutral'}
          note={t('Past twice their usual gap')}
        />
      </StatRow>

      {losing.length > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {losing.length === 1
                ? t('1 part is being sold below cost.')
                : t('{count} parts are being sold below cost.', { count: losing.length })}
            </strong>{' '}
            {losing.length > 3
              ? t('{parts} and {count} more.', {
                  parts: losing
                    .slice(0, 3)
                    .map((row) => row.partNumber)
                    .join(', '),
                  count: losing.length - 3,
                })
              : `${losing.map((row) => row.partNumber).join(', ')}.`}{' '}
            {t(
              'A sell price that has not moved since the supplier put their cost up is invisible everywhere else in the system.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5">
        {/* --- what pays -------------------------------------------------- */}
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Revenue by service type')}
            description={t(
              'Cost includes parts and clocked labour, so busy-and-unprofitable is visible',
            )}
            action={
              <a href={download('service-types')} download>
                <Button size="sm" variant="ghost">
                  CSV
                </Button>
              </a>
            }
          />
          {serviceTypes.length === 0 ? (
            <EmptyState
              title={t('Nothing completed in this period')}
              description={t('Try a wider range.')}
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Service type')}</Th>
                    <Th numeric>{t('Jobs')}</Th>
                    <Th numeric>{t('Revenue')}</Th>
                    <Th numeric>{t('Cost')}</Th>
                    <Th numeric>{t('Margin')}</Th>
                    <Th numeric>{t('Average job')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {serviceTypes.map((row) => (
                    <Tr key={row.name}>
                      <Td className="font-medium">{row.name}</Td>
                      <Td numeric className="text-(--text-soft)">
                        {row.jobs}
                      </Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={row.revenueMinor / 100}
                        />
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={row.costMinor / 100}
                        />
                      </Td>
                      <Td numeric>
                        <span
                          className={
                            row.marginPct !== null && row.marginPct < 30
                              ? 'font-medium text-(--warning)'
                              : 'font-medium'
                          }
                        >
                          {row.marginPct === null ? '—' : `${row.marginPct}%`}
                        </span>
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={row.averageMinor / 100}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* --- comebacks -------------------------------------------------- */}
        <Card id="comebacks" className="overflow-hidden">
          <CardHeader
            title={t('Comebacks')}
            description={t(
              'Work finished in this period that came back, counted against the site and the technicians who did it',
            )}
            action={
              <Badge tone={comebacks.overall.part > 0 ? 'warning' : 'neutral'} size="sm">
                {comebacks.overall.value === null
                  ? t('{count} back', { count: comebacks.overall.part })
                  : `${comebacks.overall.value}%`}
              </Badge>
            }
          />
          <CardBody className="border-b border-(--border) text-[13px]">
            {t(describeRate(comebacks.overall))}
          </CardBody>
          <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-(--border)">
            <RateList title={t('By site')} rows={comebacks.bySite} t={t} />
            <RateList title={t('By person')} rows={comebacks.byPerson} t={t} />
            <div>
              <CardHeader title={t('What came back')} />
              {comebacks.recent.length === 0 ? (
                <CardBody className="text-[13px] text-(--text-soft)">
                  {t('Nothing was recorded as coming back.')}
                </CardBody>
              ) : (
                <ul className="divide-y divide-(--border)">
                  {comebacks.recent.map((entry) => (
                    <li key={entry.id} className="px-4 py-2.5 text-[13px]">
                      <Link href={`/jobs/${entry.id}`} className="font-medium hover:underline">
                        #{entry.number}
                      </Link>{' '}
                      {t('back from')}{' '}
                      {entry.comebackOf ? (
                        <Link
                          href={`/jobs/${entry.comebackOf.id}`}
                          className="font-medium hover:underline"
                        >
                          #{entry.comebackOf.number}
                        </Link>
                      ) : (
                        t('an earlier job')
                      )}
                      <span className="block text-[12px] text-(--text-soft)">
                        {entry.comebackReason}
                      </span>
                      {entry.comebackOf && entry.comebackOf.technicians.length > 0 ? (
                        <span className="block text-[11px] text-(--text-faint)">
                          {entry.comebackOf.technicians.map((tech) => tech.user.name).join(', ')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
            {t(
              'A rate shows only on ten finished jobs or more. One car back out of four jobs is one car, not a quarter of the work, and saying otherwise is how a good technician gets a bad name.',
            )}
          </CardBody>
        </Card>

        {/* --- parts ------------------------------------------------------ */}
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Parts profitability')}
            description={t('Loss-making lines first, because those are the finding')}
            action={
              <a href={download('parts')} download>
                <Button size="sm" variant="ghost">
                  CSV
                </Button>
              </a>
            }
          />
          {parts.length === 0 ? (
            <EmptyState
              title={t('No parts sold')}
              description={t('Nothing left the shelf this period.')}
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Part')}</Th>
                    <Th>{t('Category')}</Th>
                    <Th numeric>{t('Sold')}</Th>
                    <Th numeric>{t('Revenue')}</Th>
                    <Th numeric>{t('Cost')}</Th>
                    <Th numeric>{t('Margin')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...losing, ...parts.filter((row) => !losing.includes(row))]
                    .slice(0, 20)
                    .map((row) => (
                      <Tr key={`${row.partNumber}-${row.name}`}>
                        <Td>
                          <span className="datum text-[12px] text-(--text-faint)">
                            {row.partNumber}
                          </span>
                          <span className="block font-medium">{row.name}</span>
                        </Td>
                        <Td className="text-(--text-soft)">{row.category}</Td>
                        <Td numeric className="text-(--text-soft)">
                          {row.quantity}
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={row.revenueMinor / 100}
                          />
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={row.costMinor / 100}
                          />
                        </Td>
                        <Td numeric>
                          {row.marginPct === null ? (
                            '—'
                          ) : row.marginPct < 0 ? (
                            <Badge tone="danger" size="sm">
                              {row.marginPct}%
                            </Badge>
                          ) : (
                            <span className="font-medium">{row.marginPct}%</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* --- retention ------------------------------------------------ */}
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Customers')}
              description={t('Lapsing is measured against each customer’s own rhythm')}
              action={
                <a href={download('retention')} download>
                  <Button size="sm" variant="ghost">
                    CSV
                  </Button>
                </a>
              }
            />
            {customers.length === 0 ? (
              <EmptyState title={t('No customers yet')} description={t('Nobody has been in.')} />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Customer')}</Th>
                      <Th numeric>{t('Visits')}</Th>
                      <Th numeric>{t('Lifetime')}</Th>
                      <Th numeric>{t('Last in')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.slice(0, 12).map((row) => (
                      <Tr key={row.customerId}>
                        <Td>
                          <Link
                            href={`/customers/${row.customerId}`}
                            className="font-medium hover:text-(--brand-text) hover:underline"
                          >
                            {row.name}
                          </Link>
                          {row.lapsing ? (
                            <Badge tone="warning" size="sm" className="ms-2">
                              {t('lapsing')}
                            </Badge>
                          ) : null}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {row.visits}
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={row.lifetimeMinor / 100}
                          />
                        </Td>
                        <Td numeric className="text-(--text-faint)">
                          {row.daysSinceLastVisit === null
                            ? '—'
                            : t('{days}d', { days: row.daysSinceLastVisit })}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Somebody who services twice a year is not lapsed at seven months. Somebody who comes every six weeks is. A fixed cut-off would flag the first and miss the second.',
              )}
            </CardBody>
          </Card>

          {/* --- sources -------------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Where the work comes from')}
              description={t('Conversion matters more than volume')}
              action={
                <a href={download('sources')} download>
                  <Button size="sm" variant="ghost">
                    CSV
                  </Button>
                </a>
              }
            />
            {sources.length === 0 ? (
              <EmptyState
                title={t('No bookings')}
                description={t('Nothing was booked this period.')}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Source')}</Th>
                      <Th numeric>{t('Booked')}</Th>
                      <Th numeric>{t('Became jobs')}</Th>
                      <Th numeric>{t('Conversion')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((row) => (
                      <Tr key={row.source}>
                        <Td className="font-medium capitalize">
                          {t(row.source.toLowerCase().replace('_', ' '))}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {row.bookings}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {row.converted}
                        </Td>
                        <Td numeric>
                          <span
                            className={
                              row.conversionPct < 50
                                ? 'font-medium text-(--warning)'
                                : 'font-medium'
                            }
                          >
                            {row.conversionPct}%
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'A source that books ten and converts two is worse than one that books three and converts all of them. Counting bookings alone says the opposite.',
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function RateList({ title, rows, t }: { title: string; rows: GroupRate[]; t: Translator }) {
  return (
    <div>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <CardBody className="text-[13px] text-(--text-soft)">{t('No finished work.')}</CardBody>
      ) : (
        <ul className="divide-y divide-(--border)">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]"
            >
              <span className="font-medium">{row.name}</span>
              <span className="text-end tabular-nums text-(--text-soft)">
                {row.rate.value === null ? '' : `${row.rate.value}% · `}
                {t('{part} of {base}', { part: row.rate.part, base: row.rate.base })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
