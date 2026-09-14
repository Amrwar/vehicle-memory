import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderRecord,
  ProviderStatus,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from '@carnet/core';
import { PaymentProviderError } from '@carnet/core';

import { env } from '../env';

/**
 * Stripe, behind the same seam. Phase 32.
 *
 * Hosted Checkout in payment mode: we open a session, send the customer to
 * it, and learn the result by asking for the session or by its webhook.
 * Written against the HTTP API directly rather than the SDK, because the
 * seam is four calls and a signature check, and a dependency that size for
 * that little is a thing to keep up to date for no return.
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

async function call<T>(method: 'GET' | 'POST', path: string, body?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key()}`,
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body,
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

type Session = {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total: number | null;
  currency: string | null;
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

    const event = JSON.parse(input.body) as { type: string; data: { object: Session } };
    const session = event.data?.object;
    if (!session?.id) return null;
    const map: Record<string, ProviderStatus> = {
      'checkout.session.completed': session.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING',
      'checkout.session.async_payment_succeeded': 'SUCCEEDED',
      'checkout.session.async_payment_failed': 'FAILED',
      'checkout.session.expired': 'CANCELLED',
    };
    const status = map[event.type];
    if (!status) return null;
    return {
      providerRef: session.id,
      status,
      amountMinor: session.amount_total ?? 0,
      currency: (session.currency ?? '').toUpperCase(),
      reason: status === 'FAILED' ? 'The payment did not complete.' : null,
    };
  },
};
