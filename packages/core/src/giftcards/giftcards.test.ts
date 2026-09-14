import { describe, expect, it } from 'vitest';

import {
  assertCardRedeemable,
  assertCardSellable,
  formatGiftCode,
  GIFT_CARD_MAX_MINOR,
  GIFT_CARD_MIN_MINOR,
  giftCardBalance,
  giftCardCode,
  GiftCardError,
  looksLikeGiftCode,
  normaliseGiftCode,
} from './giftcards';

describe('giftCardBalance', () => {
  it('is the sum of the entries, loads and spends together', () => {
    expect(
      giftCardBalance([{ amountMinor: 5_000 }, { amountMinor: -1_250 }, { amountMinor: -750 }]),
    ).toBe(3_000);
  });

  it('is nothing with no entries', () => {
    expect(giftCardBalance([])).toBe(0);
  });
});

describe('giftCardCode', () => {
  it('is twelve characters from the safe alphabet', () => {
    const code = giftCardCode();
    expect(code).toHaveLength(12);
    expect(looksLikeGiftCode(code)).toBe(true);
  });

  it('never contains the characters that get misread', () => {
    let counter = 0;
    const walk = () => {
      counter = (counter + 7) % 101;
      return counter / 101;
    };
    const code = giftCardCode(walk);
    expect(code).not.toMatch(/[AEIOU01S5]/);
  });

  it('is read in groups of four and stored without them', () => {
    expect(formatGiftCode('BCDFGHJKLMNP')).toBe('BCDF-GHJK-LMNP');
    expect(normaliseGiftCode(' bcdf-ghjk lmnp ')).toBe('BCDFGHJKLMNP');
  });

  it('knows what could not be one of ours', () => {
    expect(looksLikeGiftCode('BCDF-GHJK-LMNP')).toBe(true);
    expect(looksLikeGiftCode('BCDFGHJKLMN')).toBe(false);
    expect(looksLikeGiftCode('BCDFGHJKLMNO')).toBe(false);
    expect(looksLikeGiftCode('hello there!')).toBe(false);
  });
});

describe('assertCardSellable', () => {
  it('sells whole pounds between the limits', () => {
    expect(() => assertCardSellable({ amountMinor: 5_000, method: 'CARD' })).not.toThrow();
    expect(() =>
      assertCardSellable({ amountMinor: GIFT_CARD_MIN_MINOR, method: 'CASH' }),
    ).not.toThrow();
    expect(() =>
      assertCardSellable({ amountMinor: GIFT_CARD_MAX_MINOR, method: 'BANK_TRANSFER' }),
    ).not.toThrow();
  });

  it('refuses pence', () => {
    expect(() => assertCardSellable({ amountMinor: 5_050, method: 'CARD' })).toThrow(GiftCardError);
  });

  it('refuses too little and too much', () => {
    expect(() =>
      assertCardSellable({ amountMinor: GIFT_CARD_MIN_MINOR - 100, method: 'CARD' }),
    ).toThrow(/smallest/);
    expect(() =>
      assertCardSellable({ amountMinor: GIFT_CARD_MAX_MINOR + 100, method: 'CARD' }),
    ).toThrow(/largest/);
  });

  // A card bought with points would turn points into money, and a card bought
  // with a card would be a liability paid for with a liability.
  it('refuses points and other cards as payment', () => {
    expect(() => assertCardSellable({ amountMinor: 5_000, method: 'LOYALTY' })).toThrow(/points/);
    expect(() => assertCardSellable({ amountMinor: 5_000, method: 'GIFT_CARD' })).toThrow(/points/);
  });
});

describe('assertCardRedeemable', () => {
  const live = { balanceMinor: 4_000, owedMinor: 10_000, voided: false };

  it('uses what was asked for', () => {
    expect(assertCardRedeemable({ ...live, amountMinor: 1_500 })).toBe(1_500);
  });

  it('uses as much as the bill needs when nothing was asked for', () => {
    expect(assertCardRedeemable({ ...live, amountMinor: null })).toBe(4_000);
    expect(assertCardRedeemable({ ...live, owedMinor: 2_500, amountMinor: null })).toBe(2_500);
  });

  it('refuses more than is on the card, rather than clamping', () => {
    expect(() => assertCardRedeemable({ ...live, amountMinor: 4_001 })).toThrow(
      /left on that card/,
    );
  });

  it('refuses more than the bill, because a card does not pay out', () => {
    expect(() => assertCardRedeemable({ ...live, owedMinor: 1_000, amountMinor: 2_000 })).toThrow(
      /more than the bill/,
    );
  });

  it('refuses an empty card, a cancelled card, and a settled bill', () => {
    expect(() => assertCardRedeemable({ ...live, balanceMinor: 0, amountMinor: null })).toThrow(
      /nothing left/,
    );
    expect(() => assertCardRedeemable({ ...live, voided: true, amountMinor: null })).toThrow(
      /cancelled/,
    );
    expect(() => assertCardRedeemable({ ...live, owedMinor: 0, amountMinor: null })).toThrow(
      /Nothing is owed/,
    );
  });

  it('refuses nothing and fractions', () => {
    expect(() => assertCardRedeemable({ ...live, amountMinor: 0 })).toThrow(GiftCardError);
    expect(() => assertCardRedeemable({ ...live, amountMinor: 12.5 })).toThrow(GiftCardError);
  });
});
