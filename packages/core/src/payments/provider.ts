/**
 * The seam a payment provider sits behind. Phase 32, subscriptions in 32.6.
 *
 * For a customer's invoice: open a checkout for an amount, ask what became
 * of it, send some of it back, and read what the provider tells us
 * unprompted. For the workshop's own subscription: open a checkout that
 * takes a card and starts a trial, ask what the subscription is now, cancel
 * it at the end of what was paid for, hand the owner the provider's own
 * billing page, and list the provider's invoices. Everything a provider
 * does beyond that is outside the seam until a phase needs it.
 *
 * The provider is never the record. The record is the row on our side; the
 * provider is a witness we ask, and reconciliation is the comparison.
 */

export type ProviderStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface CheckoutRequest {
  /** Our own id for the attempt; the provider carries it back on every answer. */
  attemptId: string;
  amountMinor: number;
  currency: string;
  /** What appears on the customer's statement and the checkout page. */
  description: string;
  /** The customer's address, when known, so the provider can send its own receipt. */
  customerEmail?: string | null;
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** The provider's reference for the checkout: what we store and ask about later. */
  providerRef: string;
  /** Where to send the customer. */
  url: string;
}

export interface ProviderRecord {
  providerRef: string;
  status: ProviderStatus;
  amountMinor: number;
  currency: string;
  /** In the provider's words, for a failure. */
  reason?: string | null;
  /** The provider's own reference for the charge, when it has one. */
  chargeRef?: string | null;
}

export interface RefundRequest {
  providerRef: string;
  amountMinor: number;
  currency: string;
  reason: string;
}

export interface RefundResult {
  refundRef: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  reason?: string | null;
}

/* ---------------------------------------------------------------------------
   The workshop's own subscription
   --------------------------------------------------------------------------- */

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE';

export interface SubscriptionCheckoutRequest {
  orgId: string;
  plan: string;
  /** What the plan costs per month, in minor units, when the provider prices inline. */
  amountMinor: number;
  currency: string;
  /** The provider's own price id, when one is configured; the amount is then ignored. */
  priceRef?: string | null;
  /** How many of the unit the plan is priced by: bays. */
  quantity: number;
  trialDays: number;
  workshopName: string;
  ownerEmail: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface SubscriptionRecord {
  customerRef: string;
  subscriptionRef: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  /** Set when the subscription will end at the period's end rather than renew. */
  cancelAt: Date | null;
  card: { brand: string; last4: string } | null;
}

export interface BillingInvoice {
  ref: string;
  number: string | null;
  amountMinor: number;
  currency: string;
  status: 'PAID' | 'OPEN' | 'FAILED' | 'VOID' | 'DRAFT';
  issuedAt: Date;
  /** The provider's hosted page for it, and a PDF when it has one. */
  url: string | null;
  pdfUrl: string | null;
}

/* ---------------------------------------------------------------------------
   Webhooks
   --------------------------------------------------------------------------- */

export interface CheckoutEvent {
  kind: 'checkout';
  providerRef: string;
  status: ProviderStatus;
  amountMinor: number;
  currency: string;
  reason?: string | null;
}

export interface SubscriptionEvent {
  kind: 'subscription';
  /** Our organisation id, carried in the provider's metadata. */
  orgId: string | null;
  customerRef: string;
  subscriptionRef: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
}

export interface BillingInvoiceEvent {
  kind: 'billing-invoice';
  customerRef: string;
  subscriptionRef: string | null;
  outcome: 'PAID' | 'FAILED';
  amountMinor: number;
  currency: string;
  invoiceRef: string;
  url: string | null;
}

export type WebhookEvent = CheckoutEvent | SubscriptionEvent | BillingInvoiceEvent;

export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  retrieve(providerRef: string): Promise<ProviderRecord | null>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /**
   * Reads and verifies a webhook. Returns null for a request that is not
   * for us or not signed; throws for one that is signed and malformed.
   */
  parseWebhook(input: {
    body: string;
    headers: Record<string, string | null>;
  }): Promise<WebhookEvent | null>;

  createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutResult>;
  /** By the checkout's reference or the subscription's; null when the provider has neither. */
  retrieveSubscription(ref: string): Promise<SubscriptionRecord | null>;
  cancelSubscription(subscriptionRef: string): Promise<SubscriptionRecord>;
  billingPortalUrl(customerRef: string, returnUrl: string): Promise<string>;
  listBillingInvoices(customerRef: string): Promise<BillingInvoice[]>;
}

/** What a provider refused, in a sentence the page can show. */
export class PaymentProviderError extends Error {
  readonly code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_REFUSED' | 'NOT_CONFIGURED' | 'BAD_SIGNATURE';

  constructor(code: PaymentProviderError['code'], message: string) {
    super(message);
    this.name = 'PaymentProviderError';
    this.code = code;
  }
}
