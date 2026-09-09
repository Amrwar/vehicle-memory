import { describe, expect, it } from 'vitest';

import { money, toDecimalString } from '../shared/money';
import {
  assertTimesheetTransition,
  basisFor,
  calculateCommission,
  canTransitionTimesheet,
  type CommissionableJob,
  CommissionError,
  type CommissionScheme,
  explainCommission,
  timesheetTotals,
} from './commission';
import { applyRise, assertCoherent, costOfHours, type PayRate, PayRateError, rateOn } from './pay';
import {
  attendedMinutes,
  implausible,
  overlapping,
  productivityFor,
  summariseTeam,
} from './productivity';

const gbp = (major: number) => money(Math.round(major * 100));
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day);

/* ===========================================================================
   Pay rates
   =========================================================================== */

const HISTORY: PayRate[] = [
  {
    effectiveFrom: on(2024, 1, 1),
    effectiveTo: on(2025, 4, 1),
    costPerHour: gbp(28),
    chargePerHour: gbp(85),
  },
  {
    effectiveFrom: on(2025, 4, 1),
    effectiveTo: on(2026, 4, 1),
    costPerHour: gbp(31),
    chargePerHour: gbp(92),
  },
  {
    effectiveFrom: on(2026, 4, 1),
    effectiveTo: null,
    costPerHour: gbp(34),
    chargePerHour: gbp(95),
  },
];

describe('pay rates', () => {
  it('finds the rate in force on a day', () => {
    expect(rateOn(HISTORY, on(2024, 6, 1))?.costPerHour.minor).toBe(2800);
    expect(rateOn(HISTORY, on(2025, 6, 1))?.costPerHour.minor).toBe(3100);
    expect(rateOn(HISTORY, on(2026, 6, 1))?.costPerHour.minor).toBe(3400);
  });

  it('treats the start date as inclusive and the end date as exclusive', () => {
    // The day a rise takes effect is paid at the new rate, and the last day of
    // the old rate is the day before. Getting this wrong costs one day a year
    // per person and is invisible in every total.
    expect(rateOn(HISTORY, on(2025, 4, 1))?.costPerHour.minor).toBe(3100);
    expect(rateOn(HISTORY, on(2025, 3, 31))?.costPerHour.minor).toBe(2800);
  });

  it('has no rate before employment began', () => {
    expect(rateOn(HISTORY, on(2023, 12, 31))).toBeUndefined();
  });

  it('refuses two rates covering the same day', () => {
    const overlapping: PayRate[] = [{ ...HISTORY[0]!, effectiveTo: on(2025, 6, 1) }, HISTORY[1]!];

    expect(() => assertCoherent(overlapping)).toThrow(PayRateError);
    try {
      assertCoherent(overlapping);
    } catch (error) {
      expect((error as PayRateError).code).toBe('OVERLAP');
    }
  });

  it('refuses a rate that ends before it starts', () => {
    expect(() =>
      assertCoherent([
        {
          effectiveFrom: on(2025, 6, 1),
          effectiveTo: on(2025, 1, 1),
          costPerHour: gbp(30),
          chargePerHour: gbp(90),
        },
      ]),
    ).toThrow(/ends before it begins/);
  });

  it('refuses two open-ended rates', () => {
    expect(() =>
      assertCoherent([
        { ...HISTORY[2]! },
        {
          effectiveFrom: on(2026, 9, 1),
          effectiveTo: null,
          costPerHour: gbp(36),
          chargePerHour: gbp(98),
        },
      ]),
    ).toThrow(PayRateError);
  });

  it('closes the open rate when a rise is applied', () => {
    const next = applyRise([HISTORY[2]!], on(2026, 10, 1), gbp(36), gbp(99));

    expect(next).toHaveLength(2);
    expect(next[0]!.effectiveTo).toEqual(on(2026, 10, 1));
    expect(next[1]!.effectiveTo).toBeNull();
    expect(() => assertCoherent(next)).not.toThrow();
  });

  it('costs historic time at the historic rate, not at today’s', () => {
    // The whole point. A rise in April must not change what March cost.
    const march = costOfHours(HISTORY, [{ at: on(2025, 3, 10), minutes: 480 }]);
    const may = costOfHours(HISTORY, [{ at: on(2025, 5, 10), minutes: 480 }]);

    expect(toDecimalString(march)).toBe('224.00');
    expect(toDecimalString(may)).toBe('248.00');
  });

  it('splits a period that straddles a rate change', () => {
    const cost = costOfHours(HISTORY, [
      { at: on(2025, 3, 31), minutes: 480 },
      { at: on(2025, 4, 1), minutes: 480 },
    ]);

    expect(toDecimalString(cost)).toBe('472.00');
  });

  it('ignores time worked before any rate existed', () => {
    expect(costOfHours(HISTORY, [{ at: on(2020, 1, 1), minutes: 480 }]).minor).toBe(0);
  });
});

/* ===========================================================================
   Attendance and productivity
   =========================================================================== */

describe('attendance', () => {
  it('subtracts breaks', () => {
    expect(
      attendedMinutes([
        {
          startedAt: new Date('2026-09-08T08:00:00Z'),
          endedAt: new Date('2026-09-08T17:00:00Z'),
          breakMinutes: 60,
        },
      ]),
    ).toBe(480);
  });

  it('counts an open shift up to now rather than to zero', () => {
    const minutes = attendedMinutes(
      [{ startedAt: new Date('2026-09-08T08:00:00Z'), endedAt: null, breakMinutes: 0 }],
      new Date('2026-09-08T11:30:00Z'),
    );

    expect(minutes).toBe(210);
  });

  it('never returns negative minutes when the break exceeds the shift', () => {
    expect(
      attendedMinutes([
        {
          startedAt: new Date('2026-09-08T08:00:00Z'),
          endedAt: new Date('2026-09-08T08:30:00Z'),
          breakMinutes: 60,
        },
      ]),
    ).toBe(0);
  });

  it('finds overlapping shifts one person cannot have worked', () => {
    const spans = [
      {
        startedAt: new Date('2026-09-08T08:00:00Z'),
        endedAt: new Date('2026-09-08T17:00:00Z'),
        breakMinutes: 0,
      },
      {
        startedAt: new Date('2026-09-08T16:00:00Z'),
        endedAt: new Date('2026-09-08T18:00:00Z'),
        breakMinutes: 0,
      },
    ];

    expect(overlapping(spans)).toHaveLength(1);
  });

  it('treats a shift left open overnight as overlapping the next one', () => {
    const spans = [
      { startedAt: new Date('2026-09-08T08:00:00Z'), endedAt: null, breakMinutes: 0 },
      {
        startedAt: new Date('2026-09-09T08:00:00Z'),
        endedAt: new Date('2026-09-09T17:00:00Z'),
        breakMinutes: 0,
      },
    ];

    expect(overlapping(spans)).toHaveLength(1);
  });

  it('flags an implausibly long shift', () => {
    expect(
      implausible(
        [{ startedAt: new Date('2026-09-08T06:00:00Z'), endedAt: null, breakMinutes: 0 }],
        new Date('2026-09-09T06:00:00Z'),
      ),
    ).toHaveLength(1);
  });
});

describe('productivity', () => {
  const day = {
    technicianId: 'tech-1',
    technicianName: 'John Barnes',
    attendedMinutes: 480,
    productiveMinutes: 384,
    soldMinutes: 420,
    labourCost: gbp(272),
    labourRevenue: gbp(665),
    jobsTouched: 4,
  };

  it('computes all three ratios', () => {
    const result = productivityFor(day);

    expect(result.utilisationPct).toBe(80);
    expect(result.efficiencyPct).toBe(109.4);
    expect(result.productivityPct).toBe(87.5);
  });

  it('costs the whole attended day, not just the sold part', () => {
    // The distinction that makes the figure honest: idle time was still paid.
    const result = productivityFor(day);
    expect(toDecimalString(result.labourProfit)).toBe('393.00');
    expect(result.idleMinutes).toBe(96);
  });

  it('reports every ratio as null rather than zero when nobody attended', () => {
    const result = productivityFor({
      ...day,
      attendedMinutes: 0,
      productiveMinutes: 0,
      soldMinutes: 0,
    });

    expect(result.utilisationPct).toBeNull();
    expect(result.efficiencyPct).toBeNull();
    expect(result.productivityPct).toBeNull();
    expect(result.revenuePerAttendedHour.minor).toBe(0);
  });

  it('never reports negative idle time', () => {
    const result = productivityFor({ ...day, productiveMinutes: 600 });
    expect(result.idleMinutes).toBe(0);
  });

  it('surfaces people who clocked more job time than attendance', () => {
    const team = summariseTeam([day, { ...day, technicianId: 'tech-2', productiveMinutes: 600 }]);

    expect(team.suspect).toHaveLength(1);
    expect(team.suspect[0]!.technicianId).toBe('tech-2');
  });

  it('ranks the team by productivity, the ratio that pays wages', () => {
    const team = summariseTeam([
      { ...day, technicianId: 'slow', soldMinutes: 300 },
      { ...day, technicianId: 'quick', soldMinutes: 500 },
    ]);

    expect(team.people[0]!.technicianId).toBe('quick');
  });

  it('totals the team from minutes rather than averaging percentages', () => {
    // Averaging two people's percentages weights a half-day the same as a full
    // one. The totals must come from the underlying minutes.
    const team = summariseTeam([
      { ...day, attendedMinutes: 480, soldMinutes: 480 },
      { ...day, technicianId: 'tech-2', attendedMinutes: 120, soldMinutes: 0 },
    ]);

    expect(team.totals.productivityPct).toBe(80);
  });
});

/* ===========================================================================
   Commission
   =========================================================================== */

const JOB: CommissionableJob = {
  jobId: 'job-1',
  jobNumber: 10_482,
  completedAt: on(2026, 9, 1),
  labourRevenue: gbp(400),
  labourCost: gbp(150),
  partsRevenue: gbp(300),
  partsCost: gbp(200),
  feeRevenue: gbp(20),
  settled: true,
};

const FLAT: CommissionScheme = {
  id: 'flat',
  name: 'Labour 10%',
  basis: 'LABOUR_REVENUE',
  bands: [{ fromMinor: 0, rate: 10 }],
  thresholdMinor: 0,
  guaranteeMinor: 0,
  paidOnSettlement: false,
};

describe('commission', () => {
  it('pays a flat rate on labour revenue', () => {
    const result = calculateCommission(FLAT, [JOB]);
    expect(toDecimalString(result.earned)).toBe('40.00');
  });

  it('computes each basis from the figures the ledger holds', () => {
    expect(toDecimalString(basisFor(JOB, 'LABOUR_REVENUE'))).toBe('400.00');
    expect(toDecimalString(basisFor(JOB, 'LABOUR_PROFIT'))).toBe('250.00');
    expect(toDecimalString(basisFor(JOB, 'PARTS_PROFIT'))).toBe('100.00');
    expect(toDecimalString(basisFor(JOB, 'JOB_PROFIT'))).toBe('370.00');
  });

  it('pays bands marginally, not on the whole amount', () => {
    // A cliff-edge band means one extra pound of sales changes the payment by
    // hundreds, which distorts behaviour at month end.
    const tiered: CommissionScheme = {
      ...FLAT,
      name: 'Tiered',
      bands: [
        { fromMinor: 0, rate: 5 },
        { fromMinor: 20_000, rate: 10 },
      ],
    };

    // 400.00 basis: 200 at 5% plus 200 at 10% = 10 + 20.
    const result = calculateCommission(tiered, [JOB]);
    expect(toDecimalString(result.earned)).toBe('30.00');
    expect(result.bandBreakdown).toHaveLength(2);
  });

  it('pays nothing below the threshold and says by how much', () => {
    const result = calculateCommission({ ...FLAT, thresholdMinor: 50_000 }, [JOB]);

    expect(result.earned.minor).toBe(0);
    expect(toDecimalString(result.shortfall!)).toBe('100.00');
    expect(explainCommission(result)).toMatch(/Below the threshold/);
  });

  it('applies the bands only above the threshold', () => {
    const result = calculateCommission({ ...FLAT, thresholdMinor: 30_000 }, [JOB]);
    expect(toDecimalString(result.earned)).toBe('10.00');
  });

  it('pays the guarantee when the calculation comes out lower', () => {
    const result = calculateCommission({ ...FLAT, guaranteeMinor: 10_000 }, [JOB]);

    expect(toDecimalString(result.earned)).toBe('100.00');
    expect(result.guaranteeApplied).toBe(true);
  });

  it('withholds commission on jobs the customer has not paid for', () => {
    const result = calculateCommission({ ...FLAT, paidOnSettlement: true }, [
      JOB,
      { ...JOB, jobId: 'job-2', settled: false },
    ]);

    expect(result.jobs).toHaveLength(1);
    expect(result.withheld).toHaveLength(1);
    expect(toDecimalString(result.earned)).toBe('40.00');
    expect(explainCommission(result)).toMatch(/held back until the customer pays/);
  });

  it('never pays a percentage of a loss', () => {
    const lossMaking: CommissionableJob = { ...JOB, labourRevenue: gbp(10), labourCost: gbp(400) };
    const result = calculateCommission({ ...FLAT, basis: 'LABOUR_PROFIT' }, [lossMaking]);

    expect(result.earned.minor).toBe(0);
  });

  it('pays a flat amount per job on a per-job scheme', () => {
    const perJob: CommissionScheme = {
      ...FLAT,
      name: 'Per job',
      basis: 'PER_JOB',
      bands: [{ fromMinor: 0, rate: 12 }],
    };

    const result = calculateCommission(perJob, [JOB, { ...JOB, jobId: 'job-2' }]);
    expect(toDecimalString(result.earned)).toBe('24.00');
  });

  it('refuses a scheme with bands out of order', () => {
    expect(() =>
      calculateCommission(
        {
          ...FLAT,
          bands: [
            { fromMinor: 20_000, rate: 10 },
            { fromMinor: 0, rate: 5 },
          ],
        },
        [JOB],
      ),
    ).toThrow(CommissionError);
  });

  it('refuses a scheme that could take money back', () => {
    expect(() =>
      calculateCommission({ ...FLAT, bands: [{ fromMinor: 0, rate: -5 }] }, [JOB]),
    ).toThrow(/cannot take money back/);
  });

  it('refuses a scheme that pays nothing on anything', () => {
    expect(() => calculateCommission({ ...FLAT, bands: [] }, [JOB])).toThrow(/pays nothing/);
  });
});

/* ===========================================================================
   Timesheets
   =========================================================================== */

describe('timesheets', () => {
  it('allows the ordinary path through approval', () => {
    expect(canTransitionTimesheet('OPEN', 'SUBMITTED')).toBe(true);
    expect(canTransitionTimesheet('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransitionTimesheet('APPROVED', 'PAID')).toBe(true);
  });

  it('allows an approval to be taken back before payment', () => {
    expect(canTransitionTimesheet('APPROVED', 'SUBMITTED')).toBe(true);
    expect(canTransitionTimesheet('SUBMITTED', 'OPEN')).toBe(true);
  });

  it('refuses to reopen a paid timesheet, and says what to do instead', () => {
    expect(() => assertTimesheetTransition('PAID', 'APPROVED')).toThrow(
      /adjustment on the next period/,
    );
  });

  it('refuses to skip approval', () => {
    expect(() => assertTimesheetTransition('OPEN', 'PAID')).toThrow(/cannot go from open to paid/);
  });

  it('splits overtime against a period threshold, not a daily one', () => {
    const totals = timesheetTotals({
      attendedMinutes: 45 * 60,
      absenceMinutes: 0,
      ordinaryMinutesPerPeriod: 40 * 60,
      costPerHour: gbp(30),
      overtimeMultiplier: 1.5,
    });

    expect(totals.ordinaryMinutes).toBe(2400);
    expect(totals.overtimeMinutes).toBe(300);
    expect(toDecimalString(totals.ordinaryPay)).toBe('1200.00');
    expect(toDecimalString(totals.overtimePay)).toBe('225.00');
    expect(toDecimalString(totals.gross)).toBe('1425.00');
  });

  it('records no overtime for a short week', () => {
    const totals = timesheetTotals({
      attendedMinutes: 30 * 60,
      absenceMinutes: 10 * 60,
      ordinaryMinutesPerPeriod: 40 * 60,
      costPerHour: gbp(30),
      overtimeMultiplier: 1.5,
    });

    expect(totals.overtimeMinutes).toBe(0);
    expect(toDecimalString(totals.gross)).toBe('900.00');
  });
});
