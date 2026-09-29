import { describe, expect, it } from 'vitest';

import {
  arrival,
  arrivesOn,
  gapsInOffers,
  isStale,
  KEEPS_ITS_WORD_PCT,
  promiseVersusRecord,
  rankOffers,
  PRICE_STALE_AFTER_DAYS,
  theChoice,
  type SupplierOffer,
} from './sourcing';

const now = new Date('2026-10-01T09:00:00Z');

function offer(over: Partial<SupplierOffer> & { supplierId: string }): SupplierOffer {
  return {
    supplierName: over.supplierId,
    price: 40,
    leadTimeDays: 1,
    inStock: true,
    warrantyMonths: 12,
    confirmedAt: now,
    ...over,
  };
}

describe('how old a price may be', () => {
  it('is fresh inside the quarter', () => {
    expect(isStale(offer({ supplierId: 'a', confirmedAt: new Date('2026-09-01') }), now)).toBe(
      false,
    );
  });

  it('is stale beyond it', () => {
    const old = new Date(now.getTime() - (PRICE_STALE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isStale(offer({ supplierId: 'a', confirmedAt: old }), now)).toBe(true);
  });
});

describe('when it arrives', () => {
  it('is today when it is on their shelf, whatever the lead time says', () => {
    const when = arrivesOn(offer({ supplierId: 'a', inStock: true, leadTimeDays: 5 }), now);
    expect(when?.toISOString()).toBe(now.toISOString());
  });

  it('is the lead time when it is not', () => {
    const when = arrivesOn(offer({ supplierId: 'a', inStock: false, leadTimeDays: 3 }), now);
    expect(when?.toISOString()).toBe('2026-10-04T09:00:00.000Z');
  });

  it('is unknown, not in time, when nobody has said', () => {
    const one = offer({ supplierId: 'a', leadTimeDays: null });
    expect(arrivesOn(one, now)).toBeNull();
    expect(arrival(one, now, new Date('2026-10-05'))).toBe('UNKNOWN');
  });

  it('is in time when there is no date to miss', () => {
    expect(arrival(offer({ supplierId: 'a' }), now, null)).toBe('IN_TIME');
  });

  it('is too late when it misses the promise', () => {
    const one = offer({ supplierId: 'a', inStock: false, leadTimeDays: 6 });
    expect(arrival(one, now, new Date('2026-10-03T17:00:00Z'))).toBe('TOO_LATE');
  });
});

describe('the ranking', () => {
  const neededBy = new Date('2026-10-03T17:00:00Z');

  it('puts the cheap one that arrives too late below the dear one that does not', () => {
    const ranked = rankOffers(
      [
        offer({ supplierId: 'cheap', price: 30, inStock: false, leadTimeDays: 9 }),
        offer({ supplierId: 'dear', price: 44, inStock: true }),
      ],
      { now, neededBy },
    );

    expect(ranked.map((one) => one.supplierId)).toEqual(['dear', 'cheap']);
    expect(ranked[1]?.arrival).toBe('TOO_LATE');
  });

  it('breaks a price tie on the longer warranty', () => {
    const ranked = rankOffers(
      [
        offer({ supplierId: 'short', warrantyMonths: 12 }),
        offer({ supplierId: 'long', warrantyMonths: 24 }),
      ],
      { now, neededBy },
    );

    expect(ranked[0]?.supplierId).toBe('long');
  });

  it('shows every offer, dropping none', () => {
    const ranked = rankOffers(
      ['a', 'b', 'c'].map((id) => offer({ supplierId: id })),
      { now, neededBy },
    );
    expect(ranked).toHaveLength(3);
  });

  it('puts an unknown delivery between in time and too late', () => {
    const ranked = rankOffers(
      [
        offer({ supplierId: 'late', price: 10, inStock: false, leadTimeDays: 30 }),
        offer({ supplierId: 'silent', price: 90, leadTimeDays: null }),
        offer({ supplierId: 'ready', price: 50, inStock: true }),
      ],
      { now, neededBy },
    );

    expect(ranked.map((one) => one.supplierId)).toEqual(['ready', 'silent', 'late']);
  });
});

describe('the choice, and the argument against it', () => {
  const neededBy = new Date('2026-10-03T17:00:00Z');

  it('names the cheaper one it passed over, and what it would have saved', () => {
    const choice = theChoice(
      [
        offer({
          supplierId: 'cheap',
          supplierName: 'Tholoway',
          price: 32.5,
          inStock: false,
          leadTimeDays: 9,
        }),
        offer({ supplierId: 'ready', supplierName: 'Deyne', price: 39.7, inStock: true }),
      ],
      { now, neededBy },
    );

    expect(choice?.pick.supplierName).toBe('Deyne');
    expect(choice?.cheaper?.supplierName).toBe('Tholoway');
    expect(choice?.passedOver).toBe('TOO_LATE');
    expect(choice?.saving).toBe(7.2);
  });

  it('has nothing to argue about when the cheapest also arrives', () => {
    const choice = theChoice(
      [
        offer({ supplierId: 'cheap', price: 30, inStock: true }),
        offer({ supplierId: 'dear', price: 60, inStock: true }),
      ],
      { now, neededBy },
    );

    expect(choice?.pick.supplierId).toBe('cheap');
    expect(choice?.cheaper).toBeNull();
    expect(choice?.saving).toBe(0);
  });

  it('is nothing at all when nobody sells it', () => {
    expect(theChoice([], { now })).toBeNull();
  });
});

describe('what the list does not answer', () => {
  it('says so when no supplier has priced it', () => {
    expect(gapsInOffers([], now)).toEqual(['no supplier priced']);
  });

  it('names each silence separately', () => {
    const gaps = gapsInOffers(
      [offer({ supplierId: 'a', leadTimeDays: null, inStock: null, warrantyMonths: null })],
      now,
    );
    expect(gaps).toEqual(['no delivery time', 'no stock answer', 'no warranty']);
  });

  it('closes a gap as soon as one supplier answers it', () => {
    const gaps = gapsInOffers(
      [
        offer({ supplierId: 'a', leadTimeDays: null, inStock: null, warrantyMonths: null }),
        offer({ supplierId: 'b', leadTimeDays: 2, inStock: true, warrantyMonths: 24 }),
      ],
      now,
    );
    expect(gaps).toEqual([]);
  });

  it('says when every price is old', () => {
    const old = new Date(now.getTime() - (PRICE_STALE_AFTER_DAYS + 5) * 24 * 60 * 60 * 1000);
    expect(gapsInOffers([offer({ supplierId: 'a', confirmedAt: old })], now)).toContain(
      'every price is old',
    );
  });
});

describe('what they say against what they have done', () => {
  it('has no verdict without enough orders behind it', () => {
    expect(promiseVersusRecord(null)).toBe('UNMEASURED');
  });

  it('says they keep their word at the line and above', () => {
    expect(promiseVersusRecord(KEEPS_ITS_WORD_PCT)).toBe('KEEPS');
    expect(promiseVersusRecord(98)).toBe('KEEPS');
  });

  it('says they slip below it', () => {
    expect(promiseVersusRecord(KEEPS_ITS_WORD_PCT - 0.1)).toBe('SLIPS');
    expect(promiseVersusRecord(0)).toBe('SLIPS');
  });
});
