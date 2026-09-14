import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderRecord,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from '@carnet/core';
import { PaymentProviderError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { env } from '../env';

/**
 * A provider that behaves like a real one and takes no money. Phase 32.
 *
 * Its memory is the providerPayload column on the attempt: deliberately a
 * separate record from the attempt's own status, so that reconciliation
 * has two things to compare and a test can make them disagree. Its hosted
 * checkout is /pay/<attempt>, a page of ours that offers to pay, decline
 * or cancel, the three things a customer can do on anybody's checkout.
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

    const event = JSON.parse(input.body) as Partial<WebhookEvent>;
    if (
      !event.providerRef ||
      !event.status ||
      typeof event.amountMinor !== 'number' ||
      !event.currency
    ) {
      throw new PaymentProviderError('PROVIDER_REFUSED', 'That event is not readable.');
    }
    return {
      providerRef: event.providerRef,
      status: event.status,
      amountMinor: event.amountMinor,
      currency: event.currency,
      reason: event.reason ?? null,
    };
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

/** Signs a body the way the stub's webhook expects. For the verification script. */
export function stubSign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
