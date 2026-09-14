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
  Field,
  Input,
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
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { quantityOnOrder, usageHistory } from '@/lib/inventory';
import { fitmentsFor, recordFitment, removeFitment } from '@/lib/provenance';

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
/**
 * Records what this part fits. FR-3404.
 *
 * Typed by a person, because guessing fitment puts wrong parts on cars and
 * the one who finds out is braking. When a fitment provider is wired in this
 * is where its rows land too, distinguished by their source rather than by
 * being somewhere else.
 */
async function addFitment(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  const productId = String(formData.get('productId') ?? '');
  const year = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw ? Number(raw) : null;
  };

  try {
    await recordFitment({
      orgId,
      userId: user.userId,
      productId,
      make: String(formData.get('make') ?? ''),
      model: String(formData.get('model') ?? ''),
      yearFrom: year('yearFrom'),
      yearTo: year('yearTo'),
      engineCode: String(formData.get('engineCode') ?? ''),
      source: 'WORKSHOP',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That could not be recorded.';
    redirect(`/parts/${productId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/parts/${productId}`);
}

async function dropFitment(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  const productId = String(formData.get('productId') ?? '');

  await removeFitment({
    orgId,
    userId: user.userId,
    fitmentId: String(formData.get('fitmentId') ?? ''),
  });

  redirect(`/parts/${productId}`);
}

export default async function PartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { db, orgId, region } = await requireSession('inventory:read');

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

  const { error } = await searchParams;
  const fitments = await fitmentsFor(orgId, id);

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
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(position.avgCost)}
                      />
                    ),
                  },
                  {
                    label: 'Sell price',
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(product.sellPrice)}
                      />
                    ),
                  },
                  {
                    label: 'Stock value',
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={position.onHand * Number(position.avgCost)}
                      />
                    ),
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
                            {movement.createdAt.toLocaleDateString(region.locale)}
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
                            <Money
                              currency={region.currency}
                              locale={region.locale}
                              amount={Number(movement.unitCost)}
                            />
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

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="What it fits"
          description="Nothing recorded is not the same as fits anything. A part with no rows here raises no warning either way."
        />

        {error ? (
          <CardBody className="border-b border-(--border) text-[13px] text-(--danger)">
            {error}
          </CardBody>
        ) : null}

        {fitments.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            Nobody has recorded what this part fits. Until somebody does, putting it on a job raises
            no warning, because silence here means unknown rather than approved.
          </CardBody>
        ) : (
          <ul className="divide-y divide-(--border)">
            {fitments.map((fitment) => (
              <li
                key={fitment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-medium">
                    {fitment.make}
                    {fitment.model ? ` ${fitment.model}` : ''}
                    {fitment.yearFrom || fitment.yearTo
                      ? ` ${fitment.yearFrom ?? ''}–${fitment.yearTo ?? ''}`
                      : ''}
                  </span>
                  <span className="block text-[11px] text-(--text-faint)">
                    {fitment.engineCode ? `Engine ${fitment.engineCode} · ` : ''}
                    {fitment.source.toLowerCase()} · {fitment.createdBy?.name ?? 'unknown'}
                  </span>
                </div>

                <form action={dropFitment}>
                  <input type="hidden" name="productId" value={id} />
                  <input type="hidden" name="fitmentId" value={fitment.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addFitment} className="border-t border-(--border)">
          <input type="hidden" name="productId" value={id} />
          <CardBody className="grid gap-3 sm:grid-cols-[1fr_1fr_5rem_5rem_1fr_auto] sm:items-end">
            <Field label="Make">
              <Input name="make" required placeholder="Honda" />
            </Field>
            <Field label="Model" hint="Blank means every model.">
              <Input name="model" placeholder="Civic" />
            </Field>
            <Field label="From">
              <Input type="number" name="yearFrom" min={1885} max={2200} placeholder="2018" />
            </Field>
            <Field label="To">
              <Input type="number" name="yearTo" min={1885} max={2200} placeholder="2022" />
            </Field>
            <Field label="Engine" hint="Where one model spans two.">
              <Input name="engineCode" placeholder="L15B7" />
            </Field>
            <Button type="submit" variant="primary">
              Record
            </Button>
          </CardBody>
        </form>
      </Card>
    </>
  );
}
