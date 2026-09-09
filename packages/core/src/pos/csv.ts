/**
 * CSV, written to survive Excel.
 *
 * Every report in this product is exportable, and the export is the version
 * that ends up in somebody's accountant's inbox. Which means the rules that
 * matter are not about CSV, they are about what spreadsheets do to CSV:
 *
 *   A leading zero on a part number is deleted.
 *   A value beginning with =, +, - or @ is executed as a formula.
 *   A date is reinterpreted according to the reader's locale.
 *
 * The first loses data quietly, the second is a real attack, and the third is
 * how a British workshop's March becomes an American workshop's month of
 * nothing. All three are handled here rather than in each report.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
  /**
   * Text that must keep its shape: part numbers, registrations, VINs,
   * anything with a leading zero or that looks like a date but is not.
   */
  literal?: boolean;
}

/** Characters a spreadsheet treats as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Escapes one field.
 *
 * Formula injection is the one that matters: a customer called
 * `=cmd|' /c calc'!A1` is a real payload, and the workshop exporting their
 * customer list is the one who runs it. Prefixing with an apostrophe is the
 * accepted defence and is invisible in the cell.
 */
export function csvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;

  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function render<T>(column: CsvColumn<T>, row: T): string {
  const raw = column.value(row);

  if (raw === null || raw === undefined) return '';

  if (raw instanceof Date) {
    // ISO, always. A spreadsheet cannot mistake 2026-03-04 for the fourth of
    // March in one country and the third of April in another.
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === 'number') return String(raw);

  // ="0123" is the one form Excel keeps verbatim. Without it a part number
  // becomes 123 and nobody notices until somebody orders the wrong thing.
  return column.literal && raw !== '' ? `="${raw.replace(/"/g, '""')}"` : csvField(raw);
}

export interface CsvOptions {
  /**
   * Excel on a machine with a comma decimal separator reads a comma-delimited
   * file as one column unless the first line says otherwise.
   */
  declareSeparator?: boolean;
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  options: CsvOptions = {},
): string {
  const lines: string[] = [];

  if (options.declareSeparator) lines.push('sep=,');

  lines.push(columns.map((column) => csvField(column.header)).join(','));

  for (const row of rows) {
    lines.push(columns.map((column) => render(column, row)).join(','));
  }

  // CRLF, because that is what the specification says and what Excel expects.
  // A byte order mark so a file full of accented names opens as UTF-8 rather
  // than as mojibake.
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

/**
 * A filename somebody can find again in six months.
 *
 * Dated, and named for the report rather than "export (3).csv".
 */
export function csvFilename(report: string, at: Date = new Date()): string {
  const slug = report
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug}-${at.toISOString().slice(0, 10)}.csv`;
}

/** Headers for a CSV response, so a browser saves rather than renders it. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    // Reports are live figures. A cached export is a wrong export.
    'Cache-Control': 'no-store',
  };
}
