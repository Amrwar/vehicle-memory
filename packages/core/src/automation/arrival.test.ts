import { describe, expect, it } from 'vitest';

import {
  type ArrivalContext,
  DECLINED_STALE_DAYS,
  describeArrival,
  suggestOnArrival,
} from './arrival';

const NOW = new Date('2026-09-09T09:00:00');

function context(overrides: Partial<ArrivalContext> = {}): ArrivalContext {
  return {
    now: NOW,
    odometerKm: 62_000,
    schedules: [],
    declined: [],
    advisories: [],
    ...overrides,
  };
}

function daysFromNow(count: number): Date {
  return new Date(NOW.getTime() + count * 86_400_000);
}

describe('what to raise when the car arrives', () => {
  it('says nothing when there is nothing to say', () => {
    expect(suggestOnArrival(context())).toEqual([]);
    expect(describeArrival([])).toBe('Nothing outstanding on this vehicle.');
  });

  it('raises an overdue service, and says how overdue', () => {
    const [first] = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'Brake fluid',
            dueAt: daysFromNow(-45),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 24,
          },
        ],
      }),
    );

    expect(first?.basis).toBe('OVERDUE');
    expect(first?.reason).toBe('Overdue by 45 days.');
  });

  it('treats mileage as its own reason to be due', () => {
    // A van that has done its mileage in four months is due whatever the
    // calendar says.
    const [first] = suggestOnArrival(
      context({
        odometerKm: 71_000,
        schedules: [
          {
            serviceItemId: 's1',
            name: 'Full service',
            dueAt: daysFromNow(120),
            dueKm: 70_000,
            lastPerformedAt: null,
            intervalMonths: 12,
          },
        ],
      }),
    );

    expect(first?.basis).toBe('OVERDUE');
    expect(first?.reason).toBe('Past its mileage by 1000 miles.');
  });

  it('raises something due soon, because the car is already here', () => {
    const [first] = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'MOT',
            dueAt: daysFromNow(21),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 12,
          },
        ],
      }),
    );

    expect(first?.basis).toBe('DUE_SOON');
    expect(first?.reason).toMatch(/here now/);
  });

  it('leaves alone something that is a long way off', () => {
    expect(
      suggestOnArrival(
        context({
          schedules: [
            {
              serviceItemId: 's1',
              name: 'Cambelt',
              dueAt: daysFromNow(400),
              dueKm: 120_000,
              lastPerformedAt: null,
              intervalMonths: 60,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('raises work the customer turned down before', () => {
    const [first] = suggestOnArrival(
      context({
        declined: [
          {
            serviceItemId: 's2',
            name: 'Rear pads',
            declinedAt: daysFromNow(-90),
            quotedMinor: 14_000,
          },
        ],
      }),
    );

    expect(first?.basis).toBe('DECLINED_BEFORE');
    expect(first?.reason).toBe('Turned down 90 days ago at £140.00.');
  });

  it('forgets a refusal old enough to be a new conversation', () => {
    // Raising it as a refusal puts the customer on the defensive about a
    // decision they have forgotten making.
    expect(
      suggestOnArrival(
        context({
          declined: [
            {
              serviceItemId: 's2',
              name: 'Rear pads',
              declinedAt: daysFromNow(-(DECLINED_STALE_DAYS + 1)),
              quotedMinor: 14_000,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('puts a red advisory above an amber one', () => {
    const suggestions = suggestOnArrival(
      context({
        advisories: [
          { name: 'Nearside front tyre', severity: 'AMBER', notedAt: daysFromNow(-30) },
          { name: 'Offside rear brake pipe', severity: 'RED', notedAt: daysFromNow(-30) },
        ],
      }),
    );

    expect(suggestions.map((suggestion) => suggestion.name)).toEqual([
      'Offside rear brake pipe',
      'Nearside front tyre',
    ]);
  });

  it('says the same thing once, on its strongest ground', () => {
    // Brake fluid can be overdue and declined last year at the same time.
    // Saying it twice makes the whole list look automated.
    const suggestions = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'Brake fluid',
            dueAt: daysFromNow(-10),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 24,
          },
        ],
        declined: [
          {
            serviceItemId: 's1',
            name: 'Brake fluid',
            declinedAt: daysFromNow(-200),
            quotedMinor: 5_400,
          },
        ],
      }),
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.basis).toBe('OVERDUE');
  });

  it('orders the list by how hard it is to argue with', () => {
    const suggestions = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'MOT',
            dueAt: daysFromNow(20),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 12,
          },
          {
            serviceItemId: 's3',
            name: 'Air conditioning',
            dueAt: daysFromNow(-5),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 24,
          },
        ],
        declined: [
          {
            serviceItemId: 's2',
            name: 'Rear pads',
            declinedAt: daysFromNow(-60),
            quotedMinor: null,
          },
        ],
      }),
    );

    expect(suggestions.map((suggestion) => suggestion.basis)).toEqual([
      'OVERDUE',
      'DUE_SOON',
      'DECLINED_BEFORE',
    ]);
  });

  it('falls back to the interval when nothing was scheduled', () => {
    const [first] = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'Coolant',
            dueAt: null,
            dueKm: null,
            lastPerformedAt: daysFromNow(-1_200),
            intervalMonths: 24,
          },
        ],
      }),
    );

    expect(first?.basis).toBe('INTERVAL');
    expect(first?.reason).toMatch(/on a 24-month interval/);
  });

  it('sums the list up in one sentence', () => {
    const suggestions = suggestOnArrival(
      context({
        schedules: [
          {
            serviceItemId: 's1',
            name: 'Brake fluid',
            dueAt: daysFromNow(-45),
            dueKm: null,
            lastPerformedAt: null,
            intervalMonths: 24,
          },
        ],
        declined: [
          {
            serviceItemId: 's2',
            name: 'Rear pads',
            declinedAt: daysFromNow(-60),
            quotedMinor: null,
          },
        ],
      }),
    );

    expect(describeArrival(suggestions)).toBe(
      '1 item is overdue, and 1 more worth raising while it is here.',
    );
  });
});
