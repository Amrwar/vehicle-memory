import { type CsvColumn, csvFilename, summariseNetwork, toCsv } from '@carnet/core';
import { prisma } from '@carnet/db';

import { networkHistory } from './network';

/**
 * Data out. Phase 33.
 *
 * Every dataset a workshop owns, whole, as a CSV in the same shape the
 * import reads, so a workshop could leave and come back, or leave for
 * good, with everything. The passports go out as JSON in the form the
 * network already exchanges through the API, because that is the form
 * another system on the network would read.
 */

export const EXPORTS = [
  { id: 'customers', title: 'Customers', kind: 'csv' },
  { id: 'vehicles', title: 'Vehicles', kind: 'csv' },
  { id: 'jobs', title: 'Jobs', kind: 'csv' },
  { id: 'invoices', title: 'Invoices', kind: 'csv' },
  { id: 'payments', title: 'Payments', kind: 'csv' },
  { id: 'parts', title: 'Parts and stock', kind: 'csv' },
  { id: 'suppliers', title: 'Suppliers', kind: 'csv' },
  { id: 'ledger', title: 'Ledger', kind: 'csv' },
  { id: 'passports', title: 'Passports', kind: 'json' },
  { id: 'everything', title: 'Everything', kind: 'json' },
] as const;

export type ExportId = (typeof EXPORTS)[number]['id'];

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function customersOf(orgId: string) {
  return prisma.customer.findMany({
    where: { orgId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      displayName: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      mobile: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      region: true,
      postcode: true,
      country: true,
      notes: true,
      marketingEmailConsent: true,
      marketingSmsConsent: true,
      createdAt: true,
    },
  });
}

async function vehiclesOf(orgId: string) {
  return prisma.vehicle.findMany({
    where: {
      OR: [{ jobs: { some: { orgId } } }, { accessGrants: { some: { orgId, revokedAt: null } } }],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      vin: true,
      vinValid: true,
      registration: true,
      make: true,
      model: true,
      variant: true,
      year: true,
      colour: true,
      fuelType: true,
      lastOdometerKm: true,
      lastOdometerAt: true,
      eventCount: true,
      chainHead: true,
    },
  });
}

async function jobsOf(orgId: string) {
  return prisma.job.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      number: true,
      status: true,
      shortDescription: true,
      createdAt: true,
      completedAt: true,
      customer: { select: { displayName: true, email: true } },
      vehicle: { select: { vin: true, registration: true } },
    },
  });
}

async function invoicesOf(orgId: string) {
  return prisma.invoice.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      subtotal: true,
      taxTotal: true,
      total: true,
      amountPaid: true,
      issuedAt: true,
      dueAt: true,
      customer: { select: { displayName: true, email: true } },
      job: { select: { number: true } },
    },
  });
}

async function paymentsOf(orgId: string) {
  return prisma.payment.findMany({
    where: { orgId },
    orderBy: { receivedAt: 'asc' },
    select: {
      id: true,
      amount: true,
      method: true,
      reference: true,
      receivedAt: true,
      invoice: { select: { number: true, currency: true } },
      customer: { select: { displayName: true } },
    },
  });
}

async function partsOf(orgId: string) {
  return prisma.product.findMany({
    where: { orgId, isActive: true },
    orderBy: { partNumber: 'asc' },
    select: {
      id: true,
      partNumber: true,
      name: true,
      brand: true,
      unit: true,
      costPrice: true,
      sellPrice: true,
      reorderPoint: true,
      reorderQty: true,
      barcode: true,
      isStocked: true,
      stockLevels: { select: { onHand: true, warehouse: { select: { name: true } } } },
    },
  });
}

async function suppliersOf(orgId: string) {
  return prisma.supplier.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      accountRef: true,
      email: true,
      phone: true,
      addressLine1: true,
      locality: true,
      postcode: true,
      paymentTermsDays: true,
    },
  });
}

async function ledgerOf(orgId: string) {
  return prisma.journalLine.findMany({
    where: { entry: { orgId } },
    orderBy: [{ entry: { postedAt: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true,
      debit: true,
      credit: true,
      memo: true,
      account: { select: { code: true, name: true } },
      entry: {
        select: {
          reference: true,
          description: true,
          postedAt: true,
          sourceType: true,
          sourceId: true,
          isReversal: true,
        },
      },
    },
  });
}

async function passportsOf(orgId: string) {
  const vehicles = await vehiclesOf(orgId);
  const out = [];
  for (const vehicle of vehicles) {
    const history = await networkHistory(orgId, vehicle.id);
    if (!history) continue;
    const summary = summariseNetwork(history, orgId);
    out.push({
      vehicle: {
        vin: vehicle.vin,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        lastOdometerKm: vehicle.lastOdometerKm,
        lastOdometerAt: vehicle.lastOdometerAt,
        entries: vehicle.eventCount,
        chainHead: vehicle.chainHead,
      },
      history: {
        recordedHere: summary.ownEntries,
        recordedElsewhere: summary.otherEntries,
        otherWorkshops: summary.otherWorkshops,
        statement: summary.statement,
      },
      events: history,
    });
  }
  return out;
}

interface Def {
  title: string;
  rows: (orgId: string) => Promise<unknown[]>;
  columns: CsvColumn<unknown>[];
}

/** A dataset's rows and columns, typed together so a column cannot name a field the rows lack. */
function def<T>(
  title: string,
  rows: (orgId: string) => Promise<T[]>,
  columns: CsvColumn<T>[],
): Def {
  return { title, rows, columns: columns as CsvColumn<unknown>[] };
}

const CSV: Record<string, Def> = {
  customers: def('Customers', customersOf, [
    { header: 'Kind', value: (r) => r.kind },
    { header: 'First name', value: (r) => r.firstName },
    { header: 'Last name', value: (r) => r.lastName },
    { header: 'Company', value: (r) => r.companyName },
    { header: 'Email', value: (r) => r.email },
    { header: 'Mobile', value: (r) => r.mobile, literal: true },
    { header: 'Phone', value: (r) => r.phone, literal: true },
    { header: 'Address', value: (r) => r.addressLine1 },
    { header: 'Address 2', value: (r) => r.addressLine2 },
    { header: 'Town', value: (r) => r.locality },
    { header: 'Region', value: (r) => r.region },
    { header: 'Postcode', value: (r) => r.postcode, literal: true },
    { header: 'Country', value: (r) => r.country },
    { header: 'Notes', value: (r) => r.notes },
    { header: 'Email consent', value: (r) => (r.marketingEmailConsent ? 'yes' : 'no') },
    { header: 'SMS consent', value: (r) => (r.marketingSmsConsent ? 'yes' : 'no') },
    { header: 'Created', value: (r) => r.createdAt },
  ]),
  vehicles: def('Vehicles', vehiclesOf, [
    {
      header: 'VIN',
      value: (r) => r.vin,
      literal: true,
    },
    { header: 'VIN check digit valid', value: (r) => (r.vinValid ? 'yes' : 'no') },
    { header: 'Registration', value: (r) => r.registration, literal: true },
    { header: 'Make', value: (r) => r.make },
    { header: 'Model', value: (r) => r.model },
    { header: 'Variant', value: (r) => r.variant },
    { header: 'Year', value: (r) => r.year },
    { header: 'Colour', value: (r) => r.colour },
    { header: 'Fuel', value: (r) => r.fuelType },
    { header: 'Odometer (km)', value: (r) => r.lastOdometerKm },
    { header: 'Odometer read', value: (r) => r.lastOdometerAt },
    { header: 'Passport entries', value: (r) => r.eventCount },
    { header: 'Chain head', value: (r) => r.chainHead, literal: true },
  ]),
  jobs: def('Jobs', jobsOf, [
    {
      header: 'Number',
      value: (r) => r.number,
      literal: true,
    },
    { header: 'Status', value: (r) => r.status },
    { header: 'Description', value: (r) => r.shortDescription },
    { header: 'Customer', value: (r) => r.customer.displayName },
    { header: 'Customer email', value: (r) => r.customer.email },
    { header: 'VIN', value: (r) => r.vehicle.vin, literal: true },
    { header: 'Registration', value: (r) => r.vehicle.registration, literal: true },
    { header: 'Created', value: (r) => r.createdAt },
    { header: 'Completed', value: (r) => r.completedAt },
  ]),
  invoices: def('Invoices', invoicesOf, [
    {
      header: 'Number',
      value: (r) => r.number,
      literal: true,
    },
    { header: 'Status', value: (r) => r.status },
    { header: 'Customer', value: (r) => r.customer.displayName },
    { header: 'Customer email', value: (r) => r.customer.email },
    { header: 'Job', value: (r) => r.job?.number ?? null, literal: true },
    { header: 'Currency', value: (r) => r.currency },
    { header: 'Subtotal', value: (r) => Number(r.subtotal) },
    { header: 'Tax', value: (r) => Number(r.taxTotal) },
    { header: 'Total', value: (r) => Number(r.total) },
    { header: 'Paid', value: (r) => Number(r.amountPaid) },
    { header: 'Issued', value: (r) => r.issuedAt },
    { header: 'Due', value: (r) => r.dueAt },
  ]),
  payments: def('Payments', paymentsOf, [
    {
      header: 'Received',
      value: (r) => r.receivedAt,
    },
    { header: 'Invoice', value: (r) => r.invoice?.number ?? null, literal: true },
    { header: 'Customer', value: (r) => r.customer.displayName },
    { header: 'Amount', value: (r) => Number(r.amount) },
    { header: 'Currency', value: (r) => r.invoice?.currency ?? null },
    { header: 'Method', value: (r) => r.method },
    { header: 'Reference', value: (r) => r.reference, literal: true },
  ]),
  parts: def('Parts and stock', partsOf, [
    {
      header: 'Part number',
      value: (r) => r.partNumber,
      literal: true,
    },
    { header: 'Name', value: (r) => r.name },
    { header: 'Brand', value: (r) => r.brand },
    { header: 'Unit', value: (r) => r.unit },
    { header: 'Cost price', value: (r) => Number(r.costPrice) },
    { header: 'Sell price', value: (r) => Number(r.sellPrice) },
    {
      header: 'Quantity on hand',
      value: (r) => r.stockLevels.reduce((n, l) => n + Number(l.onHand), 0),
    },
    { header: 'Reorder point', value: (r) => Number(r.reorderPoint) },
    { header: 'Reorder quantity', value: (r) => Number(r.reorderQty) },
    { header: 'Barcode', value: (r) => r.barcode, literal: true },
    { header: 'Stocked', value: (r) => (r.isStocked ? 'yes' : 'no') },
  ]),
  suppliers: def('Suppliers', suppliersOf, [
    { header: 'Name', value: (r) => r.name },
    { header: 'Account reference', value: (r) => r.accountRef, literal: true },
    { header: 'Email', value: (r) => r.email },
    { header: 'Phone', value: (r) => r.phone, literal: true },
    { header: 'Address', value: (r) => r.addressLine1 },
    { header: 'Town', value: (r) => r.locality },
    { header: 'Postcode', value: (r) => r.postcode, literal: true },
    { header: 'Payment terms (days)', value: (r) => r.paymentTermsDays },
  ]),
  ledger: def('Ledger', ledgerOf, [
    {
      header: 'Posted',
      value: (r) => r.entry.postedAt,
    },
    { header: 'Reference', value: (r) => r.entry.reference, literal: true },
    { header: 'Description', value: (r) => r.entry.description },
    { header: 'Account code', value: (r) => r.account.code, literal: true },
    { header: 'Account', value: (r) => r.account.name },
    { header: 'Debit', value: (r) => Number(r.debit) },
    { header: 'Credit', value: (r) => Number(r.credit) },
    { header: 'Memo', value: (r) => r.memo },
    { header: 'Source type', value: (r) => r.entry.sourceType },
    { header: 'Source id', value: (r) => r.entry.sourceId, literal: true },
    { header: 'Reversal', value: (r) => (r.entry.isReversal ? 'yes' : 'no') },
  ]),
};

export async function exportDataset(orgId: string, id: string): Promise<ExportFile | null> {
  const csv = CSV[id];
  if (csv) {
    const rows = await csv.rows(orgId);
    return {
      filename: csvFilename(csv.title),
      contentType: 'text/csv; charset=utf-8',
      body: toCsv(rows, csv.columns),
    };
  }
  if (id === 'passports') {
    return {
      filename: `passports-${new Date().toISOString().slice(0, 10)}.json`,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        { exportedAt: iso(new Date()), passports: await passportsOf(orgId) },
        null,
        2,
      ),
    };
  }
  if (id === 'everything') {
    const [customers, vehicles, jobs, invoices, payments, parts, suppliers, ledger, passports] =
      await Promise.all([
        customersOf(orgId),
        vehiclesOf(orgId),
        jobsOf(orgId),
        invoicesOf(orgId),
        paymentsOf(orgId),
        partsOf(orgId),
        suppliersOf(orgId),
        ledgerOf(orgId),
        passportsOf(orgId),
      ]);
    return {
      filename: `carnet-everything-${new Date().toISOString().slice(0, 10)}.json`,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        {
          exportedAt: iso(new Date()),
          customers,
          vehicles,
          jobs,
          invoices,
          payments,
          parts,
          suppliers,
          ledger,
          passports,
        },
        null,
        2,
      ),
    };
  }
  return null;
}
