import { describe, expect, it } from 'vitest';

import {
  blocks,
  CERTIFICATE_WARNING_DAYS,
  certificateDueSoon,
  daysOfCertificateLeft,
  EQUIPMENT_STATE_SENTENCE,
  EQUIPMENT_STATES,
  equipmentWorstFirst,
  type EquipmentFacts,
  jobCanRun,
  serviceDueAt,
  serviceOverdue,
  stateOf,
  whyItCannotStart,
} from './index';

const now = new Date('2026-10-01T09:00:00Z');
const days = (count: number) => new Date(now.getTime() + count * 24 * 60 * 60 * 1000);

function machine(over: Partial<EquipmentFacts> = {}): EquipmentFacts {
  return {
    retired: false,
    outOfServiceSince: null,
    certificateExpiresAt: null,
    inUseOnJobs: 0,
    ...over,
  };
}

describe('the states', () => {
  it('has a sentence for each', () => {
    for (const state of EQUIPMENT_STATES) expect(EQUIPMENT_STATE_SENTENCE[state]).toBeTruthy();
  });

  it('blocks the three that mean not usable, and not the other two', () => {
    expect(blocks('RETIRED')).toBe(true);
    expect(blocks('OUT_OF_SERVICE')).toBe(true);
    expect(blocks('OUT_OF_CALIBRATION')).toBe(true);
    expect(blocks('IN_USE')).toBe(false);
    expect(blocks('AVAILABLE')).toBe(false);
  });
});

describe('what is most importantly true about a machine', () => {
  it('is available when nothing is wrong', () => {
    expect(stateOf(machine(), now)).toBe('AVAILABLE');
  });

  it('is in use when a job on the bench needs it', () => {
    expect(stateOf(machine({ inUseOnJobs: 1 }), now)).toBe('IN_USE');
  });

  it('is out of calibration the moment the certificate lapses', () => {
    expect(stateOf(machine({ certificateExpiresAt: days(-1) }), now)).toBe('OUT_OF_CALIBRATION');
  });

  it('and nobody has to press anything for that to happen', () => {
    // The same machine, same record, one day later. Nothing was edited.
    const lift = machine({ certificateExpiresAt: new Date('2026-10-02T00:00:00Z') });
    expect(stateOf(lift, now)).toBe('AVAILABLE');
    expect(stateOf(lift, new Date('2026-10-03T09:00:00Z'))).toBe('OUT_OF_CALIBRATION');
  });

  it('is available with no certificate at all, which is not the same as a lapsed one', () => {
    // A trolley jack carries no certificate. That must not read as expired.
    expect(stateOf(machine({ certificateExpiresAt: null }), now)).toBe('AVAILABLE');
  });

  it('is out of service before it is out of calibration', () => {
    expect(
      stateOf(machine({ outOfServiceSince: days(-3), certificateExpiresAt: days(-9) }), now),
    ).toBe('OUT_OF_SERVICE');
  });

  it('is retired before anything else, because it is gone', () => {
    expect(
      stateOf(machine({ retired: true, outOfServiceSince: days(-3), inUseOnJobs: 2 }), now),
    ).toBe('RETIRED');
  });

  it('is not in use when it is broken', () => {
    expect(stateOf(machine({ outOfServiceSince: days(-1), inUseOnJobs: 4 }), now)).toBe(
      'OUT_OF_SERVICE',
    );
  });
});

describe('the certificate running out', () => {
  it('counts the days left', () => {
    expect(daysOfCertificateLeft(machine({ certificateExpiresAt: days(10) }), now)).toBe(10);
  });

  it('is nothing to count where there is no certificate', () => {
    expect(daysOfCertificateLeft(machine(), now)).toBeNull();
  });

  it('warns inside the month, in time to book the engineer', () => {
    expect(certificateDueSoon(machine({ certificateExpiresAt: days(20) }), now)).toBe(true);
    expect(
      certificateDueSoon(machine({ certificateExpiresAt: days(CERTIFICATE_WARNING_DAYS) }), now),
    ).toBe(true);
  });

  it('says nothing while there is plenty of time', () => {
    expect(
      certificateDueSoon(
        machine({ certificateExpiresAt: days(CERTIFICATE_WARNING_DAYS + 1) }),
        now,
      ),
    ).toBe(false);
  });

  it('stops warning once it has lapsed, because then it is a state and not a warning', () => {
    expect(certificateDueSoon(machine({ certificateExpiresAt: days(-1) }), now)).toBe(false);
    expect(stateOf(machine({ certificateExpiresAt: days(-1) }), now)).toBe('OUT_OF_CALIBRATION');
  });

  it('leaves a machine due soon still usable', () => {
    expect(stateOf(machine({ certificateExpiresAt: days(5) }), now)).toBe('AVAILABLE');
  });
});

describe('late for a service warns, and never blocks', () => {
  it('is overdue once the interval has passed', () => {
    expect(
      serviceOverdue({ servicedAt: new Date('2025-09-01'), serviceEveryMonths: 12 }, now),
    ).toBe(true);
  });

  it('is not overdue inside it', () => {
    expect(
      serviceOverdue({ servicedAt: new Date('2026-06-01'), serviceEveryMonths: 12 }, now),
    ).toBe(false);
  });

  it('is overdue when a machine with an interval has never been serviced', () => {
    expect(serviceOverdue({ servicedAt: null, serviceEveryMonths: 6 }, now)).toBe(true);
  });

  it('is never overdue where there is no interval to be late for', () => {
    expect(serviceOverdue({ servicedAt: null, serviceEveryMonths: null }, now)).toBe(false);
  });

  it('says when the next one falls due', () => {
    expect(
      serviceDueAt({ servicedAt: new Date('2026-03-15'), serviceEveryMonths: 6 })?.toISOString(),
    ).toBe(new Date('2026-09-15').toISOString());
  });

  it('does not change the state, which is the whole distinction', () => {
    // A lift a month late for its service is a risk a workshop may knowingly
    // carry. One whose inspection lapsed is not permitted to be used at all.
    expect(stateOf(machine(), now)).toBe('AVAILABLE');
  });
});

describe('whether the work can start', () => {
  it('can, when every machine it needs is usable', () => {
    const result = jobCanRun([
      { equipmentId: 'a', name: 'Four-post lift', state: 'AVAILABLE' },
      { equipmentId: 'b', name: 'Scan tool', state: 'AVAILABLE' },
    ]);

    expect(result.ok).toBe(true);
    expect(whyItCannotStart(result)).toBeNull();
  });

  it('can, even when a machine is busy on another job', () => {
    // A workshop puts a car on the ramp knowing the rig is busy and gets to it
    // in an hour. A product that refused would be wrong about workshops.
    const result = jobCanRun([{ equipmentId: 'a', name: 'Alignment rig', state: 'IN_USE' }]);

    expect(result.ok).toBe(true);
    expect(result.busy.map((one) => one.name)).toEqual(['Alignment rig']);
  });

  it('cannot, when a machine it needs is out of calibration', () => {
    const result = jobCanRun([
      { equipmentId: 'a', name: 'Torque wrench', state: 'OUT_OF_CALIBRATION' },
    ]);

    expect(result.ok).toBe(false);
    expect(whyItCannotStart(result)).toBe('Torque wrench: certificate expired');
  });

  it('names every machine in the way, not just the first', () => {
    const result = jobCanRun([
      { equipmentId: 'a', name: 'Torque wrench', state: 'OUT_OF_CALIBRATION' },
      { equipmentId: 'b', name: 'Two-post lift', state: 'OUT_OF_SERVICE' },
      { equipmentId: 'c', name: 'Scan tool', state: 'AVAILABLE' },
    ]);

    expect(result.blocking.map((one) => one.name)).toEqual(['Torque wrench', 'Two-post lift']);
    expect(whyItCannotStart(result)).toBe(
      'Torque wrench: certificate expired; Two-post lift: out of service',
    );
  });

  it('can, when the job needs no machine at all', () => {
    expect(jobCanRun([]).ok).toBe(true);
  });
});

describe('what an owner should deal with first', () => {
  it('puts what has already stopped work above what has not', () => {
    const all = [
      { name: 'fine', state: 'AVAILABLE' as const, dueSoon: false, serviceOverdue: false },
      { name: 'late-service', state: 'AVAILABLE' as const, dueSoon: false, serviceOverdue: true },
      { name: 'expiring', state: 'AVAILABLE' as const, dueSoon: true, serviceOverdue: false },
      {
        name: 'expired',
        state: 'OUT_OF_CALIBRATION' as const,
        dueSoon: false,
        serviceOverdue: false,
      },
      { name: 'broken', state: 'OUT_OF_SERVICE' as const, dueSoon: false, serviceOverdue: false },
    ];

    expect(equipmentWorstFirst(all).map((one) => one.name)).toEqual([
      'expired',
      'broken',
      'expiring',
      'late-service',
      'fine',
    ]);
  });

  it('puts what is gone at the bottom, not the top', () => {
    const all = [
      { name: 'gone', state: 'RETIRED' as const, dueSoon: false, serviceOverdue: false },
      { name: 'fine', state: 'AVAILABLE' as const, dueSoon: false, serviceOverdue: false },
    ];

    expect(equipmentWorstFirst(all).map((one) => one.name)).toEqual(['fine', 'gone']);
  });
});
