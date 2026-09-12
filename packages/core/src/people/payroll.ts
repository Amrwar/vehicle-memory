import { ACCOUNT } from '../accounting/accounts';
import { type JournalEntryDraft } from '../accounting/posting';
import { type CsvColumn } from '../pos/csv';
import { type Money, sum, zero } from '../shared/money';

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
 * The file format is deliberately plain: one row per person, hours split into
 * ordinary and overtime, gross at the workshop's own cost rate. Every payroll
 * package imports a CSV shaped like this, and none of them agree on anything
 * more elaborate.
 */

export class PayrollError extends Error {
  constructor(
    readonly code:
      'EMPTY' | 'NOT_APPROVED' | 'ALREADY_RUN' | 'MIXED_PERIODS' | 'NOT_EXPORTED' | 'ALREADY_PAID',
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
  gross: Money;
  /** Set once a run has taken it. */
  payrollRunId: string | null;
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
  gross: Money;
}

/** One row per person, as the file will carry them. */
export function payrollRows(sheets: readonly RunnableTimesheet[]): PayrollRow[] {
  return [...sheets]
    .sort((a, b) => a.employeeReference.localeCompare(b.employeeReference))
    .map((sheet) => ({
      employeeReference: sheet.employeeReference,
      employeeName: sheet.employeeName,
      periodStart: isoDate(sheet.periodStart),
      periodEnd: isoDate(sheet.periodEnd),
      ordinaryHours: round2(sheet.ordinaryMinutes / 60),
      overtimeHours: round2(sheet.overtimeMinutes / 60),
      absenceHours: round2(sheet.absenceMinutes / 60),
      ordinaryPay: sheet.ordinaryPay,
      overtimePay: sheet.overtimePay,
      gross: sheet.gross,
    }));
}

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
  { header: 'Gross pay', value: (row) => (row.gross.minor / 100).toFixed(2) },
];

export function payrollGross(sheets: readonly RunnableTimesheet[], currency = 'GBP'): Money {
  return sum(
    sheets.map((sheet) => sheet.gross),
    currency,
  );
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
