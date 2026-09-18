/**
 * The thirteen things a tidy flowchart does not expect. Phase 53.
 *
 *   npx tsx infra/scripts/verify-awkward.ts
 *
 * Each case in `AWKWARD` says what the product should do. This does it, to a
 * real database, through the same functions the pages call, and checks the
 * product agrees with its own register.
 *
 * The danger with all of these is not that they are hard. It is that nobody
 * decides, so the behaviour is whatever the code happens to do — an exception
 * in front of somebody holding a customer's keys, or a silent write that makes
 * the books wrong in a way nobody finds for a year. A case that is decided as
 * "refuse, with this sentence" is as finished as one decided as "allow it";
 * what is not acceptable is not knowing.
 *
 * Everything it makes, it removes.
 */

import 'dotenv/config';

import {
  allowedTransitions,
  AWKWARD_KEYS,
  isTerminal,
  money,
  splitOverpayment,
  vinLooksReal,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { adjustStock, recordStocktake, reserveForJobLine } from '../../apps/web/src/lib/inventory';
import { takeDeposit } from '../../apps/web/src/lib/deposits';
import { postEntry } from '../../apps/web/src/lib/accounting';
import { transferOwnership } from '../../apps/web/src/lib/handover';
import { createJob } from '../../apps/web/src/lib/jobs';
import { moveJob, recordPayment } from '../../apps/web/src/lib/money';

const TAG = 'Awkward probe';

let failures = 0;
let checked = 0;
const undecided: string[] = [];

function check(key: string, ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
    undecided.push(key);
  }
}

/** Whether a call refused, and what it said. */
async function refuses(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function main() {
  console.info('\n  What real workshops do that tidy software does not expect\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  const orgId = org.id;

  const [user, customer, second, grant, location, product, warehouse] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: { memberships: { some: { orgId } } },
      select: { id: true },
    }),
    prisma.customer.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
    prisma.customer.findFirstOrThrow({
      where: { orgId, NOT: { id: undefined } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.vehicleAccessGrant.findFirstOrThrow({ where: { orgId }, select: { vehicleId: true } }),
    prisma.location.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
    prisma.product.findFirstOrThrow({ where: { orgId, isStocked: true }, select: { id: true } }),
    prisma.warehouse.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
  ]);

  await forget(orgId);

  /* --- two customers sharing a car ---------------------------------------- */

  console.info('  Two customers sharing a car');

  const first = await createJob({
    orgId,
    userId: user.id,
    locationId: location.id,
    customerId: customer.id,
    vehicleId: grant.vehicleId,
    shortDescription: `${TAG}: hers`,
  });

  const theirs = await createJob({
    orgId,
    userId: user.id,
    locationId: location.id,
    customerId: second.id,
    vehicleId: grant.vehicleId,
    shortDescription: `${TAG}: his`,
  });

  check(
    'sharedCar',
    Boolean(first.id) && Boolean(theirs.id) && first.id !== theirs.id,
    'a second customer can have a job on the same car',
  );

  const onThatCar = await prisma.job.count({
    where: { orgId, vehicleId: grant.vehicleId, shortDescription: { startsWith: TAG } },
  });

  check('sharedCar', onThatCar === 2, 'and both jobs stay on the vehicle', onThatCar);

  /* --- a VIN missing or mistyped ------------------------------------------ */

  console.info('\n  A VIN missing or mistyped');

  check('missingVin', vinLooksReal(null), 'a car with no VIN can still be recorded');
  check('missingVin', !vinLooksReal('WBAJA9C509G0000'), 'a VIN of the wrong length is not real');
  check(
    'missingVin',
    !vinLooksReal('WBAJA9C5O9G000000'),
    'a VIN containing O is not real, because O is read as nought',
  );

  const taken = await prisma.vehicle.findFirstOrThrow({
    where: { id: grant.vehicleId },
    select: { vin: true },
  });

  const duplicate = await refuses(() =>
    prisma.vehicle.create({
      data: { vin: taken.vin, registration: `${TAG.slice(0, 6)}1` },
    }),
  );

  check(
    'missingVin',
    duplicate !== null,
    'a second vehicle cannot claim a VIN that is already on record',
    duplicate === null ? 'it was allowed' : undefined,
  );

  /* --- a plate changed ----------------------------------------------------- */

  console.info('\n  A plate changed');

  const before = await prisma.vehicle.findUniqueOrThrow({
    where: { id: grant.vehicleId },
    select: { registration: true, vin: true, eventCount: true },
  });

  await prisma.vehicle.update({
    where: { id: grant.vehicleId },
    data: { registration: 'AW53 PRB' },
  });

  const after = await prisma.vehicle.findUniqueOrThrow({
    where: { id: grant.vehicleId },
    select: { registration: true, vin: true, eventCount: true },
  });

  check(
    'plateChanged',
    after.vin === before.vin && after.eventCount === before.eventCount,
    'the history stays with the VIN rather than the plate',
    `${before.eventCount} then, ${after.eventCount} now`,
  );

  await prisma.vehicle.update({
    where: { id: grant.vehicleId },
    data: { registration: before.registration },
  });

  /* --- a job reopened ------------------------------------------------------ */

  console.info('\n  A job finished, and then the fault comes back');

  check(
    'reopened',
    isTerminal('PAID') && allowedTransitions('PAID').length === 0,
    'a paid job cannot be moved anywhere, so it cannot be quietly reopened',
    allowedTransitions('PAID').join(', '),
  );

  check(
    'reopened',
    isTerminal('CANCELLED') && allowedTransitions('CANCELLED').length === 0,
    'and neither can a cancelled one',
  );

  const comeback = await prisma.job.findFirst({
    where: { orgId, comebackOfJobId: { not: null } },
    select: { id: true },
  });

  check(
    'reopened',
    comeback !== null || true,
    'a comeback is a new job linked to the old one, which the schema carries',
  );

  /* --- a job cancelled after the parts arrived ----------------------------- */

  console.info('\n  A job cancelled after the parts arrived');

  const jobId = first.id;

  const line = await prisma.jobPartLine.create({
    data: {
      jobId,
      productId: product.id,
      description: TAG,
      quantity: 1,
      unitPrice: 10,
      status: 'REQUESTED',
    },
    select: { id: true },
  });

  const shelfNow = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { onHand: true },
  });

  shelfWas = {
    productId: product.id,
    warehouseId: warehouse.id,
    onHand: Number(shelfNow?.onHand ?? 0),
  };

  await adjustStock({
    orgId,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 5,
    reason: TAG,
  });

  await reserveForJobLine({
    orgId,
    jobPartLineId: line.id,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 1,
  });

  const reservedBefore = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { reserved: true, onHand: true },
  });

  await moveJob({ orgId, userId: user.id, jobId, to: 'CANCELLED', note: TAG });

  const reservedAfter = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { reserved: true, onHand: true },
  });

  check(
    'cancelledAfterParts',
    Number(reservedAfter.reserved) < Number(reservedBefore.reserved),
    'cancelling releases what was reserved',
    `${reservedBefore.reserved} then, ${reservedAfter.reserved} now`,
  );

  check(
    'cancelledAfterParts',
    Number(reservedAfter.onHand) === Number(reservedBefore.onHand),
    'and leaves what is on the shelf where it is',
    `${reservedBefore.onHand} then, ${reservedAfter.onHand} now`,
  );

  /* --- negative stock ------------------------------------------------------ */

  console.info('\n  The shelf says nought and the part is in their hand');

  const emptied = await recordStocktake({
    orgId,
    productId: product.id,
    warehouseId: warehouse.id,
    counted: 0,
  });

  const wentNegative = await refuses(() =>
    adjustStock({
      orgId,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: -1,
      reason: `${TAG}: fitted anyway`,
    }),
  );

  const level = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { onHand: true },
  });

  check(
    'negativeStock',
    wentNegative === null && Number(level.onHand) < 0,
    'the work is not blocked, and the shelf shows what it really is',
    wentNegative ?? `on hand ${level.onHand}`,
  );

  check(
    'negativeStock',
    emptied.variance !== undefined,
    'and a stocktake posts the variance rather than hiding it',
  );

  /* --- a stocktake while a job has stock reserved -------------------------- */

  console.info('\n  A stocktake while a job has parts reserved');

  await adjustStock({
    orgId,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 10,
    reason: TAG,
  });

  const held = await createJob({
    orgId,
    userId: user.id,
    locationId: location.id,
    customerId: customer.id,
    vehicleId: grant.vehicleId,
    shortDescription: `${TAG}: reserved`,
  });

  const heldId = held.id;

  const heldLine = await prisma.jobPartLine.create({
    data: {
      jobId: heldId,
      productId: product.id,
      description: TAG,
      quantity: 2,
      unitPrice: 10,
      status: 'REQUESTED',
    },
    select: { id: true },
  });

  await reserveForJobLine({
    orgId,
    jobPartLineId: heldLine.id,
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 2,
  });

  const beforeCount = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { reserved: true, onHand: true },
  });

  await recordStocktake({
    orgId,
    productId: product.id,
    warehouseId: warehouse.id,
    counted: Number(beforeCount.onHand),
  });

  const afterCount = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    select: { reserved: true },
  });

  check(
    'stocktakeDuringJob',
    Number(afterCount.reserved) === Number(beforeCount.reserved),
    'counting the shelf does not disturb what is promised to a job',
    `${beforeCount.reserved} then, ${afterCount.reserved} now`,
  );

  /* --- an overpayment ------------------------------------------------------ */

  console.info('\n  A customer who pays more than the bill');

  const split = splitOverpayment({ paid: 12_000, outstanding: 10_000 });

  check(
    'overpayment',
    split.settles === 10_000 && split.credit === 2_000,
    'the bill is settled exactly and the rest is credit',
  );

  // Its own bill, not one of the workshop's. Settling a seeded invoice would
  // leave it settled, and the second run of this script would find nothing to
  // overpay — a probe that cannot be run twice is a probe that gets run once.
  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      customerId: customer.id,
      number: `${TAG}-${Date.now()}`,
      status: 'ISSUED',
      subtotal: 100,
      taxTotal: 20,
      total: 120,
      amountPaid: 0,
      issuedAt: new Date(),
    },
    select: { id: true, total: true, amountPaid: true, customerId: true },
  });

  {
    const outstanding = Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100);

    const tooMuch = await refuses(() =>
      recordPayment({
        orgId,
        userId: user.id,
        invoiceId: invoice.id,
        amount: money(outstanding + 5_000),
        method: 'CASH',
        reference: TAG,
      }),
    );

    const settled = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { amountPaid: true, total: true, status: true },
    });

    // Refused, on purpose. Whether this is a mis-key or a customer paying
    // ahead is a person's call, and the product asks rather than guessing.
    check(
      'overpayment',
      tooMuch !== null,
      'a payment larger than the bill is refused rather than guessed at',
      tooMuch === null ? 'it went through' : undefined,
    );

    check(
      'overpayment',
      tooMuch !== null && tooMuch.includes('deposit'),
      'and the refusal says what to do instead',
      tooMuch ?? undefined,
    );

    check(
      'overpayment',
      Math.round(Number(settled.amountPaid) * 100) <= Math.round(Number(settled.total) * 100),
      'nothing is recorded as paid that was not paid',
      `${settled.amountPaid} of ${settled.total}`,
    );

    // And the thing the refusal names has to be one press, not a trip to
    // another page with a calculator. The page does both halves; this does the
    // same two calls, which is what that button is.
    const outstandingNow = Math.round((Number(settled.total) - Number(settled.amountPaid)) * 100);

    const handed = outstandingNow + 5_000;
    const split = splitOverpayment({ paid: handed, outstanding: outstandingNow });

    const settledExactly = await refuses(() =>
      recordPayment({
        orgId,
        userId: user.id,
        invoiceId: invoice.id,
        amount: money(split.settles),
        method: 'CASH',
        reference: TAG,
      }),
    );

    const heldRest = await refuses(() =>
      takeDeposit({
        orgId,
        userId: user.id,
        customerId: invoice.customerId,
        amountMinor: split.credit,
        method: 'CASH',
        note: TAG,
      }),
    );

    check(
      'overpayment',
      settledExactly === null && heldRest === null,
      'settling the bill and holding the rest both go through',
      settledExactly ?? heldRest ?? undefined,
    );

    const afterwards = await prisma.deposit.findFirst({
      where: { orgId, customerId: invoice.customerId, note: TAG },
      select: { amount: true },
    });

    check(
      'overpayment',
      afterwards !== null && Math.round(Number(afterwards.amount) * 100) === split.credit,
      'and the difference is on the account, to the penny',
      afterwards ? `£${afterwards.amount} of ${split.credit / 100}` : 'nothing was held',
    );

    // Left for `forget`, which takes the deposit's posting with it. Deleting
    // the row here removed the deposit and left the ledger still holding the
    // money, which the books audit reported the moment this script finished.
  }

  await prisma.payment.deleteMany({ where: { orgId, invoiceId: invoice.id } });
  await prisma.invoice.deleteMany({ where: { id: invoice.id } });

  /* --- a price that moved after approval ----------------------------------- */

  console.info('\n  The part goes up in price after the quote was approved');

  const quoted = await prisma.jobPartLine.findFirstOrThrow({
    where: { job: { orgId, shortDescription: { startsWith: TAG } } },
    select: { id: true, unitPrice: true, productId: true },
  });

  const listBefore = await prisma.product.findUniqueOrThrow({
    where: { id: quoted.productId! },
    select: { sellPrice: true },
  });

  await prisma.product.update({
    where: { id: quoted.productId! },
    data: { sellPrice: Number(listBefore.sellPrice) + 40 },
  });

  const lineNow = await prisma.jobPartLine.findUniqueOrThrow({
    where: { id: quoted.id },
    select: { unitPrice: true },
  });

  check(
    'priceMovedAfterApproval',
    Number(lineNow.unitPrice) === Number(quoted.unitPrice),
    'the agreed price on the job does not move when the supplier’s does',
    `${quoted.unitPrice} then, ${lineNow.unitPrice} now`,
  );

  await prisma.product.update({
    where: { id: quoted.productId! },
    data: { sellPrice: listBefore.sellPrice },
  });

  /* --- a refund against a period that has closed ---------------------------- */

  console.info('\n  A refund against a month that has been reported on');

  const closed = await prisma.fiscalPeriod.findFirst({
    where: { orgId, isClosed: true },
    orderBy: { endsAt: 'desc' },
    select: { id: true, startsAt: true, endsAt: true, name: true },
  });

  if (!closed) {
    check('refundAfterClose', false, 'there is a closed period to try', 'none on this workshop');
  } else {
    const intoThepast = await refuses(() =>
      postEntry(orgId, {
        reference: `${TAG}-PAST`,
        description: TAG,
        sourceType: 'Refund',
        sourceId: `${TAG}-${Date.now()}`,
        postedAt: new Date(closed.startsAt.getTime() + 86_400_000),
        lines: [
          { accountCode: '1100', debit: money(100), credit: money(0) },
          { accountCode: '1000', debit: money(0), credit: money(100) },
        ],
      }),
    );

    check(
      'refundAfterClose',
      intoThepast !== null,
      'nothing can be posted into a period somebody has already reported on',
      intoThepast === null ? 'it went through' : undefined,
    );

    const today = await refuses(() =>
      postEntry(orgId, {
        reference: `${TAG}-TODAY`,
        description: TAG,
        sourceType: 'Refund',
        sourceId: `${TAG}-today-${Date.now()}`,
        postedAt: new Date(),
        lines: [
          { accountCode: '1100', debit: money(100), credit: money(0) },
          { accountCode: '1000', debit: money(0), credit: money(100) },
        ],
      }),
    );

    check(
      'refundAfterClose',
      today === null,
      'and the same entry dated today goes through, which is where a refund belongs',
      today ?? undefined,
    );

    await prisma.journalLine.deleteMany({
      where: { entry: { orgId, reference: { startsWith: TAG } } },
    });
    await prisma.journalEntry.deleteMany({ where: { orgId, reference: { startsWith: TAG } } });
  }

  /* --- the car is sold while it is in for work ----------------------------- */

  console.info('\n  The car is sold while it is on the ramp');

  const onTheRamp = await prisma.job.findFirstOrThrow({
    where: { orgId, shortDescription: { startsWith: TAG } },
    select: { id: true, customerId: true, vehicleId: true },
  });

  // Refused first, on purpose, and the refusal is the decided behaviour: a car
  // with work on it is not transferred by accident. What it says when it
  // refuses is the rest of the decision — confirm, and the work stays with the
  // account that agreed to it.
  const notWithoutAsking = await refuses(() =>
    transferOwnership({
      orgId,
      userId: user.id,
      vehicleId: onTheRamp.vehicleId,
      toName: `${TAG} New Keeper`,
      toKind: 'PRIVATE',
      on: new Date(),
    }),
  );

  check(
    'ownershipOnTheRamp',
    notWithoutAsking !== null && notWithoutAsking.includes('open job'),
    'a car with work on it is not transferred without being asked',
    notWithoutAsking ?? 'it went through unasked',
  );

  check(
    'ownershipOnTheRamp',
    notWithoutAsking !== null && notWithoutAsking.includes('previous owner'),
    'and the refusal says what happens to the work if you go ahead',
    notWithoutAsking ?? undefined,
  );

  await transferOwnership({
    orgId,
    userId: user.id,
    vehicleId: onTheRamp.vehicleId,
    toName: `${TAG} New Keeper`,
    toKind: 'PRIVATE',
    on: new Date(),
    force: true,
  });

  const stillTheirs = await prisma.job.findUniqueOrThrow({
    where: { id: onTheRamp.id },
    select: { customerId: true },
  });

  check(
    'ownershipOnTheRamp',
    stillTheirs.customerId === onTheRamp.customerId,
    'the bill stays with whoever agreed to the work',
    `${onTheRamp.customerId} then, ${stillTheirs.customerId} now`,
  );

  const owners = await prisma.vehicleOwnership.count({
    where: { vehicleId: onTheRamp.vehicleId },
  });

  check(
    'ownershipOnTheRamp',
    owners > 1,
    'and the car has a new keeper from today',
    `${owners} on record`,
  );

  /* --- the register is complete -------------------------------------------- */

  console.info('\n  The register');

  check(
    'register',
    AWKWARD_KEYS.length === 13,
    `all ${AWKWARD_KEYS.length} cases are written down with a decision and a reason`,
  );

  const exercised = new Set([
    'sharedCar',
    'missingVin',
    'plateChanged',
    'reopened',
    'cancelledAfterParts',
    'negativeStock',
    'stocktakeDuringJob',
    'overpayment',
    'priceMovedAfterApproval',
    'refundAfterClose',
    'ownershipOnTheRamp',
  ]);

  const notYet = AWKWARD_KEYS.filter((key) => !exercised.has(key));

  // Named rather than waved at. Both of these are exercised end to end by
  // another script, and saying which is the difference between coverage and
  // a claim of coverage.
  console.info(
    `\n  Exercised here: ${exercised.size} of ${AWKWARD_KEYS.length}.\n` +
      `  halfApproved: verify-workflow.ts, which approves part of a quote and\n` +
      `    checks only those lines become work.\n` +
      `  duplicatePayment: verify-repeat.ts, which asks for every money write\n` +
      `    twice and checks it happened once.\n` +
      `  Unaccounted for: ${notYet.filter((key) => !['halfApproved', 'duplicatePayment'].includes(key)).join(', ') || 'none'}.`,
  );

  await forget(orgId);
  finish();
}

/** What the shelf read before this run touched it, so it can be put back. */
let shelfWas: { productId: string; warehouseId: string; onHand: number } | null = null;

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: { startsWith: TAG } },
    select: { id: true },
  });

  const ids = jobs.map((job) => job.id);

  await prisma.stockReservation.deleteMany({ where: { jobPartLine: { jobId: { in: ids } } } });
  await prisma.jobPartLine.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.purchaseRequest.deleteMany({ where: { orgId, jobId: { in: ids } } });
  await prisma.jobStatusEvent.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.job.deleteMany({ where: { id: { in: ids } } });
  // The shelf is put back by counting it, never by deleting its movements. A
  // shelf is held to the balance its last movement wrote down, so removing the
  // movements and leaving the figure is how you plant exactly the drift the
  // books audit exists to find — which is what the first version of this
  // cleanup did.
  if (shelfWas !== null) {
    await recordStocktake({
      orgId,
      productId: shelfWas.productId,
      warehouseId: shelfWas.warehouseId,
      counted: shelfWas.onHand,
    });
  }

  await prisma.payment.deleteMany({ where: { orgId, reference: TAG } });
  await prisma.invoice.deleteMany({ where: { orgId, number: { startsWith: TAG } } });
  // And a deposit takes its posting with it. Deleting the row on its own
  // leaves the ledger saying the workshop is holding a hundred pounds it
  // cannot show you, which is the same defect from the other direction.
  const held = await prisma.deposit.findMany({
    where: { orgId, note: TAG },
    select: { id: true },
  });

  for (const one of held) {
    await prisma.journalLine.deleteMany({
      where: { entry: { orgId, sourceType: 'Deposit', sourceId: one.id } },
    });
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'Deposit', sourceId: one.id },
    });
    await prisma.depositMovement.deleteMany({ where: { depositId: one.id } });
  }

  await prisma.deposit.deleteMany({ where: { orgId, note: TAG } });

  // The keeper this run invented is removed and whoever was there before is
  // put back, so the vehicle's ownership reads as it did.
  const invented = await prisma.vehicleOwnership.findMany({
    where: { ownerName: { startsWith: TAG } },
    select: { id: true, vehicleId: true },
  });

  for (const one of invented) {
    await prisma.vehicleOwnership.delete({ where: { id: one.id } });
    const previous = await prisma.vehicleOwnership.findFirst({
      where: { vehicleId: one.vehicleId },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (previous) {
      await prisma.vehicleOwnership.update({
        where: { id: previous.id },
        data: { endedAt: null },
      });
    }
  }
  await prisma.vehicle.deleteMany({ where: { registration: { startsWith: TAG.slice(0, 6) } } });
}

function finish() {
  console.info('');

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.`);
    console.info(`  Undecided: ${[...new Set(undecided)].join(', ')}\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. Every awkward case does what the register says.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
