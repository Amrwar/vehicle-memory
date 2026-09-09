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

import { requireSession } from '@/lib/guard';
import { groupPerformance, inTransitNow } from '@/lib/transfers';

export const metadata: Metadata = { title: 'Group' };
export const dynamic = 'force-dynamic';

/**
 * The group, read as a group. FR-1703, FR-1704.
 *
 * Every roll-up here carries its spread. A group at 68% productivity might be
 * two sites at 67% and 69%, or one at 95% and one at 41%, and only the second
 * is something an owner can act on. Reporting the middle alone hides exactly
 * the case the page exists to find.
 */
export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { orgId } = await requireSession('report:financial');
  const { range } = await searchParams;

  const now = new Date();
  const key = range === 'month' ? 'month' : range === 'quarter' ? 'quarter' : 'year';

  const from =
    key === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : key === 'quarter'
        ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        : new Date(now.getFullYear(), 0, 1);

  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const [group, inFlight] = await Promise.all([
    groupPerformance(orgId, { from, to }),
    inTransitNow(orgId),
  ]);

  if (group.sites.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Group" title="Sites" />
        <EmptyState
          title="One site"
          description="This view compares sites against each other. It becomes useful when there are at least two."
        />
      </>
    );
  }

  const roadValue = inFlight.reduce((total, transfer) => total + transfer.valueMinor, 0);
  const total = group.total;

  return (
    <>
      <PageHeader
        eyebrow="Group"
        title="Sites"
        description={`${group.sites.length} sites · ${
          key === 'month'
            ? now.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
            : key === 'quarter'
              ? `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1} to date`
              : `${now.getFullYear()} to date`
        }`}
        actions={
          <>
            {(['month', 'quarter', 'year'] as const).map((option) => (
              <Link key={option} href={`/group?range=${option}`}>
                <Button size="sm" variant={option === key ? 'primary' : 'secondary'}>
                  {option === 'month' ? 'Month' : option === 'quarter' ? 'Quarter' : 'Year'}
                </Button>
              </Link>
            ))}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Group revenue"
          value={<Money amount={toNumber(total.revenue)} />}
          note="Net of tax, across every site"
        />
        <StatTile
          label="Gross profit"
          value={<Money amount={toNumber(total.grossProfit)} />}
          tone="brand"
          note={total.marginPct === null ? 'No revenue yet' : `${total.marginPct}% net margin`}
        />
        <StatTile
          label="Group productivity"
          value={total.productivityPct === null ? '—' : `${total.productivityPct}%`}
          tone={
            total.productivityPct === null
              ? 'neutral'
              : total.productivityPct >= 75
                ? 'success'
                : 'warning'
          }
          note="From the hours, not an average of sites"
        />
        <StatTile
          label="Stock on the road"
          value={<Money amount={roadValue / 100} />}
          note={`${inFlight.length} transfer${inFlight.length === 1 ? '' : 's'} in transit`}
        />
      </StatRow>

      {group.spread.gapPoints !== null && group.spread.gapPoints > 15 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {group.spread.gapPoints} points between the best and worst site.
            </strong>{' '}
            {group.spread.best?.siteName} runs at {group.spread.best?.productivityPct}% while{' '}
            {group.spread.worst?.siteName} runs at {group.spread.worst?.productivityPct}%. The group
            average of {total.productivityPct}% describes neither of them. A gap this wide is a
            management question, not a rounding one.
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader
            title="By site"
            description="Ordered by revenue. Share of group is there so a small site reads as a small site."
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Site</Th>
                  <Th numeric>Revenue</Th>
                  <Th numeric>Share</Th>
                  <Th numeric>Gross profit</Th>
                  <Th numeric>Jobs</Th>
                  <Th numeric>Per job</Th>
                  <Th numeric>Productivity</Th>
                  <Th numeric>Stock</Th>
                  <Th numeric>Owed to you</Th>
                </tr>
              </thead>
              <tbody>
                {group.sites.map((site) => (
                  <Tr key={site.locationId}>
                    <Td className="font-medium">
                      {site.siteName}
                      {group.laggards.some((laggard) => laggard.locationId === site.locationId) ? (
                        <Badge tone="warning" size="sm" className="ml-2">
                          below group
                        </Badge>
                      ) : null}
                    </Td>
                    <Td numeric>
                      <Money amount={toNumber(site.revenue)} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {site.shareOfGroupPct}%
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money amount={toNumber(site.grossProfit)} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {site.jobsCompleted}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money amount={toNumber(site.revenuePerJob)} />
                    </Td>
                    <Td numeric>
                      <span
                        className={
                          site.productivityPct !== null && site.productivityPct < 60
                            ? 'font-medium text-(--warning)'
                            : 'font-medium'
                        }
                      >
                        {site.productivityPct === null ? '—' : `${site.productivityPct}%`}
                      </span>
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money amount={toNumber(site.stockValue)} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money amount={toNumber(site.receivables)} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-(--border-strong) bg-(--surface-sunk)">
                  <Td className="font-semibold">Group</Td>
                  <Td numeric className="font-semibold">
                    <Money amount={toNumber(total.revenue)} />
                  </Td>
                  <Td numeric className="text-(--text-faint)">
                    100%
                  </Td>
                  <Td numeric className="font-medium">
                    <Money amount={toNumber(total.grossProfit)} />
                  </Td>
                  <Td numeric className="font-medium">
                    {total.jobsCompleted}
                  </Td>
                  <Td numeric className="font-medium">
                    <Money amount={toNumber(total.revenuePerJob)} />
                  </Td>
                  <Td numeric className="font-semibold">
                    {total.productivityPct === null ? '—' : `${total.productivityPct}%`}
                  </Td>
                  <Td numeric className="font-medium">
                    <Money amount={toNumber(total.stockValue)} />
                  </Td>
                  <Td numeric className="font-medium">
                    <Money amount={toNumber(total.receivables)} />
                  </Td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Spread" description="The number the average hides" />
            <CardBody className="grid gap-3">
              {group.sites.map((site) => {
                const value = site.productivityPct ?? 0;
                const width = Math.min(100, Math.max(2, value));

                return (
                  <div key={site.locationId}>
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="font-medium">{site.siteName}</span>
                      <span className="tabular text-(--text-soft)">
                        {site.productivityPct === null ? '—' : `${site.productivityPct}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-(--surface-sunk)">
                      <div
                        className={`h-full rounded-full ${value >= 75 ? 'bg-(--success)' : value >= 60 ? 'bg-(--brand)' : 'bg-(--warning)'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                Group productivity is computed from the underlying minutes, not by averaging these
                bars. Averaging would weight a two-bay site the same as a six-bay one.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What this view does not yet do" />
            <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                <span className="font-medium text-(--text)">Overheads are not apportioned.</span>{' '}
                Rent belongs to a building and can be attributed; a group insurance premium does not
                belong anywhere in particular. Rather than split it by revenue and present the guess
                as a fact, site overheads read zero and net profit is shown at group level only.
              </p>
              <p>
                <span className="font-medium text-(--text)">Inter-site movements are netted.</span>{' '}
                A part transferred between sites is one part. Counting both movements would inflate
                group purchasing and make stock look like it turns over faster than it does.
              </p>
              <p>
                <Link href="/transfers" className="underline underline-offset-2">
                  Transfers
                </Link>{' '}
                shows what is moving right now.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
