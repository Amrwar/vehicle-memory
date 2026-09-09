import {
  Badge,
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
import { inTransitNow, transferSuggestions } from '@/lib/transfers';

export const metadata: Metadata = { title: 'Transfers' };
export const dynamic = 'force-dynamic';

/**
 * Stock between sites. FR-1010, FR-1702.
 *
 * The page exists for the middle state. A box that has left one site and not
 * reached the other is real, it belongs to the business, and it is on nobody's
 * shelf. Every other view in the system would show it as missing.
 */
export default async function TransfersPage() {
  const { orgId, plan } = await requireSession('inventory:read');

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'transfers')) {
    return <PlanWall feature="transfers" plan={plan} />;
  }

  const [inFlight, suggestions, recent] = await Promise.all([
    inTransitNow(orgId),
    transferSuggestions(orgId),
    prisma.stockTransfer.findMany({
      where: { orgId, status: { in: ['RECEIVED', 'CANCELLED', 'DRAFT'] } },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        lines: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
  ]);

  const roadValue = inFlight.reduce((total, transfer) => total + transfer.valueMinor, 0);
  const stale = inFlight.filter((transfer) => transfer.stale);

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock transfers"
        description="Parts moving between sites, and what is on the road right now"
      />

      <StatRow className="mb-5">
        <StatTile
          label="In transit"
          value={inFlight.length}
          note={inFlight.length === 1 ? 'Transfer on the road' : 'Transfers on the road'}
        />
        <StatTile
          label="Value on the road"
          value={<Money amount={roadValue / 100} />}
          note="Owned, but on nobody's shelf"
        />
        <StatTile
          label="Overdue"
          value={stale.length}
          tone={stale.length > 0 ? 'warning' : 'neutral'}
          note="Sent more than three days ago"
        />
        <StatTile
          label="Suggested"
          value={suggestions.length}
          note="Shortages another site could cover"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader title="On the road" description="Sent, not yet booked in at the far end" />
            {inFlight.length === 0 ? (
              <EmptyState
                title="Nothing in transit"
                description="Every part that has left a site has arrived at the other one."
              />
            ) : (
              <div className="divide-y divide-(--border)">
                {inFlight.map((transfer) => (
                  <div key={transfer.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="tabular">{transfer.reference}</span>
                          <span className="px-1.5 text-(--text-faint)">·</span>
                          <span className="text-(--text-soft)">
                            {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-(--text-faint)">
                          Sent{' '}
                          {transfer.dispatchedAt?.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          {' · '}
                          {transfer.outstanding} item{transfer.outstanding === 1 ? '' : 's'}{' '}
                          outstanding
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={transfer.stale ? 'warning' : 'info'}
                          size="sm"
                          dot={transfer.stale}
                        >
                          {transfer.daysInTransit === 0
                            ? 'today'
                            : `${transfer.daysInTransit}d in transit`}
                        </Badge>
                        <Money amount={transfer.valueMinor / 100} className="font-medium" />
                      </div>
                    </div>

                    <ul className="mt-2 grid gap-0.5 text-[12px]">
                      {transfer.lines.map((line) => {
                        const outstanding = Number(line.quantity) - Number(line.received);
                        if (outstanding <= 0) return null;

                        return (
                          <li
                            key={line.id}
                            className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-baseline gap-3"
                          >
                            <span className="datum text-(--text-faint)">
                              {line.product.partNumber}
                            </span>
                            <span className="truncate text-(--text-soft)">{line.product.name}</span>
                            <span className="tabular">
                              {outstanding} of {Number(line.quantity)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {transfer.stale ? (
                      <p className="mt-2 rounded-(--radius-sm) bg-(--warning-soft) px-2.5 py-2 text-[12px] leading-relaxed text-(--warning)">
                        Three days is longer than any van journey between these sites. Either it
                        arrived and nobody booked it in, or it did not arrive. Both need a phone
                        call, not a wait.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Recent" description="Completed, cancelled and draft" />
            {recent.length === 0 ? (
              <EmptyState title="No transfers yet" description="Nothing has moved between sites." />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Reference</Th>
                      <Th>Route</Th>
                      <Th numeric>Lines</Th>
                      <Th>Status</Th>
                      <Th>Completed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((transfer) => (
                      <Tr key={transfer.id}>
                        <Td className="tabular font-medium">{transfer.reference}</Td>
                        <Td className="text-(--text-soft)">
                          {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                        </Td>
                        <Td numeric className="text-(--text-soft)">
                          {transfer.lines.length}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              transfer.status === 'RECEIVED'
                                ? 'success'
                                : transfer.status === 'CANCELLED'
                                  ? 'neutral'
                                  : 'info'
                            }
                            size="sm"
                          >
                            {transfer.status.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </Td>
                        <Td className="text-(--text-faint)">
                          {transfer.receivedAt
                            ? transfer.receivedAt.toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : '—'}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card className={suggestions.length > 0 ? 'border-(--brand)' : undefined}>
            <CardHeader
              title="Worth moving"
              description="One site is short, another is holding spare"
            />
            {suggestions.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                No site is short of something another one can spare.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {suggestions.slice(0, 6).map((suggestion, index) => (
                  <li key={`${suggestion.productId}-${index}`} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="datum text-[12px] font-medium">{suggestion.partNumber}</p>
                      <span className="tabular shrink-0 text-[12px] font-medium">
                        {suggestion.quantity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-(--text-soft)">
                      {suggestion.fromSite} → {suggestion.toSite}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-(--text-faint)">
                      {suggestion.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Why in transit is its own state" />
            <CardBody className="text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                Stock deducted on dispatch and added on receipt, with nothing holding the gap,
                disappears from every report while it is in the van.
              </p>
              <p className="mt-2">
                At the next stocktake that reads as shrinkage, and shrinkage gets investigated as
                theft. So the difference between sent and received is a real balance, counted in the
                group&rsquo;s stock value and shown here until somebody books it in.
              </p>
              <p className="mt-2">
                <Link href="/financials" className="underline underline-offset-2">
                  Group financials
                </Link>{' '}
                counts it too.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
