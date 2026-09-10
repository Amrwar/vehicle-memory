import { verifyChain } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * Rolling verification of the vehicle passports.
 *
 * Tampering that is only detected when somebody asks is tampering that has
 * already been relied on. A sample every cycle covers the whole database over
 * time without ever reading all of it at once.
 */

const SALT = process.env.LEDGER_CHAIN_SALT ?? '';

/* ---------------------------------------------------------------------------
   Chain audit
   --------------------------------------------------------------------------- */

let auditCursor = 0;

export async function auditChains(sample = 20): Promise<void> {
  if (!SALT) return;

  const vehicles = await prisma.vehicle.findMany({
    where: { eventCount: { gt: 0 } },
    orderBy: { id: 'asc' },
    skip: auditCursor,
    take: sample,
    select: { id: true, vin: true },
  });

  if (vehicles.length === 0) {
    auditCursor = 0;
    return;
  }

  auditCursor += vehicles.length;

  for (const vehicle of vehicles) {
    const events = await prisma.vehicleEvent.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { sequence: 'asc' },
    });

    const result = verifyChain(events as never, SALT);

    if (!result.valid) {
      // Critical. See the runbook: do not repair the chain.
      console.error(
        JSON.stringify({
          time: new Date().toISOString(),
          level: 'error',
          event: 'chain.verification.failed',
          vin: vehicle.vin,
          vehicleId: vehicle.id,
          failedAt: result.failedAt,
        }),
      );
    }
  }
}
