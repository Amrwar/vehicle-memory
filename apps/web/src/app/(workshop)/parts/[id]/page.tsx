import {
  describeConfidence,
  describeStockState,
  stockTone,
  suggestReorder,
  summariseStock,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  Money,
  PageHeader,
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
import { quantityOnOrder, usageHistory } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('inventory:read');
  const product = await db.product.findUnique({ where: { id }, select: { name: true } });
  return { title: product?.name ?? 'Part' };
}

/**
 * A part, with its movement history and a reorder suggestion.
 *
 * The suggestion states its own confidence. A quantity derived from two data
 * points should not be presented with the same authority as one derived from
 * forty, and hiding that distinction is how people learn to distrust the
 * whole feature.
 */
export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, orgId } = await requireSession('inventory:read');

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      stockLevels: { include: { warehouse: { select: { name: true } } } },
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { warehouse: { select: { name: true } } },
      },
      reservations: {
        where: { releasedAt: null },
        include: {
          jobPartLine: { select: { job: { select: { id: true, number: true } } } },
        },
      },
    },
  });

  if (!product) notFound();

  const level = product.stockLevels[0];
  const position = {
    onHand: Number(level?.onHand ?? 0),
    reserved: Number(level?.reserved ?? 0),
    avgCost: String(level?.avgCost ?? 0),
  };

  const [usage, onOrder] = await Promise.all([
    usageHistory(product.id),
    quantityOnOrder(orgId, product.id),
  ]);

  const summary = summariseStock(position, Number(product.reorderPoint), onOrder);

  const suggestion = suggestReorder({
    available: summary.available,
    onOrder,
    usage,
    leadTimeDays: 3,
    minimumOrderQuantity: Number(product.reorderQty) || undefined,
  });

  return (
    <>
      <div className="mb-3">
        <BackLink href="/parts">All parts</BackLink>
      </div>

      <PageHeader
        eyebrow={product.category?.name ?? 'Part'}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {product.name}
            <Badge tone={stockTone(summary.state)} dot>
              {describeStockState(summary.state)}
            </Badge>
          </span>
        }
        description={`${product.partNumber}${product.brand ? ` · ${product.brand}` : ''}`}
        actions={
          <>
            <Button>Adjust stock</Button>
            {suggestion.quantity > 0 ? (
              <Link href={`/purchasing/new?product=${product.id}&qty=${suggestion.quantity}`}>
                <Button variant="primary">Order {suggestion.quantity}</Button>
              </Link>
            ) : null}
          </>
        }
      />

      {summary.state === 'OVER' ? (
        <Alert tone="danger" title="More has been issued than was recorded" className="mb-5">
          The balance is {position.onHand}. Something was fitted without being booked in, or a
          delivery was never received onto the system. A stocktake will correct it and record the
          variance.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Stock" description={level?.warehouse.name ?? 'No stock record'} />
            <CardBody>
              <KeyValue
                columns={3}
                items={[
                  { label: 'On hand', value: position.onHand },
                  { label: 'Reserved', value: position.reserved },
                  { label: 'Available', value: summary.available },
                  { label: 'On order', value: onOrder || null },
                  { label: 'Reorder point', value: Number(product.reorderPoint) },
                  { label: 'Bin', value: level?.binLocation },
                  {
                    label: 'Weighted average cost',
                    value: <Money amount={Number(position.avgCost)} />,
                  },
                  { label: 'Sell price', value: <Money amount={Number(product.sellPrice)} /> },
                  {
                    label: 'Stock value',
                    value: <Money amount={position.onHand * Number(position.avgCost)} />,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Movements"
              description="Every change to this balance, newest first"
            />
            {product.movements.length === 0 ? (
              <EmptyState title="No movements" description="Nothing has moved yet." />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th numeric>Quantity</Th>
                      <Th numeric>Unit cost</Th>
                      <Th numeric>Balance</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.movements.map((movement) => {
                      const quantity = Number(movement.quantity);
                      return (
                        <Tr key={movement.id}>
                          <Td className="datum whitespace-nowrap text-(--text-faint)">
                            {movement.createdAt.toLocaleDateString('en-GB')}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                movement.type === 'RECEIPT'
                                  ? 'success'
                                  : movement.type === 'ISSUE'
                                    ? 'info'
                                    : 'neutral'
                              }
                              size="sm"
                            >
                              {movement.type.toLowerCase().replace('_', ' ')}
                            </Badge>
                          </Td>
                          <Td numeric className={quantity < 0 ? 'text-(--danger)' : ''}>
                            {quantity > 0 ? '+' : ''}
                            {quantity}
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            <Money amount={Number(movement.unitCost)} />
                          </Td>
                          <Td numeric>{Number(movement.balanceAfter)}</Td>
                          <Td className="text-(--text-faint)">{movement.reason ?? '—'}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card className={suggestion.urgent ? 'border-(--danger)' : undefined}>
            <CardHeader
              title="Reorder"
              action={
                <Badge
                  tone={
                    suggestion.confidence === 'high'
                      ? 'success'
                      : suggestion.confidence === 'none'
                        ? 'neutral'
                        : 'warning'
                  }
                  size="sm"
                >
                  {suggestion.confidence}
                </Badge>
              }
            />
            <CardBody className="grid gap-3">
              {suggestion.quantity > 0 ? (
                <div>
                  <p className="eyebrow">Suggested order</p>
                  <p className="font-display text-[28px] font-semibold leading-none tabular">
                    {suggestion.quantity}
                  </p>
                </div>
              ) : null}

              <p className="text-[13px] leading-relaxed text-(--text-soft)">{suggestion.reason}</p>

              <dl className="grid gap-1.5 border-t border-(--border) pt-3 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">Average use</dt>
                  <dd className="tabular">{suggestion.averageDailyUsage}/day</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">Days of cover</dt>
                  <dd className="tabular">
                    {suggestion.daysOfCover === null ? '—' : suggestion.daysOfCover}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">Calculated reorder point</dt>
                  <dd className="tabular">{suggestion.reorderPoint}</dd>
                </div>
              </dl>

              <p className="text-[11px] text-(--text-faint)">
                {describeConfidence(suggestion.confidence)}.
              </p>
            </CardBody>
          </Card>

          {product.reservations.length > 0 ? (
            <Card>
              <CardHeader
                title="Reserved for"
                description={`${product.reservations.length} open reservation${product.reservations.length === 1 ? '' : 's'}`}
              />
              <ul className="divide-y divide-(--border)">
                {product.reservations.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                  >
                    {reservation.jobPartLine?.job ? (
                      <Link
                        href={`/jobs/${reservation.jobPartLine.job.id}`}
                        className="datum font-medium hover:underline"
                      >
                        #{reservation.jobPartLine.job.number}
                      </Link>
                    ) : (
                      <span className="text-(--text-faint)">Unlinked</span>
                    )}
                    <span className="tabular">{Number(reservation.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
