import { describe, expect, it } from 'vitest';

import {
  assertAttemptCreatable,
  assertRefundableThroughProvider,
  nextAttemptState,
  PaymentAttemptError,
  reconcileAttempts,
  settlesMoney,
} from './attempts';

const code = (run: () => unknown) => {
  try {
    run();
    return 'went ahead';
  } catch (error) {
    return error instanceof PaymentAttemptError ? error.code : String(error);
  }
};

describe('assertAttemptCreatable', () => {
  it('takes an open invoice for up to what is owed', () => {
    expect(
      code(() =>
        assertAttemptCreatable({
          invoiceStatus: 'ISSUED',
          outstandingMinor: 5000,
          amountMinor: 5000,
        }),
      ),
    ).toBe('went ahead');
    expect(
      code(() =>
        assertAttemptCreatable({
          invoiceStatus: 'PART_PAID',
          outstandingMinor: 5000,
          amountMinor: 100,
        }),
      ),
    ).toBe('went ahead');
    expect(
      code(() =>
        assertAttemptCreatable({
          invoiceStatus: 'OVERDUE',
          outstandingMinor: 5000,
          amountMinor: 100,
        }),
      ),
    ).toBe('went ahead');
  });

  it('refuses a paid, draft or void invoice, and says which', () => {
    expect(
      code(() =>
        assertAttemptCreatable({ invoiceStatus: 'PAID', outstandingMinor: 0, amountMinor: 1 }),
      ),
    ).toBe('NOT_PAYABLE');
    expect(
      code(() =>
        assertAttemptCreatable({ invoiceStatus: 'DRAFT', outstandingMinor: 100, amountMinor: 1 }),
      ),
    ).toBe('NOT_PAYABLE');
    expect(
      code(() =>
        assertAttemptCreatable({ invoiceStatus: 'VOID', outstandingMinor: 100, amountMinor: 1 }),
      ),
    ).toBe('NOT_PAYABLE');
  });

  it('refuses nothing, and more than is owed, rather than clamping', () => {
    expect(
      code(() =>
        assertAttemptCreatable({ invoiceStatus: 'ISSUED', outstandingMinor: 100, amountMinor: 0 }),
      ),
    ).toBe('ZERO');
    expect(
      code(() =>
        assertAttemptCreatable({
          invoiceStatus: 'ISSUED',
          outstandingMinor: 100,
          amountMinor: 101,
        }),
      ),
    ).toBe('OVER');
    expect(
      code(() =>
        assertAttemptCreatable({ invoiceStatus: 'ISSUED', outstandingMinor: 0, amountMinor: 1 }),
      ),
    ).toBe('NOTHING_OWED');
  });
});

describe('nextAttemptState', () => {
  it('moves once from pending and never back', () => {
    expect(nextAttemptState('PENDING', 'SUCCEEDED')).toBe('SUCCEEDED');
    expect(nextAttemptState('PENDING', 'FAILED')).toBe('FAILED');
    expect(nextAttemptState('SUCCEEDED', 'FAILED')).toBe('SUCCEEDED');
    expect(nextAttemptState('FAILED', 'SUCCEEDED')).toBe('FAILED');
    expect(nextAttemptState('CANCELLED', 'SUCCEEDED')).toBe('CANCELLED');
  });

  it('records the money exactly at the move to succeeded', () => {
    expect(settlesMoney('PENDING', 'SUCCEEDED')).toBe(true);
    expect(settlesMoney('SUCCEEDED', 'SUCCEEDED')).toBe(false);
    expect(settlesMoney('PENDING', 'FAILED')).toBe(false);
  });
});

describe('reconcileAttempts', () => {
  const base = {
    id: 'a1',
    providerRef: 'ref_1',
    status: 'SUCCEEDED' as const,
    amountMinor: 5000,
    currency: 'GBP',
    recordedMinor: 5000,
    createdAt: new Date('2026-09-14T09:00:00Z'),
  };
  const theirs = {
    providerRef: 'ref_1',
    status: 'SUCCEEDED' as const,
    amountMinor: 5000,
    currency: 'GBP',
  };

  it('is silent when both agree', () => {
    expect(reconcileAttempts([base], new Map([['ref_1', theirs]]))).toEqual([]);
  });

  it('names money the provider took that we never recorded', () => {
    const out = reconcileAttempts(
      [{ ...base, status: 'PENDING', recordedMinor: null }],
      new Map([['ref_1', theirs]]),
    );
    expect(out.map((d) => d.kind)).toEqual(['PROVIDER_PAID_NOT_RECORDED']);
  });

  it('names money we recorded that the provider says failed', () => {
    const out = reconcileAttempts([base], new Map([['ref_1', { ...theirs, status: 'FAILED' }]]));
    expect(out.map((d) => d.kind)).toEqual(['RECORDED_PROVIDER_NOT_PAID']);
  });

  it('names an amount or a currency that differs, and a record the provider lacks', () => {
    expect(
      reconcileAttempts([base], new Map([['ref_1', { ...theirs, amountMinor: 4900 }]]))[0]!.kind,
    ).toBe('AMOUNT_DIFFERS');
    expect(
      reconcileAttempts([base], new Map([['ref_1', { ...theirs, currency: 'EUR' }]]))[0]!.kind,
    ).toBe('CURRENCY_DIFFERS');
    expect(reconcileAttempts([base], new Map([['ref_1', null]]))[0]!.kind).toBe('PROVIDER_UNKNOWN');
  });

  it('flags a payment pending for a day, and not one pending for an hour', () => {
    const pending = { ...base, status: 'PENDING' as const, recordedMinor: null };
    const them = new Map([['ref_1', { ...theirs, status: 'PENDING' as const }]]);
    expect(reconcileAttempts([pending], them, new Date('2026-09-14T10:00:00Z'))).toEqual([]);
    expect(reconcileAttempts([pending], them, new Date('2026-09-16T10:00:00Z'))[0]!.kind).toBe(
      'STILL_PENDING',
    );
  });
});

describe('assertRefundableThroughProvider', () => {
  it('picks a card payment with enough left on it', () => {
    expect(
      assertRefundableThroughProvider({
        succeededAttempts: [
          { providerRef: 'a', amountMinor: 1000, refundedMinor: 900 },
          { providerRef: 'b', amountMinor: 4000, refundedMinor: 0 },
        ],
        amountMinor: 500,
      }),
    ).toEqual({ providerRef: 'b' });
  });

  it('refuses when nothing through the provider paid the bill, or nothing has that much left', () => {
    expect(
      code(() => assertRefundableThroughProvider({ succeededAttempts: [], amountMinor: 1 })),
    ).toBe('NO_CARD_PAYMENT');
    expect(
      code(() =>
        assertRefundableThroughProvider({
          succeededAttempts: [{ providerRef: 'a', amountMinor: 1000, refundedMinor: 900 }],
          amountMinor: 500,
        }),
      ),
    ).toBe('NO_CARD_PAYMENT');
  });
});
