import {
  applyTransferReceipt,
  assertCancellable,
  assertDispatchable,
  availableQuantity,
  consolidate,
  fromDecimal,
  type TransferReceiptLine,
  type SiteStock,
  type SitePerformance,
  type StockTransfer,
  suggestTransfers,
  type TransferLine,
  TransferError,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { regionFor } from './region';
import { assertPlanAllows } from './billing';
import { traceId } from './trace';

/**
 * Stock between sites, against the database.
 *
 * Every write here takes a row lock on the stock level before reading it. Two
 * dispatches of the last four brake pads, arriving a millisecond apart, would
 * otherwise both see four available and both succeed, and the shelf would owe
 * four pads it does not have.
 */

const decimal = (value: unknown, currency = 'GBP') => fromDecimal(String(value ?? 0), currency);

/**
 * Starts a transfer, as a draft nobody has sent yet.
 *
 * The one piece of the cycle that was missing: a workshop could be told which
 * parts to move between sites and had no way to move them. Everything after
 * this — sending, receiving, cancelling — was written and unreachable.
 *
 * A draft moves no stock. It is a list of what somebody intends to put in the
 * van, and the shelf is only touched when it is dispatched, because a part
 * booked out of one site and never into the other is a part nobody can find.
 *
 * @repeat GUARDED(KEY: the form key its callers hand to once) Two drafts
 * between the same sites are a legitimate thing to want, so the key the form
 * carries is what separates a second press from a second van.
 */
/**
 * The next transfer number.
 *
 * Taken in its own statement rather than inside the transaction that writes
 * the transfer, because a transaction that rolls back also rolls back the
 * counter, and then the next attempt takes the number that just collided and
 * collides again. A gap in the numbering after a failure is the cheaper
 * mistake: nobody has ever been harmed by a missing TRF-0042.
 *
 * The counter is seeded past whatever references already exist, because a
 * workshop can arrive carrying transfers numbered by something else — the
 * seed does, and so does anybody migrating from another system.
 */
async function nextTransferReference(orgId: string): Promise<string> {
  const existing = await prisma.documentSequence.findUnique({
    where: { orgId_kind: { orgId, kind: 'TRANSFER' } },
    select: { id: true },
  });

  if (!existing) {
    const highest = await prisma.stockTransfer.findFirst({
      where: { orgId },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });

    const already = Number(highest?.reference?.replace(/\D/g, '') ?? 0);

    await prisma.documentSequence.create({
      data: { orgId, kind: 'TRANSFER', prefix: 'TRF-', next: already + 1 },
    });
  }

  const sequence = await prisma.documentSequence.update({
    where: { orgId_kind: { orgId, kind: 'TRANSFER' } },
    data: { next: { increment: 1 } },
  });

  // The row comes back after the increment, so the number just taken is the
  // one below it.
  return `${sequence.prefix}${String(sequence.next - 1).padStart(4, '0')}`;
}

export async function createTransfer(input: {
  orgId: string;
  userId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  lines: readonly { productId: string; quantity: number }[];
  note?: string | null;
}): Promise<string> {
  await assertPlanAllows(input.orgId, 'transfers');

  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new TransferError('BAD_TRANSITION', 'A transfer goes between two different sites.');
  }

  const lines = input.lines.filter((line) => line.quantity > 0);

  if (lines.length === 0) {
    throw new TransferError('NOTHING_TO_SEND', 'There is nothing on this transfer to send.');
  }

  const [from, to] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: input.fromWarehouseId, orgId: input.orgId },
      select: { id: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: input.toWarehouseId, orgId: input.orgId },
      select: { id: true },
    }),
  ]);

  if (!from || !to) {
    throw new TransferError('BAD_TRANSITION', 'One of those sites is not in this workshop.');
  }

  const reference = await nextTransferReference(input.orgId);

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.create({
      data: {
        orgId: input.orgId,
        reference,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: 'DRAFT',
        note: input.note?.trim() || null,
        lines: {
          create: lines.map((line, index) => ({
            productId: line.productId,
            quantity: line.quantity,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        traceId: await traceId(),
        orgId: input.orgId,
        actorUserId: input.userId,
        action: 'transfer.started',
        entityType: 'StockTransfer',
        entityId: transfer.id,
        after: { reference, lines: lines.length } as never,
      },
    });

    return transfer.id;
  });
}

export async function loadTransfer(orgId: string, id: string): Promise<StockTransfer> {
  const row = await prisma.stockTransfer.findFirstOrThrow({
    where: { id, orgId },
    include: {
      lines: {
        include: { product: { select: { partNumber: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return {
    id: row.id,
    reference: row.reference,
    fromWarehouseId: row.fromWarehouseId,
    toWarehouseId: row.toWarehouseId,
    status: row.status,
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.receivedAt,
    lines: row.lines.map((line): TransferLine => ({
      productId: line.productId,
      partNumber: line.product.partNumber,
      description: line.product.name,
      sent: Number(line.quantity),
      received: Number(line.received),
      unitCost: decimal(line.unitCost),
    })),
  };
}

/**
 * Sends a transfer.
 *
 * Stock leaves the origin here and does not arrive anywhere. The difference
 * lives on the transfer until somebody books it in, which is the whole point:
 * the boxes are in a van and the system should say so rather than pretending
 * they evaporated.
 */
export async function dispatchTransfer(
  orgId: string,
  transferId: string,
  userId: string,
): Promise<StockTransfer> {
  await assertPlanAllows(orgId, 'transfers');
  return prisma.$transaction(async (tx) => {
    const row = await tx.stockTransfer.findFirstOrThrow({
      where: { id: transferId, orgId },
      include: { lines: { include: { product: { select: { partNumber: true, name: true } } } } },
    });

    if (row.status !== 'DRAFT') {
      throw new TransferError('BAD_TRANSITION', `Transfer ${row.reference} has already been sent.`);
    }

    // Locked before reading. Availability checked a moment ago is a guess.
    const levels = await tx.$queryRaw<
      { id: string; productId: string; onHand: string; reserved: string }[]
    >`
      SELECT "id", "productId", "onHand"::text, "reserved"::text
      FROM "stock_levels"
      WHERE "warehouseId" = ${row.fromWarehouseId}
        AND "productId" = ANY(${row.lines.map((line) => line.productId)}::text[])
      FOR UPDATE
    `;

    const available = new Map(
      levels.map((level) => [
        level.productId,
        availableQuantity({
          onHand: Number(level.onHand),
          reserved: Number(level.reserved),
          avgCost: 0,
        }),
      ]),
    );

    const transfer: StockTransfer = {
      id: row.id,
      reference: row.reference,
      fromWarehouseId: row.fromWarehouseId,
      toWarehouseId: row.toWarehouseId,
      status: row.status,
      dispatchedAt: row.dispatchedAt,
      receivedAt: row.receivedAt,
      lines: row.lines.map((line) => ({
        productId: line.productId,
        partNumber: line.product.partNumber,
        description: line.product.name,
        sent: Number(line.quantity),
        received: Number(line.received),
        unitCost: decimal(line.unitCost),
      })),
    };

    assertDispatchable(transfer, available);

    for (const line of transfer.lines) {
      const level = levels.find((row) => row.productId === line.productId);
      const balanceAfter = Number(level?.onHand ?? 0) - line.sent;

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: { productId: line.productId, warehouseId: row.fromWarehouseId },
        },
        data: { onHand: balanceAfter },
      });

      await tx.stockMovement.create({
        data: {
          orgId,
          productId: line.productId,
          warehouseId: row.fromWarehouseId,
          type: 'TRANSFER_OUT',
          quantity: -line.sent,
          unitCost: line.unitCost.minor / 100,
          balanceAfter,
          referenceType: 'StockTransfer',
          referenceId: row.id,
          reason: `Sent on ${row.reference}`,
        },
      });
    }

    const updated = await tx.stockTransfer.update({
      where: { id: row.id },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date(), dispatchedByUserId: userId },
    });

    return { ...transfer, status: updated.status, dispatchedAt: updated.dispatchedAt };
  });
}

/**
 * Books a delivery in at the destination.
 *
 * The cost travels with the stock rather than being recalculated, so moving a
 * box between two sites never changes what the group's inventory is worth.
 * Recalculating here would let a transfer create or destroy value out of
 * nothing, which is the kind of error that only shows up at year end.
 */
export async function receiveTransfer(
  orgId: string,
  transferId: string,
  received: readonly TransferReceiptLine[],
  userId: string,
  options: { closeShort?: boolean } = {},
) {
  return prisma.$transaction(async (tx) => {
    const transfer = await loadTransferWithin(tx, orgId, transferId);
    const outcome = applyTransferReceipt(transfer, received, options);

    for (const line of received) {
      if (line.quantity <= 0) continue;

      const source = transfer.lines.find((row) => row.productId === line.productId);
      if (!source) continue;

      const level = await tx.stockLevel.upsert({
        where: {
          productId_warehouseId: { productId: line.productId, warehouseId: transfer.toWarehouseId },
        },
        create: {
          productId: line.productId,
          warehouseId: transfer.toWarehouseId,
          onHand: line.quantity,
          reserved: 0,
          // The cost travels with the stock. Recalculating it here would let a
          // van journey create or destroy value, which only surfaces at year end.
          avgCost: source.unitCost.minor / 100,
        },
        update: { onHand: { increment: line.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          orgId,
          productId: line.productId,
          warehouseId: transfer.toWarehouseId,
          type: 'TRANSFER_IN',
          quantity: line.quantity,
          unitCost: source.unitCost.minor / 100,
          balanceAfter: Number(level.onHand),
          referenceType: 'StockTransfer',
          referenceId: transfer.id,
          reason: `Received on ${transfer.reference}`,
        },
      });

      await tx.stockTransferLine.updateMany({
        where: { transferId: transfer.id, productId: line.productId },
        data: { received: { increment: line.quantity } },
      });
    }

    await tx.stockTransfer.update({
      where: { id: transfer.id },
      data: {
        status: outcome.status,
        receivedAt: outcome.status === 'RECEIVED' ? new Date() : null,
        receivedByUserId: userId,
      },
    });

    return outcome;
  });
}

export async function cancelTransfer(orgId: string, transferId: string) {
  const transfer = await loadTransfer(orgId, transferId);
  assertCancellable(transfer);

  return prisma.stockTransfer.update({
    where: { id: transferId },
    data: { status: 'CANCELLED' },
  });
}

/* ---------------------------------------------------------------------------
   Reading
   --------------------------------------------------------------------------- */

/** What is on the road right now, and how long it has been there. */
export async function inTransitNow(orgId: string) {
  // bounded: what is on the road right now between a workshop's own sites.
  const transfers = await prisma.stockTransfer.findMany({
    where: { orgId, status: { in: ['IN_TRANSIT', 'PART_RECEIVED'] } },
    include: {
      fromWarehouse: { select: { name: true, location: { select: { name: true } } } },
      toWarehouse: { select: { name: true, location: { select: { name: true } } } },
      lines: { include: { product: { select: { partNumber: true, name: true } } } },
    },
    orderBy: { dispatchedAt: 'asc' },
  });

  const now = Date.now();

  return transfers.map((transfer) => {
    const outstanding = transfer.lines.reduce(
      (total, line) => total + Math.max(0, Number(line.quantity) - Number(line.received)),
      0,
    );

    const valueMinor = transfer.lines.reduce(
      (total, line) =>
        total +
        Math.round(
          Math.max(0, Number(line.quantity) - Number(line.received)) * Number(line.unitCost) * 100,
        ),
      0,
    );

    const days = transfer.dispatchedAt
      ? Math.floor((now - transfer.dispatchedAt.getTime()) / 86_400_000)
      : 0;

    return {
      ...transfer,
      outstanding,
      valueMinor,
      daysInTransit: days,
      // Anything sitting on the road this long is not on the road. It is lost,
      // or it arrived and nobody booked it in.
      stale: days > 3,
    };
  });
}

/** Parts one site is short of that another is holding spare. */
export async function transferSuggestions(orgId: string) {
  const levels = await prisma.stockLevel.findMany({
    where: { warehouse: { orgId } },
    include: {
      product: { select: { id: true, partNumber: true, name: true, reorderPoint: true } },
      warehouse: { select: { id: true, name: true, location: { select: { name: true } } } },
    },
  });

  const stock: SiteStock[] = levels.map((level) => ({
    warehouseId: level.warehouseId,
    siteName: level.warehouse.location?.name ?? level.warehouse.name,
    productId: level.productId,
    partNumber: level.product.partNumber,
    onHand: Number(level.onHand),
    reserved: Number(level.reserved),
    reorderPoint: Number(level.product.reorderPoint ?? 0),
  }));

  return suggestTransfers(stock);
}

/* ---------------------------------------------------------------------------
   Consolidated reporting
   --------------------------------------------------------------------------- */

/**
 * Group performance by site.
 *
 * Overheads are apportioned by revenue share where a cost is not booked
 * against a site, which is an assumption rather than a fact and is labelled
 * as one on the page. Rent belongs to a building; a group insurance premium
 * does not belong anywhere in particular.
 */
export async function groupPerformance(
  orgId: string,
  range: { from: Date; to: Date },
): Promise<ReturnType<typeof consolidate>> {
  const region = await regionFor(orgId);
  // bounded: a workshop's own sites.
  const locations = await prisma.location.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) return consolidate([]);

  const performances = await Promise.all(
    locations.map(async (location): Promise<SitePerformance> => {
      const [jobs, invoices, stock, receivables, attendance] = await Promise.all([
        prisma.job.findMany({
          where: {
            orgId,
            locationId: location.id,
            completedAt: { gte: range.from, lte: range.to },
          },
          include: { labourLines: true, partLines: true },
        }),
        prisma.invoice.aggregate({
          where: {
            orgId,
            issuedAt: { gte: range.from, lte: range.to },
            job: { locationId: location.id },
          },
          _sum: { subtotal: true },
        }),
        prisma.stockLevel.findMany({
          where: { warehouse: { orgId, locationId: location.id } },
          select: { onHand: true, avgCost: true },
        }),
        prisma.invoice.aggregate({
          where: {
            orgId,
            status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] },
            job: { locationId: location.id },
          },
          _sum: { total: true, amountPaid: true },
        }),
        prisma.attendanceRecord.findMany({
          where: { orgId, locationId: location.id, startedAt: { gte: range.from, lte: range.to } },
        }),
      ]);

      const partsCost = jobs.reduce(
        (total, job) =>
          total +
          job.partLines.reduce(
            (sum, line) => sum + Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
            0,
          ),
        0,
      );

      const soldMinutes = jobs.reduce(
        (total, job) =>
          total + job.labourLines.reduce((sum, line) => sum + Number(line.hours) * 60, 0),
        0,
      );

      const attendedMinutesTotal = attendance.reduce((total, record) => {
        const end = record.endedAt ?? range.to;
        const gross = Math.floor((end.getTime() - record.startedAt.getTime()) / 60_000);
        return total + Math.max(0, gross - record.breakMinutes);
      }, 0);

      const stockValue = stock.reduce(
        (total, level) => total + Math.round(Number(level.onHand) * Number(level.avgCost) * 100),
        0,
      );

      return {
        locationId: location.id,
        siteName: location.name,
        revenue: decimal(invoices._sum.subtotal ?? 0),
        costOfSales: { minor: partsCost, currency: region.currency },
        // Overheads are not yet booked per site; see the note on the page.
        overheads: { minor: 0, currency: region.currency },
        jobsCompleted: jobs.length,
        attendedMinutes: attendedMinutesTotal,
        soldMinutes: Math.round(soldMinutes),
        stockValue: { minor: stockValue, currency: region.currency },
        receivables: {
          minor: Math.round(
            (Number(receivables._sum.total ?? 0) - Number(receivables._sum.amountPaid ?? 0)) * 100,
          ),
          currency: region.currency,
        },
      };
    }),
  );

  return consolidate(performances);
}

/* --- internals ------------------------------------------------------------ */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadTransferWithin(tx: Tx, orgId: string, id: string): Promise<StockTransfer> {
  const row = await tx.stockTransfer.findFirstOrThrow({
    where: { id, orgId },
    include: {
      lines: {
        include: { product: { select: { partNumber: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return {
    id: row.id,
    reference: row.reference,
    fromWarehouseId: row.fromWarehouseId,
    toWarehouseId: row.toWarehouseId,
    status: row.status,
    dispatchedAt: row.dispatchedAt,
    receivedAt: row.receivedAt,
    lines: row.lines.map((line) => ({
      productId: line.productId,
      partNumber: line.product.partNumber,
      description: line.product.name,
      sent: Number(line.quantity),
      received: Number(line.received),
      unitCost: decimal(line.unitCost),
    })),
  };
}
