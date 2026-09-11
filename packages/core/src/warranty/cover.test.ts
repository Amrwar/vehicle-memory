import { describe, expect, it } from 'vitest';

import {
  assertClaimable,
  type Cover,
  expiringWithin,
  positionFor,
  coverStatusOf,
  type WarrantyError,
} from './cover';

const NOW = new Date('2026-09-11T09:00:00');

function cover(overrides: Partial<Cover> = {}): Cover {
  return {
    id: 'w1',
    kind: 'PART',
    description: 'Front brake pads',
    startedOn: new Date('2026-03-11T09:00:00'),
    months: 12,
    km: null,
    startedAtKm: null,
    ...overrides,
  };
}

describe('whether cover still holds', () => {
  it('reports what is left while it runs', () => {
    const status = coverStatusOf(cover(), NOW, null);

    expect(status.state).toBe('ACTIVE');
    expect(status.active).toBe(true);
    expect(status.summary).toMatch(/Covered for another 181 days/);
  });

  it('runs out on time', () => {
    const status = coverStatusOf(cover({ startedOn: new Date('2025-03-11T09:00:00') }), NOW, null);

    expect(status.state).toBe('EXPIRED_BY_TIME');
    expect(status.summary).toMatch(/ran out on 11 March 2026/);
  });

  it('runs out on mileage even when the date is fine', () => {
    // A van reaches twenty thousand miles in five months, and a check that
    // only reads the calendar gives away a year of free parts.
    const status = coverStatusOf(cover({ km: 20_000, startedAtKm: 40_000 }), NOW, 62_000);

    expect(status.state).toBe('EXPIRED_BY_DISTANCE');
    expect(status.summary).toMatch(/by 2,000 miles/);
  });

  it('prefers the mileage answer when both have run out', () => {
    // It is the one the customer can check on the dashboard.
    const status = coverStatusOf(
      cover({ startedOn: new Date('2024-01-01T09:00:00'), km: 10_000, startedAtKm: 40_000 }),
      NOW,
      70_000,
    );

    expect(status.state).toBe('EXPIRED_BY_DISTANCE');
  });

  it('says nothing about mileage when there is no reading to measure from', () => {
    const status = coverStatusOf(cover({ km: 20_000, startedAtKm: null }), NOW, 62_000);

    expect(status.kmLeft).toBeNull();
    expect(status.state).toBe('ACTIVE');
  });

  it('honours a warranty somebody has voided', () => {
    const status = coverStatusOf(
      cover({ voidedReason: 'Fitted incorrectly by a third party' }),
      NOW,
      null,
    );

    expect(status.state).toBe('VOID');
    expect(status.summary).toMatch(/Fitted incorrectly/);
  });

  it('does not gain days at the end of a month', () => {
    // 31 January plus one month is 28 February, not 3 March.
    const status = coverStatusOf(
      cover({ startedOn: new Date('2026-01-31T09:00:00'), months: 1 }),
      new Date('2026-02-28T12:00:00'),
      null,
    );

    expect(status.expiresOn.getMonth()).toBe(1);
    expect(status.expiresOn.getDate()).toBe(28);
  });
});

describe('raising a claim', () => {
  const active = coverStatusOf(cover(), NOW, null);
  const expired = coverStatusOf(cover({ startedOn: new Date('2024-01-01T09:00:00') }), NOW, null);

  it('allows one against live cover', () => {
    expect(() => assertClaimable({ status: active, openClaims: 0 })).not.toThrow();
  });

  it('refuses a second claim while one is open', () => {
    expect(() => assertClaimable({ status: active, openClaims: 1 })).toThrow(/already an open/);
  });

  it('allows a goodwill claim on expired cover, if somebody says why', () => {
    // A workshop does settle these. The decision should be recorded rather
    // than hidden, and read later when the goodwill adds up.
    expect(() =>
      assertClaimable({ status: expired, openClaims: 0, reason: 'Long-standing fleet customer' }),
    ).not.toThrow();
  });

  it('refuses a goodwill claim with no reason', () => {
    expect(() => assertClaimable({ status: expired, openClaims: 0 })).toThrow(
      /somebody has to say why/,
    );
  });

  it('carries a code', () => {
    try {
      assertClaimable({ status: active, openClaims: 2 });
    } catch (error) {
      expect((error as WarrantyError).code).toBe('ALREADY_CLAIMED');
    }
  });
});

describe('who ends up paying', () => {
  const withSupplier = cover({ supplierName: 'Euro Car Parts', supplierMonths: 24 });

  it('separates what can be recovered from what cannot', () => {
    // A supplier warrants the component and never the hour spent refitting it.
    const position = positionFor({
      cover: withSupplier,
      status: coverStatusOf(withSupplier, NOW, null),
      partsValue: 140,
      labourValue: 60,
      now: NOW,
    });

    expect(position.recoverable).toBe(140);
    expect(position.exposure).toBe(60);
    expect(position.supplierStillCovers).toBe(true);
  });

  it('says plainly when the supplier is still on the hook', () => {
    const position = positionFor({
      cover: withSupplier,
      status: coverStatusOf(withSupplier, NOW, null),
      partsValue: 140,
      labourValue: 60,
      now: NOW,
    });

    expect(position.note).toMatch(/Claim it back rather than absorbing it/);
  });

  it('puts everything on the workshop once the supplier has run out', () => {
    const lapsed = cover({ supplierName: 'Euro Car Parts', supplierMonths: 3 });

    const position = positionFor({
      cover: lapsed,
      status: coverStatusOf(lapsed, NOW, null),
      partsValue: 140,
      labourValue: 60,
      now: NOW,
    });

    expect(position.recoverable).toBe(0);
    expect(position.exposure).toBe(200);
    expect(position.note).toMatch(/has run out/);
  });

  it('says so when no supplier warranty was ever recorded', () => {
    const position = positionFor({
      cover: cover(),
      status: coverStatusOf(cover(), NOW, null),
      partsValue: 100,
      labourValue: 0,
      now: NOW,
    });

    expect(position.note).toMatch(/No supplier warranty recorded/);
  });
});

describe('cover worth chasing', () => {
  it('lists what runs out soonest first, and ignores what already has', () => {
    const soon = cover({ id: 'soon', startedOn: new Date('2025-10-01T09:00:00') });
    const later = cover({ id: 'later', startedOn: new Date('2026-06-01T09:00:00') });
    const gone = cover({ id: 'gone', startedOn: new Date('2024-01-01T09:00:00') });

    const found = expiringWithin(
      [soon, later, gone].map((entry) => ({
        cover: entry,
        status: coverStatusOf(entry, NOW, null),
      })),
      90,
    );

    expect(found.map((entry) => entry.cover.id)).toEqual(['soon']);
  });
});
