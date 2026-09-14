import type { PaymentProvider } from '@carnet/core';

import { env } from '../env';
import { stripeProvider } from './stripe';
import { stubProvider } from './stub';

/**
 * Which provider is behind the seam. Phase 32.
 *
 * Chosen by PAYMENT_PROVIDER, stub by default, so a fresh install takes
 * pretend money until somebody puts keys in. The pages never know which.
 */
export function paymentProvider(): PaymentProvider {
  return env().PAYMENT_PROVIDER === 'stripe' ? stripeProvider : stubProvider;
}

/** Whether the customer is offered a card button at all. */
export function cardPaymentsOffered(): boolean {
  const e = env();
  return e.PAYMENT_PROVIDER === 'stub' || Boolean(e.STRIPE_SECRET_KEY);
}
