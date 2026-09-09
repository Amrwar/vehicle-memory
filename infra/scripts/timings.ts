/**
 * Where the time actually goes.
 *
 *   npx tsx infra/scripts/timings.ts [baseUrl]
 *
 * Mints a session, then fetches each workshop route twice: once cold, once
 * warm. Guessing at performance is how you end up optimising the fast half, so
 * this prints the number before anything is changed and again afterwards.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const ROUTES = [
  '/dashboard',
  '/diary',
  '/jobs',
  '/customers',
  '/vehicles',
  '/invoices',
  '/payments',
  '/reports',
  '/parts',
  '/suppliers',
  '/purchasing',
  '/ledger',
  '/financials',
  '/settings',
  '/audit',
];

async function timed(
  url: string,
  cookie: string,
): Promise<{ ms: number; status: number; bytes: number }> {
  const started = performance.now();
  const response = await fetch(url, { headers: { cookie }, redirect: 'manual' });
  const body = await response.text();
  return { ms: performance.now() - started, status: response.status, bytes: body.length };
}

async function main() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    include: { memberships: true },
  });

  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      orgId: user.memberships[0]?.orgId ?? null,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  const cookie = `carnet_session=${token}`;

  console.info(`\n  ${BASE}\n`);
  console.info('  route            cold     warm  status   bytes');
  console.info('  ' + '-'.repeat(52));

  const warm: number[] = [];

  for (const route of ROUTES) {
    const cold = await timed(`${BASE}${route}`, cookie);
    const second = await timed(`${BASE}${route}`, cookie);
    warm.push(second.ms);
    console.info(
      `  ${route.padEnd(14)} ${Math.round(cold.ms).toString().padStart(5)}ms ${Math.round(second.ms).toString().padStart(6)}ms` +
        `  ${String(second.status).padStart(6)} ${String(second.bytes).padStart(7)}`,
    );
  }

  const sorted = [...warm].sort((a, b) => a - b);
  console.info('  ' + '-'.repeat(52));
  console.info(`  median warm    ${Math.round(sorted[Math.floor(sorted.length / 2)]!)}ms`);
  console.info(`  slowest warm   ${Math.round(sorted[sorted.length - 1]!)}ms\n`);

  await prisma.session.deleteMany({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
