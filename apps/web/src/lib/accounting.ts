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
    // bounded: the standard chart is fifty accounts and a workshop adds a handful.
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
 * The same statement input, summed in the database: one row per account.
 *
 * `trialBalance()` adds the lines up per account and throws the individual
 * lines away, so fetching them one by one was carrying a year of postings
 * across the wire in order to produce forty rows. Correct, and fine at a
 * thousand lines; at a million it is the whole ledger in memory behind a page
 * somebody opens to look at forty figures.
 *
 * The shape is deliberately still `PostedLine[]`, so the statement functions
 * in core stay pure, stay tested, and do not learn what a database is. Each
 * row is one account's totals, and `postedAt` is the last posting in it —
 * there is no single moment for a sum, and the statements do not read it.
 *
 * Found in Phase 55, by asking of every list in the product the question the
 * roadmap had been answering for itself since Phase 1: what bounds this?
 */
export async function postedTotals(
  orgId: string,
  range?: { from?: Date; to?: Date },
): Promise<PostedLine[]> {
  // `Prisma.join` refuses an empty list, and a ledger read with no window is
  // the ordinary case rather than a mistake, so the clauses are composed as
  // one fragment that may be nothing at all.
  const from = range?.from ? Prisma.sql`AND e."postedAt" >= ${range.from}` : Prisma.empty;
  const to = range?.to ? Prisma.sql`AND e."postedAt" <= ${range.to}` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { code: string; name: string; type: string; debit: string; credit: string; last: Date }[]
  >`
    SELECT a."code"                  AS code,
           a."name"                  AS name,
           a."type"::text            AS type,
           SUM(l."debit")::text      AS debit,
           SUM(l."credit")::text     AS credit,
           MAX(e."postedAt")         AS last
      FROM "journal_lines" l
      JOIN "journal_entries" e ON e."id" = l."entryId"
      JOIN "accounts" a        ON a."id" = l."accountId"
     WHERE e."orgId" = ${orgId}
       ${from}
       ${to}
     GROUP BY a."code", a."name", a."type"
     ORDER BY a."code"
  `;

  return rows.map((row) => ({
    accountCode: row.code,
    accountName: row.name,
    accountType: row.type as AccountType,
    debit: fromDecimal(row.debit),
    credit: fromDecimal(row.credit),
    postedAt: row.last,
  }));
}

/**
 * Every posted line, shaped for the statement functions.
 *
 * Statements are computed from these rather than stored, so a report can never
 * drift from the entries behind it.
 *
 * The range is not optional. It was, and every caller left it out, which meant
 * four pages read every line a workshop had ever posted. Anything that only
 * wants the totals should call `postedTotals` instead; anything that genuinely
 * wants all of them passes `ALL_TIME` and says so.
 *
 * Making it required fixed the four pages and missed twenty-three calls in the
 * verification scripts, because nothing type-checked those. Phase 65.
 */
/**
 * Every line there has ever been, said out loud.
 *
 * A trial balance is cumulative by definition: it is the sum of everything
 * posted, and a bounded one is a different report. So there are callers that
 * genuinely want no bounds, and the point of making `range` required was never
 * to forbid that — it was to stop it happening by omission, which is what four
 * pages were doing.
 *
 * Passing this says the unbounded read is the intended one. Grep for it to see
 * every place that claims so, which is the property a default could not have.
 * Phase 65.
 */
export const ALL_TIME: { from?: Date; to?: Date } = {};

export async function postedLines(
  orgId: string,
  range: { from?: Date; to?: Date },
): Promise<PostedLine[]> {
  // bounded: by the range, which is no longer optional. Anything that wants only
  // the totals calls postedTotals, which sums them in the database.
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
  // bounded: bills nobody has paid yet. A workshop whose unpaid list grows without
  // limit has a problem the software cannot fix. The aged report, which does have
  // to count every one of them, sums in the database instead.
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
  // bounded: bills the workshop has not settled yet, as above.
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
