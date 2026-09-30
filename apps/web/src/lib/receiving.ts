import {
  binFor,
  countAgainst,
  type ReceivingLine,
  scanAgainstOrder,
  type ScanResult,
  stillOwedOn,
  whatIsLeft,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { receiveGoods } from './inventory';

/**
 * Receiving with a scanner in one hand.
 *
 * The counting happens one line at a time and lands in the database as it
 * happens, rather than being held on a page until somebody presses save. A
 * pallet takes twenty minutes; a browser tab does not reliably survive twenty
 * minutes of a workshop, and the one thing worse than counting a pallet is
 * counting it twice.
 *
 * So each count is its own goods receipt against its own line, which is what
 * `receiveGoods` already does and what the supplier's own paperwork looks like
 * anyway: a delivery arrives in parts, and each part is a receipt.
 *
 * Phase 93.
 */

export class ReceivingError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'NOT_A_COUNT' | 'OVER_RECEIPT' | 'CLOSED',
    message: string,
  ) {
    super(message);
    this.name = 'ReceivingError';
  }
}

/** The order as the person at the pallet sees it. */
export async function whatIsOnTheOrder(orgId: string, orderId: string) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, orgId },
    select: {
      id: true,
      number: true,
      status: true,
      supplier: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          description: true,
          quantity: true,
          received: true,
          product: {
            select: {
              id: true,
              partNumber: true,
              barcode: true,
              stockLevels: { select: { binLocation: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!order) throw new ReceivingError('NOT_FOUND', 'That purchase order was not found.');

  const lines: ReceivingLine[] = order.lines.map((line) => ({
    orderLineId: line.id,
    productId: line.product?.id ?? null,
    partNumber: line.product?.partNumber ?? null,
    barcode: line.product?.barcode ?? null,
    description: line.description,
    ordered: Number(line.quantity),
    alreadyReceived: Number(line.received),
    // Nothing is held on the page: every count is already in the database, so
    // "counted in this session" is always nought here and `alreadyReceived`
    // carries the truth.
    counted: 0,
    bin: line.product?.stockLevels[0]?.binLocation ?? null,
  }));

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    supplier: order.supplier.name,
    lines,
    left: whatIsLeft(lines),
  };
}

/** Which line the box in somebody's hands belongs to. */
export async function scanIntoOrder(
  orgId: string,
  orderId: string,
  scanned: string,
): Promise<ScanResult> {
  const order = await whatIsOnTheOrder(orgId, orderId);
  return scanAgainstOrder(order.lines, scanned);
}

/**
 * Book one line in, and put it where it goes.
 *
 * The bin is written onto the stock level as part of the same act, because a
 * part that arrives and is shelved is one event to the person doing it and
 * making it two is how the second half gets skipped.
 */
export async function countIn(input: {
  orgId: string;
  userId: string;
  orderId: string;
  orderLineId: string;
  quantity: number;
  bin?: string | null;
  warehouseId?: string | null;
  reference?: string | null;
}): Promise<{ remaining: number; done: boolean }> {
  const order = await whatIsOnTheOrder(input.orgId, input.orderId);

  // BILLED and not CANCELLED alone: once the supplier's bill is against it,
  // booking more goods in would make the bill disagree with the receipt and
  // the reconciliation would be somebody's afternoon.
  if (order.status === 'CANCELLED' || order.status === 'BILLED') {
    throw new ReceivingError('CLOSED', 'That order is closed. Nothing more can be booked to it.');
  }

  const line = order.lines.find((one) => one.orderLineId === input.orderLineId);
  if (!line) throw new ReceivingError('NOT_FOUND', 'That line is not on this order.');

  const counted = countAgainst(line, input.quantity);

  if (counted.verdict === 'NOT_A_COUNT') {
    throw new ReceivingError('NOT_A_COUNT', 'How many arrived? It must be more than nothing.');
  }

  if (counted.verdict === 'OVER') {
    throw new ReceivingError(
      'OVER_RECEIPT',
      `Only ${stillOwedOn(line)} of those are still owed on this order.`,
    );
  }

  const warehouse =
    input.warehouseId ??
    (
      await prisma.warehouse.findFirstOrThrow({
        where: { orgId: input.orgId },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
      })
    ).id;

  const result = await receiveGoods({
    orgId: input.orgId,
    orderId: input.orderId,
    warehouseId: warehouse,
    lines: [{ orderLineId: input.orderLineId, quantity: input.quantity }],
    reference: input.reference ?? null,
  });

  if (!result.ok) {
    throw new ReceivingError('OVER_RECEIPT', result.problems[0] ?? 'That could not be received.');
  }

  // Where it goes, written as part of the same act.
  const bin = binFor(line, input.bin);
  if (bin && line.productId) {
    await prisma.stockLevel.updateMany({
      where: { productId: line.productId, warehouseId: warehouse },
      data: { binLocation: bin },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'goods.received.scanned',
    entityType: 'PurchaseOrderLine',
    entityId: input.orderLineId,
    before: { received: line.alreadyReceived },
    after: { received: line.alreadyReceived + input.quantity, bin },
  });

  const after = await whatIsOnTheOrder(input.orgId, input.orderId);
  const mine = after.lines.find((one) => one.orderLineId === input.orderLineId);

  return { remaining: mine ? stillOwedOn(mine) : 0, done: after.left.done };
}

/** Orders with something still to come, for the screen that lists them. */
export async function ordersAwaitingDelivery(orgId: string) {
  // bounded: orders a workshop has open. One that has hundreds outstanding has
  // a purchasing problem this screen is not going to solve.
  const orders = await prisma.purchaseOrder.findMany({
    where: { orgId, status: { in: ['SENT', 'PART_RECEIVED'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      number: true,
      status: true,
      expectedAt: true,
      supplier: { select: { name: true } },
      lines: { select: { quantity: true, received: true } },
    },
  });

  return orders.map((order) => {
    const outstanding = order.lines.reduce(
      (total, line) => total + Math.max(0, Number(line.quantity) - Number(line.received)),
      0,
    );
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      expectedAt: order.expectedAt,
      supplier: order.supplier.name,
      outstanding: Math.round(outstanding * 1000) / 1000,
    };
  });
}
