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
import { tFor } from '@/lib/i18n';
import { quantityOnOrder, usageHistory } from '@/lib/inventory';
import { supplierOptionsFor } from '@/lib/owner';
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
  const t = await tFor();
  return { title: product?.name ?? t('Part') };
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
  const t = await tFor();

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

  const [usage, onOrder, suppliers] = await Promise.all([
    usageHistory(product.id),
    quantityOnOrder(orgId, product.id),
    supplierOptionsFor(orgId, product.id),
  ]);

  // The wait that matters is the quickest supplier who can be measured, not a
  // number somebody typed once. Three days when nobody can be measured yet.
  const measuredWaits = suppliers
    .map((option) => option.measures.leadDays)
    .filter((days): days is number => days !== null);
  const leadTimeDays = measuredWaits.length > 0 ? Math.min(...measuredWaits) : 3;

  const summary = summariseStock(position, Number(product.reorderPoint), onOrder);

  const suggestion = suggestReorder({
    available: summary.available,
    onOrder,
    usage,
    leadTimeDays,
    minimumOrderQuantity: Number(product.reorderQty) || undefined,
  });

  return (
    <>
      <div className="mb-3">
        <BackLink href="/parts">{t('All parts')}</BackLink>
      </div>

      <PageHeader
        eyebrow={product.category?.name ?? t('Part')}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {product.name}
            <Badge tone={stockTone(summary.state)} dot>
              {t(describeStockState(summary.state))}
            </Badge>
          </span>
        }
        description={`${product.partNumber}${product.brand ? ` · ${product.brand}` : ''}`}
        actions={
          <>
            {/* Labels for the shelf, as many as there are to stick. Phase 42. */}
            <form action="/print/labels/sheet" method="get" className="flex items-center gap-1.5">
              <input type="hidden" name="part" value={product.id} />
              <Input
                name="copies"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
                className="h-9 w-16"
                aria-label={t('How many labels')}
              />
              <Button type="submit" variant="secondary">
                {t('Print labels')}
              </Button>
            </form>
            <Button>{t('Adjust stock')}</Button>
            {suggestion.quantity > 0 ? (
              <Link href={`/purchasing/new?product=${product.id}&qty=${suggestion.quantity}`}>
                <Button variant="primary">
                  {t('Order {quantity}', { quantity: suggestion.quantity })}
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {summary.state === 'OVER' ? (
        <Alert tone="danger" title={t('More has been issued than was recorded')} className="mb-5">
          {t(
            'The balance is {balance}. Something was fitted without being booked in, or a delivery was never received onto the system. A stocktake will correct it and record the variance.',
            { balance: position.onHand },
          )}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title={t('Stock')}
              description={level?.warehouse.name ?? t('No stock record')}
            />
            <CardBody>
              <KeyValue
                t={t}
                columns={3}
                items={[
                  { label: t('On hand'), value: position.onHand },
                  { label: t('Reserved'), value: position.reserved },
                  { label: t('Available'), value: summary.available },
                  { label: t('On order'), value: onOrder || null },
                  { label: t('Reorder point'), value: Number(product.reorderPoint) },
                  { label: t('Bin'), value: level?.binLocation },
                  {
                    label: t('Weighted average cost'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(position.avgCost)}
                      />
                    ),
                  },
                  {
                    label: t('Sell price'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(product.sellPrice)}
                      />
                    ),
                  },
                  {
                    label: t('Stock value'),
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
              title={t('Movements')}
              description={t('Every change to this balance, newest first')}
            />
            {product.movements.length === 0 ? (
              <EmptyState title={t('No movements')} description={t('Nothing has moved yet.')} />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Date')}</Th>
                      <Th>{t('Type')}</Th>
                      <Th numeric>{t('Quantity')}</Th>
                      <Th numeric>{t('Unit cost')}</Th>
                      <Th numeric>{t('Balance')}</Th>
                      <Th>{t('Reason')}</Th>
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
                              {t(movement.type.toLowerCase().replace('_', ' '))}
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
              title={t('Reorder')}
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
                  {t(suggestion.confidence)}
                </Badge>
              }
            />
            <CardBody className="grid gap-3">
              {suggestion.quantity > 0 ? (
                <div>
                  <p className="eyebrow">{t('Suggested order')}</p>
                  <p className="font-display text-[28px] font-semibold leading-none tabular">
                    {suggestion.quantity}
                  </p>
                </div>
              ) : null}

              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                {t(suggestion.reason)}
              </p>

              <dl className="grid gap-1.5 border-t border-(--border) pt-3 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Average use')}</dt>
                  <dd className="tabular">
                    {t('{count}/day', { count: suggestion.averageDailyUsage })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Days of cover')}</dt>
                  <dd className="tabular">
                    {suggestion.daysOfCover === null ? '—' : suggestion.daysOfCover}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-faint)">{t('Calculated reorder point')}</dt>
                  <dd className="tabular">{suggestion.reorderPoint}</dd>
                </div>
              </dl>

              <p className="text-[11px] text-(--text-faint)">
                {t(describeConfidence(suggestion.confidence))}.
              </p>
            </CardBody>
          </Card>

          {product.reservations.length > 0 ? (
            <Card>
              <CardHeader
                title={t('Reserved for')}
                description={
                  product.reservations.length === 1
                    ? t('1 open reservation')
                    : t('{count} open reservations', { count: product.reservations.length })
                }
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
                      <span className="text-(--text-faint)">{t('Unlinked')}</span>
                    )}
                    <span className="tabular">{Number(reservation.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>

      <Card
        id="suppliers"
        className={`mt-5 overflow-hidden ${summary.needsOrdering ? 'border-(--warning)' : ''}`}
      >
        <CardHeader
          title={t('Who to buy it from')}
          description={
            summary.needsOrdering
              ? t(
                  'Short, and nothing on order. Every supplier side by side: what they last charged for this part, and how they have delivered over the last year.',
                )
              : t(
                  'Every supplier side by side: what they last charged for this part, and how they have delivered over the last year.',
                )
          }
        />
        {suppliers.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            {t('There are no suppliers yet.')}{' '}
            <Link href="/suppliers/new" className="font-medium hover:underline">
              {t('Add one to order from.')}
            </Link>
          </CardBody>
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Supplier')}</Th>
                  <Th numeric>{t('Last cost')}</Th>
                  <Th numeric>{t('Supplied')}</Th>
                  <Th numeric>{t('Typical wait')}</Th>
                  <Th numeric>{t('By the day promised')}</Th>
                  <Th numeric>{t('Sent back')}</Th>
                  <Th>
                    <span className="sr-only">{t('Order')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((option) => (
                  <Tr key={option.id}>
                    <Td>
                      <Link
                        href={`/suppliers/${option.id}`}
                        className="font-medium hover:underline"
                      >
                        {option.name}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {option.cheapest ? (
                          <Badge tone="success" size="sm">
                            {t('cheapest last time')}
                          </Badge>
                        ) : null}
                        {option.quickest ? (
                          <Badge tone="info" size="sm">
                            {t('quickest')}
                          </Badge>
                        ) : null}
                        {option.mostReliable ? (
                          <Badge tone="brand" size="sm">
                            {t('most reliable')}
                          </Badge>
                        ) : null}
                      </span>
                    </Td>
                    <Td numeric>
                      {option.lastCost === null ? (
                        <span className="text-(--text-faint)">{t('never bought')}</span>
                      ) : (
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={option.lastCost}
                        />
                      )}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {option.timesSupplied}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {option.measures.leadDays === null
                        ? '—'
                        : t('{days}d', { days: option.measures.leadDays })}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {option.measures.onTimePct === null ? '—' : `${option.measures.onTimePct}%`}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {option.measures.returnPct === null ? '—' : `${option.measures.returnPct}%`}
                    </Td>
                    <Td numeric>
                      <Link
                        href={`/purchasing/new?${new URLSearchParams({
                          supplierId: option.id,
                          product: product.id,
                          qty: String(suggestion.quantity > 0 ? suggestion.quantity : 1),
                          ...(option.lastCost !== null ? { cost: String(option.lastCost) } : {}),
                        }).toString()}`}
                      >
                        <Button size="sm" variant={summary.needsOrdering ? 'primary' : 'secondary'}>
                          {t('Order {quantity}', {
                            quantity: suggestion.quantity > 0 ? suggestion.quantity : 1,
                          })}
                        </Button>
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
          {t(
            'A figure shows only when three orders or more stand behind it. Cheapest, quickest and most reliable are marked only where two suppliers can be compared. The choice is yours: a part needed by four o’clock is worth the extra pound.',
          )}
        </CardBody>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('What it fits')}
          description={t(
            'Nothing recorded is not the same as fits anything. A part with no rows here raises no warning either way.',
          )}
        />

        {error ? (
          <CardBody className="border-b border-(--border) text-[13px] text-(--danger)">
            {t(error)}
          </CardBody>
        ) : null}

        {fitments.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            {t(
              'Nobody has recorded what this part fits. Until somebody does, putting it on a job raises no warning, because silence here means unknown rather than approved.',
            )}
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
                    {fitment.engineCode
                      ? `${t('Engine {code}', { code: fitment.engineCode })} · `
                      : ''}
                    {t(fitment.source.toLowerCase())} · {fitment.createdBy?.name ?? t('unknown')}
                  </span>
                </div>

                <form action={dropFitment}>
                  <input type="hidden" name="productId" value={id} />
                  <input type="hidden" name="fitmentId" value={fitment.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    {t('Remove')}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addFitment} className="border-t border-(--border)">
          <input type="hidden" name="productId" value={id} />
          <CardBody className="grid gap-3 sm:grid-cols-[1fr_1fr_5rem_5rem_1fr_auto] sm:items-end">
            <Field label={t('Make')}>
              {/* i18n-ignore */}
              <Input name="make" required placeholder="Honda" />
            </Field>
            <Field label={t('Model')} hint={t('Blank means every model.')}>
              {/* i18n-ignore */}
              <Input name="model" placeholder="Civic" />
            </Field>
            <Field label={t('From')}>
              <Input type="number" name="yearFrom" min={1885} max={2200} placeholder="2018" />
            </Field>
            <Field label={t('To')}>
              <Input type="number" name="yearTo" min={1885} max={2200} placeholder="2022" />
            </Field>
            <Field label={t('Engine')} hint={t('Where one model spans two.')}>
              {/* i18n-ignore */}
              <Input name="engineCode" placeholder="L15B7" />
            </Field>
            <Button type="submit" variant="primary">
              {t('Record')}
            </Button>
          </CardBody>
        </form>
      </Card>
    </>
  );
}
