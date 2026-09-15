import { ACCOUNT } from '../accounting/accounts';
import { type JournalEntryDraft } from '../accounting/posting';
import { type CsvColumn, toCsv } from '../pos/csv';
import { add, type Money, subtract, sum, zero } from '../shared/money';

/**
 * Handing the wages to whoever pays them.
 *
 * The product does not run payroll. Tax, pension and statutory pay are a
 * specialism with its own software and its own liability, and pretending
 * otherwise would be the most expensive feature in the roadmap. What the
 * product does hold is the one thing payroll software cannot know: how many
 * hours each person actually worked. So it hands that over, as a file, once
 * per period, and records that it did.
 *
 * The files are deliberately plain: hours split into ordinary and overtime,
 * pay at the workshop's own cost rate and overtime multiplier, and the
 * bonuses and deductions a manager added. Every payroll package imports a
 * CSV, none of them agree on its shape, so a run can be handed over in three
 * named shapes and mapped once on the other side (Phase 43).
 */

export class PayrollError extends Error {
  constructor(
    readonly code:
      | 'EMPTY'
      | 'NOT_APPROVED'
      | 'ALREADY_RUN'
      | 'MIXED_PERIODS'
      | 'NOT_EXPORTED'
      | 'ALREADY_PAID'
      | 'BAD_ADJUSTMENT'
      | 'LOCKED'
      | 'BAD_MULTIPLIER'
      | 'UNKNOWN_FORMAT',
    message: string,
  ) {
    super(message);
    this.name = 'PayrollError';
  }
}

export interface RunnableTimesheet {
  id: string;
  employeeReference: string;
  employeeName: string;
  status: 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'PAID';
  periodStart: Date;
  periodEnd: Date;
  ordinaryMinutes: number;
  overtimeMinutes: number;
  absenceMinutes: number;
  ordinaryPay: Money;
  overtimePay: Money;
  /** Ordinary and overtime pay: what the hours came to. */
  gross: Money;
  /** Set once a run has taken it. */
  payrollRunId: string | null;
  /** Bonuses and deductions a manager added to the sheet. Phase 43. */
  adjustments?: readonly PayAdjustment[];
}

/* ---------------------------------------------------------------------------
   Bonuses and deductions. Phase 43.
   --------------------------------------------------------------------------- */

export type PayAdjustmentKind = 'BONUS' | 'DEDUCTION';

/**
 * One amount added to or taken from a person's pay for a period.
 *
 * A bonus is pay, so it is part of gross and of the wages that post. A
 * deduction here is one the workshop itself agreed with the person, such as
 * an advance being paid back or a uniform, and is handed over for the payroll
 * software to take. Tax, pension and other statutory deductions are not typed
 * here: they are the payroll software's to work out.
 */
export interface PayAdjustment {
  kind: PayAdjustmentKind;
  label: string;
  amount: Money;
}

/** The largest single adjustment, in major units: a typo guard, not a policy. */
export const PAY_ADJUSTMENT_LIMIT = 100_000;

/**
 * Whether an adjustment can be added to a sheet in this state.
 *
 * Only while the sheet is waiting: submitted or approved, and not yet handed
 * over. Once a run has taken it, the file has gone, and a change here would
 * be a figure the payroll software never saw.
 */
export function assertPayAdjustment(
  adjustment: { kind: string; label: string; amountMajor: number },
  sheet: { status: RunnableTimesheet['status']; payrollRunId: string | null },
): void {
  if (
    sheet.payrollRunId !== null ||
    (sheet.status !== 'SUBMITTED' && sheet.status !== 'APPROVED')
  ) {
    throw new PayrollError(
      'LOCKED',
      'This timesheet has been handed to payroll. A bonus or deduction now goes on the next period.',
    );
  }

  if (adjustment.kind !== 'BONUS' && adjustment.kind !== 'DEDUCTION') {
    throw new PayrollError('BAD_ADJUSTMENT', 'An adjustment is a bonus or a deduction.');
  }

  const label = adjustment.label.trim();
  if (label.length < 2 || label.length > 80) {
    throw new PayrollError(
      'BAD_ADJUSTMENT',
      'Say what it is for, in a few words, so the payroll clerk can tell what they are paying.',
    );
  }

  if (
    !Number.isFinite(adjustment.amountMajor) ||
    adjustment.amountMajor <= 0 ||
    adjustment.amountMajor > PAY_ADJUSTMENT_LIMIT
  ) {
    throw new PayrollError(
      'BAD_ADJUSTMENT',
      'The amount is more than nothing and less than a hundred thousand. Whether it adds or takes away is the kind.',
    );
  }
}

/** Bonuses and deductions on a sheet, each added up. */
export function adjustmentTotals(
  adjustments: readonly PayAdjustment[],
  currency: string,
): { bonuses: Money; deductions: Money } {
  return {
    bonuses: sum(
      adjustments.filter((entry) => entry.kind === 'BONUS').map((entry) => entry.amount),
      currency,
    ),
    deductions: sum(
      adjustments.filter((entry) => entry.kind === 'DEDUCTION').map((entry) => entry.amount),
      currency,
    ),
  };
}

/** Overtime is paid at between plain time and triple time. */
export function assertOvertimeMultiplier(value: number): void {
  if (
    !Number.isFinite(value) ||
    value < 1 ||
    value > 3 ||
    Math.abs(Math.round(value * 100) - value * 100) > 1e-6
  ) {
    throw new PayrollError(
      'BAD_MULTIPLIER',
      'Overtime is paid at between 1 and 3 times the hourly rate, to two decimal places. Time and a half is 1.5.',
    );
  }
}

/**
 * Whether these timesheets can go into one run.
 *
 * All approved, none already handed over, and all for the same period. A run
 * that mixed two periods would produce a file whose rows a payroll clerk
 * cannot reconcile to a pay date, and a sheet exported twice is somebody paid
 * twice.
 */
export function assertPayrollRunnable(sheets: readonly RunnableTimesheet[]): void {
  if (sheets.length === 0) {
    throw new PayrollError('EMPTY', 'There are no approved timesheets to run. Approve them first.');
  }

  const unapproved = sheets.filter((sheet) => sheet.status !== 'APPROVED');
  if (unapproved.length > 0) {
    throw new PayrollError(
      'NOT_APPROVED',
      `${unapproved.length} of these ${unapproved.length === 1 ? 'is' : 'are'} not approved: ${unapproved
        .map((sheet) => sheet.employeeName)
        .join(', ')}. Payroll runs on approved hours only.`,
    );
  }

  const taken = sheets.filter((sheet) => sheet.payrollRunId !== null);
  if (taken.length > 0) {
    throw new PayrollError(
      'ALREADY_RUN',
      `${taken.map((sheet) => sheet.employeeName).join(', ')} ${taken.length === 1 ? 'has' : 'have'} already been handed to payroll for this period.`,
    );
  }

  const periods = new Set(
    sheets.map((sheet) => `${sheet.periodStart.toISOString()}/${sheet.periodEnd.toISOString()}`),
  );
  if (periods.size > 1) {
    throw new PayrollError(
      'MIXED_PERIODS',
      'These timesheets cover different periods. A run is one pay period, so the file reconciles to one pay date.',
    );
  }
}

export interface PayrollRow {
  employeeReference: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  ordinaryHours: number;
  overtimeHours: number;
  absenceHours: number;
  ordinaryPay: Money;
  overtimePay: Money;
  bonuses: Money;
  /** Ordinary, overtime and bonuses. */
  gross: Money;
  deductions: Money;
  /** Gross less the workshop's own deductions, before tax. */
  afterDeductions: Money;
  adjustments: readonly PayAdjustment[];
}

/** What the hours came to plus the bonuses: the figure wages post at. */
export function sheetGross(sheet: RunnableTimesheet): Money {
  const { bonuses } = adjustmentTotals(sheet.adjustments ?? [], sheet.gross.currency);
  return add(sheet.gross, bonuses);
}

/** One row per person, as the file will carry them. */
export function payrollRows(sheets: readonly RunnableTimesheet[]): PayrollRow[] {
  return [...sheets]
    .sort((a, b) => a.employeeReference.localeCompare(b.employeeReference))
    .map((sheet) => {
      const adjustments = sheet.adjustments ?? [];
      const { bonuses, deductions } = adjustmentTotals(adjustments, sheet.gross.currency);
      const gross = add(sheet.gross, bonuses);

      return {
        employeeReference: sheet.employeeReference,
        employeeName: sheet.employeeName,
        periodStart: isoDate(sheet.periodStart),
        periodEnd: isoDate(sheet.periodEnd),
        ordinaryHours: round2(sheet.ordinaryMinutes / 60),
        overtimeHours: round2(sheet.overtimeMinutes / 60),
        absenceHours: round2(sheet.absenceMinutes / 60),
        ordinaryPay: sheet.ordinaryPay,
        overtimePay: sheet.overtimePay,
        bonuses,
        gross,
        deductions,
        afterDeductions: subtract(gross, deductions),
        adjustments,
      };
    });
}

const major = (value: Money) => Number((value.minor / 100).toFixed(2));

/**
 * The columns, named as a payroll clerk expects them.
 *
 * The employee reference is literal so a leading zero survives the
 * spreadsheet it will inevitably be opened in.
 */
export const PAYROLL_COLUMNS: CsvColumn<PayrollRow>[] = [
  { header: 'Employee reference', value: (row) => row.employeeReference, literal: true },
  { header: 'Employee name', value: (row) => row.employeeName },
  { header: 'Period start', value: (row) => row.periodStart },
  { header: 'Period end', value: (row) => row.periodEnd },
  { header: 'Ordinary hours', value: (row) => row.ordinaryHours },
  { header: 'Overtime hours', value: (row) => row.overtimeHours },
  { header: 'Absence hours', value: (row) => row.absenceHours },
  { header: 'Ordinary pay', value: (row) => (row.ordinaryPay.minor / 100).toFixed(2) },
  { header: 'Overtime pay', value: (row) => (row.overtimePay.minor / 100).toFixed(2) },
  { header: 'Bonuses', value: (row) => (row.bonuses.minor / 100).toFixed(2) },
  { header: 'Gross pay', value: (row) => (row.gross.minor / 100).toFixed(2) },
  { header: 'Deductions', value: (row) => (row.deductions.minor / 100).toFixed(2) },
  {
    header: 'Pay after deductions, before tax',
    value: (row) => (row.afterDeductions.minor / 100).toFixed(2),
  },
];

/* ---------------------------------------------------------------------------
   Named exports. Phase 43.
   --------------------------------------------------------------------------- */

interface PayElementRow {
  employeeReference: string;
  employeeName: string;
  periodEnd: string;
  code: string;
  description: string;
  hours: number | null;
  amount: number | null;
}

/**
 * One line per person per pay element.
 *
 * The shape payroll software built around pay elements imports: each line a
 * code, the hours where it is time, and the amount where it is money, with
 * deductions negative. The codes are this product's own and are mapped to
 * the software's elements once, on its import screen.
 */
function payElements(rows: readonly PayrollRow[]): PayElementRow[] {
  return rows.flatMap((row) => {
    const base = {
      employeeReference: row.employeeReference,
      employeeName: row.employeeName,
      periodEnd: row.periodEnd,
    };

    const lines: PayElementRow[] = [
      {
        ...base,
        code: 'ORD',
        description: 'Ordinary hours',
        hours: row.ordinaryHours,
        amount: major(row.ordinaryPay),
      },
    ];

    if (row.overtimeHours > 0) {
      lines.push({
        ...base,
        code: 'OT',
        description: 'Overtime hours',
        hours: row.overtimeHours,
        amount: major(row.overtimePay),
      });
    }

    if (row.absenceHours > 0) {
      lines.push({
        ...base,
        code: 'ABS',
        description: 'Absence hours',
        hours: row.absenceHours,
        amount: null,
      });
    }

    for (const adjustment of row.adjustments) {
      lines.push({
        ...base,
        code: adjustment.kind === 'BONUS' ? 'BONUS' : 'DEDUCT',
        description: adjustment.label,
        hours: null,
        amount: adjustment.kind === 'BONUS' ? major(adjustment.amount) : -major(adjustment.amount),
      });
    }

    return lines;
  });
}

const PAY_ELEMENT_COLUMNS: CsvColumn<PayElementRow>[] = [
  { header: 'Employee reference', value: (row) => row.employeeReference, literal: true },
  { header: 'Employee name', value: (row) => row.employeeName },
  { header: 'Period end', value: (row) => row.periodEnd },
  { header: 'Element code', value: (row) => row.code },
  { header: 'Description', value: (row) => row.description },
  { header: 'Hours', value: (row) => row.hours },
  { header: 'Amount', value: (row) => row.amount },
];

const HOURS_COLUMNS: CsvColumn<PayrollRow>[] = [
  { header: 'Employee reference', value: (row) => row.employeeReference, literal: true },
  { header: 'Employee name', value: (row) => row.employeeName },
  { header: 'Period start', value: (row) => row.periodStart },
  { header: 'Period end', value: (row) => row.periodEnd },
  { header: 'Ordinary hours', value: (row) => row.ordinaryHours },
  { header: 'Overtime hours', value: (row) => row.overtimeHours },
  { header: 'Absence hours', value: (row) => row.absenceHours },
  { header: 'Bonuses', value: (row) => major(row.bonuses) },
  { header: 'Deductions', value: (row) => major(row.deductions) },
];

export const PAYROLL_EXPORT_IDS = ['standard', 'hours', 'elements'] as const;
export type PayrollExportId = (typeof PAYROLL_EXPORT_IDS)[number];

export interface PayrollExport {
  id: PayrollExportId;
  name: string;
  description: string;
  /** Added to the file name, so two formats of one run are told apart. */
  suffix: string;
  render(rows: readonly PayrollRow[]): string;
}

/**
 * The files a run can be handed over as.
 *
 * Named for what they contain rather than for a payroll product, because no
 * vendor has certified any of them and a file called after one would be a
 * promise. Each is plain enough that any payroll package's CSV import can be
 * mapped to it once.
 */
export const PAYROLL_EXPORTS: Readonly<Record<PayrollExportId, PayrollExport>> = {
  standard: {
    id: 'standard',
    name: 'Pay summary',
    description:
      'One row per person: hours, pay for the hours, bonuses, gross, deductions and pay after deductions.',
    suffix: '',
    render: (rows) => toCsv(rows, PAYROLL_COLUMNS),
  },
  hours: {
    id: 'hours',
    name: 'Hours only',
    description:
      'One row per person with hours, bonuses and deductions but no rates, for payroll software that holds the rates itself.',
    suffix: ' hours',
    render: (rows) => toCsv(rows, HOURS_COLUMNS),
  },
  elements: {
    id: 'elements',
    name: 'Pay elements',
    description:
      'One line per person per element (ordinary, overtime, absence, each bonus and each deduction), for software that imports pay elements.',
    suffix: ' elements',
    render: (rows) => toCsv(payElements(rows), PAY_ELEMENT_COLUMNS),
  },
};

export function isPayrollExportId(value: unknown): value is PayrollExportId {
  return typeof value === 'string' && (PAYROLL_EXPORT_IDS as readonly string[]).includes(value);
}

export function payrollExport(id: string): PayrollExport {
  if (!isPayrollExportId(id)) {
    throw new PayrollError('UNKNOWN_FORMAT', 'There is no payroll file of that name.');
  }
  return PAYROLL_EXPORTS[id];
}

/** Everybody's gross, bonuses included: what the wages post at. */
export function payrollGross(sheets: readonly RunnableTimesheet[], currency = 'GBP'): Money {
  return sum(sheets.map(sheetGross), currency);
}

/**
 * The ledger entry when the wages are actually paid.
 *
 * Gross to the wages expense and out of the bank in one movement. The
 * deductions between gross and net, and the employer's own contributions,
 * belong to the payroll software's journal and are posted from its report,
 * not guessed at here. Posting gross keeps the workshop's labour cost honest
 * without inventing a tax figure.
 */
export function postPayroll(input: {
  runId: string;
  reference: string;
  periodEnd: Date;
  gross: Money;
  paidAt: Date;
}): JournalEntryDraft {
  const currency = input.gross.currency;

  return {
    reference: input.reference,
    description: `Wages for the period ending ${isoDate(input.periodEnd)}`,
    sourceType: 'PayrollRun',
    sourceId: input.runId,
    postedAt: input.paidAt,
    lines: [
      { accountCode: ACCOUNT.WAGES, debit: input.gross, credit: zero(currency), memo: 'Gross pay' },
      { accountCode: ACCOUNT.BANK, debit: zero(currency), credit: input.gross },
    ],
  };
}

/** Whether a run can be marked paid. */
export function assertPayrollPayable(run: { status: 'DRAFT' | 'EXPORTED' | 'PAID' }): void {
  if (run.status === 'PAID') {
    throw new PayrollError('ALREADY_PAID', 'This run has been paid already.');
  }

  if (run.status !== 'EXPORTED') {
    throw new PayrollError(
      'NOT_EXPORTED',
      'Export the file first. Marking a run paid before the hours have reached payroll is recording a payment that has not happened.',
    );
  }
}

/** One line about a run, for the list. */
export function describePayrollRun(run: {
  status: 'DRAFT' | 'EXPORTED' | 'PAID';
  employeeCount: number;
  gross: Money;
  periodEnd: Date;
}): string {
  const people = `${run.employeeCount} ${run.employeeCount === 1 ? 'person' : 'people'}`;
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: run.gross.currency,
  }).format(run.gross.minor / 100);

  switch (run.status) {
    case 'PAID':
      return `${people}, ${amount}, paid.`;
    case 'EXPORTED':
      return `${people}, ${amount}, handed to payroll and waiting to be marked paid.`;
    default:
      return `${people}, ${amount}, not yet exported.`;
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
