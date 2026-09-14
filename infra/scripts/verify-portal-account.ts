/**
 * The customer's account page, exercised. Phase 32.7.
 *
 *   npx tsx infra/scripts/verify-portal-account.ts
 *
 * A customer changes their name and phone and every workshop that knows
 * them sees it; changes their password only with the current one; turns a
 * workshop's offers off and on, and each change is a consent record with
 * the portal as its source. Everything is put back.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { verifyPassword } from '../../apps/web/src/lib/auth';
import {
  AccountError,
  accountOverview,
  changePassword,
  setConsent,
  updateProfile,
} from '../../apps/web/src/lib/portal-account';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    if (error instanceof AccountError && error.code === code)
      console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

async function main() {
  const maria = await prisma.user.findUniqueOrThrow({
    where: { email: 'maria@example.test' },
    select: { id: true, name: true, phone: true, passwordHash: true },
  });
  const before = await accountOverview(maria.id);
  check('the account lists the workshops that know her', before.customers.length > 0, true);
  const first = before.customers[0]!;
  const originalConsent = { email: first.marketingEmailConsent, sms: first.marketingSmsConsent };

  try {
    console.info('\nDetails');
    await updateProfile({ userId: maria.id, name: 'Maria Okafor-Probe', phone: '07700 900123' });
    const after = await accountOverview(maria.id);
    check(
      'the name and phone changed',
      [after.name, after.phone],
      ['Maria Okafor-Probe', '07700 900123'],
    );
    const known = await prisma.customer.findMany({
      where: { portalUserId: maria.id, isActive: true },
      select: { displayName: true, mobile: true },
    });
    check(
      'and every workshop that knows her sees the new ones',
      known.every((c) => c.displayName === 'Maria Okafor-Probe' && c.mobile === '07700 900123'),
      true,
    );
    await refuses('an empty name is refused', 'EMPTY_NAME', () =>
      updateProfile({ userId: maria.id, name: '   ', phone: null }),
    );

    console.info('\nPassword');
    await refuses('the wrong current password is refused', 'WRONG_PASSWORD', () =>
      changePassword({
        userId: maria.id,
        current: 'not-her-password',
        next: 'a-new-long-password',
      }),
    );
    // The seed's password is not known here, so the hash is swapped for one
    // of a known password and put back afterwards.
    const { hashPassword } = await import('../../apps/web/src/lib/auth');
    await prisma.user.update({
      where: { id: maria.id },
      data: { passwordHash: await hashPassword('probe-current-pass') },
    });
    await refuses('a short new password is refused', 'WEAK_PASSWORD', () =>
      changePassword({ userId: maria.id, current: 'probe-current-pass', next: 'short' }),
    );
    await changePassword({
      userId: maria.id,
      current: 'probe-current-pass',
      next: 'probe-next-password',
    });
    const changed = await prisma.user.findUniqueOrThrow({
      where: { id: maria.id },
      select: { passwordHash: true },
    });
    check(
      'the new password signs in',
      await verifyPassword('probe-next-password', changed.passwordHash),
      true,
    );

    console.info('\nConsent');
    const rowsBefore = await prisma.consentChange.count({ where: { customerId: first.id } });
    await setConsent({
      userId: maria.id,
      customerId: first.id,
      channel: 'EMAIL',
      granted: !originalConsent.email,
    });
    await setConsent({
      userId: maria.id,
      customerId: first.id,
      channel: 'EMAIL',
      granted: !originalConsent.email,
    });
    const flipped = await prisma.customer.findUniqueOrThrow({
      where: { id: first.id },
      select: { marketingEmailConsent: true },
    });
    check('the flag moved', flipped.marketingEmailConsent, !originalConsent.email);
    const rowsAfter = await prisma.consentChange.findMany({
      where: { customerId: first.id },
      orderBy: { changedAt: 'desc' },
      take: 1,
    });
    check(
      'one consent record, from the portal, by her, however many times the same value is saved',
      [
        (await prisma.consentChange.count({ where: { customerId: first.id } })) - rowsBefore,
        rowsAfter[0]?.source,
        rowsAfter[0]?.actorId === maria.id,
      ],
      [1, 'PORTAL', true],
    );
    const other = await prisma.customer.findFirst({
      where: { portalUserId: null, isActive: true },
      select: { id: true },
    });
    if (other) {
      await refuses("somebody else's customer record is not hers to change", 'NOT_YOURS', () =>
        setConsent({ userId: maria.id, customerId: other.id, channel: 'SMS', granted: true }),
      );
    }
  } finally {
    await prisma.user.update({
      where: { id: maria.id },
      data: { name: maria.name, phone: maria.phone, passwordHash: maria.passwordHash },
    });
    await prisma.customer.updateMany({
      where: { portalUserId: maria.id, isActive: true },
      data: { displayName: maria.name, mobile: maria.phone },
    });
    await prisma.customer.update({
      where: { id: first.id },
      data: {
        marketingEmailConsent: originalConsent.email,
        marketingSmsConsent: originalConsent.sms,
      },
    });
    // Consent history is immutable by design: the rows this probe wrote stay,
    // as evidence that a change was made and put back.
  }

  console.info(
    failures === 0
      ? '\nverify-portal-account: every check passed'
      : `\nverify-portal-account: ${failures} failing`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
