import { type Money, money, subtract, sum, zero } from '../shared/money';

/**
 * Reconciling the bank.
 *
 * The ledger balances today, and it balances against itself. That proves the
 * arithmetic was consistent, not that it was right. Reconciliation is what
 * makes it balance against reality, and until the bank agrees a trial balance
 * is a well-formed opinion.
 *
 * The hard part is not the matching, it is the confidence. A rule that pairs
 * things a bit too eagerly does more damage than one that matches nothing,
 * because a wrong match is invisible: both sides tick, the balance agrees, and
 * two unrelated transactions have been silently reconciled against each other.
 * So every suggestion here carries why it was made, and only the exact ones
 * are safe to apply without somebody looking.
 */

/**
 * Named for a bank statement specifically.
 *
 * The accounting module already exports a StatementLine, meaning a line on a
 * profit and loss. Two different things under one name in a shared barrel is a
 * compile error, and silently picking a winner would be worse.
 */
export interface BankStatementLine {
  id: string;
  /** Date the bank says the money moved. */
  at: Date;
  description: string;
  /** Positive is money in, negative is money out. */
  amount: Money;
  reference: string | null;
}

export interface LedgerCandidate {
  id: string;
  at: Date;
  description: string;
  amount: Money;
  reference: string | null;
  /** What produced it: an invoice payment, a supplier bill, an expense. */
  sourceType: string;
}

export type MatchConfidence = 'EXACT' | 'LIKELY' | 'POSSIBLE';

export interface Match {
  statementLineId: string;
  candidateId: string;
  confidence: MatchConfidence;
  /** In the words somebody reviewing it would use. */
  reason: string;
  daysApart: number;
}

/** How far apart two records can be and still be the same event. */
const WINDOW_DAYS = 5;

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

/** Reference matching ignores punctuation, which nobody types consistently. */
function normalise(value: string | null): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Suggests matches, ranked, with the reason attached.
 *
 * Each candidate is used at most once. Without that, one statement line can
 * claim the same payment as three others, and the reconciliation looks
 * complete while three payments are still outstanding.
 */
export function suggestMatches(
  statement: readonly BankStatementLine[],
  candidates: readonly LedgerCandidate[],
): Match[] {
  const taken = new Set<string>();
  const matches: Match[] = [];

  // Exact reference first, then exact amount, then near amounts. Working
  // strongest-first means a weak rule never steals a pairing a strong one
  // would have made.
  const passes: {
    confidence: MatchConfidence;
    fits: (line: BankStatementLine, candidate: LedgerCandidate) => string | null;
  }[] = [
    {
      confidence: 'EXACT',
      fits: (line, candidate) => {
        const reference = normalise(line.reference) || normalise(line.description);
        const theirs = normalise(candidate.reference);

        if (theirs.length >= 4 && reference.includes(theirs)) {
          return candidate.amount.minor === line.amount.minor
            ? `The reference ${candidate.reference} appears on the statement, and the amount agrees.`
            : null;
        }

        return null;
      },
    },
    {
      confidence: 'LIKELY',
      fits: (line, candidate) =>
        candidate.amount.minor === line.amount.minor &&
        daysBetween(line.at, candidate.at) <= WINDOW_DAYS
          ? `Same amount, ${daysBetween(line.at, candidate.at)} day${daysBetween(line.at, candidate.at) === 1 ? '' : 's'} apart.`
          : null,
    },
    {
      confidence: 'POSSIBLE',
      fits: (line, candidate) => {
        const difference = Math.abs(candidate.amount.minor - line.amount.minor);
        const within =
          difference > 0 && difference <= Math.max(50, Math.abs(line.amount.minor) * 0.01);

        return within && daysBetween(line.at, candidate.at) <= WINDOW_DAYS
          ? `Close on amount and date, off by ${(difference / 100).toFixed(2)}. Check before accepting.`
          : null;
      },
    },
  ];

  for (const pass of passes) {
    for (const line of statement) {
      if (matches.some((match) => match.statementLineId === line.id)) continue;

      for (const candidate of candidates) {
        if (taken.has(candidate.id)) continue;

        const reason = pass.fits(line, candidate);
        if (!reason) continue;

        taken.add(candidate.id);
        matches.push({
          statementLineId: line.id,
          candidateId: candidate.id,
          confidence: pass.confidence,
          reason,
          daysApart: daysBetween(line.at, candidate.at),
        });
        break;
      }
    }
  }

  return matches;
}

/**
 * Matches safe to apply without somebody reading them.
 *
 * Only the exact ones. A likely match is usually right, and "usually" is not
 * a standard to reconcile a bank account to.
 */
export function autoApplicable(matches: readonly Match[]): Match[] {
  return matches.filter((match) => match.confidence === 'EXACT');
}

/* ---------------------------------------------------------------------------
   Where a reconciliation stands
   --------------------------------------------------------------------------- */

export interface ReconciliationState {
  /** What the bank says the account holds. */
  statementBalance: Money;
  /** What the ledger says, from postings to the bank account. */
  ledgerBalance: Money;
  /** Statement lines with nothing in the ledger to pair with. */
  unmatchedOnStatement: BankStatementLine[];
  /** Ledger entries the bank has not shown yet. */
  unmatchedInLedger: LedgerCandidate[];
  difference: Money;
  reconciled: boolean;
  /** Reads as the explanation an accountant would write. */
  explanation: string;
}

export function reconciliationState(input: {
  statementBalance: Money;
  ledgerBalance: Money;
  statement: readonly BankStatementLine[];
  candidates: readonly LedgerCandidate[];
  matches: readonly Match[];
  currency?: string;
}): ReconciliationState {
  const currency = input.currency ?? 'GBP';

  const matchedLines = new Set(input.matches.map((match) => match.statementLineId));
  const matchedCandidates = new Set(input.matches.map((match) => match.candidateId));

  const unmatchedOnStatement = input.statement.filter((line) => !matchedLines.has(line.id));
  const unmatchedInLedger = input.candidates.filter(
    (candidate) => !matchedCandidates.has(candidate.id),
  );

  const difference = subtract(input.statementBalance, input.ledgerBalance);
  const reconciled = difference.minor === 0;

  const outstanding = sum(
    unmatchedInLedger.map((candidate) => candidate.amount),
    currency,
  );

  const unseen = sum(
    unmatchedOnStatement.map((line) => line.amount),
    currency,
  );

  return {
    statementBalance: input.statementBalance,
    ledgerBalance: input.ledgerBalance,
    unmatchedOnStatement,
    unmatchedInLedger,
    difference,
    reconciled,
    explanation: reconciled
      ? 'The bank and the ledger agree.'
      : explain(
          difference,
          outstanding,
          unseen,
          unmatchedInLedger.length,
          unmatchedOnStatement.length,
        ),
  };
}

function explain(
  difference: Money,
  outstanding: Money,
  unseen: Money,
  ledgerCount: number,
  statementCount: number,
): string {
  const parts: string[] = [`The bank and the ledger differ by ${format(difference)}.`];

  if (ledgerCount > 0) {
    parts.push(
      `${ledgerCount} posting${ledgerCount === 1 ? '' : 's'} worth ${format(outstanding)} ${ledgerCount === 1 ? 'has' : 'have'} not appeared on the statement yet, which is normal for a cheque or a card payment still settling.`,
    );
  }

  if (statementCount > 0) {
    parts.push(
      `${statementCount} line${statementCount === 1 ? '' : 's'} worth ${format(unseen)} ${statementCount === 1 ? 'is' : 'are'} on the statement with nothing recorded against ${statementCount === 1 ? 'it' : 'them'}. That is usually a bank charge, a direct debit or a payment nobody entered.`,
    );
  }

  return parts.join(' ');
}

/* ---------------------------------------------------------------------------
   Closing a period
   --------------------------------------------------------------------------- */

export interface CloseCheck {
  label: string;
  passed: boolean;
  detail: string;
  /** A failed blocking check stops the close; the rest are warnings. */
  blocking: boolean;
}

export class PeriodCloseError extends Error {
  readonly failures: CloseCheck[];

  constructor(failures: CloseCheck[]) {
    super(`This period cannot be closed: ${failures.map((f) => f.label).join('; ')}.`);
    this.name = 'PeriodCloseError';
    this.failures = failures;
  }
}

/**
 * Whether a period is fit to close.
 *
 * Closing is the point after which figures stop moving, so everything that
 * would have changed them has to have happened first. The blocking checks are
 * the ones where closing would make a wrong number permanent; the rest are
 * advice, because a workshop that always has one unreconciled bank charge
 * should still be able to close its quarter.
 */
export function closeChecks(input: {
  trialBalanced: boolean;
  unpostedJobs: number;
  draftInvoices: number;
  unreconciledBankLines: number;
  openTills: number;
  unapprovedTimesheets: number;
}): CloseCheck[] {
  return [
    {
      label: 'The trial balance balances',
      passed: input.trialBalanced,
      detail: input.trialBalanced
        ? 'Debits equal credits.'
        : 'Debits and credits disagree. Closing would make that permanent.',
      blocking: true,
    },
    {
      label: 'Every completed job is invoiced',
      passed: input.unpostedJobs === 0,
      detail:
        input.unpostedJobs === 0
          ? 'Nothing finished is still waiting to be billed.'
          : `${input.unpostedJobs} completed job${input.unpostedJobs === 1 ? '' : 's'} not yet invoiced. Their revenue belongs in this period.`,
      blocking: true,
    },
    {
      label: 'No till is still open',
      passed: input.openTills === 0,
      detail:
        input.openTills === 0
          ? 'Every drawer has been counted.'
          : `${input.openTills} till${input.openTills === 1 ? ' is' : 's are'} still open. Cash counted after the close lands in the wrong period.`,
      blocking: true,
    },
    {
      label: 'Draft invoices',
      passed: input.draftInvoices === 0,
      detail:
        input.draftInvoices === 0
          ? 'None outstanding.'
          : `${input.draftInvoices} draft${input.draftInvoices === 1 ? '' : 's'} will not be counted until issued.`,
      blocking: false,
    },
    {
      label: 'Bank reconciled',
      passed: input.unreconciledBankLines === 0,
      detail:
        input.unreconciledBankLines === 0
          ? 'The bank and the ledger agree.'
          : `${input.unreconciledBankLines} statement line${input.unreconciledBankLines === 1 ? '' : 's'} still unmatched.`,
      blocking: false,
    },
    {
      label: 'Timesheets approved',
      passed: input.unapprovedTimesheets === 0,
      detail:
        input.unapprovedTimesheets === 0
          ? 'All approved.'
          : `${input.unapprovedTimesheets} awaiting approval.`,
      blocking: false,
    },
  ];
}

export function assertClosable(checks: readonly CloseCheck[]): void {
  const blocking = checks.filter((check) => check.blocking && !check.passed);
  if (blocking.length > 0) throw new PeriodCloseError(blocking);
}

export function canClose(checks: readonly CloseCheck[]): boolean {
  return checks.every((check) => !check.blocking || check.passed);
}

/** Warnings worth showing even when the close is allowed. */
export function closeWarnings(checks: readonly CloseCheck[]): CloseCheck[] {
  return checks.filter((check) => !check.blocking && !check.passed);
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

/** An empty state, so a page can render an account with no statement yet. */
export function noStatement(currency = 'GBP'): ReconciliationState {
  return {
    statementBalance: zero(currency),
    ledgerBalance: zero(currency),
    unmatchedOnStatement: [],
    unmatchedInLedger: [],
    difference: money(0, currency),
    reconciled: true,
    explanation: 'No statement has been imported yet.',
  };
}
