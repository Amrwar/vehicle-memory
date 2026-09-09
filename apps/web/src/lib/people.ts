import {
  attendedMinutes,
  calculateCommission,
  type CommissionableJob,
  type CommissionBasis,
  type CommissionScheme,
  costOfHours,
  fromDecimal,
  type HoursWorked,
  money,
  type PayRate,
  summariseTeam,
  type TeamProductivity,
  timesheetTotals,
  zero,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * People, against the database.
 *
 * The arithmetic is in `@carnet/core`. What lives here is the assembly: which
 * rows make up an hour, and which rate was in force when it was worked. The
 * second half is the part that used to be wrong, because a single mutable
 * cost rate meant every historic figure moved whenever somebody got a rise.
 */

const decimal = (value: unknown, currency = 'GBP') => fromDecimal(String(value ?? 0), currency);

/* ---------------------------------------------------------------------------
   Pay
   --------------------------------------------------------------------------- */

export async function payHistory(employeeId: string): Promise<PayRate[]> {
  const rates = await prisma.payRate.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: 'desc' },
  });

  return rates.map((rate) => ({
    effectiveFrom: rate.effectiveFrom,
    effectiveTo: rate.effectiveTo,
    costPerHour: decimal(rate.costPerHour),
    chargePerHour: decimal(rate.chargePerHour),
  }));
}

/* ---------------------------------------------------------------------------
   Productivity
   --------------------------------------------------------------------------- */

export interface PeriodRange {
  from: Date;
  to: Date;
}

/**
 * Assembles the three hours for every technician in a period.
 *
 * Attendance, job time and sold labour come from three different tables and
 * are deliberately not reconciled here: the gaps between them are the
 * finding, not an error to be smoothed away.
 */
export async function teamProductivity(
  orgId: string,
  range: PeriodRange,
  locationId?: string | null,
): Promise<TeamProductivity> {
  const employees = await prisma.employee.findMany({
    where: {
      orgId,
      isActive: true,
      ...(locationId ? { locationId } : {}),
    },
    include: { payRates: { orderBy: { effectiveFrom: 'desc' } }, user: { select: { id: true } } },
  });

  if (employees.length === 0) return summariseTeam([]);

  const userIds = employees.map((employee) => employee.userId).filter((id): id is string => !!id);

  const [attendance, timeEntries, labourLines] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        orgId,
        startedAt: { gte: range.from, lte: range.to },
        ...(locationId ? { locationId } : {}),
      },
    }),
    userIds.length
      ? prisma.timeEntry.findMany({
          where: {
            userId: { in: userIds },
            startedAt: { gte: range.from, lte: range.to },
          },
          select: { userId: true, jobId: true, minutes: true, startedAt: true },
        })
      : [],
    userIds.length
      ? prisma.jobLabourLine.findMany({
          where: {
            job: {
              orgId,
              completedAt: { gte: range.from, lte: range.to },
              ...(locationId ? { locationId } : {}),
            },
          },
          select: { jobId: true, hours: true, rate: true, discountPct: true },
        })
      : [],
  ]);

  // Sold labour belongs to a job, not to a person, so it is shared out across
  // whoever clocked onto that job in proportion to the time they put in.
  // Attributing all of it to one technician would flatter whoever happened to
  // be listed first.
  const minutesByJob = new Map<string, number>();
  for (const entry of timeEntries) {
    minutesByJob.set(entry.jobId, (minutesByJob.get(entry.jobId) ?? 0) + (entry.minutes ?? 0));
  }

  const soldByJob = new Map<string, { minutes: number; revenueMinor: number }>();
  for (const line of labourLines) {
    const hours = Number(line.hours);
    const gross = hours * Number(line.rate);
    const net = gross * (1 - Number(line.discountPct ?? 0) / 100);
    const existing = soldByJob.get(line.jobId) ?? { minutes: 0, revenueMinor: 0 };

    soldByJob.set(line.jobId, {
      minutes: existing.minutes + hours * 60,
      revenueMinor: existing.revenueMinor + Math.round(net * 100),
    });
  }

  const worked: HoursWorked[] = employees.map((employee) => {
    const spans = attendance
      .filter((record) => record.employeeId === employee.id)
      .map((record) => ({
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        breakMinutes: record.breakMinutes,
      }));

    const entries = employee.userId
      ? timeEntries.filter((entry) => entry.userId === employee.userId)
      : [];

    const rates: PayRate[] = employee.payRates.map((rate) => ({
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
      costPerHour: decimal(rate.costPerHour),
      chargePerHour: decimal(rate.chargePerHour),
    }));

    let soldMinutes = 0;
    let revenueMinor = 0;

    for (const entry of entries) {
      const sold = soldByJob.get(entry.jobId);
      const jobMinutes = minutesByJob.get(entry.jobId) ?? 0;
      if (!sold || jobMinutes <= 0) continue;

      const share = (entry.minutes ?? 0) / jobMinutes;
      soldMinutes += sold.minutes * share;
      revenueMinor += Math.round(sold.revenueMinor * share);
    }

    return {
      technicianId: employee.id,
      technicianName: employee.displayName,
      attendedMinutes: attendedMinutes(spans, range.to),
      productiveMinutes: entries.reduce((total, entry) => total + (entry.minutes ?? 0), 0),
      soldMinutes: Math.round(soldMinutes),
      // Every shift costed at the rate in force on the day it was worked.
      labourCost: costOfHours(
        rates,
        spans.map((span) => ({
          at: span.startedAt,
          minutes: attendedMinutes([span], range.to),
        })),
      ),
      labourRevenue: money(revenueMinor),
      jobsTouched: new Set(entries.map((entry) => entry.jobId)).size,
    };
  });

  return summariseTeam(worked);
}

/* ---------------------------------------------------------------------------
   Timesheets
   --------------------------------------------------------------------------- */

/**
 * Builds a timesheet from attendance, without saving it.
 *
 * Kept separate from writing so a period can be previewed before anybody
 * commits to paying it.
 */
export async function draftTimesheet(
  orgId: string,
  employeeId: string,
  range: PeriodRange,
  overtimeMultiplier = 1.5,
) {
  const [employee, records, absences] = await Promise.all([
    prisma.employee.findFirstOrThrow({
      where: { id: employeeId, orgId },
      include: { payRates: { orderBy: { effectiveFrom: 'desc' } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { orgId, employeeId, startedAt: { gte: range.from, lte: range.to } },
    }),
    prisma.absence.findMany({
      where: { orgId, employeeId, startsOn: { lte: range.to }, endsOn: { gte: range.from } },
    }),
  ]);

  const spans = records.map((record) => ({
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    breakMinutes: record.breakMinutes,
  }));

  const rates: PayRate[] = employee.payRates.map((rate) => ({
    effectiveFrom: rate.effectiveFrom,
    effectiveTo: rate.effectiveTo,
    costPerHour: decimal(rate.costPerHour),
    chargePerHour: decimal(rate.chargePerHour),
  }));

  // The rate at the end of the period, which is what payroll runs on. The
  // per-day split matters for costing a job; a payslip uses one figure.
  const current = rates.find(
    (rate) =>
      rate.effectiveFrom <= range.to && (rate.effectiveTo === null || range.to < rate.effectiveTo),
  );

  const absenceMinutes = absences.reduce(
    (total, absence) => total + Number(absence.days) * (employee.weeklyMinutes / 5),
    0,
  );

  return {
    employee,
    totals: timesheetTotals({
      attendedMinutes: attendedMinutes(spans, range.to),
      absenceMinutes: Math.round(absenceMinutes),
      ordinaryMinutesPerPeriod: employee.weeklyMinutes,
      costPerHour: current?.costPerHour ?? zero('GBP'),
      overtimeMultiplier,
    }),
    records,
    absences,
  };
}

/* ---------------------------------------------------------------------------
   Commission
   --------------------------------------------------------------------------- */

/**
 * The jobs one technician can claim commission on, with their real numbers.
 *
 * Every figure comes from the same lines the invoice was built from, so a
 * commission query is answered by pointing at a job rather than by rerunning
 * a calculation nobody can see.
 */
export async function commissionableJobs(
  orgId: string,
  userId: string,
  range: PeriodRange,
): Promise<CommissionableJob[]> {
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      completedAt: { gte: range.from, lte: range.to },
      OR: [{ technicians: { some: { userId } } }, { timeEntries: { some: { userId } } }],
    },
    include: {
      labourLines: true,
      partLines: true,
      feeLines: true,
      timeEntries: { select: { minutes: true, costRate: true, userId: true } },
      invoices: { select: { status: true, total: true, amountPaid: true } },
    },
  });

  return jobs.map((job) => {
    const labourRevenue = job.labourLines.reduce(
      (total, line) =>
        total +
        Math.round(
          Number(line.hours) * Number(line.rate) * (1 - Number(line.discountPct ?? 0) / 100) * 100,
        ),
      0,
    );

    const partsRevenue = job.partLines.reduce(
      (total, line) =>
        total +
        Math.round(
          Number(line.quantity) *
            Number(line.unitPrice) *
            (1 - Number(line.discountPct ?? 0) / 100) *
            100,
        ),
      0,
    );

    const partsCost = job.partLines.reduce(
      (total, line) => total + Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
      0,
    );

    const labourCost = job.timeEntries.reduce(
      (total, entry) =>
        total + Math.round(((entry.minutes ?? 0) / 60) * Number(entry.costRate ?? 0) * 100),
      0,
    );

    const feeRevenue = job.feeLines.reduce(
      (total, line) => total + Math.round(Number(line.amount) * 100),
      0,
    );

    const invoice = job.invoices[0];

    return {
      jobId: job.id,
      jobNumber: job.number,
      completedAt: job.completedAt ?? new Date(),
      labourRevenue: money(labourRevenue),
      labourCost: money(labourCost),
      partsRevenue: money(partsRevenue),
      partsCost: money(partsCost),
      feeRevenue: money(feeRevenue),
      settled: invoice ? Number(invoice.amountPaid) >= Number(invoice.total) : false,
    };
  });
}

export async function schemeFor(orgId: string, schemeId: string): Promise<CommissionScheme> {
  const scheme = await prisma.commissionScheme.findFirstOrThrow({
    where: { id: schemeId, orgId },
    include: { bands: { orderBy: { sortOrder: 'asc' } } },
  });

  return {
    id: scheme.id,
    name: scheme.name,
    basis: scheme.basis as CommissionBasis,
    bands: scheme.bands.map((band) => ({
      fromMinor: Math.round(Number(band.fromAmount) * 100),
      rate: Number(band.rate),
    })),
    thresholdMinor: Math.round(Number(scheme.threshold) * 100),
    guaranteeMinor: Math.round(Number(scheme.guarantee) * 100),
    paidOnSettlement: scheme.paidOnSettlement,
  };
}

/** One person's commission for a period, calculated live rather than stored. */
export async function commissionFor(
  orgId: string,
  employeeId: string,
  schemeId: string,
  range: PeriodRange,
) {
  const [employee, scheme] = await Promise.all([
    prisma.employee.findFirstOrThrow({ where: { id: employeeId, orgId } }),
    schemeFor(orgId, schemeId),
  ]);

  if (!employee.userId) {
    return { employee, scheme, result: calculateCommission(scheme, []) };
  }

  const jobs = await commissionableJobs(orgId, employee.userId, range);
  return { employee, scheme, result: calculateCommission(scheme, jobs) };
}

/* ---------------------------------------------------------------------------
   Certifications
   --------------------------------------------------------------------------- */

/**
 * Qualifications that have lapsed or are about to.
 *
 * An MOT tester whose licence expired is not a reminder, it is work that
 * cannot legally be signed off, so this is ordered by urgency and surfaced on
 * the people page rather than filed somewhere nobody opens.
 */
export async function expiringCertifications(orgId: string, withinDays = 60) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);

  const certifications = await prisma.certification.findMany({
    where: { orgId, expiresOn: { not: null, lte: horizon }, employee: { isActive: true } },
    include: { employee: { select: { id: true, displayName: true } } },
    orderBy: { expiresOn: 'asc' },
  });

  const today = new Date();

  return certifications.map((certification) => {
    const days = Math.ceil((certification.expiresOn!.getTime() - today.getTime()) / 86_400_000);

    return {
      ...certification,
      daysRemaining: days,
      expired: days < 0,
    };
  });
}

/** Open shifts right now, for the live board. */
export async function onSiteNow(orgId: string, locationId?: string | null) {
  return prisma.attendanceRecord.findMany({
    where: { orgId, endedAt: null, ...(locationId ? { locationId } : {}) },
    include: {
      employee: { select: { id: true, displayName: true, jobTitle: true } },
      location: { select: { name: true } },
    },
    orderBy: { startedAt: 'asc' },
  });
}
