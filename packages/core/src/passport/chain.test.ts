import { describe, expect, it } from 'vitest';

import {
  canonicalise,
  chainEvent,
  type ChainedEvent,
  computeEventHash,
  fingerprint,
  hashesEqual,
  verifyChain,
} from './chain';

const SALT = 'test-salt-do-not-use-in-production';

function buildChain(count: number, salt = SALT): ChainedEvent[] {
  const events: ChainedEvent[] = [];
  let prevHash: string | null = null;

  for (let i = 1; i <= count; i += 1) {
    const chained = chainEvent(
      {
        vehicleId: 'veh_1',
        sequence: i,
        type: 'SERVICE',
        occurredAt: new Date(Date.UTC(2020 + i, 0, 1)),
        payload: { description: `Service ${i}`, hours: i },
        odometerKm: i * 10_000,
        recordedByOrgId: 'org_1',
      },
      prevHash,
      salt,
    );
    events.push(chained);
    prevHash = chained.hash;
  }

  return events;
}

describe('canonicalisation', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { b: 2, a: 1, c: { z: 26, y: 25 } };
    const b = { c: { y: 25, z: 26 }, a: 1, b: 2 };
    expect(canonicalise(a)).toBe(canonicalise(b));
  });

  it('drops undefined rather than emitting it', () => {
    expect(canonicalise({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('normalises negative zero', () => {
    expect(canonicalise(-0)).toBe(canonicalise(0));
  });

  it('serialises dates as ISO strings', () => {
    expect(canonicalise(new Date(Date.UTC(2026, 0, 1)))).toBe('"2026-01-01T00:00:00.000Z"');
  });

  it('refuses non-finite numbers instead of emitting null silently', () => {
    expect(() => canonicalise(Number.NaN)).toThrow();
    expect(() => canonicalise(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('handles nested arrays of objects deterministically', () => {
    const a = canonicalise([{ b: 1, a: 2 }, { d: 3, c: 4 }]);
    const b = canonicalise([{ a: 2, b: 1 }, { c: 4, d: 3 }]);
    expect(a).toBe(b);
  });
});

describe('hashing', () => {
  it('requires a salt', () => {
    expect(() =>
      computeEventHash(
        { vehicleId: 'v', sequence: 1, type: 'SERVICE', occurredAt: new Date(), payload: {} },
        null,
        '',
      ),
    ).toThrow(/LEDGER_CHAIN_SALT/);
  });

  it('produces a different hash for a different salt', () => {
    const event = {
      vehicleId: 'v',
      sequence: 1,
      type: 'SERVICE',
      occurredAt: new Date(0),
      payload: {},
    };
    expect(computeEventHash(event, null, 'salt-a')).not.toBe(
      computeEventHash(event, null, 'salt-b'),
    );
  });

  it('is stable across calls with equivalent payloads', () => {
    const one = computeEventHash(
      { vehicleId: 'v', sequence: 1, type: 'S', occurredAt: new Date(0), payload: { a: 1, b: 2 } },
      null,
      SALT,
    );
    const two = computeEventHash(
      { vehicleId: 'v', sequence: 1, type: 'S', occurredAt: new Date(0), payload: { b: 2, a: 1 } },
      null,
      SALT,
    );
    expect(one).toBe(two);
  });

  it('compares hashes safely, including mismatched lengths', () => {
    const hash = computeEventHash(
      { vehicleId: 'v', sequence: 1, type: 'S', occurredAt: new Date(0), payload: {} },
      null,
      SALT,
    );
    expect(hashesEqual(hash, hash)).toBe(true);
    expect(hashesEqual(hash, 'abc')).toBe(false);
    expect(hashesEqual(hash, '')).toBe(false);
  });
});

describe('chain verification', () => {
  it('accepts an empty chain', () => {
    const result = verifyChain([], SALT);
    expect(result.valid).toBe(true);
  });

  it('accepts a well-formed chain', () => {
    const result = verifyChain(buildChain(20), SALT);
    expect(result).toMatchObject({ valid: true, eventCount: 20 });
  });

  it('links each event to its predecessor', () => {
    const chain = buildChain(3);
    expect(chain[0]!.prevHash).toBeNull();
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash);
    expect(chain[2]!.prevHash).toBe(chain[1]!.hash);
  });

  // This is the test that matters. If it ever fails, the product's central
  // claim to a used-car buyer is false.
  it('detects a payload that has been edited in place', () => {
    const chain = buildChain(5);
    const tampered = chain.map((event, index) =>
      index === 2 ? { ...event, payload: { description: 'Something else', hours: 99 } } : event,
    );

    const result = verifyChain(tampered, SALT);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.failedAt.sequence).toBe(3);
      expect(result.failedAt.reason).toBe('HASH_MISMATCH');
    }
  });

  it('detects an edited odometer reading', () => {
    const chain = buildChain(4);
    const tampered = chain.map((event, index) =>
      index === 1 ? { ...event, odometerKm: 10 } : event,
    );

    const result = verifyChain(tampered, SALT);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.failedAt.sequence).toBe(2);
  });

  it('detects a removed event', () => {
    const chain = buildChain(5);
    const withHole = [...chain.slice(0, 2), ...chain.slice(3)];

    const result = verifyChain(withHole, SALT);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.failedAt.reason).toBe('SEQUENCE_GAP');
  });

  it('detects a chain that does not start at sequence 1', () => {
    const chain = buildChain(3).slice(1);
    const result = verifyChain(chain, SALT);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.failedAt.reason).toBe('SEQUENCE_START');
  });

  it('detects a broken link even when the hash itself is self-consistent', () => {
    const chain = buildChain(3);
    // Re-hash event 3 as though event 2 never existed. Its own hash is
    // internally valid, but the link no longer points at event 2.
    const forged = chainEvent({ ...chain[2]! }, chain[0]!.hash, SALT);
    const result = verifyChain([chain[0]!, chain[1]!, forged], SALT);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.failedAt.reason).toBe('BROKEN_LINK');
  });

  it('rejects a chain rebuilt with a different salt', () => {
    const forged = buildChain(4, 'attacker-salt');
    const result = verifyChain(forged, SALT);
    expect(result.valid).toBe(false);
  });

  it('reports the head hash of a valid chain', () => {
    const chain = buildChain(6);
    const result = verifyChain(chain, SALT);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.head).toBe(chain[5]!.hash);
  });
});

describe('fingerprint', () => {
  it('renders a short comparable form', () => {
    const chain = buildChain(1);
    const value = fingerprint(chain[0]!.hash);
    expect(value).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('renders a placeholder for an empty chain', () => {
    expect(fingerprint(null)).toBe('--------');
  });
});
