import { csvFilename, csvHeaders, toCsv, type CsvColumn } from '@carnet/core';

import { requireSession } from '@/lib/guard';
import {
  bySource,
  partsProfitability,
  periodFor,
  retention,
  revenueByServiceType,
} from '@/lib/reports';

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
  const { orgId } = await requireSession('report:operational');

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

    case 'sources': {
      const rows = await bySource(orgId, period);

      return csv('Source of business', rows, [
        { header: 'Source', value: (row) => row.source },
        { header: 'Bookings', value: (row) => row.bookings },
        { header: 'Became jobs', value: (row) => row.converted },
        { header: 'Conversion %', value: (row) => row.conversionPct },
      ]);
    }

    default:
      return new Response('No such report.', { status: 404 });
  }
}

function csv<T>(name: string, rows: readonly T[], columns: CsvColumn<T>[]): Response {
  return new Response(toCsv(rows, columns), { headers: csvHeaders(csvFilename(name)) });
}
