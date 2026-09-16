import { describe, expect, it } from 'vitest';

import {
  assertDeclared,
  assertShippable,
  describeRepeat,
  keyExpiry,
  repeatKey,
  RepeatError,
  repeatTally,
  type WriteSafety,
} from './repeat';

const guarded: WriteSafety = {
  name: 'redeemAgainstInvoice()',
  where: 'apps/web/src/lib/coupons.ts',
  repeat: 'GUARDED',
  guard: { kind: 'CONSTRAINT', named: 'coupon_redemptions_one_per_invoice' },
  says: 'The second one is refused by the database before any money moves.',
};

describe('declaring what a repeat does', () => {
  it('takes a write that names its guard', () => {
    expect(() => assertDeclared(guarded)).not.toThrow();
  });

  it('refuses a guard nobody can point at', () => {
    expect(() =>
      assertDeclared({ ...guarded, guard: { kind: 'CONSTRAINT', named: '  ' } }),
    ).toThrowError(RepeatError);
  });

  it('refuses a sentence that says nothing', () => {
    expect(() => assertDeclared({ ...guarded, says: 'Fine.' })).toThrowError(/act on/);
  });

  it('refuses a constraint named by a write that claims to be harmless', () => {
    expect(() => assertDeclared({ ...guarded, repeat: 'HARMLESS' })).toThrowError(
      /guarded, not harmless/,
    );
  });

  it('lets a harmless write say it is a set rather than a change', () => {
    expect(() =>
      assertDeclared({
        ...guarded,
        repeat: 'HARMLESS',
        guard: { kind: 'OVERWRITE', named: 'the state asked for' },
      }),
    ).not.toThrow();
  });

  it('refuses a guard on a write that says it would repeat anyway', () => {
    expect(() => assertDeclared({ ...guarded, repeat: 'ONE_ONLY' })).toThrowError(
      /One of the two is wrong/,
    );
  });
});

describe('what may ship', () => {
  it('lets through a register with nothing open', () => {
    expect(() =>
      assertShippable([
        guarded,
        {
          name: 'markRead()',
          where: 'apps/web/src/lib/messages.ts',
          repeat: 'HARMLESS',
          says: 'Marking a read message read leaves it exactly as it was.',
        },
      ]),
    ).not.toThrow();
  });

  it('names every write that would do it again', () => {
    expect(() =>
      assertShippable([
        guarded,
        {
          name: 'takeMoney()',
          where: 'nowhere good',
          repeat: 'ONE_ONLY',
          says: 'The second one takes the money a second time, which is the whole problem.',
        },
      ]),
    ).toThrowError(/takeMoney\(\)/);
  });
});

describe('reading the register', () => {
  it('says what stopped the second one', () => {
    expect(describeRepeat(guarded)).toContain('refused by coupon_redemptions_one_per_invoice');
  });

  it('marks an open one as not safe', () => {
    expect(
      describeRepeat({
        name: 'takeMoney()',
        where: 'x',
        repeat: 'ONE_ONLY',
        says: 'It would take the money twice, which is the whole problem.',
      }),
    ).toContain('NOT SAFE');
  });

  it('counts what the register is made of', () => {
    const tally = repeatTally([guarded, { ...guarded, name: 'other()' }]);
    expect(tally.total).toBe(2);
    expect(tally.guarded).toBe(2);
    expect(tally.open).toBe(0);
    expect(tally.byGuard.CONSTRAINT).toBe(2);
  });
});

describe('the key a repeat is recognised by', () => {
  it('is the same for two attempts at one thing', () => {
    expect(repeatKey(['payment', 'inv_1', 2400])).toBe(repeatKey(['payment', 'inv_1', 2400]));
  });

  it('ignores the gaps somebody left in it', () => {
    expect(repeatKey(['payment', null, 'inv_1', undefined])).toBe('payment:inv_1');
  });

  it('refuses a key with nothing to recognise', () => {
    expect(() => repeatKey([null, ''])).toThrowError(RepeatError);
  });

  it('outlasts a provider that retries for days', () => {
    const at = new Date('2026-09-16T00:00:00.000Z');
    expect(keyExpiry(at).getTime() - at.getTime()).toBeGreaterThan(7 * 86_400_000);
  });
});
