import type { ProviderRecord, ProviderStatus } from './provider';

/**
 * A payment attempt: the rules. Phase 32.
 *
 * An attempt is one try at paying some of an invoice through a provider.
 * It starts pending, and ends succeeded, failed or cancelled, once; it
 * never goes back. A succeeded attempt is what produces the Payment and
 * the posting, exactly once, however many times the provider tells us.
 */

export type AttemptStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export class PaymentAttemptError extends Error {
  readonly code:
    | 'NOT_PAYABLE'
    | 'NOTHING_OWED'
    | 'OVER'
    | 'ZERO'
    | 'ALREADY_SETTLED'
    | 'CURRENCY'
    | 'NO_CARD_PAYMENT';

  constructor(code: PaymentAttemptError['code'], message: string) {
    super(message);
    this.name = 'PaymentAttemptError';
    this.code = code;
  }
}

const PAYABLE = new Set(['ISSUED', 'PART_PAID', 'OVERDUE']);

/** Whether an invoice can take a card payment of this amount right now. */
export function assertAttemptCreatable(input: {
  invoiceStatus: string;
  outstandingMinor: number;
  amountMinor: number;
}): void {
  if (!PAYABLE.has(input.invoiceStatus)) {
    throw new PaymentAttemptError(
      'NOT_PAYABLE',
      input.invoiceStatus === 'PAID'
        ? 'This invoice is already paid.'
        : 'This invoice is not open for payment.',
    );
  }
  if (input.outstandingMinor <= 0) {
    throw new PaymentAttemptError('NOTHING_OWED', 'Nothing is owed on this invoice.');
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new PaymentAttemptError('ZERO', 'The amount to pay must be more than nothing.');
  }
  if (input.amountMinor > input.outstandingMinor) {
    throw new PaymentAttemptError('OVER', 'That is more than is owed on this invoice.');
  }
}

/**
 * The next state of an attempt given what the provider says. A terminal
 * state does not move: a provider that says "succeeded" twice, or says
 * "failed" after we recorded the money, changes nothing here, and the
 * second case is what reconciliation is for.
 */
export function nextAttemptState(current: AttemptStatus, provider: ProviderStatus): AttemptStatus {
  if (current !== 'PENDING') return current;
  return provider;
}

/** Whether moving to this state is the moment the money is recorded. */
export function settlesMoney(current: AttemptStatus, next: AttemptStatus): boolean {
  return current === 'PENDING' && next === 'SUCCEEDED';
}

export type Difference = {
  attemptId: string;
  kind:
    | 'PROVIDER_PAID_NOT_RECORDED'
    | 'RECORDED_PROVIDER_NOT_PAID'
    | 'AMOUNT_DIFFERS'
    | 'CURRENCY_DIFFERS'
    | 'PROVIDER_UNKNOWN'
    | 'STILL_PENDING';
  message: string;
};

export type LocalAttempt = {
  id: string;
  providerRef: string;
  status: AttemptStatus;
  amountMinor: number;
  currency: string;
  /** The amount actually recorded as a Payment, or null when none was. */
  recordedMinor: number | null;
  createdAt: Date;
};

/**
 * The provider's record and ours, compared, with every difference named.
 *
 * The temptation is to trust the provider and overwrite; the rule is to
 * say what differs and let a person decide, because the ledger has already
 * been posted from our side and the provider may be the one that is wrong.
 */
export function reconcileAttempts(
  local: LocalAttempt[],
  provider: Map<string, ProviderRecord | null>,
  now = new Date(),
): Difference[] {
  const out: Difference[] = [];
  for (const ours of local) {
    const theirs = provider.get(ours.providerRef);
    if (theirs === undefined) continue;
    if (theirs === null) {
      out.push({
        attemptId: ours.id,
        kind: 'PROVIDER_UNKNOWN',
        message: `The provider has no record of ${ours.providerRef}.`,
      });
      continue;
    }
    if (theirs.currency !== ours.currency) {
      out.push({
        attemptId: ours.id,
        kind: 'CURRENCY_DIFFERS',
        message: `We recorded ${ours.currency}; the provider says ${theirs.currency}.`,
      });
      continue;
    }
    if (theirs.status === 'SUCCEEDED') {
      if (ours.recordedMinor === null) {
        out.push({
          attemptId: ours.id,
          kind: 'PROVIDER_PAID_NOT_RECORDED',
          message: `The provider says ${theirs.amountMinor} minor units were paid; nothing is recorded here.`,
        });
      } else if (ours.recordedMinor !== theirs.amountMinor) {
        out.push({
          attemptId: ours.id,
          kind: 'AMOUNT_DIFFERS',
          message: `We recorded ${ours.recordedMinor} minor units; the provider says ${theirs.amountMinor}.`,
        });
      }
      continue;
    }
    if (ours.recordedMinor !== null) {
      out.push({
        attemptId: ours.id,
        kind: 'RECORDED_PROVIDER_NOT_PAID',
        message: `We recorded ${ours.recordedMinor} minor units; the provider says ${theirs.status.toLowerCase()}.`,
      });
      continue;
    }
    if (theirs.status === 'PENDING' && ours.status === 'PENDING') {
      const ageHours = (now.getTime() - ours.createdAt.getTime()) / 3_600_000;
      if (ageHours >= 24) {
        out.push({
          attemptId: ours.id,
          kind: 'STILL_PENDING',
          message: `Started ${Math.floor(ageHours)} hours ago and the provider still says pending.`,
        });
      }
    }
  }
  return out;
}

/** Whether a refund by card can go back through the provider. */
export function assertRefundableThroughProvider(input: {
  succeededAttempts: { providerRef: string; amountMinor: number; refundedMinor: number }[];
  amountMinor: number;
}): { providerRef: string } {
  const room = input.succeededAttempts.find(
    (a) => a.amountMinor - a.refundedMinor >= input.amountMinor,
  );
  if (!room) {
    throw new PaymentAttemptError(
      'NO_CARD_PAYMENT',
      input.succeededAttempts.length === 0
        ? 'No card payment through the provider paid this invoice.'
        : 'No single card payment on this invoice has that much left to send back.',
    );
  }
  return { providerRef: room.providerRef };
}
