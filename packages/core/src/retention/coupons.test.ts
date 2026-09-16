import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  assertCouponSaveable,
  type Coupon,
  couponDiscount,
  couponResults,
  couponState,
  describeCoupon,
  normaliseCouponCode,
} from './coupons';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');
const now = new Date('2026-09-16T10:00:00Z');

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: 'c1',
  code: 'SPRING20',
  kind: 'PERCENT',
  percent: 20,
  amount: gbp(0),
  minSpend: null,
  startsOn: null,
  endsOn: null,
  maxRedemptions: null,
  perCustomer: 1,
  redeemed: 0,
  isActive: true,
  ...over,
});

describe('a code as it is written and as it is typed', () => {
  it('reads the same however somebody writes it down', () => {
    expect(normaliseCouponCode('spring-20')).toBe('SPRING20');
    expect(normaliseCouponCode(' Spring 20 ')).toBe('SPRING20');
    expect(normaliseCouponCode('SPRING20')).toBe('SPRING20');
  });

  it('refuses what nobody could use', () => {
    const saveable = {
      code: 'SPRING20',
      kind: 'PERCENT' as const,
      percent: 20,
      amount: gbp(0),
      minSpend: null,
      startsOn: null,
      endsOn: null,
      maxRedemptions: null,
      perCustomer: 1,
    };

    expect(() => assertCouponSaveable(saveable)).not.toThrow();
    expect(() => assertCouponSaveable({ ...saveable, code: 'AB' })).toThrow(/three letters/);
    expect(() => assertCouponSaveable({ ...saveable, percent: 0 })).toThrow(/more than nothing/);
    expect(() => assertCouponSaveable({ ...saveable, percent: 120 })).toThrow(/hundred/);
    expect(() => assertCouponSaveable({ ...saveable, kind: 'AMOUNT', amount: gbp(0) })).toThrow(
      /more than nothing/,
    );
    expect(() =>
      assertCouponSaveable({
        ...saveable,
        startsOn: new Date('2026-10-01'),
        endsOn: new Date('2026-09-01'),
      }),
    ).toThrow(/wrong way round/);
    expect(() => assertCouponSaveable({ ...saveable, maxRedemptions: 0 })).toThrow(/whole number/);
    expect(() => assertCouponSaveable({ ...saveable, perCustomer: 0 })).toThrow(/at least once/);
  });
});

describe('where a coupon stands', () => {
  it('is read against the clock rather than stored', () => {
    expect(couponState(coupon(), now)).toBe('ACTIVE');
    expect(couponState(coupon({ isActive: false }), now)).toBe('RETIRED');
    expect(couponState(coupon({ startsOn: new Date('2026-10-01') }), now)).toBe('NOT_YET');
    expect(couponState(coupon({ endsOn: new Date('2026-08-31') }), now)).toBe('ENDED');
    expect(couponState(coupon({ maxRedemptions: 5, redeemed: 5 }), now)).toBe('USED_UP');
  });
});

describe('what a code takes off a bill', () => {
  it('takes a percentage or an amount', () => {
    expect(couponDiscount({ coupon: coupon(), bill: gbp(250), now }).minor).toBe(5000);
    expect(
      couponDiscount({ coupon: coupon({ kind: 'AMOUNT', amount: gbp(25) }), bill: gbp(250), now })
        .minor,
    ).toBe(2500);
  });

  it('never gives back more than is owed', () => {
    expect(
      couponDiscount({
        coupon: coupon({ kind: 'AMOUNT', amount: gbp(100) }),
        bill: gbp(250),
        owed: gbp(40),
        now,
      }).minor,
    ).toBe(4000);
  });

  it('refuses with a sentence that says what happened', () => {
    expect(() =>
      couponDiscount({ coupon: coupon({ endsOn: new Date('2026-06-30') }), bill: gbp(250), now }),
    ).toThrow(/ran out on 30 June 2026/);
    expect(() =>
      couponDiscount({ coupon: coupon({ startsOn: new Date('2026-12-01') }), bill: gbp(250), now }),
    ).toThrow(/starts on 1 December 2026/);
    expect(() =>
      couponDiscount({ coupon: coupon({ minSpend: gbp(300) }), bill: gbp(250), now }),
    ).toThrow(/needs a bill of £300.00 or more. This one is £250.00/);
    expect(() =>
      couponDiscount({ coupon: coupon(), bill: gbp(250), usedByCustomer: 1, now }),
    ).toThrow(/one to a customer/);
    expect(() =>
      couponDiscount({ coupon: coupon({ maxRedemptions: 2, redeemed: 2 }), bill: gbp(250), now }),
    ).toThrow(/used its 2 times/);
    expect(() =>
      couponDiscount({ coupon: coupon({ isActive: false }), bill: gbp(250), now }),
    ).toThrow(/no longer being honoured/);
    expect(() => couponDiscount({ coupon: coupon(), bill: gbp(250), owed: gbp(0), now })).toThrow(
      /Nothing is owed/,
    );
  });
});

describe('how a coupon reads', () => {
  it('says what it is worth and what it asks for', () => {
    expect(
      describeCoupon(coupon({ minSpend: gbp(150), endsOn: new Date('2026-12-31') }), now),
    ).toBe('20% off, bills over £150.00, until 31 December.');
    expect(describeCoupon(coupon({ maxRedemptions: 10, redeemed: 9 }), now)).toBe(
      '20% off, 1 use left.',
    );
    expect(describeCoupon(coupon({ kind: 'AMOUNT', amount: gbp(25), isActive: false }), now)).toBe(
      '£25.00 off. Retired.',
    );
  });

  it('adds up what the codes gave away and what they brought in', () => {
    const results = couponResults([
      { code: 'SPRING20', given: gbp(50), billed: gbp(250) },
      { code: 'SPRING20', given: gbp(30), billed: gbp(150) },
      { code: 'WINTER10', given: gbp(10), billed: gbp(100) },
    ]);

    expect(results[0]).toMatchObject({ code: 'SPRING20', redemptions: 2 });
    expect(results[0]?.given.minor).toBe(8000);
    expect(results[0]?.billed.minor).toBe(40000);
    expect(results[1]?.code).toBe('WINTER10');
  });
});
