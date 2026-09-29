import {
  clashesAmong,
  type Commitment,
  couldPromise,
  lapsingBetween,
  type SchedulableMachine,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * What the diary does not know about the machines, and now does.
 *
 * A booking's kind of work is already recorded, by two routes: the job it
 * became, or the package it was booked from. Neither needed a new column --
 * which is worth saying, because the obvious move was to put a `jobTypeId` on
 * `Booking` and it would have been a third place for the same fact to be
 * wrong.
 *
 * A booking that is neither says nothing about machines, and is therefore
 * never reported as clashing. That is honest: the product does not know what
 * "Look at the noise" needs, and guessing would produce a clash a workshop
 * cannot act on and would learn to scroll past.
 *
 * Phase 91.
 */

const MACHINE_SELECT = {
  id: true,
  name: true,
  isActive: true,
  outOfServiceSince: true,
  certificateExpiresAt: true,
} as const;

function asSchedulable(row: {
  id: string;
  name: string;
  isActive: boolean;
  outOfServiceSince: Date | null;
  certificateExpiresAt: Date | null;
}): SchedulableMachine {
  return {
    equipmentId: row.id,
    name: row.name,
    facts: {
      retired: !row.isActive,
      outOfServiceSince: row.outOfServiceSince,
      certificateExpiresAt: row.certificateExpiresAt,
      inUseOnJobs: 0,
    },
  };
}

/** Every machine the workshop has, as the scheduling rules want them. */
async function machinesOf(orgId: string): Promise<SchedulableMachine[]> {
  // bounded: the machines one workshop owns. A large site has tens; a chain
  // records them per site.
  const rows = await prisma.equipment.findMany({
    where: { orgId },
    select: MACHINE_SELECT,
  });
  return rows.map(asSchedulable);
}

/** Which machines each kind of work cannot be done without. */
async function machinesByJobType(orgId: string): Promise<Map<string, string[]>> {
  // bounded: one row per (kind of work, machine) pair a workshop has declared.
  const rows = await prisma.jobTypeEquipment.findMany({
    where: { equipment: { orgId } },
    select: { jobTypeId: true, equipmentId: true },
  });

  const map = new Map<string, string[]>();
  for (const row of rows) {
    map.set(row.jobTypeId, [...(map.get(row.jobTypeId) ?? []), row.equipmentId]);
  }
  return map;
}

/** The bookings in a window, each with the machines its work requires. */
async function commitmentsIn(
  orgId: string,
  from: Date,
  to: Date,
  byJobType: Map<string, string[]>,
): Promise<Commitment[]> {
  // bounded: by the window the caller asked for, which every screen sets.
  const bookings = await prisma.booking.findMany({
    where: {
      orgId,
      startAt: { gte: from, lte: to },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      description: true,
      startAt: true,
      endAt: true,
      package: { select: { jobTypeId: true } },
      job: { select: { jobTypes: { select: { jobTypeId: true } } } },
      customer: { select: { displayName: true } },
      vehicle: { select: { registration: true } },
    },
  });

  return bookings.map((booking) => {
    const jobTypeIds = [
      ...(booking.package?.jobTypeId ? [booking.package.jobTypeId] : []),
      ...(booking.job?.jobTypes ?? []).map((one) => one.jobTypeId),
    ];

    // A machine required by two of a booking's kinds of work is still one
    // machine, and naming it twice would read as two clashes.
    const machineIds = [...new Set(jobTypeIds.flatMap((id) => byJobType.get(id) ?? []))];

    return {
      bookingId: booking.id,
      label: [booking.vehicle.registration, booking.customer.displayName, booking.description]
        .filter(Boolean)
        .join(' · '),
      startAt: booking.startAt,
      endAt: booking.endAt,
      machineIds,
    };
  });
}

export interface DiaryTrouble {
  clashes: ReturnType<typeof clashesAmong>;
  lapsing: ReturnType<typeof lapsingBetween>;
  /** How many bookings in the window name a machine at all. */
  bookingsNeedingAMachine: number;
}

/**
 * Every promise in a window the workshop cannot keep, and every certificate
 * that runs out inside it.
 *
 * The second is not a clash. Nothing is booked against those machines yet, and
 * that is exactly why it is worth saying while there is still time to book the
 * engineer rather than cancel the work.
 */
export async function diaryTrouble(
  orgId: string,
  window: { from: Date; to: Date },
): Promise<DiaryTrouble> {
  const [machines, byJobType] = await Promise.all([machinesOf(orgId), machinesByJobType(orgId)]);
  const commitments = await commitmentsIn(orgId, window.from, window.to, byJobType);

  return {
    clashes: clashesAmong(commitments, machines),
    lapsing: lapsingBetween(machines, window.from, window.to),
    bookingsNeedingAMachine: commitments.filter((one) => one.machineIds.length > 0).length,
  };
}

/**
 * Whether an appointment could be honoured, asked before it is taken.
 *
 * So a workshop on the telephone learns before the customer hangs up, rather
 * than on the morning.
 */
export async function couldBook(input: {
  orgId: string;
  startAt: Date;
  endAt: Date;
  jobTypeIds: readonly string[];
  label?: string;
}) {
  const [machines, byJobType] = await Promise.all([
    machinesOf(input.orgId),
    machinesByJobType(input.orgId),
  ]);

  const machineIds = [...new Set(input.jobTypeIds.flatMap((id) => byJobType.get(id) ?? []))];
  if (machineIds.length === 0) return { ok: true, clashes: [] };

  // The same day either side, because a booking can only clash with one that
  // overlaps it and nothing overlapping can start more than a day away.
  const dayBefore = new Date(input.startAt.getTime() - 86_400_000);
  const dayAfter = new Date(input.endAt.getTime() + 86_400_000);
  const existing = await commitmentsIn(input.orgId, dayBefore, dayAfter, byJobType);

  return couldPromise(
    {
      bookingId: 'proposed',
      label: input.label ?? 'This booking',
      startAt: input.startAt,
      endAt: input.endAt,
      machineIds,
    },
    existing,
    machines,
  );
}

/** The booked work one machine is promised to, for its own page. */
export async function bookedOn(orgId: string, equipmentId: string, from = new Date()) {
  const byJobType = await machinesByJobType(orgId);
  const to = new Date(from.getTime() + 90 * 86_400_000);
  const commitments = await commitmentsIn(orgId, from, to, byJobType);

  return commitments
    .filter((one) => one.machineIds.includes(equipmentId))
    .map((one) => ({ bookingId: one.bookingId, label: one.label, startAt: one.startAt }));
}
