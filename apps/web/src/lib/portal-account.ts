import { MIN_PASSWORD_LENGTH } from '@carnet/core';
import { prisma } from '@carnet/db';

import { hashPassword, verifyPassword } from './auth';
import { audit } from './guard';

/**
 * The customer's own account: who they are, how they sign in, and what
 * each workshop may send them. Phase 32.7.
 *
 * A portal user is one person known to several workshops. Their name and
 * phone are theirs and change everywhere at once; what each workshop may
 * send them is per workshop, because consent was given to a business, not
 * to a network, and the record of every change is kept with the customer
 * the workshop knows.
 */

export class AccountError extends Error {
  readonly code: 'WRONG_PASSWORD' | 'WEAK_PASSWORD' | 'EMPTY_NAME' | 'NOT_YOURS';

  constructor(code: AccountError['code'], message: string) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}

export async function accountOverview(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true,
      createdAt: true,
      customerProfiles: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          marketingEmailConsent: true,
          marketingSmsConsent: true,
          org: { select: { id: true, name: true } },
        },
      },
    },
  });
  return { ...user, customers: user.customerProfiles };
}

export async function updateProfile(input: {
  userId: string;
  name: string;
  phone: string | null;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new AccountError('EMPTY_NAME', 'Your name cannot be empty.');
  const phone = input.phone?.trim() || null;
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { name: true, phone: true },
  });
  await prisma.user.update({ where: { id: input.userId }, data: { name, phone } });
  // The workshops know this person by the same name; keep them in step.
  await prisma.customer.updateMany({
    where: { portalUserId: input.userId, isActive: true },
    data: { displayName: name, mobile: phone },
  });
  await audit({
    actorUserId: input.userId,
    action: 'account.profile',
    entityType: 'User',
    entityId: input.userId,
    before,
    after: { name, phone },
  });
}

export async function changePassword(input: {
  userId: string;
  current: string;
  next: string;
}): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(input.current, user.passwordHash))) {
    throw new AccountError('WRONG_PASSWORD', 'The current password is not right.');
  }
  if (input.next.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError('WEAK_PASSWORD', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: await hashPassword(input.next) },
  });
  await audit({
    actorUserId: input.userId,
    action: 'account.password',
    entityType: 'User',
    entityId: input.userId,
  });
}

/** What one workshop may send this person, recorded as a change with its source. */
export async function setConsent(input: {
  userId: string;
  customerId: string;
  channel: 'EMAIL' | 'SMS';
  granted: boolean;
}): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, portalUserId: input.userId },
    select: { id: true, orgId: true, marketingEmailConsent: true, marketingSmsConsent: true },
  });
  if (!customer) throw new AccountError('NOT_YOURS', 'That is not one of your workshops.');
  const already =
    input.channel === 'EMAIL' ? customer.marketingEmailConsent : customer.marketingSmsConsent;
  if (already === input.granted) return;
  // The database writes the consent record itself when the flag moves, and
  // that record is immutable. The transaction tells it who made this change
  // and how, so the history says "the customer, from their account page"
  // rather than assuming staff.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('carnet.consent_source', 'PORTAL', true)`;
    await tx.$executeRaw`SELECT set_config('carnet.consent_actor', ${input.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('carnet.consent_note', 'Changed by the customer on their account page.', true)`;
    await tx.customer.update({
      where: { id: customer.id },
      data:
        input.channel === 'EMAIL'
          ? { marketingEmailConsent: input.granted }
          : { marketingSmsConsent: input.granted },
    });
  });
  await audit({
    orgId: customer.orgId,
    actorUserId: input.userId,
    action: input.granted ? 'consent.granted' : 'consent.withdrawn',
    entityType: 'Customer',
    entityId: customer.id,
    after: { channel: input.channel, source: 'PORTAL' },
  });
}
