import {
  ACCOUNT,
  type CleanRow,
  datasetSpec,
  type DatasetSpec,
  type JournalLineDraft,
  type Mapping,
  money,
  openingImbalance,
  parseCsv,
  suggestMapping,
  validateRows,
  type ValidationResult,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts, postEntry } from './accounting';
import { createProduct } from './catalogue';
import { createCustomer } from './customers';
import { audit } from './guard';
import { adjustStock } from './inventory';
import { adoptVehicle, NetworkError, registerVehicle } from './network';
import { appendEvents, recordOdometer } from './passport';
import { createSupplier } from './suppliers';

/**
 * Data in. Phase 33.
 *
 * A file arrives and is kept as it came: headers and rows. A mapping is
 * suggested from the headers and edited by a person; a preview runs every
 * row through the dataset's rules and names each problem by row and field;
 * the import then writes what passed, one row at a time through the same
 * functions the pages use, so an imported customer is exactly a customer,
 * and records what did not go in and why. Nothing is written until the
 * import step, and a batch is never imported twice.
 */

export const MAX_ROWS = 20_000;

export class ImportError extends Error {
  readonly code: 'EMPTY' | 'TOO_BIG' | 'NO_DATASET' | 'NOT_READY' | 'DONE';

  constructor(code: ImportError['code'], message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

export interface ImportReport {
  imported: number;
  /** Rows that failed the rules before anything was written. */
  invalid: number;
  /** Rows that passed the rules and were refused at the point of writing. */
  failed: { row: number; message: string }[];
  notes: string[];
}

export async function uploadImport(input: {
  orgId: string;
  userId: string;
  dataset: string;
  fileName: string;
  text: string;
}): Promise<string> {
  const spec = datasetSpec(input.dataset);
  if (!spec) throw new ImportError('NO_DATASET', 'That is not something that can be imported.');
  const parsed = parseCsv(input.text);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    throw new ImportError('EMPTY', 'The file has no rows under its header line.');
  }
  if (parsed.rows.length > MAX_ROWS) {
    throw new ImportError(
      'TOO_BIG',
      `That is ${parsed.rows.length.toLocaleString('en-GB')} rows; split the file at ${MAX_ROWS.toLocaleString('en-GB')}.`,
    );
  }
  const batch = await prisma.importBatch.create({
    data: {
      orgId: input.orgId,
      dataset: spec.id,
      fileName: input.fileName || `${spec.id}.csv`,
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      rows: parsed.rows,
      rowCount: parsed.rows.length,
      mapping: suggestMapping(spec, parsed.headers),
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'import.uploaded',
    entityType: 'ImportBatch',
    entityId: batch.id,
    after: { dataset: spec.id, rows: parsed.rows.length },
  });
  return batch.id;
}

export async function importsFor(orgId: string) {
  return prisma.importBatch.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      dataset: true,
      fileName: true,
      rowCount: true,
      status: true,
      report: true,
      createdAt: true,
      importedAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

export async function importDetail(orgId: string, batchId: string) {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, orgId } });
  if (!batch) return null;
  const spec = datasetSpec(batch.dataset)!;
  const headers = batch.headers as string[];
  const rows = batch.rows as string[][];
  const mapping = (batch.mapping as Mapping | null) ?? {};
  const validation = validateRows(spec, headers, rows, mapping);
  return {
    ...batch,
    spec,
    headers,
    rows,
    mapping,
    validation,
    report: (batch.report as ImportReport | null) ?? null,
    imbalance: spec.id === 'balances' ? openingImbalance(validation.rows) : 0,
  };
}

export async function saveMapping(input: {
  orgId: string;
  batchId: string;
  mapping: Mapping;
}): Promise<void> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: input.batchId, orgId: input.orgId },
    select: { status: true },
  });
  if (!batch) throw new ImportError('NO_DATASET', 'No such import.');
  if (batch.status === 'IMPORTED') throw new ImportError('DONE', 'That import has already run.');
  await prisma.importBatch.update({
    where: { id: input.batchId },
    data: { mapping: input.mapping, status: 'MAPPED' },
  });
}

/* ---------------------------------------------------------------------------
   Writing the rows
   --------------------------------------------------------------------------- */

const text = (v: CleanRow[string] | undefined): string | null => (typeof v === 'string' ? v : null);
const num = (v: CleanRow[string] | undefined): number | null => (typeof v === 'number' ? v : null);
const when = (v: CleanRow[string] | undefined): Date | null => (v instanceof Date ? v : null);

async function importCustomer(orgId: string, userId: string, v: CleanRow): Promise<string | null> {
  const company = text(v['companyName']);
  const last = text(v['lastName']);
  await createCustomer({
    orgId,
    userId,
    details: {
      kind: company && !last ? 'COMPANY' : 'INDIVIDUAL',
      firstName: text(v['firstName']),
      lastName: last,
      companyName: company,
      email: text(v['email']),
      mobile: text(v['mobile']),
      phone: text(v['phone']),
      addressLine1: text(v['addressLine1']),
      locality: text(v['locality']),
      postcode: text(v['postcode']),
      notes: text(v['notes']),
      sourceOfBusiness: 'Imported',
    },
  });
  return null;
}

async function importVehicle(
  orgId: string,
  userId: string,
  batchId: string,
  v: CleanRow,
): Promise<string | null> {
  const vin = text(v['vin'])!;
  let vehicleId: string;
  let note: string | null = null;
  try {
    const registered = await registerVehicle({
      orgId,
      userId,
      vin,
      registration: text(v['registration']),
      make: text(v['make']),
      model: text(v['model']),
      year: num(v['year']),
    });
    vehicleId = registered.id;
    note = registered.warning;
  } catch (error) {
    if (!(error instanceof NetworkError) || error.code !== 'VIN_TAKEN') throw error;
    const existing = await prisma.vehicle.findUniqueOrThrow({
      where: { vin },
      select: { id: true },
    });
    await adoptVehicle({ orgId, userId, vehicleId: existing.id });
    vehicleId = existing.id;
    note = 'already on the network; now on your books, with its history';
  }
  const lastServiceAt = when(v['lastServiceAt']);
  const odometerKm = num(v['odometerKm']);
  if (odometerKm !== null) {
    await recordOdometer({
      vehicleId,
      km: odometerKm,
      readAt: lastServiceAt ?? new Date(),
      source: 'WORKSHOP',
      orgId,
    });
  }
  if (lastServiceAt) {
    // Migrated history is marked as migrated, not verified: a record that
    // cannot tell the two apart is not worth trusting.
    await appendEvents([
      {
        vehicleId,
        type: 'IMPORT',
        occurredAt: lastServiceAt,
        title: 'Service recorded in a previous system',
        summary:
          'Migrated from the workshop’s previous records when it joined Carnet. Not verified.',
        payload: { source: 'import', batchId, odometerKm },
        odometerKm,
        recordedByOrgId: orgId,
        verification: 'WORKSHOP_RECORDED',
        idempotencyKey: `import:${batchId}:${vin}`,
      },
    ]);
  }
  return note;
}

async function importPart(
  orgId: string,
  userId: string,
  warehouseId: string | null,
  v: CleanRow,
): Promise<string | null> {
  const productId = await createProduct({
    orgId,
    userId,
    details: {
      partNumber: text(v['partNumber'])!,
      name: text(v['name'])!,
      brand: text(v['brand']),
      costPrice: num(v['costPrice']) ?? 0,
      sellPrice: num(v['sellPrice']) ?? 0,
      reorderPoint: num(v['reorderPoint']),
      barcode: text(v['barcode']),
      isStocked: true,
    },
  });
  const onHand = num(v['onHand']);
  if (onHand && onHand > 0) {
    if (!warehouseId) return 'no store to put the opening stock in; the part is in the catalogue';
    await adjustStock({
      orgId,
      productId,
      warehouseId,
      quantity: onHand,
      reason: 'Opening stock, imported',
    });
  }
  return null;
}

async function importSupplier(orgId: string, userId: string, v: CleanRow): Promise<string | null> {
  await createSupplier({
    orgId,
    userId,
    name: text(v['name'])!,
    accountRef: text(v['accountRef']) ?? undefined,
    email: text(v['email']) ?? undefined,
    phone: text(v['phone']) ?? undefined,
    addressLine1: text(v['addressLine1']) ?? undefined,
    locality: text(v['locality']) ?? undefined,
    postcode: text(v['postcode']) ?? undefined,
    paymentTermsDays: num(v['paymentTermsDays']) ?? 30,
  });
  return null;
}

/**
 * Opening balances go in as one balanced entry or not at all. Unknown
 * account codes are reported by row and nothing is posted until every
 * line has an account; the difference between the sides goes to retained
 * earnings, and the report says so.
 */
async function importBalances(
  orgId: string,
  batchId: string,
  rows: ValidationResult['rows'],
  report: ImportReport,
): Promise<void> {
  await ensureChartOfAccounts(orgId);
  const [accounts, org] = await Promise.all([
    prisma.account.findMany({ where: { orgId }, select: { code: true } }),
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { baseCurrency: true },
    }),
  ]);
  const known = new Set(accounts.map((a) => a.code));
  const currency = org.baseCurrency;
  const lines: JournalLineDraft[] = [];
  for (const { row, values } of rows) {
    const code = text(values['accountCode'])!;
    if (!known.has(code)) {
      report.failed.push({ row, message: `account ${code} is not in your chart of accounts` });
      continue;
    }
    const debit = Math.round((num(values['debit']) ?? 0) * 100);
    const credit = Math.round((num(values['credit']) ?? 0) * 100);
    lines.push({
      accountCode: code,
      debit: money(debit, currency),
      credit: money(credit, currency),
      memo: text(values['memo']) ?? 'Opening balance',
    });
  }
  if (report.failed.length > 0) {
    report.notes.push(
      'Nothing was posted: an opening entry goes in whole or not at all. Fix the account codes and import again.',
    );
    return;
  }
  if (lines.length === 0) return;
  const gap = Math.round(openingImbalance(rows) * 100);
  if (gap !== 0) {
    lines.push({
      accountCode: ACCOUNT.RETAINED,
      debit: money(gap < 0 ? -gap : 0, currency),
      credit: money(gap > 0 ? gap : 0, currency),
      memo: 'Opening balance difference, to retained earnings',
    });
    report.notes.push(
      `The sides differed by ${(Math.abs(gap) / 100).toFixed(2)} ${currency}; the difference was posted to retained earnings (${ACCOUNT.RETAINED}).`,
    );
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await postEntry(orgId, {
    reference: `OB-${stamp}`,
    description: 'Opening balances, imported',
    sourceType: 'ImportBatch',
    sourceId: batchId,
    postedAt: new Date(),
    lines,
  });
  report.imported = rows.length;
}

export async function runImport(input: {
  orgId: string;
  userId: string;
  batchId: string;
}): Promise<ImportReport> {
  const detail = await importDetail(input.orgId, input.batchId);
  if (!detail) throw new ImportError('NO_DATASET', 'No such import.');
  if (detail.status === 'IMPORTED') throw new ImportError('DONE', 'That import has already run.');
  if (detail.validation.missingRequired.length > 0) {
    throw new ImportError(
      'NOT_READY',
      `Map ${detail.validation.missingRequired.join(' and ')} first.`,
    );
  }
  const spec: DatasetSpec = detail.spec;
  const report: ImportReport = {
    imported: 0,
    invalid: detail.validation.problems.length,
    failed: [],
    notes: [],
  };

  if (spec.id === 'balances') {
    await importBalances(input.orgId, input.batchId, detail.validation.rows, report);
  } else {
    const warehouse =
      spec.id === 'parts'
        ? await prisma.warehouse.findFirst({
            where: { orgId: input.orgId },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
            select: { id: true },
          })
        : null;
    for (const { row, values } of detail.validation.rows) {
      try {
        const note =
          spec.id === 'customers'
            ? await importCustomer(input.orgId, input.userId, values)
            : spec.id === 'vehicles'
              ? await importVehicle(input.orgId, input.userId, input.batchId, values)
              : spec.id === 'parts'
                ? await importPart(input.orgId, input.userId, warehouse?.id ?? null, values)
                : await importSupplier(input.orgId, input.userId, values);
        report.imported += 1;
        if (note) report.notes.push(`Row ${row}: ${note}`);
      } catch (error) {
        report.failed.push({
          row,
          message: error instanceof Error ? error.message : 'could not be written',
        });
      }
    }
  }

  await prisma.importBatch.update({
    where: { id: input.batchId },
    data: {
      status: 'IMPORTED',
      importedAt: new Date(),
      report: JSON.parse(JSON.stringify(report)),
    },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'import.ran',
    entityType: 'ImportBatch',
    entityId: input.batchId,
    after: {
      dataset: spec.id,
      imported: report.imported,
      failed: report.failed.length,
      invalid: report.invalid,
    },
  });
  return report;
}
