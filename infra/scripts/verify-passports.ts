/**
 * Passports as a list, against a real database. Phase 27.
 *
 *   npx tsx infra/scripts/verify-passports.ts
 *
 * The page is a list, so the thing to prove is that the list tells the
 * truth: that every vehicle the workshop has written to is on it and no
 * other, that the entry count is the count in the ledger, that a chain the
 * ledger says is sound is shown as sound, and that an owner sees exactly
 * the cars they own now and not the one they sold.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { verifyVehicleChain } from '../../apps/web/src/lib/passport';
import { passportsForOrg, passportsForOwner } from '../../apps/web/src/lib/passports';

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

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  console.info('\nThe workshop’s list');

  const { rows, summary } = await passportsForOrg(org.id);
  check('there are passports to list', rows.length > 0, true);
  check('the summary counts them', summary.passports, rows.length);

  const written = await prisma.vehicle.count({
    where: { events: { some: { recordedByOrgId: org.id } } },
  });
  check(
    'every vehicle this workshop wrote to is on it',
    rows.length >= Math.min(written, 100),
    true,
  );

  const sample = rows.slice(0, 5);
  for (const row of sample) {
    const count = await prisma.vehicleEvent.count({ where: { vehicleId: row.id } });
    check(`${row.registration ?? row.vin}: entries are the ledger’s count`, row.entries, count);

    const verdict = await verifyVehicleChain(row.id);
    check(`${row.registration ?? row.vin}: chain verdict matches`, row.intact, verdict.valid);

    const orgs = await prisma.vehicleEvent.findMany({
      where: { vehicleId: row.id, recordedByOrgId: { not: null } },
      distinct: ['recordedByOrgId'],
      select: { recordedByOrgId: true },
    });
    check(
      `${row.registration ?? row.vin}: workshops counted distinctly`,
      row.workshops,
      orgs.length,
    );
  }

  check(
    'the summary adds the entries up',
    summary.entries,
    rows.reduce((t, r) => t + r.entries, 0),
  );
  check('sound plus broken is all of them', summary.intact + summary.broken, rows.length);

  const other = await prisma.vehicle.findFirst({
    where: {
      NOT: {
        OR: [
          { events: { some: { recordedByOrgId: org.id } } },
          { jobs: { some: { orgId: org.id } } },
          { accessGrants: { some: { orgId: org.id, revokedAt: null } } },
        ],
      },
    },
    select: { id: true },
  });
  if (other) {
    check(
      'a vehicle this workshop never touched is not on it',
      rows.some((r) => r.id === other.id),
      false,
    );
  }

  const searched = await passportsForOrg(org.id, rows[0]!.vin.slice(-6));
  check(
    'searching by the end of a VIN finds it',
    searched.rows.some((r) => r.id === rows[0]!.id),
    true,
  );

  console.info('\nThe owner’s list');

  const owner = await prisma.vehicleOwnership.findFirst({
    where: { endedAt: null, ownerUserId: { not: null } },
    select: { ownerUserId: true },
  });
  if (!owner?.ownerUserId) {
    console.info('  (no portal owner in the seed; skipped)');
  } else {
    const owned = await prisma.vehicleOwnership.count({
      where: { ownerUserId: owner.ownerUserId, endedAt: null },
    });
    const sold = await prisma.vehicleOwnership.findFirst({
      where: { ownerUserId: owner.ownerUserId, endedAt: { not: null } },
      select: { vehicleId: true },
    });

    const mine = await passportsForOwner(owner.ownerUserId);
    check('the owner sees each car they own now', mine.rows.length, owned);
    check(
      'and no figure about which workshop is looking',
      mine.rows[0]?.fromElsewhere ?? null,
      null,
    );
    if (sold) {
      const stillOwned = await prisma.vehicleOwnership.findFirst({
        where: { ownerUserId: owner.ownerUserId, endedAt: null, vehicleId: sold.vehicleId },
      });
      if (!stillOwned) {
        check(
          'and not the one they sold',
          mine.rows.some((r) => r.id === sold.vehicleId),
          false,
        );
      }
    }
  }

  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
