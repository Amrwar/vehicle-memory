import {
  assertClaimDecidable,
  assertVehicleClaimable,
  type ClaimStatus,
  ClaimError,
  checkPassword,
  claimQueueOrder,
  describeAmbiguity,
  describeClaim,
  identifierKind,
  normaliseRegistration,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { hashPassword } from './auth';
import { requestVerification } from './credentials';
import { breachedPasswordProblem } from './breach';
import { audit } from './guard';
import { pushNow } from './outbound';

/**
 * Customers with accounts of their own, and how a vehicle gets onto one.
 *
 * Until now a portal account only existed because a workshop made one. That
 * is the safest arrangement and it is also the reason a customer who changes
 * garages loses the history the product promised would follow the car.
 *
 * Self-registration fixes that without weakening the thing it rests on. An
 * account is easy to create and worth nothing on its own: a registration plate
 * is visible from across a car park, so entering one proves nothing and grants
 * nothing. A vehicle appears on an account only when a person at the workshop
 * that serviced it says it should.
 */

export { ClaimError };

/** Registers a customer. No vehicles, and nothing to see until one is granted. */
export async function registerCustomer(input: {
  name: string;
  email: string;
  password: string;
  ip?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!name) throw new ClaimError('NO_REASON', 'Tell us your name.');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ClaimError('NO_REASON', 'That does not look like an email address.');
  }

  // The same rule the reset page enforces. A weaker one here would leave the
  // account that holds a vehicle history protected by less than the account
  // that resets it.
  const password = checkPassword(input.password, email);
  if (!password.ok) throw new ClaimError('NO_REASON', password.problem!);

  const breached = await breachedPasswordProblem(input.password);
  if (breached) throw new ClaimError('NO_REASON', breached);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    // Deliberately the same shape of refusal a workshop sign-up gives. It
    // reveals that the address is taken, which is unavoidable on a form that
    // has to stop duplicates, and the reset link is the honest way through.
    throw new ClaimError(
      'ALREADY_ASKED',
      'There is already an account on that address. Sign in, or use the forgotten password link.',
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true },
  });

  // No membership, deliberately. A customer belongs to no workshop, which is
  // what makes the account theirs rather than a garage's record of them.
  await requestVerification(user.id, input.ip);

  await audit({
    actorUserId: user.id,
    action: 'customer.registered',
    entityType: 'User',
    entityId: user.id,
    after: { email },
  });

  return user;
}

/**
 * Asks for a vehicle.
 *
 * Sent to the workshop that last worked on it, because they are the only
 * people who can say whether the person asking is the person who owns it. The
 * product never decides this: it cannot tell an owner from a passer-by.
 */
export async function claimVehicle(input: {
  userId: string;
  identifier: string;
  note?: string | null;
}) {
  const kind = identifierKind(input.identifier);

  if (kind === 'NEITHER') {
    throw new ClaimError(
      'NO_VEHICLE',
      'That is neither a registration nor a VIN. A VIN is exactly 17 characters.',
    );
  }

  const cleaned = normaliseRegistration(input.identifier);

  const [user, openClaims, matches] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { emailVerifiedAt: true },
    }),
    prisma.vehicleClaim.count({ where: { userId: input.userId, status: 'PENDING' } }),
    kind === 'VIN'
      ? prisma.vehicle.findMany({
          where: { vin: cleaned },
          select: { id: true, registration: true, make: true, model: true, year: true },
        })
      : // Raw because the comparison is on the normalised plate, and Prisma
        // cannot express an index on a function of a column. The expression is
        // the one `vehicles_registration_normalised` is built on, character
        // for character, so this is an index seek rather than a scan of every
        // vehicle the network has ever seen.
        prisma.$queryRaw<
          {
            id: string;
            registration: string | null;
            make: string | null;
            model: string | null;
            year: number | null;
          }[]
        >`
          SELECT "id", "registration", "make", "model", "year"
          FROM "vehicles"
          WHERE "registration" IS NOT NULL
            AND upper(replace(replace("registration", ' ', ''), '-', '')) = ${cleaned}
          LIMIT 3
        `,
  ]);

  if (matches.length === 0) {
    throw new ClaimError(
      'NO_VEHICLE',
      kind === 'VIN'
        ? 'No vehicle with that VIN has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.'
        : 'No vehicle on that registration has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.',
    );
  }

  // A personalised plate moves from one car to the next, so the same
  // registration can belong to two vehicles years apart. Choosing between them
  // would eventually show somebody a stranger's history.
  if (matches.length > 1) {
    throw new ClaimError('NO_VEHICLE', describeAmbiguity(matches));
  }

  const found = matches[0]!;

  const [mine, asked, lastJob] = await Promise.all([
    prisma.customer.findFirst({
      where: { portalUserId: input.userId, jobs: { some: { vehicleId: found.id } } },
      select: { id: true },
    }),
    prisma.vehicleClaim.findFirst({
      where: { userId: input.userId, vehicleId: found.id, status: 'PENDING' },
      select: { id: true },
    }),
    prisma.job.findFirst({
      where: { vehicleId: found.id },
      orderBy: { createdAt: 'desc' },
      select: { orgId: true },
    }),
  ]);

  assertVehicleClaimable({
    verified: user.emailVerifiedAt !== null,
    openClaims,
    alreadyTheirs: Boolean(mine),
    alreadyAsked: Boolean(asked),
    hasWorkshop: Boolean(lastJob),
  });

  const claim = await prisma.vehicleClaim.create({
    data: {
      userId: input.userId,
      vehicleId: found.id,
      orgId: lastJob!.orgId,
      note: input.note?.trim() || null,
    },
    select: { id: true },
  });

  await audit({
    orgId: lastJob!.orgId,
    actorUserId: input.userId,
    action: 'vehicle.claim.asked',
    entityType: 'Vehicle',
    entityId: found.id,
    after: { registration: found.registration },
  });

  return claim.id;
}

/** What a customer sees about their own requests. */
export async function myClaims(userId: string) {
  const rows = await prisma.vehicleClaim.findMany({
    where: { userId },
    orderBy: { askedAt: 'desc' },
    take: 40,
    select: {
      id: true,
      status: true,
      reason: true,
      askedAt: true,
      // The workshop is deliberately not selected. A pending request is not
      // proof of a relationship, and naming the garage would tell somebody
      // where a car is serviced before they have shown any connection to it.
      vehicle: { select: { registration: true, make: true, model: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    summary: describeClaim({
      status: row.status as ClaimStatus,
      registration: row.vehicle.registration ?? 'that vehicle',
      askedAt: row.askedAt,
      reason: row.reason,
    }),
  }));
}

/** The queue a workshop answers. */
export async function claimsFor(orgId: string) {
  const rows = await prisma.vehicleClaim.findMany({
    where: { orgId },
    orderBy: { askedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      note: true,
      reason: true,
      askedAt: true,
      decidedAt: true,
      user: { select: { id: true, name: true, email: true, emailVerifiedAt: true } },
      vehicle: {
        select: { id: true, registration: true, make: true, model: true, year: true },
      },
      decidedBy: { select: { name: true } },
    },
  });

  if (rows.length === 0) return [];

  // What the workshop needs in order to answer: who they already have on
  // record against that vehicle. A name that matches is the whole decision;
  // one that does not is a telephone call.
  //
  // Fetched in one query rather than one per row. A queue of a hundred
  // requests asking a hundred questions is how a page that felt instant on the
  // first workshop becomes a page that times out on the fiftieth.
  const jobs = await prisma.job.findMany({
    where: { orgId, vehicleId: { in: rows.map((row) => row.vehicle.id) } },
    orderBy: { createdAt: 'desc' },
    select: {
      vehicleId: true,
      customer: { select: { id: true, displayName: true, email: true, mobile: true } },
    },
  });

  // Newest first, so the first job seen for a vehicle is the most recent one.
  const onRecord = new Map<string, (typeof jobs)[number]['customer']>();
  for (const job of jobs) {
    if (!onRecord.has(job.vehicleId)) onRecord.set(job.vehicleId, job.customer);
  }

  return claimQueueOrder(
    rows.map((row) => ({
      ...row,
      status: row.status as ClaimStatus,
      onRecord: onRecord.get(row.vehicle.id) ?? null,
    })),
  );
}

/**
 * Answers a request.
 *
 * Approving attaches the person to the customer record the workshop already
 * holds for that vehicle, rather than creating a second one. Two records for
 * one person is how a customer ends up with half their history.
 */
export async function decideClaim(input: {
  orgId: string;
  userId: string;
  claimId: string;
  approve: boolean;
  reason?: string | null;
}) {
  const claim = await prisma.vehicleClaim.findFirstOrThrow({
    where: { id: input.claimId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      userId: true,
      vehicleId: true,
      user: { select: { name: true, email: true } },
    },
  });

  const decision = {
    status: (input.approve ? 'APPROVED' : 'REJECTED') as ClaimStatus,
    reason: input.reason,
  };

  assertClaimDecidable({ current: claim.status as ClaimStatus, decision });

  let customerId: string | null = null;

  if (input.approve) {
    // The customer record against the most recent job on that vehicle, which
    // is the same one the queue showed the person deciding. Reading it back a
    // different way would let them approve one record having looked at another.
    const recent = await prisma.job.findFirst({
      where: { orgId: input.orgId, vehicleId: claim.vehicleId },
      orderBy: { createdAt: 'desc' },
      select: { customer: { select: { id: true, portalUserId: true } } },
    });

    if (!recent) {
      throw new ClaimError(
        'NO_VEHICLE',
        'There is no customer record against that vehicle here any more, so there is nothing to attach them to.',
      );
    }

    if (recent.customer.portalUserId && recent.customer.portalUserId !== claim.userId) {
      throw new ClaimError(
        'ALREADY_YOURS',
        'Somebody else already holds the portal account for that customer. Settle which of them it should be before approving this.',
      );
    }

    customerId = recent.customer.id;
  }

  // One transaction. Approving a request without attaching the customer would
  // tell somebody their history was ready and then show them nothing.
  const messageId = await prisma.$transaction(async (tx) => {
    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { portalUserId: claim.userId },
      });

      // The portal lists vehicles from ownership, not from jobs, so the car
      // only appears once there is an ownership row pointing at this account.
      //
      // Deliberately not a transfer. Nobody has bought or sold anything: the
      // person who already owned the car now has a login. Writing a transfer
      // event would put a change of keeper into a permanent history that is
      // supposed to be evidence, and an invented one is worse than a missing
      // one. So an open ownership is adopted where the workshop recorded one,
      // and a new one is opened only where none exists.
      const open = await tx.vehicleOwnership.findFirst({
        where: { vehicleId: claim.vehicleId, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { id: true, ownerUserId: true },
      });

      if (!open) {
        await tx.vehicleOwnership.create({
          data: {
            vehicleId: claim.vehicleId,
            ownerUserId: claim.userId,
            ownerName: claim.user.name,
            startedAt: new Date(),
            source: 'workshop-approved claim',
          },
        });
      } else if (!open.ownerUserId) {
        await tx.vehicleOwnership.update({
          where: { id: open.id },
          data: { ownerUserId: claim.userId },
        });
      }
      // An ownership already pointing at somebody else is left alone. The
      // workshop approving a claim is vouching for a customer record, not
      // overruling a recorded keeper, and quietly reassigning one here would
      // be the single most damaging thing this function could do.
    }

    // Conditional on the row still being pending, so two people answering the
    // same request at the same moment cannot both succeed.
    const answered = await tx.vehicleClaim.updateMany({
      where: { id: claim.id, status: 'PENDING' },
      data: {
        status: decision.status,
        reason: input.reason?.trim() || null,
        decidedAt: new Date(),
        decidedByUserId: input.userId,
      },
    });

    if (answered.count === 0) {
      throw new ClaimError(
        'NOT_PENDING',
        'Somebody else answered that request a moment ago. Reload to see what they said.',
      );
    }

    const queued = await tx.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: claim.user.email,
        subject: input.approve ? 'Your vehicle is on your account' : 'About your vehicle request',
        body: input.approve
          ? `Hello ${claim.user.name}.\n\nThe workshop has confirmed that vehicle is yours. Its full history is on your account now, and it stays with the car if you ever sell it.`
          : `Hello ${claim.user.name}.\n\nThe workshop did not confirm that vehicle. ${input.reason ?? ''}\n\nIf you think that is wrong, ring them: they are the people who can put it right.`,
        status: 'QUEUED',
        relatedType: 'VehicleClaim',
        relatedId: claim.id,
      },
      select: { id: true },
    });

    return queued.id;
  });

  // Outside the transaction. A message handed to a provider inside one could
  // not be taken back if the transaction then rolled away underneath it.
  await pushNow(messageId);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.approve ? 'vehicle.claim.approved' : 'vehicle.claim.refused',
    entityType: 'VehicleClaim',
    entityId: claim.id,
    after: { approved: input.approve, reason: input.reason ?? null },
  });
}

/** A customer changing their mind. */
export async function withdrawClaim(userId: string, claimId: string) {
  await prisma.vehicleClaim.updateMany({
    where: { id: claimId, userId, status: 'PENDING' },
    data: { status: 'WITHDRAWN', decidedAt: new Date() },
  });
}
