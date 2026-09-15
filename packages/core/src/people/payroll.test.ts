import { describe, expect, it } from 'vitest';

import { toCsv } from '../pos/csv';
import { money } from '../shared/money';

import {
  assertOvertimeMultiplier,
  assertPayAdjustment,
  assertPayrollPayable,
  assertPayrollRunnable,
  describePayrollRun,
  PAYROLL_COLUMNS,
  PAYROLL_EXPORT_IDS,
  payrollExport,
  payrollGross,
  payrollRows,
  postPayroll,
  type RunnableTimesheet,
} from './payroll';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

const sheet = (over: Partial<RunnableTimesheet> & { id: string }): RunnableTimesheet => ({
  employeeReference: 'EMP-001',
  employeeName: 'John Okafor',
  status: 'APPROVED',
  periodStart: new Date('2026-09-01T00:00:00Z'),
  periodEnd: new Date('2026-09-07T23:59:59Z'),
  ordinaryMinutes: 2400,
  overtimeMinutes: 75,
  absenceMinutes: 0,
  ordinaryPay: gbp(760),
  overtimePay: gbp(35.63),
  gross: gbp(795.63),
  payrollRunId: null,
  ...over,
});

describe('assertPayrollRunnable', () => {
  it('runs approved sheets for one period', () => {
    expect(() =>
      assertPayrollRunnable([sheet({ id: 'a' }), sheet({ id: 'b', employeeReference: 'EMP-002' })]),
    ).not.toThrow();
  });

  it('has nothing to run on an empty list', () => {
    expect(() => assertPayrollRunnable([])).toThrow(/no approved timesheets/);
  });

  it('names the people whose hours are not approved', () => {
    expect(() =>
      assertPayrollRunnable([
        sheet({ id: 'a' }),
        sheet({ id: 'b', status: 'SUBMITTED', employeeName: 'Sara' }),
      ]),
    ).toThrow(/Sara/);
  });

  it('never hands the same hours over twice', () => {
    expect(() => assertPayrollRunnable([sheet({ id: 'a', payrollRunId: 'run-1' })])).toThrow(
      /already been handed to payroll/,
    );
  });

  it('keeps one run to one period', () => {
    expect(() =>
      assertPayrollRunnable([
        sheet({ id: 'a' }),
        sheet({
          id: 'b',
          periodStart: new Date('2026-09-08T00:00:00Z'),
          periodEnd: new Date('2026-09-14T23:59:59Z'),
        }),
      ]),
    ).toThrow(/different periods/);
  });
});

describe('payrollRows and the file', () => {
  it('orders by employee reference and converts minutes to hours', () => {
    const rows = payrollRows([
      sheet({ id: 'b', employeeReference: 'EMP-002', employeeName: 'Sara' }),
      sheet({ id: 'a' }),
    ]);

    expect(rows.map((r) => r.employeeReference)).toEqual(['EMP-001', 'EMP-002']);
    expect(rows[0]?.ordinaryHours).toBe(40);
    expect(rows[0]?.overtimeHours).toBe(1.25);
    expect(rows[0]?.periodStart).toBe('2026-09-01');
  });

  it('produces a file a payroll clerk can import', () => {
    const csv = toCsv(payrollRows([sheet({ id: 'a', employeeReference: '007' })]), PAYROLL_COLUMNS);
    const [header, row] = csv.trim().split(/\r?\n/);

    expect(header).toContain('Employee reference');
    expect(header).toContain('Gross pay');
    // Literal, so the leading zero survives the spreadsheet.
    expect(row).toContain('007');
    expect(row).toContain('795.63');
  });

  it('adds up the gross', () => {
    expect(payrollGross([sheet({ id: 'a' }), sheet({ id: 'b', gross: gbp(100) })]).minor).toBe(
      89563,
    );
  });
});

describe('postPayroll', () => {
  it('posts gross to wages and out of the bank, balanced', () => {
    const entry = postPayroll({
      runId: 'run',
      reference: 'PAYROLL-2026-09-07',
      periodEnd: new Date('2026-09-07'),
      gross: gbp(1591.25),
      paidAt: new Date('2026-09-10'),
    });

    expect(entry.lines.find((l) => l.accountCode === '6000')?.debit.minor).toBe(159125);
    expect(entry.lines.find((l) => l.accountCode === '1000')?.credit.minor).toBe(159125);
  });
});

describe('assertPayrollPayable', () => {
  it('needs the file to have gone first', () => {
    expect(() => assertPayrollPayable({ status: 'DRAFT' })).toThrow(/Export the file first/);
    expect(() => assertPayrollPayable({ status: 'EXPORTED' })).not.toThrow();
    expect(() => assertPayrollPayable({ status: 'PAID' })).toThrow(/paid already/);
  });
});

describe('describePayrollRun', () => {
  it('says where a run stands', () => {
    const base = { employeeCount: 3, gross: gbp(2400), periodEnd: new Date('2026-09-07') };
    expect(describePayrollRun({ ...base, status: 'EXPORTED' })).toContain('handed to payroll');
    expect(describePayrollRun({ ...base, status: 'PAID' })).toBe('3 people, £2,400.00, paid.');
    expect(describePayrollRun({ ...base, employeeCount: 1, status: 'DRAFT' })).toContain(
      '1 person',
    );
  });
});

describe('bonuses and deductions', () => {
  const adjusted = sheet({
    id: 'a',
    adjustments: [
      { kind: 'BONUS', label: 'Quarter target', amount: gbp(150) },
      { kind: 'DEDUCTION', label: 'Advance repaid', amount: gbp(40) },
      { kind: 'DEDUCTION', label: 'Uniform', amount: gbp(10) },
    ],
  });

  it('puts bonuses in gross and shows deductions separately', () => {
    const [row] = payrollRows([adjusted]);
    expect(row?.bonuses.minor).toBe(15000);
    expect(row?.gross.minor).toBe(94563);
    expect(row?.deductions.minor).toBe(5000);
    expect(row?.afterDeductions.minor).toBe(89563);
    expect(payrollGross([adjusted]).minor).toBe(94563);
  });

  it('refuses an adjustment nobody could read or that arrives too late', () => {
    const waiting = { status: 'APPROVED' as const, payrollRunId: null };
    expect(() =>
      assertPayAdjustment({ kind: 'BONUS', label: 'Target', amountMajor: 50 }, waiting),
    ).not.toThrow();
    expect(() =>
      assertPayAdjustment({ kind: 'BONUS', label: ' ', amountMajor: 50 }, waiting),
    ).toThrow(/what it is for/);
    expect(() =>
      assertPayAdjustment({ kind: 'DEDUCTION', label: 'Loan', amountMajor: -5 }, waiting),
    ).toThrow(/more than nothing/);
    expect(() =>
      assertPayAdjustment({ kind: 'TIP', label: 'Loan', amountMajor: 5 }, waiting),
    ).toThrow(/bonus or a deduction/);
    expect(() =>
      assertPayAdjustment(
        { kind: 'BONUS', label: 'Target', amountMajor: 50 },
        { status: 'APPROVED', payrollRunId: 'run-1' },
      ),
    ).toThrow(/next period/);
    expect(() =>
      assertPayAdjustment(
        { kind: 'BONUS', label: 'Target', amountMajor: 50 },
        { status: 'OPEN', payrollRunId: null },
      ),
    ).toThrow(/next period/);
  });

  it('pays overtime at plain to triple time', () => {
    expect(() => assertOvertimeMultiplier(1.5)).not.toThrow();
    expect(() => assertOvertimeMultiplier(1.15)).not.toThrow();
    expect(() => assertOvertimeMultiplier(0.5)).toThrow(/between 1 and 3/);
    expect(() => assertOvertimeMultiplier(1.125)).toThrow(/two decimal places/);
  });
});

describe('named exports', () => {
  const rows = payrollRows([
    sheet({
      id: 'a',
      employeeReference: '007',
      absenceMinutes: 480,
      adjustments: [
        { kind: 'BONUS', label: 'Target', amount: gbp(150) },
        { kind: 'DEDUCTION', label: 'Advance repaid', amount: gbp(40) },
      ],
    }),
  ]);

  it('knows its formats and refuses others', () => {
    expect(PAYROLL_EXPORT_IDS).toEqual(['standard', 'hours', 'elements']);
    expect(() => payrollExport('sage')).toThrow(/no payroll file of that name/);
  });

  it('writes the pay summary with gross and pay after deductions', () => {
    const [header, row] = payrollExport('standard').render(rows).trim().split(/\r?\n/);
    expect(header).toContain('Pay after deductions, before tax');
    expect(row).toContain('945.63');
    expect(row).toContain('905.63');
  });

  it('writes hours without rates', () => {
    const csv = payrollExport('hours').render(rows);
    expect(csv).not.toContain('795.63');
    expect(csv).toContain('Absence hours');
  });

  it('writes one line per element, deductions negative and never mistaken for a formula', () => {
    const lines = payrollExport('elements').render(rows).trim().split(/\r?\n/);
    expect(lines).toHaveLength(6);
    expect(lines.some((line) => line.includes('ORD') && line.includes('760'))).toBe(true);
    expect(lines.some((line) => line.includes('OT') && line.includes('35.63'))).toBe(true);
    expect(lines.some((line) => line.includes('ABS') && line.includes(',8,'))).toBe(true);
    expect(lines.some((line) => line.includes('DEDUCT') && line.endsWith(',-40'))).toBe(true);
    expect(lines.join('\n')).not.toContain("'-40");
  });
});
