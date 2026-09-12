import { describe, expect, it } from 'vitest';

import {
  assertClaimDecidable,
  assertVehicleClaimable,
  claimQueueOrder,
  describeAmbiguity,
  describeClaim,
  identifierKind,
  looksLikeRegistration,
  MAX_OPEN_CLAIMS,
  normaliseRegistration,
} from './claims';

const claimable = {
  verified: true,
  openClaims: 0,
  alreadyTheirs: false,
  alreadyAsked: false,
  hasWorkshop: true,
};

describe('assertVehicleClaimable', () => {
  it('allows an ordinary first request', () => {
    expect(() => assertVehicleClaimable(claimable)).not.toThrow();
  });

  it('will not take a request from an unconfirmed address', () => {
    // A workshop is about to be asked to hand over a vehicle history. The
    // least the request can carry is an address somebody has proven they read.
    expect(() => assertVehicleClaimable({ ...claimable, verified: false })).toThrow(
      /Confirm your email/,
    );
  });

  it('says so when the vehicle is already theirs', () => {
    expect(() => assertVehicleClaimable({ ...claimable, alreadyTheirs: true })).toThrow(
      /already on your account/,
    );
  });

  it('does not queue a second request for the same vehicle', () => {
    expect(() => assertVehicleClaimable({ ...claimable, alreadyAsked: true })).toThrow(
      /already asked/,
    );
  });

  it('explains when no workshop can vouch for it', () => {
    // Not a refusal of the person. There is simply nobody in the network who
    // has ever seen the car, so there is no one to ask.
    expect(() => assertVehicleClaimable({ ...claimable, hasWorkshop: false })).toThrow(
      /Ask your garage whether they use Carnet/,
    );
  });

  it('stops somebody working through a car park', () => {
    expect(() => assertVehicleClaimable({ ...claimable, openClaims: MAX_OPEN_CLAIMS })).toThrow(
      /Wait for one to be answered/,
    );
  });

  it('caps open requests, not lifetime ones', () => {
    // A person with five cars is real. They can ask again the moment a
    // workshop answers, so an honest customer is never permanently capped.
    expect(() =>
      assertVehicleClaimable({ ...claimable, openClaims: MAX_OPEN_CLAIMS - 1 }),
    ).not.toThrow();
  });

  it('checks the address before anything else', () => {
    // Every other refusal tells somebody something about a vehicle they have
    // not yet proven any connection to.
    expect(() =>
      assertVehicleClaimable({
        verified: false,
        openClaims: 99,
        alreadyTheirs: true,
        alreadyAsked: true,
        hasWorkshop: false,
      }),
    ).toThrow(/Confirm your email/);
  });
});

describe('assertClaimDecidable', () => {
  it('records an approval', () => {
    expect(() =>
      assertClaimDecidable({ current: 'PENDING', decision: { status: 'APPROVED' } }),
    ).not.toThrow();
  });

  it('will not answer the same request twice', () => {
    // Two answers reach the customer as two different outcomes.
    expect(() =>
      assertClaimDecidable({ current: 'APPROVED', decision: { status: 'REJECTED' } }),
    ).toThrow(/already approved/);
  });

  it('refuses a refusal with nothing behind it', () => {
    expect(() =>
      assertClaimDecidable({ current: 'PENDING', decision: { status: 'REJECTED' } }),
    ).toThrow(/Say why/);

    expect(() =>
      assertClaimDecidable({ current: 'PENDING', decision: { status: 'REJECTED', reason: '   ' } }),
    ).toThrow(/Say why/);
  });

  it('accepts a refusal that says why', () => {
    expect(() =>
      assertClaimDecidable({
        current: 'PENDING',
        decision: { status: 'REJECTED', reason: 'Rang the owner and it is not them.' },
      }),
    ).not.toThrow();
  });

  it('does not demand a reason for an approval', () => {
    expect(() =>
      assertClaimDecidable({ current: 'PENDING', decision: { status: 'APPROVED' } }),
    ).not.toThrow();
  });
});

describe('describeClaim', () => {
  const askedAt = new Date('2026-09-01T09:00:00Z');

  it('never names the workshop while a request is pending', () => {
    // Naming the garage would tell somebody where a car is serviced before
    // they have shown any connection to it.
    const line = describeClaim({
      status: 'PENDING',
      registration: 'AB12 CDE',
      askedAt,
      now: new Date('2026-09-02T09:00:00Z'),
    });

    expect(line).toBe('Waiting for the workshop to confirm AB12 CDE is yours.');
  });

  it('suggests ringing once waiting has gone on', () => {
    const line = describeClaim({
      status: 'PENDING',
      registration: 'AB12 CDE',
      askedAt,
      now: new Date('2026-09-06T09:00:00Z'),
    });

    expect(line).toContain('5 days ago');
    expect(line).toContain('Ringing the garage');
  });

  it('passes on the reason for a refusal', () => {
    const line = describeClaim({
      status: 'REJECTED',
      registration: 'AB12 CDE',
      askedAt,
      reason: 'The name did not match our records.',
    });

    expect(line).toContain('The name did not match our records.');
  });

  it('does not leave a dangling space when a refusal has no reason', () => {
    const line = describeClaim({ status: 'REJECTED', registration: 'AB12 CDE', askedAt });

    expect(line).toBe('The workshop did not confirm AB12 CDE.');
  });

  it('is plain about an approval', () => {
    expect(describeClaim({ status: 'APPROVED', registration: 'AB12 CDE', askedAt })).toBe(
      'AB12 CDE is on your account.',
    );
  });
});

describe('claimQueueOrder', () => {
  it('puts unanswered requests first and oldest first within them', () => {
    // A queue read newest-first leaves the awkward ones at the bottom forever,
    // and those are exactly the customers sitting waiting.
    const ordered = claimQueueOrder([
      { id: 'new-pending', status: 'PENDING', askedAt: new Date('2026-09-09') },
      { id: 'answered', status: 'APPROVED', askedAt: new Date('2026-09-01') },
      { id: 'old-pending', status: 'PENDING', askedAt: new Date('2026-09-02') },
    ] as const);

    expect(ordered.map((row) => row.id)).toEqual(['old-pending', 'new-pending', 'answered']);
  });

  it('leaves the array it was handed alone', () => {
    const input = [
      { status: 'APPROVED' as const, askedAt: new Date('2026-09-01') },
      { status: 'PENDING' as const, askedAt: new Date('2026-09-02') },
    ];
    const first = input[0];

    claimQueueOrder(input);

    expect(input[0]).toBe(first);
  });

  it('copes with an empty queue', () => {
    expect(claimQueueOrder([])).toEqual([]);
  });
});

describe('normaliseRegistration', () => {
  it('ignores how somebody wrote the plate', () => {
    expect(normaliseRegistration(' ab12 cde ')).toBe('AB12CDE');
    expect(normaliseRegistration('ab12-cde')).toBe('AB12CDE');
  });
});

describe('looksLikeRegistration', () => {
  it('accepts the shapes plates actually take', () => {
    expect(looksLikeRegistration('AB12 CDE')).toBe(true);
    expect(looksLikeRegistration('1ABC')).toBe(true);
  });

  it('rejects what is plainly not one', () => {
    expect(looksLikeRegistration('AB1')).toBe(false);
    expect(looksLikeRegistration('AB12 CDE FGHIJ')).toBe(false);
    expect(looksLikeRegistration('maria@example.test')).toBe(false);
  });
});

describe('identifierKind', () => {
  it('recognises a VIN by its length and its missing letters', () => {
    expect(identifierKind('WVWZZZ1JZ3W386752')).toBe('VIN');
  });

  it('does not mistake a plate for one', () => {
    expect(identifierKind('AB12 CDE')).toBe('REGISTRATION');
  });

  it('refuses seventeen characters containing letters a VIN cannot hold', () => {
    // I, O and Q are excluded from VINs precisely so they cannot be read as
    // one, zero and nine. Seventeen characters with an O in is a typo.
    expect(identifierKind('WVWZZZ1JZ3W38675O')).toBe('NEITHER');
  });

  it('says so when it is neither', () => {
    expect(identifierKind('')).toBe('NEITHER');
    expect(identifierKind('the blue one on the drive')).toBe('NEITHER');
    expect(identifierKind('maria@example.test')).toBe('NEITHER');
  });

  it('accepts something that reads like a word, because plates do', () => {
    // MYCAR is a plate somebody paid for. Rejecting it because it spells
    // something would refuse the customers most attached to their car.
    expect(identifierKind('my car')).toBe('REGISTRATION');
  });
});

describe('describeAmbiguity', () => {
  it('names the vehicles without naming anybody', () => {
    // A personalised plate moves between cars. The way out is the VIN, and
    // the way into a data breach is picking one of them at random.
    const line = describeAmbiguity([
      { make: 'Volkswagen', model: 'Golf', year: 2014 },
      { make: 'Audi', model: 'A3', year: 2021 },
    ]);

    expect(line).toContain('2014 Volkswagen Golf');
    expect(line).toContain('2021 Audi A3');
    expect(line).toContain('VIN');
  });

  it('copes with a vehicle nobody filled in', () => {
    const line = describeAmbiguity([{}, { make: 'Ford' }]);

    expect(line).toContain('an unidentified vehicle');
    expect(line).toContain('Ford');
  });
});
