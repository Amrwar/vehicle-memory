import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * What the fleet calls it. Phase 69. FR-303.
 *
 * A company running forty vans paints a number on each door. When the driver
 * rings, he says "van 17 is making a noise" — he has never looked at the
 * registration, and the workshop has to find the van from the only name he
 * knows.
 *
 * Which makes the searching half the feature rather than a nicety. A number
 * that can be typed in and not looked up is a column somebody filled in once,
 * and this repository has found three of those already: a follow-up table
 * nothing read, a courtesy note nothing wrote, a quality register naming a
 * check that tested something else. So `searchEverything` reaches for this,
 * and the probe asks the search box rather than the table.
 *
 * Not on the vehicle. `Vehicle` is global — one row for every workshop and
 * every owner the van will ever have (ADR-0004) — and "Van 17" is Northgate
 * Leasing's name for it, not a fact about a Transit. On the vehicle it would
 * follow the van when Northgate sold it and show to every workshop that ever
 * touched it. FR-303 says "a vehicle record MUST capture fleet number"; the
 * requirement predates that reasoning, and the same argument settled the
 * owner's name in the passport in Phase 62.
 */

export class FleetNumberError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_YOURS' | 'TAKEN' | 'BLANK',
  ) {
    super(message);
    this.name = 'FleetNumberError';
  }
}

/** Postgres says this when one number is given to two vans. */
const TAKEN = 'fleet_numbers_one_per_number';

/** Giving a van the number its owner calls it by. */
export async function setFleetNumber(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  number: string;
}): Promise<void> {
  const number = input.number.trim();

  if (number.length === 0) {
    throw new FleetNumberError('Say what they call it.', 'BLANK');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true },
  });

  if (!customer) throw new FleetNumberError('That customer is not one of yours.', 'NOT_YOURS');

  // The workshop has to have seen the van. A vehicle is global, so "one of
  // this fleet's" is a claim that needs grounding in something rather than
  // asserting — the same rule the courtesy fleet follows.
  const seen = await prisma.job.findFirst({
    where: { orgId: input.orgId, vehicleId: input.vehicleId },
    select: { id: true },
  });

  if (!seen) {
    throw new FleetNumberError('That van has not been in here yet.', 'NOT_YOURS');
  }

  await prisma.fleetNumber
    .upsert({
      where: {
        orgId_customerId_vehicleId: {
          orgId: input.orgId,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
        },
      },
      create: {
        orgId: input.orgId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        number,
      },
      update: { number },
    })
    .catch((error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes(TAKEN)) {
        throw new FleetNumberError(
          'They already call another van that. Two vans with one number cannot be rung about.',
          'TAKEN',
        );
      }
      throw error;
    });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fleet.number_set',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: { customerId: input.customerId, number },
  });
}

/** Taking it off, when the van leaves the fleet. */
export async function clearFleetNumber(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
}): Promise<void> {
  const { count } = await prisma.fleetNumber.deleteMany({
    where: { orgId: input.orgId, customerId: input.customerId, vehicleId: input.vehicleId },
  });

  if (count === 0) return;

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fleet.number_cleared',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: { customerId: input.customerId },
  });
}

/** What this customer calls each of these vans. */
export async function fleetNumbersFor(
  orgId: string,
  customerId: string,
): Promise<Map<string, string>> {
  // bounded: the numbered vans of one fleet. A company with four hundred is a
  // haulier, and four hundred short rows is still one query.
  const rows = await prisma.fleetNumber.findMany({
    where: { orgId, customerId },
    select: { vehicleId: true, number: true },
  });

  return new Map(rows.map((row) => [row.vehicleId, row.number]));
}

/** What one customer calls one van, if anything. */
export async function fleetNumberFor(
  orgId: string,
  customerId: string,
  vehicleId: string,
): Promise<string | null> {
  const row = await prisma.fleetNumber.findFirst({
    where: { orgId, customerId, vehicleId },
    select: { number: true },
  });

  return row?.number ?? null;
}
