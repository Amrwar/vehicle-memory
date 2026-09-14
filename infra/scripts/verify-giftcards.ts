/**
 * Gift cards, against a real database. Phase 26.
 *
 *   npx tsx infra/scripts/verify-giftcards.ts
 *
 * The rules have unit tests. What they cannot prove is the accounting: that
 * a card sold is a liability and not revenue, that a card redeemed releases
 * that liability rather than putting the money in the bank a second time,
 * that the balance on the card and the balance on the bill move together,
 * and that a refusal leaves both exactly where they were.
 *
 * A card is sold, a small bill is settled with part of it, a larger bill
 * takes the rest, and every refusal is tried in between. It cleans up after
 * itself, except for the passport events a completed job contributes.
 */

import 'dotenv/config';

import { ACCOUNT, GiftCardError, MoneyCycleError, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { postedLines } from '../../apps/web/src/lib/accounting';
import {
  findGiftCard,
  giftCardDetail,
  giftCardsFor,
  redeemGiftCard,
  sellGiftCard,
} from '../../apps/web/src/lib/giftcards';
import { createJob } from '../../apps/web/src/lib/jobs';
import { loyaltyCardFor } from '../../apps/web/src/lib/loyalty';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';

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

async function refuses(
  label: string,
  kind: new (...args: never[]) => Error,
  code: string,
  run: () => Promise<unknown>,
) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof kind && actual === code) {
      console.info(`  ok     ${label}: ${code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const TAG = 'Verify gift cards probe';

async function bill(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  hours: number;
  taxRateId: string | null;
}): Promise<{ invoiceId: string; totalMinor: number }> {
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
      hours: input.hours,
      rate: 40,
      taxRateId: input.taxRateId,
    },
  });
  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({ orgId: input.orgId, userId: input.userId, jobId: job.id });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true },
  });
  return { invoiceId, totalMinor: Math.round(Number(invoice.total) * 100) };
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id);

  const opening = trialBalance(await postedLines(org.id));
  check('the ledger balances before anything happens', opening.balanced, true);
  const before = await giftCardsFor(org.id);

  console.info('\nSelling a card');

  await refuses('pence', GiftCardError, 'TOO_SMALL', () =>
    sellGiftCard({
      orgId: org.id,
      userId: staff.id,
      amountMinor: 5_050,
      method: 'CARD',
      note: TAG,
    }),
  );
  await refuses('too little', GiftCardError, 'TOO_SMALL', () =>
    sellGiftCard({ orgId: org.id, userId: staff.id, amountMinor: 100, method: 'CARD', note: TAG }),
  );
  await refuses('too much', GiftCardError, 'TOO_LARGE', () =>
    sellGiftCard({
      orgId: org.id,
      userId: staff.id,
      amountMinor: 200_000,
      method: 'CARD',
      note: TAG,
    }),
  );
  await refuses('paid for with points', GiftCardError, 'BAD_METHOD', () =>
    sellGiftCard({
      orgId: org.id,
      userId: staff.id,
      amountMinor: 5_000,
      method: 'LOYALTY',
      note: TAG,
    }),
  );
  await refuses('paid for with another card', GiftCardError, 'BAD_METHOD', () =>
    sellGiftCard({
      orgId: org.id,
      userId: staff.id,
      amountMinor: 5_000,
      method: 'GIFT_CARD',
      note: TAG,
    }),
  );

  const sold = await sellGiftCard({
    orgId: org.id,
    userId: staff.id,
    amountMinor: 5_000,
    method: 'CARD',
    recipientName: 'Probe',
    note: TAG,
  });
  check('a twelve-character number', sold.code.length, 12);

  const fresh = await findGiftCard(org.id, sold.code.toLowerCase());
  check('found however it is typed', fresh.id, sold.id);
  check('holding fifty pounds', fresh.balanceMinor, 5_000);

  const salePosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'GiftCard', sourceId: sold.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check('the sale was posted', Boolean(salePosting), true);
  check(
    'money into the bank',
    salePosting?.lines.find((l) => Number(l.debit) > 0)?.account.code,
    ACCOUNT.BANK,
  );
  check(
    'owed as work, not booked as revenue',
    salePosting?.lines.find((l) => Number(l.credit) > 0)?.account.code,
    ACCOUNT.GIFT_CARDS,
  );

  const afterSale = await giftCardsFor(org.id);
  check(
    'the page owes fifty pounds more',
    afterSale.outstandingMinor - before.outstandingMinor,
    5_000,
  );

  console.info('\nA small bill, settled with part of it');

  const small = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId,
    vehicleId: previous.vehicleId,
    hours: 0.5,
    taxRateId: vat?.id ?? null,
  });
  check('the bill is less than the card', small.totalMinor < 5_000, true);

  await refuses('a number that is not one of ours', GiftCardError, 'NOT_A_CODE', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: small.invoiceId,
      code: 'hello',
      amountMinor: null,
    }),
  );
  await refuses('a number nobody has', GiftCardError, 'NOT_FOUND', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: small.invoiceId,
      code: 'BCDFGHJKLMNP',
      amountMinor: null,
    }),
  );
  await refuses('more than the bill', GiftCardError, 'NOT_ENOUGH', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: small.invoiceId,
      code: sold.code,
      amountMinor: small.totalMinor + 100,
    }),
  );
  const untouched = await findGiftCard(org.id, sold.code);
  check('a refusal spends nothing', untouched.balanceMinor, 5_000);

  const pointsBefore = await loyaltyCardFor(org.id, previous.customerId);

  const first = await redeemGiftCard({
    orgId: org.id,
    userId: staff.id,
    invoiceId: small.invoiceId,
    code: sold.code,
    amountMinor: null,
  });
  check('left blank, the card pays what the bill needs', first.amountMinor, small.totalMinor);
  check('and says what is left', first.leftMinor, 5_000 - small.totalMinor);

  const settled = await prisma.invoice.findUniqueOrThrow({
    where: { id: small.invoiceId },
    select: { status: true, payments: { select: { method: true, reference: true } } },
  });
  check('the bill is paid', settled.status, 'PAID');
  check('by a payment of its own kind', settled.payments[0]?.method, 'GIFT_CARD');
  check('naming the card', settled.payments[0]?.reference?.replace(/-/g, ''), sold.code);

  const redemption = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Payment', sourceId: first.paymentId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'the redemption releases what was owed',
    redemption?.lines.find((l) => Number(l.debit) > 0)?.account.code,
    ACCOUNT.GIFT_CARDS,
  );
  check(
    'and clears the customer’s debt',
    redemption?.lines.find((l) => Number(l.credit) > 0)?.account.code,
    ACCOUNT.RECEIVABLE,
  );
  check(
    'without touching the bank twice',
    redemption?.lines.some((l) => l.account.code === ACCOUNT.BANK) ?? true,
    false,
  );

  // The card was paid for with real money, so the bill it settles earns
  // points like any other. Only points themselves earn nothing.
  const pointsAfter = await loyaltyCardFor(org.id, previous.customerId);
  check(
    'a bill paid with a card still earns points',
    pointsAfter.balance - pointsBefore.balance,
    Math.floor(small.totalMinor / 100),
  );

  await refuses('a card against a settled bill', GiftCardError, 'NOTHING_OWED', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: small.invoiceId,
      code: sold.code,
      amountMinor: null,
    }),
  );

  console.info('\nA larger bill takes the rest');

  const large = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId,
    vehicleId: previous.vehicleId,
    hours: 2,
    taxRateId: vat?.id ?? null,
  });
  const left = 5_000 - small.totalMinor;
  check('the bill is more than the card has left', large.totalMinor > left, true);

  await refuses('more than is on the card', GiftCardError, 'NOT_ENOUGH', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: large.invoiceId,
      code: sold.code,
      amountMinor: left + 100,
    }),
  );

  const second = await redeemGiftCard({
    orgId: org.id,
    userId: staff.id,
    invoiceId: large.invoiceId,
    code: sold.code,
    amountMinor: null,
  });
  check('the card gives what it has', second.amountMinor, left);
  check('and is empty', second.leftMinor, 0);

  const partPaid = await prisma.invoice.findUniqueOrThrow({
    where: { id: large.invoiceId },
    select: { status: true, amountPaid: true },
  });
  check('the bill is part paid', partPaid.status, 'PART_PAID');
  check('by exactly that', Math.round(Number(partPaid.amountPaid) * 100), left);

  await refuses('an empty card', GiftCardError, 'EMPTY', () =>
    redeemGiftCard({
      orgId: org.id,
      userId: staff.id,
      invoiceId: large.invoiceId,
      code: sold.code,
      amountMinor: null,
    }),
  );

  const detail = await giftCardDetail(org.id, sold.id);
  check('the card shows three movements', detail?.entries.length, 3);
  check(
    'each naming what it was for',
    detail?.entries.map(
      (e) => e.reason.startsWith('Sold') || e.reason.startsWith('Against invoice'),
    ),
    [true, true, true],
  );
  check('and nothing left', detail?.balanceMinor, 0);

  const afterAll = await giftCardsFor(org.id);
  check(
    'the page owes nothing more than before',
    afterAll.outstandingMinor,
    before.outstandingMinor,
  );
  check('and counts the fifty pounds spent', afterAll.spentMinor - before.spentMinor, 5_000);

  const closing = trialBalance(await postedLines(org.id));
  check('the ledger still balances', closing.balanced, true);

  await refuses(
    'a draft invoice, before anything is spent',
    MoneyCycleError,
    'NOT_ISSUED',
    async () => {
      const other = await sellGiftCard({
        orgId: org.id,
        userId: staff.id,
        amountMinor: 1_000,
        method: 'CASH',
        note: TAG,
      });
      const draft = await prisma.invoice.create({
        data: {
          orgId: org.id,
          customerId: previous.customerId,
          number: `${TAG} draft`,
          status: 'DRAFT',
          currency: 'GBP',
          subtotal: 10,
          taxTotal: 0,
          total: 10,
          amountPaid: 0,
        },
        select: { id: true },
      });
      try {
        await redeemGiftCard({
          orgId: org.id,
          userId: staff.id,
          invoiceId: draft.id,
          code: other.code,
          amountMinor: null,
        });
      } finally {
        const stillTen = await findGiftCard(org.id, other.code);
        check('and the card is untouched', stillTen.balanceMinor, 1_000);
      }
    },
  );

  await forget(org.id);

  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string) {
  const cards = await prisma.giftCard.findMany({
    where: { orgId, note: TAG },
    select: { id: true },
  });
  for (const card of cards) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'GiftCard', sourceId: card.id },
    });
  }
  await prisma.giftCard.deleteMany({ where: { id: { in: cards.map((c) => c.id) } } });

  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { OR: [{ jobId: { in: jobIds } }, { orgId, number: `${TAG} draft` }] },
    select: { id: true, number: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
  ];
  for (const source of sources) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }
  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, reason: { in: invoices.map((i) => `Invoice ${i.number} paid`) } },
  });
  await prisma.messageLog.deleteMany({ where: { orgId, relatedId: { in: invoiceIds } } });
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
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
