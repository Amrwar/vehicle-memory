import { add, type Money, money, multiply, subtract, sum, zero } from '../shared/money';

/**
 * Technician and advisor commission.
 *
 * The basis matters more than the rate. Paying on revenue rewards writing
 * large invoices; paying on gross profit rewards writing profitable ones, and
 * those are not the same job. A workshop that pays on revenue and then
 * wonders why its parts margin keeps slipping has usually answered its own
 * question.
 *
 * Every scheme here computes from figures the ledger already holds, so a
 * commission statement can be traced to the invoices behind it rather than
 * taken on trust.
 */

export type CommissionBasis =
  /** Labour sold, net of tax and discount. */
  | 'LABOUR_REVENUE'
  /** Labour sold less what the clocked time cost. */
  | 'LABOUR_PROFIT'
  /** Parts sold less what the parts cost. */
  | 'PARTS_PROFIT'
  /** Everything sold less everything it cost. */
  | 'JOB_PROFIT'
  /** A flat amount for each job completed. */
  | 'PER_JOB';

export interface CommissionBand {
  /**
   * The scheme pays this rate on the part of the basis above this figure.
   *
   * Marginal, not cliff-edge: a band that paid its rate on the whole amount
   * would mean one extra pound of sales changing the payment by hundreds,
   * which is how a bonus scheme starts distorting behaviour at month end.
   */
  fromMinor: number;
  /** Percentage of the basis in this band, or the per-job amount. */
  rate: number;
}

export interface CommissionScheme {
  id: string;
  name: string;
  basis: CommissionBasis;
  /** Ordered ascending by `fromMinor`. Validated on construction. */
  bands: CommissionBand[];
  /**
   * Nothing is paid until the basis clears this. Distinct from a first band
   * at zero rate: a threshold means the target was not met at all.
   */
  thresholdMinor: number;
  /** Paid even when the calculation comes out lower. */
  guaranteeMinor: number;
  /** Withheld until the customer has actually paid. */
  paidOnSettlement: boolean;
}

export class CommissionError extends Error {
  readonly code: 'UNORDERED_BANDS' | 'NEGATIVE_RATE' | 'NO_BANDS';
  constructor(code: CommissionError['code'], message: string) {
    super(message);
    this.name = 'CommissionError';
    this.code = code;
  }
}

export function assertScheme(scheme: CommissionScheme): void {
  if (scheme.bands.length === 0) {
    throw new CommissionError('NO_BANDS', `Scheme "${scheme.name}" pays nothing on anything.`);
  }

  for (const [index, band] of scheme.bands.entries()) {
    if (band.rate < 0) {
      throw new CommissionError(
        'NEGATIVE_RATE',
        `Scheme "${scheme.name}" has a negative rate. A commission scheme cannot take money back.`,
      );
    }

    const previous = scheme.bands[index - 1];
    if (previous && band.fromMinor <= previous.fromMinor) {
      throw new CommissionError(
        'UNORDERED_BANDS',
        `Scheme "${scheme.name}" has bands out of order at ${band.fromMinor}.`,
      );
    }
  }
}

/* ---------------------------------------------------------------------------
   The basis
   --------------------------------------------------------------------------- */

export interface CommissionableJob {
  jobId: string;
  jobNumber: number;
  completedAt: Date;
  labourRevenue: Money;
  labourCost: Money;
  partsRevenue: Money;
  partsCost: Money;
  feeRevenue: Money;
  /** False while the invoice is unpaid. */
  settled: boolean;
}

export function basisFor(job: CommissionableJob, basis: CommissionBasis): Money {
  switch (basis) {
    case 'LABOUR_REVENUE':
      return job.labourRevenue;
    case 'LABOUR_PROFIT':
      return subtract(job.labourRevenue, job.labourCost);
    case 'PARTS_PROFIT':
      return subtract(job.partsRevenue, job.partsCost);
    case 'JOB_PROFIT':
      return subtract(
        sum([job.labourRevenue, job.partsRevenue, job.feeRevenue], job.labourRevenue.currency),
        add(job.labourCost, job.partsCost),
      );
    case 'PER_JOB':
      // The count is the basis; one job is one unit, held in minor units so
      // the band arithmetic below has one shape rather than two.
      return money(100, job.labourRevenue.currency);
  }
}

/* ---------------------------------------------------------------------------
   Calculation
   --------------------------------------------------------------------------- */

export interface CommissionResult {
  schemeName: string;
  basis: CommissionBasis;
  /** Jobs that counted. */
  jobs: CommissionableJob[];
  /** Jobs excluded because the customer has not paid yet. */
  withheld: CommissionableJob[];
  basisTotal: Money;
  /** Basis less the threshold; what the bands are applied to. */
  qualifying: Money;
  earned: Money;
  /** True when the guarantee paid more than the calculation. */
  guaranteeApplied: boolean;
  bandBreakdown: { fromMinor: number; rate: number; amount: Money }[];
  /** Set when the threshold was not cleared, so the statement can say why. */
  shortfall: Money | null;
}

export function calculateCommission(
  scheme: CommissionScheme,
  jobs: readonly CommissionableJob[],
  currency = 'GBP',
): CommissionResult {
  assertScheme(scheme);

  const withheld = scheme.paidOnSettlement ? jobs.filter((job) => !job.settled) : [];
  const counted = scheme.paidOnSettlement ? jobs.filter((job) => job.settled) : [...jobs];

  const basisTotal =
    scheme.basis === 'PER_JOB'
      ? money(counted.length * 100, currency)
      : sum(
          counted.map((job) => basisFor(job, scheme.basis)),
          currency,
        );

  // A negative basis means the work lost money. Paying a percentage of a loss
  // is nonsense, and clamping keeps the guarantee as the only floor.
  const above = Math.max(0, basisTotal.minor - scheme.thresholdMinor);
  const qualifying = money(above, currency);

  const breakdown: CommissionResult['bandBreakdown'] = [];
  let earnedMinor = 0;

  if (scheme.basis === 'PER_JOB') {
    // Bands count jobs rather than money: `fromMinor` is a job count in the
    // same minor-unit scale, and the rate is an amount per job.
    for (const [index, band] of scheme.bands.entries()) {
      const next = scheme.bands[index + 1];
      const from = band.fromMinor;
      const to = next ? next.fromMinor : Number.POSITIVE_INFINITY;
      const jobsInBand = Math.max(0, Math.min(counted.length * 100, to) - from) / 100;
      if (jobsInBand <= 0) continue;

      const amount = money(Math.round(jobsInBand * band.rate * 100), currency);
      earnedMinor += amount.minor;
      breakdown.push({ fromMinor: from, rate: band.rate, amount });
    }
  } else {
    for (const [index, band] of scheme.bands.entries()) {
      const next = scheme.bands[index + 1];
      const from = band.fromMinor;
      const to = next ? next.fromMinor : Number.POSITIVE_INFINITY;
      const inBand = Math.max(0, Math.min(above, to) - from);
      if (inBand <= 0) continue;

      const amount = multiply(money(inBand, currency), band.rate / 100);
      earnedMinor += amount.minor;
      breakdown.push({ fromMinor: from, rate: band.rate, amount });
    }
  }

  const calculated = money(earnedMinor, currency);
  const guaranteeApplied = scheme.guaranteeMinor > calculated.minor;

  return {
    schemeName: scheme.name,
    basis: scheme.basis,
    jobs: counted,
    withheld,
    basisTotal,
    qualifying,
    earned: guaranteeApplied ? money(scheme.guaranteeMinor, currency) : calculated,
    guaranteeApplied,
    bandBreakdown: breakdown,
    shortfall:
      basisTotal.minor < scheme.thresholdMinor
        ? money(scheme.thresholdMinor - basisTotal.minor, currency)
        : null,
  };
}

/** Explains a result in the words a payslip query needs answering in. */
export function explainCommission(result: CommissionResult): string {
  if (result.shortfall) {
    return `Below the threshold by ${format(result.shortfall)}. Nothing earned on ${result.jobs.length} job${result.jobs.length === 1 ? '' : 's'}.`;
  }

  if (result.guaranteeApplied) {
    return `The guarantee paid more than the calculation, so the guarantee applies.`;
  }

  const withheld = result.withheld.length;
  const note = withheld
    ? ` ${withheld} job${withheld === 1 ? '' : 's'} held back until the customer pays.`
    : '';

  return `${format(result.earned)} on ${result.jobs.length} job${result.jobs.length === 1 ? '' : 's'}.${note}`;
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

/* ---------------------------------------------------------------------------
   Timesheets
   --------------------------------------------------------------------------- */

export type TimesheetStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'PAID';

/**
 * A timesheet is approved once and then stops moving.
 *
 * Payroll is the one place where "somebody edited it afterwards" is not a
 * recoverable situation, so the transitions are deliberately narrow: an
 * approved sheet can only be paid, and a paid one cannot be touched at all.
 * A correction is a new adjustment on the next period, never an edit to a
 * period somebody has already been paid for.
 */
const TIMESHEET_TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  OPEN: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'OPEN'],
  APPROVED: ['PAID', 'SUBMITTED'],
  PAID: [],
};

export function canTransitionTimesheet(from: TimesheetStatus, to: TimesheetStatus): boolean {
  return TIMESHEET_TRANSITIONS[from].includes(to);
}

export function assertTimesheetTransition(from: TimesheetStatus, to: TimesheetStatus): void {
  if (canTransitionTimesheet(from, to)) return;

  throw new Error(
    from === 'PAID'
      ? 'This timesheet has been paid. Correct it with an adjustment on the next period rather than by editing this one.'
      : `A timesheet cannot go from ${from.toLowerCase()} to ${to.toLowerCase()}.`,
  );
}

export interface TimesheetTotals {
  ordinaryMinutes: number;
  overtimeMinutes: number;
  absenceMinutes: number;
  ordinaryPay: Money;
  overtimePay: Money;
  gross: Money;
}

/**
 * Splits attendance into ordinary and overtime, and prices both.
 *
 * The threshold is per period rather than per day, which is what most
 * contracts say and is not what a naive daily calculation produces.
 */
export function timesheetTotals(input: {
  attendedMinutes: number;
  absenceMinutes: number;
  ordinaryMinutesPerPeriod: number;
  costPerHour: Money;
  overtimeMultiplier: number;
}): TimesheetTotals {
  const ordinary = Math.min(input.attendedMinutes, input.ordinaryMinutesPerPeriod);
  const overtime = Math.max(0, input.attendedMinutes - input.ordinaryMinutesPerPeriod);

  const ordinaryPay = multiply(input.costPerHour, ordinary / 60);
  const overtimePay = multiply(input.costPerHour, (overtime / 60) * input.overtimeMultiplier);

  return {
    ordinaryMinutes: ordinary,
    overtimeMinutes: overtime,
    absenceMinutes: input.absenceMinutes,
    ordinaryPay,
    overtimePay,
    gross: add(ordinaryPay, overtimePay),
  };
}

/** An empty result, so a page can render a person with no activity. */
export function noCommission(schemeName: string, basis: CommissionBasis): CommissionResult {
  return {
    schemeName,
    basis,
    jobs: [],
    withheld: [],
    basisTotal: zero('GBP'),
    qualifying: zero('GBP'),
    earned: zero('GBP'),
    guaranteeApplied: false,
    bandBreakdown: [],
    shortfall: null,
  };
}
