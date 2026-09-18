/**
 * What real workshops do that tidy software does not expect. Phase 53.
 *
 * Every one of these is a thing that happens in a garage on an ordinary
 * Tuesday and that a system designed from a flowchart has no answer for. The
 * danger is not that they are hard; most are a few lines. The danger is that
 * nobody decides, so the behaviour is whatever the code happens to do — which
 * is usually an exception in front of somebody holding a customer's keys, or,
 * worse, a silent write that makes the books wrong in a way nobody finds for
 * a year.
 *
 * So each one is written down here with the decision and the reason, and
 * `verify-awkward.ts` holds the product to it. A case whose decision is
 * "refuse, with this sentence" is as decided as one whose decision is "allow
 * it and record why", and either is better than finding out in a pilot.
 *
 * The register is in core rather than in a document because a decision that
 * lives only in prose drifts from the code within a month. This way the test
 * and the reason are the same artefact.
 */

export interface AwkwardCase {
  /** What happens in the workshop, in the words somebody would use. */
  situation: string;
  /** What the product does about it. */
  decision: string;
  /** Why that, rather than the obvious alternative. */
  because: string;
}

export const AWKWARD: Record<string, AwkwardCase> = {
  sharedCar: {
    situation: 'Two customers share a car — a couple, or a company and its driver.',
    decision:
      'The vehicle belongs to whoever is recorded as its owner, and every workshop that has worked on it keeps its own access. A second customer with a job on the same car is normal and needs no resolution.',
    because:
      'A car is not owned by a workshop, and forcing one customer per vehicle is what makes systems invent a duplicate car. The passport follows the vehicle; the invoice follows whoever brought it in.',
  },

  missingVin: {
    situation: 'A car arrives with no VIN, or with a VIN typed wrong.',
    decision:
      'A vehicle may be recorded without a VIN. A VIN that is present must be seventeen characters and must not contain I, O or Q, and a second vehicle may not claim a VIN that is already on record.',
    because:
      'Refusing the car until somebody finds the VIN stops the work. Accepting two cars with the same VIN makes one history out of two vehicles, which cannot be untangled afterwards.',
  },

  plateChanged: {
    situation: 'A customer puts a private plate on the car, or takes one off.',
    decision:
      'The registration changes on the vehicle and the old one is kept on the record, because the passport is against the VIN rather than the plate.',
    because:
      'A plate is a label, not an identity. A history that follows the plate is a history that a private plate can be used to hide.',
  },

  cancelledAfterParts: {
    situation: 'A job is cancelled after the parts have arrived.',
    decision:
      'Cancelling releases what was reserved and leaves what was consumed on the shelf as consumed. Parts already fitted are not un-fitted by a status change, and anything ordered specially stays ordered — the workshop has bought it.',
    because:
      'Stock is physical. A cancellation is an administrative act and cannot move a part that is already in a car or on a van.',
  },

  reopened: {
    situation: 'A job is finished and then has to be reopened — the fault came back.',
    decision:
      'A completed job is not reopened. The comeback is a new job linked to the old one, so both histories stay true and the second one can be charged at nothing without pretending the first never finished.',
    because:
      'Reopening rewrites a record somebody has already been invoiced against. Linking preserves what actually happened, which is what a warranty argument turns on.',
  },

  halfApproved: {
    situation: 'A customer approves half the quote.',
    decision:
      'Each line is approved or not, the estimate records which, and only the approved lines become work. The rest stay quoted and can be approved later without a new quote.',
    because:
      'All-or-nothing approval trains a workshop to quote small so as not to be refused, which is worse for both sides than an honest quote partly accepted.',
  },

  priceMovedAfterApproval: {
    situation:
      'The price of a part moves between the quote being approved and the work being done.',
    decision:
      'The approved price is what the customer is charged. A supplier increase is the workshop’s to absorb or to re-quote, and re-quoting means asking again.',
    because:
      'An approval is an agreement about a number. Silently invoicing a different one is the single fastest way to lose a customer, and it is also unenforceable.',
  },

  overpayment: {
    situation: 'A customer pays more than the bill.',
    decision:
      'A payment larger than the bill is refused, and the refusal says what to do instead. One press on the invoice then settles the bill exactly and holds the difference as credit on the customer’s account.',
    because:
      'An amount larger than the bill is as likely to be a mis-key as a customer paying ahead, and the product cannot tell which by looking at it — so it asks. What it must not do is make the person work out the split by hand on another page while somebody waits, which is what naming an action the page did not offer amounted to.',
  },

  duplicatePayment: {
    situation: 'The same payment is taken twice — a double-click, or a card machine retried.',
    decision:
      'A repeat of the same request is absorbed and changes nothing. A second, genuinely separate payment goes through and leaves the invoice overpaid, which is the case above.',
    because:
      'The product cannot tell a mistake from a deliberate second payment by looking at the amount. It can tell by whether it is the same request, which is what the idempotency key is for.',
  },

  refundAfterClose: {
    situation: 'A refund has to be made against a period that has already been closed.',
    decision:
      'The refund is posted in the open period, dated today, referencing the original. The closed period is never touched.',
    because:
      'A closed period is a figure somebody has already reported. Reaching back into it makes every statement taken from it wrong retrospectively, which is worse than a refund appearing in the month it was actually paid.',
  },

  negativeStock: {
    situation: 'The shelf says two and there is one, or says nought and there is one.',
    decision:
      'Stock is allowed to go negative rather than blocking the work, and the discrepancy is visible. A stocktake is how it is corrected, and it posts the variance to the ledger.',
    because:
      'Refusing to let a technician fit a part that is physically in their hand is software arguing with reality. Recording that the count is wrong is useful; stopping the job is not.',
  },

  stocktakeDuringJob: {
    situation: 'A stocktake happens while a job has parts reserved.',
    decision:
      'The count is of what is on the shelf. Reserved stock is not on the shelf and is not counted, so a stocktake does not release or disturb a reservation.',
    because:
      'A reservation is a promise about stock the workshop still has. Counting it as missing would make every stocktake during a busy week look like theft.',
  },

  ownershipOnTheRamp: {
    situation: 'The car is sold while it is in for work.',
    decision:
      'Ownership transfers on the vehicle and the job stays with the customer who brought it in. The new owner gets the passport from the moment they own it; the old owner keeps the invoice.',
    because:
      'Whoever is liable for this bill is whoever agreed to the work. Moving the invoice with the car would hand a stranger somebody else’s debt.',
  },
};

/** Every case, for a page or a script that wants to walk them. */
export const AWKWARD_KEYS = Object.keys(AWKWARD);

/* ---------------------------------------------------------------------------
   The two that are arithmetic rather than policy
   --------------------------------------------------------------------------- */

/**
 * What a payment does to a bill when it is more than the bill.
 *
 * Split rather than clamped: the invoice is settled exactly, and the rest is
 * credit. Clamping the payment to the invoice total would mean the money
 * received and the money recorded disagree, which is the one thing a ledger
 * must never do.
 */
export function splitOverpayment(input: {
  /** In minor units. */
  paid: number;
  outstanding: number;
}): { settles: number; credit: number } {
  if (input.paid <= input.outstanding) {
    return { settles: input.paid, credit: 0 };
  }

  return { settles: input.outstanding, credit: input.paid - input.outstanding };
}

/**
 * What a partly approved quote comes to.
 *
 * The approved lines, and nothing else. A line nobody answered is not a line
 * refused: it stays quoted, so the customer can say yes to it next week
 * without the workshop having to write the quote again.
 */
export function approvedPortion<T extends { id: string; totalMinor: number }>(
  lines: readonly T[],
  approvedIds: readonly string[],
): { approved: T[]; stillQuoted: T[]; approvedMinor: number } {
  const chosen = new Set(approvedIds);

  const approved = lines.filter((line) => chosen.has(line.id));
  const stillQuoted = lines.filter((line) => !chosen.has(line.id));

  return {
    approved,
    stillQuoted,
    approvedMinor: approved.reduce((total, line) => total + line.totalMinor, 0),
  };
}

/**
 * Whether a VIN is one a vehicle could actually have.
 *
 * Seventeen characters, and never I, O or Q — those three are excluded from
 * the standard precisely because they are misread as 1, 0 and 0. An empty VIN
 * is allowed, because a car with no VIN to hand still has to be booked in.
 */
export function vinLooksReal(vin: string | null | undefined): boolean {
  if (!vin) return true;

  const trimmed = vin.trim().toUpperCase();

  return trimmed.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(trimmed);
}
