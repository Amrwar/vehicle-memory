/**
 * Inventory and procurement flow check.
 *
 *   npx tsx infra/scripts/verify-inventory.ts
 *
 * Exercises the Phase 2 write paths against a seeded database and asserts the
 * arithmetic, rather than only that the pages render. Weighted average cost
 * and reservation are the two places where a quiet error would corrupt job
 * costing for months before anyone noticed.
 *
 * Run against a freshly seeded database; it mutates stock.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { receiveGoods, reserveForJobLine } from '../../apps/web/src/lib/inventory';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function near(label: string, actual: number, expected: number, tolerance = 0.005): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.info(`  ok     ${label}: ${actual}`);
  } else {
    failures += 1;
    console.error(`  FAIL   ${label}: expected about ${expected}, got ${actual}`);
  }
}

/**
 * Stock at the main store specifically.
 *
 * Not "the first level for this product": once the organisation had a second
 * site, that returned whichever row the planner happened to hand back, and
 * every assertion below started measuring a warehouse it had never written to.
 */
async function levelFor(partNumber: string, warehouseId: string) {
  const product = await prisma.product.findFirstOrThrow({ where: { partNumber } });
  const level = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId },
  });
  return {
    product,
    onHand: Number(level.onHand),
    reserved: Number(level.reserved),
    avgCost: Number(level.avgCost),
  };
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  // Named, not first. The group has more than one store.
  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { orgId: org.id, code: 'MAIN' },
  });

  /* --- weighted average cost on receipt --------------------------------- */

  console.info('--- booking in a delivery at a different price ---');

  const before = await levelFor('34116864059', warehouse.id); // BMW discs: 1 on hand at 61.50
  check('discs on hand before', before.onHand, 1);
  near('discs average cost before', before.avgCost, 61.5);

  const order = await prisma.purchaseOrder.findFirstOrThrow({
    where: { number: 'PO-2041' },
    include: { lines: true },
  });
  const discLine = order.lines.find((line) => line.productId === before.product.id)!;

  // The supplier's price went up between order and delivery. The delivery note
  // price is what the workshop will be billed, so it is what must be recorded.
  const result = await receiveGoods({
    orgId: org.id,
    orderId: order.id,
    warehouseId: warehouse.id,
    lines: [{ orderLineId: discLine.id, quantity: 4, unitCost: '70.00' }],
    reference: 'DN-VERIFY-1',
  });

  check('receipt accepted', result.ok, true);

  const after = await levelFor('34116864059', warehouse.id);
  check('discs on hand after', after.onHand, 5);

  // (1 x 61.50 + 4 x 70.00) / 5 = 68.30
  near('weighted average cost', after.avgCost, 68.3);

  const movement = await prisma.stockMovement.findFirstOrThrow({
    where: { productId: before.product.id, type: 'RECEIPT' },
    orderBy: { createdAt: 'desc' },
  });
  near('movement balance after', Number(movement.balanceAfter), 5);

  const reloaded = await prisma.purchaseOrder.findFirstOrThrow({ where: { id: order.id } });
  check('order fully received', reloaded.status, 'RECEIVED');

  /* --- over-receipt is refused ------------------------------------------ */

  console.info('\n--- attempting to receive more than was ordered ---');

  const over = await receiveGoods({
    orgId: org.id,
    orderId: order.id,
    warehouseId: warehouse.id,
    lines: [{ orderLineId: discLine.id, quantity: 10 }],
  });

  check('over-receipt refused', over.ok, false);
  console.info(`  ok     reason: ${over.problems[0]}`);

  const unchanged = await levelFor('34116864059', warehouse.id);
  check('stock unchanged after refusal', unchanged.onHand, 5);

  /* --- reservation with a shortfall raises a purchase request ----------- */

  console.info('\n--- reserving more than is available ---');

  const battery = await levelFor('BAT-090-AGM', warehouse.id); // 3 on hand, none reserved
  check('batteries available', battery.onHand - battery.reserved, 3);

  const job = await prisma.job.findFirstOrThrow({ where: { number: 10_482 } });
  const line = await prisma.jobPartLine.create({
    data: {
      jobId: job.id,
      productId: battery.product.id,
      description: 'Battery 90Ah AGM',
      partNumber: 'BAT-090-AGM',
      quantity: 5,
      unitPrice: 240,
      unitCost: 151,
      status: 'REQUESTED',
    },
  });

  const requestsBefore = await prisma.purchaseRequest.count({ where: { orgId: org.id } });

  const reservation = await reserveForJobLine({
    orgId: org.id,
    jobPartLineId: line.id,
    productId: battery.product.id,
    warehouseId: warehouse.id,
    quantity: 5,
  });

  check('reserved what was available', reservation.reserved, 3);
  check('shortfall reported', reservation.shortfall, 2);
  check('status is partial', reservation.status, 'PARTIAL');

  const requestsAfter = await prisma.purchaseRequest.count({ where: { orgId: org.id } });
  check('a purchase request was raised for the shortfall', requestsAfter - requestsBefore, 1);

  const afterReserve = await levelFor('BAT-090-AGM', warehouse.id);
  check('reserved figure updated', afterReserve.reserved, 3);
  check('on hand untouched by a reservation', afterReserve.onHand, 3);

  /* --- available never goes negative ------------------------------------ */

  console.info('\n--- reserving again with nothing available ---');

  const second = await prisma.jobPartLine.create({
    data: {
      jobId: job.id,
      productId: battery.product.id,
      description: 'Battery 90Ah AGM',
      quantity: 1,
      unitPrice: 240,
      unitCost: 151,
      status: 'REQUESTED',
    },
  });

  const denied = await reserveForJobLine({
    orgId: org.id,
    jobPartLineId: second.id,
    productId: battery.product.id,
    warehouseId: warehouse.id,
    quantity: 1,
  });

  check('nothing reserved', denied.reserved, 0);
  check('status is unavailable', denied.status, 'UNAVAILABLE');

  const finalLevel = await levelFor('BAT-090-AGM', warehouse.id);
  check('reserved did not exceed on hand', finalLevel.reserved <= finalLevel.onHand, true);

  console.info(
    failures === 0
      ? '\nInventory and procurement behaved correctly.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
