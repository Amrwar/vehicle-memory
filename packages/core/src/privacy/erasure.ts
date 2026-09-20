/**
 * Being forgotten. Phase 62. FR-209, NFR-502, NFR-503, NFR-903.
 *
 * Maria sells her car and asks the workshop to forget her. Two things are true
 * at the same moment, and the whole difficulty is holding both:
 *
 *   Her name, her address, her telephone number and her signature must go.
 *
 *   The fact that the brake discs were replaced at 82,430 km must stay,
 *   because it belongs to the vehicle rather than to her — and the person who
 *   buys that car is entitled to it. So is the tax authority, for seven years,
 *   with respect to what the workshop charged.
 *
 * The security model has specified this since the first month, column by
 * column, and until this phase no code did any of it. Worse, the quality
 * register claimed otherwise for five phases: it named a check that tests
 * reviews and loyalty points, which was found in Phase 61 while tracing the
 * requirement that says erasure must exist.
 *
 * The register below is the specification made executable. Every place the
 * product holds something personal appears in it, with what happens and why,
 * and `verify-erasure` afterwards searches the whole database for the person's
 * own name and address and requires nothing back.
 *
 * Four treatments, and the reason each exists:
 *
 *   removed      The row goes. Nothing depends on it and it is hers.
 *   anonymised   The row stays and the identifying columns are emptied,
 *                because something the workshop must keep points at it.
 *   superseded   Append-only: the record cannot be changed, so a redacted
 *                version is written after it and the original points forward.
 *   kept         Nothing personal in it. Named anyway, so that "we looked and
 *                there was nothing" is distinguishable from "we did not look".
 */

export type Treatment = 'removed' | 'anonymised' | 'superseded' | 'kept';

export interface Holding {
  /** The record, as somebody would name it rather than as the table is spelled. */
  what: string;
  /** The table, for the check that goes looking. */
  table: string;
  /** What of the person's is in it. */
  holds: string;
  treatment: Treatment;
  /** Why it is treated that way. The interesting column. */
  because: string;
}

export const ERASURE: readonly Holding[] = [
  {
    what: 'The customer record',
    table: 'customers',
    holds: 'name, email, telephone, address, tax number, and whatever was typed in the notes',
    treatment: 'anonymised',
    because:
      'Every invoice they were ever sent points at this row, and the invoices must be kept for seven years. Deleting it would take the workshop’s books with it, so the row stays and everything identifying is emptied.',
  },
  {
    what: 'Their portal login',
    table: 'users',
    holds: 'email, name, password hash, and every session',
    treatment: 'removed',
    because:
      'An account is a way in. Nothing in the workshop’s records needs it to exist, and leaving one behind would let somebody sign in as a person who has asked to be forgotten.',
  },
  {
    what: 'Their signature',
    table: 'signatures',
    holds: 'the strokes of their hand, their name, the address they signed from',
    treatment: 'removed',
    because:
      'A signature is the most personal thing in this product: it is their hand, not a record about them. The job keeps the fact that it was signed for.',
  },
  {
    what: 'Ownership of a vehicle',
    table: 'vehicle_ownerships',
    holds: 'the owner’s name',
    treatment: 'anonymised',
    because:
      'How long a car was in one pair of hands is the vehicle’s record and the next buyer’s business. Whose hands they were is not, once they have asked.',
  },
  {
    what: 'The vehicle’s history',
    table: 'vehicle_events',
    holds: 'nothing, by design since Phase 62',
    treatment: 'kept',
    because:
      'The passport is append-only and hash-chained, and a name written into a hashed chain can never be taken out: superseding preserves the original, which is the point of it, and rewriting the hash would destroy the only thing the chain is for. So the passport carries no name at all — it says a car changed hands and how many keepers it has had, which is the vehicle’s record, while who they were lives in the ownership rows, which can be anonymised. Events written before that change still carry names, and `eraseCustomer` reports any it finds rather than pretending it removed them.',
  },
  {
    what: 'Messages sent to them',
    table: 'message_logs',
    holds: 'the address it went to, the subject, and the words',
    treatment: 'anonymised',
    because:
      'That the workshop told somebody their car was ready, and when, is the workshop’s record and may be the answer to a dispute. What it said to them, and where, is theirs.',
  },
  {
    what: 'Messages they sent',
    table: 'inbound_messages',
    holds: 'the address it came from, and the words',
    treatment: 'removed',
    because:
      'Their words, written by them, kept only so somebody could reply. There is nobody to reply to now.',
  },
  {
    what: 'Their conversations',
    table: 'conversations',
    holds: 'the thread’s subject, which is usually their car and sometimes them',
    treatment: 'anonymised',
    because:
      'As above: the thread existed, and what was in it was between two people, one of whom has left.',
  },
  {
    what: 'A car offered to somebody',
    table: 'handover_invitations',
    holds: 'the name, email and telephone of whoever it was offered to',
    treatment: 'anonymised',
    because:
      'The handover is part of the vehicle’s history. Who was invited is not, once the invitation has been answered or has lapsed.',
  },
  {
    what: 'What they said about the workshop',
    table: 'review_requests',
    holds: 'their comment, in their own words',
    treatment: 'anonymised',
    because:
      'A rating is a figure about the workshop and stays. A comment is a person speaking, and goes with them.',
  },
  {
    what: 'What was recorded about the work',
    table: 'audit_logs',
    holds: 'a copy of whatever was written, which for a customer is their name and address',
    treatment: 'anonymised',
    because:
      'The audit trail refuses every edit by design, and must: who did what, to which record, when and from where, is the product’s account of itself. But it also keeps a copy of the values, and that copy is the person. So the trigger allows exactly one mutation — emptying those two columns and nothing else — the same way the passport allows exactly one.',
  },
  {
    what: 'Their invoices, payments and credit notes',
    table: 'invoices',
    holds: 'nothing of their own: figures, dates and a reference to the customer record',
    treatment: 'kept',
    because:
      'Seven years, by law (NFR-903). They carry no name once the customer record is anonymised, and they are the workshop’s books rather than anything of hers.',
  },
  {
    what: 'Their jobs and bookings',
    table: 'jobs',
    holds: 'nothing of their own once the customer record is anonymised',
    treatment: 'kept',
    because:
      'What was done to the car belongs to the car. Named here so that having looked is on the record.',
  },
  {
    what: 'Points, gift cards, deposits and coupons',
    table: 'loyalty_entries',
    holds: 'nothing of their own: amounts against a customer record',
    treatment: 'kept',
    because:
      'Money the workshop owes or has taken is the workshop’s account. Anonymised at the customer record, which is where the person was.',
  },
];

/** What a name becomes. Not a blank: a blank reads as a fault. */
export const FORGOTTEN = 'Erased at their request';

/** And what an address becomes, where a column cannot be empty. */
export const REDACTED = '[erased]';

const BY_TABLE = new Map(ERASURE.map((one) => [one.table, one]));

export function treatmentOf(table: string): Holding | null {
  return BY_TABLE.get(table) ?? null;
}

/** Every table something is actually done to, for the check that follows. */
export function touched(): string[] {
  return ERASURE.filter((one) => one.treatment !== 'kept')
    .map((one) => one.table)
    .sort();
}

/* ---------------------------------------------------------------------------
   What is handed over first
   --------------------------------------------------------------------------- */

/**
 * NFR-502 asks for a customer's data in a machine-readable form within thirty
 * days. Thirty days is the law's patience, not an engineering target: the
 * product holds it all in one database and can answer immediately.
 *
 * Deliberately offered beside erasure rather than after it. Somebody asking to
 * be forgotten should be able to take their record with them, and a product
 * that erases first and offers the export afterwards is offering nothing.
 */
export interface Export {
  /** Who it is about, and when it was taken. */
  about: string;
  taken: Date;
  workshop: string;
  /** Everything held, by kind. */
  holdings: Record<string, unknown[]>;
}

export function describeExport(taken: Export): string {
  const rows = Object.values(taken.holdings).reduce((total, list) => total + list.length, 0);
  const kinds = Object.keys(taken.holdings).filter((key) => taken.holdings[key]!.length > 0);

  return `${rows} records about ${taken.about}, across ${kinds.length} kinds, as at ${taken.taken.toISOString().slice(0, 10)}.`;
}

/* ---------------------------------------------------------------------------
   What was done
   --------------------------------------------------------------------------- */

export interface Erased {
  /** Per table, how many rows were treated. */
  counts: Record<string, number>;
  /**
   * Passport events still carrying the name, which cannot be removed.
   *
   * Reported rather than swallowed. The chain is append-only and hashed: an
   * event written before Phase 62 may carry a name, and there is no honest
   * way to take it out. A workshop told "erased" is owed the exception.
   */
  unerasable: { eventId: string; where: string }[];
}

export function describeErasure(done: Erased): string {
  const total = Object.values(done.counts).reduce((sum, n) => sum + n, 0);
  const tables = Object.keys(done.counts).filter((key) => done.counts[key]! > 0).length;

  return (
    `${total} records across ${tables} kinds. ` +
    (done.unerasable.length > 0
      ? `${done.unerasable.length} passport ${done.unerasable.length === 1 ? 'event still carries' : 'events still carry'} the name and cannot be changed: the chain is append-only and hashed. Written before the passport stopped carrying names at all.`
      : 'Nothing in the passport carried a name.')
  );
}

/**
 * What the workshop tells the customer, in words rather than table names.
 *
 * A person who asks to be forgotten is owed an answer about what happened, and
 * "your data has been deleted" is not one where a great deal has deliberately
 * been kept.
 */
export function whatWasDone(): { gone: string[]; kept: string[] } {
  return {
    gone: ERASURE.filter((one) => one.treatment !== 'kept').map((one) => one.what),
    kept: ERASURE.filter((one) => one.treatment === 'kept').map((one) => one.what),
  };
}
