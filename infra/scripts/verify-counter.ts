/**
 * Proves a counter sale does what a job would have done.
 *
 *   npx tsx infra/scripts/verify-counter.ts
 *
 * A counter sale has no job to anchor the stock movement, the cost or the
 * ledger posting, so all three have to happen on their own. When they do not,
 * the symptoms are slow and indirect: stock drifting a little each week, and a
 * till that will not balance for reasons nobody can trace back to a Tuesday.
 *
 * Sells a real part, then checks the shelf, the accounts and the drawer.
 */

import 'dotenv/config';

import { money, toDecimalString, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { postedLines } from '../../apps/web/src/lib/accounting';
import { completeSale, openTill } from '../../apps/web/src/lib/counter';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

async function main() {
  console.info('\n  A counter sale, end to end\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER', isActive: true },
  });

  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { orgId: org.id, code: 'MAIN' },
  });

  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '87139-0D070' },
  });

  const before = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId: warehouse.id },
  });

  const balanceBefore = await trialBalance(await postedLines(org.id));
  const stockBefore = Number(before.onHand);

  /* --- the sale ----------------------------------------------------------- */

  const sale = await completeSale({
    orgId: org.id,
    locationId: warehouse.locationId,
    userId: owner.userId,
    lines: [
      {
        productId: product.id,
        kind: 'PART',
        description: product.name,
        quantity: 2,
        unitPrice: Number(product.sellPrice),
      },
    ],
    tenders: [{ kind: 'CASH', amount: money(10_000) }],
  });

  check('the sale is taken', sale.ok, sale.error ?? sale.reference);
  if (!sale.ok) {
    finish();
    return;
  }

  check('it has a receipt number', Boolean(sale.reference), sale.reference);
  check('change is worked out', (sale.changeMinor ?? 0) > 0, `${(sale.changeMinor ?? 0) / 100}`);

  /* --- the shelf ---------------------------------------------------------- */

  const after = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId: warehouse.id },
  });

  check(
    'the stock left the shelf',
    Number(after.onHand) === stockBefore - 2,
    `${stockBefore} to ${Number(after.onHand)}`,
  );

  const movement = await prisma.stockMovement.findFirst({
    where: { referenceType: 'CounterSale', referenceId: sale.saleId },
  });

  check('a movement records why', Boolean(movement), movement?.reason ?? undefined);
  check('at the cost it was worth', Number(movement?.unitCost) === Number(before.avgCost));

  /* --- the ledger --------------------------------------------------------- */

  const balanceAfter = trialBalance(await postedLines(org.id));

  check('the books still balance', balanceAfter.balanced, toDecimalString(balanceAfter.difference));

  check(
    'more has been posted than before',
    balanceAfter.totalDebits.minor > balanceBefore.totalDebits.minor,
  );

  const entry = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'CounterSale', sourceId: sale.saleId },
    include: { lines: { include: { account: true } } },
  });

  check('the sale posted to the ledger', Boolean(entry), entry?.reference);

  const cash = entry?.lines.find((line) => line.account.code === '1010');
  const stock = entry?.lines.find((line) => line.account.code === '1200');
  const cogs = entry?.lines.find((line) => line.account.code === '5000');

  check('cash went to the drawer account, not the bank', Number(cash?.debit ?? 0) > 0);
  check('stock was credited at the moment of sale', Number(stock?.credit ?? 0) > 0);
  check(
    'cost of sale was recognised now, with no job to do it later',
    Number(cogs?.debit ?? 0) > 0,
  );

  check(
    'the drawer debit is net of the change given',
    Math.abs(Number(cash?.debit ?? 0) * 100 - (10_000 - (sale.changeMinor ?? 0))) < 2,
    `${Number(cash?.debit ?? 0)}`,
  );

  /* --- the till ----------------------------------------------------------- */

  const till = await openTill(org.id, warehouse.locationId);

  check('a till session opened', Boolean(till));
  check('the sale is in it', (till?.saleCount ?? 0) > 0, `${till?.saleCount}`);
  check(
    'the drawer expects the cash less the change',
    (till?.cashMinor ?? 0) === 10_000 - (sale.changeMinor ?? 0),
    `${till?.cashMinor}`,
  );

  /* --- refusals ------------------------------------------------------------ */

  const empty = await completeSale({
    orgId: org.id,
    locationId: warehouse.locationId,
    userId: owner.userId,
    lines: [],
    tenders: [{ kind: 'CASH', amount: money(1000) }],
  });

  check('an empty sale is refused', !empty.ok, empty.error);

  const short = await completeSale({
    orgId: org.id,
    locationId: warehouse.locationId,
    userId: owner.userId,
    lines: [
      {
        productId: product.id,
        kind: 'PART',
        description: product.name,
        quantity: 1,
        unitPrice: Number(product.sellPrice),
      },
    ],
    tenders: [{ kind: 'CASH', amount: money(100) }],
  });

  check('a short payment is refused, and says by how much', !short.ok, short.error);

  const overCard = await completeSale({
    orgId: org.id,
    locationId: warehouse.locationId,
    userId: owner.userId,
    lines: [
      {
        productId: product.id,
        kind: 'PART',
        description: product.name,
        quantity: 1,
        unitPrice: Number(product.sellPrice),
      },
    ],
    tenders: [{ kind: 'CARD', amount: money(50000) }],
  });

  check('an over-tendered card is refused', !overCard.ok, overCard.error);

  const stockNow = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId: warehouse.id },
  });

  check(
    'a refused sale moved no stock',
    Number(stockNow.onHand) === Number(after.onHand),
    `${Number(stockNow.onHand)}`,
  );

  finish();
}

function finish() {
  console.info(
    `\n  ${failures === 0 ? 'A counter sale moves stock, posts to the ledger and reaches the till.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
