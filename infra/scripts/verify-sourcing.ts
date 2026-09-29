/**
 * Where to buy it, and what was fitted instead. Phase 87.
 *
 *   npx tsx infra/scripts/verify-sourcing.ts
 *
 * Two features that fail in opposite directions, so they are checked for
 * opposite things.
 *
 * The comparison fails by being cheap. A screen that ranks four suppliers on
 * price alone looks like thrift and orders a disc that arrives the day after
 * the car was promised, so what is checked here is that a cheaper offer which
 * cannot make the date is ranked below one that can *and named*, with the
 * saving stated -- the pick nobody can argue with is the pick nobody trusts.
 *
 * The substitution fails by being confident. The bad version invents a
 * percentage, and a percentage is how the wrong pads reach a car whose owner
 * is braking. So: every candidate carries evidence that is a fact in this
 * database, a part with none is not listed at all, a caller cannot claim
 * evidence the records do not support, and nothing at all is swapped without
 * a person -- which the database enforces as well as the code.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import {
  EVIDENCE_ORDER,
  EVIDENCE_SENTENCE,
  needsConfirmation,
  PRICE_STALE_AFTER_DAYS,
  QUALIFYING,
  promiseVersusRecord,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  confirmSubstitution,
  recordOffer,
  SourcingError,
  whatElseWouldDo,
  whereToBuy,
} from '../../apps/web/src/lib/sourcing';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
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
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    check(label, error instanceof SourcingError ? error.code : String(error).slice(0, 70), code);
  }
}

async function main() {
  console.info('\n  Where to buy it\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  const discs = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '34116864059' },
    select: { id: true, name: true },
  });
  const marden = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: 'MRD-8841' },
    select: { id: true, name: true },
  });

  /* --- the comparison ----------------------------------------------------- */

  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 86_400_000);

  const soon = await whereToBuy(org.id, discs.id, { now, neededBy: inThreeDays });

  check('two suppliers are compared, not one', soon?.all.length, 2);
  check('the one that can make the date is the pick', soon?.pick.inStock, true);
  check('and the cheaper one is named rather than hidden', Boolean(soon?.cheaper), true);
  check('with what was wrong with it', soon?.passedOver, 'TOO_LATE');
  check('and what it would have saved', soon?.saving, 7.1);
  check('the cheaper one is still on the screen', soon?.all.at(-1)?.arrival, 'TOO_LATE');

  // The same list without a deadline is a different answer, and should be.
  const whenever = await whereToBuy(org.id, discs.id, { now, neededBy: null });
  check('with no date to miss, the cheapest wins', whenever?.pick.price, 54.4);
  check('and there is nothing to argue about', whenever?.cheaper, null);

  /* --- what they say against what they have done -------------------------- */

  console.info('\n  The promise and the record');

  check(
    'a supplier nobody has ordered from enough gets no verdict',
    promiseVersusRecord(null),
    'UNMEASURED',
  );
  // Two silences, not one. A supplier with two orders behind them has been
  // ordered from; `measureSupplier` simply refuses to state a share under
  // three. The screen said "never ordered" for both, which was a lie about
  // one of them, and the count is what tells them apart.
  check(
    'a supplier who has been ordered from carries the count that says so',
    soon?.all.some((offer) => offer.record === 'UNMEASURED' && offer.ordersBehindIt > 0),
    true,
  );

  check(
    'every offer carries the record beside the promise',
    soon?.all.every((offer) => ['KEEPS', 'SLIPS', 'UNMEASURED'].includes(offer.record)),
    true,
  );

  /* --- an old price is marked, not hidden --------------------------------- */

  const pads = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '34116794300' },
    select: { id: true },
  });
  const forPads = await whereToBuy(org.id, pads.id, { now });
  check('a price nobody has confirmed in a quarter is marked old', forPads?.pick.stale, true);
  check('and it is still there to buy from', forPads?.all.length, 1);

  /* --- saving is the confirmation ----------------------------------------- */

  const before = await prisma.supplierPart.findFirstOrThrow({
    where: { orgId: org.id, productId: pads.id },
    select: { id: true, supplierId: true, price: true, confirmedAt: true, leadTimeDays: true },
  });

  await recordOffer({
    orgId: org.id,
    userId: owner.id,
    supplierId: before.supplierId,
    productId: pads.id,
    price: Number(before.price),
    leadTimeDays: before.leadTimeDays,
    inStock: true,
    warrantyMonths: 24,
    supplierPartNumber: 'PMF-6613',
  });

  const after = await whereToBuy(org.id, pads.id, { now });
  check('saving the row is what makes it current again', after?.pick.stale, false);

  // Put the calendar back where the seed had it, or every later run of this
  // check would find a price that is mysteriously fresh.
  await prisma.supplierPart.update({
    where: { id: before.id },
    data: { confirmedAt: before.confirmedAt },
  });
  check(
    'and the probe leaves the date as it found it',
    (await prisma.supplierPart.findUniqueOrThrow({ where: { id: before.id } })).confirmedAt
      .toISOString()
      .slice(0, 10),
    before.confirmedAt.toISOString().slice(0, 10),
  );

  check('an old price is one nobody has confirmed in a quarter', PRICE_STALE_AFTER_DAYS, 90);

  /* --- what else would do -------------------------------------------------- */

  console.info('\n  What else would do');

  check('every kind of evidence has a sentence', EVIDENCE_ORDER.length, 6);
  check(
    'and not one of them is a number',
    EVIDENCE_ORDER.every((kind) => !/\d/.test(EVIDENCE_SENTENCE[kind])),
    true,
  );
  check('and nothing substitutes itself', needsConfirmation, true);

  // A car this workshop has worked on, so the history is allowed to be read.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, partLines: { some: { productId: discs.id } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      vehicleId: true,
      partLines: { where: { productId: discs.id }, select: { id: true, productId: true } },
    },
  });

  const found = await whatElseWouldDo(org.id, discs.id, { vehicleId: job.vehicleId });
  const aftermarket = found.candidates.find((one) => one.productId === marden.id);

  check('the aftermarket disc is offered', Boolean(aftermarket), true);
  check(
    'because a supplier lists both under one number, not because it fits the car',
    aftermarket?.strongest,
    'SAME_PART_NUMBER',
  );
  check(
    'and what else is known about it is shown beside that, not instead of it',
    aftermarket?.corroboration.includes('RECORDED_HERE'),
    true,
  );

  // The rule this feature turns on, and the one the first draft got wrong.
  // Pads and discs are both braking parts, both fit this car, and both have
  // fitment rows -- and a disc is not an alternative to a set of pads.
  const pads2 = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '34116794300' },
    select: { id: true },
  });
  const forPads2 = await whatElseWouldDo(org.id, pads2.id, { vehicleId: job.vehicleId });
  check(
    'a disc is not offered as an alternative to a set of pads',
    forPads2.candidates.some((one) => one.productId === marden.id),
    false,
  );
  check(
    'every candidate qualifies on a claim that two parts are the same thing',
    found.candidates.every((one) => QUALIFYING.includes(one.strongest)),
    true,
  );

  // The part itself is never in its own list.
  check(
    'a part is not its own equivalent',
    found.candidates.some((one) => one.productId === discs.id),
    false,
  );

  // Nothing with no evidence gets in.
  check(
    'nothing is listed that has no evidence at all',
    found.candidates.every((one) => one.evidence.length > 0),
    true,
  );

  /* --- the confirmation ---------------------------------------------------- */

  console.info('\n  Nothing swaps itself');

  const line = job.partLines[0]!;

  const oil = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: 'TOY-0W20-5L' },
    select: { id: true },
  });

  await refuses('a part nothing on record says would do is refused', 'NO_EVIDENCE', () =>
    confirmSubstitution({
      orgId: org.id,
      userId: owner.id,
      partLineId: line.id,
      productId: oil.id,
    }),
  );

  await refuses('and so is swapping a part for itself', 'SAME_PART', () =>
    confirmSubstitution({
      orgId: org.id,
      userId: owner.id,
      partLineId: line.id,
      productId: discs.id,
    }),
  );

  // The database refuses a half-written substitution, whatever the code does.
  //
  // The id written has to be a *different* part from the one on the line, or
  // `job_part_lines_substitution_is_a_different_part` trips first and this
  // check passes without ever exercising the constraint it names. Which it
  // did, on the first run.
  let halfWritten = false;
  try {
    await prisma.$executeRaw`
      UPDATE job_part_lines SET "substitutedForProductId" = ${marden.id}
      WHERE id = ${line.id}`;
    halfWritten = true;
  } catch (error) {
    check(
      'and it is that constraint refusing it, not another',
      String(error).includes('job_part_lines_substitution_is_confirmed'),
      true,
    );
  }
  check('a substitution with no confirmation is refused by the database', halfWritten, false);

  // And the other one, on its own terms.
  let ownEquivalent = false;
  try {
    await prisma.$executeRaw`
      UPDATE job_part_lines
         SET "substitutedForProductId" = "productId",
             "substitutionEvidence" = 'CATALOGUE',
             "substitutionConfirmedAt" = NOW()
       WHERE id = ${line.id}`;
    ownEquivalent = true;
  } catch {
    // job_part_lines_substitution_is_a_different_part refuses it.
  }
  check('and a part cannot be its own equivalent in the database either', ownEquivalent, false);

  // And the whole thing, properly.
  const evidence = await confirmSubstitution({
    orgId: org.id,
    userId: owner.id,
    partLineId: line.id,
    productId: marden.id,
  });

  check(
    'a confirmed substitution records the evidence it was made on',
    evidence,
    'SAME_PART_NUMBER',
  );

  const swapped = await prisma.jobPartLine.findUniqueOrThrow({
    where: { id: line.id },
    select: {
      productId: true,
      substitutedForProductId: true,
      substitutionEvidence: true,
      substitutionConfirmedByUserId: true,
      substitutionConfirmedAt: true,
    },
  });

  check('the line now carries the part that went on', swapped.productId, marden.id);
  check('and the one it went on instead of', swapped.substitutedForProductId, discs.id);
  check('and the person who said so', swapped.substitutionConfirmedByUserId, owner.id);
  check('and the moment they did', Boolean(swapped.substitutionConfirmedAt), true);

  /* --- put it back --------------------------------------------------------- */

  await prisma.jobPartLine.update({
    where: { id: line.id },
    data: {
      productId: line.productId,
      substitutedForProductId: null,
      substitutionEvidence: null,
      substitutionConfirmedByUserId: null,
      substitutionConfirmedAt: null,
    },
  });

  const back = await prisma.jobPartLine.findUniqueOrThrow({
    where: { id: line.id },
    select: { productId: true, substitutedForProductId: true },
  });
  check('the probe left the line as it found it', back.productId, line.productId);
  check('with nothing recorded against it', back.substitutedForProductId, null);

  console.info(
    failures === 0
      ? '\n  The cheapest is not the answer, and the confidence is the evidence.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
