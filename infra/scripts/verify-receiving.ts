/**
 * The box in your hands. Phase 93.
 *
 *   npx tsx infra/scripts/verify-receiving.ts
 *
 * `validateReceipt` has refused a bad receipt since Phase 2, and that is the
 * right place for the last word. This is about the first word: the answer at
 * the moment of the scan, while the box is in somebody's hands and the driver
 * is still in the yard, which is the only moment anybody can do anything.
 *
 * Two things are checked hardest.
 *
 * **A box not on the order is said loudly.** Three things cause it -- the
 * supplier sent something nobody ordered, this is the wrong order for this
 * pallet, the box belongs to another delivery -- and all three are worth
 * stopping for. A system that shrugged would have the receiver shrug too.
 *
 * **The scan never counts.** It selects a line; a person types the number.
 * A design that added one per scan receives eleven of ten the first time a
 * scanner double-fires, and nobody finds out until the stocktake disagrees.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { countAgainst, scanAgainstOrder, stillOwedOn, whatIsLeft } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  countIn,
  ordersAwaitingDelivery,
  ReceivingError,
  scanIntoOrder,
  whatIsOnTheOrder,
} from '../../apps/web/src/lib/receiving';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    check(label, error instanceof ReceivingError ? error.code : String(error).slice(0, 70), code);
  }
}

async function main() {
  console.info('\n  The box in your hands\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  const waiting = await ordersAwaitingDelivery(org.id);
  check('the seed has an order waiting on a delivery', waiting.length >= 1, true);

  const open = waiting.find((one) => one.outstanding > 0);
  if (!open) {
    failures += 1;
    console.error('  FAIL   no order with anything outstanding. Reseed.');
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }

  const order = await whatIsOnTheOrder(org.id, open.id);
  const line = order.lines.find((one) => stillOwedOn(one) > 0)!;

  check('and the order names what is still owed', order.left.done, false);

  /* --- which line the box belongs to -------------------------------------- */

  console.info('\n  Which line it belongs to');

  const byPart = await scanIntoOrder(org.id, order.id, line.partNumber ?? '');
  check('a part number off the box finds its line', byPart.found, 'line');
  if (byPart.found === 'line') {
    check('and says how many are still owed', byPart.outstanding, stillOwedOn(line));
  }

  const unknown = await scanIntoOrder(org.id, order.id, 'NOT-ON-THIS-ORDER-9999');
  check('a box that is not on the order is said, not ignored', unknown.found, 'not-on-this-order');

  const settled = order.lines.find((one) => stillOwedOn(one) === 0);
  if (settled?.partNumber) {
    const already = await scanIntoOrder(org.id, order.id, settled.partNumber);
    check('a line already fully received says so', already.found, 'settled');
  } else {
    // Not a failure: a fully-received line is not guaranteed in the seed, and
    // the rules cover it. Said plainly rather than passing silently.
    console.info('  --     no fully received line on this order; covered by receiving.test.ts');
  }

  /* --- the scan never counts ----------------------------------------------- */

  console.info('\n  The scan never counts');

  const before = stillOwedOn(line);
  await scanIntoOrder(org.id, order.id, line.partNumber ?? '');
  await scanIntoOrder(org.id, order.id, line.partNumber ?? '');
  await scanIntoOrder(org.id, order.id, line.partNumber ?? '');

  const afterScans = await whatIsOnTheOrder(org.id, order.id);
  const same = afterScans.lines.find((one) => one.orderLineId === line.orderLineId)!;
  check('three scans book in nothing at all', stillOwedOn(same), before);

  /* --- and a person says how many ------------------------------------------ */

  console.info('\n  A person says how many');

  await refuses('nought is not a count', 'NOT_A_COUNT', () =>
    countIn({
      orgId: org.id,
      userId: owner.id,
      orderId: order.id,
      orderLineId: line.orderLineId,
      quantity: 0,
    }),
  );

  await refuses('nor is more than is owed', 'OVER_RECEIPT', () =>
    countIn({
      orgId: org.id,
      userId: owner.id,
      orderId: order.id,
      orderLineId: line.orderLineId,
      quantity: before + 1,
    }),
  );

  await refuses('nor a line that is not on this order', 'NOT_FOUND', () =>
    countIn({
      orgId: org.id,
      userId: owner.id,
      orderId: order.id,
      orderLineId: 'no-such-line',
      quantity: 1,
    }),
  );

  // One in, for real.
  const one = await countIn({
    orgId: org.id,
    userId: owner.id,
    orderId: order.id,
    orderLineId: line.orderLineId,
    quantity: 1,
    bin: 'VERIFY-BIN',
    reference: 'VERIFY-NOTE',
  });

  check('one booked in leaves one fewer owed', one.remaining, before - 1);

  const shelved = await prisma.stockLevel.findFirst({
    where: { productId: line.productId ?? '' },
    select: { binLocation: true },
  });
  check('and it is shelved in the same act', shelved?.binLocation, 'VERIFY-BIN');

  /* --- put it back ---------------------------------------------------------- */

  const receipt = await prisma.goodsReceipt.findFirst({
    where: { orderId: order.id, reference: 'VERIFY-NOTE' },
    select: { id: true },
  });

  if (receipt) {
    await prisma.goodsReceiptLine.deleteMany({ where: { receiptId: receipt.id } });
    await prisma.goodsReceipt.delete({ where: { id: receipt.id } });
  }

  await prisma.purchaseOrderLine.update({
    where: { id: line.orderLineId },
    data: { received: line.alreadyReceived },
  });
  await prisma.purchaseOrder.update({ where: { id: order.id }, data: { status: order.status } });
  await prisma.stockLevel.updateMany({
    where: { productId: line.productId ?? '' },
    data: { binLocation: line.bin },
  });

  const restored = await whatIsOnTheOrder(org.id, order.id);
  const back = restored.lines.find((one) => one.orderLineId === line.orderLineId)!;
  check('the probe leaves the order as it found it', stillOwedOn(back), before);

  /* --- the rules, on their own terms ---------------------------------------- */

  console.info('\n  And the rules behind it');

  check(
    'over-receipt is reported at the moment of the count, not only at the submit',
    countAgainst(line, before + 5).verdict,
    'OVER',
  );
  check('an exact count settles the line', countAgainst(line, before).verdict, 'EXACT');
  check(
    'a scan of nothing is not on the order',
    scanAgainstOrder(order.lines, '').found,
    'not-on-this-order',
  );
  check(
    'and the pallet knows when it is done',
    whatIsLeft(order.lines.map((one) => ({ ...one, counted: one.ordered }))).done,
    true,
  );

  console.info(
    failures === 0
      ? '\n  A box that is not on the order is said out loud, and a scan never counts.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
