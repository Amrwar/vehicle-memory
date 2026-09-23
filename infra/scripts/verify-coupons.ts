/**
 * Proves a coupon takes money off a bill without taking money out of the books.
 *
 *   npx tsx infra/scripts/verify-coupons.ts
 *
 * A coupon is the one discount a customer arrives holding, which makes it the
 * one discount a workshop cannot check at its leisure. Everything it promises
 * — when it starts, when it ends, what the bill has to reach, how many times
 * it can be used at all and by one person — has to be tested in front of
 * somebody standing at a counter, and every refusal has to be a sentence that
 * person can repeat out loud.
 *
 * So this walks the promises one at a time, and then the two places a code is
 * actually taken: against an issued invoice, and at the counter. In both, the
 * bill keeps the total it was billed at and what the code gave away lands in
 * what the offers cost, never in the takings. A workshop that books a discount
 * as revenue it never received has a set of accounts that says it is doing
 * better than it is.
 *
 * Runs against the seeded hillside-motors and clears up after itself.
 */

import 'dotenv/config';

import { CouponError, money, toDecimalString, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import {
  coupons,
  couponHistory,
  couponResultsFor,
  quoteCoupon,
  redeemAgainstInvoice,
  retireCoupon,
  saveCoupon,
} from '../../apps/web/src/lib/coupons';
import { completeSale } from '../../apps/web/src/lib/counter';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown) {
  console.info(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${String(detail)}`}`,
  );
  if (!passed) failures += 1;
}

/**
 * A refusal is only useful if it is the right refusal. Checking the code as
 * well as the failure stops a coupon that is quietly rejected for the wrong
 * reason from passing as a coupon that was correctly turned down.
 */
async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL  ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof CouponError && actual === code) {
      console.info(`  ok    ${label}: ${code} — ${error.message}`);
    } else {
      failures += 1;
      console.error(`  FAIL  ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const TAG = 'Verify coupons probe';
const PREFIX = 'VERIFY';

const day = (offset: number) => {
  const at = new Date();
  at.setUTCHours(0, 0, 0, 0);
  return new Date(at.getTime() + offset * 86_400_000);
};

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
  console.info('\n  A code a customer hands over\n');

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
  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { orgId: org.id, code: 'MAIN' },
  });

  await forget(org.id);

  const opening = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances before anything happens', opening.balanced);

  /* --- what a code may promise -------------------------------------------- */

  console.info('\n  Writing the code down');

  await refuses('two letters', 'BAD_CODE', () =>
    save(org.id, staff.id, { code: 'AB', kind: 'PERCENT', percent: 10 }),
  );
  await refuses('a hundred per cent', 'BAD_VALUE', () =>
    save(org.id, staff.id, { code: `${PREFIX}FREE`, kind: 'PERCENT', percent: 140 }),
  );
  await refuses('nothing off', 'BAD_VALUE', () =>
    save(org.id, staff.id, { code: `${PREFIX}NIL`, kind: 'AMOUNT', amount: 0 }),
  );
  await refuses('ending before it starts', 'BAD_DATES', () =>
    save(org.id, staff.id, {
      code: `${PREFIX}BACK`,
      kind: 'PERCENT',
      percent: 10,
      startsOn: day(10),
      endsOn: day(2),
    }),
  );
  await refuses('half a use', 'BAD_LIMIT', () =>
    save(org.id, staff.id, {
      code: `${PREFIX}HALF`,
      kind: 'PERCENT',
      percent: 10,
      maxRedemptions: 2.5,
    }),
  );

  const tenId = await save(org.id, staff.id, {
    code: `${PREFIX}TEN`,
    kind: 'PERCENT',
    percent: 10,
    endsOn: day(30),
  });
  check('a percentage code is written down', Boolean(tenId));

  await refuses('the same code twice', 'BAD_CODE', () =>
    save(org.id, staff.id, { code: `${PREFIX}-ten`, kind: 'PERCENT', percent: 25 }),
  );

  const written = await prisma.coupon.findUniqueOrThrow({ where: { id: tenId } });
  check('spaces and case do not matter', written.code === `${PREFIX}TEN`, written.code);

  await save(org.id, staff.id, {
    code: `${PREFIX}GONE`,
    kind: 'AMOUNT',
    amount: 15,
    endsOn: day(-1),
  });
  await save(org.id, staff.id, {
    code: `${PREFIX}SOON`,
    kind: 'AMOUNT',
    amount: 15,
    startsOn: day(7),
  });
  await save(org.id, staff.id, {
    code: `${PREFIX}BIG`,
    kind: 'AMOUNT',
    amount: 20,
    minSpend: 50,
  });
  const onceId = await save(org.id, staff.id, {
    code: `${PREFIX}ONCE`,
    kind: 'AMOUNT',
    amount: 10,
    maxRedemptions: 1,
  });
  const retiredId = await save(org.id, staff.id, {
    code: `${PREFIX}OLD`,
    kind: 'PERCENT',
    percent: 5,
  });
  await retireCoupon({ orgId: org.id, userId: staff.id, id: retiredId, active: false });
  // Pressed twice, it stays withdrawn rather than coming back. Phase 46.
  await retireCoupon({ orgId: org.id, userId: staff.id, id: retiredId, active: false });

  /* --- what a code is worth against a bill -------------------------------- */

  console.info('\n  Quoting it against a bill');

  const quote = await quoteCoupon({ orgId: org.id, code: `${PREFIX}TEN`, billMinor: 24_000 });
  check('ten per cent of £240 is £24', quote.discountMinor === 2_400, quote.discountMinor);

  const spaced = await quoteCoupon({ orgId: org.id, code: ' verify-ten ', billMinor: 10_000 });
  check('the same code typed carelessly', spaced.discountMinor === 1_000, spaced.discountMinor);

  await refuses('a code nobody issued', 'NOT_FOUND', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}NOPE`, billMinor: 10_000 }),
  );
  await refuses('a code that ran out', 'ENDED', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}GONE`, billMinor: 10_000 }),
  );
  await refuses('a code that has not started', 'NOT_YET', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}SOON`, billMinor: 10_000 }),
  );
  await refuses('a code that was retired', 'RETIRED', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}OLD`, billMinor: 10_000 }),
  );
  await refuses('a bill too small for the code', 'TOO_SMALL', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}BIG`, billMinor: 1_000 }),
  );
  await refuses('a bill with nothing left on it', 'NOTHING_OWED', () =>
    quoteCoupon({ orgId: org.id, code: `${PREFIX}TEN`, billMinor: 10_000, owedMinor: 0 }),
  );
  await refuses('no code at all', 'NO_CODE', () =>
    quoteCoupon({ orgId: org.id, code: '  ', billMinor: 10_000 }),
  );

  // The one that would hand cash back if nobody checked.
  const capped = await quoteCoupon({
    orgId: org.id,
    code: `${PREFIX}BIG`,
    billMinor: 10_000,
    owedMinor: 500,
  });
  check(
    'a code is never worth more than is owed',
    capped.discountMinor === 500,
    capped.discountMinor,
  );

  check('quoting spends nothing', (await one(tenId)).redeemed === 0);

  /* --- against an issued invoice ------------------------------------------ */

  console.info('\n  Against an issued invoice');

  const first = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    hours: 5,
    taxRateId: vat?.id ?? null,
  });

  const taken = await redeemAgainstInvoice({
    orgId: org.id,
    userId: staff.id,
    invoiceId: first.invoiceId,
    code: `${PREFIX}TEN`,
  });

  check(
    'ten per cent came off',
    taken.discountMinor === Math.round(first.totalMinor * 0.1),
    `${taken.discountMinor} of ${first.totalMinor}`,
  );

  const settled = await prisma.invoice.findUniqueOrThrow({
    where: { id: first.invoiceId },
    select: { total: true, amountPaid: true, status: true },
  });

  check(
    'the invoice keeps the total it was issued at',
    Math.round(Number(settled.total) * 100) === first.totalMinor,
    Number(settled.total),
  );
  check(
    'and the customer owes that much less',
    Math.round(Number(settled.amountPaid) * 100) === taken.discountMinor,
    Number(settled.amountPaid),
  );

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: taken.paymentId } });
  check('it is settled as a payment of its own kind', payment.method === 'COUPON', payment.method);
  check('with the code on it', payment.reference === `${PREFIX}TEN`, payment.reference);

  const entry = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Payment', sourceId: taken.paymentId },
    include: { lines: { include: { account: true } } },
  });

  const offers = entry?.lines.find((line) => line.account.code === '6410');
  const bank = entry?.lines.find((line) => line.account.code === '1020');
  const drawer = entry?.lines.find((line) => line.account.code === '1010');

  check('what it gave away is what the offer cost', Number(offers?.debit ?? 0) > 0, offers?.debit);
  check('no money reached the bank', !bank, bank?.debit);
  check('and none reached the drawer', !drawer, drawer?.debit);

  const balanced = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the books still balance', balanced.balanced, toDecimalString(balanced.difference));

  await refuses('the same code twice on one bill', 'ALREADY_USED', () =>
    redeemAgainstInvoice({
      orgId: org.id,
      userId: staff.id,
      invoiceId: first.invoiceId,
      code: `${PREFIX}TEN`,
    }),
  );

  check('and it was only ever spent once', (await one(tenId)).redeemed === 1);

  /* --- the limits, on a second bill --------------------------------------- */

  console.info('\n  The limits it was given');

  const second = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    hours: 4,
    taxRateId: vat?.id ?? null,
  });

  await refuses('one to a customer, on their next bill', 'ALREADY_USED', () =>
    redeemAgainstInvoice({
      orgId: org.id,
      userId: staff.id,
      invoiceId: second.invoiceId,
      code: `${PREFIX}TEN`,
    }),
  );

  await redeemAgainstInvoice({
    orgId: org.id,
    userId: staff.id,
    invoiceId: second.invoiceId,
    code: `${PREFIX}ONCE`,
  });

  check('a code with one use in it is spent', (await one(onceId)).redeemed === 1);

  const third = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    hours: 3,
    taxRateId: vat?.id ?? null,
  });

  await refuses('and then it is finished for everybody', 'USED_UP', () =>
    redeemAgainstInvoice({
      orgId: org.id,
      userId: staff.id,
      invoiceId: third.invoiceId,
      code: `${PREFIX}ONCE`,
    }),
  );

  await refuses('an invoice from another workshop', 'NOT_FOUND', () =>
    redeemAgainstInvoice({
      orgId: org.id,
      userId: staff.id,
      invoiceId: 'not-an-invoice',
      code: `${PREFIX}TEN`,
    }),
  );

  /* --- at the counter ------------------------------------------------------ */

  console.info('\n  At the counter');

  const counterCode = await save(org.id, staff.id, {
    code: `${PREFIX}TILL`,
    kind: 'AMOUNT',
    amount: 5,
  });

  const priced = 60;
  const totalMinor = Math.round(priced * 1.2 * 100);
  const discountMinor = 500;

  const sale = await completeSale({
    orgId: org.id,
    locationId: warehouse.locationId,
    userId: staff.id,
    lines: [{ productId: null, kind: 'FEE', description: TAG, quantity: 1, unitPrice: priced }],
    tenders: [
      { kind: 'COUPON', amount: money(discountMinor) },
      { kind: 'CASH', amount: money(totalMinor - discountMinor) },
    ],
    couponId: counterCode,
  });

  check('the sale is taken', sale.ok, sale.error ?? sale.reference);

  const sold = sale.saleId
    ? await prisma.counterSale.findUniqueOrThrow({
        where: { id: sale.saleId },
        include: { tenders: true },
      })
    : null;

  check(
    'the sale keeps the total it was billed at',
    Math.round(Number(sold?.total ?? 0) * 100) === totalMinor,
    Number(sold?.total),
  );
  check(
    'the coupon is a tender of its own kind',
    sold?.tenders.some((tender) => tender.kind === 'COUPON') ?? false,
  );
  check('no change was given on it', Math.round(Number(sold?.changeGiven ?? 0) * 100) === 0);

  const saleEntry = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'CounterSale', sourceId: sale.saleId ?? '' },
    include: { lines: { include: { account: true } } },
  });

  const saleOffers = saleEntry?.lines.find((line) => line.account.code === '6410');
  const saleCash = saleEntry?.lines.find((line) => line.account.code === '1010');

  check(
    'the drawer only expects what was actually handed over',
    Math.round(Number(saleCash?.debit ?? 0) * 100) === totalMinor - discountMinor,
    Number(saleCash?.debit),
  );
  check(
    'and the rest is what the offer cost',
    Math.round(Number(saleOffers?.debit ?? 0) * 100) === discountMinor,
    Number(saleOffers?.debit),
  );

  const afterSale = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the books balance after the counter too', afterSale.balanced);

  check('the code at the counter was spent', (await one(counterCode)).redeemed === 1);

  /* --- what the workshop reads back --------------------------------------- */

  console.info('\n  What the workshop reads back');

  const rows = (await coupons(org.id)).filter((row) => row.code.startsWith(PREFIX));

  const states = new Map(rows.map((row) => [row.code, row.state]));
  check('a live code reads as running', states.get(`${PREFIX}TILL`) === 'ACTIVE');
  check('a dated code reads as finished', states.get(`${PREFIX}GONE`) === 'ENDED');
  check('a future code reads as not started', states.get(`${PREFIX}SOON`) === 'NOT_YET');
  check('a spent code reads as all used', states.get(`${PREFIX}ONCE`) === 'USED_UP');
  check('a withdrawn code reads as retired', states.get(`${PREFIX}OLD`) === 'RETIRED');

  const described = rows.find((row) => row.code === `${PREFIX}BIG`)?.summary ?? '';
  check(
    'a code says what it is in one line',
    described.includes('off') && described.includes('bills over'),
    described,
  );

  const results = (await couponResultsFor(org.id, { from: day(-1), to: day(1) })).filter((row) =>
    row.code.startsWith(PREFIX),
  );

  const ten = results.find((row) => row.code === `${PREFIX}TEN`);
  check(
    'what each code gave away is read, not estimated',
    ten?.given.minor === taken.discountMinor,
  );
  check(
    'beside what was billed on the visits it was used on',
    (ten?.billed.minor ?? 0) === first.totalMinor,
    ten?.billed.minor,
  );

  const history = await couponHistory(org.id, tenId);
  check('and who used it, with the bill it was used on', history.length === 1, history.length);
  check('the invoice is named', Boolean(history[0]?.invoice?.number), history[0]?.invoice?.number);

  /* --- and nothing left behind -------------------------------------------- */

  await forget(org.id);

  const closing = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the probe left the books as it found them', closing.balanced);
  check(
    'and left no codes behind',
    (await prisma.coupon.count({ where: { orgId: org.id, code: { startsWith: PREFIX } } })) === 0,
  );

  console.info(
    `\n  ${failures === 0 ? 'A coupon comes off the bill, and lands in what the offers cost.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

async function one(id: string) {
  return prisma.coupon.findUniqueOrThrow({ where: { id } });
}

function save(
  orgId: string,
  userId: string,
  input: {
    code: string;
    kind: 'PERCENT' | 'AMOUNT';
    percent?: number;
    amount?: number;
    minSpend?: number | null;
    startsOn?: Date | null;
    endsOn?: Date | null;
    maxRedemptions?: number | null;
    perCustomer?: number;
  },
) {
  return saveCoupon({
    orgId,
    userId,
    code: input.code,
    kind: input.kind,
    percent: input.percent ?? 0,
    amount: input.amount ?? 0,
    minSpend: input.minSpend ?? null,
    startsOn: input.startsOn ?? null,
    endsOn: input.endsOn ?? null,
    maxRedemptions: input.maxRedemptions ?? null,
    perCustomer: input.perCustomer ?? 1,
    note: TAG,
  });
}

/**
 * Everything the probe made, in the order the foreign keys allow. Redemptions
 * go before the codes and the bills they point at, because a row that names a
 * deleted invoice is exactly the kind of debris that makes the next run fail
 * for a reason that has nothing to do with coupons.
 */
async function forget(orgId: string) {
  await prisma.couponRedemption.deleteMany({
    where: { orgId, coupon: { code: { startsWith: PREFIX } } },
  });
  await prisma.coupon.deleteMany({ where: { orgId, code: { startsWith: PREFIX } } });

  const sales = await prisma.counterSale.findMany({
    where: { orgId, lines: { some: { description: TAG } } },
    select: { id: true },
  });
  for (const sale of sales) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'CounterSale', sourceId: sale.id },
    });
  }
  await prisma.couponRedemption.deleteMany({
    where: { counterSaleId: { in: sales.map((sale) => sale.id) } },
  });
  await prisma.counterSale.deleteMany({ where: { id: { in: sales.map((sale) => sale.id) } } });

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

  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((payment) => ({ sourceType: 'Payment', sourceId: payment.id })),
  ];
  for (const source of sources) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }

  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, reason: { in: invoices.map((invoice) => `Invoice ${invoice.number} paid`) } },
  });
  await prisma.messageLog.deleteMany({ where: { orgId, relatedId: { in: invoiceIds } } });
  await prisma.couponRedemption.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
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
