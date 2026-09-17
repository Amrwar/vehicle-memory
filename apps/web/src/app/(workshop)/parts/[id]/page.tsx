import {
  describeConfidence,
  describeStockState,
  msg,
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
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { adjustStock, quantityOnOrder, recordStocktake, usageHistory } from '@/lib/inventory';
import { once, onceToken, StillGoingError } from '@/lib/once';
import { SubmitOnce } from '@/components/submit-once';
import { supplierOptionsFor } from '@/lib/owner';
import { fitmentsFor, recordFitment, removeFitment } from '@/lib/provenance';
import { PricingError, setSitePrice, sitePricesFor, sitesOf } from '@/lib/pricing';
import { fetchFeedFitments, fitmentFeed } from '@/lib/providers';

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
/**
 * What the shelf actually holds, after somebody has counted it.
 *
 * A count is a set rather than a change: whoever is standing at the rack with
 * a clipboard knows what is there, not what the difference is. Working out the
 * difference is the product's job, and it writes it as a movement so the
 * balance can still be explained afterwards.
 *
 * This was the piece missing from stock. Every other movement — receiving,
 * issuing, transferring — had a screen; the one a workshop does every quarter
 * could only be done by importing a spreadsheet.
 */
async function count(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const productId = String(formData.get('productId') ?? '');
  const warehouseId = String(formData.get('warehouseId') ?? '');
  const counted = Number(String(formData.get('counted') ?? '').trim());

  if (!Number.isFinite(counted) || counted < 0) {
    redirect(
      `/parts/${productId}?problem=${encodeURIComponent(msg('Count it again: that is not a number of parts.'))}`,
    );
  }

  await once({
    orgId,
    key: ['stocktake', productId, warehouseId, String(formData.get('once') ?? '')],
    work: () => recordStocktake({ orgId, productId, warehouseId, counted }),
  }).catch((error: unknown) => {
    if (error instanceof StillGoingError) {
      redirect(`/parts/${productId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  });

  void user;
  redirect(`/parts/${productId}?done=counted`);
}

/**
 * A known movement with a reason: two were damaged, one was taken for a
 * courtesy car. Separate from a count, because "minus two, broken" and
 * "there are four" are different claims and the second one hides the first.
 */
async function adjust(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('inventory:write');
  const productId = String(formData.get('productId') ?? '');
  const warehouseId = String(formData.get('warehouseId') ?? '');
  const quantity = Number(String(formData.get('quantity') ?? '').trim());
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isFinite(quantity) || quantity === 0) {
    redirect(`/parts/${productId}?problem=${encodeURIComponent(msg('Say how many, up or down.'))}`);
  }

  if (!reason) {
    redirect(
      `/parts/${productId}?problem=${encodeURIComponent(msg('An adjustment carries a reason, or the balance cannot be explained later.'))}`,
    );
  }

  await once({
    orgId,
    key: ['adjust-stock', productId, warehouseId, String(formData.get('once') ?? '')],
    work: () => adjustStock({ orgId, productId, warehouseId, quantity, reason }),
  }).catch((error: unknown) => {
    if (error instanceof StillGoingError) {
      redirect(`/parts/${productId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  });

  redirect(`/parts/${productId}?done=adjusted`);
}

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

/**
 * Asks the catalogue what this part fits. Phase 43.
 *
 * What somebody here recorded stays; what the catalogue already said is not
 * written twice; what it said before and no longer says is taken back.
 */
async function fetchFitments(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const productId = String(formData.get('productId') ?? '');

  let summary: string;
  try {
    const result = await fetchFeedFitments({ orgId, userId: user.userId, productId });
    summary = [result.added, result.removed, result.unchanged, result.keptWorkshop].join('.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That could not be fetched.';
    redirect(`/parts/${productId}?error=${encodeURIComponent(message)}#fits`);
  }

  redirect(`/parts/${productId}?feed=${summary}#fits`);
}

/**
 * What this part sells for at one site. Phase 44.
 *
 * An empty box clears the site's price rather than writing nought, because a
 * part given away and a part priced like everywhere else are different things.
 */
async function priceAtSite(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const productId = String(formData.get('productId') ?? '');
  const raw = String(formData.get('sellPrice') ?? '').trim();

  try {
    await setSitePrice({
      orgId,
      userId: user.userId,
      productId,
      locationId: String(formData.get('locationId') ?? ''),
      sellPrice: raw === '' ? null : Number(raw.replace(',', '.')),
    });
  } catch (error) {
    const message =
      error instanceof PricingError ? error.message : 'That price could not be saved.';
    redirect(`/parts/${productId}?error=${encodeURIComponent(message)}#prices`);
  }

  redirect(`/parts/${productId}#prices`);
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
  searchParams: Promise<{ error?: string; feed?: string; problem?: string; done?: string }>;
}) {
  const { id } = await params;
  const { db, orgId, region, user } = await requireSession('inventory:read');
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

  const { error, feed: fetched, problem, done } = await searchParams;
  const fitments = await fitmentsFor(orgId, id);
  const feed = fitmentFeed();
  const [sites, sitePrices] = await Promise.all([sitesOf(orgId), sitePricesFor(orgId, id)]);
  const mayFetch = feed !== null && can(user.role, 'inventory:write');
  const [added, removed, unchanged, kept] = (fetched ?? '').split('.').map(Number);

  const level = product.stockLevels[0];
  const position = {
    onHand: Number(level?.onHand ?? 0),
    reserved: Number(level?.reserved ?? 0),
    avgCost: String(level?.avgCost ?? 0),
  };

  const mayCount = can(user.role, 'inventory:write') && Boolean(level);
  const token = onceToken();

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

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'counted'
            ? t('Counted. The shelf says what you counted, and the difference is a movement.')
            : t('Adjusted, with the reason against it.')}
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

          {mayCount ? (
            <Card>
              <CardHeader
                title={t('Put the shelf right')}
                description={t(
                  'A count says what is there; an adjustment says what moved and why. Both leave a movement behind.',
                )}
              />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <form action={count} className="grid content-start gap-3">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="warehouseId" value={level!.warehouseId} />
                  <input type="hidden" name="once" value={`${token}:count`} />
                  <Field
                    label={t('Counted on the shelf')}
                    hint={t('What is actually there, not the difference')}
                  >
                    <Input
                      name="counted"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={position.onHand}
                      className="tabular"
                      required
                    />
                  </Field>
                  <SubmitOnce variant="secondary">{t('Record the count')}</SubmitOnce>
                </form>

                <form action={adjust} className="grid content-start gap-3">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="warehouseId" value={level!.warehouseId} />
                  <input type="hidden" name="once" value={`${token}:adjust`} />
                  <Field label={t('Adjust by')} hint={t('Negative to take some off')}>
                    <Input
                      name="quantity"
                      type="number"
                      step="1"
                      placeholder="-2"
                      className="tabular"
                      required
                    />
                  </Field>
                  <Field label={t('Why')}>
                    <Input name="reason" required placeholder={t('Two damaged in the rack')} />
                  </Field>
                  <SubmitOnce variant="secondary">{t('Record the adjustment')}</SubmitOnce>
                </form>
              </CardBody>
            </Card>
          ) : null}

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

      {sites.length > 1 ? (
        <Card id="prices" className="mt-5 overflow-hidden">
          <CardHeader
            title={t('Price at each site')}
            description={t(
              'Empty means the part’s own price. A figure here is what this site charges, and it does not move when the list does.',
            )}
          />
          <ul className="divide-y divide-(--border)">
            {sites.map((site) => {
              const held = sitePrices.find((row) => row.locationId === site.id);

              return (
                <li key={site.id} className="px-4 py-2.5">
                  <form action={priceAtSite} className="flex flex-wrap items-end gap-3 text-[13px]">
                    <input type="hidden" name="productId" value={id} />
                    <input type="hidden" name="locationId" value={site.id} />
                    <span className="min-w-[10rem] font-medium">
                      <bdi>{site.name}</bdi>
                    </span>
                    <Field label={t('Sells for')} className="w-[9rem]">
                      <Input
                        name="sellPrice"
                        inputMode="decimal"
                        defaultValue={held ? Number(held.sellPrice).toFixed(2) : ''}
                        placeholder={Number(product.sellPrice).toFixed(2)}
                        disabled={!can(user.role, 'inventory:write')}
                      />
                    </Field>
                    <span className="text-[12px] text-(--text-faint)">
                      {held
                        ? t('This site’s own price. The list is {price}.', {
                            price: Number(product.sellPrice).toFixed(2),
                          })
                        : t('The part’s own price.')}
                    </span>
                    {can(user.role, 'inventory:write') ? (
                      <Button type="submit" size="sm" variant="ghost">
                        {t('Save')}
                      </Button>
                    ) : null}
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card id="fits" className="mt-5 overflow-hidden">
        <CardHeader
          title={t('What it fits')}
          description={t(
            'Nothing recorded is not the same as fits anything. A part with no rows here raises no warning either way.',
          )}
          action={
            mayFetch ? (
              <form action={fetchFitments}>
                <input type="hidden" name="productId" value={id} />
                <Button type="submit" size="sm" variant="secondary">
                  {t('Fetch from {feed}', { feed: t(feed.name) })}
                </Button>
              </form>
            ) : undefined
          }
        />

        {fetched && feed ? (
          <CardBody className="border-b border-(--border) text-[13px]">
            <span className="block font-medium">
              {added === 0 && removed === 0
                ? t('{feed} has nothing new for this part.', { feed: t(feed.name) })
                : t('{feed}: {added} added, {removed} taken back.', {
                    feed: t(feed.name),
                    added: added ?? 0,
                    removed: removed ?? 0,
                  })}
            </span>
            <span className="block text-[12px] text-(--text-faint)">
              {t(
                '{unchanged} already recorded; {kept} left as somebody here recorded them. A fitment typed here is never replaced by a catalogue.',
                { unchanged: unchanged ?? 0, kept: kept ?? 0 },
              )}
            </span>
            {feed.sample ? (
              <span className="block text-[12px] text-(--text-faint)">
                {t(
                  'The sample catalogue knows the demonstration parts only. A real feed is connected per installation.',
                )}
              </span>
            ) : null}
          </CardBody>
        ) : null}

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
                    {t(fitment.source.toLowerCase())} ·{' '}
                    {fitment.feedName && fitment.fetchedAt
                      ? t('{feed}, fetched {date}', {
                          feed: t(fitment.feedName),
                          date: fitment.fetchedAt.toLocaleDateString(region.locale),
                        })
                      : (fitment.createdBy?.name ?? t('unknown'))}
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
