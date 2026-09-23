/**
 * Finding anything. Phase 39.
 *
 * One box. What somebody types into it is a registration read off a car, a
 * VIN off a windscreen, a telephone number off a caller's screen, a job or
 * an invoice number off a piece of paper, a part number off a box, or a
 * name. The rules here read the text the way a person at the counter would:
 * what it could be, in the form the database keeps it, and which result is
 * the one they meant.
 */

export type SearchKind =
  | 'customer'
  | 'vehicle'
  | 'job'
  | 'invoice'
  | 'part'
  | 'supplier'
  // Not a record: an answer to "how do I". Somebody who does not know where a
  // thing lives types it into the same box as everything else. Phase 45.
  | 'help';

export interface ReadQuery {
  raw: string;
  /** Letters and digits only, upper case: how a plate or a VIN is compared. */
  compact: string;
  /** Digits only, when there are enough to be a telephone number. */
  phoneDigits: string | null;
  /** A job number, when the text is one ("10484", "#10484", "job 10484"). */
  jobNumber: number | null;
  /** The text could be a VIN: seventeen letters and digits. Older and grey imports break the I, O, Q rule. */
  looksLikeVin: boolean;
  /** The text could be a registration: letters and digits, two to eight, with both. */
  looksLikeRegistration: boolean;
  /** An email address, or part of one. */
  looksLikeEmail: boolean;
}

export const MIN_QUERY = 2;

export function readQuery(input: string): ReadQuery {
  const raw = input.trim().slice(0, 80);
  const compact = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const digits = raw.replace(/\D/g, '');
  const job = /^(?:job\s*)?#?\s*(\d{1,7})$/i.exec(raw);
  return {
    raw,
    compact,
    phoneDigits: digits.length >= 6 && /^[\d\s+()\-.]+$/.test(raw) ? digits : null,
    jobNumber: job ? Number(job[1]) : null,
    looksLikeVin: /^[A-Z0-9]{17}$/.test(compact),
    looksLikeRegistration:
      compact.length >= 2 && compact.length <= 8 && /[A-Z]/.test(compact) && /\d/.test(compact),
    looksLikeEmail: raw.includes('@'),
  };
}

export function isSearchable(input: string): boolean {
  return input.trim().length >= MIN_QUERY;
}

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  /** The identifier typed matches this record exactly, not just a part of it. */
  exact: boolean;
}

const KIND_ORDER: Record<SearchKind, number> = {
  vehicle: 0,
  job: 1,
  invoice: 2,
  customer: 3,
  part: 4,
  supplier: 5,
  help: 6,
};

/** Exact identifier matches first, then by kind, then by title. */
export function rankHits(hits: readonly SearchHit[]): SearchHit[] {
  return [...hits].sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title),
  );
}

/**
 * The one record to go straight to, when there is one: a single exact
 * identifier match. A name is never exact; two people are called Maria.
 */
export function straightTo(hits: readonly SearchHit[]): SearchHit | null {
  const exact = hits.filter((hit) => hit.exact);
  return exact.length === 1 ? exact[0]! : null;
}

export function kindLabel(kind: SearchKind): string {
  switch (kind) {
    case 'customer':
      return 'Customers';
    case 'vehicle':
      return 'Vehicles';
    case 'job':
      return 'Jobs';
    case 'invoice':
      return 'Invoices';
    case 'part':
      return 'Parts';
    case 'supplier':
      return 'Suppliers';
    case 'help':
      return 'Help';
  }
}

/* ---------------------------------------------------------------------------
   Notifications for staff
   --------------------------------------------------------------------------- */

export type NotificationKind =
  | 'ESTIMATE_DECIDED'
  | 'MESSAGE_RECEIVED'
  | 'BOOKING_REQUESTED'
  | 'PAYMENT_RECEIVED'
  | 'PART_REQUESTED'
  | 'FOLLOW_UP_ASSIGNED';

/** Who a kind of notification goes to, by the permission that would act on it. */
export const NOTIFY_PERMISSION: Record<NotificationKind, string> = {
  ESTIMATE_DECIDED: 'job:write',
  MESSAGE_RECEIVED: 'customer:write',
  BOOKING_REQUESTED: 'diary:write',
  PAYMENT_RECEIVED: 'invoice:write',
  PART_REQUESTED: 'purchase:approve',
  // Unused for this one: a follow-up goes to the person it was given to,
  // by name, rather than to everybody who could act on it. Present because
  // the record is exhaustive over the kinds, and a kind with no permission
  // beside it would be a gap in a table that is read as complete.
  FOLLOW_UP_ASSIGNED: 'job:write',
};

/** A notification a person need not see: the one they caused themselves. */
export function recipients<T extends { userId: string; role: string }>(input: {
  members: readonly T[];
  can: (role: string) => boolean;
  exceptUserId?: string | null;
}): T[] {
  const seen = new Set<string>();
  return input.members.filter((member) => {
    if (member.userId === input.exceptUserId) return false;
    if (!input.can(member.role)) return false;
    if (seen.has(member.userId)) return false;
    seen.add(member.userId);
    return true;
  });
}
