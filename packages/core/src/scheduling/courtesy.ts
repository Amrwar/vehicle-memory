import { type Interval, overlaps } from './capacity';

/**
 * The courtesy car. Phase 67. FR-512.
 *
 * A workshop with two courtesy cars promises one to a customer booking a day's
 * work. The requirement has been Partial since the beginning: `Job` carries a
 * `courtesyVehicleNote` that nothing has ever read or written, which is a place
 * to type "gave them the Fiesta" and no way to know whether the Fiesta was
 * already promised to somebody else that Tuesday.
 *
 * Two failures, and they are not the same kind of thing.
 *
 * **The same car promised twice.** A customer stands at the counter on a
 * Tuesday morning and the car they were promised is in Leeds with somebody
 * else. Nothing recovers from that: the work cannot start, and the workshop
 * finds out at the worst moment, from the customer. This is not the bay clash
 * the capacity module deliberately treats as advisory — a bay can be squeezed,
 * a second car cannot be conjured — so it is refused, and refused by the
 * database rather than by code remembering to look.
 *
 * **A car lent out that is not legal to lend.** The MOT runs out on Thursday
 * and the loan runs to Friday. The customer is driving it, the offence is the
 * workshop's, and the insurer's position afterwards is not one anybody wants
 * to discover. The product knows the expiry date, because somebody uploaded
 * the certificate, and the one moment worth saying so is before the keys move.
 *
 * What this module will not do is invent a rule it cannot keep. If no
 * certificate has been uploaded, nothing is known and nothing is claimed: a
 * check that refuses a loan for want of a document somebody never uploaded
 * gets worked around within a week, and then it is not a check at all.
 */

/** What a workshop lends, and when it is promised. */
export interface Loan {
  id: string;
  vehicleId: string;
  startAt: Date;
  /** When it was promised back. */
  dueBackAt: Date;
  /** When it actually came back, if it has. */
  returnedAt: Date | null;
}

export type LoanStanding = 'BOOKED' | 'OUT' | 'OVERDUE' | 'BACK';

export class CourtesyError extends Error {
  constructor(
    message: string,
    readonly code: 'ALREADY_PROMISED' | 'BACKWARDS' | 'NOT_LENDABLE' | 'NOT_OURS' | 'ALREADY_BACK',
  ) {
    super(message);
    this.name = 'CourtesyError';
  }
}

/**
 * The stretch of time a car is actually unavailable.
 *
 * Until it comes back, that is the period it was promised for. Once it is
 * back, it is the period it was actually gone — which is shorter when somebody
 * returns it early, and longer when they do not. Both matter: an early return
 * frees the car for the afternoon, and a late one is exactly the situation the
 * next customer needs to be told about rather than to discover.
 */
export function windowOf(loan: Pick<Loan, 'startAt' | 'dueBackAt' | 'returnedAt'>): Interval {
  return { startAt: loan.startAt, endAt: loan.returnedAt ?? loan.dueBackAt };
}

/** Where a loan stands, now. */
export function loanStanding(loan: Loan, now = new Date()): LoanStanding {
  if (loan.returnedAt) return 'BACK';
  if (loan.startAt > now) return 'BOOKED';
  return loan.dueBackAt < now ? 'OVERDUE' : 'OUT';
}

/** How many whole days late, for something still out. Zero otherwise. */
export function daysOverdue(loan: Loan, now = new Date()): number {
  if (loanStanding(loan, now) !== 'OVERDUE') return 0;
  const day = 86_400_000;
  const from = new Date(
    loan.dueBackAt.getFullYear(),
    loan.dueBackAt.getMonth(),
    loan.dueBackAt.getDate(),
  );
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((to.getTime() - from.getTime()) / day);
}

/** In words, because a colour is not a sentence. */
export function describeLoan(loan: Loan, now = new Date()): string {
  const standing = loanStanding(loan, now);

  // Sentences rather than words, and deliberately so. The dictionary is one
  // flat map from English to French and Arabic, shared by every page, so a
  // bare "Out" collides with the ledger's "Out" (out of balance) and a bare
  // "Back" with the navigation's. Both already exist, and both would have
  // shown a French reader the wrong word on a page about cars. A phrase that
  // could only mean one thing cannot be borrowed by another meaning.
  if (standing === 'BACK') return 'In the yard';
  if (standing === 'BOOKED') return 'Promised to somebody';
  if (standing === 'OUT') return 'With a customer';

  const late = daysOverdue(loan, now);
  return late === 0 ? 'Due back today' : late === 1 ? '1 day overdue' : `${late} days overdue`;
}

/**
 * Which existing loans of this car clash with a proposed period.
 *
 * `overlaps` rather than a fourth hand-written comparison: the same primitive
 * the diary uses for bays and technicians, so the three surfaces cannot drift
 * into disagreeing about what "at the same time" means.
 */
export function clashes(existing: readonly Loan[], vehicleId: string, wanted: Interval): Loan[] {
  return existing
    .filter((loan) => loan.vehicleId === vehicleId && !loan.returnedAt)
    .filter((loan) => overlaps(windowOf(loan), wanted));
}

/** The cars with nothing else promised over this period. */
export function freeOver<T extends { vehicleId: string }>(
  fleet: readonly T[],
  existing: readonly Loan[],
  wanted: Interval,
): T[] {
  return fleet.filter((car) => clashes(existing, car.vehicleId, wanted).length === 0);
}

/* ---------------------------------------------------------------------------
   Whether it is legal to lend
   --------------------------------------------------------------------------- */

/** A certificate with a date on it: an MOT, an insurance policy, a registration. */
export interface Paper {
  kind: string;
  expiresAt: Date | null;
}

/** The kinds that stop a car being lent, and what to call each one. */
export const MUST_BE_IN_DATE: Readonly<Record<string, string>> = {
  MOT_CERTIFICATE: 'Its MOT',
  INSURANCE: 'Its insurance',
};

export interface Lapse {
  what: string;
  expiresAt: Date;
}

/**
 * What runs out while the car is with them.
 *
 * Only what is known. A workshop that has not uploaded an MOT certificate is
 * not told its car is illegal — it is told nothing, because nothing is what
 * the product knows. Inventing a refusal there would train somebody to click
 * past this, and then the real one goes past too.
 *
 * Expiry on the last day of the loan counts. A certificate that runs out on
 * Friday does not cover Friday's drive home.
 */
export function lapsesDuring(papers: readonly Paper[], wanted: Interval): Lapse[] {
  return papers
    .filter((paper) => MUST_BE_IN_DATE[paper.kind] && paper.expiresAt)
    .filter((paper) => paper.expiresAt! <= wanted.endAt)
    .map((paper) => ({ what: MUST_BE_IN_DATE[paper.kind]!, expiresAt: paper.expiresAt! }));
}

/** Said plainly, with the date, because "not roadworthy" is not actionable. */
export function describeLapse(lapse: Lapse, on: (at: Date) => string): string {
  return `${lapse.what} runs out on ${on(lapse.expiresAt)}, before they would bring it back.`;
}

/* ---------------------------------------------------------------------------
   Lending one
   --------------------------------------------------------------------------- */

export function assertLendable(input: {
  wanted: Interval;
  existing: readonly Loan[];
  vehicleId: string;
  papers: readonly Paper[];
}): void {
  if (input.wanted.endAt <= input.wanted.startAt) {
    throw new CourtesyError('It has to come back after it goes out.', 'BACKWARDS');
  }

  if (clashes(input.existing, input.vehicleId, input.wanted).length > 0) {
    throw new CourtesyError(
      'That car is already promised to somebody over those days.',
      'ALREADY_PROMISED',
    );
  }

  const lapses = lapsesDuring(input.papers, input.wanted);

  if (lapses.length > 0) {
    throw new CourtesyError(
      `${lapses[0]!.what} runs out before they would bring it back.`,
      'NOT_LENDABLE',
    );
  }
}

/** What the workshop is owed back, and when. */
export function outNow(loans: readonly Loan[], now = new Date()): Loan[] {
  return loans
    .filter((loan) => ['OUT', 'OVERDUE'].includes(loanStanding(loan, now)))
    .sort((a, b) => a.dueBackAt.getTime() - b.dueBackAt.getTime());
}

/** How many are late, for a figure on a screen somebody already reads. */
export function overdueCount(loans: readonly Loan[], now = new Date()): number {
  return loans.filter((loan) => loanStanding(loan, now) === 'OVERDUE').length;
}
