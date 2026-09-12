/**
 * The vehicle's paperwork, against a real database.
 *
 *   npx tsx infra/scripts/verify-documents.ts
 *
 * Phase 20 promises that a vehicle's documents belong to the car: a workshop
 * with access sees them, the owner sees them, and a stranger does not; that a
 * bad file or a missing title is refused with the reason; that removal keeps
 * the row and its reason and is only for the workshop that added it or the
 * owner; that the latest MOT and insurance decide the vehicle's cover and the
 * reminders page lists what is running out; and that a customer's preferred
 * technician is preselected when a job is opened for them.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { DocumentError, paperworkSummary } from '@carnet/core';
import { prisma } from '@carnet/db';

import { CustomerError, setPreferredTechnician } from '../../apps/web/src/lib/customers';
import {
  addDocument,
  documentsFor,
  mayHandleDocuments,
  paperworkDue,
  paperworkFor,
  removeDocument,
} from '../../apps/web/src/lib/documents';
import { jobFormOptions } from '../../apps/web/src/lib/jobs';

const TAG = 'verify-documents probe';

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

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  // A workshop that has never seen the car. The seed's second organisation
  // has access to every owned vehicle, so one is made for the run.
  await prisma.organization.deleteMany({ where: { slug: 'verify-documents-stranger' } });
  const kirkstall = await prisma.organization.create({
    data: { slug: 'verify-documents-stranger', name: 'Verify documents stranger' },
    select: { id: true },
  });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER', isActive: true } } },
    select: { id: true },
  });

  // A vehicle Hillside services whose current owner has a portal login.
  const owned = await prisma.vehicleOwnership.findFirstOrThrow({
    where: {
      endedAt: null,
      ownerUserId: { not: null },
      vehicle: { jobs: { some: { orgId: org.id } } },
    },
    select: { vehicleId: true, ownerUserId: true },
  });
  const vehicleId = owned.vehicleId;
  const ownerId = owned.ownerUserId!;

  const stranger = await prisma.user.findFirstOrThrow({
    where: {
      memberships: { none: { orgId: org.id } },
      ownedVehicles: { none: { vehicleId, endedAt: null } },
    },
    select: { id: true },
  });

  await forget(vehicleId);

  console.info('\nWho may handle the paperwork');

  const workshop = await mayHandleDocuments({ orgId: org.id, userId: staff.id, vehicleId });
  check('the servicing workshop may', workshop !== null, true);
  check('  as a workshop, not as the owner', workshop?.ownsVehicle, false);
  const owner = await mayHandleDocuments({ orgId: null, userId: ownerId, vehicleId });
  check('the owner may', owner?.ownsVehicle, true);
  check(
    'a stranger may not',
    await mayHandleDocuments({ orgId: null, userId: stranger.id, vehicleId }),
    null,
  );
  check(
    'nor a workshop with no access to the car',
    await mayHandleDocuments({ orgId: kirkstall.id, userId: stranger.id, vehicleId }),
    null,
  );

  console.info('\nAdding paperwork');

  const base = {
    vehicleId,
    fileKey: `${org.id}/vehicle-documents/${vehicleId}/probe.pdf`,
    filename: 'probe.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1234,
  };

  await refuses('a document with no title is refused', DocumentError, 'NO_TITLE', () =>
    addDocument({ actor: workshop!, ...base, kind: 'MOT_CERTIFICATE', title: ' ' }),
  );
  await refuses('a spreadsheet is refused', DocumentError, 'BAD_TYPE', () =>
    addDocument({ actor: workshop!, ...base, kind: 'OTHER', title: TAG, mimeType: 'text/csv' }),
  );
  await refuses('a PDF is not a photograph', DocumentError, 'BAD_TYPE', () =>
    addDocument({ actor: workshop!, ...base, kind: 'PHOTO', title: TAG }),
  );
  await refuses('an expiry before the issue is refused', DocumentError, 'BAD_DATES', () =>
    addDocument({
      actor: workshop!,
      ...base,
      kind: 'INSURANCE',
      title: TAG,
      issuedAt: days(0),
      expiresAt: days(-1),
    }),
  );

  const oldMot = await addDocument({
    actor: workshop!,
    ...base,
    kind: 'MOT_CERTIFICATE',
    title: `${TAG} MOT old`,
    expiresAt: days(-100),
  });
  const newMot = await addDocument({
    actor: workshop!,
    ...base,
    kind: 'MOT_CERTIFICATE',
    title: `${TAG} MOT`,
    expiresAt: days(20),
  });
  const insurance = await addDocument({
    actor: owner!,
    ...base,
    kind: 'INSURANCE',
    title: `${TAG} insurance`,
    reference: 'POL-1',
    expiresAt: days(200),
  });
  const photo = await addDocument({
    actor: owner!,
    ...base,
    kind: 'PHOTO',
    title: `${TAG} dent`,
    mimeType: 'image/jpeg',
    filename: 'dent.jpg',
  });

  const rows = await prisma.vehicleDocument.findMany({
    where: { id: { in: [oldMot, newMot, insurance, photo] } },
    select: { id: true, uploadedByOrgId: true, uploadedByUserId: true },
  });
  check(
    'the workshop’s documents name the workshop',
    rows.find((row) => row.id === newMot)?.uploadedByOrgId,
    org.id,
  );
  check(
    'the owner’s name nobody but the owner',
    rows.find((row) => row.id === insurance)?.uploadedByOrgId ?? null,
    null,
  );
  check('  and the owner', rows.find((row) => row.id === insurance)?.uploadedByUserId, ownerId);

  console.info('\nWhat each side sees');

  const asWorkshop = await documentsFor(vehicleId, workshop!);
  check(
    'the workshop sees all four',
    asWorkshop.filter((row) => row.title.startsWith(TAG)).length,
    4,
  );
  check(
    '  with a link to open each',
    asWorkshop.every((row) => row.url !== null),
    true,
  );
  check('  and may remove its own', asWorkshop.find((row) => row.id === newMot)?.mayRemove, true);
  check('  but not the owner’s', asWorkshop.find((row) => row.id === insurance)?.mayRemove, false);
  check(
    '  and knows who added what',
    asWorkshop.find((row) => row.id === insurance)?.addedBy,
    'The owner',
  );

  const asOwner = await documentsFor(vehicleId, owner!);
  check(
    'the owner sees the same four',
    asOwner.filter((row) => row.title.startsWith(TAG)).length,
    4,
  );
  check(
    '  and may remove any of them',
    asOwner.every((row) => row.mayRemove),
    true,
  );

  console.info('\nCover');

  const paperwork = await paperworkFor(vehicleId);
  check('the latest MOT decides the cover, not the old one', paperwork.mot, 'SOON');
  check('  and its date', paperwork.motExpiresAt?.toDateString(), days(20).toDateString());
  check('the insurance is fine', paperwork.insurance, 'OK');
  check('the sentence says so', /runs out on/.test(paperwork.statement), true);
  check(
    'the pure function agrees',
    paperworkSummary(
      await prisma.vehicleDocument.findMany({
        where: { vehicleId },
        select: { kind: true, expiresAt: true, removedAt: true },
      }),
    ).mot,
    'SOON',
  );

  const due = await paperworkDue(org.id, 45);
  const listed = due.filter((row) => row.vehicleId === vehicleId);
  check(
    'the reminders page lists the MOT running out',
    listed.map((row) => row.kind),
    ['MOT_CERTIFICATE'],
  );
  check('  once, the latest, not the expired one underneath', listed[0]?.documentId, newMot);
  check('  naming the customer', listed[0]?.customer !== null, true);

  console.info('\nRemoving');

  await refuses('a stranger workshop cannot remove', DocumentError, 'NOT_ALLOWED', () =>
    removeDocument({
      actor: { orgId: kirkstall.id, userId: stranger.id, ownsVehicle: false },
      documentId: newMot,
      reason: 'not mine',
    }),
  );
  await refuses('the workshop cannot remove the owner’s', DocumentError, 'NOT_ALLOWED', () =>
    removeDocument({ actor: workshop!, documentId: insurance, reason: 'tidy' }),
  );
  await refuses('and nothing goes without a reason', DocumentError, 'NO_REASON', () =>
    removeDocument({ actor: workshop!, documentId: oldMot, reason: ' ' }),
  );

  await removeDocument({
    actor: workshop!,
    documentId: oldMot,
    reason: 'Superseded; scanned twice',
  });
  const removed = await prisma.vehicleDocument.findUniqueOrThrow({
    where: { id: oldMot },
    select: { removedAt: true, removedReason: true },
  });
  check('removal keeps the row', removed.removedAt !== null, true);
  check('  with its reason', removed.removedReason, 'Superseded; scanned twice');
  check(
    'and the list no longer shows it',
    (await documentsFor(vehicleId, workshop!)).some((row) => row.id === oldMot),
    false,
  );
  await refuses('twice is refused', DocumentError, 'GONE', () =>
    removeDocument({ actor: workshop!, documentId: oldMot, reason: 'again' }),
  );

  await removeDocument({ actor: owner!, documentId: newMot, reason: 'Owner tidying' });
  check(
    'the owner may remove the workshop’s',
    (await prisma.vehicleDocument.findUniqueOrThrow({ where: { id: newMot } })).removedAt !== null,
    true,
  );

  const audited = await prisma.auditLog.count({
    where: {
      entityType: 'Vehicle',
      entityId: vehicleId,
      action: { startsWith: 'vehicle.document.' },
    },
  });
  check('every addition and removal is audited', audited >= 6, true);

  console.info('\nThe technician the customer asks for');

  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, isActive: true, jobs: { some: {} } },
    select: { id: true, preferredTechnicianUserId: true },
  });
  const technician = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'TECHNICIAN', isActive: true } } },
    select: { id: true },
  });

  await refuses(
    'somebody who is not a technician here is refused',
    CustomerError,
    'NOT_FOUND',
    () =>
      setPreferredTechnician({
        orgId: org.id,
        userId: staff.id,
        customerId: customer.id,
        technicianUserId: staff.id,
      }),
  );

  await setPreferredTechnician({
    orgId: org.id,
    userId: staff.id,
    customerId: customer.id,
    technicianUserId: technician.id,
  });
  const options = await jobFormOptions(org.id);
  check(
    'the new-job form carries the preference',
    options.customers.find((row) => row.id === customer.id)?.preferredTechnicianUserId,
    technician.id,
  );
  await setPreferredTechnician({
    orgId: org.id,
    userId: staff.id,
    customerId: customer.id,
    technicianUserId: customer.preferredTechnicianUserId,
  });

  await forget(vehicleId);

  console.info(
    failures === 0
      ? '\nverify-documents: all checks passed'
      : `\nverify-documents: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

async function forget(vehicleId: string) {
  await prisma.vehicleDocument.deleteMany({ where: { vehicleId, title: { startsWith: TAG } } });
  await prisma.organization.deleteMany({ where: { slug: 'verify-documents-stranger' } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
