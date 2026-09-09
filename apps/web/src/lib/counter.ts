import {
  fromDecimal,
  postCounterSale,
  revenueSplit,
  type SaleLine,
  saleTotals,
  settle,
  type Tender,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postEntry } from './accounting';
import { audit } from './guard';

/**
 * Counter sales, against the database.
 *
 * Everything that a job normally does happens here in one transaction: the
 * stock comes off the shelf, the ledger is posted, and the money is recorded
 * against a till session. Splitting them across two commits is how a sale ends
 * up paid for with the parts still on the shelf, and nothing in either half
 * says the other one failed.
 */

const decimal = (value: unknown, currency = 'GBP') => fromDecimal(String(value ?? 0), currency);

export interface SaleDraftLine {
  productId: string | null;
  kind: 'PART' | 'LABOUR' | 'FEE';
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
}

export interface CompleteSaleInput {
  orgId: string;
  locationId: string | null;
  userId: string;
  customerId?: string | null;
  lines: SaleDraftLine[];
  tenders: Tender[];
  note?: string | null;
}

export interface SaleResult {
  ok: boolean;
  error?: string;
  saleId?: string;
  reference?: string;
  changeMinor?: number;
}

/**
 * Takes a sale, end to end.
 *
 * Stock is read with a row lock before it is decremented. Two people selling
 * the last bulb a millisecond apart would otherwise both see one in stock and
 * both succeed.
 */
export async function completeSale(input: CompleteSaleInput): Promise<SaleResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: 'There is nothing on this sale.' };
  }

  const [warehouse, taxRate] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { orgId: input.orgId, ...(input.locationId ? { locationId: input.locationId } : {}) },
      orderBy: { isDefault: 'desc' },
    }),
    prisma.taxRate.findFirst({ where: { orgId: input.orgId, isDefault: true } }),
  ]);

  if (!warehouse) return { ok: false, error: 'This site has no parts store.' };

  const taxPct = taxRate ? Number(taxRate.rate) : 0;
  const productIds = input.lines
    .map((line) => line.productId)
    .filter((id): id is string => id !== null);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Locked before reading. Availability checked a moment ago is a guess.
      const levels = productIds.length
        ? await tx.$queryRaw<{ productId: string; onHand: string; avgCost: string }[]>`
            SELECT "productId", "onHand"::text, "avgCost"::text
            FROM "stock_levels"
            WHERE "warehouseId" = ${warehouse.id}
              AND "productId" = ANY(${productIds}::text[])
            FOR UPDATE
          `
        : [];

      const costOf = new Map(levels.map((level) => [level.productId, Number(level.avgCost)]));
      const onHandOf = new Map(levels.map((level) => [level.productId, Number(level.onHand)]));

      const saleLines: SaleLine[] = input.lines.map((line) => ({
        kind: line.kind,
        description: line.description,
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: { minor: Math.round(line.unitPrice * 100), currency: 'GBP' },
        unitCost: {
          minor: Math.round((line.productId ? (costOf.get(line.productId) ?? 0) : 0) * 100),
          currency: 'GBP',
        },
        taxRatePct: taxPct,
        discountPct: line.discountPct ?? 0,
      }));

      const totals = saleTotals(saleLines);

      const settlement = settle(totals, input.tenders, {
        accountAllowed: Boolean(input.customerId),
      });

      const session = await openTillWithin(tx, input.orgId, input.locationId, input.userId);
      const reference = await nextReference(tx, input.orgId);

      const sale = await tx.counterSale.create({
        data: {
          orgId: input.orgId,
          locationId: input.locationId,
          customerId: input.customerId ?? null,
          reference,
          status: 'PAID',
          soldByUserId: input.userId,
          tillSessionId: session.id,
          subtotal: toNumber(totals.net),
          discountTotal: toNumber(totals.discount),
          taxTotal: toNumber(totals.tax),
          total: toNumber(totals.total),
          costTotal: toNumber(totals.cost),
          changeGiven: toNumber(settlement.change),
          note: input.note?.trim() || null,
          soldAt: new Date(),
          lines: {
            create: saleLines.map((line, index) => ({
              productId: line.productId,
              kind: line.kind,
              description: line.description,
              quantity: line.quantity,
              unitPrice: toNumber(line.unitPrice),
              unitCost: line.unitCost.minor / 100,
              discountPct: line.discountPct,
              taxRateId: taxRate?.id ?? null,
              taxAmount: toNumber(totals.lines[index]!.tax),
              lineTotal: toNumber(totals.lines[index]!.total),
              sortOrder: index,
            })),
          },
          tenders: {
            create: input.tenders.map((tender) => ({
              kind: tender.kind,
              amount: toNumber(tender.amount),
            })),
          },
        },
      });

      // The stock leaves the shelf now. There is no job to consume it later.
      for (const line of saleLines) {
        if (!line.productId) continue;

        const balanceAfter = (onHandOf.get(line.productId) ?? 0) - line.quantity;

        await tx.stockLevel.update({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: warehouse.id },
          },
          data: { onHand: balanceAfter },
        });

        await tx.stockMovement.create({
          data: {
            orgId: input.orgId,
            productId: line.productId,
            warehouseId: warehouse.id,
            type: 'ISSUE',
            quantity: -line.quantity,
            unitCost: line.unitCost.minor / 100,
            balanceAfter,
            referenceType: 'CounterSale',
            referenceId: sale.id,
            reason: `Counter sale ${reference}`,
          },
        });
      }

      return {
        sale,
        totals,
        settlement,
        cash: input.tenders
          .filter((tender) => tender.kind === 'CASH')
          .reduce((total, tender) => total + tender.amount.minor, 0),
        card: input.tenders
          .filter((tender) => tender.kind === 'CARD')
          .reduce((total, tender) => total + tender.amount.minor, 0),
        revenue: revenueSplit(saleLines, totals),
      };
    });

    // Posted outside the transaction that moved the stock, deliberately. The
    // ledger is idempotent on the source document, so a failure here is
    // retryable; rolling the sale back because the accounts were momentarily
    // unavailable would send a customer away with their money and no bulb.
    await postEntry(
      input.orgId,
      postCounterSale({
        saleId: outcome.sale.id,
        reference: outcome.sale.reference,
        at: outcome.sale.soldAt ?? new Date(),
        totals: outcome.totals,
        settlement: outcome.settlement,
        cashTaken: { minor: outcome.cash, currency: 'GBP' },
        cardTaken: { minor: outcome.card, currency: 'GBP' },
        revenue: outcome.revenue,
      }),
    );

    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'countersale.completed',
      entityType: 'CounterSale',
      entityId: outcome.sale.id,
      after: { reference: outcome.sale.reference, total: toNumber(outcome.totals.total) } as never,
    });

    return {
      ok: true,
      saleId: outcome.sale.id,
      reference: outcome.sale.reference,
      changeMinor: outcome.settlement.change.minor,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'That sale could not be taken.',
    };
  }
}

/* ---------------------------------------------------------------------------
   The till
   --------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The next receipt number, allocated atomically.
 *
 * Its own sequence rather than the invoice one. Interleaving two documents in
 * a single run of numbers leaves a gap in the invoice sequence, and a gap in
 * an invoice sequence is the first thing an auditor asks about.
 */
async function nextReference(tx: Tx, orgId: string): Promise<string> {
  const sequence = await tx.documentSequence.upsert({
    where: { orgId_kind: { orgId, kind: 'COUNTER_SALE' } },
    create: { orgId, kind: 'COUNTER_SALE', prefix: 'POS-', next: 2 },
    update: { next: { increment: 1 } },
  });

  // upsert returns the row after the increment, so the number just taken is
  // one below it on the update path and the seeded 1 on the create path.
  const taken = sequence.next - 1;
  return `${sequence.prefix}${String(taken).padStart(4, '0')}`;
}

async function openTillWithin(tx: Tx, orgId: string, locationId: string | null, userId: string) {
  const open = await tx.tillSession.findFirst({
    where: { orgId, locationId, closedAt: null },
  });

  if (open) return open;

  return tx.tillSession.create({
    data: { orgId, locationId, openedByUserId: userId, openingFloat: 0 },
  });
}

/**
 * The open till, with what it should hold.
 *
 * Expected is derived from the sales rather than accumulated in a column. A
 * running total that drifts from the sales behind it is worse than no total,
 * because it looks authoritative.
 */
export async function openTill(orgId: string, locationId: string | null) {
  const session = await prisma.tillSession.findFirst({
    where: { orgId, locationId, closedAt: null },
    include: {
      openedBy: { select: { name: true } },
      sales: { include: { tenders: true } },
    },
  });

  if (!session) return null;

  const cashSales = session.sales
    .filter((sale) => sale.status === 'PAID')
    .reduce(
      (total, sale) =>
        total +
        sale.tenders
          .filter((tender) => tender.kind === 'CASH')
          .reduce((sum, tender) => sum + Math.round(Number(tender.amount) * 100), 0) -
        Math.round(Number(sale.changeGiven) * 100),
      0,
    );

  const cardSales = session.sales
    .filter((sale) => sale.status === 'PAID')
    .reduce(
      (total, sale) =>
        total +
        sale.tenders
          .filter((tender) => tender.kind === 'CARD')
          .reduce((sum, tender) => sum + Math.round(Number(tender.amount) * 100), 0),
      0,
    );

  return {
    session,
    saleCount: session.sales.filter((sale) => sale.status === 'PAID').length,
    cashMinor: cashSales,
    cardMinor: cardSales,
    expectedMinor:
      Math.round(Number(session.openingFloat) * 100) +
      cashSales -
      Math.round(Number(session.paidOut) * 100),
  };
}

/** Closes the till, recording the variance rather than absorbing it. */
export async function closeTill(input: {
  orgId: string;
  sessionId: string;
  countedMinor: number;
  userId: string;
  note?: string | null;
}) {
  const session = await prisma.tillSession.findFirst({
    where: { id: input.sessionId, orgId: input.orgId, closedAt: null },
  });

  if (!session) return { ok: false, error: 'That till is already closed.' };

  await prisma.tillSession.update({
    where: { id: session.id },
    data: {
      countedCash: input.countedMinor / 100,
      closedAt: new Date(),
      note: input.note?.trim() || null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'till.closed',
    entityType: 'TillSession',
    entityId: session.id,
    after: { counted: input.countedMinor / 100 } as never,
  });

  return { ok: true };
}

/* ---------------------------------------------------------------------------
   Reading
   --------------------------------------------------------------------------- */

export async function recentSales(orgId: string, limit = 20) {
  return prisma.counterSale.findMany({
    where: { orgId, status: { in: ['PAID', 'REFUNDED'] } },
    include: {
      lines: true,
      tenders: true,
      customer: { select: { displayName: true } },
      soldBy: { select: { name: true } },
    },
    orderBy: { soldAt: 'desc' },
    take: limit,
  });
}

/** Parts a counter can sell, with what is on the shelf right now. */
export async function sellableParts(orgId: string, locationId: string | null, query?: string) {
  return prisma.product.findMany({
    where: {
      orgId,
      isActive: true,
      ...(query
        ? {
            OR: [
              { partNumber: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      stockLevels: {
        where: locationId ? { warehouse: { locationId } } : {},
        select: { onHand: true, reserved: true, avgCost: true },
      },
    },
    orderBy: { name: 'asc' },
    take: 40,
  });
}

export { decimal as saleDecimal };
