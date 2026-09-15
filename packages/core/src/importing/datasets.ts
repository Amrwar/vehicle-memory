/**
 * What can be imported, column by column. Phase 33.
 *
 * Each dataset names its fields, the headers other systems tend to use for
 * them, which are required, and how a cell is read. Mapping is suggested
 * from the headers and then edited by a person; validation runs on every
 * row before anything is written and names the row and the field, so the
 * report says "row 412, email: not an address" rather than "12 failed".
 */

export type DatasetId = 'customers' | 'vehicles' | 'parts' | 'suppliers' | 'balances';

export type FieldKind =
  'text' | 'email' | 'phone' | 'number' | 'money' | 'integer' | 'date' | 'vin' | 'code';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Lower-cased headers that mean this field, in other systems' words. */
  synonyms: string[];
  hint?: string;
}

export interface DatasetSpec {
  id: DatasetId;
  title: string;
  /** One sentence on what a row becomes. */
  becomes: string;
  fields: FieldSpec[];
  /** A field that must be unique within the file, when there is one. */
  uniqueBy?: string;
}

export const DATASETS: readonly DatasetSpec[] = [
  {
    id: 'customers',
    title: 'Customers',
    becomes: 'One customer each, a person or a company, with how to reach them.',
    uniqueBy: 'email',
    fields: [
      {
        key: 'firstName',
        label: 'First name',
        kind: 'text',
        synonyms: ['first name', 'firstname', 'first', 'forename', 'given name'],
      },
      {
        key: 'lastName',
        label: 'Last name',
        kind: 'text',
        synonyms: ['last name', 'lastname', 'last', 'surname', 'family name'],
      },
      {
        key: 'companyName',
        label: 'Company',
        kind: 'text',
        synonyms: [
          'company',
          'company name',
          'business',
          'organisation',
          'organization',
          'account name',
        ],
      },
      {
        key: 'email',
        label: 'Email',
        kind: 'email',
        synonyms: ['email', 'e-mail', 'email address', 'mail'],
      },
      {
        key: 'mobile',
        label: 'Mobile',
        kind: 'phone',
        synonyms: ['mobile', 'cell', 'cellphone', 'mobile phone', 'mobile number'],
      },
      {
        key: 'phone',
        label: 'Phone',
        kind: 'phone',
        synonyms: ['phone', 'telephone', 'tel', 'landline', 'phone number'],
      },
      {
        key: 'addressLine1',
        label: 'Address',
        kind: 'text',
        synonyms: ['address', 'address 1', 'address line 1', 'street', 'address1'],
      },
      {
        key: 'locality',
        label: 'Town',
        kind: 'text',
        synonyms: ['town', 'city', 'locality', 'suburb'],
      },
      {
        key: 'postcode',
        label: 'Postcode',
        kind: 'code',
        synonyms: ['postcode', 'post code', 'zip', 'zip code', 'postal code'],
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'text',
        synonyms: ['notes', 'note', 'comments', 'remarks'],
      },
    ],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    becomes: 'One vehicle each, on your books, with its passport started as migrated history.',
    uniqueBy: 'vin',
    fields: [
      {
        key: 'vin',
        label: 'VIN',
        kind: 'vin',
        required: true,
        synonyms: ['vin', 'chassis', 'chassis number', 'vehicle identification number'],
        hint: 'Seventeen characters. A passport hangs off the VIN; a car without one joins when it is first booked in.',
      },
      {
        key: 'registration',
        label: 'Registration',
        kind: 'code',
        synonyms: [
          'registration',
          'reg',
          'plate',
          'number plate',
          'licence plate',
          'license plate',
          'vrm',
          'reg no',
        ],
      },
      {
        key: 'make',
        label: 'Make',
        kind: 'text',
        synonyms: ['make', 'manufacturer', 'brand', 'marque'],
      },
      { key: 'model', label: 'Model', kind: 'text', synonyms: ['model'] },
      {
        key: 'year',
        label: 'Year',
        kind: 'integer',
        synonyms: ['year', 'model year', 'year of manufacture'],
      },
      {
        key: 'odometerKm',
        label: 'Odometer (km)',
        kind: 'integer',
        synonyms: ['odometer', 'mileage', 'km', 'kilometres', 'kilometers', 'odo'],
      },
      { key: 'colour', label: 'Colour', kind: 'text', synonyms: ['colour', 'color'] },
      {
        key: 'lastServiceAt',
        label: 'Last service',
        kind: 'date',
        synonyms: ['last service', 'last serviced', 'last service date', 'service date'],
      },
      {
        key: 'customerEmail',
        label: 'Customer email',
        kind: 'email',
        synonyms: ['customer email', 'owner email', 'customer', 'owner'],
        hint: 'Ties the car to a customer already on your books, or imported in the same afternoon.',
      },
    ],
  },
  {
    id: 'parts',
    title: 'Parts',
    becomes: 'One part each in the catalogue, with opening stock at your main store.',
    uniqueBy: 'partNumber',
    fields: [
      {
        key: 'partNumber',
        label: 'Part number',
        kind: 'code',
        required: true,
        synonyms: [
          'part number',
          'part no',
          'partnumber',
          'sku',
          'code',
          'item code',
          'product code',
          'part',
        ],
      },
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        required: true,
        synonyms: ['name', 'description', 'item', 'product', 'title'],
      },
      { key: 'brand', label: 'Brand', kind: 'text', synonyms: ['brand', 'manufacturer', 'make'] },
      {
        key: 'costPrice',
        label: 'Cost price',
        kind: 'money',
        synonyms: ['cost', 'cost price', 'unit cost', 'buy price', 'purchase price'],
      },
      {
        key: 'sellPrice',
        label: 'Sell price',
        kind: 'money',
        synonyms: ['sell', 'sell price', 'price', 'retail', 'unit price', 'list price'],
      },
      {
        key: 'onHand',
        label: 'Quantity on hand',
        kind: 'number',
        synonyms: [
          'on hand',
          'qty',
          'quantity',
          'stock',
          'in stock',
          'qty on hand',
          'quantity on hand',
        ],
      },
      {
        key: 'reorderPoint',
        label: 'Reorder point',
        kind: 'number',
        synonyms: ['reorder point', 'min', 'minimum', 'reorder level'],
      },
      { key: 'barcode', label: 'Barcode', kind: 'code', synonyms: ['barcode', 'ean', 'upc'] },
    ],
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    becomes: 'One supplier each, with terms and how to reach them.',
    uniqueBy: 'name',
    fields: [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        required: true,
        synonyms: ['name', 'supplier', 'supplier name', 'company', 'vendor'],
      },
      {
        key: 'accountRef',
        label: 'Account reference',
        kind: 'code',
        synonyms: [
          'account',
          'account ref',
          'account number',
          'ref',
          'reference',
          'customer number',
        ],
      },
      {
        key: 'email',
        label: 'Email',
        kind: 'email',
        synonyms: ['email', 'e-mail', 'email address'],
      },
      {
        key: 'phone',
        label: 'Phone',
        kind: 'phone',
        synonyms: ['phone', 'telephone', 'tel', 'phone number'],
      },
      {
        key: 'addressLine1',
        label: 'Address',
        kind: 'text',
        synonyms: ['address', 'address 1', 'street', 'address line 1'],
      },
      { key: 'locality', label: 'Town', kind: 'text', synonyms: ['town', 'city', 'locality'] },
      {
        key: 'postcode',
        label: 'Postcode',
        kind: 'code',
        synonyms: ['postcode', 'post code', 'zip', 'postal code'],
      },
      {
        key: 'paymentTermsDays',
        label: 'Payment terms (days)',
        kind: 'integer',
        synonyms: ['terms', 'payment terms', 'days', 'net days', 'credit terms'],
      },
    ],
  },
  {
    id: 'balances',
    title: 'Opening balances',
    becomes:
      'One ledger line each, posted together as one balanced opening entry; any difference goes to retained earnings.',
    fields: [
      {
        key: 'accountCode',
        label: 'Account code',
        kind: 'code',
        required: true,
        synonyms: ['account', 'account code', 'code', 'nominal', 'nominal code', 'gl code'],
      },
      { key: 'debit', label: 'Debit', kind: 'money', synonyms: ['debit', 'dr'] },
      { key: 'credit', label: 'Credit', kind: 'money', synonyms: ['credit', 'cr'] },
      {
        key: 'memo',
        label: 'Memo',
        kind: 'text',
        synonyms: ['memo', 'description', 'narrative', 'note'],
      },
    ],
  },
];

export function datasetSpec(id: string): DatasetSpec | null {
  return DATASETS.find((d) => d.id === id) ?? null;
}

/** header index → field key, or absent. */
export type Mapping = Record<string, string>;

function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-.]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A first guess at which column is which, from the headers alone. Edited by a person afterwards. */
export function suggestMapping(spec: DatasetSpec, headers: string[]): Mapping {
  const mapping: Mapping = {};
  const taken = new Set<string>();
  headers.forEach((header, index) => {
    const wanted = normaliseHeader(header);
    if (!wanted) return;
    const field =
      spec.fields.find((f) => !taken.has(f.key) && f.synonyms.includes(wanted)) ??
      spec.fields.find((f) => !taken.has(f.key) && normaliseHeader(f.label) === wanted) ??
      spec.fields.find(
        (f) => !taken.has(f.key) && f.key.toLowerCase() === wanted.replace(/ /g, ''),
      );
    if (field) {
      mapping[String(index)] = field.key;
      taken.add(field.key);
    }
  });
  return mapping;
}

export interface RowProblem {
  /** One-based, counting the header as line 1, so it matches the spreadsheet. */
  row: number;
  field: string;
  message: string;
}

export type CleanRow = Record<string, string | number | Date | null>;

export interface ValidationResult {
  /** Rows that passed, in file order, each with the row number it came from. */
  rows: { row: number; values: CleanRow }[];
  problems: RowProblem[];
  /** Fields the mapping has not placed but the dataset needs. */
  missingRequired: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The number in a cell, or NaN when there is none: 'lots' is not zero. */
function numberIn(text: string): number {
  const cleaned = text.replace(/[^\d.-]/g, '');
  return /\d/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function readCell(kind: FieldKind, raw: string): { value: CleanRow[string]; error?: string } {
  const text = raw.trim();
  if (text === '') return { value: null };
  switch (kind) {
    case 'text':
      return { value: text };
    case 'code':
      return { value: text.toUpperCase().replace(/\s+/g, ' ') };
    case 'email':
      return EMAIL.test(text)
        ? { value: text.toLowerCase() }
        : { value: null, error: 'not an email address' };
    case 'phone': {
      const digits = text.replace(/[^\d+]/g, '');
      return digits.length >= 6 ? { value: text } : { value: null, error: 'not a phone number' };
    }
    case 'vin': {
      const vin = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return vin.length === 17 && !/[IOQ]/.test(vin)
        ? { value: vin }
        : { value: null, error: 'a VIN is 17 characters with no I, O or Q' };
    }
    case 'integer': {
      const n = numberIn(text);
      return Number.isInteger(n) ? { value: n } : { value: null, error: 'not a whole number' };
    }
    case 'number': {
      const n = numberIn(text);
      return Number.isFinite(n) ? { value: n } : { value: null, error: 'not a number' };
    }
    case 'money': {
      const n = numberIn(text);
      return Number.isFinite(n)
        ? { value: Math.round(n * 100) / 100 }
        : { value: null, error: 'not an amount' };
    }
    case 'date': {
      const d = parseDate(text);
      return d ? { value: d } : { value: null, error: 'not a date (use 2026-09-14 or 14/09/2026)' };
    }
  }
}

/** ISO first, then day/month/year as a European spreadsheet writes it. */
export function parseDate(text: string): Date | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (dmy) {
    const year = Number(dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]);
    const d = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(dmy[2]) - 1 ? null : d;
  }
  return null;
}

export function validateRows(
  spec: DatasetSpec,
  _headers: string[],
  rows: string[][],
  mapping: Mapping,
): ValidationResult {
  const placed = new Set(Object.values(mapping));
  const missingRequired = spec.fields
    .filter((f) => f.required && !placed.has(f.key))
    .map((f) => f.label);
  const result: ValidationResult = { rows: [], problems: [], missingRequired };
  if (missingRequired.length > 0) return result;

  const byIndex = Object.entries(mapping).map(([index, key]) => ({
    index: Number(index),
    field: spec.fields.find((f) => f.key === key)!,
  }));
  const seen = new Map<string, number>();

  rows.forEach((cells, i) => {
    const rowNumber = i + 2;
    const values: CleanRow = {};
    let ok = true;
    for (const { index, field } of byIndex) {
      const read = readCell(field.kind, cells[index] ?? '');
      if (read.error) {
        result.problems.push({ row: rowNumber, field: field.label, message: read.error });
        ok = false;
      }
      values[field.key] = read.value;
      if (field.required && read.value === null && !read.error) {
        result.problems.push({ row: rowNumber, field: field.label, message: 'is empty' });
        ok = false;
      }
    }
    if (ok) {
      const problem = datasetRule(spec.id, values);
      if (problem) {
        result.problems.push({ row: rowNumber, field: problem.field, message: problem.message });
        ok = false;
      }
    }
    if (ok && spec.uniqueBy) {
      const key = values[spec.uniqueBy];
      if (key !== null && key !== undefined) {
        const text = String(key).toLowerCase();
        const first = seen.get(text);
        if (first) {
          result.problems.push({
            row: rowNumber,
            field: spec.fields.find((f) => f.key === spec.uniqueBy)!.label,
            message: `same as row ${first}`,
          });
          ok = false;
        } else {
          seen.set(text, rowNumber);
        }
      }
    }
    if (ok) result.rows.push({ row: rowNumber, values });
  });
  return result;
}

/** What one row must satisfy beyond its cells. */
function datasetRule(id: DatasetId, v: CleanRow): { field: string; message: string } | null {
  switch (id) {
    case 'customers':
      if (!v['companyName'] && !v['lastName'] && !v['firstName']) {
        return { field: 'Name', message: 'needs a first name, a last name or a company' };
      }
      return null;
    case 'vehicles':
      return null;
    case 'parts':
      if (typeof v['onHand'] === 'number' && v['onHand'] < 0)
        return { field: 'Quantity on hand', message: 'cannot be negative' };
      if (typeof v['sellPrice'] === 'number' && v['sellPrice'] < 0)
        return { field: 'Sell price', message: 'cannot be negative' };
      return null;
    case 'balances': {
      const debit = typeof v['debit'] === 'number' ? v['debit'] : 0;
      const credit = typeof v['credit'] === 'number' ? v['credit'] : 0;
      if (debit === 0 && credit === 0)
        return { field: 'Debit', message: 'needs a debit or a credit' };
      if (debit !== 0 && credit !== 0)
        return { field: 'Debit', message: 'a line is a debit or a credit, not both' };
      if (debit < 0 || credit < 0)
        return { field: 'Debit', message: 'cannot be negative; swap the side instead' };
      return null;
    }
    default:
      return null;
  }
}

/** For opening balances: the difference that retained earnings must absorb for the entry to balance. */
export function openingImbalance(rows: { values: CleanRow }[]): number {
  let debit = 0;
  let credit = 0;
  for (const { values } of rows) {
    debit += typeof values['debit'] === 'number' ? values['debit'] : 0;
    credit += typeof values['credit'] === 'number' ? values['credit'] : 0;
  }
  return Math.round((debit - credit) * 100) / 100;
}
