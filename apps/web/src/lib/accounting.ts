import {
  type AccountType,
  assertBalanced,
  fromDecimal,
  type JournalEntryDraft,
  type PostedLine,
  STANDARD_CHART,
  subtract,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { isAlreadyDone } from './repeat';

/**
 * The ledger, against the database.
 *
 * The arithmetic lives in `@carnet/core`; this module is the transaction
 * boundary. Two things are enforced here that the domain cannot know about:
 * an entry is never posted into a closed period, and an entry is never
 * posted twice for the same source document.
 */

/** Creates the chart of accounts for an organisation if it has none. *
 * @repeat HARMLESS(OVERWRITE: only the accounts the workshop is missing) The
 * second call finds nothing missing and writes nothing.
 */
export async function ensureChartOfAccounts(orgId: string): Promise<number> {
  // Fills in whatever the standard chart has that this organisation does not,
  // so an account added to the chart in a later phase (loyalty rewards, in
  // Phase 24) reaches every existing workshop the first time it is needed.
  const existing = new Set(
    (await prisma.account.findMany({ where: { orgId }, select: { code: true } })).map(
      (row) => row.code,
    ),
  );
  const missing = STANDARD_CHART.filter((account) => !existing.has(account.code));
  if (missing.length === 0) return 0;

  await prisma.account.createMany({
    data: missing.map((account) => ({
      orgId,
      code: account.code,
      name: account.name,
      type: account.type as never,
    })),
  });

  return missing.length;
}

export class LedgerError extends Error {
  readonly code: 'CLOSED_PERIOD' | 'UNKNOWN_ACCOUNT' | 'ALREADY_POSTED';
  constructor(code: LedgerError['code'], message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

/**
 * Posts a journal entry.
 *
 * Idempotent on (sourceType, sourceId, reference): an operational event that
 * is retried, or a worker that redelivers, must not double-count revenue. The
 * outbox is at-least-once, so this is not a theoretical concern.
 *
 * @repeat GUARDED(CONSTRAINT: journal_entries_one_per_document) One posting
 * per source document. Every money function posts outside the transaction
 * that wrote its document so a ledger failure cannot undo it; this is what
 * makes that retry free.
 */
export async function postEntry(
  orgId: string,
  draft: JournalEntryDraft,
): Promise<{ id: string; posted: boolean }> {
  assertBalanced(draft);

  try {
    return await posting(orgId, draft);
  } catch (error) {
    // The other retry got here first. A constraint violation aborts the
    // transaction it happened in, so the entry that won has to be read
    // outside it — which is why this sits here rather than around the create.
    if (!isAlreadyDone(error, 'journal_entries_one_per_document')) throw error;

    const posted = await prisma.journalEntry.findFirstOrThrow({
      where: {
        orgId,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        reference: draft.reference,
      },
      select: { id: true },
    });

    return { id: posted.id, posted: false };
  }
}

async function posting(
  orgId: string,
  draft: JournalEntryDraft,
): Promise<{ id: string; posted: boolean }> {
  return prisma.$transaction(async (tx) => {
    // Looked for first because that is the usual path and the cheap one. The
    // unique index below is what decides it when two retries arrive at once,
    // which is precisely the case this design creates: every money function
    // posts outside the transaction that wrote its document, so that a ledger
    // having a bad second cannot undo money already handed over. Phase 46.
    const existing = await tx.journalEntry.findFirst({
      where: {
        orgId,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        reference: draft.reference,
      },
      select: { id: true },
    });

    if (existing) return { id: existing.id, posted: false };

    // A closed period is closed. Posting into one silently changes a figure
    // somebody has already reported.
    const period = await tx.fiscalPeriod.findFirst({
      where: { orgId, startsAt: { lte: draft.postedAt }, endsAt: { gte: draft.postedAt } },
      select: { id: true, isClosed: true, name: true },
    });

    if (period?.isClosed) {
      throw new LedgerError(
        'CLOSED_PERIOD',
        `Period "${period.name}" is closed. Post the correction into the open period instead.`,
      );
    }

    const accounts = await tx.account.findMany({
      where: { orgId, code: { in: draft.lines.map((line) => line.accountCode) } },
      select: { id: true, code: true },
    });

    const byCode = new Map(accounts.map((account) => [account.code, account.id]));
    const missing = draft.lines.map((line) => line.accountCode).filter((code) => !byCode.has(code));

    if (missing.length > 0) {
      throw new LedgerError(
        'UNKNOWN_ACCOUNT',
        `No account for code ${[...new Set(missing)].join(', ')}. Run the chart of accounts setup.`,
      );
    }

    const entry = await tx.journalEntry.create({
      data: {
        orgId,
        periodId: period?.id ?? null,
        reference: draft.reference,
        description: draft.description,
        postedAt: draft.postedAt,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        lines: {
          create: draft.lines.map((line, index) => ({
            accountId: byCode.get(line.accountCode)!,
            debit: toNumber(line.debit),
            credit: toNumber(line.credit),
            memo: line.memo ?? null,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });

    return { id: entry.id, posted: true };
  });
}

/**
 * Every posted line, shaped for the statement functions.
 *
 * Statements are computed from these rather than stored, so a report can never
 * drift from the entries behind it.
 */
export async function postedLines(
  orgId: string,
  range?: { from?: Date; to?: Date },
): Promise<PostedLine[]> {
  const lines = await prisma.journalLine.findMany({
    where: {
      entry: {
        orgId,
        ...(range?.from || range?.to
          ? {
              postedAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
    },
    include: {
      account: { select: { code: true, name: true, type: true } },
      entry: { select: { postedAt: true } },
    },
  });

  return lines.map((line) => ({
    accountCode: line.account.code,
    accountName: line.account.name,
    accountType: line.account.type as AccountType,
    debit: fromDecimal(line.debit.toString()),
    credit: fromDecimal(line.credit.toString()),
    postedAt: line.entry.postedAt,
  }));
}

/** Outstanding customer invoices, for the aged debtors analysis. */
export async function openReceivables(orgId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { orgId, status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] } },
    include: { customer: { select: { displayName: true } } },
  });

  return invoices
    .map((invoice) => ({
      id: invoice.id,
      reference: invoice.number,
      partyName: invoice.customer.displayName,
      outstanding: subtract(
        fromDecimal(invoice.total.toString(), invoice.currency),
        fromDecimal(invoice.amountPaid.toString(), invoice.currency),
      ),
      dueAt: invoice.dueAt,
    }))
    .filter((row) => row.outstanding.minor > 0);
}

/** Outstanding supplier bills, for aged creditors. */
export async function openPayables(orgId: string) {
  const bills = await prisma.supplierBill.findMany({
    where: { orgId, status: { in: ['AWAITING', 'APPROVED', 'PART_PAID', 'DISPUTED'] } },
    include: { supplier: { select: { name: true } } },
  });

  return bills
    .map((bill) => ({
      id: bill.id,
      reference: bill.reference,
      partyName: bill.supplier.name,
      outstanding: subtract(
        fromDecimal(bill.total.toString()),
        fromDecimal(bill.amountPaid.toString()),
      ),
      dueAt: bill.dueAt,
    }))
    .filter((row) => row.outstanding.minor > 0);
}
