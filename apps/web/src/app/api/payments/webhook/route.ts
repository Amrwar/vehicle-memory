import { PaymentProviderError } from '@carnet/core';
import { NextResponse } from 'next/server';

import { applyBillingEvent } from '@/lib/billing';
import { settleAttempt } from '@/lib/card-payments';
import { paymentProvider } from '@/lib/payments/provider';

/**
 * Where the provider tells us what became of a checkout, or of a workshop's
 * own subscription. Phase 32, subscriptions in 32.6.
 *
 * Verified by the provider behind the seam, and refused with 401 when it
 * cannot be: with no secret configured nothing is accepted, because this
 * endpoint records money. An event for something we do not know is
 * acknowledged and ignored, so the provider stops sending it. Applying an
 * event is idempotent; the provider may say the same thing twice.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const headers = {
    'stripe-signature': request.headers.get('stripe-signature'),
    'x-carnet-signature': request.headers.get('x-carnet-signature'),
  };

  let event;
  try {
    event = await paymentProvider().parseWebhook({ body, headers });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!event) return NextResponse.json({ error: 'Not signed, or not for us.' }, { status: 401 });

  if (event.kind === 'checkout') {
    const outcome = await settleAttempt({ providerRef: event.providerRef, record: event });
    return NextResponse.json(outcome, { status: 200 });
  }
  const outcome = await applyBillingEvent(event);
  return NextResponse.json(outcome, { status: 200 });
}
