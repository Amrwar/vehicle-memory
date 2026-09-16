import { describe, expect, it } from 'vitest';

import {
  assertHandoverAcceptable,
  assertHandoverInvitable,
  describeHandover,
  handoverState,
} from './invitation';
import { type Ownership } from './transfer';

const seller: Ownership = {
  id: 'own-1',
  ownerName: 'Maria Costa',
  ownerKind: 'PRIVATE',
  startedAt: new Date('2023-04-01T09:00:00Z'),
  endedAt: null,
};

const now = new Date('2026-09-15T10:00:00Z');

const invite = (over: Partial<Parameters<typeof assertHandoverInvitable>[0]> = {}) =>
  assertHandoverInvitable({
    current: seller,
    toName: 'Tom Hargreaves',
    toKind: 'PRIVATE',
    on: new Date('2026-09-14T09:00:00Z'),
    openJobs: 0,
    pending: 0,
    now,
    ...over,
  });

describe('inviting a buyer', () => {
  it('applies every rule that recording a transfer applies', () => {
    expect(() => invite()).not.toThrow();
    expect(() => invite({ toName: ' ' })).toThrow(/Say who the vehicle is going to/);
    expect(() => invite({ current: null })).toThrow(/no current owner/);
    expect(() => invite({ toName: 'maria costa' })).toThrow(/same owner/);
    expect(() => invite({ on: new Date('2026-12-01') })).toThrow(/in the future/);
    expect(() => invite({ openJobs: 2 })).toThrow(/2 open jobs/);
    expect(() => invite({ openJobs: 2, force: true })).not.toThrow();
  });

  it('refuses a second invitation while one is standing', () => {
    expect(() => invite({ pending: 1 })).toThrow(/already has a handover waiting/);
  });
});

describe('the state of an invitation', () => {
  const expiresAt = new Date('2026-09-20T10:00:00Z');

  it('reads the row against the clock rather than rewriting it', () => {
    expect(handoverState({ status: 'PENDING', expiresAt }, now)).toBe('PENDING');
    expect(handoverState({ status: 'PENDING', expiresAt }, new Date('2026-09-21'))).toBe('EXPIRED');
    expect(handoverState({ status: 'CANCELLED', expiresAt }, now)).toBe('CANCELLED');
    expect(handoverState({ status: 'ACCEPTED', expiresAt }, new Date('2026-09-21'))).toBe(
      'ACCEPTED',
    );
  });
});

describe('accepting', () => {
  const pending = {
    status: 'PENDING' as const,
    expiresAt: new Date('2026-09-20T10:00:00Z'),
    fromUserId: 'seller',
  };

  it('lets the buyer accept and nobody else', () => {
    expect(() => assertHandoverAcceptable(pending, 'buyer', now)).not.toThrow();
    expect(() => assertHandoverAcceptable(pending, 'seller', now)).toThrow(/person buying it/);
  });

  it('refuses one that has run out or is closed', () => {
    expect(() => assertHandoverAcceptable(pending, 'buyer', new Date('2026-09-21'))).toThrow(
      /run out/,
    );
    expect(() =>
      assertHandoverAcceptable({ ...pending, status: 'ACCEPTED' }, 'buyer', now),
    ).toThrow(/already been accepted/);
    expect(() =>
      assertHandoverAcceptable({ ...pending, status: 'CANCELLED' }, 'buyer', now),
    ).toThrow(/no longer open/);
  });
});

describe('what the buyer is shown', () => {
  it('counts the owners and the history without naming anybody', () => {
    const sentence = describeHandover({
      vehicle: 'Toyota Corolla',
      registration: 'AB12 CDE',
      owners: 2,
      entries: 14,
      heldMonths: 29,
      on: new Date('2026-09-14'),
      odometerKm: 84_000,
    });

    expect(sentence).toBe(
      'You would be owner 3 on record. The seller has had it 2 years, and its history carries 14 entries, which stay with the car.',
    );
    expect(sentence).not.toContain('Maria');
  });

  it('reads for a first sale and a single entry', () => {
    expect(
      describeHandover({
        vehicle: 'Volkswagen Golf',
        registration: null,
        owners: 1,
        entries: 1,
        heldMonths: 7,
        on: new Date('2026-09-14'),
        odometerKm: null,
      }),
    ).toBe(
      'You would be its second recorded owner. The seller has had it 7 months, and its history carries 1 entry, which stays with the car.',
    );
  });
});
