import { randomUUID } from 'node:crypto';

import {
  assertAttemptCreatable,
  assertRefundableThroughProvider,
  type AttemptStatus,
  fromDecimal,
  type LocalAttempt,
  money,
  nextAttemptState,
  PaymentAttemptError,
  PaymentProviderError,
  type ProviderRecord,
  type ProviderStatus,
  reconcileAttempts,
  settlesMoney,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { env } from './env';
import { audit } from './guard';
import { recordPayment } from './money';
import { paymentProvider } from './payments/provider';

/**
 * Card payment through a provider. Phase 32.
 *
 * The customer presses "Pay now" in the portal; an attempt is opened here
 * and the customer is sent to the provider's checkout. The provider tells
 * us the result, by webhook or when we ask, and the attempt moves once:
 * to succeeded, which records the Payment and posts it exactly like a card
 * taken at the counter, or to failed with the provider's reason, or to
 * cancelled. Reconciliation asks the provider about every recent attempt
 * and names each difference between its record and ours.
 */

/** Opens an attempt and returns where to send the customer. */
export async function startCardPayment(input: {
  userId: string;
  invoiceId: string;
  amountMinor?: number | null;
}): Promise<{ attemptId: string; url: string }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, customer: { portalUserId: input.userId } },
    select: {
      id: true,
      orgId: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      customerId: true,
      customer: { select: { email: true } },
      org: { select: { name: true } },
    },
  });
  if (!invoice) throw new PaymentAttemptError('NOT_PAYABLE', 'That invoice is not yours to pay.');

  const total = fromDecimal(invoice.total.toString(), invoice.currency);
  const paid = fromDecimal(invoice.amountPaid.toString(), invoice.currency);
  const outstandingMinor = total.minor - paid.minor;
  const amountMinor = input.amountMinor ?? outstandingMinor;
  assertAttemptCreatable({ invoiceStatus: invoice.status, outstandingMinor, amountMinor });

  // A checkout already open for the same amount is reused rather than
  // doubled: a customer who pressed the button twice gets one page.
  const open = await prisma.paymentAttempt.findFirst({
    where: {
      invoiceId: invoice.id,
      status: 'PENDING',
      amount: (amountMinor / 100).toFixed(2),
      checkoutUrl: { not: null },
      createdAt: { gt: new Date(Date.now() - 3_600_000) },
    },
    select: { id: true, checkoutUrl: true },
  });
  if (open?.checkoutUrl) return { attemptId: open.id, url: open.checkoutUrl };

  const provider = paymentProvider();
  const base = env().APP_URL;
  const attempt = await prisma.paymentAttempt.create({
    data: {
      orgId: invoice.orgId,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      provider: provider.name,
      providerRef: `pending_${randomUUID()}`,
      amount: (amountMinor / 100).toFixed(2),
      currency: invoice.currency,
      returnUrl: '',
      cancelUrl: '',
      startedByUserId: input.userId,
    },
    select: { id: true },
  });
  const returnUrl = `${base}/portal/invoices?paid=${attempt.id}`;
  const cancelUrl = `${base}/portal/invoices?cancelled=${attempt.id}`;

  try {
    const checkout = await provider.createCheckout({
      attemptId: attempt.id,
      amountMinor,
      currency: invoice.currency,
      description: `${invoice.org.name}, invoice ${invoice.number ?? ''}`.trim(),
      customerEmail: invoice.customer.email,
      returnUrl,
      cancelUrl,
    });
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { providerRef: checkout.providerRef, checkoutUrl: checkout.url, returnUrl, cancelUrl },
    });
    await audit({
      orgId: invoice.orgId,
      actorUserId: input.userId,
      action: 'payment.attempt.started',
      entityType: 'PaymentAttempt',
      entityId: attempt.id,
      after: { invoiceId: invoice.id, amountMinor, provider: provider.name },
    });
    return { attemptId: attempt.id, url: checkout.url };
  } catch (error) {
    // The provider would not open a checkout: the attempt says so and stays
    // as the record that it was tried.
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        failureReason:
          error instanceof Error ? error.message : 'The provider could not be reached.',
        settledAt: new Date(),
        returnUrl,
        cancelUrl,
      },
    });
    throw error;
  }
}

/** Who a payment the customer made themselves is recorded by. */
async function recorderFor(attempt: {
  orgId: string;
  startedByUserId: string | null;
  customer: { portalUserId: string | null };
}): Promise<string> {
  if (attempt.startedByUserId) return attempt.startedByUserId;
  if (attempt.customer.portalUserId) return attempt.customer.portalUserId;
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: attempt.orgId, role: 'OWNER', isActive: true },
    select: { userId: true },
  });
  return owner.userId;
}

export type SettleOutcome =
  | { outcome: 'unknown' }
  | { outcome: 'unchanged'; status: AttemptStatus }
  | { outcome: 'moved'; status: AttemptStatus }
  | { outcome: 'recorded'; status: 'SUCCEEDED'; paymentId: string };

/**
 * What the provider says, applied once. Called from the webhook, from the
 * stub checkout, and from "check with the provider"; whichever arrives
 * first records the money and the rest find nothing to do.
 */
export async function settleAttempt(input: {
  providerRef: string;
  record: { status: ProviderStatus; amountMinor: number; currency: string; reason?: string | null };
}): Promise<SettleOutcome> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { providerRef: input.providerRef },
    include: {
      customer: { select: { portalUserId: true } },
      invoice: { select: { number: true } },
    },
  });
  if (!attempt) return { outcome: 'unknown' };

  const next = nextAttemptState(attempt.status, input.record.status);
  if (next === attempt.status) return { outcome: 'unchanged', status: attempt.status };

  if (!settlesMoney(attempt.status, next)) {
    const moved = await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: 'PENDING' },
      data: {
        status: next,
        failureReason:
          next === 'FAILED' ? (input.record.reason ?? 'The provider did not say why.') : null,
        settledAt: new Date(),
      },
    });
    if (moved.count === 0) return { outcome: 'unchanged', status: attempt.status };
    await audit({
      orgId: attempt.orgId,
      action: `payment.attempt.${next.toLowerCase()}`,
      entityType: 'PaymentAttempt',
      entityId: attempt.id,
      after: { reason: input.record.reason ?? null },
    });
    return { outcome: 'moved', status: next };
  }

  // Claim the move first, so two answers arriving together record one payment.
  const claimed = await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, status: 'PENDING' },
    data: { status: 'SUCCEEDED', settledAt: new Date() },
  });
  if (claimed.count === 0) return { outcome: 'unchanged', status: attempt.status };

  if (input.record.currency !== attempt.currency) {
    // Money was taken in a currency we did not ask for. Nothing is recorded;
    // the attempt says why, and reconciliation will keep saying it.
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        failureReason: `Taken in ${input.record.currency}; the invoice is in ${attempt.currency}. Not recorded.`,
      },
    });
    return { outcome: 'moved', status: 'SUCCEEDED' };
  }

  try {
    const paymentId = await recordPayment({
      orgId: attempt.orgId,
      userId: await recorderFor(attempt),
      invoiceId: attempt.invoiceId,
      amount: money(input.record.amountMinor, attempt.currency),
      method: 'ONLINE',
      reference: input.providerRef,
      notes: `Card, through ${attempt.provider}`,
    });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { paymentId } });
    await audit({
      orgId: attempt.orgId,
      action: 'payment.attempt.succeeded',
      entityType: 'PaymentAttempt',
      entityId: attempt.id,
      after: { paymentId, amountMinor: input.record.amountMinor },
    });
    // Money in by card, while nobody was at the counter. Phase 39.
    const { notifyStaff } = await import('./search');
    const paidInvoice = await prisma.invoice.findUnique({
      where: { id: attempt.invoiceId },
      select: { number: true, currency: true, customer: { select: { displayName: true } } },
    });
    await notifyStaff({
      orgId: attempt.orgId,
      kind: 'PAYMENT_RECEIVED',
      title: `${paidInvoice?.customer.displayName ?? 'A customer'} paid ${(input.record.amountMinor / 100).toFixed(2)} ${paidInvoice?.currency ?? ''} by card on ${paidInvoice?.number ?? 'an invoice'}`,
      href: `/invoices/${attempt.invoiceId}`,
      entityType: 'Payment',
      entityId: paymentId,
    });
    return { outcome: 'recorded', status: 'SUCCEEDED', paymentId };
  } catch (error) {
    // The money could not be recorded (the invoice moved under us, say).
    // The attempt goes back to pending with the reason, so it is tried again
    // and shows up in reconciliation until it is.
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'PENDING',
        settledAt: null,
        failureReason: `Paid at the provider but not recorded: ${error instanceof Error ? error.message : String(error)}`,
      },
    });
    throw error;
  }
}

/** Asks the provider about one attempt and applies the answer. */
export async function checkAttempt(input: {
  orgId: string;
  attemptId: string;
}): Promise<SettleOutcome> {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { id: input.attemptId, orgId: input.orgId },
    select: { providerRef: true },
  });
  if (!attempt) return { outcome: 'unknown' };
  const record = await paymentProvider().retrieve(attempt.providerRef);
  await prisma.paymentAttempt.update({
    where: { providerRef: attempt.providerRef },
    data: { checkedAt: new Date() },
  });
  if (!record) return { outcome: 'unknown' };
  return settleAttempt({ providerRef: attempt.providerRef, record });
}

/** An attempt the portal customer started, with what became of it. */
export async function attemptForCustomer(userId: string, attemptId: string) {
  return prisma.paymentAttempt.findFirst({
    where: { id: attemptId, customer: { portalUserId: userId } },
    select: {
      id: true,
      orgId: true,
      status: true,
      amount: true,
      currency: true,
      failureReason: true,
      invoice: { select: { number: true } },
    },
  });
}

/** Every attempt for the workshop's page, newest first. */
export async function attemptsFor(orgId: string) {
  return prisma.paymentAttempt.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      provider: true,
      providerRef: true,
      amount: true,
      currency: true,
      failureReason: true,
      createdAt: true,
      settledAt: true,
      checkedAt: true,
      invoice: { select: { id: true, number: true } },
      customer: { select: { id: true, displayName: true } },
      payment: { select: { id: true, amount: true } },
      refunds: { select: { amount: true, providerRef: true, providerStatus: true } },
    },
  });
}

export type Reconciliation = {
  askedAt: Date;
  asked: number;
  differences: {
    attemptId: string;
    kind: string;
    message: string;
    invoiceNumber: string | null;
    customer: string;
  }[];
};

/**
 * The provider's record and ours, for every attempt of the last ninety days.
 * Nothing is changed here; the differences are named and a person decides.
 */
export async function reconcileFor(orgId: string): Promise<Reconciliation> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const attempts = await prisma.paymentAttempt.findMany({
    where: { orgId, createdAt: { gte: since }, providerRef: { not: { startsWith: 'pending_' } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      providerRef: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      payment: { select: { amount: true } },
      invoice: { select: { number: true } },
      customer: { select: { displayName: true } },
    },
  });
  const provider = paymentProvider();
  const theirs = new Map<string, ProviderRecord | null>();
  for (const attempt of attempts) {
    theirs.set(attempt.providerRef, await provider.retrieve(attempt.providerRef));
  }
  const local: LocalAttempt[] = attempts.map((a) => ({
    id: a.id,
    providerRef: a.providerRef,
    status: a.status,
    amountMinor: fromDecimal(a.amount.toString(), a.currency).minor,
    currency: a.currency,
    recordedMinor: a.payment ? fromDecimal(a.payment.amount.toString(), a.currency).minor : null,
    createdAt: a.createdAt,
  }));
  const byId = new Map(attempts.map((a) => [a.id, a]));
  return {
    askedAt: new Date(),
    asked: attempts.length,
    differences: reconcileAttempts(local, theirs).map((d) => ({
      ...d,
      invoiceNumber: byId.get(d.attemptId)?.invoice.number ?? null,
      customer: byId.get(d.attemptId)?.customer.displayName ?? '',
    })),
  };
}

/**
 * Sends a refund back through the provider that took the money. Asked
 * before anything is recorded, so a refusal there leaves nothing here.
 */
export async function refundThroughProvider(input: {
  orgId: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  reason: string;
}): Promise<{ attemptId: string; refundRef: string; status: 'SUCCEEDED' | 'PENDING' | 'FAILED' }> {
  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      orgId: input.orgId,
      invoiceId: input.invoiceId,
      status: 'SUCCEEDED',
      paymentId: { not: null },
    },
    select: {
      id: true,
      providerRef: true,
      amount: true,
      currency: true,
      refunds: { select: { amount: true } },
    },
  });
  const { providerRef } = assertRefundableThroughProvider({
    succeededAttempts: attempts.map((a) => ({
      providerRef: a.providerRef,
      amountMinor: fromDecimal(a.amount.toString(), a.currency).minor,
      refundedMinor: a.refunds.reduce(
        (n, r) => n + fromDecimal(r.amount.toString(), a.currency).minor,
        0,
      ),
    })),
    amountMinor: input.amountMinor,
  });
  const attempt = attempts.find((a) => a.providerRef === providerRef)!;
  const result = await paymentProvider().refund({
    providerRef,
    amountMinor: input.amountMinor,
    currency: input.currency,
    reason: input.reason,
  });
  if (result.status === 'FAILED') {
    throw new PaymentProviderError(
      'PROVIDER_REFUSED',
      result.reason ?? 'The provider refused the refund.',
    );
  }
  return { attemptId: attempt.id, refundRef: result.refundRef, status: result.status };
}
