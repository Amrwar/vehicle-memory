/**
 * Integrity check.
 *
 *   npx tsx infra/scripts/verify-integrity.ts
 *
 * Recomputes every vehicle's hash chain and then actively tries to violate the
 * invariants the database is supposed to enforce. Run in CI against a seeded
 * database: a guarantee nobody tests is a guarantee nobody has.
 */

import 'dotenv/config';

import { verifyChain } from '@carnet/core';
import { prisma } from '@carnet/db';

const SALT = process.env.LEDGER_CHAIN_SALT ?? '';

function reason(error: unknown, needle: string): string {
  const text = String((error as Error).message);
  return (
    text
      .split('\n')
      .find((line) => line.includes(needle))
      ?.trim() ?? 'blocked'
  );
}

async function main() {
  let failures = 0;

  console.info('--- chain verification ---');
  const vehicles = await prisma.vehicle.findMany({
    where: { eventCount: { gt: 0 } },
    select: { id: true, vin: true, make: true, model: true },
  });

  for (const vehicle of vehicles) {
    const events = await prisma.vehicleEvent.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { sequence: 'asc' },
    });

    const result = verifyChain(events as never, SALT);

    if (result.valid) {
      console.info(
        `  ok    ${vehicle.make} ${vehicle.model} (${vehicle.vin}) — ${events.length} entries`,
      );
    } else {
      failures += 1;
      console.error(
        `  BROKEN ${vehicle.make} ${vehicle.model} at entry ${result.failedAt.sequence}: ${result.failedAt.reason}`,
      );
    }
  }

  const target = vehicles[0];
  if (!target) {
    console.warn('No vehicles with events. Run the seed first.');
    return;
  }

  const first = await prisma.vehicleEvent.findFirst({
    where: { vehicleId: target.id },
    orderBy: { sequence: 'asc' },
  });

  console.info('\n--- attempting to rewrite history ---');

  try {
    await prisma.$executeRaw`UPDATE vehicle_events SET title = 'Nothing was ever wrong' WHERE id = ${first!.id}`;
    failures += 1;
    console.error('  FAIL   the UPDATE succeeded. The ledger is not append-only.');
  } catch (error) {
    console.info(`  ok     UPDATE refused: ${reason(error, 'append-only')}`);
  }

  try {
    await prisma.$executeRaw`DELETE FROM vehicle_events WHERE id = ${first!.id}`;
    failures += 1;
    console.error('  FAIL   the DELETE succeeded.');
  } catch (error) {
    console.info(`  ok     DELETE refused: ${reason(error, 'append-only')}`);
  }

  console.info('\n--- attempting to edit the audit log ---');
  const audit = await prisma.auditLog.create({
    data: {
      action: 'integrity-check',
      entityType: 'Test',
      entityId: 'x',
      before: { name: 'A name nobody should be able to rewrite' },
      after: { name: 'Nor this one' },
    },
  });

  try {
    await prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${audit.id}`;
    failures += 1;
    console.error('  FAIL   audit log deletion succeeded.');
  } catch (error) {
    console.info(`  ok     DELETE refused: ${reason(error, 'immutable')}`);
  }

  // The trigger has two permitted mutations and this probe knew about neither
  // until Phase 62, which is how a version of it that dropped the first got as
  // far as being applied. What is permitted needs checking as much as what is
  // refused: a rule that only ever says no is indistinguishable from a rule
  // that says no to everything, including the thing the product depends on.

  try {
    await prisma.$executeRaw`UPDATE audit_logs SET "action" = 'rewritten' WHERE id = ${audit.id}`;
    failures += 1;
    console.error('  FAIL   the audit log was rewritten.');
  } catch (error) {
    console.info(`  ok     rewriting what happened refused: ${reason(error, 'immutable')}`);
  }

  try {
    await prisma.$executeRaw`UPDATE audit_logs SET "before" = NULL, "after" = NULL WHERE id = ${audit.id}`;
    const redacted = await prisma.auditLog.findUnique({ where: { id: audit.id } });
    if (redacted && redacted.before === null && redacted.action === 'integrity-check') {
      console.info('  ok     a redaction permitted: the copy of the name goes, the account stays');
    } else {
      failures += 1;
      console.error('  FAIL   the redaction took more than the name with it.');
    }
  } catch (error) {
    failures += 1;
    console.error(
      `  FAIL   a person asking to be forgotten would be refused: ${reason(error, '')}`,
    );
  }

  try {
    // What a SET NULL cascade does when an audited user is deleted. Refusing
    // this is what made every audited organisation permanently undeletable
    // before 20260909230000, and what a careless Phase 62 nearly restored.
    await prisma.$executeRaw`UPDATE audit_logs SET "orgId" = NULL, "actorUserId" = NULL WHERE id = ${audit.id}`;
    console.info('  ok     a deleted party’s reference may still be cleared');
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   nothing audited could ever be deleted: ${reason(error, '')}`);
  }

  console.info('\n--- attempting an unbalanced journal entry ---');
  const org = await prisma.organization.findFirst({ where: { slug: 'hillside-motors' } });

  if (org) {
    // Created outside the transactions below, which are expected to roll back.
    const account = await prisma.account.upsert({
      where: { orgId_code: { orgId: org.id, code: '1000' } },
      create: { orgId: org.id, code: '1000', name: 'Bank', type: 'ASSET' },
      update: {},
    });

    try {
      await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: {
            orgId: org.id,
            reference: 'INTEGRITY-TEST',
            description: 'deliberately unbalanced',
          },
        });
        await tx.journalLine.create({
          data: { entryId: entry.id, accountId: account.id, debit: 100, credit: 0 },
        });
      });
      failures += 1;
      console.error('  FAIL   an unbalanced journal entry was accepted.');
    } catch (error) {
      console.info(`  ok     refused: ${reason(error, 'does not balance')}`);
    }

    console.info('\n--- attempting a journal line that is both debit and credit ---');
    try {
      await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: { orgId: org.id, reference: 'INTEGRITY-TEST-2', description: 'both sides' },
        });
        await tx.journalLine.create({
          data: { entryId: entry.id, accountId: account.id, debit: 50, credit: 50 },
        });
      });
      failures += 1;
      console.error('  FAIL   a line with both a debit and a credit was accepted.');
    } catch (error) {
      console.info(`  ok     refused: ${reason(error, 'debit_xor_credit')}`);
    }
  }

  console.info('\n--- attempting two open ownerships on one vehicle ---');
  try {
    await prisma.vehicleOwnership.create({
      data: { vehicleId: target.id, ownerName: 'Impostor', startedAt: new Date() },
    });
    failures += 1;
    console.error('  FAIL   a second open ownership was accepted.');
  } catch (error) {
    console.info(`  ok     refused: ${reason(error, 'one_open_per_vehicle')}`);
  }

  console.info(
    failures === 0 ? '\nAll integrity guarantees held.' : `\n${failures} guarantee(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
