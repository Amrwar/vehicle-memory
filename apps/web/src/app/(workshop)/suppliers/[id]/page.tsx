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
import { tFor } from '@/lib/i18n';
import { supplierOverTime } from '@/lib/owner';
import { supplierDetail } from '@/lib/suppliers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Supplier') };
}
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
  const t = await tFor();
  const { id } = await params;

  const supplier = await supplierDetail(orgId, id);
  if (!supplier) notFound();
  const history = await supplierOverTime(orgId, supplier.id);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/suppliers">{t('All suppliers')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Suppliers')}
        title={supplier.name}
        description={
          supplier.accountRef
            ? t('Account {reference}', { reference: supplier.accountRef })
            : t('No account reference on file')
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Orders placed')}
          value={supplier.orderCount}
          note={t('{count} still open', { count: supplier.openOrders })}
        />
        <StatTile
          label={t('Typical wait')}
          value={
            supplier.leadTimeDays === null ? '—' : t('{days}d', { days: supplier.leadTimeDays })
          }
          note={
            supplier.leadTimeDays === null
              ? t('Not enough received orders')
              : t('Order to delivery, measured')
          }
        />
        <StatTile
          label={t('Arrived late')}
          value={supplier.lateCount}
          tone={supplier.lateCount > 0 ? 'warning' : 'neutral'}
          note={t('Past the date they promised')}
        />
        <StatTile
          label={t('Owed')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={supplier.outstanding}
            />
          }
          note={
            supplier.openBills === 1
              ? t('1 bill unpaid')
              : t('{count} bills unpaid', { count: supplier.openBills })
          }
        />
      </StatRow>

      {supplier.disputed > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {supplier.disputed === 1
                ? t('1 bill in dispute.')
                : t('{count} bills in dispute.', { count: supplier.disputed })}
            </strong>{' '}
            {t(
              'The invoice does not match what was ordered or what arrived. Nothing is paid until somebody resolves it, which is the point of the three-way match.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('Getting hold of them')} />
          <CardBody>
            <KeyValue
              t={t}
              items={[
                { label: t('Email'), value: supplier.email ?? '—' },
                { label: t('Phone'), value: supplier.phone ?? '—' },
                {
                  label: t('Address'),
                  value:
                    [supplier.addressLine1, supplier.locality, supplier.postcode]
                      .filter(Boolean)
                      .join(', ') || '—',
                },
                {
                  label: t('Payment terms'),
                  value: t('{count} days', { count: supplier.paymentTermsDays }),
                },
                {
                  label: t('Status'),
                  value: supplier.isActive ? (
                    <Badge tone="success" size="sm">
                      {t('active')}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      {t('no longer used')}
                    </Badge>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('What they charge')}
            description={t(
              'The last price paid for each part, so a rise is visible rather than absorbed.',
            )}
          />
          <CardBody className="p-0">
            {supplier.prices.length === 0 ? (
              <EmptyState
                title={t('Nothing received yet')}
                description={t(
                  'Prices appear here once an order from this supplier has been received.',
                )}
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
                        {t('last on {date}', { date: date(price.lastAt, region.locale) })}
                      </span>
                    </span>
                    <span className="text-end text-[13px] font-medium tabular-nums">
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
                          {price.change > 0
                            ? t('up {percent}%', { percent: Math.abs(price.change).toFixed(1) })
                            : t('down {percent}%', { percent: Math.abs(price.change).toFixed(1) })}
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

      <Card id="over-time" className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Over the year')}
          description={t(
            'Quarter by quarter, measured from their orders. A figure shows only when three orders or more stand behind it.',
          )}
        />
        <CardBody className="border-b border-(--border) text-[13px] leading-relaxed">
          <ul className="grid gap-1">
            {history.sentences.map((sentence) => (
              <li key={sentence}>{t(sentence)}</li>
            ))}
          </ul>
        </CardBody>
        <TableWrap className="rounded-none border-0">
          <Table>
            <thead>
              <tr>
                <Th>{t('Quarter')}</Th>
                <Th numeric>{t('Orders')}</Th>
                <Th numeric>{t('Typical wait')}</Th>
                <Th numeric>{t('By the day promised')}</Th>
                <Th numeric>{t('Delivered in full')}</Th>
                <Th numeric>{t('Sent back as faulty or wrong')}</Th>
              </tr>
            </thead>
            <tbody>
              {history.periods.map((period) => (
                <Tr key={period.label}>
                  <Td className="font-medium">
                    {t('Q{quarter} {year}', {
                      quarter: Math.floor(period.start.getMonth() / 3) + 1,
                      year: period.start.getFullYear(),
                    })}
                  </Td>
                  <Td numeric className="text-(--text-soft)">
                    {period.measures.orders}
                  </Td>
                  <Td numeric>
                    {period.measures.leadDays === null
                      ? '—'
                      : t('{days}d', { days: period.measures.leadDays })}
                  </Td>
                  <Td numeric>
                    {period.measures.onTimePct === null ? '—' : `${period.measures.onTimePct}%`}
                  </Td>
                  <Td numeric>
                    {period.measures.fillPct === null ? '—' : `${period.measures.fillPct}%`}
                  </Td>
                  <Td numeric>
                    {period.measures.returnPct === null ? '—' : `${period.measures.returnPct}%`}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Orders')}
          description={t('Newest first, with what was promised against what happened.')}
        />
        {supplier.orders.length === 0 ? (
          <EmptyState
            title={t('No orders yet')}
            description={t('Raise one from the purchasing screen and it will appear here.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Order')}</Th>
                  <Th>{t('Placed')}</Th>
                  <Th>{t('Promised')}</Th>
                  <Th>{t('Arrived')}</Th>
                  <Th>{t('State')}</Th>
                  <Th numeric>{t('Value')}</Th>
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
                        <span className="text-(--text-faint)">{t('not yet')}</span>
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
                        {t(order.status.toLowerCase().replace('_', ' '))}
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
