/**
 * The subscription, billed, against the stub provider. Phase 32.6.
 *
 *   npx tsx infra/scripts/verify-billing.ts [baseUrl]
 *
 * A workshop opens, accepts the terms, and is read-only until a card is on
 * file. The card goes on through the provider's checkout and the trial
 * starts: fourteen days, the end date the provider's, nothing charged. Three
 * days before the end the owner is reminded, once, with the amount and the
 * date. The trial ends and the provider charges: paid makes the workshop
 * active and tells the owner; failed leaves it writing but past due and
 * tells the owner. Cancelling on a plan ends at the period's end and the
 * workshop stays open until then; cancelling on a trial ends at once and
 * nothing is charged. The webhook applies the provider's events once.
 *
 * Cleans up after itself: the workshop it opened is deleted.
 */

import 'dotenv/config';

import { TRIAL_DAYS, TRIAL_REMINDER_DAYS } from '@carnet/core';
import { prisma } from '@carnet/db';
import { remindTrialsEnding } from '@carnet/jobs';

import {
  applyBillingEvent,
  billingOverview,
  cancelSubscription,
  startTrialCheckout,
  subscriptionFor,
  syncBillingFromProvider,
} from '../../apps/web/src/lib/billing';
import { createWorkshop } from '../../apps/web/src/lib/onboarding';
import {
  stubAddCard,
  stubCharge,
  stubSign,
  stubSubscriptionOf,
} from '../../apps/web/src/lib/payments/stub';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const STAMP = Date.now().toString(36);
const EMAIL = `billing-probe-${STAMP}@probe-garage.test`;

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

const DAY = 86_400_000;

async function main() {
  console.info('\nA workshop opens and accepts the terms');
  const outcome = await createWorkshop(
    {
      workshopName: `Billing Probe ${STAMP}`,
      contactName: 'Probe Owner',
      email: EMAIL,
      password: 'a-long-enough-probe-password',
      phone: '',
      sites: 1,
      country: 'GB',
    },
    { plan: 'CORE', termsVersion: '2026-09-14' },
  );
  check('the workshop was created', outcome.ok, true);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: outcome.orgSlug! },
    select: {
      id: true,
      termsAcceptedAt: true,
      termsVersion: true,
      trialEndsAt: true,
      locations: { select: { id: true } },
    },
  });
  check(
    'the terms and their version are recorded',
    [Boolean(org.termsAcceptedAt), org.termsVersion],
    [true, '2026-09-14'],
  );
  check('the trial is fourteen days', TRIAL_DAYS, 14);

  try {
    const before = await subscriptionFor(org.id);
    check(
      'without a card the workshop is read-only and says why',
      [before.state, before.readOnly],
      ['AWAITING_CARD', true],
    );
    check(
      'the message says nothing is charged during the trial',
      /Nothing is charged until the trial ends/.test(before.message),
      true,
    );

    console.info('\nA card goes on through the provider');
    const { url } = await startTrialCheckout({ orgId: org.id, userId: outcome.userId! });
    check(
      'the checkout is the stub subscribe page',
      url.endsWith(`/pay/subscribe/${org.id}`),
      true,
    );
    const notYet = await subscriptionFor(org.id);
    check('opening the checkout alone changes nothing', notYet.state, 'AWAITING_CARD');
    const synced = await syncBillingFromProvider(org.id);
    check('the provider has no subscription until the card is added', synced, null);

    const record = await stubAddCard({ orgId: org.id, trialDays: TRIAL_DAYS });
    await applyBillingEvent({
      kind: 'subscription',
      orgId: org.id,
      customerRef: record.customerRef,
      subscriptionRef: record.subscriptionRef,
      status: record.status,
      trialEndsAt: record.trialEndsAt,
      currentPeriodEnd: record.currentPeriodEnd,
      cancelAt: record.cancelAt,
    });
    const trial = await subscriptionFor(org.id);
    check(
      'the trial has started, writing, fourteen days',
      [trial.state, trial.readOnly, trial.daysLeft],
      ['TRIAL', false, 14],
    );
    const overview = await billingOverview(org.id);
    check('the card is on file', overview.card, { brand: 'Visa', last4: '4242' });
    check(
      'the next charge is stated: the plan times the bays, on the trial end',
      [
        overview.nextCharge?.amountMinor,
        overview.nextCharge?.bays,
        overview.nextCharge?.on?.toISOString(),
      ],
      [
        4700 * overview.nextCharge!.bays,
        overview.nextCharge!.bays,
        record.trialEndsAt!.toISOString(),
      ],
    );
    check('no invoice yet', overview.invoices.length, 0);
    const after = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { trialEndsAt: true, billingStatus: true },
    });
    check(
      "the trial end is the provider's",
      after.trialEndsAt?.toISOString(),
      record.trialEndsAt!.toISOString(),
    );

    console.info('\nThree days before, the owner is reminded, once');
    const untouched = await remindTrialsEnding();
    check(
      'nothing is sent with fourteen days left',
      await prisma.messageLog.count({ where: { orgId: org.id, relatedType: 'TrialReminder' } }),
      0,
    );
    void untouched;
    await prisma.organization.update({
      where: { id: org.id },
      data: { trialEndsAt: new Date(Date.now() + (TRIAL_REMINDER_DAYS - 1) * DAY) },
    });
    await remindTrialsEnding();
    await remindTrialsEnding();
    const reminders = await prisma.messageLog.findMany({
      where: { orgId: org.id, relatedType: 'TrialReminder' },
    });
    check('one reminder, however often the job runs', reminders.length, 1);
    check(
      'it names the card, the plan and the cancel path',
      [
        /Visa card ending 4242/.test(reminders[0]!.body),
        /Core plan/.test(reminders[0]!.body),
        /cancel before then/.test(reminders[0]!.body),
      ],
      [true, true, true],
    );
    check('sent to the owner', reminders[0]!.toAddress, EMAIL);

    console.info('\nThe trial ends and the card is charged');
    const charged = await stubCharge({ orgId: org.id, outcome: 'PAID' });
    const sub = (await stubSubscriptionOf(org.id))!;
    const body = JSON.stringify({
      kind: 'billing-invoice',
      customerRef: sub.customerRef,
      subscriptionRef: sub.subscriptionRef,
      outcome: 'PAID',
      amountMinor: charged.amountMinor,
      currency: charged.currency,
      invoiceRef: charged.invoiceRef,
      url: null,
    });
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret) {
      const unsigned = await fetch(`${BASE}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      check('the webhook refuses an unsigned billing event', unsigned.status, 401);
      const signed = await fetch(`${BASE}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-carnet-signature': stubSign(body, secret),
        },
        body,
      });
      check(
        'and applies a signed one',
        [signed.status, ((await signed.json()) as { outcome: string }).outcome],
        [200, 'recorded'],
      );
    } else {
      await applyBillingEvent(JSON.parse(body));
      console.info('  skip   PAYMENT_WEBHOOK_SECRET is not set; the event was applied directly');
    }
    await syncBillingFromProvider(org.id);
    const active = await subscriptionFor(org.id);
    check('paid: on a plan, writing', [active.state, active.readOnly], ['ACTIVE', false]);
    const paidMail = await prisma.messageLog.findFirst({
      where: { orgId: org.id, relatedType: 'Billing', subject: { startsWith: 'Payment received' } },
    });
    check('the owner is told the payment was taken', Boolean(paidMail), true);
    const invoices = (await billingOverview(org.id)).invoices;
    check(
      'the invoice is on the billing page',
      [invoices.length, invoices[0]?.status],
      [1, 'PAID'],
    );

    console.info('\nA later charge fails');
    const failed = await stubCharge({ orgId: org.id, outcome: 'FAILED' });
    await applyBillingEvent({
      kind: 'billing-invoice',
      customerRef: sub.customerRef,
      subscriptionRef: sub.subscriptionRef,
      outcome: 'FAILED',
      amountMinor: failed.amountMinor,
      currency: failed.currency,
      invoiceRef: failed.invoiceRef,
      url: null,
    });
    const pastDue = await subscriptionFor(org.id);
    check(
      'failed: past due, still writing, told to update the card',
      [pastDue.state, pastDue.readOnly, /Update the card/.test(pastDue.message)],
      ['PAST_DUE', false, true],
    );
    const failMail = await prisma.messageLog.findFirst({
      where: { orgId: org.id, relatedType: 'Billing', subject: { contains: 'did not go through' } },
    });
    check('the owner is told the payment failed', Boolean(failMail), true);
    await stubCharge({ orgId: org.id, outcome: 'PAID' });
    await applyBillingEvent({
      kind: 'billing-invoice',
      customerRef: sub.customerRef,
      subscriptionRef: sub.subscriptionRef,
      outcome: 'PAID',
      amountMinor: failed.amountMinor,
      currency: failed.currency,
      invoiceRef: 'stubin_retry',
      url: null,
    });
    check('a retry that pays clears it', (await subscriptionFor(org.id)).state, 'ACTIVE');

    console.info('\nCancelling on a plan ends at the end of what was paid for');
    await syncBillingFromProvider(org.id);
    const { endsAt } = await cancelSubscription({ orgId: org.id, userId: outcome.userId! });
    const ending = await subscriptionFor(org.id);
    check(
      'still open, with the days left, and says it is ending',
      [ending.state, ending.readOnly, /Cancelled\. The workshop stays open/.test(ending.message)],
      ['ACTIVE', false, true],
    );
    check('the end is the period end, not today', endsAt.getTime() > Date.now() + DAY, true);
    check('no next charge is scheduled', (await billingOverview(org.id)).nextCharge, null);
  } finally {
    await prisma.messageLog.deleteMany({ where: { orgId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  }

  console.info('\nCancelling on a trial charges nothing, ever');
  const second = await createWorkshop(
    {
      workshopName: `Billing Probe B ${STAMP}`,
      contactName: 'Probe Owner',
      email: `b-${EMAIL}`,
      password: 'a-long-enough-probe-password',
      phone: '',
      sites: 1,
      country: 'GB',
    },
    { plan: 'CORE', termsVersion: '2026-09-14' },
  );
  const orgB = await prisma.organization.findUniqueOrThrow({
    where: { slug: second.orgSlug! },
    select: { id: true },
  });
  try {
    await startTrialCheckout({ orgId: orgB.id, userId: second.userId! });
    const rec = await stubAddCard({ orgId: orgB.id, trialDays: TRIAL_DAYS });
    await applyBillingEvent({
      kind: 'subscription',
      orgId: orgB.id,
      customerRef: rec.customerRef,
      subscriptionRef: rec.subscriptionRef,
      status: rec.status,
      trialEndsAt: rec.trialEndsAt,
      currentPeriodEnd: rec.currentPeriodEnd,
      cancelAt: rec.cancelAt,
    });
    const { endsAt } = await cancelSubscription({ orgId: orgB.id, userId: second.userId! });
    const closed = await subscriptionFor(orgB.id);
    check(
      'a cancelled trial is read-only now',
      [closed.state, closed.readOnly],
      ['CANCELLED', true],
    );
    check('and ended today, not at the trial end', endsAt.getTime() <= Date.now() + 1000, true);
    check(
      'the provider was told to stop',
      (await stubSubscriptionOf(orgB.id))!.cancelAt !== null,
      true,
    );
    check('nothing was invoiced', (await billingOverview(orgB.id)).invoices.length, 0);
  } finally {
    await prisma.messageLog.deleteMany({ where: { orgId: orgB.id } });
    await prisma.organization.delete({ where: { id: orgB.id } });
    await prisma.user.deleteMany({ where: { email: `b-${EMAIL}` } });
  }

  console.info('\nThe pages');
  const terms = await fetch(`${BASE}/terms`);
  check(
    'the terms page says the card is charged when the trial ends',
    [terms.status, /charged automatically for the first month/.test(await terms.text())],
    [200, true],
  );
  const signup = await fetch(`${BASE}/signup`);
  const html = await signup.text();
  check(
    'the sign-up form carries the terms box and names the charge',
    [/name="agree"/.test(html), /charged/.test(html), /No card/.test(html)],
    [true, true, false],
  );

  console.info(
    failures === 0
      ? '\nverify-billing: every check passed'
      : `\nverify-billing: ${failures} failing`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
