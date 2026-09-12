import { describe, expect, it } from 'vitest';

import {
  assertAdoptable,
  type NetworkEvent,
  NetworkError,
  redactForNetwork,
  summariseNetwork,
  WITHHELD_KEYS,
} from './network';

const HERE = 'org_here';
const THERE = 'org_there';

function event(overrides: Partial<NetworkEvent> & { occurredAt: Date }): NetworkEvent {
  return {
    id: 'evt',
    type: 'SERVICE',
    title: 'Service',
    summary: null,
    odometerKm: null,
    verification: 'WORKSHOP_VERIFIED',
    recordedByOrgId: THERE,
    recordedByOrgName: 'Kirkstall Autocentre',
    payload: null,
    ...overrides,
  };
}

describe('redactForNetwork', () => {
  it('withholds the keys that are one workshop’s business', () => {
    const safe = redactForNetwork({
      jobId: 'j1',
      jobNumber: 1042,
      performedBy: 'Dani',
      inspectionId: 'i1',
      parts: [{ description: 'Front pads', partNumber: 'BP-1234' }],
      labourHours: 1.5,
    });

    expect(safe).toEqual({
      parts: [{ description: 'Front pads', partNumber: 'BP-1234' }],
      labourHours: 1.5,
    });
    for (const key of WITHHELD_KEYS) expect(safe).not.toHaveProperty(key);
  });

  it('keeps nothing from nothing', () => {
    expect(redactForNetwork(null)).toBeNull();
  });

  it('does not withhold what was fitted or how far the car had gone', () => {
    const safe = redactForNetwork({ odometerKm: 81_000, fitted: ['oil filter'] });
    expect(safe).toEqual({ odometerKm: 81_000, fitted: ['oil filter'] });
  });
});

describe('summariseNetwork', () => {
  it('says the history starts here when there is none', () => {
    const summary = summariseNetwork([], HERE);
    expect(summary.ownEntries).toBe(0);
    expect(summary.otherEntries).toBe(0);
    expect(summary.statement).toMatch(/starts it/);
  });

  it('counts entries by who recorded them and names the other workshops oldest first', () => {
    const summary = summariseNetwork(
      [
        event({ occurredAt: new Date('2025-03-01'), recordedByOrgName: 'Kirkstall Autocentre' }),
        event({
          occurredAt: new Date('2024-01-01'),
          recordedByOrgId: 'org_x',
          recordedByOrgName: 'Moor Lane Garage',
          odometerKm: 40_000,
        }),
        event({
          occurredAt: new Date('2026-02-01'),
          recordedByOrgId: HERE,
          recordedByOrgName: 'Hillside',
        }),
      ],
      HERE,
    );

    expect(summary.ownEntries).toBe(1);
    expect(summary.otherEntries).toBe(2);
    expect(summary.otherWorkshops).toEqual(['Moor Lane Garage', 'Kirkstall Autocentre']);
    expect(summary.firstEntry).toEqual(new Date('2024-01-01'));
    expect(summary.lastEntry).toEqual(new Date('2026-02-01'));
    expect(summary.statement).toMatch(
      /3 entries on this vehicle: 1 recorded here and 2 by Moor Lane Garage and Kirkstall Autocentre/,
    );
    expect(summary.statement).toMatch(/commercial detail is withheld/);
  });

  it('takes the last mileage from the most recent entry that has one', () => {
    const summary = summariseNetwork(
      [
        event({ occurredAt: new Date('2025-01-01'), odometerKm: 50_000 }),
        event({ occurredAt: new Date('2025-06-01'), odometerKm: null }),
      ],
      HERE,
    );
    expect(summary.lastOdometerKm).toBe(50_000);
  });

  it('tells a workshop that has never seen the car whose record it is continuing', () => {
    const summary = summariseNetwork([event({ occurredAt: new Date('2025-01-01') })], HERE);
    expect(summary.statement).toMatch(/^1 entry on this vehicle, recorded by Kirkstall Autocentre/);
    expect(summary.statement).toMatch(/What you record continues it/);
  });

  it('says so when every entry is its own', () => {
    const summary = summariseNetwork(
      [event({ occurredAt: new Date('2025-01-01'), recordedByOrgId: HERE })],
      HERE,
    );
    expect(summary.statement).toMatch(/all recorded here/);
    expect(summary.otherWorkshops).toEqual([]);
  });

  it('counts rather than lists when more than two other workshops have written', () => {
    const summary = summariseNetwork(
      ['A', 'B', 'C'].map((name, index) =>
        event({
          occurredAt: new Date(2025, index, 1),
          recordedByOrgId: `org_${name}`,
          recordedByOrgName: name,
        }),
      ),
      HERE,
    );
    expect(summary.statement).toMatch(/3 other workshops/);
  });
});

describe('assertAdoptable', () => {
  it('refuses a vehicle that is not on the network', () => {
    expect(() => assertAdoptable({ vehicleExists: false, alreadyServicedHere: false })).toThrow(
      NetworkError,
    );
    try {
      assertAdoptable({ vehicleExists: false, alreadyServicedHere: false });
    } catch (error) {
      expect((error as NetworkError).code).toBe('NO_VEHICLE');
    }
  });

  it('refuses one already on the books', () => {
    try {
      assertAdoptable({ vehicleExists: true, alreadyServicedHere: true });
      expect.unreachable();
    } catch (error) {
      expect((error as NetworkError).code).toBe('ALREADY_HERE');
    }
  });

  it('allows the ordinary case', () => {
    expect(() =>
      assertAdoptable({ vehicleExists: true, alreadyServicedHere: false }),
    ).not.toThrow();
  });
});
