import {
  Alert,
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
import { redirect } from 'next/navigation';

import { TransferError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { PlanWall } from '@/components/plan-wall';
import { can, planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { createTransfer, inTransitNow, transferSuggestions } from '@/lib/transfers';
import { once, onceToken, StillGoingError } from '@/lib/once';
import { SubmitOnce } from '@/components/submit-once';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Transfers') };
}
export const dynamic = 'force-dynamic';

/**
 * Stock between sites. FR-1010, FR-1702.
 *
 * The page exists for the middle state. A box that has left one site and not
 * reached the other is real, it belongs to the business, and it is on nobody's
 * shelf. Every other view in the system would show it as missing.
 */
/**
 * Starts the transfer a suggestion is describing.
 *
 * One press, because the suggestion already knows the part, the two sites and
 * how many: asking somebody to retype all four is asking them not to bother.
 * It lands as a draft, so nothing leaves a shelf until a person looks at it
 * and sends it.
 */
async function start(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  let id: string | undefined;

  try {
    const made = await once({
      orgId,
      key: ['start-transfer', String(formData.get('once') ?? '')],
      resultOf: (transferId) => transferId,
      work: () =>
        createTransfer({
          orgId,
          userId: user.userId,
          fromWarehouseId: String(formData.get('fromWarehouseId') ?? ''),
          toWarehouseId: String(formData.get('toWarehouseId') ?? ''),
          lines: [
            {
              productId: String(formData.get('productId') ?? ''),
              quantity: Number(formData.get('quantity') ?? 0),
            },
          ],
          note: String(formData.get('note') ?? ''),
        }),
    });

    id = made.result ?? made.resultRef ?? undefined;
  } catch (error) {
    if (!(error instanceof TransferError) && !(error instanceof StillGoingError)) throw error;
    redirect(`/transfers?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(id ? `/transfers/${id}` : '/transfers');
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { orgId, plan, region, user } = await requireSession('inventory:read');
  const { problem, done } = await searchParams;

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'transfers')) {
    return <PlanWall feature="transfers" plan={plan} />;
  }

  const mayMove = can(user.role, 'inventory:write');

  // A key for this drawing of the page; every "start this transfer" button
  // carries its own, so a double-press is one draft rather than two vans.
  const token = onceToken();

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
  const t = await tFor();

  return (
    <>
      <PageHeader
        eyebrow={t('Inventory')}
        title={t('Stock transfers')}
        description={t('Parts moving between sites, and what is on the road right now')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('In transit')}
          value={inFlight.length}
          note={inFlight.length === 1 ? t('Transfer on the road') : t('Transfers on the road')}
        />
        <StatTile
          label={t('Value on the road')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={roadValue / 100} />
          }
          note={t('Owned, but on nobody’s shelf')}
        />
        <StatTile
          label={t('Overdue')}
          value={stale.length}
          tone={stale.length > 0 ? 'warning' : 'neutral'}
          note={t('Sent more than three days ago')}
        />
        <StatTile
          label={t('Suggested')}
          value={suggestions.length}
          note={t('Shortages another site could cover')}
        />
      </StatRow>

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <Alert tone="success" className="mb-5">
          {t('Cancelled. Nothing had left a shelf, so nothing has to be put back.')}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('On the road')}
              description={t('Sent, not yet booked in at the far end')}
            />
            {inFlight.length === 0 ? (
              <EmptyState
                title={t('Nothing in transit')}
                description={t('Every part that has left a site has arrived at the other one.')}
              />
            ) : (
              <div className="divide-y divide-(--border)">
                {inFlight.map((transfer) => (
                  <div key={transfer.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <Link
                            href={`/transfers/${transfer.id}`}
                            className="tabular text-(--brand-text) hover:underline"
                          >
                            {transfer.reference}
                          </Link>
                          <span className="px-1.5 text-(--text-faint)">·</span>
                          <span className="text-(--text-soft)">
                            {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-(--text-faint)">
                          {t('Sent {date}', {
                            date:
                              transfer.dispatchedAt?.toLocaleDateString(region.locale, {
                                day: 'numeric',
                                month: 'short',
                              }) ?? '',
                          })}
                          {' · '}
                          {transfer.outstanding === 1
                            ? t('1 item outstanding')
                            : t('{count} items outstanding', { count: transfer.outstanding })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={transfer.stale ? 'warning' : 'info'}
                          size="sm"
                          dot={transfer.stale}
                        >
                          {transfer.daysInTransit === 0
                            ? t('today')
                            : t('{days}d in transit', { days: transfer.daysInTransit })}
                        </Badge>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={transfer.valueMinor / 100}
                          className="font-medium"
                        />
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
                              {t('{outstanding} of {total}', {
                                outstanding,
                                total: Number(line.quantity),
                              })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {transfer.stale ? (
                      <p className="mt-2 rounded-(--radius-sm) bg-(--warning-soft) px-2.5 py-2 text-[12px] leading-relaxed text-(--warning)">
                        {t(
                          'Three days is longer than any van journey between these sites. Either it arrived and nobody booked it in, or it did not arrive. Both need a phone call, not a wait.',
                        )}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={t('Recent')} description={t('Completed, cancelled and draft')} />
            {recent.length === 0 ? (
              <EmptyState
                title={t('No transfers yet')}
                description={t('Nothing has moved between sites.')}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Reference')}</Th>
                      <Th>{t('Route')}</Th>
                      <Th numeric>{t('Lines')}</Th>
                      <Th>{t('Status')}</Th>
                      <Th>{t('Completed')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((transfer) => (
                      <Tr key={transfer.id}>
                        <Td className="tabular font-medium">
                          <Link
                            href={`/transfers/${transfer.id}`}
                            className="text-(--brand-text) hover:underline"
                          >
                            {transfer.reference}
                          </Link>
                        </Td>
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
                            {t(transfer.status.toLowerCase().replace('_', ' '))}
                          </Badge>
                        </Td>
                        <Td className="text-(--text-faint)">
                          {transfer.receivedAt
                            ? transfer.receivedAt.toLocaleDateString(region.locale, {
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
              title={t('Worth moving')}
              description={t('One site is short, another is holding spare')}
            />
            {suggestions.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                {t('No site is short of something another one can spare.')}
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
                      {t(suggestion.reason)}
                    </p>
                    {mayMove ? (
                      <form action={start} className="mt-2">
                        <input type="hidden" name="productId" value={suggestion.productId} />
                        <input
                          type="hidden"
                          name="fromWarehouseId"
                          value={suggestion.fromWarehouseId}
                        />
                        <input
                          type="hidden"
                          name="toWarehouseId"
                          value={suggestion.toWarehouseId}
                        />
                        <input type="hidden" name="quantity" value={suggestion.quantity} />
                        <input type="hidden" name="note" value={suggestion.reason} />
                        <input
                          type="hidden"
                          name="once"
                          value={`${token}:${suggestion.productId}:${index}`}
                        />
                        <SubmitOnce variant="secondary" size="sm">
                          {t('Start this transfer')}
                        </SubmitOnce>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Why in transit is its own state')} />
            <CardBody className="text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                {t(
                  'Stock deducted on dispatch and added on receipt, with nothing holding the gap, disappears from every report while it is in the van.',
                )}
              </p>
              <p className="mt-2">
                {t(
                  'At the next stocktake that reads as shrinkage, and shrinkage gets investigated as theft. So the difference between sent and received is a real balance, counted in the group’s stock value and shown here until somebody books it in.',
                )}
              </p>
              <p className="mt-2">
                <Link href="/financials" className="underline underline-offset-2">
                  {t('Group financials counts it too.')}
                </Link>
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
