import {
  applyIssue,
  applyReceipt,
  applyStocktake,
  consumeReservation,
  release,
  reserve,
  type ReservationOutcome,
  type StockPosition,
  toNumber,
  validateReceipt,
  type ReceiptLine,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * Stock movements against the database.
 *
 * Every function here that changes a stock level takes a row lock first. Two
 * jobs reserving the last set of brake pads in the same second must not both
 * succeed, and read-then-write without a lock is exactly how they do.
 *
 * The domain maths lives in `@carnet/core`; this module is the transaction
 * boundary and nothing else.
 */

interface LevelRow {
  id: string;
  onHand: unknown;
  reserved: unknown;
  avgCost: unknown;
}

function toPosition(row: LevelRow): StockPosition {
  return {
    onHand: Number(row.onHand),
    reserved: Number(row.reserved),
    avgCost: String(row.avgCost),
  };
}

/**
 * Locks a stock level for update, creating it if this is the first movement
 * for that product and warehouse.
 *
 * The organisation is not decoration. A shelf is identified by a part and a
 * site and by nothing else, so without this check any caller holding two
 * identifiers could move stock on another workshop's shelf — and every path
 * that moves stock comes through here, which is why the check lives here
 * rather than in each of them. Phase 48 found it by trying.
 *
 * @repeat GUARDED(CONSTRAINT: stock_levels_productId_warehouseId_key) A
 * shelf row is made once per part and warehouse; the second call reads back
 * the row the first one made.
 */
export async function lockLevel(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orgId: string,
  productId: string,
  warehouseId: string,
): Promise<{ id: string; position: StockPosition }> {
  const [part, site] = await Promise.all([
    tx.product.findFirst({ where: { id: productId, orgId }, select: { id: true } }),
    tx.warehouse.findFirst({ where: { id: warehouseId, orgId }, select: { id: true } }),
  ]);

  // Not "you may not touch that shelf", which would confirm it exists. As far
  // as this workshop is concerned there is no such part and no such site.
  if (!part || !site) {
    throw new Error('That part is not on any of your shelves.');
  }

  const existing = await tx.$queryRaw<LevelRow[]>`
    SELECT "id", "onHand", "reserved", "avgCost"
    FROM "stock_levels"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `;

  const row = existing[0];
  if (row) return { id: row.id, position: toPosition(row) };

  const created = await tx.stockLevel.create({
    data: { productId, warehouseId, onHand: 0, reserved: 0, avgCost: 0 },
    select: { id: true, onHand: true, reserved: true, avgCost: true },
  });

  return { id: created.id, position: toPosition(created) };
}

/* ---------------------------------------------------------------------------
   Reservation
   --------------------------------------------------------------------------- */

export interface ReserveResult extends ReservationOutcome {
  productName: string;
  /** Set when the shortfall raised a purchase request. FR-1102. */
  purchaseRequestId?: string;
}

/**
 * Reserves stock for a job part line, and raises a purchase request for
 * anything short.
 *
 * The shortfall path is the point of the whole module: a technician adds a
 * part, the system takes what it has and starts the process for the rest,
 * without anyone walking to the office. FR-1003, FR-1102.
 *
 * @repeat GUARDED(STATE: the line is no longer waiting to be reserved)
 * Reserving again is refused by the line having moved on, and no page offers
 * a button that reserves a line twice.
 */
export async function reserveForJobLine(input: {
  orgId: string;
  jobPartLineId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  requestedByUserId?: string | null;
}): Promise<ReserveResult> {
  return prisma.$transaction(async (tx) => {
    const { position } = await lockLevel(tx, input.orgId, input.productId, input.warehouseId);
    const outcome = reserve(position, input.quantity);

    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { name: true, partNumber: true },
    });

    if (outcome.reserved > 0) {
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId: input.warehouseId,
          },
        },
        data: { reserved: outcome.reservedTotal },
      });

      await tx.stockReservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          jobPartLineId: input.jobPartLineId,
          quantity: outcome.reserved,
        },
      });
    }

    let purchaseRequestId: string | undefined;

    if (outcome.shortfall > 0) {
      const line = await tx.jobPartLine.findUnique({
        where: { id: input.jobPartLineId },
        select: { jobId: true },
      });

      const request = await tx.purchaseRequest.create({
        data: {
          orgId: input.orgId,
          jobId: line?.jobId ?? null,
          requestedByUserId: input.requestedByUserId ?? null,
          status: 'PENDING',
          notes:
            `${outcome.shortfall} x ${product.name}` +
            (product.partNumber ? ` (${product.partNumber})` : '') +
            ' short for a job.',
        },
      });
      purchaseRequestId = request.id;
    }

    await tx.jobPartLine.update({
      where: { id: input.jobPartLineId },
      data: {
        status:
          outcome.status === 'RESERVED'
            ? 'RESERVED'
            : outcome.status === 'PARTIAL'
              ? 'RESERVED'
              : 'ON_ORDER',
      },
    });

    return { ...outcome, productName: product.name, purchaseRequestId };
  });
}

/** Releases reservations for a part line, when the line or job is cancelled. *
 * @repeat GUARDED(STATE: the reservations already have a releasedAt) The
 * second call finds nothing still reserved and releases nothing.
 */
export async function releaseForJobLine(jobPartLineId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.stockReservation.findMany({
      where: { jobPartLineId, releasedAt: null },
    });

    // Whose line this is, so the shelf can be checked against it.
    const line = await tx.jobPartLine.findUnique({
      where: { id: jobPartLineId },
      select: { job: { select: { orgId: true } } },
    });

    if (!line) return 0;

    let released = 0;

    for (const reservation of reservations) {
      const { position } = await lockLevel(
        tx,
        line.job.orgId,
        reservation.productId,
        reservation.warehouseId,
      );
      const quantity = Number(reservation.quantity);

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: release(position, Math.min(quantity, position.reserved)) },
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { releasedAt: new Date() },
      });

      released += quantity;
    }

    return released;
  });
}

/* ---------------------------------------------------------------------------
   Consumption
   --------------------------------------------------------------------------- */

/**
 * Consumes reserved stock when a job completes: the reservation ends and the
 * stock leaves the shelf in one transaction, and the actual cost is written
 * back to the job line so profitability is real. FR-1011.
 *
 * @repeat GUARDED(STATE: the part lines are already fitted) The second call
 * matches no lines, so the stock leaves the shelf once however many times a
 * job completion is retried.
 */
export async function consumeForJob(jobId: string): Promise<{ lines: number; cost: number }> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, select: { orgId: true } });
    if (!job) return { lines: 0, cost: 0 };

    const partLines = await tx.jobPartLine.findMany({
      where: { jobId, productId: { not: null }, status: { in: ['RESERVED', 'REQUESTED'] } },
      include: { reservations: { where: { releasedAt: null } } },
    });

    let totalCost = 0;

    for (const line of partLines) {
      const warehouseId =
        line.reservations[0]?.warehouseId ?? (await defaultWarehouseId(tx, jobId));
      if (!line.productId || !warehouseId) continue;

      const { position } = await lockLevel(tx, job.orgId, line.productId, warehouseId);
      const quantity = Number(line.quantity);
      const result = consumeReservation(position, quantity);

      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId: line.productId, warehouseId } },
        data: { onHand: result.onHand, reserved: result.reserved },
      });

      await tx.stockMovement.create({
        data: {
          orgId: (await tx.job.findUniqueOrThrow({ where: { id: jobId }, select: { orgId: true } }))
            .orgId,
          productId: line.productId,
          warehouseId,
          type: 'ISSUE',
          quantity: -quantity,
          unitCost: position.avgCost as string,
          balanceAfter: result.onHand,
          referenceType: 'Job',
          referenceId: jobId,
          reason: 'Fitted on job',
        },
      });

      // Write the real cost back, so job margin reflects what the parts
      // actually cost rather than what the price list guessed.
      await tx.jobPartLine.update({
        where: { id: line.id },
        data: { status: 'FITTED', unitCost: position.avgCost as string },
      });

      await tx.stockReservation.updateMany({
        where: { jobPartLineId: line.id, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      totalCost += toNumber(result.cost);
    }

    return { lines: partLines.length, cost: totalCost };
  });
}

/**
 * The store a reservation goes against when nobody chose one: the default,
 * else the first by code. Phase 34 reserves from an approval, where there is
 * no page to ask on.
 *
 * @repeat HARMLESS(OVERWRITE: the workshop’s first warehouse, made only if
 * it has none) Asking twice gives the same warehouse back.
 */
export async function defaultWarehouseFor(orgId: string): Promise<string | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { orgId },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    select: { id: true },
  });
  return warehouse?.id ?? null;
}

async function defaultWarehouseId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  jobId: string,
): Promise<string | null> {
  const job = await tx.job.findUnique({ where: { id: jobId }, select: { orgId: true } });
  if (!job) return null;

  // Warehouses carry no timestamp, so the tiebreak is the code. The previous
  // version ordered by a column that did not exist, cast to `never` to get
  // past the compiler, and was never reached because nothing in the product
  // completed a job until Phase 16.
  const warehouse = await tx.warehouse.findFirst({
    where: { orgId: job.orgId },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    select: { id: true },
  });

  return warehouse?.id ?? null;
}

/* ---------------------------------------------------------------------------
   Goods receipt
   --------------------------------------------------------------------------- */

export interface ReceiveResult {
  ok: boolean;
  problems: string[];
  receiptId?: string;
  linesReceived?: number;
}

/**
 * Books in a delivery: validates against the order, moves stock, recalculates
 * weighted average cost, and advances the order status. FR-1105, FR-1106.
 *
 * @repeat GUARDED(STATE: the order lines have already been received) A
 * second receipt is refused as an over-receipt, naming the line, before
 * anything is written.
 */
export async function receiveGoods(input: {
  orgId: string;
  orderId: string;
  warehouseId: string;
  lines: readonly ReceiptLine[];
  reference?: string | null;
}): Promise<ReceiveResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: input.orderId, orgId: input.orgId },
      include: { lines: true },
    });

    if (!order) return { ok: false, problems: ['That purchase order does not exist.'] };

    const orderLines = order.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      received: Number(line.received),
      unitCost: line.unitCost.toString(),
    }));

    const validation = validateReceipt(orderLines, input.lines);
    if (!validation.ok) {
      return { ok: false, problems: validation.problems.map((problem) => problem.message) };
    }

    const receipt = await tx.goodsReceipt.create({
      data: { orderId: order.id, reference: input.reference ?? null },
    });

    for (const line of input.lines) {
      const orderLine = order.lines.find((l) => l.id === line.orderLineId);
      if (!orderLine) continue;

      // The delivery note price wins over the ordered price: it is what the
      // workshop will actually be billed.
      const unitCost = line.unitCost ?? orderLine.unitCost.toString();

      await tx.goodsReceiptLine.create({
        data: {
          receiptId: receipt.id,
          orderLineId: orderLine.id,
          quantity: line.quantity,
          unitCost: unitCost as string,
        },
      });

      await tx.purchaseOrderLine.update({
        where: { id: orderLine.id },
        data: { received: Number(orderLine.received) + line.quantity },
      });

      if (!orderLine.productId) continue;

      const { position } = await lockLevel(tx, input.orgId, orderLine.productId, input.warehouseId);
      const result = applyReceipt(position, line.quantity, unitCost as string);

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: orderLine.productId,
            warehouseId: input.warehouseId,
          },
        },
        data: { onHand: result.onHand, avgCost: toNumber(result.avgCost) },
      });

      await tx.stockMovement.create({
        data: {
          orgId: input.orgId,
          productId: orderLine.productId,
          warehouseId: input.warehouseId,
          type: 'RECEIPT',
          quantity: line.quantity,
          unitCost: unitCost as string,
          balanceAfter: result.onHand,
          referenceType: 'GoodsReceipt',
          referenceId: receipt.id,
          reason: `Received on ${order.number}`,
        },
      });
    }

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: validation.resultingStatus as never },
    });

    return { ok: true, problems: [], receiptId: receipt.id, linesReceived: input.lines.length };
  });
}

/* ---------------------------------------------------------------------------
   Adjustments
   --------------------------------------------------------------------------- */

/** A manual correction. The reason is mandatory: FR-1008. *
 * @repeat GUARDED(KEY: the form key its callers hand to once) The same
 * adjustment made twice moves the shelf twice, and two identical adjustments
 * are something somebody might genuinely do, so only the form can tell them
 * apart.
 */
export async function adjustStock(input: {
  orgId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
}): Promise<{ onHand: number }> {
  if (!input.reason.trim()) {
    throw new Error('A stock adjustment requires a reason');
  }

  return prisma.$transaction(async (tx) => {
    const { position } = await lockLevel(tx, input.orgId, input.productId, input.warehouseId);

    const result =
      input.quantity > 0
        ? applyReceipt(position, input.quantity, position.avgCost)
        : applyIssue(position, Math.abs(input.quantity));

    const onHand = result.onHand;

    await tx.stockLevel.update({
      where: {
        productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId },
      },
      data: { onHand },
    });

    await tx.stockMovement.create({
      data: {
        orgId: input.orgId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: 'ADJUSTMENT',
        quantity: input.quantity,
        unitCost: position.avgCost as string,
        balanceAfter: onHand,
        reason: input.reason.trim(),
      },
    });

    return { onHand };
  });
}

/** Records a stocktake count and posts the variance. FR-1009. *
 * @repeat HARMLESS(OVERWRITE: onHand set to the number counted) A stocktake
 * is a set rather than a change: counted again at the same number, the
 * variance is nothing and no movement is written.
 */
export async function recordStocktake(input: {
  orgId: string;
  productId: string;
  warehouseId: string;
  counted: number;
}): Promise<{ variance: number; direction: string }> {
  return prisma.$transaction(async (tx) => {
    const { position } = await lockLevel(tx, input.orgId, input.productId, input.warehouseId);
    const result = applyStocktake(position, input.counted);

    await tx.stockLevel.update({
      where: {
        productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId },
      },
      data: { onHand: result.counted },
    });

    if (result.variance !== 0) {
      await tx.stockMovement.create({
        data: {
          orgId: input.orgId,
          productId: input.productId,
          warehouseId: input.warehouseId,
          type: 'STOCKTAKE',
          quantity: result.variance,
          unitCost: position.avgCost as string,
          balanceAfter: result.counted,
          reason: `Stocktake ${result.direction}`,
        },
      });
    }

    return { variance: result.variance, direction: result.direction };
  });
}

/* ---------------------------------------------------------------------------
   Reporting helpers
   --------------------------------------------------------------------------- */

/** Issues over a window, used to derive the usage rate for reordering. */
export async function usageHistory(
  productId: string,
  days = 180,
): Promise<{ quantity: number; at: Date }[]> {
  const since = new Date(Date.now() - days * 86_400_000);

  const movements = await prisma.stockMovement.findMany({
    where: { productId, type: 'ISSUE', createdAt: { gte: since } },
    select: { quantity: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return movements.map((movement) => ({
    quantity: Math.abs(Number(movement.quantity)),
    at: movement.createdAt,
  }));
}

/** Quantity on outstanding purchase orders, so we do not order twice. */
export async function quantityOnOrder(orgId: string, productId: string): Promise<number> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: {
      productId,
      order: { orgId, status: { in: ['SENT', 'PART_RECEIVED'] } },
    },
    select: { quantity: true, received: true },
  });

  return lines.reduce(
    (total, line) => total + Math.max(0, Number(line.quantity) - Number(line.received)),
    0,
  );
}
