/**
 * Card payment through a provider, end to end, against the stub. Phase 32.
 *
 *   npx tsx infra/scripts/verify-payments.ts [baseUrl]
 *
 * A customer's invoice is paid from the portal: the checkout opens, the
 * card is declined with a reason, tried again and paid, the payment is
 * recorded once however many times the provider says so, the invoice is
 * settled and the ledger posted once. A refund goes back through the
 * provider. Reconciliation names a payment the provider took that the
 * books lack, and is silent once it is recorded. The webhook refuses what
 * is not signed and applies what is, once. Every refusal that protects a
 * figure refuses.
 *
 * The same script against a real provider is the same script with keys:
 * the seam is what is being tested, and the stub is the provider that
 * needs none. Cleans up after itself.
 */

import 'dotenv/config';

import { money, PaymentAttemptError, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import {
  checkAttempt,
  reconcileFor,
  settleAttempt,
  startCardPayment,
} from '../../apps/web/src/lib/card-payments';
import { createJob } from '../../apps/web/src/lib/jobs';
import {
  issueInvoice,
  moveJob,
  raiseCreditNote,
  recordPayment,
  recordRefund,
} from '../../apps/web/src/lib/money';
import { stubProvider, stubRemember, stubSign } from '../../apps/web/src/lib/payments/stub';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify card payment probe';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
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
    if (error instanceof kind && actual === code) console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, portalUserId: maria.id },
    select: { id: true },
  });
  const vehicle = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });
  const stranger = await prisma.user.findUniqueOrThrow({
    where: { email: 'sara@hillsidemotors.test' },
  });

  await forget(org.id);
  const jobIds: string[] = [];
  const invoiceIds: string[] = [];

  async function makeInvoice(hours: number) {
    const job = await createJob({
      orgId: org.id,
      userId: staff.id,
      locationId: null,
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: TAG,
    });
    jobIds.push(job.id);
    await prisma.jobLabourLine.create({
      data: {
        jobId: job.id,
        description: 'Probe labour',
        hours,
        rate: 60,
        taxRateId: vat?.id ?? null,
      },
    });
    await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
    await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
    const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });
    invoiceIds.push(invoiceId);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { id: true, number: true, total: true, currency: true, status: true },
    });
    return { ...invoice, totalMinor: Math.round(Number(invoice.total) * 100) };
  }

  const balanceBefore = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances before anything happens', balanceBefore.balanced, true);

  console.info('\nA customer opens a checkout from the portal');
  const a = await makeInvoice(2);
  await refuses('somebody else cannot pay it', PaymentAttemptError, 'NOT_PAYABLE', () =>
    startCardPayment({ userId: stranger.id, invoiceId: a.id }),
  );
  await refuses('more than is owed is refused, not clamped', PaymentAttemptError, 'OVER', () =>
    startCardPayment({ userId: maria.id, invoiceId: a.id, amountMinor: a.totalMinor + 1 }),
  );
  const first = await startCardPayment({ userId: maria.id, invoiceId: a.id });
  check(
    'the checkout is the stub page for the attempt',
    first.url.endsWith(`/pay/${first.attemptId}`),
    true,
  );
  const again = await startCardPayment({ userId: maria.id, invoiceId: a.id });
  check('pressing the button twice reuses the open checkout', again.attemptId, first.attemptId);
  const opened = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
  check(
    'the attempt is pending for the whole bill',
    [opened.status, Math.round(Number(opened.amount) * 100)],
    ['PENDING', a.totalMinor],
  );
  check(
    'the provider remembers it as pending',
    (await stubProvider.retrieve(opened.providerRef))?.status,
    'PENDING',
  );

  console.info('\nThe card is declined');
  await stubRemember({
    providerRef: opened.providerRef,
    amountMinor: a.totalMinor,
    currency: a.currency,
    status: 'FAILED',
    reason: 'Insufficient funds.',
  });
  const declined = await settleAttempt({
    providerRef: opened.providerRef,
    record: {
      status: 'FAILED',
      amountMinor: a.totalMinor,
      currency: a.currency,
      reason: 'Insufficient funds.',
    },
  });
  check('the attempt moved to failed', declined.outcome, 'moved');
  const failed = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
  check(
    'failed, with the provider’s reason kept',
    [failed.status, failed.failureReason],
    ['FAILED', 'Insufficient funds.'],
  );
  check('nothing was recorded', await prisma.payment.count({ where: { invoiceId: a.id } }), 0);
  check(
    'the invoice is still open',
    (await prisma.invoice.findUniqueOrThrow({ where: { id: a.id }, select: { status: true } }))
      .status,
    'ISSUED',
  );

  console.info('\nTried again, and paid');
  const second = await startCardPayment({ userId: maria.id, invoiceId: a.id });
  check('a new attempt after a failure', second.attemptId !== first.attemptId, true);
  const pending = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: second.attemptId },
  });
  await stubRemember({
    providerRef: pending.providerRef,
    amountMinor: a.totalMinor,
    currency: a.currency,
    status: 'SUCCEEDED',
  });
  const paid = await settleAttempt({
    providerRef: pending.providerRef,
    record: { status: 'SUCCEEDED', amountMinor: a.totalMinor, currency: a.currency },
  });
  check('the payment is recorded', paid.outcome, 'recorded');
  const twice = await settleAttempt({
    providerRef: pending.providerRef,
    record: { status: 'SUCCEEDED', amountMinor: a.totalMinor, currency: a.currency },
  });
  check('the provider saying so again changes nothing', twice.outcome, 'unchanged');
  const payments = await prisma.payment.findMany({ where: { invoiceId: a.id } });
  check(
    'one payment, online, by the provider reference',
    [payments.length, payments[0]?.method, payments[0]?.reference],
    [1, 'ONLINE', pending.providerRef],
  );
  check(
    'the invoice is paid',
    (await prisma.invoice.findUniqueOrThrow({ where: { id: a.id }, select: { status: true } }))
      .status,
    'PAID',
  );
  const entries = await prisma.journalEntry.count({
    where: { orgId: org.id, sourceType: 'Payment', sourceId: payments[0]!.id },
  });
  check('posted once', entries, 1);
  check(
    'the ledger still balances',
    trialBalance(await postedLines(org.id, ALL_TIME)).balanced,
    true,
  );
  await refuses('a paid invoice cannot be paid again', PaymentAttemptError, 'NOT_PAYABLE', () =>
    startCardPayment({ userId: maria.id, invoiceId: a.id }),
  );

  console.info('\nA refund goes back through the provider');
  const noteId = await raiseCreditNote({
    orgId: org.id,
    userId: staff.id,
    invoiceId: a.id,
    amount: money(1000, a.currency),
    reason: 'Probe goodwill',
  });
  const refundId = await recordRefund({
    orgId: org.id,
    userId: staff.id,
    invoiceId: a.id,
    creditNoteId: noteId,
    amount: money(1000, a.currency),
    method: 'ONLINE',
  });
  const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
  check(
    'the refund names the attempt and the provider’s reference',
    [
      refund.attemptId === second.attemptId,
      refund.providerRef?.startsWith('stubre_'),
      refund.providerStatus,
    ],
    [true, true, 'SUCCEEDED'],
  );
  check(
    'the provider shows the money going back',
    (
      await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: second.attemptId },
        select: { providerPayload: true },
      })
    ).providerPayload && true,
    true,
  );
  const d = await makeInvoice(1);
  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId: d.id,
    amount: money(d.totalMinor, d.currency),
    method: 'CASH',
  });
  await refuses(
    'a bill paid in cash cannot be refunded through the provider',
    PaymentAttemptError,
    'NO_CARD_PAYMENT',
    async () => {
      const note = await raiseCreditNote({
        orgId: org.id,
        userId: staff.id,
        invoiceId: d.id,
        amount: money(500, d.currency),
        reason: 'Probe, wrong way back',
      });
      await recordRefund({
        orgId: org.id,
        userId: staff.id,
        invoiceId: d.id,
        creditNoteId: note,
        amount: money(500, d.currency),
        method: 'ONLINE',
      });
    },
  );

  console.info('\nReconciliation names what differs');
  const b = await makeInvoice(1);
  const third = await startCardPayment({ userId: maria.id, invoiceId: b.id });
  const bAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: third.attemptId },
  });
  // The provider took the money and nobody told us.
  await stubRemember({
    providerRef: bAttempt.providerRef,
    amountMinor: b.totalMinor,
    currency: b.currency,
    status: 'SUCCEEDED',
  });
  const before = await reconcileFor(org.id);
  check(
    'the provider’s payment the books lack is named',
    before.differences.filter((d) => d.attemptId === third.attemptId).map((d) => d.kind),
    ['PROVIDER_PAID_NOT_RECORDED'],
  );
  const asked = await checkAttempt({ orgId: org.id, attemptId: third.attemptId });
  check('checking with the provider records it', asked.outcome, 'recorded');
  const after = await reconcileFor(org.id);
  check(
    'and then nothing differs',
    after.differences.filter((d) => d.attemptId === third.attemptId).length,
    0,
  );
  check(
    'invoice B is paid',
    (await prisma.invoice.findUniqueOrThrow({ where: { id: b.id }, select: { status: true } }))
      .status,
    'PAID',
  );

  console.info('\nThe webhook, over HTTP');
  const c = await makeInvoice(1);
  const fourth = await startCardPayment({ userId: maria.id, invoiceId: c.id });
  const cAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: fourth.attemptId },
  });
  const body = JSON.stringify({
    providerRef: cAttempt.providerRef,
    status: 'SUCCEEDED',
    amountMinor: c.totalMinor,
    currency: c.currency,
  });
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const post = (headers: Record<string, string>) =>
    fetch(`${BASE}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    });
  check('unsigned is refused', (await post({})).status, 401);
  check(
    'signed with the wrong secret is refused',
    (await post({ 'x-carnet-signature': stubSign(body, 'not-the-secret') })).status,
    401,
  );
  if (secret) {
    const good = await post({ 'x-carnet-signature': stubSign(body, secret) });
    check(
      'signed is applied',
      [good.status, ((await good.json()) as { outcome: string }).outcome],
      [200, 'recorded'],
    );
    const replay = await post({ 'x-carnet-signature': stubSign(body, secret) });
    check(
      'replayed, it is acknowledged and changes nothing',
      ((await replay.json()) as { outcome: string }).outcome,
      'unchanged',
    );
    check(
      'one payment on invoice C',
      await prisma.payment.count({ where: { invoiceId: c.id } }),
      1,
    );
  } else {
    console.info('  skip   PAYMENT_WEBHOOK_SECRET is not set; the signed path was not tried');
  }
  const unknown = JSON.stringify({
    providerRef: 'stub_nothing',
    status: 'SUCCEEDED',
    amountMinor: 1,
    currency: 'GBP',
  });
  if (secret) {
    const r = await fetch(`${BASE}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-carnet-signature': stubSign(unknown, secret),
      },
      body: unknown,
    });
    check(
      'an event for nothing we know is acknowledged and ignored',
      [r.status, ((await r.json()) as { outcome: string }).outcome],
      [200, 'unknown'],
    );
  }

  console.info('\nThe pages');
  const pay = await fetch(`${BASE}/pay/${fourth.attemptId}`);
  check(
    'the stub checkout page opens for a finished attempt',
    [pay.status, (await pay.text()).includes('This checkout is finished')],
    [200, true],
  );
  const nothing = await fetch(`${BASE}/pay/not-an-attempt`);
  check('and is not found for an attempt that does not exist', nothing.status, 404);

  await forget(org.id);
  const balanceAfter = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances after clean-up', balanceAfter.balanced, true);

  console.info(
    failures === 0
      ? '\nverify-payments: every check passed'
      : `\nverify-payments: ${failures} failing`,
  );
  if (failures > 0) process.exit(1);
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const [notes, refunds, payments] = await Promise.all([
    prisma.creditNote.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { id: true } }),
    prisma.refund.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { id: true } }),
    prisma.payment.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { id: true } }),
  ]);
  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...notes.map((n) => ({ sourceType: 'CreditNote', sourceId: n.id })),
    ...refunds.map((r) => ({ sourceType: 'Refund', sourceId: r.id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
  ];
  for (const source of sources)
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  await prisma.messageLog.deleteMany({
    where: {
      orgId,
      relatedId: {
        in: [
          ...invoiceIds,
          ...notes.map((n) => n.id),
          ...refunds.map((r) => r.id),
          ...payments.map((p) => p.id),
        ],
      },
    },
  });
  await prisma.refund.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.paymentAttempt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
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
