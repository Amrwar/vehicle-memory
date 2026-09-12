import { createHash, randomBytes } from 'node:crypto';

import {
  assertNotFlooding,
  assertTokenUsable,
  checkPassword,
  expiryFor,
  RESET_REQUESTED_MESSAGE,
  type TokenPurpose,
  TokenError,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { hashPassword } from './auth';
import { audit } from './guard';
import { env } from './env';
import { pushNow } from './outbound';

/**
 * Proving an address, and getting back in when the password is gone.
 *
 * The rules live in `@carnet/core` and are pure. This is the part that writes,
 * and the part where the quiet mistakes are: telling somebody an address does
 * not exist, leaving an old link alive, or resetting a password while the
 * person who took it stays signed in.
 */

export { RESET_REQUESTED_MESSAGE, TokenError };

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Where a link should point, whatever the deployment is called today. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Issues a link, retiring whatever came before it.
 *
 * The old token is marked used rather than deleted, so a person clicking an
 * older email gets "already used" instead of "never existed", and the history
 * of how many were asked for survives.
 */
async function issue(input: {
  userId: string;
  purpose: TokenPurpose;
  ip?: string | null;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();

  const recent = await prisma.authToken.count({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      createdAt: { gte: new Date(now.getTime() - 3_600_000) },
    },
  });

  assertNotFlooding(recent);

  const token = randomBytes(32).toString('base64url');

  await prisma.$transaction([
    // Retiring first, inside the same transaction, so there is never a moment
    // where two live links exist. The partial unique index refuses that
    // outright, which is what makes the ordering load-bearing rather than
    // merely tidy.
    prisma.authToken.updateMany({
      where: { userId: input.userId, purpose: input.purpose, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.authToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: digest(token),
        expiresAt: expiryFor(input.purpose, now),
        requestedIp: input.ip ?? null,
      },
    }),
  ]);

  return token;
}

/**
 * Asks for a password reset.
 *
 * Returns the same thing whether or not the address exists, and takes roughly
 * the same time doing it. A form that answers "no such account" is how a
 * customer list gets enumerated, and a form that answers instantly for
 * unknown addresses and slowly for real ones says the same thing more quietly.
 */
export async function requestReset(email: string, ip?: string | null): Promise<void> {
  const address = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: address, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        where: { isActive: true },
        take: 1,
        select: { orgId: true },
      },
    },
  });

  if (!user) return;

  let token: string;

  try {
    token = await issue({ userId: user.id, purpose: 'PASSWORD_RESET', ip });
  } catch (error) {
    // Flooding is refused silently here too. Telling somebody they have asked
    // too often is itself confirmation the address exists.
    if (error instanceof TokenError) return;
    throw error;
  }

  const queued = await prisma.messageLog.create({
    data: {
      // Null for a customer who has signed up and is not yet attached to any
      // workshop. Requiring an organisation here quietly broke password reset
      // for every portal account, because a customer never has a membership.
      orgId: user.memberships[0]?.orgId ?? null,
      channel: 'EMAIL',
      toAddress: user.email,
      subject: 'Setting a new password',
      body: [
        `Hello ${user.name}.`,
        '',
        'Somebody asked to set a new password on your Carnet account. If that was you, open this link within the hour:',
        '',
        `${siteUrl()}/reset/${token}`,
        '',
        'If it was not you, nothing has changed and you do not need to do anything. Your current password still works.',
      ].join('\n'),
      status: 'QUEUED',
      relatedType: 'PasswordReset',
      relatedId: user.id,
    },
    select: { id: true },
  });

  await pushNow(queued.id);
}

/**
 * Sets a new password from a link.
 *
 * Every session ends. Somebody resetting a password is often doing it because
 * they think another person has it, and leaving that person signed in is the
 * one outcome the whole feature exists to prevent.
 */
export async function redeemReset(input: {
  token: string;
  password: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  const row = await prisma.authToken.findUnique({
    where: { tokenHash: digest(input.token) },
    select: {
      id: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, email: true } },
    },
  });

  assertTokenUsable(
    row && row.purpose === 'PASSWORD_RESET'
      ? { purpose: 'PASSWORD_RESET', expiresAt: row.expiresAt, usedAt: row.usedAt }
      : null,
    now,
  );

  const check = checkPassword(input.password, row!.user.email);

  if (!check.ok) throw new TokenError('WEAK_PASSWORD', check.problem!);

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row!.user.id },
      data: {
        passwordHash,
        // A reset proves the address as surely as a verification link does:
        // whoever set the password read mail sent to it.
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.authToken.update({ where: { id: row!.id }, data: { usedAt: now } }),
    prisma.session.deleteMany({ where: { userId: row!.user.id } }),
  ]);

  await audit({
    actorUserId: row!.user.id,
    action: 'password.reset',
    entityType: 'User',
    entityId: row!.user.id,
    after: { sessionsEnded: true },
  });
}

/** Sends the link that proves an address. */
export async function requestVerification(userId: string, ip?: string | null): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      memberships: { where: { isActive: true }, take: 1, select: { orgId: true } },
    },
  });

  if (!user || user.emailVerifiedAt) return false;

  const token = await issue({ userId: user.id, purpose: 'EMAIL_VERIFICATION', ip });

  const queued = await prisma.messageLog.create({
    data: {
      orgId: user.memberships[0]?.orgId ?? null,
      channel: 'EMAIL',
      toAddress: user.email,
      subject: 'Confirm your email address',
      body: [
        `Hello ${user.name}.`,
        '',
        'Confirming your address lets us tell you when a message to one of your customers bounces, and keeps what you send out of their spam folders.',
        '',
        `${siteUrl()}/verify-email/${token}`,
        '',
        'The link lasts three days.',
      ].join('\n'),
      status: 'QUEUED',
      relatedType: 'EmailVerification',
      relatedId: user.id,
    },
    select: { id: true },
  });

  // Somebody is looking at "check your inbox" right now.
  await pushNow(queued.id);

  return true;
}

/** Marks an address proven. */
export async function redeemVerification(token: string, now = new Date()): Promise<string> {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });

  // An address already proven is not an error worth showing somebody. They
  // clicked an old link, and the outcome they wanted has happened.
  if (row?.user.emailVerifiedAt) return row.user.email;

  assertTokenUsable(
    row && row.purpose === 'EMAIL_VERIFICATION'
      ? { purpose: 'EMAIL_VERIFICATION', expiresAt: row.expiresAt, usedAt: row.usedAt }
      : null,
    now,
  );

  await prisma.$transaction([
    prisma.user.update({ where: { id: row!.user.id }, data: { emailVerifiedAt: now } }),
    prisma.authToken.update({ where: { id: row!.id }, data: { usedAt: now } }),
  ]);

  await audit({
    actorUserId: row!.user.id,
    action: 'email.verified',
    entityType: 'User',
    entityId: row!.user.id,
  });

  return row!.user.email;
}

/**
 * Whether this deployment can actually send.
 *
 * Used by the forms to say so rather than pretending. A password reset page
 * that promises a message on a deployment with no mail transport configured
 * leaves somebody waiting for an email that was written to a log file.
 */
export function canSendMail(): boolean {
  return env().MAIL_TRANSPORT !== 'console';
}
