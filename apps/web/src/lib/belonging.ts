import { type Belonging, mayEnter, NOT_YOURS, type Role } from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Working at more than one workshop. Phase 63. FR-108.
 *
 * The rules are in `@carnet/core` (`access/belonging.ts`); this is the part
 * that touches the database: which workshops somebody is on the team of, and
 * moving a session from one to another.
 *
 * Both existed before this phase, in `demonstration.ts`, because the
 * demonstration workshop is a second organisation and moving into it is the
 * same movement. They were correct as far as they went and went no further:
 * no audit record, no refusal a person could read, and reachable only from the
 * one page that builds a demonstration. Moving between two tenants is not a
 * detail of a demonstration feature. It is the boundary the whole product is
 * built around, so it lives here now and says so in the log.
 */

export class NotYoursError extends Error {
  constructor() {
    super(NOT_YOURS);
    this.name = 'NotYoursError';
  }
}

export interface Workshop extends Belonging {
  slug: string;
  isDemonstration: boolean;
}

/**
 * The workshops this person is on the team of, oldest first.
 *
 * Ordered, deliberately. The list is read in two places that must agree — the
 * chooser and the nav — and an unordered query means the second workshop moves
 * about between page loads. The old query in `auth.ts` had no ordering at all,
 * which is how "whichever one Postgres returned" became a product behaviour.
 */
export async function workshopsFor(userId: string): Promise<Workshop[]> {
  // bounded: memberships of one person. Somebody on forty workshops' teams is
  // a bookkeeping firm, and forty rows is still one small query.
  const memberships = await prisma.membership.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      org: { select: { id: true, name: true, slug: true, isDemonstration: true } },
    },
  });

  return memberships.map((membership) => ({
    orgId: membership.org.id,
    orgName: membership.org.name,
    role: membership.role as Role,
    isActive: true,
    slug: membership.org.slug,
    isDemonstration: membership.org.isDemonstration,
  }));
}

/**
 * Moves this session into one of them.
 *
 * Three things matter here and each is a way this could go wrong:
 *
 * The organisation is verified against the person's own memberships, not
 * against the request. Nothing the browser sends decides which tenant anybody
 * is in; the session row does, and it is written only here.
 *
 * The refusal is the same sentence whether the organisation is somebody
 * else's, has been left, or does not exist. A refusal that distinguishes them
 * confirms an organisation exists to somebody with no business knowing, which
 * is the leak the security model insists on a 404 for everywhere else.
 *
 * And it is written down. Entering a workshop is crossing a tenant boundary,
 * which is the one movement in this product that most deserves a line in the
 * log — read `audit_logs` for an organisation and you can see who came in and
 * when, not merely what they did once inside.
 */
export async function enterWorkshop(input: {
  userId: string;
  sessionId: string;
  orgId: string;
}): Promise<void> {
  const theirs = await workshopsFor(input.userId);

  if (!mayEnter(theirs, input.orgId)) throw new NotYoursError();

  await prisma.session.update({
    where: { id: input.sessionId },
    data: { orgId: input.orgId },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'session.entered',
    entityType: 'Organization',
    entityId: input.orgId,
    // No before: where they came from is the other workshop's business, and
    // writing it here would put one tenant's name in another tenant's log.
    after: { role: theirs.find((one) => one.orgId === input.orgId)!.role },
  });
}

/** Whether this person has to be asked which workshop they are in. */
export async function mustChooseWorkshop(userId: string): Promise<boolean> {
  return (await prisma.membership.count({ where: { userId, isActive: true } })) > 1;
}
