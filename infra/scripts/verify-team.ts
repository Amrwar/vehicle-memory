/**
 * Proves that a workshop can add its second person.
 *
 *   npx tsx infra/scripts/verify-team.ts
 *
 * Until Phase 4.6 this took a database write, which in practice meant most
 * workshops could not do it at all. The checks below cover the invitation
 * lifecycle and the two privilege rules that matter: nobody hands out a role
 * above their own, and a workshop always keeps an owner.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  acceptInvitation,
  changeRole,
  deactivateMember,
  invitationByToken,
  inviteColleague,
  revokeInvitation,
} from '../../apps/web/src/lib/team';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

const stamp = Date.now().toString(36);
const NEW_EMAIL = `probe-tech-${stamp}@probeworkshop.test`;

async function main() {
  console.info('\n  Adding somebody to a workshop\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER', isActive: true },
    include: { user: true },
  });

  const advisor = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'SERVICE_ADVISOR', isActive: true },
    include: { user: true },
  });

  /* --- who may invite ---------------------------------------------------- */

  const byAdvisor = await inviteColleague({
    orgId: org.id,
    actorUserId: advisor.userId,
    actorRole: 'SERVICE_ADVISOR',
    email: NEW_EMAIL,
    role: 'TECHNICIAN',
  });

  check('a service advisor cannot invite', !byAdvisor.ok, byAdvisor.error);

  const managerMakingOwner = await inviteColleague({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'MANAGER',
    email: NEW_EMAIL,
    role: 'OWNER',
  });

  check('a manager cannot invite an owner', !managerMakingOwner.ok, managerMakingOwner.error);

  const existingMember = await inviteColleague({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    email: advisor.user.email,
    role: 'TECHNICIAN',
  });

  check('somebody already here is not invited again', !existingMember.ok, existingMember.error);

  /* --- the real invitation ------------------------------------------------ */

  const invite = await inviteColleague({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    email: NEW_EMAIL,
    role: 'TECHNICIAN',
    message: 'Welcome aboard.',
  });

  check('an owner can invite a technician', invite.ok, invite.error);
  check('a token is returned once', Boolean(invite.token));

  const stored = await prisma.invitation.findFirstOrThrow({
    where: { orgId: org.id, email: NEW_EMAIL },
  });

  check(
    'only the fingerprint is stored, never the token',
    stored.tokenHash !== invite.token && stored.tokenHash.length === 64,
  );

  // The invitation was created and shown on screen, and for a long time that
  // was all that happened: the page said an email was on its way and nothing
  // had been queued. Anybody invited who was not standing at the counter never
  // heard.
  const invitationEmail = await prisma.messageLog.findFirst({
    where: { orgId: org.id, toAddress: NEW_EMAIL, relatedType: 'Invitation' },
    orderBy: { createdAt: 'desc' },
    select: { body: true, subject: true, status: true },
  });

  check('an email was queued to the person invited', Boolean(invitationEmail));
  check('it carries the link they need', invitationEmail?.body.includes(invite.token!) ?? false);
  check('and it names the workshop', invitationEmail?.subject.includes(org.name) ?? false);

  const duplicate = await inviteColleague({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    email: NEW_EMAIL,
    role: 'BOOKKEEPER',
  });

  // Two live invitations each carry their own role, so accepting the older one
  // gives access nobody intended.
  check('a second open invitation is refused', !duplicate.ok, duplicate.error);

  check('the token resolves to the invitation', Boolean(await invitationByToken(invite.token!)));

  /* --- accepting ---------------------------------------------------------- */

  const accepted = await acceptInvitation({
    token: invite.token!,
    name: 'Probe Technician',
    password: 'a-sufficiently-long-one',
  });

  check('the invitation can be accepted', accepted.ok, accepted.error);

  const membership = await prisma.membership.findFirst({
    where: { orgId: org.id, userId: accepted.userId },
  });

  check('they are now a member', Boolean(membership), membership?.role);
  check('in the role they were invited as', membership?.role === 'TECHNICIAN');

  const employee = await prisma.employee.findFirst({
    where: { orgId: org.id, userId: accepted.userId },
  });

  check('with an employee record, so their time costs something', Boolean(employee));

  const reused = await acceptInvitation({
    token: invite.token!,
    name: 'Somebody Else',
    password: 'a-sufficiently-long-one',
  });

  check('the same link cannot be used twice', !reused.ok, reused.error);

  /* --- changing a role ---------------------------------------------------- */

  const selfPromotion = await changeRole({
    orgId: org.id,
    actorUserId: accepted.userId!,
    actorRole: 'TECHNICIAN',
    targetUserId: accepted.userId!,
    role: 'OWNER',
  });

  check('nobody can promote themselves', !selfPromotion.ok, selfPromotion.error);

  const promoted = await changeRole({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    targetUserId: accepted.userId!,
    role: 'SERVICE_ADVISOR',
  });

  check('an owner can change somebody else', promoted.ok, promoted.error);

  const lastOwner = await changeRole({
    orgId: org.id,
    actorUserId: accepted.userId!,
    actorRole: 'OWNER',
    targetUserId: owner.userId,
    role: 'MANAGER',
  });

  check('the only owner cannot be demoted', !lastOwner.ok, lastOwner.error);

  /* --- removing ----------------------------------------------------------- */

  const removed = await deactivateMember({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    targetUserId: accepted.userId!,
  });

  check('somebody can be removed', removed.ok, removed.error);

  const after = await prisma.membership.findFirst({
    where: { orgId: org.id, userId: accepted.userId },
  });

  check('deactivated, not deleted', after !== null && after.isActive === false);

  const sessions = await prisma.session.count({
    where: { userId: accepted.userId!, revokedAt: null },
  });

  check('their sessions end immediately', sessions === 0);

  const removingSelf = await deactivateMember({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    targetUserId: owner.userId,
  });

  check('nobody can remove their own access', !removingSelf.ok, removingSelf.error);

  /* --- withdrawing --------------------------------------------------------- */

  const second = await inviteColleague({
    orgId: org.id,
    actorUserId: owner.userId,
    actorRole: 'OWNER',
    email: `probe-two-${stamp}@probeworkshop.test`,
    role: 'TECHNICIAN',
  });

  await revokeInvitation({
    orgId: org.id,
    actorUserId: owner.userId,
    invitationId: (
      await prisma.invitation.findFirstOrThrow({
        where: { orgId: org.id, email: `probe-two-${stamp}@probeworkshop.test` },
      })
    ).id,
  });

  const withdrawn = await acceptInvitation({
    token: second.token!,
    name: 'Nobody',
    password: 'a-sufficiently-long-one',
  });

  check('a withdrawn invitation cannot be accepted', !withdrawn.ok, withdrawn.error);

  /* --- clean up ------------------------------------------------------------ */

  await prisma.messageLog.deleteMany({
    where: { orgId: org.id, toAddress: { contains: `-${stamp}@probeworkshop.test` } },
  });
  await prisma.invitation.deleteMany({
    where: { orgId: org.id, email: { contains: `-${stamp}@probeworkshop.test` } },
  });
  await prisma.employee.deleteMany({ where: { userId: accepted.userId! } });
  await prisma.membership.deleteMany({ where: { userId: accepted.userId! } });
  await prisma.user.deleteMany({ where: { id: accepted.userId! } });

  check(
    'the probe cleaned up after itself',
    (await prisma.user.count({ where: { email: NEW_EMAIL } })) === 0,
  );

  console.info(
    `\n  ${failures === 0 ? 'A workshop can add, change and remove people.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
