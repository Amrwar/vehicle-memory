import { describe, expect, it } from 'vitest';

import {
  assertCardAdjustable,
  assertCardRedeemable,
  assertCardSellable,
  formatGiftCode,
  GIFT_CARD_MAX_MINOR,
  GIFT_CARD_MIN_MINOR,
  giftCardBalance,
  giftCardCode,
  GiftCardError,
  giftCardExpiry,
  giftCardStatus,
  looksLikeGiftCode,
  normaliseGiftCode,
} from './giftcards';

const at = (iso: string) => new Date(`${iso}T09:00:00`);
const NOW = at('2026-09-14');

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

describe('giftCardStatus', () => {
  it('is active with money on it and nothing wrong', () => {
    expect(giftCardStatus({ balanceMinor: 100, expiresAt: null, disabledAt: null }, NOW)).toBe(
      'ACTIVE',
    );
  });

  it('is depleted when spent, expired when lapsed, disabled when cancelled', () => {
    expect(giftCardStatus({ balanceMinor: 0, expiresAt: null, disabledAt: null }, NOW)).toBe(
      'DEPLETED',
    );
    expect(
      giftCardStatus({ balanceMinor: 100, expiresAt: at('2026-09-01'), disabledAt: null }, NOW),
    ).toBe('EXPIRED');
    expect(
      giftCardStatus({ balanceMinor: 100, expiresAt: null, disabledAt: at('2026-09-02') }, NOW),
    ).toBe('DISABLED');
  });

  // A cancelled card with money on it is still cancelled; an empty expired
  // card cannot be topped up back to life.
  it('ranks cancelled over lapsed over spent', () => {
    expect(
      giftCardStatus(
        { balanceMinor: 0, expiresAt: at('2026-01-01'), disabledAt: at('2026-02-01') },
        NOW,
      ),
    ).toBe('DISABLED');
    expect(
      giftCardStatus({ balanceMinor: 0, expiresAt: at('2026-01-01'), disabledAt: null }, NOW),
    ).toBe('EXPIRED');
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
    expect(giftCardCode(walk)).not.toMatch(/[AEIOU01S5]/);
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

  it('accepts the terms offered and refuses others', () => {
    expect(() =>
      assertCardSellable({ amountMinor: 5_000, method: 'CARD', termMonths: 12 }),
    ).not.toThrow();
    expect(() =>
      assertCardSellable({ amountMinor: 5_000, method: 'CARD', termMonths: null }),
    ).not.toThrow();
    expect(() => assertCardSellable({ amountMinor: 5_000, method: 'CARD', termMonths: 7 })).toThrow(
      /a year, two years/,
    );
  });
});

describe('giftCardExpiry', () => {
  it('is null for good, and the term from the sale otherwise', () => {
    expect(giftCardExpiry(null, NOW)).toBeNull();
    expect(giftCardExpiry(12, NOW)?.toISOString().slice(0, 10)).toBe('2027-09-14');
    expect(giftCardExpiry(24, NOW)?.toISOString().slice(0, 10)).toBe('2028-09-14');
  });
});

describe('assertCardRedeemable', () => {
  const live = {
    balanceMinor: 4_000,
    owedMinor: 10_000,
    disabledAt: null,
    expiresAt: null,
    now: NOW,
  };

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

  it('refuses an empty card, a cancelled card, a lapsed card and a settled bill', () => {
    expect(() => assertCardRedeemable({ ...live, balanceMinor: 0, amountMinor: null })).toThrow(
      /nothing left/,
    );
    expect(() =>
      assertCardRedeemable({ ...live, disabledAt: at('2026-09-01'), amountMinor: null }),
    ).toThrow(/cancelled/);
    expect(() =>
      assertCardRedeemable({ ...live, expiresAt: at('2026-09-01'), amountMinor: null }),
    ).toThrow(/lapsed/);
    expect(() =>
      assertCardRedeemable({ ...live, expiresAt: at('2027-09-01'), amountMinor: null }),
    ).not.toThrow();
    expect(() => assertCardRedeemable({ ...live, owedMinor: 0, amountMinor: null })).toThrow(
      /Nothing is owed/,
    );
  });

  it('refuses a card at the wrong site, and allows one good everywhere', () => {
    expect(() =>
      assertCardRedeemable({ ...live, amountMinor: null, cardLocationId: 'a', atLocationId: 'b' }),
    ).toThrow(/another site/);
    expect(() =>
      assertCardRedeemable({ ...live, amountMinor: null, cardLocationId: 'a', atLocationId: 'a' }),
    ).not.toThrow();
    expect(() =>
      assertCardRedeemable({ ...live, amountMinor: null, cardLocationId: null, atLocationId: 'b' }),
    ).not.toThrow();
  });

  it('refuses nothing and fractions', () => {
    expect(() => assertCardRedeemable({ ...live, amountMinor: 0 })).toThrow(GiftCardError);
    expect(() => assertCardRedeemable({ ...live, amountMinor: 12.5 })).toThrow(GiftCardError);
  });
});

describe('assertCardAdjustable', () => {
  const card = { balanceMinor: 2_000, disabledAt: null };

  it('allows a change with a reason that keeps the card at or above nothing', () => {
    expect(() =>
      assertCardAdjustable({ ...card, amountMinor: 500, reason: 'Goodwill' }),
    ).not.toThrow();
    expect(() =>
      assertCardAdjustable({ ...card, amountMinor: -2_000, reason: 'Sold in error' }),
    ).not.toThrow();
  });

  it('refuses nothing, no reason, below zero, and a cancelled card', () => {
    expect(() => assertCardAdjustable({ ...card, amountMinor: 0, reason: 'x' })).toThrow(
      /how much/,
    );
    expect(() => assertCardAdjustable({ ...card, amountMinor: 100, reason: '  ' })).toThrow(
      /Say why/,
    );
    expect(() => assertCardAdjustable({ ...card, amountMinor: -2_001, reason: 'x' })).toThrow(
      /below nothing/,
    );
    expect(() =>
      assertCardAdjustable({ ...card, disabledAt: NOW, amountMinor: 100, reason: 'x' }),
    ).toThrow(/cancelled/);
  });
});
