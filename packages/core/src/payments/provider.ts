/**
 * The seam a payment provider sits behind. Phase 32.
 *
 * Four things, and no more: open a checkout for an amount, ask what became
 * of it, send some of it back, and read what the provider tells us
 * unprompted. Everything a provider does beyond that (fees, payouts,
 * disputes) is outside the seam until a phase needs it.
 *
 * The provider is never the record. The record is the PaymentAttempt row,
 * the Payment it produces and the ledger entry behind that; the provider
 * is a witness we ask, and reconciliation is the comparison of the two.
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

export interface WebhookEvent {
  providerRef: string;
  status: ProviderStatus;
  amountMinor: number;
  currency: string;
  reason?: string | null;
}

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
