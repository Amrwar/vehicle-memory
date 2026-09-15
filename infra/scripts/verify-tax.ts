/**
 * Tax, configurable, against a real database. Phase 41.
 *
 *   npx tsx infra/scripts/verify-tax.ts [baseUrl]
 *
 * A rate of two taxes is saved, refused when it is not one a return could be
 * filed from, and set as a site's own rate, so a new line there takes it. An
 * invoice priced at it declares each tax on its own; a credit note gives each
 * back in proportion. An exempt customer is refused without a certificate, by
 * the product and by the database, and pays no tax with the certificate on
 * the invoice. With prices entered with tax in, the invoice comes to the
 * price. A counter sale declares its taxes too. The report per tax moves by
 * exactly what these documents declared, and a rate on an invoice cannot have
 * its taxes changed. With a server on the base URL the report, the invoice,
 * the settings and the customer's page are read, and the report in French.
 *
 * Runs against the seeded organisation. Cleans up after itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { money } from '@carnet/core';
import { prisma } from '@carnet/db';

import { completeSale } from '../../apps/web/src/lib/counter';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, raiseCreditNote } from '../../apps/web/src/lib/money';
import { periodFor } from '../../apps/web/src/lib/reports';
import {
  defaultTaxRateId,
  saveTaxRateWithParts,
  setCustomerExemption,
  setPricesIncludeTax,
  setSiteTaxRate,
  TaxError,
  taxReportFor,
} from '../../apps/web/src/lib/tax';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify tax probe';

let failures = 0;

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

async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof TaxError ? error.code : `other: ${String(error).slice(0, 90)}`;
  }
}

async function main() {
  console.info(`\n  Tax, configurable\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, pricesIncludeTax: true, baseCurrency: true },
  });
  await forget(org.id);

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    select: { id: true },
  });
  const site = await prisma.location.findFirstOrThrow({
    where: { orgId: org.id, isActive: true },
    orderBy: { isDefault: 'desc' },
    select: { id: true, taxRateId: true },
  });
  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { number: 'asc' },
    select: { customerId: true, vehicleId: true },
  });
  const currency = org.baseCurrency;
  const period = periodFor('month');
  const before = await taxReportFor(org.id, period, currency);
  const taxOf = (report: typeof before, name: string) =>
    report.rows.filter((row) => row.name === name).reduce((total, row) => total + row.tax.minor, 0);

  /* --- a rate of two taxes -------------------------------------------- */

  console.info('\n  A rate of two taxes\n');

  check(
    'refused: a compound tax first',
    await refusal(() =>
      saveTaxRateWithParts({
        orgId: org.id,
        userId: owner.id,
        name: `${TAG} bad`,
        parts: [{ name: 'QST', ratePct: 9.975, compound: true }],
      }),
    ),
    null,
  );
  // The first tax is never compound, whatever the form says: it is taken as simple.
  await forgetRates(org.id);
  check(
    'refused: the same tax twice',
    await refusal(() =>
      saveTaxRateWithParts({
        orgId: org.id,
        userId: owner.id,
        name: `${TAG} twice`,
        parts: [
          { name: 'VPGST', ratePct: 5 },
          { name: 'vpgst', ratePct: 5 },
        ],
      }),
    ),
    'DUPLICATE',
  );
  check(
    'refused: a rate over 100%',
    await refusal(() =>
      saveTaxRateWithParts({
        orgId: org.id,
        userId: owner.id,
        name: `${TAG} huge`,
        parts: [{ name: 'VPGST', ratePct: 120 }],
      }),
    ),
    'BAD_RATE',
  );

  const rateId = await saveTaxRateWithParts({
    orgId: org.id,
    userId: owner.id,
    name: `${TAG} VPGST and VPPST`,
    parts: [
      { name: 'VPGST', ratePct: 5 },
      { name: 'VPPST', ratePct: 7 },
    ],
  });
  const saved = await prisma.taxRate.findUniqueOrThrow({
    where: { id: rateId },
    select: { rate: true, components: { orderBy: { sortOrder: 'asc' }, select: { name: true } } },
  });
  check(
    'saved with both taxes',
    saved.components.map((c) => c.name),
    ['VPGST', 'VPPST'],
  );
  check('its combined rate', Number(saved.rate), 12);

  await setSiteTaxRate({ orgId: org.id, userId: owner.id, locationId: site.id, taxRateId: rateId });
  check('a new line at the site takes its rate', await defaultTaxRateId(org.id, site.id), rateId);

  /* --- an invoice ------------------------------------------------------ */

  console.info('\n  An invoice declares each tax\n');

  const job = await jobWithLine(
    org.id,
    owner.id,
    seeded.customerId,
    seeded.vehicleId,
    site.id,
    rateId,
    100,
  );
  const invoiceId = await issueInvoice({ orgId: org.id, userId: owner.id, jobId: job });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { number: true, subtotal: true, taxTotal: true, total: true },
  });
  check(
    'net, tax and total',
    [Number(invoice.subtotal), Number(invoice.taxTotal), Number(invoice.total)],
    [100, 12, 112],
  );
  const declared = await prisma.taxEntry.findMany({
    where: { sourceType: 'INVOICE', sourceId: invoiceId },
    orderBy: { name: 'asc' },
    select: { name: true, net: true, tax: true },
  });
  check(
    'each tax declared on its own, on the whole net',
    declared.map((row) => [row.name, Number(row.net), Number(row.tax)]),
    [
      ['VPGST', 100, 5],
      ['VPPST', 100, 7],
    ],
  );

  let immutable = false;
  try {
    await prisma.taxEntry.updateMany({
      where: { sourceType: 'INVOICE', sourceId: invoiceId },
      data: { tax: 0 },
    });
  } catch {
    immutable = true;
  }
  check('what was declared cannot be rewritten', immutable, true);

  const noteId = await raiseCreditNote({
    orgId: org.id,
    userId: owner.id,
    invoiceId,
    amount: money(5600, currency),
    reason: TAG,
  });
  const credited = await prisma.taxEntry.findMany({
    where: { sourceType: 'CREDIT_NOTE', sourceId: noteId },
    orderBy: { name: 'asc' },
    select: { name: true, net: true, tax: true },
  });
  check(
    'a credit note for half gives back half of each',
    credited.map((row) => [row.name, Number(row.net), Number(row.tax)]),
    [
      ['VPGST', -50, -2.5],
      ['VPPST', -50, -3.5],
    ],
  );

  check(
    'a rate on an invoice keeps its taxes',
    await refusal(() =>
      saveTaxRateWithParts({
        orgId: org.id,
        userId: owner.id,
        taxRateId: rateId,
        name: `${TAG} VPGST and VPPST`,
        parts: [
          { name: 'VPGST', ratePct: 5 },
          { name: 'VPPST', ratePct: 8 },
        ],
      }),
    ),
    'BAD_RATE',
  );

  /* --- an exempt customer --------------------------------------------- */

  console.info('\n  An exempt customer\n');

  const exempt = await prisma.customer.create({
    data: { orgId: org.id, displayName: TAG, firstName: 'Verify', lastName: 'Exempt' },
    select: { id: true },
  });
  check(
    'refused without a certificate',
    await refusal(() =>
      setCustomerExemption({
        orgId: org.id,
        userId: owner.id,
        customerId: exempt.id,
        exempt: true,
      }),
    ),
    'NO_CERTIFICATE',
  );
  let constraint = false;
  try {
    await prisma.customer.update({ where: { id: exempt.id }, data: { taxExempt: true } });
  } catch {
    constraint = true;
  }
  check('and by the database', constraint, true);

  await setCustomerExemption({
    orgId: org.id,
    userId: owner.id,
    customerId: exempt.id,
    exempt: true,
    reference: 'EX-2026-4471',
  });
  const exemptJob = await jobWithLine(
    org.id,
    owner.id,
    exempt.id,
    seeded.vehicleId,
    site.id,
    rateId,
    100,
  );
  const exemptInvoiceId = await issueInvoice({ orgId: org.id, userId: owner.id, jobId: exemptJob });
  const exemptInvoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: exemptInvoiceId },
    select: { taxTotal: true, total: true, taxExemptReference: true },
  });
  check(
    'no tax, and the certificate on the invoice',
    [Number(exemptInvoice.taxTotal), Number(exemptInvoice.total), exemptInvoice.taxExemptReference],
    [0, 100, 'EX-2026-4471'],
  );
  check(
    'declared as exempt',
    (
      await prisma.taxEntry.findMany({
        where: { sourceType: 'INVOICE', sourceId: exemptInvoiceId },
        select: { name: true, tax: true },
      })
    ).map((row) => [row.name, Number(row.tax)]),
    [['Exempt', 0]],
  );

  /* --- prices with tax in --------------------------------------------- */

  console.info('\n  Prices with tax in\n');

  await setPricesIncludeTax({ orgId: org.id, userId: owner.id, value: true });
  const inclusiveJob = await jobWithLine(
    org.id,
    owner.id,
    seeded.customerId,
    seeded.vehicleId,
    site.id,
    rateId,
    112,
  );
  const inclusiveId = await issueInvoice({ orgId: org.id, userId: owner.id, jobId: inclusiveJob });
  const inclusive = await prisma.invoice.findUniqueOrThrow({
    where: { id: inclusiveId },
    select: { subtotal: true, taxTotal: true, total: true, pricesIncludeTax: true },
  });
  check(
    'the invoice comes to the price, tax taken out',
    [
      Number(inclusive.subtotal),
      Number(inclusive.taxTotal),
      Number(inclusive.total),
      inclusive.pricesIncludeTax,
    ],
    [100, 12, 112, true],
  );
  await setPricesIncludeTax({ orgId: org.id, userId: owner.id, value: org.pricesIncludeTax });

  /* --- the counter ------------------------------------------------------ */

  console.info('\n  The counter\n');

  const sale = await completeSale({
    orgId: org.id,
    locationId: site.id,
    userId: owner.id,
    lines: [{ productId: null, kind: 'FEE', description: TAG, quantity: 1, unitPrice: 10 }],
    tenders: [{ kind: 'CASH', amount: money(2000, currency) }],
  });
  check('the sale is taken at the site rate', sale.ok, true);
  const saleEntries = sale.ok
    ? await prisma.taxEntry.findMany({
        where: { sourceType: 'COUNTER_SALE', sourceId: sale.saleId },
        orderBy: { name: 'asc' },
        select: { name: true, tax: true },
      })
    : [];
  check(
    'and declares each tax',
    saleEntries.map((row) => [row.name, Number(row.tax)]),
    [
      ['VPGST', 0.5],
      ['VPPST', 0.7],
    ],
  );

  /* --- the report -------------------------------------------------------- */

  console.info('\n  The report per tax\n');

  const after = await taxReportFor(org.id, period, currency);
  check(
    'VPGST moved by what was declared',
    taxOf(after, 'VPGST') - taxOf(before, 'VPGST'),
    500 - 250 + 500 + 50,
  );
  check(
    'VPPST moved by what was declared',
    taxOf(after, 'VPPST') - taxOf(before, 'VPPST'),
    700 - 350 + 700 + 70,
  );

  /* --- the screens ------------------------------------------------------- */

  const cookie = await sessionFor(owner.id, org.id);
  try {
    const read = async (path: string, extra = '') =>
      (
        await fetch(`${BASE}${path}`, {
          headers: { cookie: [cookie, extra].filter(Boolean).join('; ') },
          redirect: 'manual',
        })
      ).text();

    const report = await read('/reports/tax?range=month');
    check(
      'the report lists each tax',
      report.includes('Each tax') && report.includes('VPPST'),
      true,
    );
    const french = await read('/reports/tax?range=month', 'carnet_lang=fr');
    check('in French', french.includes('Taxe due'), true);
    const page = await read(`/invoices/${invoiceId}`);
    check('the invoice shows each tax', page.includes('VPGST at 5% on'), true);
    const exemptPage = await read(`/invoices/${exemptInvoiceId}`);
    check('and the certificate', exemptPage.includes('EX-2026-4471'), true);
    check(
      'the rate form takes several taxes',
      (await read('/settings/catalogue')).includes('on top'),
      true,
    );
    check(
      'the pricing choice',
      (await read('/settings/organisation')).includes('How prices are entered'),
      true,
    );
    check('the site rate', (await read('/settings/site')).includes('Tax at this site'), true);
    check(
      'the exemption',
      (await read(`/customers/${exempt.id}`)).includes('Exempt from tax'),
      true,
    );
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   the screens: no server at ${BASE} (${String(error)})`);
  }

  await setSiteTaxRate({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    taxRateId: site.taxRateId,
  });
  await forget(org.id);
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function jobWithLine(
  orgId: string,
  userId: string,
  customerId: string,
  vehicleId: string,
  locationId: string,
  taxRateId: string,
  amount: number,
): Promise<string> {
  const job = await createJob({
    orgId,
    userId,
    locationId,
    customerId,
    vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobFeeLine.create({
    data: { jobId: job.id, description: TAG, amount, taxRateId, sortOrder: 0 },
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  return job.id;
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function forgetRates(orgId: string) {
  await prisma.location.updateMany({
    where: { orgId, taxRate: { name: { startsWith: TAG } } },
    data: { taxRateId: null },
  });
  const rates = await prisma.taxRate.findMany({
    where: { orgId, name: { startsWith: TAG } },
    select: { id: true },
  });
  await prisma.invoiceLine.updateMany({
    where: { taxRateId: { in: rates.map((r) => r.id) } },
    data: { taxRateId: null },
  });
  await prisma.taxRate.deleteMany({ where: { id: { in: rates.map((r) => r.id) } } });
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const notes = await prisma.creditNote.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const sales = await prisma.counterSale.findMany({
    where: { orgId, lines: { some: { description: TAG } } },
    select: { id: true },
  });
  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...notes.map((n) => ({ sourceType: 'CreditNote', sourceId: n.id })),
    ...sales.map((s) => ({ sourceType: 'CounterSale', sourceId: s.id })),
  ];
  for (const source of sources) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }
  await prisma.taxEntry.deleteMany({
    where: {
      sourceId: { in: [...invoiceIds, ...notes.map((n) => n.id), ...sales.map((s) => s.id)] },
    },
  });
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedId: { in: [...invoiceIds, ...notes.map((n) => n.id)] } },
  });
  await prisma.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.counterSale.deleteMany({ where: { id: { in: sales.map((s) => s.id) } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId, type: { in: ['invoice.issued'] }, processedAt: null },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.customer.deleteMany({ where: { orgId, displayName: TAG } });
  await forgetRates(orgId);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
