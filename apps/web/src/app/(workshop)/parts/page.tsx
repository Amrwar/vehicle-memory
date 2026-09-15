import { describeStockState, stockTone, summariseStock } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
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
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Parts') };
}
export const dynamic = 'force-dynamic';

/**
 * The parts list.
 *
 * Sorted so that what needs attention is at the top, because a parts list
 * ordered alphabetically is a list nobody scrolls to the bottom of. The state
 * column distinguishes "none left" from "issued more than we recorded", which
 * are different problems with different fixes.
 */
export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { db, region } = await requireSession('inventory:read');
  const t = await tFor();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const lowOnly = params.view === 'low';

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { partNumber: { contains: query, mode: 'insensitive' as const } },
              { brand: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { name: true } },
      stockLevels: { select: { onHand: true, reserved: true, avgCost: true, binLocation: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  // Outstanding order quantities, so a part already on its way is not
  // presented as needing an order.
  const onOrderRows = await db.purchaseOrder.findMany({
    where: { status: { in: ['SENT', 'PART_RECEIVED'] } },
    select: { lines: { select: { productId: true, quantity: true, received: true } } },
  });

  const onOrderByProduct = new Map<string, number>();
  for (const order of onOrderRows) {
    for (const line of order.lines) {
      if (!line.productId) continue;
      const outstanding = Math.max(0, Number(line.quantity) - Number(line.received));
      onOrderByProduct.set(
        line.productId,
        (onOrderByProduct.get(line.productId) ?? 0) + outstanding,
      );
    }
  }

  const rows = products.map((product) => {
    const level = product.stockLevels[0];
    const position = {
      onHand: Number(level?.onHand ?? 0),
      reserved: Number(level?.reserved ?? 0),
      avgCost: String(level?.avgCost ?? 0),
    };
    const onOrder = onOrderByProduct.get(product.id) ?? 0;
    const summary = summariseStock(position, Number(product.reorderPoint), onOrder);

    return {
      product,
      position,
      onOrder,
      summary,
      bin: level?.binLocation ?? null,
      value: position.onHand * Number(position.avgCost),
    };
  });

  // Attention first: over-issued, then out, then short, then the rest.
  const priority: Record<string, number> = { OVER: 0, OUT: 1, SHORT: 2, LOW: 3, OK: 4 };
  rows.sort(
    (a, b) =>
      priority[a.summary.state]! - priority[b.summary.state]! ||
      a.product.name.localeCompare(b.product.name),
  );

  const visible = lowOnly ? rows.filter((row) => row.summary.needsOrdering) : rows;

  const totalValue = rows.reduce((total, row) => total + row.value, 0);
  const needsOrdering = rows.filter((row) => row.summary.needsOrdering).length;
  const negative = rows.filter((row) => row.summary.state === 'OVER').length;

  return (
    <>
      <PageHeader
        eyebrow={t('Inventory')}
        title={t('Parts')}
        description={
          rows.length === 1
            ? t('1 part in the catalogue')
            : t('{count} parts in the catalogue', { count: rows.length })
        }
        actions={
          <>
            <Link href="/purchasing">
              <Button>{t('Purchasing')}</Button>
            </Link>
            <Link href="/parts/new">
              <Button variant="primary">{t('New part')}</Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Stock value')}
          value={<Money currency={region.currency} locale={region.locale} amount={totalValue} />}
          note={t('At weighted average cost')}
        />
        <Link href="/parts?view=low" className="group">
          <StatTile
            label={t('Need ordering')}
            value={needsOrdering}
            tone={needsOrdering > 0 ? 'warning' : 'neutral'}
            note={
              needsOrdering > 0
                ? t('Below reorder point, nothing on order')
                : t('Nothing outstanding')
            }
          />
        </Link>
        <StatTile
          label={t('Negative balances')}
          value={negative}
          tone={negative > 0 ? 'danger' : 'neutral'}
          note={negative > 0 ? t('Issued more than recorded') : t('All balances positive')}
        />
        <StatTile
          label={t('On order')}
          value={[...onOrderByProduct.values()].reduce((a, b) => a + b, 0)}
          note={t('Units on outstanding orders')}
        />
      </StatRow>

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/parts">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t('Name, part number or brand')}
          aria-label={t('Search parts')}
          className="h-9 w-full max-w-xs rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
        <Button type="submit">{t('Search')}</Button>
        {lowOnly ? (
          <Link href="/parts" className="text-[12px] text-(--text-faint) underline">
            {t('Show all parts')}
          </Link>
        ) : (
          <Link href="/parts?view=low" className="text-[12px] text-(--text-faint) underline">
            {t('Only those needing an order')}
          </Link>
        )}
      </form>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            title={lowOnly ? t('Nothing needs ordering') : t('No parts found')}
            description={
              lowOnly
                ? t('Every part is above its reorder point or already on order.')
                : t('Add a part, or import your supplier catalogue.')
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Part')}</Th>
                  <Th>{t('Category')}</Th>
                  <Th>{t('Bin')}</Th>
                  <Th numeric>{t('On hand')}</Th>
                  <Th numeric>{t('Reserved')}</Th>
                  <Th numeric>{t('Available')}</Th>
                  <Th numeric>{t('On order')}</Th>
                  <Th numeric>{t('Cost')}</Th>
                  <Th numeric>{t('Value')}</Th>
                  <Th>{t('State')}</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ product, position, summary, onOrder, bin, value }) => (
                  <Tr key={product.id}>
                    <Td>
                      <Link href={`/parts/${product.id}`} className="font-medium hover:underline">
                        {product.name}
                      </Link>
                      <span className="datum ms-2 text-[11px] text-(--text-faint)">
                        {product.partNumber}
                      </span>
                    </Td>
                    <Td className="text-(--text-faint)">{product.category?.name ?? '—'}</Td>
                    <Td className="datum text-(--text-faint)">{bin ?? '—'}</Td>
                    <Td numeric>{position.onHand}</Td>
                    <Td numeric className="text-(--text-faint)">
                      {position.reserved || '—'}
                    </Td>
                    <Td numeric className="font-medium">
                      {summary.available}
                    </Td>
                    <Td numeric className="text-(--text-faint)">
                      {onOrder || '—'}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(position.avgCost)}
                      />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money currency={region.currency} locale={region.locale} amount={value} />
                    </Td>
                    <Td>
                      <Badge tone={stockTone(summary.state)} dot>
                        {t(describeStockState(summary.state))}
                      </Badge>
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
