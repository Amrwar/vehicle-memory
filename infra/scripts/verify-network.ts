/**
 * The network, and the API, against a real database.
 *
 *   npx tsx --tsconfig apps/web/tsconfig.json infra/scripts/verify-network.ts
 *
 * The promise of Phase 18 is one sentence: a vehicle serviced at one Carnet
 * workshop arrives at another and its history is there, with the first
 * workshop's commercial detail withheld. This script is that sentence as a
 * check. Kirkstall Autocentre services a car. Hillside Motors, which has never
 * seen it, finds it by its plate, is told history exists without being shown
 * it, takes the car on, reads the history with Kirkstall's job numbers gone,
 * opens a job and completes it, and the vehicle's one chain still verifies
 * end to end. Then the same through an API key, and nothing through a revoked
 * one.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design and stay as evidence. The
 * probe vehicle keeps its VIN across runs for the same reason, and the checks
 * are written relative to what a previous run left behind.
 */

import 'dotenv/config';

import { ApiKeyError, NetworkError, WITHHELD_KEYS } from '@carnet/core';
import { prisma } from '@carnet/db';

import { GET as getInvoices } from '../../apps/web/src/app/api/v1/invoices/route';
import { GET as getJobs } from '../../apps/web/src/app/api/v1/jobs/route';
import { GET as getVehicle } from '../../apps/web/src/app/api/v1/vehicles/[vin]/route';
import { apiKeysFor, createApiKey, revokeApiKey } from '../../apps/web/src/lib/api-keys';
import { createJob, vehicleOption } from '../../apps/web/src/lib/jobs';
import { moveJob } from '../../apps/web/src/lib/money';
import {
  adoptVehicle,
  findOnNetwork,
  networkHistory,
  networkStatementFor,
  registerVehicle,
} from '../../apps/web/src/lib/network';
import {
  orgCanReadVehicle,
  verifyVehicleChain,
  writeJobCompletion,
} from '../../apps/web/src/lib/passport';

const TAG = 'verify-network probe';
/** Fixed across runs: a vehicle with events cannot be deleted, so it is reused. */
const NETWORK_VIN = 'ZZPRBNET000000001';
const NETWORK_PLATE = 'PR08 NET';
/** Fresh each run: it never gets events, so it can be removed. */
const NEW_VIN = `ZZPRBNEW${String(Date.now()).slice(-9)}`;

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

async function refuses<E extends Error & { code: string }>(
  label: string,
  kind: new (...args: never[]) => E,
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
    check(label, 'allowed', `refused with ${code}`);
  } catch (error) {
    if (error instanceof kind) check(label, error.code, code);
    else throw error;
  }
}

function request(path: string, token?: string | null): Request {
  return new Request(`http://carnet.test${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function ownerOf(slug: string) {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER', isActive: true } } },
    select: { id: true },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, isActive: true },
    select: { id: true },
  });
  return { id: org.id, name: org.name, userId: user.id, customerId: customer.id };
}

/**
 * The other workshop. The seed gives Kirkstall Autocentre no staff and no
 * customers, so its side of the story is written the way a completed job
 * writes it, straight onto the passport, with the detail a job carries.
 */
async function serviceElsewhere(org: { id: string; name: string }, vehicleId: string) {
  const stamp = Date.now();
  await writeJobCompletion({
    jobId: `probe-${stamp}`,
    jobNumber: 9000 + (stamp % 1000),
    vehicleId,
    orgId: org.id,
    orgName: org.name,
    completedAt: new Date(),
    shortDescription: TAG,
    odometerKm: null,
    labour: [{ description: 'Probe labour', hours: 1 }],
    parts: [
      { id: `probe-part-${stamp}`, description: 'Probe filter', partNumber: 'PRB-1', quantity: 1 },
    ],
    inspection: {
      id: `probe-insp-${stamp}`,
      passCount: 3,
      advisoryCount: 1,
      criticalCount: 0,
      performedBy: 'Somebody at Kirkstall',
    },
  });
}

/** Opens and completes a job with one labour line, so the passport gets entries. */
async function serviceAt(org: Awaited<ReturnType<typeof ownerOf>>, vehicleId: string) {
  const job = await createJob({
    orgId: org.id,
    userId: org.userId,
    locationId: null,
    customerId: org.customerId,
    vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobLabourLine.create({
    data: { jobId: job.id, description: 'Probe labour', hours: 1, rate: 60 },
  });
  await moveJob({ orgId: org.id, userId: org.userId, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: org.userId, jobId: job.id, to: 'COMPLETED' });
  return job;
}

async function main() {
  const kirkstall = await prisma.organization.findFirstOrThrow({
    where: { slug: 'kirkstall-autocentre' },
    select: { id: true, name: true },
  });
  const hillside = await ownerOf('hillside-motors');

  await forget(kirkstall.id, hillside.id);

  console.info('\nA vehicle is serviced at one workshop');

  let vehicle = await prisma.vehicle.findUnique({
    where: { vin: NETWORK_VIN },
    select: { id: true },
  });

  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        vin: NETWORK_VIN,
        registration: NETWORK_PLATE,
        make: 'Probe',
        model: 'Network',
        year: 2020,
        accessGrants: { create: { orgId: kirkstall.id, scope: 'WRITE', reason: 'SERVICED' } },
      },
      select: { id: true },
    });
  }

  await serviceElsewhere(kirkstall, vehicle.id);
  const theirEvents = await prisma.vehicleEvent.count({
    where: { vehicleId: vehicle.id, recordedByOrgId: kirkstall.id },
  });
  check('Kirkstall has entries on the vehicle', theirEvents > 0, true);

  const ourEventsBefore = await prisma.vehicleEvent.count({
    where: { vehicleId: vehicle.id, recordedByOrgId: hillside.id },
  });

  console.info('\nA second workshop finds it by its plate');

  check('Hillside cannot read it yet', await orgCanReadVehicle(hillside.id, vehicle.id), false);
  check('and gets no history', await networkHistory(hillside.id, vehicle.id), null);

  const found = await findOnNetwork(hillside.id, NETWORK_PLATE.toLowerCase());
  check('the plate is recognised as a registration', found.kind, 'REGISTRATION');
  check('and the vehicle is found', found.vehicle?.id, vehicle.id);
  check('not yet on Hillside’s books', found.servicedHere, false);
  check('the summary counts Kirkstall’s entries', found.summary?.otherEntries, theirEvents);
  check('and names Kirkstall', found.summary?.otherWorkshops, [kirkstall.name]);
  check('and counts what Hillside recorded before', found.summary?.ownEntries, ourEventsBefore);
  check(
    'the statement says the detail is withheld',
    /commercial detail is withheld/.test(found.summary?.statement ?? ''),
    true,
  );

  const byVin = await findOnNetwork(hillside.id, NETWORK_VIN);
  check('the same car is found by VIN', byVin.vehicle?.id, vehicle.id);

  const missing = await findOnNetwork(hillside.id, 'ZZ99 ZZZ');
  check('a plate nobody has recorded finds nothing', missing.vehicle, null);
  check('and is offered as the start of a history', missing.kind, 'REGISTRATION');

  await refuses('a string that is neither plate nor VIN', NetworkError, 'BAD_IDENTIFIER', () =>
    findOnNetwork(hillside.id, '?!'),
  );

  // Two vehicles with the same plate: the plate is not enough.
  const twin = await prisma.vehicle.create({
    data: { vin: `ZZPRBTWN${String(Date.now()).slice(-9)}`, registration: NETWORK_PLATE },
    select: { id: true },
  });
  try {
    await refuses(
      'a plate that has been on two vehicles is refused with the VIN as the way in',
      NetworkError,
      'BAD_IDENTIFIER',
      () => findOnNetwork(hillside.id, NETWORK_PLATE),
    );
  } finally {
    await prisma.vehicle.delete({ where: { id: twin.id } });
  }

  console.info('\nTakes it on, and reads the history');

  await adoptVehicle({ orgId: hillside.id, userId: hillside.userId, vehicleId: vehicle.id });

  const grant = await prisma.vehicleAccessGrant.findUniqueOrThrow({
    where: { vehicleId_orgId: { vehicleId: vehicle.id, orgId: hillside.id } },
    select: { scope: true, reason: true, revokedAt: true },
  });
  check('a read grant, because the car is to be serviced', grant, {
    scope: 'READ',
    reason: 'SERVICED',
    revokedAt: null,
  });
  check('Hillside can read it now', await orgCanReadVehicle(hillside.id, vehicle.id), true);

  await refuses('taking it on twice', NetworkError, 'ALREADY_HERE', () =>
    adoptVehicle({ orgId: hillside.id, userId: hillside.userId, vehicleId: vehicle.id }),
  );

  const history = (await networkHistory(hillside.id, vehicle.id)) ?? [];
  check('the history is there', history.length >= theirEvents, true);

  const theirs = history.filter((event) => event.recordedByOrgId === kirkstall.id);
  const withheldLeaked = theirs.flatMap((event) =>
    WITHHELD_KEYS.filter((key) => event.payload && key in event.payload),
  );
  check('with Kirkstall’s job identifiers and staff withheld', withheldLeaked, []);
  check(
    'but nothing about the car withheld',
    theirs.some((event) => event.payload && 'totalHours' in event.payload),
    true,
  );
  check(
    'and every entry names who recorded it',
    theirs.every((event) => event.recordedByOrgName === kirkstall.name),
    true,
  );

  const audited = await prisma.auditLog.findFirst({
    where: { orgId: hillside.id, action: 'vehicle.adopted', entityId: vehicle.id },
    select: { id: true },
  });
  check('the adoption is audited', audited !== null, true);

  console.info('\nOpens a job and continues the chain');

  check(
    'the new-job form offers the car',
    (await vehicleOption(hillside.id, vehicle.id))?.id,
    vehicle.id,
  );

  const ourJob = await serviceAt(hillside, vehicle.id);

  const widened = await prisma.vehicleAccessGrant.findUniqueOrThrow({
    where: { vehicleId_orgId: { vehicleId: vehicle.id, orgId: hillside.id } },
    select: { scope: true },
  });
  check('opening the job widens the grant to write', widened.scope, 'WRITE');

  const ourEvents = await prisma.vehicleEvent.count({
    where: { vehicleId: vehicle.id, recordedByOrgId: hillside.id },
  });
  check('Hillside’s completion wrote to the same passport', ourEvents > ourEventsBefore, true);

  const chain = await verifyVehicleChain(vehicle.id);
  check('and the one chain still verifies end to end', chain.valid, true);

  const statement = await networkStatementFor(hillside.id, vehicle.id);
  check('the page’s sentence counts both sides', statement.ownEntries, ourEvents);
  check('  Kirkstall’s included', statement.otherEntries, theirEvents);

  const seenFromKirkstall = (await networkHistory(kirkstall.id, vehicle.id)) ?? [];
  const ourEntriesAsTheySeeThem = seenFromKirkstall.filter(
    (event) => event.recordedByOrgId === hillside.id,
  );
  check(
    'Kirkstall sees Hillside’s entries with Hillside’s job numbers withheld',
    ourEntriesAsTheySeeThem.flatMap((event) =>
      WITHHELD_KEYS.filter((key) => event.payload && key in event.payload),
    ),
    [],
  );
  check(
    'and its own entries with its own detail intact',
    seenFromKirkstall.some(
      (event) =>
        event.recordedByOrgId === kirkstall.id && event.payload && 'jobNumber' in event.payload,
    ),
    true,
  );

  console.info('\nA vehicle new to the network');

  await refuses('a VIN already on the network is refused', NetworkError, 'VIN_TAKEN', () =>
    registerVehicle({ orgId: hillside.id, userId: hillside.userId, vin: NETWORK_VIN }),
  );
  await refuses('a malformed VIN is refused', NetworkError, 'BAD_VIN', () =>
    registerVehicle({ orgId: hillside.id, userId: hillside.userId, vin: 'ABC' }),
  );
  await refuses('so is one with an I, O or Q in it', NetworkError, 'BAD_VIN', () =>
    registerVehicle({ orgId: hillside.id, userId: hillside.userId, vin: 'ZZPRBNEWI00000001' }),
  );

  const added = await registerVehicle({
    orgId: hillside.id,
    userId: hillside.userId,
    vin: NEW_VIN.toLowerCase(),
    registration: 'pr08new',
    make: 'Probe',
  });
  const addedRow = await prisma.vehicle.findUniqueOrThrow({
    where: { id: added.id },
    select: { vin: true, registration: true, vinValid: true },
  });
  check('the VIN is stored normalised', addedRow.vin, NEW_VIN);
  check('the plate is stored spaced', addedRow.registration, 'PR08 NEW');
  check('a failing check digit is a warning', added.warning !== null, true);
  check('  recorded on the vehicle', addedRow.vinValid, false);
  check(
    'the workshop can write to it at once',
    await orgCanReadVehicle(hillside.id, added.id),
    true,
  );

  const fresh = await findOnNetwork(hillside.id, NEW_VIN);
  check('finding it again says it is on the books here', fresh.servicedHere, true);
  check(
    'with a history that starts here',
    fresh.summary?.statement,
    'No history on this vehicle yet. What you record here starts it.',
  );

  console.info('\nThe API');

  const key = await createApiKey({ orgId: hillside.id, userId: hillside.userId, name: TAG });
  check('a token is minted with our prefix', key.token.startsWith('cn_'), true);
  check(
    'and listed by name, live',
    (await apiKeysFor(hillside.id)).some((row) => row.id === key.id && row.revokedAt === null),
    true,
  );

  const stored = await prisma.apiKey.findUniqueOrThrow({
    where: { id: key.id },
    select: { keyHash: true },
  });
  check('only a digest is stored', stored.keyHash === key.token, false);

  await refuses('no name, no key', ApiKeyError, 'NO_NAME', () =>
    createApiKey({ orgId: hillside.id, userId: hillside.userId, name: ' ' }),
  );

  const noAuth = await getJobs(request('/api/v1/jobs'));
  check('no header is 401', noAuth.status, 401);
  const wrongKey = await getJobs(request('/api/v1/jobs', 'cn_notoneofours'));
  check('an unknown key is 403', wrongKey.status, 403);

  const jobs = await getJobs(request('/api/v1/jobs', key.token));
  check('jobs are readable', jobs.status, 200);
  const jobsBody = (await jobs.json()) as {
    count: number;
    jobs: { id: string; vehicle: { vin: string } }[];
  };
  check(
    '  including the one just completed',
    jobsBody.jobs.some((row) => row.id === ourJob.id),
    true,
  );
  const hillsideJobIds = new Set(
    (await prisma.job.findMany({ where: { orgId: hillside.id }, select: { id: true } })).map(
      (row) => row.id,
    ),
  );
  check(
    '  and nothing but Hillside’s',
    jobsBody.jobs.every((row) => hillsideJobIds.has(row.id)),
    true,
  );
  check('  bounded', jobsBody.count <= 200, true);

  const invoices = await getInvoices(request('/api/v1/invoices?since=2020-01-01', key.token));
  check('invoices are readable', invoices.status, 200);
  const invoicesBody = (await invoices.json()) as { since: string; invoices: { total: string }[] };
  check(
    '  the window is capped at a year',
    new Date(invoicesBody.since).getFullYear() >= new Date().getFullYear() - 1,
    true,
  );
  check(
    '  amounts are strings',
    invoicesBody.invoices.every((row) => typeof row.total === 'string'),
    true,
  );

  const passport = await getVehicle(request(`/api/v1/vehicles/${NETWORK_VIN}`), {
    params: Promise.resolve({ vin: NETWORK_VIN }),
  });
  check('a passport without a key is 401', passport.status, 401);
  const passportOk = await getVehicle(request(`/api/v1/vehicles/${NETWORK_VIN}`, key.token), {
    params: Promise.resolve({ vin: NETWORK_VIN.toLowerCase() }),
  });
  check('the adopted vehicle is readable by VIN, whatever the case', passportOk.status, 200);
  const passportBody = (await passportOk.json()) as {
    history: { recordedElsewhere: number; otherWorkshops: string[] };
    events: { recordedHere: boolean; detail: Record<string, unknown> | null }[];
  };
  check('  it counts Kirkstall’s entries', passportBody.history.recordedElsewhere, theirEvents);
  check(
    '  and withholds their detail',
    passportBody.events
      .filter((event) => !event.recordedHere)
      .flatMap((event) => WITHHELD_KEYS.filter((key) => event.detail && key in event.detail)),
    [],
  );
  check(
    '  while keeping its own',
    passportBody.events.some(
      (event) => event.recordedHere && event.detail && 'jobNumber' in event.detail,
    ),
    true,
  );

  // A vehicle Hillside has no entitlement to: one only Kirkstall keeps.
  const theirsOnlyVin = `ZZPRBKRK${String(Date.now()).slice(-9)}`;
  const theirsOnly = await prisma.vehicle.create({
    data: {
      vin: theirsOnlyVin,
      accessGrants: { create: { orgId: kirkstall.id, scope: 'WRITE', reason: 'SERVICED' } },
    },
    select: { id: true },
  });
  try {
    const hidden = await getVehicle(request(`/api/v1/vehicles/${theirsOnlyVin}`, key.token), {
      params: Promise.resolve({ vin: theirsOnlyVin }),
    });
    check('a vehicle outside the entitlement is not found, not forbidden', hidden.status, 404);
  } finally {
    await prisma.vehicle.delete({ where: { id: theirsOnly.id } });
  }

  const used = await prisma.apiKey.findUniqueOrThrow({
    where: { id: key.id },
    select: { lastUsedAt: true },
  });
  check('use is recorded on the key', used.lastUsedAt !== null, true);

  await revokeApiKey({ orgId: hillside.id, userId: hillside.userId, keyId: key.id });
  const revoked = await getJobs(request('/api/v1/jobs', key.token));
  check('a revoked key reads nothing', revoked.status, 403);
  check('  and says why', ((await revoked.json()) as { error: string }).error, 'REVOKED');

  await forget(kirkstall.id, hillside.id);

  console.info(
    failures === 0 ? '\nverify-network: all checks passed' : `\nverify-network: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

/** Everything a run wrote that can be removed. */
async function forget(...orgIds: string[]) {
  const jobs = await prisma.job.findMany({
    where: { orgId: { in: orgIds }, shortDescription: TAG },
    select: { id: true, orgId: true },
  });
  const jobIds = jobs.map((job) => job.id);

  for (const job of jobs) {
    await prisma.journalEntry.deleteMany({
      where: { orgId: job.orgId, sourceType: 'Job', sourceId: job.id },
    });
  }
  await prisma.stockMovement.deleteMany({
    where: { referenceType: 'Job', referenceId: { in: jobIds } },
  });
  await prisma.stockReservation.deleteMany({ where: { jobPartLine: { jobId: { in: jobIds } } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId: { in: orgIds }, type: 'job.completed', processedAt: null },
  });
  await prisma.messageLog.deleteMany({
    where: { orgId: { in: orgIds }, relatedId: { in: jobIds } },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });

  await prisma.apiKey.deleteMany({ where: { orgId: { in: orgIds }, name: TAG } });

  const network = await prisma.vehicle.findUnique({
    where: { vin: NETWORK_VIN },
    select: { id: true },
  });
  if (network) {
    // Hillside must start the next run as a stranger to the car.
    const hillside = await prisma.organization.findFirst({
      where: { slug: 'hillside-motors' },
      select: { id: true },
    });
    if (hillside) {
      await prisma.vehicleAccessGrant.deleteMany({
        where: { vehicleId: network.id, orgId: hillside.id },
      });
    }
  }

  // Vehicles registered by a run never get events, so they can go.
  const stray = await prisma.vehicle.findMany({
    where: { vin: { startsWith: 'ZZPRB' }, NOT: { vin: NETWORK_VIN }, events: { none: {} } },
    select: { id: true },
  });
  await prisma.vehicle.deleteMany({ where: { id: { in: stray.map((row) => row.id) } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
