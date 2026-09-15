import { csvFilename, csvHeaders, isPayrollExportId, toCsv, type CsvColumn } from '@carnet/core';

import { requireSession } from '@/lib/guard';
import { payrollFile } from '@/lib/payroll';
import {
  bySource,
  partsProfitability,
  periodFor,
  retention,
  revenueByServiceType,
} from '@/lib/reports';
import { taxReportFor } from '@/lib/tax';

/**
 * Report downloads. FR-1406.
 *
 * One route for every report rather than an export button per page, because
 * the escaping rules that make a CSV safe are the same everywhere and having
 * them in one place is the only way they stay applied. The rules live in
 * `@carnet/core`; this decides which rows go through them.
 *
 * Every export runs through the same session guard as the page it came from.
 * A download URL that skips the permission check is how a technician emails
 * themselves the customer list.
 */

const money = (minor: number) => (minor / 100).toFixed(2);

export async function GET(request: Request, context: { params: Promise<{ report: string }> }) {
  const { report } = await context.params;

  // Wages are not an operational report. The people who see the ledger are
  // not necessarily the people who see what everybody is paid, and the
  // bookkeeper who runs payroll does not necessarily see the shop's reports.
  const { orgId, region } = await requireSession(
    report === 'payroll'
      ? 'payroll:read'
      : report === 'tax'
        ? 'report:financial'
        : 'report:operational',
  );

  const range = new URL(request.url).searchParams.get('range') ?? 'year';
  const period = periodFor(range);

  switch (report) {
    case 'service-types': {
      const rows = await revenueByServiceType(orgId, period);

      return csv('Revenue by service type', rows, [
        { header: 'Service type', value: (row) => row.name },
        { header: 'Jobs', value: (row) => row.jobs },
        { header: 'Revenue', value: (row) => money(row.revenueMinor) },
        { header: 'Cost', value: (row) => money(row.costMinor) },
        { header: 'Margin %', value: (row) => row.marginPct ?? '' },
        { header: 'Average job', value: (row) => money(row.averageMinor) },
      ]);
    }

    case 'parts': {
      const rows = await partsProfitability(orgId, period);

      return csv('Parts profitability', rows, [
        { header: 'Category', value: (row) => row.category },
        // Literal, so a part number keeps its leading zero.
        { header: 'Part number', value: (row) => row.partNumber, literal: true },
        { header: 'Name', value: (row) => row.name },
        { header: 'Quantity', value: (row) => row.quantity },
        { header: 'Revenue', value: (row) => money(row.revenueMinor) },
        { header: 'Cost', value: (row) => money(row.costMinor) },
        { header: 'Margin %', value: (row) => row.marginPct ?? '' },
      ]);
    }

    case 'retention': {
      const rows = await retention(orgId, 500);

      return csv('Customer retention', rows, [
        { header: 'Customer', value: (row) => row.name },
        { header: 'Visits', value: (row) => row.visits },
        { header: 'First visit', value: (row) => row.firstVisit },
        { header: 'Last visit', value: (row) => row.lastVisit },
        { header: 'Days since', value: (row) => row.daysSinceLastVisit ?? '' },
        { header: 'Lifetime value', value: (row) => money(row.lifetimeMinor) },
        { header: 'Average visit', value: (row) => money(row.averageMinor) },
        { header: 'Lapsing', value: (row) => (row.lapsing ? 'yes' : 'no') },
      ]);
    }

    case 'payroll': {
      const search = new URL(request.url).searchParams;
      const runId = search.get('run') ?? '';
      const format = search.get('format');

      // The file in a named shape (Phase 43). An unknown name is refused
      // rather than answered with another shape somebody did not ask for.
      if (format && !isPayrollExportId(format)) {
        return new Response('There is no payroll file of that name.', { status: 400 });
      }

      const file = await payrollFile(orgId, runId, format);

      if (!file) return new Response('No such payroll run.', { status: 404 });

      return new Response(file.csv, {
        headers: csvHeaders(
          csvFilename(
            `Payroll ${file.run.periodEnd.toISOString().slice(0, 10)}${file.format.suffix}`,
            file.run.periodEnd,
          ),
        ),
      });
    }

    case 'sources': {
      const rows = await bySource(orgId, period);

      return csv('Source of business', rows, [
        { header: 'Source', value: (row) => row.source },
        { header: 'Bookings', value: (row) => row.bookings },
        { header: 'Became jobs', value: (row) => row.converted },
        { header: 'Conversion %', value: (row) => row.conversionPct },
      ]);
    }

    case 'tax': {
      // One row per tax and rate, as declared on the documents. Phase 41.
      const result = await taxReportFor(orgId, period, region.currency);

      return csv(`Tax ${period.label}`, result.rows, [
        { header: 'Tax', value: (row) => row.name },
        { header: 'Rate %', value: (row) => row.ratePct },
        { header: 'Taxable', value: (row) => money(row.salesNet.minor) },
        { header: 'Tax charged', value: (row) => money(row.salesTax.minor) },
        { header: 'Taxable given back', value: (row) => money(row.creditedNet.minor) },
        { header: 'Tax given back', value: (row) => money(row.creditedTax.minor) },
        { header: 'Tax owed', value: (row) => money(row.tax.minor) },
        { header: 'Documents', value: (row) => row.documents },
      ]);
    }

    default:
      return new Response('No such report.', { status: 404 });
  }
}

function csv<T>(name: string, rows: readonly T[], columns: CsvColumn<T>[]): Response {
  return new Response(toCsv(rows, columns), { headers: csvHeaders(csvFilename(name)) });
}
