/**
 * Asks whether a workshop's books still agree with themselves.
 *
 *   npx tsx infra/scripts/verify-books.ts
 *
 * Phase 47. Every other check in this product asks whether an operation did
 * the right thing. This asks the opposite, and it is the harder question: given
 * everything that has ever happened to a workshop, however it was arrived at,
 * do the figures still agree?
 *
 * A ledger can be posted correctly ten thousand times and still be wrong,
 * because the eleven-thousandth was a migration, a hand-written fix at two in
 * the morning, a half-applied refund, or a feature somebody added without
 * checking it against the accounts. None of those go through the functions the
 * other suites exercise.
 *
 * Run against three workshops, deliberately:
 *
 *   - the seeded one, which is a year of tidy work;
 *   - the demonstration, which is built through the product's own functions
 *     and is therefore the best evidence that ordinary use keeps the books
 *     straight;
 *   - a month of chaos, generated here: refunds, credit notes, part payments,
 *     gift cards, coupons, deposits, counter sales and money held, in an order
 *     nobody would choose. If the invariants survive that, they will survive a
 *     Tuesday.
 *
 * And then it breaks the books on purpose, to prove the checks can fail. An
 * invariant suite that has never failed is a suite nobody has tested.
 */

import 'dotenv/config';

import { describeAudit, money, unaccountedFor, worstFirst } from '@carnet/core';
import { prisma } from '@carnet/db';

import { auditBooks } from '../../apps/web/src/lib/books';
import { completeSale } from '../../apps/web/src/lib/counter';
import { adjustStock } from '../../apps/web/src/lib/inventory';
import { applyHeld, takeDeposit } from '../../apps/web/src/lib/deposits';
import { redeemGiftCard, sellGiftCard } from '../../apps/web/src/lib/giftcards';
import { createJob } from '../../apps/web/src/lib/jobs';
import {
  issueInvoice,
  moveJob,
  raiseCreditNote,
  recordPayment,
  recordRefund,
} from '../../apps/web/src/lib/money';

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown) {
  console.info(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${String(detail)}`}`,
  );
  if (!passed) failures += 1;
}

const TAG = 'Verify books probe';

/** A workshop's books, with every breach printed so it can be acted on. */
async function audit(label: string, orgId: string): Promise<boolean> {
  const result = await auditBooks(orgId);

  console.info(`  ${label}: ${describeAudit(result)}`);

  for (const breach of worstFirst(result.breaches).slice(0, 8)) {
    console.error(`        ${breach.rule}: ${breach.sentence}`);
  }

  for (const violation of result.violations.slice(0, 8)) {
    console.error(`        ${violation.rule}: ${violation.sentence}`);
  }

  return result.breaches.length === 0 && result.violations.length === 0;
}

async function main() {
  console.info('\n  Do the books still agree with themselves?\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  await forget(org.id);

  /* --- the seeded workshop -------------------------------------------------- */

  console.info('\n  A year of ordinary work');
  check('the seeded workshop agrees with itself', await audit('seeded', org.id));

  /* --- the demonstration ---------------------------------------------------- */

  const demonstration = await prisma.organization.findFirst({
    where: { isDemonstration: true },
    select: { id: true, name: true },
  });

  if (demonstration) {
    console.info('\n  The demonstration workshop');
    check(
      'a workshop built entirely through the product agrees with itself',
      await audit('demonstration', demonstration.id),
    );
  } else {
    console.info('\n  No demonstration workshop to check; skipping that one.');
  }

  /* --- a month of chaos ----------------------------------------------------- */

  console.info('\n  A month of chaos');

  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });
  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { orgId: org.id, code: 'MAIN' },
  });
  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '87139-0D070' },
    select: { id: true, sellPrice: true },
  });

  const made = await chaos({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    taxRateId: vat?.id ?? null,
    warehouseId: warehouse.id,
    locationId: warehouse.locationId,
    productId: product.id,
    unitPrice: Number(product.sellPrice),
  });

  console.info(
    `        ${made.bills} bills, ${made.payments} payments, ${made.credits} credit notes, ` +
      `${made.refunds} refunds, ${made.cards} gift cards, ${made.deposits} deposits, ${made.sales} counter sales`,
  );

  check('and the books still agree after all of it', await audit('after chaos', org.id));

  /* --- and the checks can fail --------------------------------------------- */

  console.info('\n  Breaking it on purpose');

  const victim = await prisma.invoice.findFirstOrThrow({
    where: { orgId: org.id, job: { shortDescription: TAG } },
    select: { id: true, number: true, total: true },
  });

  // A stored total nudged away from its lines: the shape of a bad migration,
  // and invisible to every other check in this product.
  await prisma.invoice.update({
    where: { id: victim.id },
    data: { total: Number(victim.total) + 20 },
  });

  const broken = await auditBooks(org.id);
  const named = broken.breaches.some((breach) => breach.document.includes(victim.number));

  check('a total that drifted from its lines is found', named, describeAudit(broken));
  check(
    'and the difference is named to the penny',
    unaccountedFor(broken).minor >= 2_000,
    describeAudit(broken),
  );

  await prisma.invoice.update({
    where: { id: victim.id },
    data: { total: Number(victim.total) },
  });

  check('and putting it back makes the books agree again', await audit('restored', org.id));

  /* --- and nothing left behind ---------------------------------------------- */

  await forget(org.id);
  check('the probe left the books as it found them', await audit('cleaned up', org.id));

  console.info(
    `\n  ${failures === 0 ? 'The books agree with themselves, and say so when they do not.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

/**
 * A month of work in the order nobody would choose.
 *
 * Deliberately awkward: bills part paid then credited, refunds against
 * credits, a gift card spent across two bills, money held applied to a third,
 * and counter sales in between. Each of these is correct on its own; the
 * question is whether they are still correct together.
 */
async function chaos(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  taxRateId: string | null;
  warehouseId: string;
  locationId: string | null;
  productId: string;
  unitPrice: number;
}) {
  const made = { bills: 0, payments: 0, credits: 0, refunds: 0, cards: 0, deposits: 0, sales: 0 };

  const bill = async (hours: number) => {
    const job = await createJob({
      orgId: input.orgId,
      userId: input.userId,
      locationId: null,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      shortDescription: TAG,
    });

    await prisma.jobLabourLine.create({
      data: {
        jobId: job.id,
        description: 'Probe labour',
        hours,
        rate: 40,
        taxRateId: input.taxRateId,
      },
    });

    await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'IN_PROGRESS' });
    await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'COMPLETED' });

    const invoiceId = await issueInvoice({
      orgId: input.orgId,
      userId: input.userId,
      jobId: job.id,
    });

    made.bills += 1;

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { total: true },
    });

    return { invoiceId, totalMinor: Math.round(Number(invoice.total) * 100) };
  };

  // One paid in full.
  const first = await bill(3);
  await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: first.invoiceId,
    amount: money(first.totalMinor),
    method: 'CASH',
    reference: TAG,
  });
  made.payments += 1;

  // One part paid, then credited, then refunded.
  const second = await bill(5);
  await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: second.invoiceId,
    amount: money(Math.round(second.totalMinor / 2)),
    method: 'CARD',
    reference: TAG,
  });
  made.payments += 1;

  const note = await raiseCreditNote({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: second.invoiceId,
    amount: money(2_000),
    reason: `${TAG}: goodwill`,
  });
  made.credits += 1;

  await recordRefund({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: second.invoiceId,
    creditNoteId: note,
    amount: money(2_000),
    method: 'BANK_TRANSFER',
    reference: TAG,
  });
  made.refunds += 1;

  // A gift card sold and spent across a bill.
  const card = await sellGiftCard({
    orgId: input.orgId,
    userId: input.userId,
    amountMinor: 10_000,
    method: 'CARD',
    note: TAG,
  });
  made.cards += 1;

  const third = await bill(2);
  const sold = await prisma.giftCard.findUniqueOrThrow({
    where: { id: card.id },
    select: { code: true },
  });

  await redeemGiftCard({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: third.invoiceId,
    code: sold.code,
    amountMinor: Math.min(5_000, third.totalMinor),
  });
  made.payments += 1;

  // Money taken before the work, then put against a bill.
  await takeDeposit({
    orgId: input.orgId,
    userId: input.userId,
    customerId: input.customerId,
    jobId: null,
    amountMinor: 15_000,
    method: 'CARD',
    reference: TAG,
    note: TAG,
  });
  made.deposits += 1;

  const fourth = await bill(4);
  await applyHeld({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: fourth.invoiceId,
    amountMinor: 10_000,
  });
  made.payments += 1;

  // And a couple of counter sales in between, which post their own entry.
  for (const quantity of [1, 2]) {
    const sale = await completeSale({
      orgId: input.orgId,
      locationId: input.locationId,
      userId: input.userId,
      lines: [
        {
          productId: input.productId,
          kind: 'PART',
          description: TAG,
          quantity,
          unitPrice: input.unitPrice,
        },
      ],
      tenders: [{ kind: 'CASH', amount: money(50_000) }],
    });

    if (sale.ok) made.sales += 1;
  }

  return made;
}

async function forget(orgId: string) {
  const sales = await prisma.counterSale.findMany({
    where: { orgId, lines: { some: { description: TAG } } },
    select: { id: true },
  });

  // The stock these sales took off the shelf goes back before their movements
  // are deleted. A shelf is held to the balance its last movement wrote down,
  // so undoing a sale by deleting its movement and leaving the figure alone
  // plants exactly the drift this script exists to find — and a probe that
  // fails its own audit is worse than no probe.
  for (const sale of sales) {
    const moved = await prisma.stockMovement.findMany({
      where: { orgId, referenceType: 'CounterSale', referenceId: sale.id },
      select: { productId: true, warehouseId: true, quantity: true },
    });

    for (const movement of moved) {
      await adjustStock({
        orgId,
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        quantity: -Number(movement.quantity),
        reason: TAG,
      });
    }

    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'CounterSale', sourceId: sale.id },
    });
    await prisma.stockMovement.deleteMany({
      where: { orgId, referenceType: 'CounterSale', referenceId: sale.id },
    });
  }

  // And the corrections themselves, so the shelf is left on the movement it
  // was on before any of this ran.
  await prisma.stockMovement.deleteMany({ where: { orgId, reason: TAG } });
  await prisma.counterSale.deleteMany({ where: { id: { in: sales.map((sale) => sale.id) } } });

  const cards = await prisma.giftCard.findMany({
    where: { orgId, note: TAG },
    select: { id: true, entries: { select: { id: true } } },
  });

  for (const card of cards) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'GiftCard', sourceId: card.id },
    });
    await prisma.journalEntry.deleteMany({
      where: {
        orgId,
        sourceType: 'GiftCardEntry',
        sourceId: { in: card.entries.map((entry) => entry.id) },
      },
    });
  }
  await prisma.giftCard.deleteMany({ where: { id: { in: cards.map((card) => card.id) } } });

  const deposits = await prisma.deposit.findMany({
    where: { orgId, note: TAG },
    select: { id: true, movements: { select: { id: true } } },
  });

  for (const deposit of deposits) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'Deposit', sourceId: deposit.id },
    });
    await prisma.journalEntry.deleteMany({
      where: {
        orgId,
        sourceType: 'DepositMovement',
        sourceId: { in: deposit.movements.map((movement) => movement.id) },
      },
    });
  }
  await prisma.deposit.deleteMany({ where: { id: { in: deposits.map((row) => row.id) } } });

  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);

  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true, number: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);

  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const notes = await prisma.creditNote.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const refunds = await prisma.refund.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });

  for (const source of [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((row) => ({ sourceType: 'Payment', sourceId: row.id })),
    ...notes.map((row) => ({ sourceType: 'CreditNote', sourceId: row.id })),
    ...refunds.map((row) => ({ sourceType: 'Refund', sourceId: row.id })),
  ]) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }

  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, once: { in: invoiceIds.map((id) => `invoice:${id}:paid`) } },
  });
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedId: { in: [...invoiceIds, ...jobIds, ...notes.map((n) => n.id)] } },
  });
  await prisma.refund.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: {
      orgId,
      type: { in: ['job.completed', 'invoice.issued', 'payment.received'] },
      processedAt: null,
    },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
