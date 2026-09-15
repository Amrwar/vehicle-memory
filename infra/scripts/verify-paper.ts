/**
 * Paper, against a real database and a running server. Phase 42.
 *
 *   npx tsx infra/scripts/verify-paper.ts [baseUrl]
 *
 * Every printed document is read as the owner: the invoice, the quote, the
 * inspection report, the work order, the key tag, a sheet of part labels and
 * a counter receipt, each with its own words, without the workshop's
 * navigation, with a QR code where it has one, in French and in Arabic read
 * right to left. The invoice comes back as a real PDF named for the workshop
 * and the number. A technician reads the work order and not the invoice; a
 * customer reads their own invoice, as a page and as a PDF, and not another
 * customer's, nor a work order; nobody signed out reads anything; labels are
 * refused past the limit.
 *
 * Runs against the seeded organisations. Reads only; nothing to clean up
 * but the sessions it signs in with.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
const tokens: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function sessionFor(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokens.push(tokenHash);
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function get(path: string, cookie: string, extra = '') {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie: [cookie, extra].filter(Boolean).join('; ') },
    redirect: 'manual',
  });
  const type = response.headers.get('content-type') ?? '';
  const body = type.includes('pdf')
    ? Buffer.from(await response.arrayBuffer())
        .subarray(0, 5)
        .toString('latin1')
    : await response.text();
  return {
    status: response.status,
    type,
    body,
    disposition: response.headers.get('content-disposition') ?? '',
    location: response.headers.get('location') ?? '',
  };
}

async function main() {
  console.info(`\n  Paper\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
  });
  const technician = await prisma.user.findUniqueOrThrow({
    where: { email: 'john@hillsidemotors.test' },
  });
  const driver = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });

  const ownerCookie = await sessionFor(owner.id, org.id);
  const techCookie = await sessionFor(technician.id, org.id);
  const driverCookie = await sessionFor(driver.id, null);

  const hers = await prisma.invoice.findFirstOrThrow({
    where: { orgId: org.id, status: { not: 'DRAFT' }, customer: { portalUserId: driver.id } },
    select: { id: true, number: true },
  });
  const notHers = await prisma.invoice.findFirstOrThrow({
    where: {
      orgId: org.id,
      status: { not: 'DRAFT' },
      customer: { OR: [{ portalUserId: null }, { portalUserId: { not: driver.id } }] },
    },
    select: { id: true, number: true },
  });
  const estimate = await prisma.estimate.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, job: { select: { number: true } } },
  });
  const inspection = await prisma.inspection.findFirstOrThrow({
    where: { job: { orgId: org.id }, results: { some: {} } },
    select: { id: true, results: { take: 1, select: { itemName: true } } },
  });
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, vehicle: { registration: { not: null } } },
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      shortDescription: true,
      vehicle: { select: { registration: true } },
    },
  });
  const part = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, partNumber: true },
  });
  const sale = await prisma.counterSale.findFirst({
    where: { orgId: org.id },
    select: { id: true, reference: true },
  });

  /* --- as the owner ------------------------------------------------------- */

  console.info('\n  Each document\n');

  const invoice = await get(`/print/invoice/${hers.id}`, ownerCookie);
  check('the invoice prints', invoice.status, 200);
  check(
    'with its number and words, and no workshop navigation',
    [
      invoice.body.includes(hers.number),
      invoice.body.includes('>Invoice<'),
      invoice.body.includes('workshop-nav'),
    ],
    [true, true, false],
  );

  const quote = await get(`/print/estimate/${estimate.id}`, ownerCookie);
  check('the quote prints', [quote.status, quote.body.includes('>Quote<')], [200, true]);
  if (estimate.status === 'DRAFT') {
    check('a draft is stamped as one', quote.body.includes('print-watermark'), true);
  }

  const report = await get(`/print/inspection/${inspection.id}`, ownerCookie);
  check(
    'the inspection report prints, with what was checked',
    [
      report.status,
      report.body.includes('Inspection report'),
      report.body.includes(inspection.results[0]!.itemName),
    ],
    [200, true, true],
  );

  const order = await get(`/print/work-order/${job.id}`, ownerCookie);
  check(
    'the work order prints, with a QR code to the job',
    [order.status, order.body.includes('Work order'), order.body.includes('<svg')],
    [200, true, true],
  );

  const tag = await get(`/print/key-tag/${job.id}`, ownerCookie);
  check(
    'the key tag carries the plate',
    [tag.status, tag.body.includes(job.vehicle.registration!)],
    [200, true],
  );

  const labels = await get(`/print/labels/sheet?part=${part.id}&copies=3`, ownerCookie);
  check(
    'three labels for one part',
    [labels.status, (labels.body.match(/class="label-cell"/g) ?? []).length],
    [200, 3],
  );
  const tooMany = await get(
    `/print/labels/sheet?parts=${encodeURIComponent(Array.from({ length: 6 }, () => `${part.id}:100`).join(','))}`,
    ownerCookie,
  );
  check('six hundred labels are refused', tooMany.status, 404);

  if (sale) {
    const receipt = await get(`/print/counter-sale/${sale.id}`, ownerCookie);
    check(
      'a counter receipt prints',
      [receipt.status, receipt.body.includes(sale.reference)],
      [200, true],
    );
  }

  /* --- languages ---------------------------------------------------------- */

  console.info('\n  In other languages\n');

  const french = await get(`/print/invoice/${hers.id}`, ownerCookie, 'carnet_lang=fr');
  check('the invoice in French', french.body.includes('>Facture<'), true);
  const arabic = await get(`/print/work-order/${job.id}`, ownerCookie, 'carnet_lang=ar');
  check(
    'the work order in Arabic, right to left',
    [arabic.body.includes('dir="rtl"'), arabic.body.includes('أمر العمل')],
    [true, true],
  );

  /* --- the PDF ------------------------------------------------------------ */

  console.info('\n  As a PDF\n');

  const pdf = await get(`/api/print/invoice/${hers.id}`, ownerCookie);
  check(
    'a real PDF, named for the workshop and the number',
    [
      pdf.status,
      pdf.type,
      pdf.body,
      pdf.disposition.includes(`Hillside-Motors-invoice-${hers.number}.pdf`),
    ],
    [200, 'application/pdf', '%PDF-', true],
  );

  /* --- who may read what -------------------------------------------------- */

  console.info('\n  Who may read what\n');

  const theirs = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, technicians: { some: { userId: technician.id } } },
    select: { id: true },
  });
  const notTheirs = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, technicians: { none: { userId: technician.id } } },
    select: { id: true },
  });
  check(
    'a technician prints the work order for a job they are on',
    (await get(`/print/work-order/${theirs.id}`, techCookie)).status,
    200,
  );
  check(
    'not for a job they are not on',
    (await get(`/print/work-order/${notTheirs.id}`, techCookie)).status,
    404,
  );

  check('and not the invoice', (await get(`/print/invoice/${hers.id}`, techCookie)).status, 404);
  check('nor its PDF', (await get(`/api/print/invoice/${hers.id}`, techCookie)).status, 404);

  check(
    'a customer reads their own invoice',
    (await get(`/print/invoice/${hers.id}`, driverCookie)).status,
    200,
  );
  const theirPdf = await get(`/api/print/invoice/${hers.id}`, driverCookie);
  check('and takes it as a PDF', [theirPdf.status, theirPdf.body], [200, '%PDF-']);
  check(
    "not another customer's",
    (await get(`/print/invoice/${notHers.id}`, driverCookie)).status,
    404,
  );
  check('nor a work order', (await get(`/print/work-order/${job.id}`, driverCookie)).status, 404);

  const signedOut = await get(`/print/invoice/${hers.id}`, '');
  check(
    'nobody signed out reads anything',
    [signedOut.status, signedOut.location.includes('/login')],
    [307, true],
  );

  const other = await prisma.organization.findFirstOrThrow({
    where: { slug: 'kirkstall-autocentre' },
  });
  const theirMember = await prisma.membership.findFirst({
    where: { orgId: other.id },
    select: { userId: true },
  });
  if (theirMember) {
    const theirCookie = await sessionFor(theirMember.userId, other.id);
    check(
      "another workshop cannot print this one's invoice",
      (await get(`/print/invoice/${hers.id}`, theirCookie)).status,
      404,
    );
  }

  /* --- where the documents are reached from -------------------------------- */

  const invoicePage = await get(`/invoices/${hers.id}`, ownerCookie);
  check(
    'the invoice page links to its print and PDF',
    invoicePage.body.includes(`/print/invoice/${hers.id}`) &&
      invoicePage.body.includes(`/api/print/invoice/${hers.id}`),
    true,
  );
  const jobPage = await get(`/jobs/${job.id}`, ownerCookie);
  check(
    'the job page links to the work order and key tag',
    jobPage.body.includes(`/print/work-order/${job.id}`) &&
      jobPage.body.includes(`/print/key-tag/${job.id}`),
    true,
  );
  const partPage = await get(`/parts/${part.id}`, ownerCookie);
  check('the part page prints labels', partPage.body.includes('/print/labels/sheet'), true);

  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
