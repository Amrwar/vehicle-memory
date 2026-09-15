/**
 * Paper. Phase 42.
 *
 * The documents a workshop hands over or pins up: an invoice, a quote, an
 * inspection report, a work order for the technician, a tag for the keys,
 * labels for the shelf, and a receipt from the counter. Each is one page
 * built to print, and the same page is what a PDF is made from, so the paper
 * and the file never disagree.
 *
 * What is decided here is what does not depend on the database: who may
 * read each kind, what is stamped across a document that is not final, how
 * the file is named, how labels fill a sheet, and how a key tag fits.
 */

import type { Permission } from '../access/roles';

export const PRINT_KINDS = [
  'invoice',
  'estimate',
  'inspection',
  'work-order',
  'key-tag',
  'labels',
  'counter-sale',
] as const;

export type PrintKind = (typeof PRINT_KINDS)[number];

export function isPrintKind(value: unknown): value is PrintKind {
  return typeof value === 'string' && (PRINT_KINDS as readonly string[]).includes(value);
}

/** What a member of the workshop needs to read each kind. */
export const PRINT_PERMISSION: Record<PrintKind, Permission> = {
  invoice: 'invoice:read',
  estimate: 'estimate:read',
  inspection: 'inspection:read',
  'work-order': 'job:read',
  'key-tag': 'job:read',
  labels: 'inventory:read',
  'counter-sale': 'invoice:read',
};

/** The kinds a customer may read about their own car, from the portal. */
export const CUSTOMER_PRINT_KINDS: readonly PrintKind[] = ['invoice', 'estimate', 'inspection'];

export type Watermark = 'Draft' | 'Void' | 'Cancelled' | 'Superseded' | 'Not approved' | null;

/**
 * What is stamped across a document that is not the final word. A draft
 * quote printed and handed over reads as a price; the stamp says it is not.
 */
export function watermarkFor(kind: PrintKind, status: string): Watermark {
  switch (kind) {
    case 'invoice':
      return status === 'VOID' ? 'Void' : status === 'DRAFT' ? 'Draft' : null;
    case 'estimate':
      if (status === 'DRAFT') return 'Draft';
      if (status === 'SUPERSEDED') return 'Superseded';
      if (status === 'DECLINED' || status === 'EXPIRED') return 'Not approved';
      return null;
    case 'inspection':
      return status === 'DRAFT' ? 'Draft' : null;
    case 'work-order':
    case 'key-tag':
      return status === 'CANCELLED' ? 'Cancelled' : null;
    case 'counter-sale':
      return status === 'VOID' ? 'Void' : null;
    default:
      return null;
  }
}

/**
 * A file name a person can find again: the workshop, the kind and the
 * number, in plain letters, digits and hyphens, so it survives every email
 * client and file system.
 */
export function pdfFilename(input: { kind: PrintKind; number: string; orgName: string }): string {
  const plain = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  const parts = [plain(input.orgName) || 'Carnet', input.kind, plain(input.number)].filter(Boolean);
  return `${parts.join('-')}.pdf`;
}

export class PrintError extends Error {
  readonly code: 'NOTHING' | 'TOO_MANY';

  constructor(code: PrintError['code'], message: string) {
    super(message);
    this.name = 'PrintError';
    this.code = code;
  }
}

/** Labels to a sheet: an A4 sheet of 21, three across and seven down. */
export const LABELS_PER_SHEET = 21;
export const MAX_COPIES = 100;
export const MAX_LABELS = 500;

export interface LabelRequest {
  id: string;
  copies: number;
}

/**
 * Expands each part into its copies and fills sheets in order. Copies are a
 * whole number from one to a hundred; the whole run is capped, because a
 * mistyped zero should waste a sheet, not a box of them.
 */
export function labelSheets(
  requests: readonly LabelRequest[],
  perSheet = LABELS_PER_SHEET,
): string[][] {
  const cells: string[] = [];
  for (const request of requests) {
    const copies = Math.min(MAX_COPIES, Math.max(1, Math.floor(request.copies || 1)));
    for (let index = 0; index < copies; index += 1) cells.push(request.id);
  }
  if (cells.length === 0) {
    throw new PrintError('NOTHING', 'Choose at least one part to print a label for.');
  }
  if (cells.length > MAX_LABELS) {
    throw new PrintError(
      'TOO_MANY',
      `That is ${cells.length} labels. Print at most ${MAX_LABELS} at a time.`,
    );
  }
  const sheets: string[][] = [];
  for (let start = 0; start < cells.length; start += perSheet) {
    sheets.push(cells.slice(start, start + perSheet));
  }
  return sheets;
}

/** Shortens text to fit a small space, with an ellipsis rather than a cut word. */
export function fitText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export interface KeyTag {
  /** The largest line: what somebody reads off the hook board. */
  headline: string;
  job: string;
  customer: string;
  vehicle: string;
  hook: string | null;
}

/**
 * What goes on a key tag. The plate, because that is what people look for;
 * the job number; the surname only, because a tag hangs where the public can
 * see it; the car; and the hook, where it has one.
 */
export function keyTagFor(input: {
  registration: string | null;
  jobNumber: number;
  customerName: string;
  make: string | null;
  model: string | null;
  hook: string | null;
}): KeyTag {
  const words = input.customerName.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1]! : (words[0] ?? '');
  return {
    headline: input.registration?.trim() || `#${input.jobNumber}`,
    job: `#${input.jobNumber}`,
    customer: fitText(surname, 18),
    vehicle: fitText([input.make, input.model].filter(Boolean).join(' '), 24),
    hook: input.hook?.trim() || null,
  };
}
