import { describe, expect, it } from 'vitest';

import { toCsv } from '../pos/csv';
import { money } from '../shared/money';

import {
  assertPayrollPayable,
  assertPayrollRunnable,
  describePayrollRun,
  PAYROLL_COLUMNS,
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
