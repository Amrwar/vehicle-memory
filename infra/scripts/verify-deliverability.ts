/**
 * Bounces, complaints and addresses nothing may be sent to.
 *
 *   npx tsx infra/scripts/verify-deliverability.ts
 *
 * The dashboard promises a workshop we will tell them when a customer cannot
 * be reached. The way that promise breaks is quiet: a webhook retried and the
 * address suppressed twice, a soft bounce treated as permanent and a real
 * customer silently cut off, or a suppression that nothing consults at the
 * moment of sending.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  deliverability,
  lift,
  recordDeliveryEvent,
  sendableTo,
  suppressions,
} from '../../apps/web/src/lib/deliverability';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const PROBE = 'Verify deliverability probe';
const HARD = 'vfy-hard-bounce@example.test';
const SOFT = 'vfy-soft-bounce@example.test';
const SPAM = 'vfy-complaint@example.test';

async function queued(orgId: string, to: string, ref: string) {
  return prisma.messageLog.create({
    data: {
      orgId,
      channel: 'EMAIL',
      toAddress: to,
      subject: PROBE,
      body: PROBE,
      status: 'SENT',
      sentAt: new Date(),
      provider: 'smtp',
      providerRef: ref,
      relatedType: 'Probe',
      relatedId: 'deliverability',
    },
    select: { id: true },
  });
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  await prisma.deliveryEvent.deleteMany({ where: { detail: { contains: PROBE } } });
  await prisma.messageLog.deleteMany({ where: { relatedType: 'Probe' } });
  await prisma.suppressedAddress.deleteMany({ where: { address: { startsWith: 'vfy-' } } });

  const stamp = Date.now();

  console.info('\nA message that arrived');

  const delivered = await queued(org.id, 'vfy-delivered@example.test', `ref-ok-${stamp}`);

  await recordDeliveryEvent({
    orgId: org.id,
    type: 'email.delivered',
    providerRef: `evt-ok-${stamp}`,
    messageRef: `ref-ok-${stamp}`,
    toAddress: 'vfy-delivered@example.test',
  });

  const arrived = await prisma.messageLog.findUniqueOrThrow({
    where: { id: delivered.id },
    select: { status: true },
  });

  // SENT only ever meant a provider took it at the door. This is the first
  // time the product can say a message actually reached somebody.
  check('it is recorded as delivered, not merely sent', arrived.status, 'DELIVERED');

  console.info('\nA mailbox that does not exist');

  const hard = await queued(org.id, HARD, `ref-hard-${stamp}`);

  await recordDeliveryEvent({
    orgId: org.id,
    type: 'email.bounced',
    providerRef: `evt-hard-${stamp}`,
    messageRef: `ref-hard-${stamp}`,
    toAddress: HARD,
    detail: `${PROBE}: 550 5.1.1 user unknown`,
    bounceKind: 'Permanent',
  });

  const bounced = await prisma.messageLog.findUniqueOrThrow({
    where: { id: hard.id },
    select: { status: true, error: true },
  });

  check('the message failed', bounced.status, 'FAILED');
  check('and says nothing more will be sent', bounced.error?.includes('Nothing further'), true);

  const blockedNow = await sendableTo(org.id, HARD);
  check('the address is refused at the moment of sending', blockedNow.allowed, false);

  console.info('\nThe same webhook delivered twice');

  // Every provider retries. A duplicate bounce would suppress twice and read
  // as two customers failing rather than one.
  const again = await recordDeliveryEvent({
    orgId: org.id,
    type: 'email.bounced',
    providerRef: `evt-hard-${stamp}`,
    messageRef: `ref-hard-${stamp}`,
    toAddress: HARD,
    detail: `${PROBE}: 550 5.1.1 user unknown`,
    bounceKind: 'Permanent',
  });

  check('the retry is recognised', again.applied, false);

  const rows = await prisma.suppressedAddress.count({
    where: { orgId: org.id, address: HARD, liftedAt: null },
  });
  check('and the address is suppressed exactly once', rows, 1);

  console.info('\nA mailbox that is merely full');

  const soft = await queued(org.id, SOFT, `ref-soft-${stamp}`);

  await recordDeliveryEvent({
    orgId: org.id,
    type: 'email.bounced',
    providerRef: `evt-soft-${stamp}`,
    messageRef: `ref-soft-${stamp}`,
    toAddress: SOFT,
    detail: `${PROBE}: mailbox full, try again later`,
  });

  const softRow = await prisma.messageLog.findUniqueOrThrow({
    where: { id: soft.id },
    select: { status: true, error: true },
  });

  check('the message failed', softRow.status, 'FAILED');

  // Suppressing here would lose a real customer over a fault that cures
  // itself by teatime.
  const softBlocked = await prisma.suppressedAddress.count({
    where: { orgId: org.id, address: SOFT, liftedAt: null },
  });
  check('but the address is not suppressed', softBlocked, 0);
  check('and it says the reason looks temporary', softRow.error?.includes('temporary'), true);

  console.info('\nSomebody pressing the spam button');

  // Found or created, never deleted and recreated. Withdrawing consent writes
  // a consent record, and consent history is immutable by design: it is the
  // evidence a workshop would produce if somebody ever disputed being
  // contacted. So the probe reuses one customer and resets what it may.
  const existing = await prisma.customer.findFirst({
    where: { orgId: org.id, email: SPAM },
    select: { id: true },
  });

  const customer =
    existing ??
    (await prisma.customer.create({
      data: {
        orgId: org.id,
        kind: 'INDIVIDUAL',
        displayName: PROBE,
        email: SPAM,
        isActive: false,
      },
      select: { id: true },
    }));

  await prisma.customer.update({
    where: { id: customer.id },
    data: { marketingEmailConsent: true, marketingSmsConsent: true },
  });

  await queued(org.id, SPAM, `ref-spam-${stamp}`);

  await recordDeliveryEvent({
    orgId: org.id,
    type: 'email.complained',
    providerRef: `evt-spam-${stamp}`,
    messageRef: `ref-spam-${stamp}`,
    toAddress: SPAM,
    detail: PROBE,
  });

  const after = await prisma.customer.findUniqueOrThrow({
    where: { id: customer.id },
    select: { marketingEmailConsent: true, marketingSmsConsent: true },
  });

  // Suppressing the address without withdrawing consent would keep asking the
  // question they have just answered in the only way the interface allows.
  check('marketing consent was withdrawn', after.marketingEmailConsent, false);
  check('on both channels', after.marketingSmsConsent, false);

  const spamBlocked = await prisma.suppressedAddress.count({
    where: { orgId: org.id, address: SPAM, liftedAt: null },
  });
  check('and the address is suppressed', spamBlocked, 1);

  console.info('\nWhat the send path does with a suppressed address');

  await prisma.messageLog.create({
    data: {
      orgId: org.id,
      channel: 'EMAIL',
      toAddress: HARD,
      subject: PROBE,
      body: PROBE,
      status: 'QUEUED',
      relatedType: 'Probe',
      relatedId: 'deliverability',
    },
  });

  const { sendQueuedMessages } = await import('@carnet/jobs');
  await sendQueuedMessages();

  const held = await prisma.messageLog.findFirstOrThrow({
    where: { orgId: org.id, toAddress: HARD, relatedType: 'Probe', subject: PROBE },
    orderBy: { createdAt: 'desc' },
    select: { status: true, error: true },
  });

  check('a queued message to it is never sent', held.status, 'SUPPRESSED');
  check('and says why', held.error?.includes('suppressed'), true);

  console.info('\nLetting an address be used again');

  const blocked = await suppressions(org.id);
  const entry = blocked.find((row) => row.address === HARD)!;

  let blankRefused = 'accepted';
  try {
    await lift({ orgId: org.id, userId: user.id, suppressionId: entry.id, note: '   ' });
  } catch {
    blankRefused = 'refused';
  }
  check('lifting with nothing written is refused', blankRefused, 'refused');

  await lift({
    orgId: org.id,
    userId: user.id,
    suppressionId: entry.id,
    note: `${PROBE}: corrected the address with them`,
  });

  const sendable = await sendableTo(org.id, HARD);
  check('afterwards it can be sent to again', sendable.allowed, true);

  console.info('\nThe picture a workshop is shown');

  const health = await deliverability(org.id);
  check('it counts what bounced', health.bounced >= 2, true);
  check('and what was complained about', health.complained >= 1, true);
  check('and says something', health.summary.length > 20, true);

  console.info('\nThe database, underneath it');

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "suppressed_addresses" ("id","orgId","address","reason","liftedAt")
       VALUES ('vfy-supp-raw','${org.id}','${SOFT}','MANUAL',NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a lift with nothing written was accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'a lift with no reason and nobody behind it',
      message.includes('suppressed_addresses_lift_is_explained'),
      true,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "suppressed_addresses" ("id","orgId","address","reason")
     VALUES ('vfy-supp-one','${org.id}','vfy-twice@example.test','HARD_BOUNCE')`,
  );

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "suppressed_addresses" ("id","orgId","address","reason")
       VALUES ('vfy-supp-two','${org.id}','  VFY-Twice@Example.test ','HARD_BOUNCE')`,
    );
    failures += 1;
    console.error('  FAIL   the same address was suppressed twice');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'the same address suppressed twice, whatever the capitals',
      message.includes('suppressed_addresses_one_live_each'),
      true,
    );
  }

  console.info('\nWhat cannot be tidied away');

  // Not a cleanup failure. Withdrawing consent left a record, and that record
  // is the evidence: a workshop accused of contacting somebody who had opted
  // out produces it, and a trail anybody can delete a row from is one nobody
  // should have trusted.
  let deleted = 'accepted';
  try {
    await prisma.customer.delete({ where: { id: customer.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deleted = message.includes('Consent history') ? 'refused' : 'refused for another reason';
  }
  check('a customer with a consent trail cannot be deleted', deleted, 'refused');

  await prisma.deliveryEvent.deleteMany({ where: { orgId: org.id, detail: { contains: PROBE } } });
  await prisma.messageLog.deleteMany({ where: { relatedType: 'Probe' } });
  await prisma.suppressedAddress.deleteMany({ where: { address: { startsWith: 'vfy-' } } });
  await prisma.customer.update({ where: { id: customer.id }, data: { isActive: false } });

  const left = await prisma.suppressedAddress.count({ where: { address: { startsWith: 'vfy-' } } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0 ? '\nDeliverability behaved correctly.' : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
