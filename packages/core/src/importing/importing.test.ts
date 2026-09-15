import { describe, expect, it } from 'vitest';

import { detectDelimiter, parseCsv } from './csv';
import { datasetSpec, openingImbalance, parseDate, suggestMapping, validateRows } from './datasets';

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes, embedded newlines and either line ending', () => {
    const text = '﻿Name,Notes\r\n"Okafor, Maria","Said ""thanks""\nand left"\nJohn,\n\n';
    const parsed = parseCsv(text);
    expect(parsed.headers).toEqual(['Name', 'Notes']);
    expect(parsed.rows).toEqual([
      ['Okafor, Maria', 'Said "thanks"\nand left'],
      ['John', ''],
    ]);
  });

  it('detects a semicolon or a tab where a spreadsheet used one', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(parseCsv('a;b\n1;2').rows).toEqual([['1', '2']]);
  });

  it('pads short rows and drops empty ones', () => {
    expect(parseCsv('a,b,c\n1\n,,\n4,5,6,7').rows).toEqual([
      ['1', '', ''],
      ['4', '5', '6'],
    ]);
  });
});

describe('suggestMapping', () => {
  it("reads other systems' headers", () => {
    const spec = datasetSpec('customers')!;
    const mapping = suggestMapping(spec, [
      'Forename',
      'Surname',
      'E-Mail',
      'Cell',
      'ZIP Code',
      'Something else',
    ]);
    expect(mapping).toEqual({
      '0': 'firstName',
      '1': 'lastName',
      '2': 'email',
      '3': 'mobile',
      '4': 'postcode',
    });
  });

  it('never maps two columns to one field', () => {
    const spec = datasetSpec('parts')!;
    const mapping = suggestMapping(spec, ['SKU', 'Part No', 'Description']);
    expect(Object.values(mapping).filter((k) => k === 'partNumber')).toHaveLength(1);
  });
});

describe('validateRows', () => {
  it('names the row and the field for every problem, in spreadsheet numbering', () => {
    const spec = datasetSpec('customers')!;
    const headers = ['First', 'Last', 'Email'];
    const rows = [
      ['Maria', 'Okafor', 'maria@example.test'],
      ['', '', 'nobody'],
      ['John', 'Smith', 'MARIA@example.test'],
    ];
    const out = validateRows(spec, headers, rows, suggestMapping(spec, headers));
    expect(out.rows.map((r) => r.row)).toEqual([2]);
    // The name rule waits for the cells to parse; a row is reported cell
    // by cell first, then by what the row as a whole lacks.
    expect(out.problems).toEqual([
      { row: 3, field: 'Email', message: 'not an email address' },
      { row: 4, field: 'Email', message: 'same as row 2' },
    ]);
    expect(out.rows[0]!.values['email']).toBe('maria@example.test');
  });

  it('refuses to run without the required columns placed', () => {
    const spec = datasetSpec('parts')!;
    const out = validateRows(spec, ['Name'], [['Filter']], { '0': 'name' });
    expect(out.missingRequired).toEqual(['Part number']);
    expect(out.rows).toHaveLength(0);
  });

  it('reads VINs, money, integers and dates strictly', () => {
    const spec = datasetSpec('vehicles')!;
    const headers = ['VIN', 'Reg', 'Year', 'Mileage', 'Last service'];
    const rows = [
      ['wba1234567890abcd', 'ab12 cde', '2019', '82,430', '14/09/2026'],
      ['WBA1234567890ABCI', '', '2019.5', 'lots', '31/02/2026'],
      ['', 'XY21 ZZZ', '', '', '2026-09-14'],
    ];
    const out = validateRows(spec, headers, rows, suggestMapping(spec, headers));
    expect(out.rows.map((r) => r.row)).toEqual([2]);
    expect(out.rows[0]!.values).toMatchObject({
      vin: 'WBA1234567890ABCD',
      registration: 'AB12 CDE',
      year: 2019,
      odometerKm: 82430,
    });
    expect((out.rows[0]!.values['lastServiceAt'] as Date).toISOString()).toBe(
      '2026-09-14T00:00:00.000Z',
    );
    expect(out.problems.map((p) => `${p.row} ${p.field}`)).toEqual([
      '3 VIN',
      '3 Year',
      '3 Odometer (km)',
      '3 Last service',
      '4 VIN',
    ]);
  });

  it('checks an opening balance line is one side only, and totals the imbalance', () => {
    const spec = datasetSpec('balances')!;
    const headers = ['Code', 'Debit', 'Credit'];
    const rows = [
      ['1000', '1500.00', ''],
      ['2000', '', '400'],
      ['1200', '10', '10'],
      ['4000', '', ''],
    ];
    const out = validateRows(spec, headers, rows, suggestMapping(spec, headers));
    expect(out.rows.map((r) => r.row)).toEqual([2, 3]);
    expect(out.problems.map((p) => p.message)).toEqual([
      'a line is a debit or a credit, not both',
      'needs a debit or a credit',
    ]);
    expect(openingImbalance(out.rows)).toBe(1100);
  });
});

describe('parseDate', () => {
  it('accepts ISO and day-first, and refuses a day that does not exist', () => {
    expect(parseDate('2026-09-14')?.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(parseDate('14/09/26')?.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('yesterday')).toBeNull();
  });
});
