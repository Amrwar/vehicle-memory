import { looksLikeCode, LoyaltyError, REFERRAL_MINIMUM_MINOR } from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { creditReferral, REFERRAL_POINTS, referralFor, useReferral } from './retention';

export { LoyaltyError, REFERRAL_MINIMUM_MINOR, REFERRAL_POINTS };

/**
 * Referrals, in the product. Phase 25.
 *
 * The rules have existed since Phase 5: a code somebody can say over a
 * counter, both sides paid once, and only after the person brought in has
 * actually had work done. No page showed a code, nothing took one, and the
 * credit was a function nobody called. This puts the code on the customer's
 * page and in the portal, takes it at the counter and on a new customer, and
 * pays both sides at the moment a bill crosses the line, without anybody
 * remembering to.
 */

function cleaned(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * What a customer's page shows: their live code, whom they brought in and
 * whether each has been paid, and who brought them in.
 */
export async function referralCardFor(orgId: string, customerId: string, userId: string) {
  const own = await referralFor(orgId, customerId, userId);

  const made = await prisma.referral.findMany({
    where: { orgId, referrerCustomerId: customerId, referredCustomerId: { not: null } },
    orderBy: { usedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      usedAt: true,
      creditedAt: true,
      points: true,
      referred: { select: { id: true, displayName: true } },
    },
  });

  const introducedBy = await prisma.referral.findFirst({
    where: { orgId, referredCustomerId: customerId },
    select: {
      id: true,
      usedAt: true,
      creditedAt: true,
      referrer: { select: { id: true, displayName: true } },
    },
  });

  return {
    code: own.code,
    made,
    introducedBy,
    pointsEachSide: REFERRAL_POINTS,
    minimumMinor: REFERRAL_MINIMUM_MINOR,
  };
}

/**
 * Whether a code could be used, before anything is created on the strength
 * of it. A new customer typed in with a bad code should not exist yet when
 * the code is refused.
 */
export async function checkCode(orgId: string, code: string): Promise<void> {
  if (!looksLikeCode(code)) {
    throw new LoyaltyError('NOT_SPENT', 'That is not one of our codes.');
  }

  const referral = await prisma.referral.findFirst({
    where: { orgId, code: cleaned(code) },
    select: { referredCustomerId: true },
  });

  if (!referral) throw new LoyaltyError('NOT_SPENT', 'Nobody has that code.');
  if (referral.referredCustomerId) {
    throw new LoyaltyError('ALREADY_CREDITED', 'That code has already been used.');
  }
}

/**
 * Somebody arrived with a code. Recorded against them, and paid at once if
 * they have already had enough work done here, which happens when a code is
 * remembered on the second visit rather than the first.
 */
export async function redeemCode(input: {
  orgId: string;
  userId: string;
  customerId: string;
  code: string;
  jobId?: string | null;
}): Promise<{ referralId: string; credited: boolean }> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true },
  });
  if (!customer) {
    throw new LoyaltyError('NOTHING_TO_AWARD', 'That customer is not in this workshop.');
  }

  const already = await prisma.referral.findFirst({
    where: { orgId: input.orgId, referredCustomerId: customer.id },
    select: { id: true },
  });
  if (already) {
    throw new LoyaltyError(
      'ALREADY_CREDITED',
      'Somebody already introduced this customer. A person is brought in once.',
    );
  }

  const referralId = await useReferral({
    orgId: input.orgId,
    userId: input.userId,
    code: input.code,
    customerId: customer.id,
    jobId: input.jobId ?? null,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'referral.used',
    entityType: 'Customer',
    entityId: customer.id,
    after: { code: cleaned(input.code), referralId },
  });

  const credited = await settleReferral(input.orgId, input.userId, referralId);

  return { referralId, credited };
}

/**
 * Pays a referral if it can be paid. Not yet spent enough, or already paid,
 * are the ordinary states of a referral rather than faults, so they come back
 * as false rather than as an error.
 */
export async function settleReferral(
  orgId: string,
  userId: string,
  referralId: string,
): Promise<boolean> {
  try {
    await creditReferral({ orgId, userId, referralId });
    return true;
  } catch (error) {
    if (
      error instanceof LoyaltyError &&
      (error.code === 'NOT_SPENT' || error.code === 'ALREADY_CREDITED')
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * After a bill is paid: any referral that brought this customer in and has
 * not been paid is tried. The bill that crosses the line pays both sides,
 * and nobody had to remember there was a referral.
 */
export async function settleReferralsFor(input: {
  orgId: string;
  userId: string;
  customerId: string;
}): Promise<number> {
  const waiting = await prisma.referral.findMany({
    where: { orgId: input.orgId, referredCustomerId: input.customerId, creditedAt: null },
    select: { id: true },
  });

  let paid = 0;
  for (const referral of waiting) {
    if (await settleReferral(input.orgId, input.userId, referral.id)) paid += 1;
  }
  return paid;
}

/** The code the person signed into the portal can hand out, at each workshop. */
export async function referralsForPortalUser(userId: string) {
  const customers = await prisma.customer.findMany({
    where: { portalUserId: userId },
    select: { id: true, orgId: true, org: { select: { name: true } } },
  });

  return Promise.all(
    customers.map(async (customer) => {
      const own = await referralFor(customer.orgId, customer.id, userId);
      return {
        customerId: customer.id,
        workshop: customer.org.name,
        code: own.code,
        pointsEachSide: REFERRAL_POINTS,
        minimumMinor: REFERRAL_MINIMUM_MINOR,
      };
    }),
  );
}
