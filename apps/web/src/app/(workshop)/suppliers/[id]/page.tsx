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
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { supplierDetail } from '@/lib/suppliers';

export const metadata: Metadata = { title: 'Supplier' };
export const dynamic = 'force-dynamic';

/**
 * One supplier, and whether they are worth keeping. FR-2801.
 *
 * The suppliers list linked here and the page did not exist, so every supplier
 * name in the product was a link to a 404.
 *
 * What a workshop wants to know about a supplier is not their address. It is
 * whether the orders arrive when they said, and whether the price on the
 * invoice matches the price on the order. Both are answerable from records the
 * product already holds, and neither is anywhere else in it.
 */
function date(value: Date | null, locale: string): string {
  return value
    ? value.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId, region } = await requireSession('inventory:read');
  const { id } = await params;

  const supplier = await supplierDetail(orgId, id);
  if (!supplier) notFound();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/suppliers">All suppliers</BackLink>
      </div>

      <PageHeader
        eyebrow="Suppliers"
        title={supplier.name}
        description={
          supplier.accountRef ? `Account ${supplier.accountRef}` : 'No account reference on file'
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Orders placed"
          value={supplier.orderCount}
          note={`${supplier.openOrders} still open`}
        />
        <StatTile
          label="Typical wait"
          value={supplier.leadTimeDays === null ? '—' : `${supplier.leadTimeDays}d`}
          note={
            supplier.leadTimeDays === null
              ? 'Not enough received orders'
              : 'Order to delivery, measured'
          }
        />
        <StatTile
          label="Arrived late"
          value={supplier.lateCount}
          tone={supplier.lateCount > 0 ? 'warning' : 'neutral'}
          note="Past the date they promised"
        />
        <StatTile
          label="Owed"
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={supplier.outstanding}
            />
          }
          note={`${supplier.openBills} bill${supplier.openBills === 1 ? '' : 's'} unpaid`}
        />
      </StatRow>

      {supplier.disputed > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {supplier.disputed} bill{supplier.disputed === 1 ? '' : 's'} in dispute.
            </strong>{' '}
            The invoice does not match what was ordered or what arrived. Nothing is paid until
            somebody resolves it, which is the point of the three-way match.
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Getting hold of them" />
          <CardBody>
            <KeyValue
              items={[
                { label: 'Email', value: supplier.email ?? '—' },
                { label: 'Phone', value: supplier.phone ?? '—' },
                {
                  label: 'Address',
                  value:
                    [supplier.addressLine1, supplier.locality, supplier.postcode]
                      .filter(Boolean)
                      .join(', ') || '—',
                },
                { label: 'Payment terms', value: `${supplier.paymentTermsDays} days` },
                {
                  label: 'Status',
                  value: supplier.isActive ? (
                    <Badge tone="success" size="sm">
                      active
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      no longer used
                    </Badge>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What they charge"
            description="The last price paid for each part, so a rise is visible rather than absorbed."
          />
          <CardBody className="p-0">
            {supplier.prices.length === 0 ? (
              <EmptyState
                title="Nothing received yet"
                description="Prices appear here once an order from this supplier has been received."
              />
            ) : (
              <ul className="divide-y divide-(--border-soft)">
                {supplier.prices.slice(0, 8).map((price) => (
                  <li
                    key={price.productId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="min-w-0 text-[13px]">
                      <Link
                        href={`/parts/${price.productId}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {price.name}
                      </Link>
                      <span className="block text-[11px] text-(--text-faint)">
                        last on {date(price.lastAt, region.locale)}
                      </span>
                    </span>
                    <span className="text-right text-[13px] font-medium tabular-nums">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={price.lastPrice}
                      />
                      {price.change !== null ? (
                        <span
                          className={
                            price.change > 0
                              ? 'block text-[11px] font-normal text-(--danger)'
                              : 'block text-[11px] font-normal text-(--success)'
                          }
                        >
                          {price.change > 0 ? 'up' : 'down'} {Math.abs(price.change).toFixed(1)}%
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Orders"
          description="Newest first, with what was promised against what happened."
        />
        {supplier.orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Raise one from the purchasing screen and it will appear here."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Placed</Th>
                  <Th>Promised</Th>
                  <Th>Arrived</Th>
                  <Th>State</Th>
                  <Th numeric>Value</Th>
                </tr>
              </thead>
              <tbody>
                {supplier.orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link
                        href={`/purchasing/${order.id}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {order.number}
                      </Link>
                    </Td>
                    <Td className="text-(--text-soft)">{date(order.createdAt, region.locale)}</Td>
                    <Td className="text-(--text-soft)">{date(order.expectedAt, region.locale)}</Td>
                    <Td>
                      {order.receivedAt ? (
                        <span className={order.late ? 'text-(--warning)' : ''}>
                          {date(order.receivedAt, region.locale)}
                        </span>
                      ) : (
                        <span className="text-(--text-faint)">not yet</span>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          order.status === 'RECEIVED'
                            ? 'success'
                            : order.status === 'CANCELLED'
                              ? 'neutral'
                              : 'brand'
                        }
                        size="sm"
                      >
                        {order.status.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </Td>
                    <Td numeric>
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={order.total}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
