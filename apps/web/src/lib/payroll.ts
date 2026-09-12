import {
  assertPayrollPayable,
  assertPayrollRunnable,
  assertTimesheetTransition,
  fromDecimal,
  PAYROLL_COLUMNS,
  payrollGross,
  payrollRows,
  PayrollError,
  postPayroll,
  type RunnableTimesheet,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postEntry } from './accounting';
import { audit } from './guard';
import { draftTimesheet } from './people';

/**
 * Timesheets to payroll, against the database.
 *
 * Submit, approve, hand over as a file, mark paid. The product never
 * calculates tax; it hands approved hours to the software that does and
 * records that it did, so the same hours cannot be handed over twice.
 */

export { PayrollError, PAYROLL_COLUMNS };

const asRunnable = (row: {
  id: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  ordinaryMinutes: number;
  overtimeMinutes: number;
  absenceMinutes: number;
  ordinaryPay: unknown;
  overtimePay: unknown;
  gross: unknown;
  payrollRunId: string | null;
  employee: { reference: string; displayName: string };
}): RunnableTimesheet => ({
  id: row.id,
  employeeReference: row.employee.reference,
  employeeName: row.employee.displayName,
  status: row.status as RunnableTimesheet['status'],
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  ordinaryMinutes: row.ordinaryMinutes,
  overtimeMinutes: row.overtimeMinutes,
  absenceMinutes: row.absenceMinutes,
  ordinaryPay: fromDecimal(String(row.ordinaryPay)),
  overtimePay: fromDecimal(String(row.overtimePay)),
  gross: fromDecimal(String(row.gross)),
  payrollRunId: row.payrollRunId,
});

const SHEET_SELECT = {
  id: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  ordinaryMinutes: true,
  overtimeMinutes: true,
  absenceMinutes: true,
  ordinaryPay: true,
  overtimePay: true,
  gross: true,
  payrollRunId: true,
  employee: { select: { id: true, reference: true, displayName: true } },
} as const;

/* ---------------------------------------------------------------------------
   Timesheets
   --------------------------------------------------------------------------- */

/**
 * Turns a person's attendance for a period into a submitted timesheet.
 *
 * The figures are frozen here. Attendance records can be corrected afterwards,
 * but the sheet that was submitted is the sheet that was submitted, and any
 * difference is an adjustment on the next one.
 */
export async function submitTimesheet(input: {
  orgId: string;
  userId: string;
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<string> {
  const draft = await draftTimesheet(input.orgId, input.employeeId, {
    from: input.periodStart,
    to: input.periodEnd,
  });

  const existing = await prisma.timesheet.findUnique({
    where: {
      employeeId_periodStart: { employeeId: input.employeeId, periodStart: input.periodStart },
    },
    select: { id: true, status: true },
  });

  if (existing && existing.status !== 'OPEN') {
    throw new PayrollError(
      'ALREADY_RUN',
      `${draft.employee.displayName} already has a ${existing.status.toLowerCase()} timesheet for this period.`,
    );
  }

  const data = {
    orgId: input.orgId,
    employeeId: input.employeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: 'SUBMITTED' as const,
    ordinaryMinutes: draft.totals.ordinaryMinutes,
    overtimeMinutes: draft.totals.overtimeMinutes,
    absenceMinutes: draft.totals.absenceMinutes,
    ordinaryPay: toNumber(draft.totals.ordinaryPay),
    overtimePay: toNumber(draft.totals.overtimePay),
    gross: toNumber(draft.totals.gross),
    submittedAt: new Date(),
  };

  const sheet = existing
    ? await prisma.timesheet.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.timesheet.create({ data, select: { id: true } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'timesheet.submitted',
    entityType: 'Timesheet',
    entityId: sheet.id,
    after: { employee: draft.employee.displayName, gross: toNumber(draft.totals.gross) },
  });

  return sheet.id;
}

/** A manager signs the hours off. After this they do not move. */
export async function approveTimesheet(input: {
  orgId: string;
  userId: string;
  timesheetId: string;
}): Promise<void> {
  const sheet = await prisma.timesheet.findFirstOrThrow({
    where: { id: input.timesheetId, orgId: input.orgId },
    select: { id: true, status: true, employee: { select: { displayName: true } } },
  });

  assertTimesheetTransition(sheet.status, 'APPROVED');

  await prisma.timesheet.update({
    where: { id: sheet.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: input.userId },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'timesheet.approved',
    entityType: 'Timesheet',
    entityId: sheet.id,
    after: { employee: sheet.employee.displayName },
  });
}

/** Approved sheets waiting for a run, grouped by period. */
export async function awaitingPayroll(orgId: string) {
  const rows = await prisma.timesheet.findMany({
    where: { orgId, status: 'APPROVED', payrollRunId: null },
    orderBy: [{ periodStart: 'desc' }, { employee: { reference: 'asc' } }],
    select: SHEET_SELECT,
  });

  const periods = new Map<
    string,
    { periodStart: Date; periodEnd: Date; sheets: RunnableTimesheet[] }
  >();

  for (const row of rows) {
    const key = `${row.periodStart.toISOString()}/${row.periodEnd.toISOString()}`;
    const entry = periods.get(key) ?? {
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      sheets: [],
    };
    entry.sheets.push(asRunnable(row));
    periods.set(key, entry);
  }

  return [...periods.values()].map((entry) => ({ ...entry, gross: payrollGross(entry.sheets) }));
}

/** Sheets somebody still has to approve. */
export async function awaitingApproval(orgId: string) {
  return prisma.timesheet.findMany({
    where: { orgId, status: 'SUBMITTED' },
    orderBy: [{ periodStart: 'desc' }, { employee: { reference: 'asc' } }],
    select: SHEET_SELECT,
  });
}

/* ---------------------------------------------------------------------------
   Runs
   --------------------------------------------------------------------------- */

/**
 * Hands one period's approved hours to payroll.
 *
 * The run is created already exported, because the file is generated from it
 * on demand and nothing else happens between creating the run and downloading
 * it. What the status records is that these sheets have left the building.
 */
export async function runPayroll(input: {
  orgId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<string> {
  const rows = await prisma.timesheet.findMany({
    where: {
      orgId: input.orgId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: 'APPROVED',
    },
    select: SHEET_SELECT,
  });

  const sheets = rows.map(asRunnable);
  assertPayrollRunnable(sheets);

  const gross = payrollGross(sheets);
  const now = new Date();

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        orgId: input.orgId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'EXPORTED',
        employeeCount: sheets.length,
        gross: toNumber(gross),
        exportedAt: now,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });

    await tx.timesheet.updateMany({
      where: { id: { in: sheets.map((sheet) => sheet.id) } },
      data: { payrollRunId: created.id },
    });

    return created;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'payroll.exported',
    entityType: 'PayrollRun',
    entityId: run.id,
    after: { people: sheets.length, gross: toNumber(gross) },
  });

  return run.id;
}

/** The rows for the file, for one run. */
export async function payrollFile(orgId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, orgId },
    select: { id: true, periodStart: true, periodEnd: true, timesheets: { select: SHEET_SELECT } },
  });

  if (!run) return null;

  return { run, rows: payrollRows(run.timesheets.map(asRunnable)) };
}

/** The money has left the bank: the run and its sheets are paid, and wages post. */
export async function markPayrollPaid(input: {
  orgId: string;
  userId: string;
  runId: string;
  paidAt?: Date;
}): Promise<void> {
  const run = await prisma.payrollRun.findFirstOrThrow({
    where: { id: input.runId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      gross: true,
      periodEnd: true,
      timesheets: { select: { id: true, status: true } },
    },
  });

  assertPayrollPayable({ status: run.status });

  for (const sheet of run.timesheets) {
    assertTimesheetTransition(sheet.status, 'PAID');
  }

  const paidAt = input.paidAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id: run.id }, data: { status: 'PAID', paidAt } });
    await tx.timesheet.updateMany({
      where: { payrollRunId: run.id },
      data: { status: 'PAID', paidAt },
    });
  });

  await postEntry(
    input.orgId,
    postPayroll({
      runId: run.id,
      reference: `PAYROLL-${run.periodEnd.toISOString().slice(0, 10)}`,
      periodEnd: run.periodEnd,
      gross: fromDecimal(run.gross.toString()),
      paidAt,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'payroll.paid',
    entityType: 'PayrollRun',
    entityId: run.id,
    after: { gross: Number(run.gross), sheets: run.timesheets.length },
  });
}

/** Every run, newest first. */
export async function payrollRuns(orgId: string) {
  return prisma.payrollRun.findMany({
    where: { orgId },
    orderBy: { periodStart: 'desc' },
    take: 24,
    include: { createdBy: { select: { name: true } }, _count: { select: { timesheets: true } } },
  });
}
