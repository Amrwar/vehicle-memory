/**
 * Password reset and email verification, against a real database.
 *
 *   npx tsx infra/scripts/verify-credentials.ts
 *
 * Every mistake this feature can make is a quiet one. A link that still works
 * after it has been used, an old link left alive when a new one is issued, a
 * form that reveals which addresses have accounts, or a reset that leaves the
 * person who stole the password still signed in. None of them produces an
 * error anybody would see.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  redeemReset,
  redeemVerification,
  requestReset,
  requestVerification,
  TokenError,
} from '../../apps/web/src/lib/credentials';

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

async function refuses(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    if (error instanceof TokenError) {
      console.info(`  ok     ${label}: ${error.code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: wrong kind of refusal: ${String(error)}`);
    }
  }
}

const PROBE = 'vfy-credentials@example.test';

/** The link out of the queued message, which is the only place it exists. */
function linkIn(body: string, path: string): string {
  const match = new RegExp(`/${path}/([A-Za-z0-9_-]+)`).exec(body);
  return match?.[1] ?? '';
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  await prisma.user.deleteMany({ where: { email: PROBE } });

  const user = await prisma.user.create({
    data: {
      email: PROBE,
      name: 'Verify Probe',
      // A known-good argon hash from the seed, reused so this script does not
      // need to hash anything to have something to replace.
      passwordHash: (await prisma.user.findFirstOrThrow({ select: { passwordHash: true } }))
        .passwordHash,
      memberships: { create: { orgId: org.id, role: 'OWNER' } },
    },
    select: { id: true, passwordHash: true },
  });

  console.info('\nAsking for a reset');

  await requestReset(PROBE, '203.0.113.5');

  const first = await prisma.messageLog.findFirstOrThrow({
    where: { relatedType: 'PasswordReset', relatedId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { body: true, toAddress: true },
  });

  const firstToken = linkIn(first.body, 'reset');
  check('a link was queued to that address', first.toAddress, PROBE);
  check('and it contains a token', firstToken.length > 20, true);

  console.info('\nAsking again retires the first');

  await requestReset(PROBE, '203.0.113.5');

  const second = await prisma.messageLog.findFirstOrThrow({
    where: { relatedType: 'PasswordReset', relatedId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });

  const secondToken = linkIn(second.body, 'reset');
  check('the second link is different', secondToken !== firstToken, true);

  // Without this, every link ever sent stays live until it expires on its own,
  // and the window is no longer the hour it claims: it is the whole history.
  await refuses('the first link no longer works', () =>
    redeemReset({ token: firstToken, password: 'a long enough phrase here' }),
  );

  const live = await prisma.authToken.count({
    where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
  });
  check('exactly one link is live at a time', live, 1);

  console.info('\nWhat a new password has to be');

  await refuses('something too short', () =>
    redeemReset({ token: secondToken, password: 'short' }),
  );

  await refuses('a word from every attacker list', () =>
    redeemReset({ token: secondToken, password: 'mypassword1234' }),
  );

  console.info('\nSetting it');

  // A session that exists before the reset and must not exist afterwards.
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: `vfy-credentials-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });

  await redeemReset({ token: secondToken, password: 'brake fluid tuesday morning' });

  const after = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, emailVerifiedAt: true },
  });

  check('the password changed', after.passwordHash !== user.passwordHash, true);

  // Whoever set the password read mail sent to that address, which proves it
  // as surely as a verification link would.
  check('and the address counts as proven', after.emailVerifiedAt !== null, true);

  const sessions = await prisma.session.count({ where: { userId: user.id } });
  check('every session ended', sessions, 0);

  await refuses('the link cannot be used twice', () =>
    redeemReset({ token: secondToken, password: 'another long phrase here' }),
  );

  console.info('\nAn address nobody has');

  const before = await prisma.messageLog.count({ where: { relatedType: 'PasswordReset' } });

  // Returns without complaint and sends nothing. A form that answers "no such
  // account" is how somebody enumerates a customer list.
  await requestReset('nobody-at-all@example.test', '203.0.113.5');

  const unchanged = await prisma.messageLog.count({ where: { relatedType: 'PasswordReset' } });
  check('nothing was sent, and nothing was said', unchanged, before);

  console.info('\nToo many requests');

  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });

  let sent = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const wasCount = await prisma.messageLog.count({ where: { relatedId: user.id } });
    await requestReset(PROBE, '203.0.113.5');
    const nowCount = await prisma.messageLog.count({ where: { relatedId: user.id } });
    if (nowCount > wasCount) sent += 1;
  }

  // Five an hour. Beyond that it is somebody using the form to send mail to
  // an address they do not own.
  check('it stops sending after a handful', sent <= 5, true);

  console.info('\nProving the address');

  await prisma.authToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });

  const asked = await requestVerification(user.id, '203.0.113.5');
  check('a verification link was sent', asked, true);

  const verifyMessage = await prisma.messageLog.findFirstOrThrow({
    where: { relatedType: 'EmailVerification', relatedId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });

  const verifyToken = linkIn(verifyMessage.body, 'verify-email');

  const address = await redeemVerification(verifyToken);
  check('the address came back', address, PROBE);

  const proven = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { emailVerifiedAt: true },
  });
  check('and it is recorded as proven', proven.emailVerifiedAt !== null, true);

  // Clicking an old link after the fact is not an error worth showing anybody:
  // the outcome they wanted has already happened.
  const again = await redeemVerification(verifyToken);
  check('opening the link again says the same thing', again, PROBE);

  const alreadyAsked = await requestVerification(user.id, '203.0.113.5');
  check('and no second link is sent for a proven address', alreadyAsked, false);

  console.info('\nWhat the database refuses');

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "auth_tokens" ("id","userId","purpose","tokenHash","expiresAt","createdAt")
       VALUES ('vfy-cred-1','${user.id}','PASSWORD_RESET','vfy-cred-hash-1', NOW() - interval '1 day', NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a link that expired before it was issued was accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'a link expiring before it was issued',
      message.includes('auth_tokens_expire_after_issue'),
      true,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "auth_tokens" ("id","userId","purpose","tokenHash","expiresAt","createdAt")
     VALUES ('vfy-cred-2','${user.id}','PASSWORD_RESET','vfy-cred-hash-2', NOW() + interval '1 hour', NOW())`,
  );

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "auth_tokens" ("id","userId","purpose","tokenHash","expiresAt","createdAt")
       VALUES ('vfy-cred-3','${user.id}','PASSWORD_RESET','vfy-cred-hash-3', NOW() + interval '1 hour', NOW())`,
    );
    failures += 1;
    console.error('  FAIL   two live links for one person were accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'two live links for one person and purpose',
      message.includes('auth_tokens_one_live_per_purpose'),
      true,
    );
  }

  await prisma.messageLog.deleteMany({ where: { relatedId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  const left = await prisma.user.count({ where: { email: PROBE } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0
      ? '\nReset and verification behaved correctly.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
