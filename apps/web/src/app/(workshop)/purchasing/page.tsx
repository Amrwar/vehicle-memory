import { fromDecimal, matchBill, matchTone, orderTotals, toNumber } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
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

import { can } from '@/lib/guard';
import { PlanWall } from '@/components/plan-wall';
import { planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Purchasing') };
}
export const dynamic = 'force-dynamic';

const ORDER_TONE = {
  DRAFT: 'neutral',
  SENT: 'info',
  PART_RECEIVED: 'warning',
  RECEIVED: 'success',
  BILLED: 'success',
  CANCELLED: 'danger',
} as const;

/**
 * Purchasing: requests awaiting approval, then orders in flight.
 *
 * Requests come first because they are what blocks somebody. An order in
 * transit needs no attention until it arrives; a request nobody has approved
 * is a technician waiting.
 */
export default async function PurchasingPage() {
  const { db, user, plan, region } = await requireSession('purchase:request');

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'purchasing')) {
    return <PlanWall feature="purchasing" plan={plan} />;
  }
  const mayApprove = can(user.role, 'purchase:approve');
  const t = await tFor();

  const [requests, orders, bills] = await Promise.all([
    db.purchaseRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 25,
      include: {
        job: { select: { id: true, number: true, shortDescription: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    db.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        supplier: { select: { id: true, name: true } },
        lines: true,
        receipts: { select: { id: true, receivedAt: true } },
      },
    }),
    db.supplierBill.findMany({
      where: { status: { in: ['AWAITING', 'DISPUTED'] } },
      orderBy: { billedAt: 'desc' },
      take: 10,
      include: {
        supplier: { select: { name: true } },
        order: { include: { lines: true } },
      },
    }),
  ]);

  const pending = requests.filter((request) => request.status === 'PENDING');
  const openOrders = orders.filter((order) => ['SENT', 'PART_RECEIVED'].includes(order.status));

  const outstandingValue = openOrders.reduce((total, order) => {
    const totals = orderTotals(
      order.lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: Number(line.quantity),
        received: Number(line.received),
        unitCost: line.unitCost.toString(),
      })),
    );
    return total + toNumber(totals.outstandingValue);
  }, 0);

  // Three-way match on every open bill, so a discrepancy surfaces here rather
  // than after it has been paid.
  const matched = bills.map((bill) => ({
    bill,
    match: bill.order
      ? matchBill({
          orderLines: bill.order.lines.map((line) => ({
            id: line.id,
            description: line.description,
            quantity: Number(line.quantity),
            received: Number(line.received),
            unitCost: line.unitCost.toString(),
          })),
          billedTotal: fromDecimal(bill.subtotal.toString()),
        })
      : null,
  }));

  const problemBills = matched.filter((row) => row.match && row.match.status !== 'MATCHED').length;

  return (
    <>
      <PageHeader
        eyebrow={t('Inventory')}
        title={t('Purchasing')}
        description={t('Requests, orders and supplier bills')}
        actions={
          <>
            <Link href="/suppliers">
              <Button>{t('Suppliers')}</Button>
            </Link>
            <Link href="/purchasing/returns">
              <Button>{t('Returns')}</Button>
            </Link>
            <Link href="/purchasing/new">
              <Button variant="primary">{t('New order')}</Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Awaiting approval')}
          value={pending.length}
          tone={pending.length > 0 ? 'warning' : 'neutral'}
          note={pending.length > 0 ? t('Somebody is waiting') : t('Nothing pending')}
        />
        <StatTile
          label={t('Open orders')}
          value={openOrders.length}
          note={t('Sent or part received')}
        />
        <StatTile
          label={t('Outstanding value')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={outstandingValue} />
          }
          note={t('Ordered but not yet delivered')}
        />
        <StatTile
          label={t('Bills to query')}
          value={problemBills}
          tone={problemBills > 0 ? 'danger' : 'neutral'}
          note={problemBills > 0 ? t('Do not pay before checking') : t('All bills reconcile')}
        />
      </StatRow>

      <Card className={pending.length > 0 ? 'mb-5 border-(--warning)' : 'mb-5'}>
        <CardHeader
          title={t('Purchase requests')}
          description={
            mayApprove
              ? t('Approve to turn a request into an order.')
              : t('A manager approves these before they can be ordered.')
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            title={t('No requests')}
            description={t(
              'A request is raised automatically when a job needs a part that is short.',
            )}
          />
        ) : (
          <ul className="divide-y divide-(--border)">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]">{request.notes ?? t('Purchase request')}</p>
                  <p className="mt-0.5 text-[12px] text-(--text-faint)">
                    {request.job ? (
                      <>
                        <Link href={`/jobs/${request.job.id}`} className="datum hover:underline">
                          #{request.job.number}
                        </Link>
                        {' · '}
                        {request.job.shortDescription}
                        {' · '}
                      </>
                    ) : null}
                    <time className="datum">
                      {request.createdAt.toLocaleDateString(region.locale)}
                    </time>
                    {request.approvedBy
                      ? ` · ${t('approved by {name}', { name: request.approvedBy.name })}`
                      : ''}
                  </p>
                </div>

                <Badge
                  tone={
                    request.status === 'PENDING'
                      ? 'warning'
                      : request.status === 'REJECTED'
                        ? 'danger'
                        : 'success'
                  }
                  dot
                >
                  {t(request.status.toLowerCase())}
                </Badge>

                {request.status === 'PENDING' && mayApprove ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary">
                      {t('Approve')}
                    </Button>
                    <Button size="sm">{t('Reject')}</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title={t('Purchase orders')} />
        {orders.length === 0 ? (
          <EmptyState
            title={t('No orders')}
            description={t('Approved requests become orders here.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Order')}</Th>
                  <Th>{t('Supplier')}</Th>
                  <Th>{t('Expected')}</Th>
                  <Th numeric>{t('Lines')}</Th>
                  <Th numeric>{t('Value')}</Th>
                  <Th numeric>{t('Still to arrive')}</Th>
                  <Th>{t('Status')}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const totals = orderTotals(
                    order.lines.map((line) => ({
                      id: line.id,
                      description: line.description,
                      quantity: Number(line.quantity),
                      received: Number(line.received),
                      unitCost: line.unitCost.toString(),
                    })),
                  );

                  return (
                    <Tr key={order.id}>
                      <Td className="datum">
                        <Link
                          href={`/purchasing/${order.id}`}
                          className="font-medium hover:underline"
                        >
                          {order.number}
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/suppliers/${order.supplier.id}`} className="hover:underline">
                          {order.supplier.name}
                        </Link>
                      </Td>
                      <Td className="datum text-(--text-faint)">
                        {order.expectedAt?.toLocaleDateString(region.locale) ?? '—'}
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {order.lines.length}
                      </Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(totals.subtotal)}
                        />
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {totals.outstandingValue.minor > 0 ? (
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(totals.outstandingValue)}
                          />
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>
                        <Badge tone={ORDER_TONE[order.status]} dot>
                          {t(order.status.toLowerCase().replace('_', ' '))}
                        </Badge>
                      </Td>
                      <Td>
                        {['SENT', 'PART_RECEIVED'].includes(order.status) ? (
                          <Link href={`/purchasing/${order.id}`}>
                            <Button size="sm" variant="primary">
                              {t('Receive')}
                            </Button>
                          </Link>
                        ) : null}
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
          title={t('Supplier bills')}
          description={t('Checked against what was ordered and what actually arrived')}
        />
        {matched.length === 0 ? (
          <EmptyState title={t('No open bills')} description={t('Everything is settled.')} />
        ) : (
          <ul className="divide-y divide-(--border)">
            {matched.map(({ bill, match }) => (
              <li key={bill.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="datum text-[13px] font-medium">{bill.reference}</span>
                    <span className="text-[13px] text-(--text-soft)">{bill.supplier.name}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-(--text-faint)">
                    {match ? t(match.message) : t('Not linked to a purchase order.')}
                  </p>
                </div>

                <span className="font-display text-[15px] font-semibold">
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={Number(bill.total)}
                  />
                </span>

                <Badge tone={match ? matchTone(match.status) : 'neutral'} dot>
                  {match ? t(match.status.toLowerCase().replace('_', ' ')) : t('unmatched')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
