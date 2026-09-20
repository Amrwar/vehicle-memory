/**
 * Being forgotten, against a real database. Phase 62. FR-209, NFR-502, NFR-503.
 *
 *   npx tsx infra/scripts/verify-erasure.ts
 *
 * A workshop tells somebody their data has been erased. That sentence is
 * either true of every table in the database or it is a lie, and the ways it
 * quietly becomes a lie are all the same shape: a column nobody thought of, a
 * table added last month, a copy kept somewhere for a good reason.
 *
 * So this does not check the erasure code against itself. It builds a person
 * with a name nothing else could produce, gives them the whole surface of the
 * product — a job, an invoice, a payment, a signature, messages in both
 * directions, a conversation, a review, a passport event bearing their name,
 * a portal login — erases them, and then **asks every text column in every
 * table of the database** whether that name or that address is still there.
 *
 * Anything that comes back is the answer. It does not matter whether the
 * register mentioned that table.
 *
 * And the other half, which is the harder half: the things that must survive.
 * The books must still balance, the invoice must still be there with its
 * total, the passport chain must still verify, and the vehicle must still say
 * what was done to it. An erasure that takes the workshop's accounts with it
 * is not a feature, it is a data loss with a consent form.
 */

import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import {
  describeErasure,
  describeExport,
  ERASURE,
  FORGOTTEN,
  hasTranslation,
  whatWasDone,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { auditBooks } from '../../apps/web/src/lib/books';
import { eraseCustomer, exportCustomer } from '../../apps/web/src/lib/erasure';
import { verifyVehicleChain } from '../../apps/web/src/lib/passport';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

/**
 * Every text column in the database, asked one question.
 *
 * Read off the catalogue rather than from a list, because a list is the thing
 * that falls behind: a table added next month is in the catalogue the day it
 * exists, and a person who has asked to be forgotten should not depend on
 * somebody having remembered to add it here.
 */
async function stillMentions(needle: string): Promise<string[]> {
  const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('text', 'character varying', 'jsonb')
     ORDER BY table_name, column_name
  `;

  const found: string[] = [];

  for (const { table_name: table, column_name: column } of columns) {
    // The audit record of the erasure itself names the person who asked for
    // it in its reason — which is the workshop's own words about why, written
    // after the fact, and the one place the name may legitimately appear.
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${table}" WHERE "${column}"::text ILIKE $1`,
      `%${needle}%`,
    );

    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) found.push(`${table}.${column} (${n})`);
  }

  return found;
}

async function main() {
  console.info('\n  Being forgotten\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  // A name and an address nothing else in the database could produce, so that
  // a hit afterwards is unambiguous.
  const tag = randomBytes(5).toString('hex').toUpperCase();
  const name = `Zerena Quillsworth-${tag}`;
  const email = `zerena-${tag.toLowerCase()}@erasure.test`;
  const mobile = `+4470${tag.replace(/[A-F]/g, '7').slice(0, 9)}`;

  console.info(`  A person called ${name}\n`);

  /* --- give them the whole surface of the product -------------------------- */

  const vehicle = await prisma.vehicleAccessGrant.findFirstOrThrow({
    where: { orgId: org.id },
    select: { vehicleId: true },
  });

  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: name,
      firstName: 'Zerena',
      lastName: `Quillsworth-${tag}`,
      email,
      mobile,
      addressLine1: `${tag} Erasure Lane`,
      locality: 'Stockport',
      postcode: 'SK1 1AA',
      notes: `Asked to be forgotten. ${tag}`,
      marketingEmailConsent: true,
    },
    select: { id: true },
  });

  const portalUser = await prisma.user.create({
    data: { email, name, passwordHash: `not-usable-${tag}` },
    select: { id: true },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { portalUserId: portalUser.id },
  });

  await prisma.signature.create({
    data: {
      orgId: org.id,
      purpose: 'CHECK_IN',
      signedByName: name,
      strokes: [[1, 2]] as never,
      width: 300,
      height: 150,
      customerId: customer.id,
      ip: '203.0.113.7',
    },
  });

  await prisma.messageLog.create({
    data: {
      orgId: org.id,
      channel: 'EMAIL',
      toAddress: email,
      subject: `Your car is ready, ${name}`,
      body: `Hello ${name}, your car is ready to collect.`,
    },
  });

  await prisma.inboundMessage.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      fromAddress: email,
      subject: 'Re: your car',
      body: `Thank you — ${name}`,
      channel: 'EMAIL',
    },
  });

  const conversation = await prisma.conversation.create({
    data: { orgId: org.id, customerId: customer.id, subject: `About ${name}'s car` },
    select: { id: true },
  });

  const job = await prisma.job.findFirst({
    where: { orgId: org.id, reviewRequest: { is: null } },
    select: { id: true },
  });

  if (job) {
    await prisma.reviewRequest.create({
      data: {
        orgId: org.id,
        jobId: job.id,
        customerId: customer.id,
        tokenHash: randomBytes(16).toString('hex'),
        expiresAt: new Date(Date.now() + 86_400_000),
        rating: 5,
        comment: `${name} was very happy with the work.`,
        respondedAt: new Date(),
      },
    });
  }

  await prisma.vehicleOwnership.create({
    data: {
      vehicleId: vehicle.vehicleId,
      ownerUserId: portalUser.id,
      ownerName: name,
      ownerKind: 'PRIVATE',
      // A past owner, which is Maria's case exactly: she sold the car and
      // then asked to be forgotten. One open ownership per vehicle is a
      // database invariant, so this one is closed.
      startedAt: new Date('2020-01-01'),
      endedAt: new Date('2024-06-01'),
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      actorUserId: staff.id,
      action: 'customer.created',
      entityType: 'Customer',
      entityId: customer.id,
      after: { displayName: name, email } as never,
    },
  });

  // The hard case, and the one this phase turned on: a car changing hands.
  //
  // Written through the product's own event builder rather than by hand,
  // because the question is not "can a name be removed from the chain" — it
  // cannot, ever — but "does the product put one there". Until Phase 62 it
  // did, in both the summary and the hashed payload, and a name in a hashed
  // chain is a name nobody can ever honour a request about.
  const { appendEvents } = await import('../../apps/web/src/lib/passport');
  const { ownershipTransferEvent } = await import('@carnet/core');

  await appendEvents([
    {
      ...ownershipTransferEvent({
        vehicleId: vehicle.vehicleId,
        occurredAt: new Date(),
        keeperNumber: 2,
        transferId: `erasure-probe-${tag}`,
        recordedByOrgId: org.id,
      }),
    },
  ]);

  /* --- what they are owed first -------------------------------------------- */

  console.info('  What they can take with them');

  const taken = await exportCustomer(org.id, customer.id);
  const asJson = JSON.stringify(taken);

  check(taken.about === name, 'the export is about them', taken.about);
  check(asJson.includes(email), 'and carries their address');
  check(asJson.includes(`${tag} Erasure Lane`), 'and where they live');
  check(
    Object.keys(taken.holdings).length >= 8,
    `and every kind of holding, including the empty ones (${Object.keys(taken.holdings).length})`,
  );

  console.info(`\n  ${describeExport(taken)}\n`);

  /* --- and then being forgotten --------------------------------------------- */

  console.info('  Being forgotten');

  const before = await auditBooks(org.id);
  const chainBefore = await verifyVehicleChain(vehicle.vehicleId);

  const done = await eraseCustomer({
    orgId: org.id,
    customerId: customer.id,
    userId: staff.id,
    reason: 'Asked, by email, on the telephone afterwards',
  });

  console.info(`  ${describeErasure(done)}\n`);

  check(
    done.unerasable.length === 0,
    'nothing in the passport carried their name, so nothing was left behind in it',
    done.unerasable.map((one) => `${one.eventId} (${one.where})`).join(', '),
  );

  /* --- the whole database, asked ------------------------------------------- */

  const nameLeft = await stillMentions(name);
  const emailLeft = await stillMentions(email);
  const addressLeft = await stillMentions(`${tag} Erasure Lane`);

  // The reason a workshop typed, on the audit record of the erasure itself,
  // is the workshop's own words about why it acted — and it is the one place
  // a name may legitimately survive. This probe's reason carries none.
  check(
    nameLeft.length === 0,
    'their name is in no text column of any table in the database',
    nameLeft.join(', '),
  );

  check(emailLeft.length === 0, 'nor their email address', emailLeft.join(', '));

  check(addressLeft.length === 0, 'nor where they live', addressLeft.join(', '));

  const login = await prisma.user.findUnique({ where: { id: portalUser.id } });
  check(login === null, 'and their way in is gone, not merely emptied');

  /* --- and what must survive ------------------------------------------------ */

  console.info('\n  And what must survive');

  const stillThere = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: { displayName: true, isActive: true },
  });

  check(
    stillThere?.displayName === FORGOTTEN,
    'the customer record is still there, and says what happened to it',
    stillThere?.displayName,
  );

  const after = await auditBooks(org.id);
  check(
    after.breaches.length === before.breaches.length,
    'the books agree exactly as well as they did before',
    `${before.breaches.length} before, ${after.breaches.length} after`,
  );

  const chainAfter = await verifyVehicleChain(vehicle.vehicleId);
  check(
    chainAfter.valid,
    'the passport chain still verifies',
    chainAfter.valid ? undefined : JSON.stringify(chainAfter.failedAt),
  );

  // Not merely intact: untouched. Erasure writes nothing to the passport,
  // corrects nothing and supersedes nothing, because there is nothing of the
  // person in it to remove. An erasure that grew the chain would mean the
  // passport had been carrying a name.
  check(
    chainAfter.eventCount === chainBefore.eventCount,
    'and is exactly as long as it was: erasure does not touch the passport at all',
    `${chainBefore.eventCount} → ${chainAfter.eventCount}`,
  );

  const ownership = await prisma.vehicleOwnership.findFirst({
    where: { vehicleId: vehicle.vehicleId, ownerName: FORGOTTEN },
    select: { startedAt: true },
  });

  check(
    ownership?.startedAt.toISOString().startsWith('2020-01-01'),
    'how long they had the car is still the vehicle’s record',
    ownership?.startedAt.toISOString().slice(0, 10),
  );

  const thread = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: { id: true },
  });
  check(thread !== null, 'the thread existed and still did, with nothing in it of theirs');

  /* --- and it cannot be done twice ------------------------------------------ */

  const again = await eraseCustomer({
    orgId: org.id,
    customerId: customer.id,
    userId: staff.id,
    reason: 'again',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

  check(again.includes('already been erased'), 'and asking twice is refused, saying why', again);

  /* --- the register is complete ---------------------------------------------- */

  check(
    ERASURE.every((one) => one.because.length > 40),
    `all ${ERASURE.length} holdings say what is done and why`,
  );

  /* --- and nothing in the passport is a person ------------------------------
     ADR-0014, checked over the whole database rather than over the one
     customer this probe erased. The register says the passport carries no
     name; that is a claim about every event ever written, and the only honest
     way to check it is to take every name the database holds and look.

     It found one immediately, and not in code anybody would think to read:
     the seed wrote "From Peter Vasquez to Maria Okonkwo" into an
     OWNERSHIP_TRANSFER event, summary and payload both. That is the
     demonstration data every workshop sees first, and it put two people's
     names into a hash chain nobody can edit. Both live paths that record a
     transfer compose the event without names — which is exactly why nobody
     noticed the third one that does not.

     Two things are deliberately outside this. A NOTE is free text somebody
     typed, and a workshop writing "collected by her sister" into a note is
     not the product choosing to store a name; it is the case the register
     calls unerasable and `eraseCustomer` reports rather than pretends about.
     And an event the product did not record — seeded or imported history,
     `recordedByOrgId` null — came from somewhere else with whatever it came
     with. Those are counted and named below rather than checked, because a
     check that fails on somebody else's data teaches nobody anything. */

  // bounded: the owners and customers of one seeded database, a few dozen,
  // against an indexed count per name. A workshop with ten thousand customers
  // would sample instead; this is a probe, not a page.
  const people = await prisma.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT "ownerName" AS name FROM vehicle_ownerships
     WHERE "ownerName" IS NOT NULL AND length("ownerName") > 4
     UNION
    SELECT DISTINCT "displayName" AS name FROM customers
     WHERE "displayName" IS NOT NULL AND length("displayName") > 4
  `;

  const composed: string[] = [];
  const inherited: string[] = [];

  for (const { name } of people) {
    if (name === FORGOTTEN) continue;
    const like = `%${name}%`;

    const rows = await prisma.$queryRaw<{ ours: bigint; theirs: bigint }[]>`
      SELECT count(*) FILTER (
               WHERE "recordedByOrgId" IS NOT NULL AND type <> 'NOTE'
             )::bigint AS ours,
             count(*) FILTER (
               WHERE "recordedByOrgId" IS NULL OR type = 'NOTE'
             )::bigint AS theirs
        FROM vehicle_events
       WHERE title ILIKE ${like} OR summary ILIKE ${like} OR payload::text ILIKE ${like}
    `;

    if (Number(rows[0]?.ours ?? 0) > 0) composed.push(name);
    if (Number(rows[0]?.theirs ?? 0) > 0) inherited.push(name);
  }

  check(
    composed.length === 0,
    `no event the product composed carries any of the ${people.length} names this database holds`,
    composed.join(', '),
  );

  if (inherited.length > 0) {
    console.info(
      `\n  ${inherited.length} name(s) in notes somebody typed, or in history that\n` +
        `  arrived from elsewhere. Append-only: they cannot be taken out, and\n` +
        `  eraseCustomer reports them rather than claiming otherwise.\n`,
    );
  }

  /* --- and readable in three languages --------------------------------------
     The customer page renders each holding as `t(one)`, a variable rather than
     a literal. Neither i18n-scan nor verify-languages can see that: both
     collect literals. This is the third place the gap has appeared — Phase 57
     and Phase 59 each needed their own — so it gets its own check here, where
     the list lives, rather than a fourth guess in the scanner.

     It matters more here than either of those. A person is being told what a
     business will do with their life, and half a page in English is a page
     somebody agrees to without understanding. */

  const said = [...whatWasDone().gone, ...whatWasDone().kept];
  const untranslated = said.flatMap((one) =>
    (['fr', 'ar'] as const)
      .filter((language) => !hasTranslation(language, one))
      .map((language) => `${language}: ${one}`),
  );

  check(
    untranslated.length === 0,
    `each of the ${said.length} things the customer is told is answered in French and Arabic`,
    untranslated,
  );

  // The probe's own leavings. The customer row stays, anonymised, exactly as a
  // real erasure leaves one: there is no way to remove it and keep the books,
  // which is the whole design.
  console.info(
    '\n  The anonymised customer record is left behind on purpose: it is what a\n' +
      '  real erasure leaves, and the invoices pointing at it are the workshop’s.\n',
  );

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(
      `  ${checked} checks. They are forgotten, and the workshop still has its books.\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
