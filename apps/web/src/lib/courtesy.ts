import {
  assertLendable,
  CourtesyError,
  describeLoan,
  freeOver,
  type Loan,
  outNow,
  overdueCount,
  loanStanding,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The courtesy car. Phase 67. FR-512.
 *
 * The rules are in `@carnet/core`; this is the part that touches the database.
 *
 * Everything here reads through `orgId`, which the tenant extension narrows
 * for both of these models — they carry one, so Phase 64's generated list
 * covers them without anybody adding a name to anything. The loan's own
 * `vehicleId` is denormalised from the courtesy vehicle because the exclusion
 * constraint has to compare the car itself, and a constraint cannot follow a
 * foreign key.
 */

export { CourtesyError };

/** Postgres says this when two loans of one car meet. */
const OVERLAP = 'courtesy_loans_no_overlap';

function isOverlap(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes(OVERLAP);
}

export interface FleetCar {
  id: string;
  vehicleId: string;
  name: string | null;
  registration: string | null;
  description: string;
  isActive: boolean;
}

const describe = (vehicle: { make: string | null; model: string | null; colour: string | null }) =>
  [vehicle.colour, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';

/** The cars this workshop lends. */
export async function fleetFor(orgId: string, includeRetired = false): Promise<FleetCar[]> {
  // bounded: the courtesy cars of one workshop. A garage with forty is a hire
  // company, and forty rows is still one small query.
  const cars = await prisma.courtesyVehicle.findMany({
    where: { orgId, ...(includeRetired ? {} : { isActive: true }) },
    select: {
      id: true,
      vehicleId: true,
      name: true,
      isActive: true,
      vehicle: { select: { registration: true, make: true, model: true, colour: true } },
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });

  return cars.map((car) => ({
    id: car.id,
    vehicleId: car.vehicleId,
    name: car.name,
    registration: car.vehicle.registration,
    description: describe(car.vehicle),
    isActive: car.isActive,
  }));
}

/**
 * Saying this is one of ours to lend.
 *
 * A vehicle already on the workshop's records, rather than a new kind of
 * thing. `fleet.ts` settled that argument for customer fleets — "inventing a
 * separate entity would mean two places a vehicle can belong and an eventual
 * argument about which one is right" — and the same reasoning holds here.
 */
export async function addToFleet(input: {
  orgId: string;
  userId: string;
  vehicleId: string;
  name?: string | null;
}): Promise<{ id: string }> {
  // The workshop has to have worked on it, which is what a grant records. A
  // vehicle is global (ADR-0004), so "one of ours" is a claim that has to be
  // grounded in something rather than asserted.
  const known = await prisma.vehicleAccessGrant.findFirst({
    where: { orgId: input.orgId, vehicleId: input.vehicleId },
    select: { id: true },
  });

  if (!known) throw new CourtesyError('That car is not on this workshop’s records.', 'NOT_OURS');

  const existing = await prisma.courtesyVehicle.findFirst({
    where: { orgId: input.orgId, vehicleId: input.vehicleId },
    select: { id: true, isActive: true },
  });

  // Lending one again after retiring it is the same car, not a second record.
  const car = existing
    ? await prisma.courtesyVehicle.update({
        where: { id: existing.id },
        data: { isActive: true, retiredAt: null, name: input.name?.trim() || null },
        select: { id: true },
      })
    : await prisma.courtesyVehicle.create({
        data: {
          orgId: input.orgId,
          vehicleId: input.vehicleId,
          name: input.name?.trim() || null,
        },
        select: { id: true },
      });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'courtesy.added',
    entityType: 'CourtesyVehicle',
    entityId: car.id,
    after: { vehicleId: input.vehicleId },
  });

  return car;
}

/** Taking one out of service. */
export async function retireFromFleet(input: {
  orgId: string;
  userId: string;
  courtesyVehicleId: string;
}): Promise<void> {
  const car = await prisma.courtesyVehicle.findFirst({
    where: { id: input.courtesyVehicleId, orgId: input.orgId },
    select: { id: true, vehicleId: true },
  });

  if (!car) throw new CourtesyError('That is not one of your courtesy cars.', 'NOT_OURS');

  // Not while somebody has it. Retiring a car that is out would take it off
  // the list of what is owed back, which is the one list that must not lose a
  // car.
  const out = await prisma.courtesyLoan.count({
    where: { courtesyVehicleId: car.id, returnedAt: null, cancelledAt: null },
  });

  if (out > 0) {
    throw new CourtesyError('That car is out with somebody. Take it back first.', 'ALREADY_BACK');
  }

  await prisma.courtesyVehicle.update({
    where: { id: car.id },
    data: { isActive: false, retiredAt: new Date() },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'courtesy.retired',
    entityType: 'CourtesyVehicle',
    entityId: car.id,
    after: { vehicleId: car.vehicleId },
  });
}

/** Vehicles this workshop could add, being ones it already works on. */
export async function lendableVehicles(orgId: string): Promise<{ id: string; label: string }[]> {
  const already = await prisma.courtesyVehicle.findMany({
    where: { orgId, isActive: true },
    select: { vehicleId: true },
  });

  // bounded: the fifty most recently touched vehicles this workshop has a
  // grant for. A courtesy car is one of the workshop's own and will be near
  // the top; a list of every car it has ever seen would be thousands long and
  // no more useful.
  const grants = await prisma.vehicleAccessGrant.findMany({
    where: {
      orgId,
      revokedAt: null,
      vehicleId: { notIn: already.map((one) => one.vehicleId) },
    },
    select: {
      vehicle: {
        select: { id: true, registration: true, make: true, model: true, colour: true },
      },
    },
    orderBy: { grantedAt: 'desc' },
    take: 50,
  });

  return grants.map((grant) => ({
    id: grant.vehicle.id,
    label: [grant.vehicle.registration, describe(grant.vehicle)].filter(Boolean).join(' — '),
  }));
}

/** Every loan that could still stand in the way of another. */
async function liveLoans(orgId: string): Promise<Loan[]> {
  // bounded: what is not yet back, plus anything promised from today onward.
  // A workshop's history of loans grows forever; what blocks a new one does
  // not.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await prisma.courtesyLoan.findMany({
    where: {
      orgId,
      cancelledAt: null,
      OR: [{ returnedAt: null }, { dueBackAt: { gte: today } }],
    },
    select: { id: true, vehicleId: true, startAt: true, dueBackAt: true, returnedAt: true },
  });

  return rows;
}

/** Which of them are free over a period, and which are not and why. */
export async function freeBetween(
  orgId: string,
  startAt: Date,
  dueBackAt: Date,
): Promise<{ free: FleetCar[]; taken: FleetCar[] }> {
  const [fleet, loans] = await Promise.all([fleetFor(orgId), liveLoans(orgId)]);
  const wanted = { startAt, endAt: dueBackAt };

  const free = freeOver(fleet, loans, wanted);
  const freeIds = new Set(free.map((car) => car.id));

  return { free, taken: fleet.filter((car) => !freeIds.has(car.id)) };
}

/**
 * Promising one to somebody.
 *
 * Checked twice, on purpose, and the second one is the real one. The core
 * assertion reads what is already promised and says no with a sentence
 * somebody can act on — which is what a person needs. The database constraint
 * says no whatever the timing, which is what the product needs: two people
 * booking at the same moment both read before either writes, and no amount of
 * checking first fixes that.
 *
 * So the constraint is caught and translated rather than left to surface as a
 * database error. A customer told "that car is already promised" can be
 * offered another one; a customer shown a constraint name cannot.
 */
export async function lend(input: {
  orgId: string;
  userId: string;
  courtesyVehicleId: string;
  customerId: string;
  startAt: Date;
  dueBackAt: Date;
  jobId?: string | null;
  bookingId?: string | null;
  odometerOutKm?: number | null;
  note?: string | null;
}): Promise<{ id: string }> {
  const car = await prisma.courtesyVehicle.findFirst({
    where: { id: input.courtesyVehicleId, orgId: input.orgId, isActive: true },
    select: { id: true, vehicleId: true },
  });

  if (!car) throw new CourtesyError('That is not one of your courtesy cars.', 'NOT_OURS');

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true },
  });

  if (!customer) throw new CourtesyError('That customer is not one of yours.', 'NOT_OURS');

  const [loans, papers] = await Promise.all([
    liveLoans(input.orgId),
    // What the workshop knows about whether the car is allowed on the road.
    // bounded: the documents of one vehicle that have an expiry at all.
    prisma.vehicleDocument.findMany({
      where: { vehicleId: car.vehicleId, removedAt: null, expiresAt: { not: null } },
      select: { kind: true, expiresAt: true },
    }),
  ]);

  assertLendable({
    wanted: { startAt: input.startAt, endAt: input.dueBackAt },
    existing: loans,
    vehicleId: car.vehicleId,
    papers,
  });

  const created = await prisma.courtesyLoan
    .create({
      data: {
        orgId: input.orgId,
        courtesyVehicleId: car.id,
        vehicleId: car.vehicleId,
        customerId: input.customerId,
        jobId: input.jobId ?? null,
        bookingId: input.bookingId ?? null,
        startAt: input.startAt,
        dueBackAt: input.dueBackAt,
        odometerOutKm: input.odometerOutKm ?? null,
        handedOverByUserId: input.userId,
        note: input.note?.trim() || null,
      },
      select: { id: true },
    })
    .catch((error: unknown) => {
      // Somebody else promised the same car between the check above and this
      // line. Rare, and the only moment the constraint is the difference
      // between a refusal and a customer standing at a counter.
      if (isOverlap(error)) {
        throw new CourtesyError(
          'That car has just been promised to somebody else over those days.',
          'ALREADY_PROMISED',
        );
      }
      throw error;
    });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'courtesy.lent',
    entityType: 'CourtesyLoan',
    entityId: created.id,
    after: {
      vehicleId: car.vehicleId,
      customerId: input.customerId,
      startAt: input.startAt.toISOString(),
      dueBackAt: input.dueBackAt.toISOString(),
    },
  });

  return created;
}

/** Taking it back. */
export async function takeBack(input: {
  orgId: string;
  userId: string;
  loanId: string;
  odometerInKm?: number | null;
  at?: Date;
}): Promise<void> {
  const loan = await prisma.courtesyLoan.findFirst({
    where: { id: input.loanId, orgId: input.orgId },
    select: { id: true, returnedAt: true, cancelledAt: true, startAt: true, vehicleId: true },
  });

  if (!loan) throw new CourtesyError('That loan is not one of yours.', 'NOT_OURS');
  if (loan.returnedAt) throw new CourtesyError('That car is already back.', 'ALREADY_BACK');
  if (loan.cancelledAt) throw new CourtesyError('That loan was cancelled.', 'ALREADY_BACK');

  const at = input.at ?? new Date();

  if (at < loan.startAt) {
    throw new CourtesyError('It cannot come back before it went out.', 'BACKWARDS');
  }

  await prisma.courtesyLoan.update({
    where: { id: loan.id },
    data: {
      returnedAt: at,
      odometerInKm: input.odometerInKm ?? null,
      takenBackByUserId: input.userId,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'courtesy.returned',
    entityType: 'CourtesyLoan',
    entityId: loan.id,
    after: { returnedAt: at.toISOString(), odometerInKm: input.odometerInKm ?? null },
  });
}

/** Calling one off before it starts. */
export async function callOff(input: {
  orgId: string;
  userId: string;
  loanId: string;
  reason: string;
}): Promise<void> {
  if (input.reason.trim().length < 3) {
    throw new CourtesyError('Say why, so the next person reading this knows.', 'BACKWARDS');
  }

  const loan = await prisma.courtesyLoan.findFirst({
    where: { id: input.loanId, orgId: input.orgId },
    select: { id: true, returnedAt: true },
  });

  if (!loan) throw new CourtesyError('That loan is not one of yours.', 'NOT_OURS');
  if (loan.returnedAt) throw new CourtesyError('That car is already back.', 'ALREADY_BACK');

  await prisma.courtesyLoan.update({
    where: { id: loan.id },
    data: { cancelledAt: new Date(), cancelReason: input.reason.trim() },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'courtesy.called_off',
    entityType: 'CourtesyLoan',
    entityId: loan.id,
    after: { reason: input.reason.trim() },
  });
}

export interface LoanRow extends Loan {
  customerName: string;
  registration: string | null;
  description: string;
  name: string | null;
  jobId: string | null;
  odometerOutKm: number | null;
}

const LOAN_ROW = {
  id: true,
  vehicleId: true,
  startAt: true,
  dueBackAt: true,
  returnedAt: true,
  odometerOutKm: true,
  jobId: true,
  customer: { select: { displayName: true } },
  courtesyVehicle: { select: { name: true } },
  vehicle: { select: { registration: true, make: true, model: true, colour: true } },
} as const;

type LoadedLoan = {
  id: string;
  vehicleId: string;
  startAt: Date;
  dueBackAt: Date;
  returnedAt: Date | null;
  odometerOutKm: number | null;
  jobId: string | null;
  customer: { displayName: string };
  courtesyVehicle: { name: string | null };
  vehicle: {
    registration: string | null;
    make: string | null;
    model: string | null;
    colour: string | null;
  };
};

const shape = (row: LoadedLoan): LoanRow => ({
  id: row.id,
  vehicleId: row.vehicleId,
  startAt: row.startAt,
  dueBackAt: row.dueBackAt,
  returnedAt: row.returnedAt,
  odometerOutKm: row.odometerOutKm,
  jobId: row.jobId,
  customerName: row.customer.displayName,
  registration: row.vehicle.registration,
  description: describe(row.vehicle),
  name: row.courtesyVehicle.name,
});

/** What is out now, soonest due back first. */
export async function loansOut(orgId: string): Promise<LoanRow[]> {
  // bounded: what has not come back. A workshop with more than a handful out
  // has lost track of its cars, which is the situation this page is for.
  const rows = await prisma.courtesyLoan.findMany({
    where: { orgId, returnedAt: null, cancelledAt: null, startAt: { lte: new Date() } },
    select: LOAN_ROW,
    orderBy: { dueBackAt: 'asc' },
    take: 50,
  });

  return outNow(rows.map(shape)) as LoanRow[];
}

/** How many are late, for a figure on a screen somebody already reads. */
export async function courtesyOverdue(orgId: string): Promise<number> {
  return overdueCount(await loansOut(orgId));
}

/** Every loan against one job, for the card on it. */
export async function loansForJob(orgId: string, jobId: string): Promise<LoanRow[]> {
  // bounded: the loans of one job, which is almost always one.
  const rows = await prisma.courtesyLoan.findMany({
    where: { orgId, jobId, cancelledAt: null },
    select: LOAN_ROW,
    orderBy: { startAt: 'desc' },
  });

  return rows.map(shape);
}

export { describeLoan, loanStanding };
