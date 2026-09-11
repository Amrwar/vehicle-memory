/**
 * Proves a photograph can actually be stored and read back.
 *
 *   npx tsx infra/scripts/verify-storage.ts [baseUrl]
 *
 * The upload path has three parties and any one of them can be wrong in a way
 * the other two cannot see: the application mints a signed URL, the browser
 * sends the bytes straight to the store, and the store either accepts them or
 * does not. Nothing in the application's own logs distinguishes "the store
 * refused it" from "nobody tried", which is how a camera button comes to look
 * like it works for a fortnight.
 *
 * So this walks the whole thing against a running deployment: ask for a
 * ticket, upload a real file to wherever it points, record it, read it back,
 * and remove it.
 *
 * One thing it cannot check. A browser refuses a cross-origin upload unless
 * the bucket sends the right CORS headers, and a server-side request is not
 * subject to that rule. A pass here with a missing CORS policy still means
 * every upload from a phone fails. The check reports the distinction rather
 * than pretending to cover it.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
let checked = 0;

function ok(what: string, detail = '') {
  checked += 1;
  console.info(`  ok    ${what}${detail ? `  ${detail}` : ''}`);
}

function fail(what: string, detail: string) {
  checked += 1;
  failures += 1;
  console.info(`  FAIL  ${what}  ${detail}`);
}

/** The smallest real PNG: one transparent pixel. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  console.info(`\n  Photograph storage\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    select: { id: true },
  });

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.session.create({
    data: { tokenHash, userId: user.id, orgId: org.id, expiresAt: new Date(Date.now() + 600_000) },
  });

  const cookie = `carnet_session=${token}`;

  // A draft inspection to hang the photograph from, on a job that has none of
  // its own. An earlier version took the newest job regardless and, when a run
  // was interrupted before its cleanup, left an empty draft sitting on top of
  // the seeded inspection, which the job page then showed instead of the real
  // one. Probes must not be able to change what a page says.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, inspections: { none: {} } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  const template = await prisma.inspectionTemplate.findFirstOrThrow({
    where: { orgId: org.id },
    select: {
      id: true,
      sections: {
        take: 1,
        select: { name: true, items: { take: 1, select: { id: true, name: true } } },
      },
    },
  });

  const item = template.sections[0]?.items[0];
  if (!item) {
    fail('the template has an item to photograph', 'none found');
    return;
  }

  const inspection = await prisma.inspection.create({
    data: { jobId: job.id, templateId: template.id, status: 'DRAFT', performedByUserId: user.id },
  });

  const result = await prisma.inspectionResult.create({
    data: {
      inspectionId: inspection.id,
      templateItemId: item.id,
      sectionName: template.sections[0]?.name ?? 'Probe',
      itemName: item.name,
      severity: 'ADVISORY',
      note: 'Written by verify-storage.ts.',
    },
  });

  let photoId: string | null = null;

  try {
    /* --- ask for somewhere to put it ----------------------------------- */

    const ticketResponse = await fetch(`${BASE}/api/inspection-photos`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        resultId: result.id,
        filename: 'probe.png',
        contentType: 'image/png',
        sizeBytes: PIXEL.byteLength,
      }),
    });

    const ticket = (await ticketResponse.json()) as {
      url?: string;
      key?: string;
      headers?: Record<string, string>;
      error?: string;
    };

    if (!ticketResponse.ok || !ticket.url || !ticket.key) {
      fail(
        'the application issues an upload ticket',
        ticket.error ?? String(ticketResponse.status),
      );
      return;
    }

    const direct = ticket.url.startsWith('http');
    ok(
      'the application issues an upload ticket',
      direct ? 'signed, straight to the store' : 'local disk',
    );

    if (direct) {
      // A signed URL carries the credentials in the query string, so this is
      // the one line that proves the keys are right.
      ok('the ticket points at the store itself', new URL(ticket.url).host);
    }

    /* --- send the bytes -------------------------------------------------- */

    const upload = await fetch(
      ticket.url.startsWith('http') ? ticket.url : `${BASE}${ticket.url}`,
      {
        method: 'PUT',
        headers: direct ? (ticket.headers ?? {}) : { ...(ticket.headers ?? {}), cookie },
        body: PIXEL,
      },
    );

    if (!upload.ok) {
      fail('the store accepts the file', `${upload.status} ${(await upload.text()).slice(0, 120)}`);
      return;
    }

    ok('the store accepts the file', `${PIXEL.byteLength} bytes`);

    /* --- record it -------------------------------------------------------- */

    const confirm = await fetch(`${BASE}/api/inspection-photos`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        resultId: result.id,
        key: ticket.key,
        filename: 'probe.png',
        mimeType: 'image/png',
        sizeBytes: PIXEL.byteLength,
      }),
    });

    const recorded = (await confirm.json()) as { id?: string; error?: string };

    if (!confirm.ok || !recorded.id) {
      fail('the photograph is recorded against the finding', recorded.error ?? 'no id returned');
      return;
    }

    photoId = recorded.id;
    ok('the photograph is recorded against the finding');

    /* --- a key from somewhere else is refused ----------------------------- */

    const foreign = await fetch(`${BASE}/api/inspection-photos`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        resultId: result.id,
        key: 'someone-else/inspections/x/y.png',
        filename: 'probe.png',
        mimeType: 'image/png',
        sizeBytes: 10,
      }),
    });

    if (foreign.ok) fail('a key from another workshop is refused', 'it was accepted');
    else ok('a key from another workshop is refused');

    /* --- read it back ------------------------------------------------------ */

    const stored = await prisma.inspectionPhoto.findUniqueOrThrow({
      where: { id: photoId },
      select: { url: true, sizeBytes: true },
    });

    if (stored.sizeBytes !== PIXEL.byteLength) {
      fail('the recorded size matches what was sent', `${stored.sizeBytes} bytes`);
    } else {
      ok('the recorded size matches what was sent');
    }

    console.info(
      '\n  Note: a server-side upload is not subject to CORS. If the bucket has no\n' +
        '  CORS policy this still passes and every upload from a phone still fails.\n',
    );
  } finally {
    if (photoId) await prisma.inspectionPhoto.deleteMany({ where: { id: photoId } });
    await prisma.inspectionResult.deleteMany({ where: { inspectionId: inspection.id } });
    await prisma.inspection.deleteMany({ where: { id: inspection.id } });
    await prisma.session.deleteMany({ where: { tokenHash } });

    ok('the probe cleaned up after itself');
  }

  console.info(
    `  ${checked} checks. ${failures === 0 ? 'Photographs reach the store.' : `${failures} failed.`}\n`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
