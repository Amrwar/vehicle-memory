import { describe, expect, it } from 'vitest';

import {
  checkCapacity,
  durationHours,
  hasBlockingConflict,
  overlaps,
  type ScheduledItem,
  suggestSlots,
  utilisationFor,
} from './capacity';

const at = (hour: number, day = 12): Date => new Date(2026, 8, day, hour, 0, 0, 0);

const booking = (
  id: string,
  startHour: number,
  endHour: number,
  extra: Partial<ScheduledItem> = {},
): ScheduledItem => ({
  id,
  startAt: at(startHour),
  endAt: at(endHour),
  estimatedHours: endHour - startHour,
  ...extra,
});

describe('interval maths', () => {
  it('detects overlap', () => {
    expect(overlaps(booking('a', 9, 11), booking('b', 10, 12))).toBe(true);
  });

  it('treats touching intervals as not overlapping', () => {
    // A job ending at 11:00 and the next starting at 11:00 is a full diary,
    // not a double booking.
    expect(overlaps(booking('a', 9, 11), booking('b', 11, 13))).toBe(false);
  });

  it('measures duration in hours, including half hours', () => {
    const halfPastTwelve = new Date(2026, 8, 12, 12, 30, 0, 0);
    expect(durationHours({ startAt: at(9), endAt: halfPastTwelve })).toBe(3.5);
  });
});

describe('bay conflicts', () => {
  it('warns when a bay is already occupied', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 10, 12, { bayId: 'bay1' }),
      existing: [booking('existing', 9, 11, { bayId: 'bay1' })],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.kind).toBe('BAY_DOUBLE_BOOKED');
  });

  it('warns rather than blocks, because workshops do squeeze jobs in', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 10, 12, { bayId: 'bay1' }),
      existing: [booking('existing', 9, 11, { bayId: 'bay1' })],
    });

    expect(conflicts[0]!.severity).toBe('warning');
    expect(hasBlockingConflict(conflicts)).toBe(false);
  });

  it('ignores a different bay', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 10, 12, { bayId: 'bay2' }),
      existing: [booking('existing', 9, 11, { bayId: 'bay1' })],
    });
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag a booking against itself when it is being moved', () => {
    const conflicts = checkCapacity({
      candidate: booking('same', 10, 12, { bayId: 'bay1' }),
      existing: [booking('same', 9, 11, { bayId: 'bay1' })],
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe('technician conflicts', () => {
  it('blocks a technician being in two places at once', () => {
    // Unlike a bay, this one is physically impossible, so it is blocking.
    const conflicts = checkCapacity({
      candidate: booking('new', 10, 12, { technicianId: 'tech1' }),
      existing: [booking('existing', 9, 11, { technicianId: 'tech1' })],
    });

    expect(conflicts[0]!.kind).toBe('TECHNICIAN_DOUBLE_BOOKED');
    expect(hasBlockingConflict(conflicts)).toBe(true);
  });

  it('blocks assignment to a technician who is not in', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 10, 12, { technicianId: 'tech1' }),
      existing: [],
      unavailableTechnicianIds: ['tech1'],
    });

    expect(hasBlockingConflict(conflicts)).toBe(true);
    expect(conflicts[0]!.message).toContain('not available');
  });
});

describe('daily capacity', () => {
  it('warns when the day would exceed capacity', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 15, 17),
      existing: [booking('a', 8, 16), booking('b', 8, 16)],
      dailyCapacityHours: 16,
    });

    const overCapacity = conflicts.find((c) => c.kind === 'OVER_CAPACITY');
    expect(overCapacity).toBeDefined();
    expect(overCapacity!.message).toContain('18');
  });

  it('stays quiet within capacity', () => {
    const conflicts = checkCapacity({
      candidate: booking('new', 15, 17),
      existing: [booking('a', 8, 12)],
      dailyCapacityHours: 40,
    });
    expect(conflicts.filter((c) => c.kind === 'OVER_CAPACITY')).toHaveLength(0);
  });

  it('counts only the same day', () => {
    const nextDay: ScheduledItem = {
      id: 'other',
      startAt: at(8, 13),
      endAt: at(18, 13),
      estimatedHours: 10,
    };

    const conflicts = checkCapacity({
      candidate: booking('new', 9, 11),
      existing: [nextDay],
      dailyCapacityHours: 10,
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe('utilisation', () => {
  it('reports an empty day', () => {
    expect(utilisationFor(at(9), [], 40).state).toBe('empty');
  });

  it('reports a quiet day, which is a problem too', () => {
    expect(utilisationFor(at(9), [booking('a', 9, 12)], 40).state).toBe('light');
  });

  it('reports a healthy day', () => {
    const items = [booking('a', 8, 16), booking('b', 8, 16), booking('c', 8, 16)];
    expect(utilisationFor(at(9), items, 32).state).toBe('healthy');
  });

  it('reports an overbooked day', () => {
    const items = [booking('a', 8, 18), booking('b', 8, 18), booking('c', 8, 18)];
    const result = utilisationFor(at(9), items, 20);
    expect(result.state).toBe('over');
    expect(result.utilisationPct).toBeGreaterThan(100);
  });
});

describe('slot suggestion', () => {
  it('offers the earliest slots that actually fit', () => {
    const slots = suggestSlots({
      from: at(8),
      durationHours: 2,
      existing: [booking('a', 8, 12, { bayId: 'bay1' })],
      bayIds: ['bay1'],
      openingHour: 8,
      closingHour: 17,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.startAt.getHours()).toBe(12);
  });

  it('spreads onto another bay when the first is full', () => {
    const slots = suggestSlots({
      from: at(8),
      durationHours: 2,
      existing: [booking('a', 8, 17, { bayId: 'bay1' })],
      bayIds: ['bay1', 'bay2'],
    });

    expect(slots[0]!.bayId).toBe('bay2');
    expect(slots[0]!.startAt.getHours()).toBe(8);
  });

  it('never suggests a slot in the past', () => {
    const slots = suggestSlots({
      from: at(14),
      durationHours: 1,
      existing: [],
      bayIds: ['bay1'],
    });

    for (const slot of slots) {
      expect(slot.startAt.getTime()).toBeGreaterThanOrEqual(at(14).getTime());
    }
  });

  it('does not invent Sunday availability', () => {
    const slots = suggestSlots({
      from: at(8),
      durationHours: 1,
      existing: [],
      bayIds: ['bay1'],
      daysToSearch: 14,
    }, 30);

    for (const slot of slots) {
      expect(slot.startAt.getDay()).not.toBe(0);
    }
  });

  it('returns nothing when the job is longer than a working day', () => {
    const slots = suggestSlots({
      from: at(8),
      durationHours: 20,
      existing: [],
      bayIds: ['bay1'],
      openingHour: 8,
      closingHour: 17,
    });
    expect(slots).toHaveLength(0);
  });
});
