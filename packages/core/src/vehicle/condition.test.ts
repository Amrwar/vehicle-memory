import { describe, expect, it } from 'vitest';

import { classifyPart, componentsFrom, componentsMissing, type Fitting } from './components';
import { healthOf, type HealthInput } from './health';
import { ownInterval, predictDue } from './prediction';

/**
 * Dates are anchored at nine in the morning rather than written bare.
 *
 * `new Date('2026-03-11')` is midnight UTC, which is the tenth in every
 * timezone west of London. A month arithmetic test written that way passes in
 * CI and fails on the machine of anybody in Montreal, which is exactly where
 * this product is being written.
 */
const at = (iso: string) => new Date(`${iso}T09:00:00`);

const NOW = at('2026-09-10');

function fitting(overrides: Partial<Fitting> & Pick<Fitting, 'description'>): Fitting {
  return {
    fittedOn: at('2025-09-10'),
    fittedAtKm: 100_000,
    jobId: 'job-1',
    jobNumber: 1,
    ...overrides,
  };
}

describe('classifyPart', () => {
  it('reads the axle, because front and rear wear differently', () => {
    expect(classifyPart('Front brake pads')).toBe('BRAKE_PADS_FRONT');
    expect(classifyPart('Rear brake pads, set')).toBe('BRAKE_PADS_REAR');
  });

  it('assumes front when no axle is stated, which is where pads usually go', () => {
    expect(classifyPart('Brake pads')).toBe('BRAKE_PADS_FRONT');
  });

  it('does not let brake fluid age the discs', () => {
    // "Brake fluid" contains "brake". A discs rule running first would reset
    // the disc age at every fluid change and report worn discs as new.
    expect(classifyPart('Brake fluid change, DOT 4')).toBe('BRAKE_FLUID');
  });

  it('recognises a battery by its technology as well as its name', () => {
    expect(classifyPart('Battery, 096 AGM')).toBe('BATTERY');
    expect(classifyPart('EFB 12V 70Ah')).toBe('BATTERY');
  });

  it('separates the cabin filter from the air filter', () => {
    expect(classifyPart('Cabin filter')).toBe('CABIN_FILTER');
    expect(classifyPart('Air filter element')).toBe('AIR_FILTER');
  });

  it('refuses to guess', () => {
    // The whole point of the conservative rules. An invented component age is
    // worse than a gap, because somebody plans around it.
    expect(classifyPart('Diagnostic time')).toBeNull();
    expect(classifyPart('Sundries and consumables')).toBeNull();
    expect(classifyPart('Wheel alignment')).toBeNull();
  });

  it('looks at the part number as well as the words', () => {
    expect(classifyPart('BP-402', 'Front pads BP-402')).toBe('BRAKE_PADS_FRONT');
  });
});

describe('componentsFrom', () => {
  it('keeps only the most recent fitting of each component', () => {
    const states = componentsFrom(
      [
        fitting({
          description: 'Front brake pads',
          fittedOn: at('2022-01-10'),
          fittedAtKm: 40_000,
        }),
        fitting({
          description: 'Front brake pads',
          fittedOn: at('2025-06-10'),
          fittedAtKm: 96_000,
        }),
      ],
      { now: NOW, currentKm: 100_000 },
    );

    expect(states).toHaveLength(1);
    expect(states[0]!.fittedAtKm).toBe(96_000);
    expect(states[0]!.ageMonths).toBe(15);
  });

  it('ages by whichever of time and distance has gone furthest', () => {
    // A van doing 40,000 km in a year has used up its pads on distance long
    // before it has on time, and the figure has to follow the worse of the two
    // or it reports a worn-out part as healthy.
    const [pads] = componentsFrom(
      [
        fitting({
          description: 'Front brake pads',
          fittedOn: at('2025-09-10'),
          fittedAtKm: 60_000,
        }),
      ],
      { now: NOW, currentKm: 100_000 },
    );

    expect(pads!.drivenBy).toBe('DISTANCE');
    expect(pads!.kmSince).toBe(40_000);
    expect(pads!.condition).toBe('DUE');
  });

  it('does not invent a distance when the vehicle has no current reading', () => {
    const [battery] = componentsFrom([fitting({ description: 'Battery, 096 AGM' })], {
      now: NOW,
      currentKm: null,
    });

    expect(battery!.kmSince).toBeNull();
    expect(battery!.drivenBy).toBe('AGE');
  });

  it('ignores a reading that went backwards rather than reporting negative wear', () => {
    const [battery] = componentsFrom(
      [fitting({ description: 'Battery, 096 AGM', fittedAtKm: 120_000 })],
      { now: NOW, currentKm: 100_000 },
    );

    expect(battery!.kmSince).toBeNull();
  });

  it('puts the worst component first', () => {
    const states = componentsFrom(
      [
        fitting({ description: 'Cabin filter', fittedOn: at('2026-06-10'), fittedAtKm: 99_000 }),
        fitting({ description: 'Timing belt', fittedOn: at('2018-01-10'), fittedAtKm: 20_000 }),
      ],
      { now: NOW, currentKm: 100_000 },
    );

    expect(states[0]!.component).toBe('TIMING_BELT');
    expect(states[0]!.condition).toBe('OVERDUE');
    expect(states[1]!.condition).toBe('NEW');
  });

  it('does not cap how far past its life something is', () => {
    // A belt at 1.8 is a different conversation from one at 1.05, and capping
    // at 1 would make them read the same.
    const [belt] = componentsFrom(
      [fitting({ description: 'Timing belt', fittedOn: at('2010-01-10'), fittedAtKm: 10_000 })],
      { now: NOW, currentKm: 300_000 },
    );

    expect(belt!.usedUp).toBeGreaterThan(2);
  });

  it('names what there is no record of, because the gap is information', () => {
    const states = componentsFrom([fitting({ description: 'Battery, 096 AGM' })], { now: NOW });

    expect(componentsMissing(states)).toContain('TIMING_BELT');
    expect(componentsMissing(states)).not.toContain('BATTERY');
  });
});

describe('healthOf', () => {
  const base: HealthInput = {
    schedules: [{ name: 'Annual service', dueAt: at('2027-01-10'), dueKm: 120_000 }],
    openCritical: 0,
    openAdvisory: 0,
    inspectionsEver: 2,
    lastInspectionAt: at('2026-08-10'),
    declinedTotal: 0,
    declinedCritical: 0,
    components: [{ label: 'Battery', usedUp: 0.2 }],
    visits: 5,
    currentKm: 100_000,
    now: NOW,
  };

  it('scores a well-kept vehicle highly', () => {
    const health = healthOf(base);

    expect(health.score).toBeGreaterThanOrEqual(85);
    expect(health.band).toBe('EXCELLENT');
    expect(health.coverage).toBe(1);
  });

  it('excludes what it cannot know rather than scoring it zero', () => {
    // The failure that makes these numbers lie. A vehicle with no inspection
    // on record has not failed an inspection.
    const health = healthOf({
      ...base,
      schedules: [],
      inspectionsEver: 0,
      lastInspectionAt: null,
      components: [],
    });

    expect(health.unknown.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['MAINTENANCE', 'OPEN_ISSUES', 'COMPONENTS', 'INSPECTION']),
    );
    expect(health.factors.every((factor) => factor.score > 0)).toBe(true);
    expect(health.coverage).toBeLessThan(1);
  });

  it('renormalises so a missing factor neither helps nor hurts', () => {
    const full = healthOf(base);
    const withoutHistory = healthOf({ ...base, visits: 0 });

    // Removing a factor that was scoring full marks must not move the others.
    expect(withoutHistory.factors.reduce((total, factor) => total + factor.weight, 0)).toBeCloseTo(
      1,
      6,
    );
    expect(full.factors.reduce((total, factor) => total + factor.weight, 0)).toBeCloseTo(1, 6);
  });

  it('says nothing at all when there is nothing on record', () => {
    const health = healthOf({
      schedules: [],
      openCritical: 0,
      openAdvisory: 0,
      inspectionsEver: 0,
      lastInspectionAt: null,
      declinedTotal: 0,
      declinedCritical: 0,
      components: [],
      visits: 0,
      currentKm: null,
      now: NOW,
    });

    expect(health.score).toBeNull();
    expect(health.band).toBe('UNKNOWN');
  });

  it('weighs an open critical finding heavily', () => {
    const health = healthOf({ ...base, openCritical: 2 });

    const issues = health.factors.find((factor) => factor.id === 'OPEN_ISSUES')!;
    expect(issues.score).toBe(40);
    expect(health.score).toBeLessThan(base.visits * 20);
  });

  it('measures how late a service is, not merely that it is late', () => {
    const week = healthOf({
      ...base,
      schedules: [{ name: 'Annual service', dueAt: at('2026-09-03'), dueKm: null }],
    });
    const year = healthOf({
      ...base,
      schedules: [{ name: 'Annual service', dueAt: at('2025-09-10'), dueKm: null }],
    });

    const weekScore = week.factors.find((factor) => factor.id === 'MAINTENANCE')!.score;
    const yearScore = year.factors.find((factor) => factor.id === 'MAINTENANCE')!.score;

    expect(yearScore).toBeLessThan(weekScore);
    expect(yearScore).toBe(0);
  });

  it('lets one ruined component outweigh nine good ones', () => {
    // An average would call this healthy. It is a car with a timing belt at
    // twice its life.
    const health = healthOf({
      ...base,
      components: [
        { label: 'Timing belt', usedUp: 2 },
        ...Array.from({ length: 9 }, () => ({ label: 'Filter', usedUp: 0.1 })),
      ],
    });

    const components = health.factors.find((factor) => factor.id === 'COMPONENTS')!;
    expect(components.score).toBeLessThan(40);
    expect(components.why).toContain('Timing belt');
  });

  it('never leaves the nought to a hundred it promises', () => {
    const wrecked = healthOf({
      ...base,
      openCritical: 20,
      openAdvisory: 50,
      declinedTotal: 40,
      declinedCritical: 20,
      components: [{ label: 'Timing belt', usedUp: 9 }],
      schedules: [{ name: 'Annual service', dueAt: at('2015-01-10'), dueKm: null }],
    });

    expect(wrecked.score).toBeGreaterThanOrEqual(0);
    expect(wrecked.score).toBeLessThanOrEqual(100);
    expect(wrecked.factors.every((factor) => factor.score >= 0 && factor.score <= 100)).toBe(true);
  });

  it('gives every factor that counted a reason', () => {
    const health = healthOf(base);
    expect(health.factors.every((factor) => factor.why.length > 10)).toBe(true);
  });
});

describe('ownInterval', () => {
  it('needs more than one gap before it has an opinion', () => {
    expect(ownInterval([10_000, 40_000])).toBeNull();
    expect(ownInterval([10_000])).toBeNull();
    expect(ownInterval([])).toBeNull();
  });

  it('takes the median, so one early replacement does not skew every estimate', () => {
    // 30,000, 30,000 and 2,000. A mean would say 20,667 and predict the next
    // change a third too early for the rest of the vehicle's life.
    expect(ownInterval([0, 30_000, 60_000, 62_000])).toBe(30_000);
  });

  it('ignores two lines on the same job', () => {
    expect(ownInterval([10_000, 10_050, 40_000, 70_000])).toBe(30_000);
  });

  it('does not care what order it is given', () => {
    expect(ownInterval([60_000, 0, 30_000])).toBe(ownInterval([0, 30_000, 60_000]));
  });
});

describe('predictDue', () => {
  const components = componentsFrom(
    [
      fitting({
        description: 'Engine oil and filter',
        fittedOn: at('2026-03-10'),
        fittedAtKm: 92_000,
      }),
    ],
    { now: NOW, currentKm: 100_000 },
  );

  it('uses the vehicle own interval once it has one, and says so', () => {
    const [oil] = predictDue({
      components,
      historyKm: new Map([['OIL_AND_FILTER', [62_000, 77_000, 92_000]]]),
      currentKm: 100_000,
      kmPerDay: 40,
      now: NOW,
    });

    expect(oil!.basis).toBe('THIS_VEHICLE');
    expect(oil!.why).toContain('15,000');
    // 15,000 learned, 8,000 travelled, so about 7,000 to go.
    expect(oil!.kmAway).toBe(7_000);
  });

  it('falls back to the general life, and says that too', () => {
    const [oil] = predictDue({
      components,
      historyKm: new Map(),
      currentKm: 100_000,
      kmPerDay: 40,
      now: NOW,
    });

    expect(oil!.basis).toBe('GENERAL');
    expect(oil!.why).toContain('general');
  });

  it('gives no distance when there is no reading to count from', () => {
    const noReading = componentsFrom(
      [fitting({ description: 'Engine oil and filter', fittedAtKm: null })],
      { now: NOW, currentKm: null },
    );

    const [oil] = predictDue({
      components: noReading,
      historyKm: new Map(),
      currentKm: null,
      kmPerDay: null,
      now: NOW,
    });

    expect(oil!.kmAway).toBeNull();
    expect(oil!.why).toContain('age alone');
  });

  it('loses confidence the further out it reaches', () => {
    const near = predictDue({
      components,
      historyKm: new Map([['OIL_AND_FILTER', [62_000, 77_000, 92_000]]]),
      currentKm: 100_000,
      kmPerDay: 40,
      now: NOW,
    })[0]!;

    const far = predictDue({
      components,
      historyKm: new Map([['OIL_AND_FILTER', [62_000, 77_000, 92_000]]]),
      currentKm: 100_000,
      kmPerDay: 2,
      now: NOW,
    })[0]!;

    expect(near.confidence).toBe('HIGH');
    expect(far.confidence).toBe('LOW');
  });

  it('marks what is already past', () => {
    const overdue = componentsFrom(
      [
        fitting({
          description: 'Engine oil and filter',
          fittedOn: at('2023-01-10'),
          fittedAtKm: 40_000,
        }),
      ],
      { now: NOW, currentKm: 100_000 },
    );

    const [oil] = predictDue({
      components: overdue,
      historyKm: new Map(),
      currentKm: 100_000,
      kmPerDay: 40,
      now: NOW,
    });

    expect(oil!.overdue).toBe(true);
    expect(oil!.kmAway).toBeLessThan(0);
  });

  it('orders by what arrives first', () => {
    const several = componentsFrom(
      [
        fitting({ description: 'Timing belt', fittedOn: at('2026-08-10'), fittedAtKm: 99_000 }),
        fitting({
          description: 'Engine oil and filter',
          fittedOn: at('2025-09-10'),
          fittedAtKm: 88_000,
        }),
      ],
      { now: NOW, currentKm: 100_000 },
    );

    const predictions = predictDue({
      components: several,
      historyKm: new Map(),
      currentKm: 100_000,
      kmPerDay: 40,
      now: NOW,
    });

    expect(predictions[0]!.component).toBe('OIL_AND_FILTER');
  });
});
