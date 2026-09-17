import {
  type AccountType,
  add,
  AGE_BOUNDARIES,
  AGE_BUCKETS,
  type AgeBucket,
  type AgedAnalysis,
  assertBalanced,
  bucketFor,
  type Currency,
  fromDecimal,
  type JournalEntryDraft,
  type Money,
  type PostedLine,
  STANDARD_CHART,
  subtract,
  sum,
  toNumber,
  zero,
} from '@carnet/core';
import { Prisma, prisma } from '@carnet/db';

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
/**
 * Aged debt, summed in the database and listed only as far as anybody reads.
 *
 * The version before this one fetched every unpaid bill with its customer
 * joined on, and bucketed them in memory. That is correct and it is fine at
 * six bills. At a hundred and thirty thousand it is twelve seconds and most of
 * a gigabyte, which is what Phase 51 found by putting the rows in and looking.
 *
 * Two queries instead. The totals per bucket come back as five rows whatever
 * the size of the ledger, because a total is the one thing that has to include
 * every bill and the one thing the database is best at. The documents come
 * back worst-first and bounded, because nobody reads the hundred-thousandth
 * row of an aged debt list.
 *
 * The bucket boundaries are `AGE_BOUNDARIES` from core rather than numbers
 * written here: two copies of 30, 60 and 90 would drift the first time one was
 * changed, and the drift would be silent — the totals would still add up,
 * against different definitions.
 */
async function agedIn(
  orgId: string,
  asOf: Date,
  currency: Currency,
  what: 'receivable' | 'payable',
  take: number,
): Promise<AgedAnalysis> {
  const owed =
    what === 'receivable'
      ? Prisma.sql`SELECT i."id", i."number" AS reference, c."displayName" AS party,
                          i."dueAt", (i."total" - i."amountPaid")::text AS outstanding
                   FROM "invoices" i
                   JOIN "customers" c ON c."id" = i."customerId"
                   WHERE i."orgId" = ${orgId}
                     AND i."status" IN ('ISSUED', 'PART_PAID', 'OVERDUE')
                     AND i."total" - i."amountPaid" > 0`
      : Prisma.sql`SELECT b."id", b."reference" AS reference, s."name" AS party,
                          b."dueAt", (b."total" - b."amountPaid")::text AS outstanding
                   FROM "supplier_bills" b
                   JOIN "suppliers" s ON s."id" = b."supplierId"
                   WHERE b."orgId" = ${orgId}
                     AND b."status" IN ('AWAITING', 'APPROVED', 'PART_PAID', 'DISPUTED')
                     AND b."total" - b."amountPaid" > 0`;

  // The CASE is built from the boundaries so there is one definition of a
  // bucket in the product, not two.
  const branches = AGE_BOUNDARIES.filter((one) => one.upToDays !== null).map(
    (one) =>
      Prisma.sql`WHEN floor(extract(epoch FROM (${asOf}::timestamp - coalesce(o."dueAt", ${asOf}::timestamp))) / 86400) <= ${one.upToDays} THEN ${one.bucket}`,
  );

  const bucketed = Prisma.sql`
    SELECT CASE ${Prisma.join(branches, ' ')} ELSE ${'90+'} END AS bucket,
           sum(o.outstanding::numeric)::text AS total
    FROM (${owed}) AS o
    GROUP BY 1`;

  const [totals, worst] = await Promise.all([
    prisma.$queryRaw<{ bucket: AgeBucket; total: string }[]>(bucketed),
    prisma.$queryRaw<
      { id: string; reference: string; party: string; dueAt: Date | null; outstanding: string }[]
    >(Prisma.sql`
      SELECT * FROM (${owed}) AS o
      ORDER BY o."dueAt" ASC NULLS LAST
      LIMIT ${take}`),
  ]);

  const buckets = Object.fromEntries(
    AGE_BUCKETS.map((bucket) => [bucket, zero(currency)]),
  ) as Record<AgeBucket, Money>;

  for (const row of totals) {
    buckets[row.bucket] = fromDecimal(row.total, currency);
  }

  const documents = worst.map((row) => {
    const outstanding = fromDecimal(row.outstanding, currency);

    return {
      id: row.id,
      reference: row.reference,
      partyName: row.party,
      dueAt: row.dueAt,
      outstanding,
      bucket: bucketFor(row.dueAt, asOf),
      daysOverdue: row.dueAt
        ? Math.max(0, Math.floor((asOf.getTime() - row.dueAt.getTime()) / 86_400_000))
        : 0,
    };
  });

  return {
    buckets,
    total: sum(Object.values(buckets), currency),
    documents,
    atRisk: add(buckets['61-90'], buckets['90+']),
  };
}

/** What customers owe, aged. Bounded: FR-8601. */
export async function agedReceivables(
  orgId: string,
  asOf: Date,
  currency: Currency = 'GBP',
  take = 100,
): Promise<AgedAnalysis> {
  return agedIn(orgId, asOf, currency, 'receivable', take);
}

/** What the workshop owes, aged. */
export async function agedPayables(
  orgId: string,
  asOf: Date,
  currency: Currency = 'GBP',
  take = 100,
): Promise<AgedAnalysis> {
  return agedIn(orgId, asOf, currency, 'payable', take);
}

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
