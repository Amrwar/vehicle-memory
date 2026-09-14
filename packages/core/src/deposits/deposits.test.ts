import { describe, expect, it } from 'vitest';

import {
  assertDepositApplicable,
  assertDepositReturnable,
  assertDepositTakeable,
  DepositError,
  depositStatus,
  heldOn,
} from './deposits';

describe('assertDepositTakeable', () => {
  it('takes money, in any of the ways money arrives', () => {
    for (const method of ['CARD', 'CASH', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE']) {
      expect(() => assertDepositTakeable({ amountMinor: 20_000, method })).not.toThrow();
    }
  });

  it('refuses nothing, and refuses tenders that are not money in', () => {
    expect(() => assertDepositTakeable({ amountMinor: 0, method: 'CARD' })).toThrow(DepositError);
    expect(() => assertDepositTakeable({ amountMinor: 12.5, method: 'CARD' })).toThrow(
      DepositError,
    );
    for (const method of ['LOYALTY', 'GIFT_CARD', 'DEPOSIT', 'ACCOUNT']) {
      expect(() => assertDepositTakeable({ amountMinor: 20_000, method })).toThrow(/hands over/);
    }
  });
});

describe('heldOn and depositStatus', () => {
  it('is what came in less what went against bills or back', () => {
    expect(heldOn({ amountMinor: 20_000, appliedMinor: 5_000, refundedMinor: 1_000 })).toBe(14_000);
  });

  it('reads the status from the figures', () => {
    expect(depositStatus({ amountMinor: 20_000, appliedMinor: 0, refundedMinor: 0 })).toBe('HELD');
    expect(depositStatus({ amountMinor: 20_000, appliedMinor: 5_000, refundedMinor: 0 })).toBe(
      'PART_USED',
    );
    expect(depositStatus({ amountMinor: 20_000, appliedMinor: 20_000, refundedMinor: 0 })).toBe(
      'USED',
    );
    expect(depositStatus({ amountMinor: 20_000, appliedMinor: 0, refundedMinor: 20_000 })).toBe(
      'RETURNED',
    );
    expect(depositStatus({ amountMinor: 20_000, appliedMinor: 15_000, refundedMinor: 5_000 })).toBe(
      'USED',
    );
  });
});

describe('assertDepositApplicable', () => {
  it('uses what was asked for, or as much as the bill needs', () => {
    expect(
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: 5_000, owedMinor: 30_000 }),
    ).toBe(5_000);
    expect(
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: null, owedMinor: 30_000 }),
    ).toBe(20_000);
    expect(
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: null, owedMinor: 8_000 }),
    ).toBe(8_000);
  });

  it('refuses more than is held, more than is owed, nothing held, nothing owed', () => {
    expect(() =>
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: 20_001, owedMinor: 30_000 }),
    ).toThrow(/is held/);
    expect(() =>
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: 9_000, owedMinor: 8_000 }),
    ).toThrow(/more than the bill/);
    expect(() =>
      assertDepositApplicable({ heldMinor: 0, amountMinor: null, owedMinor: 8_000 }),
    ).toThrow(/Nothing is held/);
    expect(() =>
      assertDepositApplicable({ heldMinor: 20_000, amountMinor: null, owedMinor: 0 }),
    ).toThrow(/Nothing is owed/);
  });
});

describe('assertDepositReturnable', () => {
  const held = { heldMinor: 20_000, method: 'BANK_TRANSFER', reason: 'Order cancelled' };

  it('returns up to what is held, with a reason, as money', () => {
    expect(() => assertDepositReturnable({ ...held, amountMinor: 20_000 })).not.toThrow();
    expect(() => assertDepositReturnable({ ...held, amountMinor: 20_001 })).toThrow(/Return that/);
    expect(() => assertDepositReturnable({ ...held, amountMinor: 100, reason: ' ' })).toThrow(
      /Say why/,
    );
    expect(() => assertDepositReturnable({ ...held, amountMinor: 100, method: 'LOYALTY' })).toThrow(
      /the way money goes/,
    );
  });
});
