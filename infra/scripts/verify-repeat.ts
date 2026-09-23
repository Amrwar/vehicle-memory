/**
 * Proves that doing it twice does not do it twice.
 *
 *   npx tsx infra/scripts/verify-repeat.ts
 *
 * Everything else in this product is verified by asking whether it works. This
 * asks the harder question: what happens when it is asked to work again, at
 * the worst possible moment.
 *
 * The moments are not hypothetical. A person on a slow connection presses the
 * button twice because nothing happened. A page is refreshed while a payment
 * is in flight. Two workers overlap during a deploy. A provider retries a
 * webhook it never got an answer to. A process is killed between doing the
 * work and writing down that it did.
 *
 * Each of those is one test here, and each of them is run against the real
 * database with the real functions, because the whole class of bug being
 * hunted lives in the gap between two statements and cannot be reproduced by
 * calling one of them.
 *
 * Runs against the seeded hillside-motors and clears up after itself.
 */

import 'dotenv/config';

import { money, repeatKey, toDecimalString, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';
import { claimMessages, claimOutbox } from '@carnet/jobs';

import { postEntry, ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import { catchUpConsequences } from '../../apps/web/src/lib/afterwards';
import { completeSale } from '../../apps/web/src/lib/counter';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';
import { once, onceToken, StillGoingError } from '../../apps/web/src/lib/once';
import { awardForInvoice } from '../../apps/web/src/lib/retention';

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown) {
  console.info(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${String(detail)}`}`,
  );
  if (!passed) failures += 1;
}

const TAG = 'Verify repeat probe';

async function bill(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  hours: number;
  taxRateId: string | null;
}) {
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
  console.info('\n  Asked to do it twice\n');

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

  /* --- the button pressed twice -------------------------------------------- */

  console.info('\n  The button pressed twice');

  const first = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    hours: 4,
    taxRateId: vat?.id ?? null,
  });

  // What a form does: one drawing, one key, two presses.
  const token = onceToken();
  const press = () =>
    once({
      orgId: org.id,
      key: ['pay', first.invoiceId, token],
      work: () =>
        recordPayment({
          orgId: org.id,
          userId: staff.id,
          invoiceId: first.invoiceId,
          amount: money(5_000),
          method: 'CASH',
          reference: TAG,
        }),
    });

  const one = await press();
  const two = await press();

  check('the first press takes the money', one.ran);
  check('the second press does not', !two.ran);

  const afterTwo = await prisma.payment.count({
    where: { invoiceId: first.invoiceId, reference: TAG },
  });
  check('one payment exists, not two', afterTwo === 1, afterTwo);

  // Two presses landing at the same instant, which is the case a check-then-
  // act guard passes in testing and fails in production.
  const together = onceToken();
  const both = await Promise.allSettled([
    once({
      orgId: org.id,
      key: ['pay', first.invoiceId, together],
      work: () =>
        recordPayment({
          orgId: org.id,
          userId: staff.id,
          invoiceId: first.invoiceId,
          amount: money(1_000),
          method: 'CASH',
          reference: TAG,
        }),
    }),
    once({
      orgId: org.id,
      key: ['pay', first.invoiceId, together],
      work: () =>
        recordPayment({
          orgId: org.id,
          userId: staff.id,
          invoiceId: first.invoiceId,
          amount: money(1_000),
          method: 'CASH',
          reference: TAG,
        }),
    }),
  ]);

  const ran = both.filter((r) => r.status === 'fulfilled' && r.value.ran).length;
  const held = both.filter(
    (r) => r.status === 'rejected' && r.reason instanceof StillGoingError,
  ).length;

  check('exactly one of two simultaneous presses did the work', ran === 1, `${ran}`);
  check(
    'and the other was absorbed or told to wait, never doubled',
    ran + held <= 2 && ran === 1,
    `${ran} ran, ${held} waiting`,
  );

  const afterRace = await prisma.payment.count({
    where: { invoiceId: first.invoiceId, reference: TAG, amount: 10 },
  });
  check('one payment came out of the race', afterRace === 1, afterRace);

  // And a deliberate second payment, from a freshly drawn form, is allowed.
  const later = await once({
    orgId: org.id,
    key: ['pay', first.invoiceId, onceToken()],
    work: () =>
      recordPayment({
        orgId: org.id,
        userId: staff.id,
        invoiceId: first.invoiceId,
        amount: money(1_000),
        method: 'CASH',
        reference: TAG,
      }),
  });
  check('a second payment somebody actually meant goes through', later.ran);

  /* --- the same points, twice ---------------------------------------------- */

  console.info('\n  The same points, twice');

  const paid = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    hours: 6,
    taxRateId: vat?.id ?? null,
  });

  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId: paid.invoiceId,
    amount: money(paid.totalMinor),
    method: 'CASH',
    reference: TAG,
  });

  const key = `invoice:${paid.invoiceId}:paid`;
  const granted = await prisma.loyaltyEntry.count({ where: { once: key } });
  check('paying the bill awards the points', granted === 1, granted);

  // Four awards at once: the shape of two workers and two retries arriving
  // together. Before Phase 46 this was four rows.
  await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      awardForInvoice({ orgId: org.id, userId: staff.id, invoiceId: paid.invoiceId }),
    ),
  );

  const stillOne = await prisma.loyaltyEntry.count({ where: { once: key } });
  check('four more awards at once add nothing', stillOne === 1, stillOne);

  // And the sweep that exists for the crash between the payment and the points.
  await prisma.loyaltyEntry.deleteMany({ where: { once: key } });
  const caught = await catchUpConsequences();
  const rescued = await prisma.loyaltyEntry.count({ where: { once: key } });
  check('points lost to a crash are swept up afterwards', rescued === 1, `caught ${caught}`);

  /* --- two workers over one queue ------------------------------------------ */

  console.info('\n  Two workers over one queue');

  // Put at the head of the queue, because the seeded workshop has a year of
  // events behind it and a probe at the back would never be reached.
  const queued = await prisma.outboxEvent.create({
    data: {
      orgId: org.id,
      type: 'payment.received',
      payload: { note: TAG },
      createdAt: new Date('2000-01-01T00:00:00.000Z'),
    },
  });

  const [workerA, workerB] = await Promise.all([claimOutbox(2), claimOutbox(2)]);
  const contested = [workerA, workerB].filter((claim) => claim.includes(queued.id)).length;

  check('only one worker gets a given event', contested === 1, `${contested}`);

  const leased = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: queued.id } });
  check('the claim counts the attempt', leased.attempts === 1, leased.attempts);
  check(
    'and leases it into the future rather than locking it for ever',
    leased.availableAt.getTime() > Date.now(),
    leased.availableAt.toISOString(),
  );

  const again = await claimOutbox(2);
  check('a third look finds nothing to take', !again.includes(queued.id));

  const message = await prisma.messageLog.create({
    data: {
      orgId: org.id,
      channel: 'EMAIL',
      status: 'QUEUED',
      toAddress: 'probe@example.test',
      subject: TAG,
      body: TAG,
      // Oldest first here too, for the same reason.
      availableAt: new Date('2000-01-01T00:00:00.000Z'),
    },
  });

  const [mailA, mailB] = await Promise.all([claimMessages(2), claimMessages(2)]);
  const mailContested = [mailA, mailB].filter((claim) => claim.includes(message.id)).length;
  check('the same message is not sent by two workers', mailContested === 1, `${mailContested}`);

  /* --- a sale taken twice --------------------------------------------------- */

  console.info('\n  A sale taken twice');

  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '87139-0D070' },
  });
  const before = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId: warehouse.id },
  });

  const saleToken = onceToken();
  const takeSale = () =>
    once({
      orgId: org.id,
      key: ['sell', saleToken],
      resultOf: (taken) => taken.reference ?? null,
      work: () =>
        completeSale({
          orgId: org.id,
          locationId: warehouse.locationId,
          userId: staff.id,
          lines: [
            {
              productId: product.id,
              kind: 'PART',
              description: TAG,
              quantity: 1,
              unitPrice: Number(product.sellPrice),
            },
          ],
          tenders: [{ kind: 'CASH', amount: money(20_000) }],
        }),
    });

  const sold = await takeSale();
  const soldAgain = await takeSale();

  check('the sale is taken', sold.ran && (sold.result?.ok ?? false), sold.result?.reference);
  check('the second press takes nothing', !soldAgain.ran);
  check(
    'and is still sent to the receipt it made the first time',
    soldAgain.resultRef === sold.result?.reference,
    soldAgain.resultRef,
  );

  const after = await prisma.stockLevel.findFirstOrThrow({
    where: { productId: product.id, warehouseId: warehouse.id },
  });
  check(
    'one bulb left the shelf, not two',
    Number(before.onHand) - Number(after.onHand) === 1,
    `${Number(before.onHand)} to ${Number(after.onHand)}`,
  );

  /* --- the ledger, posted twice at once -------------------------------------- */

  console.info('\n  The ledger, posted twice at once');

  // Every money function posts outside the transaction that wrote its
  // document, so a retry is expected and has to be free. This is that retry,
  // arriving twice in the same instant.
  const sourceId = `probe-${onceToken()}`;
  const draft = {
    reference: TAG,
    description: TAG,
    sourceType: 'Probe',
    sourceId,
    postedAt: new Date(),
    lines: [
      { accountCode: '1010', debit: money(100), credit: money(0), memo: TAG },
      { accountCode: '4000', debit: money(0), credit: money(100), memo: TAG },
    ],
  };

  const posts = await Promise.allSettled([
    postEntry(org.id, draft),
    postEntry(org.id, draft),
    postEntry(org.id, draft),
  ]);

  const failed = posts.filter((p) => p.status === 'rejected');
  check('no retry is turned into an error', failed.length === 0, failed.length);

  const wrote = posts.filter((p) => p.status === 'fulfilled' && p.value.posted).length;
  check('exactly one of three simultaneous posts writes', wrote === 1, wrote);

  const entries = await prisma.journalEntry.count({
    where: { orgId: org.id, sourceType: 'Probe', sourceId },
  });
  check('one entry is in the books, not three', entries === 1, entries);

  const sameId = new Set(
    posts
      .filter((p) => p.status === 'fulfilled')
      .map((p) => (p as PromiseFulfilledResult<{ id: string }>).value.id),
  );
  check('and all three callers are told the same entry', sameId.size === 1, sameId.size);

  /* --- a claim whose worker died -------------------------------------------- */

  console.info('\n  A claim whose worker died');

  const orphanKey = repeatKey(['probe', 'orphan', onceToken()]);
  await prisma.onceRequest.create({
    data: {
      orgId: org.id,
      key: orphanKey,
      expiresAt: new Date(Date.now() + 86_400_000),
      // Claimed long enough ago that nothing is coming back for it.
      createdAt: new Date(Date.now() - 10 * 60_000),
    },
  });

  let rescuedWork = false;
  await once({
    orgId: org.id,
    key: [orphanKey],
    work: async () => {
      rescuedWork = true;
    },
  });

  check('work abandoned by a dead process is picked up again', rescuedWork);

  // Whereas one that is genuinely still going is not stolen.
  const busyKey = repeatKey(['probe', 'busy', onceToken()]);
  await prisma.onceRequest.create({
    data: { orgId: org.id, key: busyKey, expiresAt: new Date(Date.now() + 86_400_000) },
  });

  let stolen = false;
  try {
    await once({
      orgId: org.id,
      key: [busyKey],
      work: async () => {
        stolen = true;
      },
    });
  } catch (error) {
    check('one that is still going is told to wait', error instanceof StillGoingError);
  }
  check('and is not done a second time meanwhile', !stolen);

  // A claim whose work failed lets the person try again rather than holding
  // the key for a month over one bad amount.
  const failedKey = repeatKey(['probe', 'failed', onceToken()]);
  await once({
    orgId: org.id,
    key: [failedKey],
    work: async () => {
      throw new Error('refused');
    },
  }).catch(() => undefined);

  const retried = await once({
    orgId: org.id,
    key: [failedKey],
    work: async () => 'second time',
  });
  check('a refusal does not use the key up', retried.ran);

  /* --- and the books --------------------------------------------------------- */

  const closing = trialBalance(await postedLines(org.id, ALL_TIME));
  check(
    'the books balance through all of it',
    closing.balanced,
    toDecimalString(closing.difference),
  );

  await forget(org.id);

  console.info(
    `\n  ${failures === 0 ? 'Asked twice, done once.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string) {
  await prisma.onceRequest.deleteMany({ where: { orgId } });
  await prisma.journalEntry.deleteMany({ where: { orgId, sourceType: 'Probe' } });
  // Matched on the text rather than through a JSON path: the probe's own
  // events are the only ones carrying this sentence, and a path filter that
  // silently matches nothing leaves them to pile up and unbalance the next run.
  await prisma.$executeRaw`
    DELETE FROM "outbox_events" WHERE "orgId" = ${orgId} AND "payload"::text LIKE ${`%${TAG}%`}
  `;
  await prisma.messageLog.deleteMany({ where: { orgId, subject: TAG } });

  const sales = await prisma.counterSale.findMany({
    where: { orgId, lines: { some: { description: TAG } } },
    select: { id: true },
  });
  for (const sale of sales) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'CounterSale', sourceId: sale.id },
    });
  }
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

  for (const source of [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((payment) => ({ sourceType: 'Payment', sourceId: payment.id })),
  ]) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }

  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, once: { in: invoiceIds.map((id) => `invoice:${id}:paid`) } },
  });
  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, reason: { in: invoices.map((invoice) => `Invoice ${invoice.number} paid`) } },
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
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
