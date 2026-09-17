import { type Money, money, subtract, zero } from '../shared/money';

/**
 * What must be true of the books, whatever happened to them. Phase 47.
 *
 * Everything else in this product checks that an operation did the right
 * thing. This checks the opposite direction: given a workshop's whole
 * history, however it was arrived at, do the figures still agree with each
 * other? A ledger can be posted correctly ten thousand times and still be
 * wrong, because the eleven-thousandth was a migration, a hand-written fix,
 * a half-applied refund, or a feature nobody thought to check against the
 * accounts.
 *
 * An invariant is not a test of a function. It is a sentence that is true of
 * the data or the data is broken, and it is checked by recomputing the figure
 * from the things underneath it rather than by reading the figure back. An
 * invoice's total is not trusted because `issueInvoice` computed it; it is
 * trusted because its lines still add up to it today.
 *
 * Every breach names the document, says what the two sides came to, and gives
 * the difference. "The books do not balance" is a sentence somebody reads and
 * then has to start an investigation. "INV-1043 says £312.00 and its lines
 * come to £292.00, a difference of £20.00" is a sentence somebody acts on.
 */

export interface Breach {
  /** Which invariant failed, for grouping a long list. */
  rule: string;
  /** The document a person would go and look at. */
  document: string;
  /** What sort of thing it is, on its own so a page can translate it. */
  kind: string;
  /** Its reference, which is the same word in every language. */
  name: string;
  /** What it says. */
  says: Money;
  /** What the things underneath it come to. */
  adds: Money;
  /** says − adds, which is the figure somebody has to explain. */
  difference: Money;
  /** One sentence, naming all three. */
  sentence: string;
}

/** A breach where the difference is not the point: a rule was simply broken. */
export interface Violation {
  rule: string;
  document: string;
  kind: string;
  name: string;
  sentence: string;
  /**
   * The same sentence with its figures left as slots, so a page can put it in
   * front of somebody in their own language. A script reads `sentence`; a
   * screen reads this and fills it in.
   */
  template: string;
  values: Record<string, string | number>;
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: value.currency,
  }).format(value.minor / 100);
}

/**
 * Compares two figures that must agree, and says so when they do not.
 *
 * A tolerance is deliberately not offered. Money in this product is integer
 * minor units end to end, so there is no rounding to forgive; a penny out is
 * a bug, and a check that forgives a penny is a check that will one day
 * forgive a thousand of them.
 */
export function mustAgree(input: {
  rule: string;
  /** What sort of thing it is: "Invoice", "Entry", "Deposit". */
  kind: string;
  /** Its reference, or an empty string where the kind is the whole name. */
  name?: string;
  says: Money;
  adds: Money;
  /** Filled into the sentence: "{document} says X and {what} comes to Y". */
  what: string;
}): Breach | null {
  const difference = subtract(input.says, input.adds);
  if (difference.minor === 0) return null;

  // The kind and the reference are kept apart as well as joined. A script
  // wants the whole sentence; a page wants to translate "Invoice" and leave
  // "INV-1043" exactly as it is, and joining them too early makes the second
  // impossible.
  const document = input.name ? `${input.kind} ${input.name}` : input.kind;

  return {
    rule: input.rule,
    document,
    kind: input.kind,
    name: input.name ?? '',
    says: input.says,
    adds: input.adds,
    difference,
    sentence:
      `${document} says ${format(input.says)} and ${input.what} comes to ` +
      `${format(input.adds)}, a difference of ${format(difference)}.`,
  };
}

/* ---------------------------------------------------------------------------
   The invariants
   --------------------------------------------------------------------------- */

/**
 * Every entry balances on its own.
 *
 * The trial balance is the sum of all of them, and a sum can come out to zero
 * while two entries are wrong in opposite directions — which is exactly the
 * shape a bad migration leaves. So each entry is checked by itself.
 */
export function entryBalances(entry: {
  reference: string;
  debits: Money;
  credits: Money;
}): Breach | null {
  return mustAgree({
    rule: 'Every entry balances',
    kind: 'Entry',
    name: entry.reference,
    says: entry.debits,
    adds: entry.credits,
    what: 'its credits',
  });
}

/** An invoice is its lines, plus tax, less what was taken off. */
export function invoiceAddsUp(invoice: {
  number: string;
  total: Money;
  net: Money;
  tax: Money;
  discount: Money;
}): Breach | null {
  return mustAgree({
    rule: 'An invoice is its lines',
    kind: 'Invoice',
    name: invoice.number,
    says: invoice.total,
    adds: money(
      invoice.net.minor + invoice.tax.minor - invoice.discount.minor,
      invoice.total.currency,
    ),
    what: 'its lines plus tax less what was taken off',
  });
}

/**
 * What a bill says is paid is what was actually put against it.
 *
 * Read from the payments rather than from the running total on the invoice,
 * because the running total is the thing that drifts: it is incremented by
 * every path that settles a bill, and a path added later that forgets to
 * increment it leaves a customer looking overdue on money they have paid.
 */
export function amountPaidAgrees(invoice: {
  number: string;
  amountPaid: Money;
  payments: Money;
}): Breach | null {
  return mustAgree({
    rule: 'A bill is paid by its payments',
    kind: 'Invoice',
    name: invoice.number,
    says: invoice.amountPaid,
    adds: invoice.payments,
    what: 'the payments against it',
  });
}

/** What is still owed is the bill less what was paid and less what was credited. */
export function owedAgrees(invoice: {
  number: string;
  outstanding: Money;
  total: Money;
  paid: Money;
  credited: Money;
}): Breach | null {
  return mustAgree({
    rule: 'What is owed is what is left',
    kind: 'Invoice',
    name: invoice.number,
    says: invoice.outstanding,
    adds: money(
      invoice.total.minor - invoice.paid.minor - invoice.credited.minor,
      invoice.total.currency,
    ),
    what: 'the bill less what was paid and credited',
  });
}

/**
 * A shelf is what came in less what went out.
 *
 * In units rather than money, and the one invariant here that is not about
 * money at all — but a shelf that disagrees with its movements is how a
 * workshop ends up promising a part it does not have, which costs a morning
 * and a customer's afternoon.
 */
export function stockAddsUp(level: {
  part: string;
  onHand: number;
  movements: number;
}): Violation | null {
  if (level.onHand === level.movements) return null;

  return {
    rule: 'A shelf is its movements',
    document: level.part,
    kind: 'Part',
    name: level.part,
    sentence:
      `${level.part} says ${level.onHand} on the shelf and its movements come to ` +
      `${level.movements}, a difference of ${level.onHand - level.movements}.`,
    template:
      'Says {onHand} on the shelf, and its movements come to {movements}: a difference of {difference}.',
    values: {
      onHand: level.onHand,
      movements: level.movements,
      difference: level.onHand - level.movements,
    },
  };
}

/** A card is worth what was loaded onto it less what was spent. */
export function cardBalanceAgrees(card: {
  code: string;
  balance: Money;
  entries: Money;
}): Breach | null {
  return mustAgree({
    rule: 'A card is its entries',
    kind: 'Card',
    name: card.code,
    says: card.balance,
    adds: card.entries,
    what: 'what was loaded and spent',
  });
}

/** Money held for a customer is what was taken less what was used and returned. */
export function heldAgrees(deposit: {
  reference: string;
  held: Money;
  taken: Money;
  applied: Money;
  returned: Money;
}): Breach | null {
  return mustAgree({
    rule: 'Money held is what is left of it',
    kind: 'Deposit',
    name: deposit.reference,
    says: deposit.held,
    adds: money(
      deposit.taken.minor - deposit.applied.minor - deposit.returned.minor,
      deposit.held.currency,
    ),
    what: 'what was taken less what was used and returned',
  });
}

/**
 * Nothing is posted into a period somebody has already reported on.
 *
 * The rule that matters most to a person outside the workshop, because it is
 * the one that decides whether a figure they were given in April is still the
 * figure in June. Checked by looking rather than by trusting the guard that
 * is supposed to refuse it, since a guard added after some rows were written
 * says nothing about those rows.
 */
export function closedPeriodUntouched(entry: {
  reference: string;
  period: string;
  postedAt: Date;
  closedAt: Date;
}): Violation | null {
  if (entry.postedAt <= entry.closedAt) return null;

  return {
    rule: 'A closed period stays closed',
    document: `Entry ${entry.reference}`,
    kind: 'Entry',
    name: entry.reference,
    sentence:
      `${entry.reference} was posted into "${entry.period}" on ` +
      `${entry.postedAt.toISOString().slice(0, 10)}, after that period was closed on ` +
      `${entry.closedAt.toISOString().slice(0, 10)}.`,
    template: 'Posted into {period} on {postedAt}, after that period was closed on {closedAt}.',
    values: {
      period: entry.period,
      postedAt: entry.postedAt.toISOString().slice(0, 10),
      closedAt: entry.closedAt.toISOString().slice(0, 10),
    },
  };
}

/**
 * What the books say a customer owes is what the unpaid bills come to.
 *
 * The bridge between the two halves of the product: the ledger's receivable
 * account, and the invoices themselves. They are written by different code at
 * different moments, and everything else here could pass while these two
 * quietly disagree — which is the disagreement an accountant finds first.
 */
export function receivableAgrees(input: { ledger: Money; invoices: Money }): Breach | null {
  return mustAgree({
    rule: 'The ledger agrees with the bills',
    kind: 'Money owed by customers',
    says: input.ledger,
    adds: input.invoices,
    what: 'the unpaid bills',
  });
}

/** The same bridge, for money the workshop is holding rather than owed. */
export function liabilityAgrees(input: {
  what: string;
  ledger: Money;
  outstanding: Money;
}): Breach | null {
  return mustAgree({
    rule: 'The ledger agrees with what is owed out',
    kind: input.what,
    says: input.ledger,
    adds: input.outstanding,
    what: 'what is actually outstanding',
  });
}

/* ---------------------------------------------------------------------------
   Reading the result
   --------------------------------------------------------------------------- */

export interface Audit {
  checked: number;
  breaches: Breach[];
  violations: Violation[];
}

export function auditOf(checked: number, found: readonly (Breach | Violation | null)[]): Audit {
  const breaches: Breach[] = [];
  const violations: Violation[] = [];

  for (const one of found) {
    if (!one) continue;
    if ('difference' in one) breaches.push(one);
    else violations.push(one);
  }

  return { checked, breaches, violations };
}

/** Worst first: the biggest difference is the one somebody should look at. */
export function worstFirst(breaches: readonly Breach[]): Breach[] {
  return [...breaches].sort((a, b) => Math.abs(b.difference.minor) - Math.abs(a.difference.minor));
}

/** What the whole audit came to, in one line. */
export function describeAudit(audit: Audit, currency = 'GBP'): string {
  const wrong = audit.breaches.length + audit.violations.length;

  if (wrong === 0) return `${audit.checked} checked, everything agrees.`;

  const total = audit.breaches.reduce((sum, breach) => sum + Math.abs(breach.difference.minor), 0);

  return (
    `${audit.checked} checked, ${wrong} wrong` +
    (total > 0 ? `, ${format(money(total, currency))} unaccounted for.` : '.')
  );
}

/** Nothing unaccounted for, as a figure a deck can carry. */
export function unaccountedFor(audit: Audit, currency = 'GBP'): Money {
  return audit.breaches.reduce(
    (sum, breach) => money(sum.minor + Math.abs(breach.difference.minor), currency),
    zero(currency),
  );
}
