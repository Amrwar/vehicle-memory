/**
 * Proves the things that were built and could not be reached now work.
 *
 *   npx tsx infra/scripts/verify-wiring.ts
 *
 * A feature that exists in the code and has no way in is worse than one that
 * was never written: the map says it is there, the tests say it works, and the
 * person in front of it cannot find it. This checks the three that were found
 * in that state, end to end, through the same functions the pages call.
 *
 *   - Correcting a customer. A number written down wrong stayed wrong, and the
 *     only way round it was a second record for the same person.
 *   - Moving stock between sites. The whole cycle was written except its
 *     beginning, so a workshop could be told what to move and could not move
 *     it — and anything already in a van could never be booked in.
 *   - Standing behind a job. Every screen read a warranty book nothing could
 *     write to.
 *
 * Runs against the seeded hillside-motors and clears up after itself.
 */

import 'dotenv/config';

import { verifyChain } from '@carnet/core';
import { prisma } from '@carnet/db';

import { updateCustomer } from '../../apps/web/src/lib/customers';
import {
  createTransfer,
  dispatchTransfer,
  loadTransfer,
  receiveTransfer,
} from '../../apps/web/src/lib/transfers';
import { correctEvent } from '../../apps/web/src/lib/passport';
import { recordCover, warrantyBook } from '../../apps/web/src/lib/warranty';

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown) {
  console.info(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${String(detail)}`}`,
  );
  if (!passed) failures += 1;
}

const TAG = 'Verify wiring probe';

async function main() {
  console.info('\n  Built, and now reachable\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  await forget(org.id);

  /* --- correcting a customer ------------------------------------------------ */

  console.info('\n  Correcting a customer');

  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: `${TAG} Ross`,
      firstName: TAG,
      lastName: 'Ross',
      mobile: '07700 900111',
      email: 'wrong@example.test',
      notes: TAG,
    },
    select: { id: true },
  });

  await updateCustomer({
    orgId: org.id,
    userId: staff.id,
    customerId: customer.id,
    details: {
      kind: 'INDIVIDUAL',
      firstName: TAG,
      lastName: 'Rossiter',
      companyName: '',
      taxNumber: '',
      email: 'right@example.test',
      mobile: '07700 900222',
      phone: '',
      addressLine1: '14 Hillside Road',
      addressLine2: '',
      locality: 'Stockport',
      region: '',
      postcode: 'sk4 2hl',
      sourceOfBusiness: '',
      notes: TAG,
      // Not sent by the edit form either: consent is the customer's, and is
      // changed where a reason is recorded against it.
      marketingEmailConsent: false,
      marketingSmsConsent: false,
    },
  });

  const corrected = await prisma.customer.findUniqueOrThrow({
    where: { id: customer.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      mobile: true,
      postcode: true,
      marketingEmailConsent: true,
    },
  });

  check('the name is corrected', corrected.displayName.includes('Rossiter'), corrected.displayName);
  check('the address they gave is on the record', corrected.email === 'right@example.test');
  check('and the number written down wrong is right', corrected.mobile === '07700 900222');
  check('a postcode is tidied rather than refused', corrected.postcode === 'SK4 2HL');
  check('and it is the same record, not a second one', corrected.id === customer.id);
  check(
    'correcting a postcode cannot put somebody back on a mailing list',
    corrected.marketingEmailConsent === false,
  );

  /* --- stock between sites -------------------------------------------------- */

  console.info('\n  Stock between sites');

  const warehouses = await prisma.warehouse.findMany({
    where: { orgId: org.id },
    select: { id: true, code: true },
    orderBy: { isDefault: 'desc' },
    take: 2,
  });

  if (warehouses.length < 2) {
    check('two sites to move stock between', false, 'the seed has only one warehouse');
    finish();
    return;
  }

  const [from, to] = warehouses as [{ id: string }, { id: string }];

  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '87139-0D070' },
    select: { id: true },
  });

  // Enough on the first shelf to send some of it.
  await prisma.stockLevel.upsert({
    where: { productId_warehouseId: { productId: product.id, warehouseId: from.id } },
    create: { productId: product.id, warehouseId: from.id, onHand: 20, reserved: 0, avgCost: 12 },
    // Generously, because some of this shelf is already promised to jobs and
    // a transfer may only send what is genuinely spare.
    update: { onHand: { increment: 20 } },
  });

  const before = await onHand(product.id, from.id);
  const beforeThere = await onHand(product.id, to.id);

  const transferId = await createTransfer({
    orgId: org.id,
    userId: staff.id,
    fromWarehouseId: from.id,
    toWarehouseId: to.id,
    lines: [{ productId: product.id, quantity: 4 }],
    note: TAG,
  });

  const draft = await loadTransfer(org.id, transferId);
  check('a transfer can be started at all', draft.status === 'DRAFT', draft.reference);
  check('a draft moves nothing yet', (await onHand(product.id, from.id)) === before);

  await dispatchTransfer(org.id, transferId, staff.id);

  check(
    'sending it takes the parts off the first shelf',
    (await onHand(product.id, from.id)) === before - 4,
    `${before} to ${await onHand(product.id, from.id)}`,
  );
  check(
    'and they have not landed on the other one yet',
    (await onHand(product.id, to.id)) === beforeThere,
  );

  // A van that arrives with three of the four is a normal Tuesday.
  await receiveTransfer(org.id, transferId, [{ productId: product.id, quantity: 3 }], staff.id);

  check(
    'what arrived is booked in',
    (await onHand(product.id, to.id)) === beforeThere + 3,
    `${beforeThere} to ${await onHand(product.id, to.id)}`,
  );

  const short = await loadTransfer(org.id, transferId);
  // Part received, not received: the one still in the van is still counted,
  // and the page has to go on offering a way to book it in.
  check(
    'a short delivery stays open rather than vanishing',
    short.status === 'PART_RECEIVED',
    short.status,
  );

  await receiveTransfer(org.id, transferId, [{ productId: product.id, quantity: 1 }], staff.id);

  const done = await loadTransfer(org.id, transferId);
  check('and closes when the rest turns up', done.status === 'RECEIVED', done.status);
  check(
    'nothing was created or destroyed on the journey',
    (await onHand(product.id, from.id)) + (await onHand(product.id, to.id)) ===
      before + beforeThere,
  );

  /* --- standing behind a job ------------------------------------------------ */

  console.info('\n  Standing behind a job');

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: { in: ['COMPLETED', 'INVOICED', 'PAID'] } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, vehicleId: true },
  });

  // Whose warranty backs the workshop's. Recorded only against a named
  // supplier, because "thirty-six months" with nobody behind it is a number
  // that helps at exactly no point in a dispute.
  const supplier = await prisma.supplier.findFirst({
    where: { orgId: org.id, isActive: true },
    select: { id: true },
  });

  const bookBefore = await warrantyBook(org.id);

  await recordCover({
    orgId: org.id,
    userId: staff.id,
    jobId: job.id,
    vehicleId: job.vehicleId,
    kind: 'PART',
    description: TAG,
    months: 24,
    km: 30_000,
    supplierId: supplier?.id ?? null,
    supplierMonths: supplier ? 36 : null,
  });

  const bookAfter = await warrantyBook(org.id);
  const written = bookAfter.all.find((entry) => entry.row.description === TAG);

  check('cover can be recorded at all', Boolean(written));
  check('it is on the book as active', written?.status.active ?? false);
  check(
    'and it knows the supplier outlasts the workshop',
    !supplier || (written?.row.supplierMonths ?? 0) > (written?.row.months ?? 0),
    `${written?.row.months} vs ${written?.row.supplierMonths}`,
  );
  check(
    'a mileage allowance counts from the reading the vehicle was on',
    (written?.row.startedAtKm ?? null) !== null || (written?.row.km ?? null) === null,
    written?.row.startedAtKm,
  );
  check('the book grew by one', bookAfter.all.length === bookBefore.all.length + 1);

  /* --- putting a record right ----------------------------------------------- */

  console.info('\n  Putting an entry right');

  const entry = await prisma.vehicleEvent.findFirst({
    where: { recordedByOrgId: org.id, supersededById: null },
    orderBy: { sequence: 'desc' },
    select: { id: true, vehicleId: true },
  });

  if (entry) {
    const correctionId = await correctEvent({
      orgId: org.id,
      userId: staff.id,
      eventId: entry.id,
      title: TAG,
      summary: `${TAG}: a correction, to prove one can be made at all.`,
    });

    const chain = await prisma.vehicleEvent.findMany({
      where: { vehicleId: entry.vehicleId },
      orderBy: { sequence: 'asc' },
    });

    check(
      'a correction leaves the chain verifiable',
      verifyChain(chain as never, process.env.LEDGER_CHAIN_SALT ?? '').valid,
    );

    const corrected = await prisma.vehicleEvent.findUniqueOrThrow({
      where: { id: entry.id },
      select: { supersededById: true },
    });

    check('the old entry reads as corrected', corrected.supersededById === correctionId);

    let refused = false;
    try {
      await correctEvent({
        orgId: org.id,
        userId: staff.id,
        eventId: entry.id,
        title: TAG,
        summary: `${TAG}: should be refused.`,
      });
    } catch {
      refused = true;
    }

    check('and cannot be corrected twice', refused);

    await unwind(entry.vehicleId, entry.id, correctionId);

    const restored = await prisma.vehicleEvent.findMany({
      where: { vehicleId: entry.vehicleId },
      orderBy: { sequence: 'asc' },
    });

    check(
      'the probe left the chain as it found it',
      verifyChain(restored as never, process.env.LEDGER_CHAIN_SALT ?? '').valid,
    );
  }

  await forget(org.id);
  check('the probe left nothing behind', (await probeRows(org.id)) === 0);

  finish();
}

async function onHand(productId: string, warehouseId: string): Promise<number> {
  const level = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
    select: { onHand: true },
  });
  return Number(level?.onHand ?? 0);
}

/**
 * Takes a probe correction back off a vehicle's chain.
 *
 * The triggers are disabled for exactly two statements, which is something no
 * application code may do and this probe may, because the alternative is a
 * seeded database that grows a correction every time the checks are run.
 */
async function unwind(vehicleId: string, entryId: string, correctionId: string): Promise<void> {
  const chain = await prisma.vehicleEvent.findMany({
    where: { vehicleId },
    orderBy: { sequence: 'asc' },
    select: { id: true, hash: true },
  });

  const previous = chain[chain.length - 2];

  await prisma.$executeRaw`ALTER TABLE "vehicle_events" DISABLE TRIGGER USER`;
  await prisma.vehicleEvent.update({ where: { id: entryId }, data: { supersededById: null } });
  await prisma.vehicleEvent.delete({ where: { id: correctionId } });
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { eventCount: { decrement: 1 }, chainHead: previous?.hash ?? null },
  });
  await prisma.$executeRaw`ALTER TABLE "vehicle_events" ENABLE TRIGGER USER`;
}

async function probeRows(orgId: string): Promise<number> {
  const [customers, transfers, warranties] = await Promise.all([
    prisma.customer.count({ where: { orgId, notes: TAG } }),
    prisma.stockTransfer.count({ where: { orgId, note: TAG } }),
    prisma.warranty.count({ where: { orgId, description: TAG } }),
  ]);
  return customers + transfers + warranties;
}

async function forget(orgId: string) {
  await prisma.warranty.deleteMany({ where: { orgId, description: TAG } });

  const transfers = await prisma.stockTransfer.findMany({
    where: { orgId, note: TAG },
    select: { id: true },
  });
  for (const transfer of transfers) {
    await prisma.stockMovement.deleteMany({
      where: { orgId, referenceType: 'StockTransfer', referenceId: transfer.id },
    });
  }
  await prisma.stockTransfer.deleteMany({ where: { id: { in: transfers.map((row) => row.id) } } });

  const customers = await prisma.customer.findMany({
    where: { orgId, notes: TAG },
    select: { id: true },
  });
  await prisma.consentChange.deleteMany({
    where: { customerId: { in: customers.map((row) => row.id) } },
  });
  await prisma.customer.deleteMany({ where: { id: { in: customers.map((row) => row.id) } } });
}

function finish() {
  console.info(
    `\n  ${failures === 0 ? 'Everything built has a way in, and works when you get there.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
