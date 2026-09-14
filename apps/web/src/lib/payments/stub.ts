import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type {
  BillingInvoice,
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderRecord,
  RefundRequest,
  RefundResult,
  SubscriptionCheckoutRequest,
  SubscriptionRecord,
  SubscriptionStatus,
  WebhookEvent,
} from '@carnet/core';
import { PaymentProviderError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { env } from '../env';

/**
 * A provider that behaves like a real one and takes no money. Phase 32,
 * subscriptions in 32.6.
 *
 * Its memory for a customer's payment is the providerPayload column on the
 * attempt; for a workshop's subscription it is billingPayload on the
 * organisation. Both are deliberately separate records from our own status
 * columns, so reconciliation has two things to compare and a test can make
 * them disagree. Its hosted pages are ours: /pay/<attempt> offers to pay,
 * decline or cancel; /pay/subscribe/<org> offers to add a card for the
 * trial, and doubles as the billing portal.
 *
 * Its webhook is a JSON body signed with PAYMENT_WEBHOOK_SECRET, so the
 * whole path a real provider's event takes is exercised without one.
 */

type StubRecord = {
  status: ProviderRecord['status'];
  amountMinor: number;
  currency: string;
  reason?: string | null;
  refunds: { ref: string; amountMinor: number }[];
};

export type StubSubscription = {
  customerRef: string;
  subscriptionRef: string;
  status: SubscriptionStatus;
  plan: string;
  amountMinor: number;
  currency: string;
  quantity: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  card: { brand: string; last4: string } | null;
  invoices: {
    ref: string;
    number: string;
    amountMinor: number;
    currency: string;
    status: BillingInvoice['status'];
    issuedAt: string;
  }[];
};

/** The stub's reference is its attempt id with a prefix; its memory lives on that row. */
function attemptIdOf(providerRef: string): string {
  return providerRef.startsWith('stub_') ? providerRef.slice(5) : providerRef;
}

async function read(providerRef: string): Promise<StubRecord | null> {
  const row = await prisma.paymentAttempt.findUnique({
    where: { id: attemptIdOf(providerRef) },
    select: { providerPayload: true },
  });
  return (row?.providerPayload as StubRecord | null) ?? null;
}

async function write(providerRef: string, record: StubRecord): Promise<void> {
  await prisma.paymentAttempt.update({
    where: { id: attemptIdOf(providerRef) },
    data: { providerPayload: record },
  });
}

/** A subscription reference is `stubsub_<orgId>`; a checkout for one is `stubsubcs_<orgId>`. */
function orgIdOf(ref: string): string {
  return ref.replace(/^stubsubcs_|^stubsub_|^stubcus_/, '');
}

async function readSubscription(orgId: string): Promise<StubSubscription | null> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { billingPayload: true },
  });
  return (row?.billingPayload as StubSubscription | null) ?? null;
}

async function writeSubscription(orgId: string, record: StubSubscription): Promise<void> {
  await prisma.organization.update({ where: { id: orgId }, data: { billingPayload: record } });
}

function toRecord(sub: StubSubscription): SubscriptionRecord {
  return {
    customerRef: sub.customerRef,
    subscriptionRef: sub.subscriptionRef,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
    currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
    cancelAt: sub.cancelAt ? new Date(sub.cancelAt) : null,
    card: sub.card,
  };
}

export const stubProvider: PaymentProvider = {
  name: 'stub',

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const providerRef = `stub_${request.attemptId}`;
    await write(providerRef, {
      status: 'PENDING',
      amountMinor: request.amountMinor,
      currency: request.currency,
      reason: null,
      refunds: [],
    });
    return { providerRef, url: `${env().APP_URL}/pay/${request.attemptId}` };
  },

  async retrieve(providerRef: string): Promise<ProviderRecord | null> {
    const record = await read(providerRef);
    if (!record) return null;
    return {
      providerRef,
      status: record.status,
      amountMinor: record.amountMinor,
      currency: record.currency,
      reason: record.reason ?? null,
      chargeRef: record.status === 'SUCCEEDED' ? `${providerRef}_ch` : null,
    };
  },

  async refund(request: RefundRequest): Promise<RefundResult> {
    const record = await read(request.providerRef);
    if (!record || record.status !== 'SUCCEEDED') {
      throw new PaymentProviderError(
        'PROVIDER_REFUSED',
        'The provider has no successful payment to refund.',
      );
    }
    const refunded = record.refunds.reduce((n, r) => n + r.amountMinor, 0);
    if (refunded + request.amountMinor > record.amountMinor) {
      throw new PaymentProviderError(
        'PROVIDER_REFUSED',
        'The provider says that is more than was taken.',
      );
    }
    const ref = `stubre_${randomBytes(6).toString('hex')}`;
    await write(request.providerRef, {
      ...record,
      refunds: [...record.refunds, { ref, amountMinor: request.amountMinor }],
    });
    return { refundRef: ref, status: 'SUCCEEDED' };
  },

  async parseWebhook(input): Promise<WebhookEvent | null> {
    const secret = env().PAYMENT_WEBHOOK_SECRET;
    const signature = input.headers['x-carnet-signature'];
    if (!secret || !signature) return null;
    const expected = createHmac('sha256', secret).update(input.body).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const event = JSON.parse(input.body) as Record<string, unknown>;
    const kind = (event['kind'] as string | undefined) ?? 'checkout';
    if (kind === 'checkout') {
      if (
        !event['providerRef'] ||
        !event['status'] ||
        typeof event['amountMinor'] !== 'number' ||
        !event['currency']
      ) {
        throw new PaymentProviderError('PROVIDER_REFUSED', 'That event is not readable.');
      }
      return {
        kind: 'checkout',
        providerRef: String(event['providerRef']),
        status: event['status'] as ProviderRecord['status'],
        amountMinor: event['amountMinor'],
        currency: String(event['currency']),
        reason: (event['reason'] as string | null | undefined) ?? null,
      };
    }
    if (kind === 'subscription') {
      return {
        kind: 'subscription',
        orgId: (event['orgId'] as string | null) ?? null,
        customerRef: String(event['customerRef'] ?? ''),
        subscriptionRef: String(event['subscriptionRef'] ?? ''),
        status: event['status'] as SubscriptionStatus,
        trialEndsAt: event['trialEndsAt'] ? new Date(String(event['trialEndsAt'])) : null,
        currentPeriodEnd: event['currentPeriodEnd']
          ? new Date(String(event['currentPeriodEnd']))
          : null,
        cancelAt: event['cancelAt'] ? new Date(String(event['cancelAt'])) : null,
      };
    }
    if (kind === 'billing-invoice') {
      return {
        kind: 'billing-invoice',
        customerRef: String(event['customerRef'] ?? ''),
        subscriptionRef: (event['subscriptionRef'] as string | null) ?? null,
        outcome: event['outcome'] === 'FAILED' ? 'FAILED' : 'PAID',
        amountMinor: Number(event['amountMinor'] ?? 0),
        currency: String(event['currency'] ?? 'GBP'),
        invoiceRef: String(event['invoiceRef'] ?? ''),
        url: (event['url'] as string | null) ?? null,
      };
    }
    throw new PaymentProviderError('PROVIDER_REFUSED', 'That event is not one we read.');
  },

  async createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutResult> {
    const existing = await readSubscription(request.orgId);
    await writeSubscription(request.orgId, {
      customerRef: `stubcus_${request.orgId}`,
      subscriptionRef: `stubsub_${request.orgId}`,
      status: 'INCOMPLETE',
      plan: request.plan,
      amountMinor: request.amountMinor,
      currency: request.currency,
      quantity: request.quantity,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAt: null,
      card: null,
      invoices: existing?.invoices ?? [],
    });
    return {
      providerRef: `stubsubcs_${request.orgId}`,
      url: `${env().APP_URL}/pay/subscribe/${request.orgId}`,
    };
  },

  async retrieveSubscription(ref: string): Promise<SubscriptionRecord | null> {
    const sub = await readSubscription(orgIdOf(ref));
    // A checkout nobody finished is not a subscription yet.
    if (!sub || sub.status === 'INCOMPLETE') return null;
    return toRecord(sub);
  },

  async cancelSubscription(subscriptionRef: string): Promise<SubscriptionRecord> {
    const orgId = orgIdOf(subscriptionRef);
    const sub = await readSubscription(orgId);
    if (!sub) throw new PaymentProviderError('PROVIDER_REFUSED', 'No such subscription.');
    const ends = sub.currentPeriodEnd ?? sub.trialEndsAt ?? new Date().toISOString();
    const next = { ...sub, cancelAt: ends };
    await writeSubscription(orgId, next);
    return toRecord(next);
  },

  async billingPortalUrl(customerRef: string, returnUrl: string): Promise<string> {
    return `${env().APP_URL}/pay/subscribe/${orgIdOf(customerRef)}?portal=1&return=${encodeURIComponent(returnUrl)}`;
  },

  async listBillingInvoices(customerRef: string): Promise<BillingInvoice[]> {
    const sub = await readSubscription(orgIdOf(customerRef));
    return (sub?.invoices ?? [])
      .map((i) => ({
        ref: i.ref,
        number: i.number,
        amountMinor: i.amountMinor,
        currency: i.currency,
        status: i.status,
        issuedAt: new Date(i.issuedAt),
        url: null,
        pdfUrl: null,
      }))
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  },
};

/** The checkout page remembering what was pressed: the stub's own record of the outcome. */
export async function stubRemember(input: {
  providerRef: string;
  amountMinor: number;
  currency: string;
  status: ProviderRecord['status'];
  reason?: string | null;
}): Promise<void> {
  const existing = await read(input.providerRef);
  await write(input.providerRef, {
    status: input.status,
    amountMinor: input.amountMinor,
    currency: input.currency,
    reason: input.reason ?? null,
    refunds: existing?.refunds ?? [],
  });
}

/** The subscribe page remembering that a card was added: the trial starts now. */
export async function stubAddCard(input: {
  orgId: string;
  trialDays: number;
  card?: { brand: string; last4: string };
}): Promise<SubscriptionRecord> {
  const sub = await readSubscription(input.orgId);
  if (!sub) throw new PaymentProviderError('PROVIDER_REFUSED', 'No checkout was opened.');
  const trialEndsAt = new Date(Date.now() + input.trialDays * 86_400_000);
  const next: StubSubscription = {
    ...sub,
    status: 'TRIALING',
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodEnd: trialEndsAt.toISOString(),
    card: input.card ?? { brand: 'Visa', last4: '4242' },
  };
  await writeSubscription(input.orgId, next);
  return toRecord(next);
}

/** What the stub knows about a workshop's subscription, for its portal page. */
export async function stubSubscriptionOf(orgId: string): Promise<StubSubscription | null> {
  return readSubscription(orgId);
}

/**
 * The trial ending, as the provider would do it: an invoice for the first
 * month, paid or failed, and the subscription moved on. For the
 * verification script and the stub portal's "simulate" button.
 */
export async function stubCharge(input: {
  orgId: string;
  outcome: 'PAID' | 'FAILED';
}): Promise<{ invoiceRef: string; amountMinor: number; currency: string }> {
  const sub = await readSubscription(input.orgId);
  if (!sub) throw new PaymentProviderError('PROVIDER_REFUSED', 'No subscription.');
  const amountMinor = sub.amountMinor * sub.quantity;
  const ref = `stubin_${randomBytes(5).toString('hex')}`;
  const periodEnd = new Date(Date.now() + 30 * 86_400_000);
  await writeSubscription(input.orgId, {
    ...sub,
    status: input.outcome === 'PAID' ? 'ACTIVE' : 'PAST_DUE',
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: periodEnd.toISOString(),
    invoices: [
      ...sub.invoices,
      {
        ref,
        number: `STUB-${String(sub.invoices.length + 1).padStart(4, '0')}`,
        amountMinor,
        currency: sub.currency,
        status: input.outcome === 'PAID' ? 'PAID' : 'FAILED',
        issuedAt: new Date().toISOString(),
      },
    ],
  });
  return { invoiceRef: ref, amountMinor, currency: sub.currency };
}

/** Signs a body the way the stub's webhook expects. For the verification script. */
export function stubSign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
