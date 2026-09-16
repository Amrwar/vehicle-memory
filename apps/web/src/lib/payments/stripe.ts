import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  BillingInvoice,
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderRecord,
  ProviderStatus,
  RefundRequest,
  RefundResult,
  SubscriptionCheckoutRequest,
  SubscriptionRecord,
  SubscriptionStatus,
  WebhookEvent,
} from '@carnet/core';
import { PaymentProviderError } from '@carnet/core';

import { env } from '../env';

/**
 * Stripe, behind the same seam. Phase 32, subscriptions in 32.6.
 *
 * Hosted Checkout for a customer's invoice (payment mode) and for the
 * workshop's own subscription (subscription mode with a trial and a card
 * taken up front); the Billing Portal for the owner to change the card or
 * read invoices; webhooks for both. Written against the HTTP API directly
 * rather than the SDK, because the seam is a handful of calls and a
 * signature check, and a dependency that size for that little is a thing to
 * keep up to date for no return.
 *
 * Needs STRIPE_SECRET_KEY and, for the webhook, STRIPE_WEBHOOK_SECRET. With
 * neither it refuses to be chosen; PAYMENT_PROVIDER=stub is the default.
 */

const API = 'https://api.stripe.com/v1';
const TOLERANCE_SECONDS = 300;

function key(): string {
  const value = env().STRIPE_SECRET_KEY;
  if (!value)
    throw new PaymentProviderError(
      'NOT_CONFIGURED',
      'Stripe is not configured: STRIPE_SECRET_KEY is missing.',
    );
  return value;
}

function form(fields: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    params.set(name, String(value));
  }
  return params.toString();
}

/**
 * Long enough for a provider having a slow moment, short enough that a person
 * is told something rather than watching a spinner until the platform kills
 * the request underneath them. Phase 46.
 */
const TIMEOUT_MS = 15_000;

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: string,
  /**
   * Stripe's own idempotency key. A write sent twice under one key is one
   * write and the same answer, which is what makes a retry — ours or the
   * platform's — safe rather than expensive. Derived from what the request is
   * about, so the second attempt carries the same key as the first.
   */
  idempotencyKey?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key()}`,
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey.slice(0, 255) } : {}),
      },
      body,
      // A provider that never answers must not become a page that never
      // answers. Timed out, this throws PROVIDER_UNAVAILABLE like any other
      // failure to reach them, and the caller says so in a sentence.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new PaymentProviderError(
      'PROVIDER_UNAVAILABLE',
      `Stripe could not be reached: ${String(error)}`,
    );
  }
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new PaymentProviderError(
      'PROVIDER_REFUSED',
      json.error?.message ?? `Stripe answered ${response.status}.`,
    );
  }
  return json;
}

const seconds = (value: number | null | undefined): Date | null =>
  value ? new Date(value * 1000) : null;

/* ---------------------------------------------------------------------------
   Invoices paid by a customer
   --------------------------------------------------------------------------- */

type Session = {
  id: string;
  url: string | null;
  mode?: 'payment' | 'subscription' | 'setup';
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total: number | null;
  currency: string | null;
  customer?: string | null;
  subscription?: string | StripeSubscription | null;
  metadata?: Record<string, string>;
  payment_intent: string | { id: string; last_payment_error?: { message?: string } | null } | null;
};

function statusOf(session: Session): { status: ProviderStatus; reason: string | null } {
  if (session.payment_status === 'paid') return { status: 'SUCCEEDED', reason: null };
  if (session.status === 'expired') return { status: 'CANCELLED', reason: 'The checkout expired.' };
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const error = intent?.last_payment_error?.message;
  if (error) return { status: 'FAILED', reason: error };
  return { status: 'PENDING', reason: null };
}

function record(session: Session): ProviderRecord {
  const { status, reason } = statusOf(session);
  return {
    providerRef: session.id,
    status,
    amountMinor: session.amount_total ?? 0,
    currency: (session.currency ?? '').toUpperCase(),
    reason,
    chargeRef:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
  };
}

/* ---------------------------------------------------------------------------
   The workshop's subscription
   --------------------------------------------------------------------------- */

type PaymentMethod = { id: string; card?: { brand: string; last4: string } | null };

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused';
  trial_end: number | null;
  current_period_end?: number | null;
  cancel_at: number | null;
  cancel_at_period_end?: boolean;
  default_payment_method?: string | PaymentMethod | null;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number | null }[] };
};

function subscriptionStatus(status: StripeSubscription['status']): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELLED';
    default:
      return 'INCOMPLETE';
  }
}

async function cardOf(sub: StripeSubscription): Promise<SubscriptionRecord['card']> {
  const method = typeof sub.default_payment_method === 'object' ? sub.default_payment_method : null;
  if (method?.card) return { brand: method.card.brand, last4: method.card.last4 };
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const list = await call<{ data: PaymentMethod[] }>(
    'GET',
    `/payment_methods?customer=${encodeURIComponent(customer)}&type=card&limit=1`,
  );
  const first = list.data[0]?.card;
  return first ? { brand: first.brand, last4: first.last4 } : null;
}

async function subscriptionRecord(sub: StripeSubscription): Promise<SubscriptionRecord> {
  return {
    customerRef: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscriptionRef: sub.id,
    status: subscriptionStatus(sub.status),
    trialEndsAt: seconds(sub.trial_end),
    // Newer API versions moved the period onto the items.
    currentPeriodEnd: seconds(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end),
    cancelAt: seconds(sub.cancel_at),
    card: await cardOf(sub),
  };
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const session = await call<Session>(
      'POST',
      '/checkout/sessions',
      form({
        // A one-off payment for one invoice, priced inline: the line is the
        // invoice, not a catalogue product.
        mode: 'payment',
        'line_items[0][price_data][currency]': request.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': request.amountMinor,
        'line_items[0][price_data][product_data][name]': request.description,
        'line_items[0][quantity]': 1,
        client_reference_id: request.attemptId,
        'metadata[attemptId]': request.attemptId,
        customer_email: request.customerEmail ?? undefined,
        success_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        // Configured in Stripe's Checkout Studio (hosted page, web). No SDK
        // and no pinned API version here, so `ui_mode` follows the account's
        // API version; see STRIPE_INTEGRATION_TODO.md.
        ui_mode: 'hosted_page',
        billing_address_collection: 'auto',
        'phone_number_collection[enabled]': 'false',
        'automatic_tax[enabled]': 'false',
        // Stripe's Managed Payments (Stripe as merchant of record, taxing the
        // sale itself) is on by default for new accounts. The invoice already
        // carries the workshop's tax, so this checkout is explicitly not managed.
        'managed_payments[enabled]': 'false',
        allow_promotion_codes: 'false',
        submit_type: 'auto',
        origin_context: 'web',
        'metadata[integration_identifier]': 'hosted_web_0001',
      }),
      // Our own id for the attempt is the natural key: the same attempt sent
      // twice opens one checkout rather than two, so a customer who reloads
      // the page mid-redirect is not handed a second bill to pay. Phase 46.
      `checkout:${request.attemptId}`,
    );
    if (!session.url)
      throw new PaymentProviderError(
        'PROVIDER_REFUSED',
        'Stripe opened a session with nowhere to send the customer.',
      );
    return { providerRef: session.id, url: session.url };
  },

  async retrieve(providerRef: string): Promise<ProviderRecord | null> {
    try {
      const session = await call<Session>(
        'GET',
        `/checkout/sessions/${encodeURIComponent(providerRef)}?expand[]=payment_intent`,
      );
      return record(session);
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.code === 'PROVIDER_REFUSED' &&
        /No such/i.test(error.message)
      ) {
        return null;
      }
      throw error;
    }
  },

  async refund(request: RefundRequest): Promise<RefundResult> {
    const session = await call<Session>(
      'GET',
      `/checkout/sessions/${encodeURIComponent(request.providerRef)}`,
    );
    const intent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intent)
      throw new PaymentProviderError(
        'PROVIDER_REFUSED',
        'Stripe has no charge on that checkout to refund.',
      );
    const refund = await call<{
      id: string;
      status: 'succeeded' | 'pending' | 'failed' | 'canceled';
      failure_reason?: string;
    }>(
      'POST',
      '/refunds',
      form({
        payment_intent: intent,
        amount: request.amountMinor,
        'metadata[reason]': request.reason.slice(0, 500),
      }),
      request.idempotencyKey,
    );
    return {
      refundRef: refund.id,
      status:
        refund.status === 'succeeded'
          ? 'SUCCEEDED'
          : refund.status === 'pending'
            ? 'PENDING'
            : 'FAILED',
      reason: refund.failure_reason ?? null,
    };
  },

  async parseWebhook(input): Promise<WebhookEvent | null> {
    const secret = env().STRIPE_WEBHOOK_SECRET;
    const header = input.headers['stripe-signature'];
    if (!secret || !header) return null;

    // t=<unix>,v1=<hex>[,v1=<hex>]: an HMAC over "<t>.<body>", with a
    // tolerance so a captured event cannot be replayed later.
    const parts = Object.fromEntries(
      header.split(',').map((piece) => {
        const [k, v] = piece.split('=');
        return [k?.trim() ?? '', v?.trim() ?? ''];
      }),
    );
    const sent = Number(parts['t']);
    if (!Number.isFinite(sent) || Math.abs(Date.now() / 1000 - sent) > TOLERANCE_SECONDS)
      return null;
    const expected = createHmac('sha256', secret)
      .update(`${parts['t']}.${input.body}`)
      .digest('hex');
    const offered = header
      .split(',')
      .filter((piece) => piece.trim().startsWith('v1='))
      .map((piece) => piece.trim().slice(3));
    const good = offered.some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!good) return null;

    const event = JSON.parse(input.body) as { type: string; data: { object: unknown } };
    const object = event.data?.object as Record<string, unknown> | undefined;
    if (!object) return null;

    if (event.type.startsWith('checkout.session.')) {
      const session = object as unknown as Session;
      if (!session.id) return null;
      // A subscription checkout finishing is the moment the workshop's card
      // is on file: the subscription is read from the provider afterwards.
      if (session.mode === 'subscription' && event.type === 'checkout.session.completed') {
        const subRef =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription?.id ?? '');
        return {
          kind: 'subscription',
          orgId: session.metadata?.['orgId'] ?? null,
          customerRef: session.customer ?? '',
          subscriptionRef: subRef,
          status: 'TRIALING',
          trialEndsAt: null,
          currentPeriodEnd: null,
          cancelAt: null,
        };
      }
      const map: Record<string, ProviderStatus> = {
        'checkout.session.completed': session.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING',
        'checkout.session.async_payment_succeeded': 'SUCCEEDED',
        'checkout.session.async_payment_failed': 'FAILED',
        'checkout.session.expired': 'CANCELLED',
      };
      const status = map[event.type];
      if (!status) return null;
      return {
        kind: 'checkout',
        providerRef: session.id,
        status,
        amountMinor: session.amount_total ?? 0,
        currency: (session.currency ?? '').toUpperCase(),
        reason: status === 'FAILED' ? 'The payment did not complete.' : null,
      };
    }

    if (event.type.startsWith('customer.subscription.')) {
      const sub = object as unknown as StripeSubscription;
      return {
        kind: 'subscription',
        orgId: sub.metadata?.['orgId'] ?? null,
        customerRef: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscriptionRef: sub.id,
        status:
          event.type === 'customer.subscription.deleted'
            ? 'CANCELLED'
            : subscriptionStatus(sub.status),
        trialEndsAt: seconds(sub.trial_end),
        currentPeriodEnd: seconds(
          sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end,
        ),
        cancelAt: seconds(sub.cancel_at),
      };
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = object as {
        id: string;
        customer: string | { id: string };
        subscription?: string | null;
        parent?: { subscription_details?: { subscription?: string | null } | null } | null;
        amount_paid?: number;
        amount_due?: number;
        currency: string;
        hosted_invoice_url?: string | null;
      };
      return {
        kind: 'billing-invoice',
        customerRef: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id,
        subscriptionRef:
          invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null,
        outcome: event.type === 'invoice.paid' ? 'PAID' : 'FAILED',
        amountMinor:
          (event.type === 'invoice.paid' ? invoice.amount_paid : invoice.amount_due) ?? 0,
        currency: invoice.currency.toUpperCase(),
        invoiceRef: invoice.id,
        url: invoice.hosted_invoice_url ?? null,
      };
    }

    return null;
  },

  async createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutResult> {
    // A catalogue price may carry several currencies; the session says which.
    const line = request.priceRef
      ? { 'line_items[0][price]': request.priceRef, currency: request.currency.toLowerCase() }
      : {
          'line_items[0][price_data][currency]': request.currency.toLowerCase(),
          'line_items[0][price_data][unit_amount]': request.amountMinor,
          'line_items[0][price_data][recurring][interval]': 'month',
          'line_items[0][price_data][product_data][name]': `Carnet ${request.plan.charAt(0)}${request.plan.slice(1).toLowerCase()}, per bay`,
        };
    const session = await call<Session>(
      'POST',
      '/checkout/sessions',
      form({
        mode: 'subscription',
        ...line,
        'line_items[0][quantity]': request.quantity,
        // The card is taken now and charged when the trial ends. A trial
        // that ends with no card cancels rather than charging nothing.
        payment_method_collection: 'always',
        'subscription_data[trial_period_days]': request.trialDays,
        'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'cancel',
        'subscription_data[metadata][orgId]': request.orgId,
        'subscription_data[description]': `Carnet subscription for ${request.workshopName}`,
        client_reference_id: request.orgId,
        'metadata[orgId]': request.orgId,
        customer_email: request.ownerEmail,
        success_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        ui_mode: 'hosted_page',
        billing_address_collection: 'auto',
        'automatic_tax[enabled]': 'false',
        'managed_payments[enabled]': 'false',
        allow_promotion_codes: 'false',
        origin_context: 'web',
      }),
    );
    if (!session.url)
      throw new PaymentProviderError(
        'PROVIDER_REFUSED',
        'Stripe opened a session with nowhere to send the owner.',
      );
    return { providerRef: session.id, url: session.url };
  },

  async retrieveSubscription(ref: string): Promise<SubscriptionRecord | null> {
    try {
      if (ref.startsWith('cs_')) {
        const session = await call<Session>(
          'GET',
          `/checkout/sessions/${encodeURIComponent(ref)}?expand[]=subscription&expand[]=subscription.default_payment_method`,
        );
        const sub = typeof session.subscription === 'object' ? session.subscription : null;
        if (!sub) return null;
        return subscriptionRecord(sub);
      }
      const sub = await call<StripeSubscription>(
        'GET',
        `/subscriptions/${encodeURIComponent(ref)}?expand[]=default_payment_method`,
      );
      return subscriptionRecord(sub);
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.code === 'PROVIDER_REFUSED' &&
        /No such/i.test(error.message)
      ) {
        return null;
      }
      throw error;
    }
  },

  async cancelSubscription(subscriptionRef: string): Promise<SubscriptionRecord> {
    const sub = await call<StripeSubscription>(
      'POST',
      `/subscriptions/${encodeURIComponent(subscriptionRef)}?expand[]=default_payment_method`,
      form({ cancel_at_period_end: 'true' }),
    );
    return subscriptionRecord(sub);
  },

  async billingPortalUrl(customerRef: string, returnUrl: string): Promise<string> {
    const portal = await call<{ url: string }>(
      'POST',
      '/billing_portal/sessions',
      form({ customer: customerRef, return_url: returnUrl }),
    );
    return portal.url;
  },

  async listBillingInvoices(customerRef: string): Promise<BillingInvoice[]> {
    const list = await call<{
      data: {
        id: string;
        number: string | null;
        total: number;
        currency: string;
        status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
        attempt_count?: number;
        created: number;
        hosted_invoice_url?: string | null;
        invoice_pdf?: string | null;
      }[];
    }>('GET', `/invoices?customer=${encodeURIComponent(customerRef)}&limit=24`);
    return list.data.map((i) => ({
      ref: i.id,
      number: i.number,
      amountMinor: i.total,
      currency: i.currency.toUpperCase(),
      status:
        i.status === 'paid'
          ? 'PAID'
          : i.status === 'void'
            ? 'VOID'
            : i.status === 'draft'
              ? 'DRAFT'
              : i.status === 'uncollectible' || (i.attempt_count ?? 0) > 0
                ? 'FAILED'
                : 'OPEN',
      issuedAt: new Date(i.created * 1000),
      url: i.hosted_invoice_url ?? null,
      pdfUrl: i.invoice_pdf ?? null,
    }));
  },
};
