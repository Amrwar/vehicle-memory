import { describe, expect, it } from 'vitest';

import {
  clashesAmong,
  type Commitment,
  couldPromise,
  lapsingBetween,
  type SchedulableMachine,
  usableOn,
  whyNotOn,
} from './scheduling';
import { overlaps } from '../scheduling/capacity';

const day = (offset: number, hour = 9) => new Date(Date.UTC(2026, 9, 1 + offset, hour, 0, 0));

function machine(
  over: Partial<SchedulableMachine['facts']> = {},
  name = 'Alignment rig',
): SchedulableMachine {
  return {
    equipmentId: name,
    name,
    facts: {
      retired: false,
      outOfServiceSince: null,
      certificateExpiresAt: null,
      inUseOnJobs: 0,
      ...over,
    },
  };
}

function booking(over: Partial<Commitment> & { bookingId: string }): Commitment {
  return {
    label: over.bookingId,
    startAt: day(10),
    endAt: day(10, 11),
    machineIds: ['Alignment rig'],
    ...over,
  };
}

describe('whether a machine will be usable then, not now', () => {
  // The payoff of Phase 89 refusing to store the state: asking about next
  // Tuesday is the same function with a different date.

  it('is usable on a day inside its certificate', () => {
    expect(usableOn(machine({ certificateExpiresAt: day(30) }), day(10))).toBe(true);
  });

  it('is not usable on a day after its certificate lapses', () => {
    expect(usableOn(machine({ certificateExpiresAt: day(5) }), day(10))).toBe(false);
    expect(whyNotOn(machine({ certificateExpiresAt: day(5) }), day(10))).toBe('OUT_OF_CALIBRATION');
  });

  it('is usable today and not in three weeks, from one record', () => {
    const rig = machine({ certificateExpiresAt: day(14) });
    expect(usableOn(rig, day(1))).toBe(true);
    expect(usableOn(rig, day(21))).toBe(false);
  });

  it('ignores how busy it is on the bench today', () => {
    // Being busy now says nothing about a Tuesday three weeks out, and
    // counting it would refuse a booking for a machine that is working.
    expect(usableOn(machine({ inUseOnJobs: 3 }), day(10))).toBe(true);
  });

  it('is not usable when somebody has taken it out of service', () => {
    expect(whyNotOn(machine({ outOfServiceSince: day(-2) }), day(10))).toBe('OUT_OF_SERVICE');
  });
});

describe('when two windows touch', () => {
  it('do not clash when one ends as the other begins', () => {
    expect(
      overlaps(
        { startAt: day(0, 9), endAt: day(0, 11) },
        { startAt: day(0, 11), endAt: day(0, 13) },
      ),
    ).toBe(false);
  });

  it('clash when they share an hour', () => {
    expect(
      overlaps(
        { startAt: day(0, 9), endAt: day(0, 12) },
        { startAt: day(0, 11), endAt: day(0, 13) },
      ),
    ).toBe(true);
  });
});

describe('promises the workshop cannot keep', () => {
  it('finds none when the machine is fine and nothing else wants it', () => {
    expect(clashesAmong([booking({ bookingId: 'a' })], [machine()])).toEqual([]);
  });

  it('names a booking whose machine will have lapsed by then', () => {
    const clashes = clashesAmong(
      [booking({ bookingId: 'a', startAt: day(20), endAt: day(20, 11) })],
      [machine({ certificateExpiresAt: day(18) })],
    );

    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.kind).toBe('NOT_USABLE');
    expect(clashes[0]?.why).toBe('OUT_OF_CALIBRATION');
    expect(clashes[0]?.machineName).toBe('Alignment rig');
  });

  it('says nothing about a booking before the certificate lapses', () => {
    expect(
      clashesAmong(
        [booking({ bookingId: 'a', startAt: day(10), endAt: day(10, 11) })],
        [machine({ certificateExpiresAt: day(18) })],
      ),
    ).toEqual([]);
  });

  it('finds one machine promised to two cars at once', () => {
    const clashes = clashesAmong(
      [
        booking({ bookingId: 'first', startAt: day(10, 9), endAt: day(10, 12) }),
        booking({ bookingId: 'second', startAt: day(10, 11), endAt: day(10, 13) }),
      ],
      [machine()],
    );

    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.kind).toBe('DOUBLE_BOOKED');
  });

  it('reports it against the later one, which is the one somebody would move', () => {
    const clashes = clashesAmong(
      [
        booking({ bookingId: 'first', startAt: day(10, 9), endAt: day(10, 12) }),
        booking({ bookingId: 'second', startAt: day(10, 11), endAt: day(10, 13) }),
      ],
      [machine()],
    );

    expect(clashes[0]?.bookingId).toBe('second');
    expect(clashes[0]?.againstBookingId).toBe('first');
  });

  it('does not call two bookings on different machines a clash', () => {
    const clashes = clashesAmong(
      [
        booking({ bookingId: 'a', machineIds: ['Alignment rig'] }),
        booking({ bookingId: 'b', machineIds: ['Scan tool'] }),
      ],
      [machine(), machine({}, 'Scan tool')],
    );

    expect(clashes).toEqual([]);
  });

  it('does not clash two bookings that merely follow each other', () => {
    expect(
      clashesAmong(
        [
          booking({ bookingId: 'a', startAt: day(10, 9), endAt: day(10, 11) }),
          booking({ bookingId: 'b', startAt: day(10, 11), endAt: day(10, 13) }),
        ],
        [machine()],
      ),
    ).toEqual([]);
  });

  it('ignores a machine it knows nothing about rather than inventing a clash', () => {
    expect(clashesAmong([booking({ bookingId: 'a', machineIds: ['gone'] })], [machine()])).toEqual(
      [],
    );
  });

  it('finds both kinds at once, oldest first', () => {
    const clashes = clashesAmong(
      [
        booking({ bookingId: 'early', startAt: day(20, 9), endAt: day(20, 12) }),
        booking({ bookingId: 'late', startAt: day(20, 11), endAt: day(20, 13) }),
      ],
      [machine({ certificateExpiresAt: day(18) })],
    );

    expect(clashes.map((one) => one.kind)).toEqual(['NOT_USABLE', 'NOT_USABLE', 'DOUBLE_BOOKED']);
  });
});

describe('certificates running out inside a window somebody is planning', () => {
  it('names one that lapses in the fortnight ahead', () => {
    expect(lapsingBetween([machine({ certificateExpiresAt: day(7) })], day(0), day(14))).toEqual([
      { equipmentId: 'Alignment rig', name: 'Alignment rig', on: day(7) },
    ]);
  });

  it('says nothing about one that lapses after it', () => {
    expect(lapsingBetween([machine({ certificateExpiresAt: day(30) })], day(0), day(14))).toEqual(
      [],
    );
  });

  it('says nothing about a machine with no certificate', () => {
    expect(lapsingBetween([machine()], day(0), day(14))).toEqual([]);
  });

  it('says nothing about one that is gone', () => {
    expect(
      lapsingBetween([machine({ retired: true, certificateExpiresAt: day(7) })], day(0), day(14)),
    ).toEqual([]);
  });
});

describe('taking an appointment over the telephone', () => {
  it('can be promised when nothing is in the way', () => {
    const answer = couldPromise(booking({ bookingId: 'new' }), [], [machine()]);
    expect(answer.ok).toBe(true);
  });

  it('cannot, when the machine will have lapsed by then', () => {
    const answer = couldPromise(
      booking({ bookingId: 'new', startAt: day(20), endAt: day(20, 11) }),
      [],
      [machine({ certificateExpiresAt: day(18) })],
    );

    expect(answer.ok).toBe(false);
    expect(answer.clashes[0]?.kind).toBe('NOT_USABLE');
  });

  it('cannot, when somebody else already has the machine that hour', () => {
    const answer = couldPromise(
      booking({ bookingId: 'new', startAt: day(10, 11), endAt: day(10, 13) }),
      [booking({ bookingId: 'theirs', startAt: day(10, 9), endAt: day(10, 12) })],
      [machine()],
    );

    expect(answer.ok).toBe(false);
    expect(answer.clashes[0]?.againstBookingId).toBe('theirs');
  });

  it('answers only about the one being proposed', () => {
    // Two existing bookings already clash with each other. That is a problem,
    // and it is not this caller's question.
    const answer = couldPromise(
      booking({ bookingId: 'new', startAt: day(11, 9), endAt: day(11, 11) }),
      [
        booking({ bookingId: 'a', startAt: day(10, 9), endAt: day(10, 12) }),
        booking({ bookingId: 'b', startAt: day(10, 11), endAt: day(10, 13) }),
      ],
      [machine()],
    );

    expect(answer.ok).toBe(true);
    expect(answer.clashes).toEqual([]);
  });
});
