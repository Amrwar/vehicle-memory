/**
 * Data in, data out, against a real database. Phase 33.
 *
 *   npx tsx infra/scripts/verify-import.ts [baseUrl]
 *
 * Five files from another system are uploaded, mapped from their own
 * headers, previewed with every problem named by row and field, and
 * imported through the same functions the pages use: a duplicate customer
 * is refused rather than doubled, a part gets its opening stock, a VIN
 * already on the network is adopted rather than re-registered, and an
 * opening balance goes in as one balanced entry with the difference to
 * retained earnings. Then every dataset is exported and read back. Cleans
 * up after itself.
 */

import 'dotenv/config';

import { trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { postedTotals } from '../../apps/web/src/lib/accounting';
import { exportDataset } from '../../apps/web/src/lib/exports';
import { importDetail, runImport, saveMapping, uploadImport } from '../../apps/web/src/lib/imports';

const STAMP = Date.now().toString(36).toUpperCase();
/** Emails are read lower-cased, so the addresses the probe looks for are too. */
const LOW = STAMP.toLowerCase();
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

/** Leftovers from an interrupted run, by the marks every probe row carries. */
async function forget(orgId: string) {
  const products = await prisma.product.findMany({
    where: { orgId, partNumber: { startsWith: 'PRB-' } },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);
  await prisma.stockMovement.deleteMany({ where: { orgId, productId: { in: productIds } } });
  await prisma.stockLevel.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.supplier.deleteMany({ where: { orgId, name: { startsWith: 'Probe Parts ' } } });
  await prisma.customer.deleteMany({ where: { orgId, email: { endsWith: '@probe.test' } } });
  const vehicles = await prisma.vehicle.findMany({
    where: { OR: [{ vin: { startsWith: 'PRB' } }, { vin: { startsWith: 'ELSE' } }] },
    select: { id: true },
  });
  const vehicleIds = vehicles.map((v) => v.id);
  await prisma.odometerReading.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  await prisma.vehicleAccessGrant.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  const batches = await prisma.importBatch.findMany({
    where: {
      orgId,
      fileName: {
        in: [
          'customers.csv',
          'again.csv',
          'suppliers.csv',
          'parts.csv',
          'vehicles.csv',
          'balances.csv',
          'balances-fixed.csv',
        ],
      },
    },
    select: { id: true },
  });
  for (const b of batches) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'ImportBatch', sourceId: b.id },
    });
  }
  await prisma.importBatch.deleteMany({ where: { id: { in: batches.map((b) => b.id) } } });
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER' },
    select: { userId: true },
  });
  await forget(org.id);

  // A car another workshop put on the network, which this one has never
  // touched: importing its VIN adopts it rather than registering it again.
  //
  // The I, O and Q come out, the way they do for the new VIN below. Base 36
  // includes all three, so this made a VIN the product rightly refuses on
  // roughly one day in three — and the probe then read the refusal as a fault
  // in the import. Nothing noticed for nine phases because nothing ran this.
  const existingVehicle = await prisma.vehicle.create({
    data: {
      vin: `ELSE${Date.now().toString(36).toUpperCase()}`
        .padEnd(17, 'Z')
        .slice(0, 17)
        .replace(/[IOQ]/g, 'Z'),
    },
    select: { id: true, vin: true },
  });
  const orgId = org.id;
  const userId = owner.userId;
  const made: {
    customers: string[];
    products: string[];
    suppliers: string[];
    vehicles: string[];
    batches: string[];
  } = {
    customers: [],
    products: [],
    suppliers: [],
    vehicles: [],
    batches: [],
  };

  try {
    console.info('\nCustomers, with their own headers');
    const customersCsv = [
      'Forename;Surname;Company;E-Mail;Cell;ZIP Code;Comments',
      `Priya;Nair;;priya-${LOW}@probe.test;07700 900111;M1 1AA;Regular`,
      `;;Probe Fleet ${STAMP};fleet-${LOW}@probe.test;;M2 2BB;`,
      `Priya;Nair;;priya-${LOW}@probe.test;;;a second time`,
      `;;;not-an-email;;;`,
    ].join('\n');
    const c = await uploadImport({
      orgId,
      userId,
      dataset: 'customers',
      fileName: 'customers.csv',
      text: customersCsv,
    });
    made.batches.push(c);
    const cDetail = (await importDetail(orgId, c))!;
    check(
      'a semicolon file is read and the headers mapped',
      [
        cDetail.delimiter,
        cDetail.mapping['0'],
        cDetail.mapping['3'],
        cDetail.mapping['4'],
        cDetail.mapping['5'],
      ],
      [';', 'firstName', 'email', 'mobile', 'postcode'],
    );
    check(
      'the preview names the problems by row and field',
      cDetail.validation.problems.map((p) => `${p.row} ${p.field}: ${p.message}`),
      ['4 Email: same as row 2', '5 Email: not an email address'],
    );
    await saveMapping({ orgId, batchId: c, mapping: cDetail.mapping });
    const cReport = await runImport({ orgId, userId, batchId: c });
    check(
      'two customers in, two rows left out by the rules',
      [cReport.imported, cReport.invalid, cReport.failed],
      [2, 2, []],
    );
    const priya = await prisma.customer.findFirst({
      where: { orgId, email: `priya-${LOW}@probe.test` },
    });
    const fleet = await prisma.customer.findFirst({
      where: { orgId, email: `fleet-${LOW}@probe.test` },
    });
    check(
      'a person and a company, as the row said',
      [priya?.kind, priya?.displayName, fleet?.kind],
      ['INDIVIDUAL', 'Priya Nair', 'COMPANY'],
    );
    made.customers.push(priya!.id, fleet!.id);
    check(
      'it cannot run twice',
      await runImport({ orgId, userId, batchId: c }).then(
        () => 'ran',
        (e: Error) => e.message,
      ),
      'That import has already run.',
    );

    console.info('\nThe same customer again is refused at the point of writing');
    const again = await uploadImport({
      orgId,
      userId,
      dataset: 'customers',
      fileName: 'again.csv',
      text: `First,Last,Email\nPriya,Nair,priya-${LOW}@probe.test`,
    });
    made.batches.push(again);
    const aReport = await runImport({ orgId, userId, batchId: again });
    check(
      'not doubled, and the report says why',
      [
        aReport.imported,
        aReport.failed.length,
        /already|duplicate|match/i.test(aReport.failed[0]?.message ?? ''),
      ],
      [0, 1, true],
    );

    console.info('\nSuppliers and parts with opening stock');
    const sup = await uploadImport({
      orgId,
      userId,
      dataset: 'suppliers',
      fileName: 'suppliers.csv',
      text: `Supplier,Account,Terms\nProbe Parts ${STAMP},PP-${STAMP},45\nProbe Parts ${STAMP},dup,30`,
    });
    made.batches.push(sup);
    const sReport = await runImport({ orgId, userId, batchId: sup });
    const supplier = await prisma.supplier.findFirst({
      where: { orgId, name: `Probe Parts ${STAMP}` },
    });
    check(
      'one supplier with its terms; the repeat left out by the file rule',
      [sReport.imported, sReport.invalid, supplier?.paymentTermsDays],
      [1, 1, 45],
    );
    made.suppliers.push(supplier!.id);
    const parts = await uploadImport({
      orgId,
      userId,
      dataset: 'parts',
      fileName: 'parts.csv',
      text: `SKU\tDescription\tCost\tPrice\tQty\nPRB-${STAMP}-1\tProbe filter\t3.50\t9.99\t12\nPRB-${STAMP}-2\tProbe bulb\t0.40\t2.50\t0\n\tNo number\t1\t2\t1`,
    });
    made.batches.push(parts);
    const pDetail = (await importDetail(orgId, parts))!;
    check('a tab file is read', pDetail.delimiter, '\t');
    const pReport = await runImport({ orgId, userId, batchId: parts });
    const filter = await prisma.product.findFirst({
      where: { orgId, partNumber: `PRB-${STAMP}-1` },
      include: { stockLevels: true },
    });
    const bulb = await prisma.product.findFirst({
      where: { orgId, partNumber: `PRB-${STAMP}-2` },
      include: { stockLevels: true },
    });
    check(
      'two parts in, the one with no number left out',
      [pReport.imported, pReport.invalid],
      [2, 1],
    );
    check(
      'opening stock landed at the store',
      [
        filter?.stockLevels.reduce((n, l) => n + Number(l.onHand), 0),
        bulb?.stockLevels.reduce((n, l) => n + Number(l.onHand), 0),
      ],
      [12, 0],
    );
    check('prices as given', [Number(filter?.costPrice), Number(filter?.sellPrice)], [3.5, 9.99]);
    made.products.push(filter!.id, bulb!.id);

    console.info('\nVehicles: a new VIN registered, a known VIN adopted, a bad VIN refused');
    const newVin = `PRB${STAMP}`.padEnd(17, 'X').slice(0, 17).replace(/[IOQ]/g, 'Z');
    const vehicles = await uploadImport({
      orgId,
      userId,
      dataset: 'vehicles',
      fileName: 'vehicles.csv',
      text: `VIN,Reg,Make,Model,Year,Mileage\n${newVin},PR21 OBE,Probe,Hatch,2021,41200\n${existingVehicle.vin},,,,,\nSHORTVIN,XX11 XXX,Probe,Van,2020,`,
    });
    made.batches.push(vehicles);
    const vDetail = (await importDetail(orgId, vehicles))!;
    check(
      'the bad VIN is caught in the preview',
      vDetail.validation.problems.map((p) => `${p.row} ${p.field}`),
      ['4 VIN'],
    );
    const vReport = await runImport({ orgId, userId, batchId: vehicles });
    const registered = await prisma.vehicle.findUnique({
      where: { vin: newVin },
      include: { accessGrants: { where: { orgId } } },
    });
    const adopted = await prisma.vehicle.findUnique({
      where: { vin: existingVehicle.vin },
      include: { accessGrants: { where: { orgId, revokedAt: null } } },
    });
    check(
      'two in: one registered with its odometer, one adopted',
      [
        vReport.imported,
        registered?.registration,
        registered?.lastOdometerKm,
        (adopted?.accessGrants.length ?? 0) > 0,
      ],
      [2, 'PR21 OBE', 41200, true],
    );
    check(
      'the adoption is said in the report',
      vReport.notes.some((n) => /already on the network/.test(n)),
      true,
    );
    made.vehicles.push(registered!.id);

    console.info('\nOpening balances, as one entry');
    const before = trialBalance(await postedTotals(orgId));
    check('the ledger balances before', before.balanced, true);
    const bal = await uploadImport({
      orgId,
      userId,
      dataset: 'balances',
      fileName: 'balances.csv',
      text: 'Nominal,Debit,Credit\n1000,2500.00,\n1200,800,\n2000,,1500\n9999,10,',
    });
    made.batches.push(bal);
    const bDetail = (await importDetail(orgId, bal))!;
    check('the imbalance is stated before anything is posted', bDetail.imbalance, 1810);
    const first = await runImport({ orgId, userId, batchId: bal });
    check(
      'an unknown account posts nothing and says which row',
      [
        first.imported,
        first.failed.map((f) => f.row),
        /Nothing was posted/.test(first.notes[0] ?? ''),
      ],
      [0, [5], true],
    );
    const bal2 = await uploadImport({
      orgId,
      userId,
      dataset: 'balances',
      fileName: 'balances-fixed.csv',
      text: 'Nominal,Debit,Credit\n1000,2500.00,\n1200,800,\n2000,,1500',
    });
    made.batches.push(bal2);
    const second = await runImport({ orgId, userId, batchId: bal2 });
    const entry = await prisma.journalEntry.findFirst({
      where: { orgId, sourceType: 'ImportBatch', sourceId: bal2 },
      include: { lines: { include: { account: true } } },
    });
    check(
      'three lines in and a fourth to retained earnings',
      [
        second.imported,
        entry?.lines.length,
        entry?.lines.find((l) => l.account.code === '3000')?.credit.toString(),
      ],
      [3, 4, '1800'],
    );
    check('the ledger still balances', trialBalance(await postedTotals(orgId)).balanced, true);

    console.info('\nData out');
    for (const id of [
      'customers',
      'vehicles',
      'jobs',
      'invoices',
      'payments',
      'parts',
      'suppliers',
      'ledger',
    ]) {
      const file = (await exportDataset(orgId, id))!;
      const lines = file.body.split('\n').filter(Boolean);
      check(
        `${id} exports as CSV with a header and rows`,
        [file.contentType.startsWith('text/csv'), lines.length > 1],
        [true, true],
      );
    }
    const customersOut = (await exportDataset(orgId, 'customers'))!.body;
    check(
      'the imported customer is in the export',
      customersOut.includes(`priya-${LOW}@probe.test`),
      true,
    );
    const passports = JSON.parse((await exportDataset(orgId, 'passports'))!.body) as {
      passports: { vehicle: { vin: string }; events: unknown[] }[];
    };
    check(
      'the passports go out in the network form, with their events',
      passports.passports.some((p) => p.vehicle.vin === newVin),
      true,
    );
    const everything = JSON.parse((await exportDataset(orgId, 'everything'))!.body) as Record<
      string,
      unknown[]
    >;
    check(
      'everything is one file with every dataset',
      Object.keys(everything)
        .filter((k) => k !== 'exportedAt')
        .sort(),
      [
        'customers',
        'invoices',
        'jobs',
        'ledger',
        'parts',
        'passports',
        'payments',
        'suppliers',
        'vehicles',
      ],
    );
    check(
      'nothing is exported for something that is not a dataset',
      await exportDataset(orgId, 'secrets'),
      null,
    );
  } finally {
    for (const id of made.batches) {
      await prisma.journalEntry.deleteMany({
        where: { orgId, sourceType: 'ImportBatch', sourceId: id },
      });
    }
    await prisma.stockMovement.deleteMany({
      where: { orgId, product: { id: { in: made.products } } },
    });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: made.products } } });
    await prisma.product.deleteMany({ where: { id: { in: made.products } } });
    await prisma.supplier.deleteMany({ where: { id: { in: made.suppliers } } });
    await prisma.customer.deleteMany({ where: { id: { in: made.customers } } });
    await prisma.odometerReading.deleteMany({ where: { vehicleId: { in: made.vehicles } } });
    await prisma.vehicleAccessGrant.deleteMany({ where: { vehicleId: { in: made.vehicles } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: made.vehicles } } });
    await prisma.vehicleAccessGrant.deleteMany({ where: { vehicleId: existingVehicle.id } });
    await prisma.vehicle.deleteMany({ where: { id: existingVehicle.id } });
    await prisma.importBatch.deleteMany({ where: { id: { in: made.batches } } });
    await forget(orgId);
  }

  console.info(
    failures === 0 ? '\nverify-import: every check passed' : `\nverify-import: ${failures} failing`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
