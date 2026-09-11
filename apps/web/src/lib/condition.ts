import {
  averageKmPerDay,
  classifyPart,
  type ComponentClass,
  componentsFrom,
  coverStatusOf,
  componentsMissing,
  type ComponentState,
  dueWithin,
  type Fitting,
  type Health,
  healthOf,
  type Prediction,
  predictDue,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * A vehicle's condition, assembled from records that already existed.
 *
 * Nothing here is stored. Every figure is derived from job lines, inspection
 * findings, estimate decisions, service schedules and odometer readings, all
 * of which the product has been writing since Phase 1 and none of which was
 * ever read as the state of the car.
 *
 * Deriving rather than storing costs a query and buys the one property that
 * matters: there is no second account of the vehicle to fall out of step with
 * the first. Correct a job line and the condition corrects itself.
 *
 * The queries are bounded. A vehicle has tens of visits, not millions, and
 * the joins below are all on indexed foreign keys. The one deliberate choice
 * is reading part lines through jobs rather than as their own query: the job
 * is where the date and the odometer reading live, and a part line without
 * either cannot be aged.
 */

/** Work that actually happened, rather than work that was merely booked. */
const DONE = ['COMPLETED', 'INVOICED', 'PAID'] as const;

export interface Condition {
  health: Health;
  components: ComponentState[];
  missing: ComponentClass[];
  /** Everything coming, nearest first. */
  predictions: Prediction[];
  /** The handful worth putting in front of somebody. */
  soon: Prediction[];
  kmPerDay: number | null;
  currentKm: number | null;
  visits: number;
}

/**
 * Everything the condition is built from, in one round of queries.
 *
 * Five queries rather than one clever join. The alternative is a single query
 * that nobody can change six months from now, and this runs against a vehicle
 * whose whole history is a few hundred rows.
 */
export async function conditionOf(
  orgId: string,
  vehicleId: string,
  now = new Date(),
): Promise<Condition> {
  const [vehicle, jobs, inspections, declined, readings] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        lastOdometerKm: true,
        serviceSchedules: {
          where: { isActive: true },
          select: { name: true, dueAt: true, dueKm: true },
        },
      },
    }),

    // Part lines through their jobs, because the job carries the date and the
    // odometer reading that make a fitting ageable.
    prisma.job.findMany({
      where: { orgId, vehicleId, status: { in: [...DONE] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        number: true,
        completedAt: true,
        createdAt: true,
        odometerInKm: true,
        partLines: {
          select: {
            description: true,
            partNumber: true,
            product: { select: { brand: true } },
          },
        },
      },
    }),

    prisma.inspection.findMany({
      where: { job: { orgId, vehicleId }, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: {
        completedAt: true,
        results: {
          where: { severity: { in: ['ADVISORY', 'CRITICAL'] } },
          select: {
            id: true,
            severity: true,
            // A finding is put right when it becomes a line somebody approved.
            estimateLines: { select: { decision: true } },
          },
        },
      },
    }),

    prisma.estimateLine.findMany({
      where: {
        decision: 'DECLINED',
        estimate: { job: { orgId, vehicleId } },
      },
      select: {
        inspectionResult: { select: { severity: true } },
      },
    }),

    prisma.odometerReading.findMany({
      where: { vehicleId, anomaly: 'NONE' },
      orderBy: { readAt: 'desc' },
      take: 40,
      select: { km: true, readAt: true },
    }),
  ]);

  const currentKm = vehicle?.lastOdometerKm ?? null;

  /* --- what was fitted, and when ------------------------------------------ */

  const fittings: Fitting[] = [];
  // Every past fitting mileage per component, so the prediction can learn this
  // vehicle's own intervals rather than using a general figure.
  const historyKm = new Map<ComponentClass, number[]>();

  for (const job of jobs) {
    const fittedOn = job.completedAt ?? job.createdAt;

    for (const line of job.partLines) {
      fittings.push({
        description: line.description,
        partNumber: line.partNumber,
        brand: line.product?.brand ?? null,
        fittedOn,
        fittedAtKm: job.odometerInKm,
        jobId: job.id,
        jobNumber: job.number,
      });
    }
  }

  const components = componentsFrom(fittings, { now, currentKm });

  // One pass, using the same classifier the components use, so the two can
  // never disagree about what a line was. Classifying inside a loop over
  // components instead would be the number of components times the number of
  // fittings, for an answer a single pass already has.
  for (const fitting of fittings) {
    if (fitting.fittedAtKm == null) continue;

    const component = classifyPart(fitting.description, fitting.partNumber);
    if (!component) continue;

    const held = historyKm.get(component);
    if (held) held.push(fitting.fittedAtKm);
    else historyKm.set(component, [fitting.fittedAtKm]);
  }

  for (const mileages of historyKm.values()) mileages.sort((a, b) => a - b);

  /* --- what is wrong, and what was turned down ----------------------------- */

  let openCritical = 0;
  let openAdvisory = 0;

  // Only the most recent inspection describes the vehicle now. Counting every
  // finding ever made would have a car that was put right six times reading
  // worse than one nobody has ever looked at.
  const latest = inspections[0];

  for (const result of latest?.results ?? []) {
    const addressed = result.estimateLines.some((line) => line.decision === 'APPROVED');
    if (addressed) continue;

    if (result.severity === 'CRITICAL') openCritical += 1;
    else openAdvisory += 1;
  }

  const declinedCritical = declined.filter(
    (line) => line.inspectionResult?.severity === 'CRITICAL',
  ).length;

  /* --- the numbers ---------------------------------------------------------- */

  const kmPerDay = averageKmPerDay(readings);

  const predictions = predictDue({ components, historyKm, currentKm, kmPerDay, now });

  const health = healthOf({
    schedules: vehicle?.serviceSchedules ?? [],
    openCritical,
    openAdvisory,
    inspectionsEver: inspections.length,
    lastInspectionAt: latest?.completedAt ?? null,
    declinedTotal: declined.length,
    declinedCritical,
    components,
    visits: jobs.length,
    currentKm,
    now,
  });

  return {
    health,
    components,
    missing: componentsMissing(components),
    predictions,
    soon: dueWithin(predictions),
    kmPerDay,
    currentKm,
    visits: jobs.length,
  };
}

/**
 * Cover on this vehicle that a new job might be claiming against.
 *
 * The workshop half of the same records. A battery replaced seven months ago
 * is a possible warranty claim, and the moment somebody needs to know that is
 * the moment they open a job, not a month later when the invoice is written.
 */
export async function coverWorthChecking(orgId: string, vehicleId: string, now = new Date()) {
  const rows = await prisma.warranty.findMany({
    where: { orgId, vehicleId, voidedAt: null },
    orderBy: { startedOn: 'desc' },
    take: 40,
    select: {
      id: true,
      description: true,
      kind: true,
      startedOn: true,
      months: true,
      partsValue: true,
      supplier: { select: { name: true } },
      supplierMonths: true,
      job: { select: { id: true, number: true } },
      claims: { where: { status: 'OPEN' }, select: { id: true } },
    },
  });

  return rows
    .filter((row) => {
      // The same expiry arithmetic the warranty book uses, rather than a
      // second copy of it here that would eventually disagree about a
      // month-end.
      const status = coverStatusOf(
        {
          id: row.id,
          kind: row.kind as 'PART' | 'LABOUR',
          description: row.description,
          startedOn: row.startedOn,
          months: row.months,
          km: null,
          startedAtKm: null,
          voidedReason: null,
          supplierName: row.supplier?.name ?? null,
          supplierMonths: row.supplierMonths,
        },
        now,
        null,
      );

      return status.active && row.claims.length === 0;
    })
    .map((row) => ({
      id: row.id,
      description: row.description,
      startedOn: row.startedOn,
      jobId: row.job.id,
      jobNumber: row.job.number,
      supplierName: row.supplier?.name ?? null,
      // The part of it somebody else would pay, which is the reason to look
      // before doing the work rather than after.
      recoverable: row.supplier && row.supplierMonths ? Number(row.partsValue) : 0,
    }));
}
