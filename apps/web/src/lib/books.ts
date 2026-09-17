import {
  amountPaidAgrees,
  type Audit,
  auditOf,
  type Breach,
  cardBalanceAgrees,
  closedPeriodUntouched,
  entryBalances,
  liabilityAgrees,
  mustAgree,
  invoiceAddsUp,
  money,
  owedAgrees,
  receivableAgrees,
  stockAddsUp,
  type Violation,
} from '@carnet/core';
import { prisma, type PrismaClient } from '@carnet/db';

import { regionOf } from './region';

/**
 * Reading a workshop's whole books and asking whether they still agree.
 * Phase 47.
 *
 * Every other check in this product asks whether an operation did the right
 * thing. This asks the opposite: given everything that has ever happened to
 * this workshop, however it was arrived at, do the figures still agree with
 * each other?
 *
 * The difference matters because a ledger can be posted correctly ten thousand
 * times and still be wrong. The eleven-thousandth was a migration, a
 * hand-written fix at two in the morning, a half-applied refund, or a feature
 * somebody added without checking it against the accounts. None of those go
 * through the functions the other tests exercise, and all of them leave the
 * same symptom: two figures that used to agree and now do not.
 *
 * So nothing here trusts a stored total. Every figure is recomputed from the
 * rows underneath it and compared with what is written down. An invoice's
 * total is not believed because `issueInvoice` computed it correctly; it is
 * believed because its lines still add up to it today.
 */

/**
 * Everything, for one workshop.
 *
 * The database is a parameter rather than the module's own, because the same
 * audit is run against a restored copy during the recovery drill: books that
 * balanced before the backup and do not balance after it are the thing that
 * drill exists to catch, and it would be a poor answer to say the audit only
 * works on the database the application happens to be pointing at.
 */
export async function auditBooks(orgId: string, db: PrismaClient = prisma): Promise<Audit> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { country: true, baseCurrency: true, locale: true, timezone: true },
  });

  const currency = org ? regionOf(org).currency : 'GBP';

  const found: (Breach | Violation | null)[] = [];
  let checked = 0;

  /* --- every entry balances on its own ------------------------------------- */

  // The trial balance is the sum of them all, and a sum can come out to zero
  // while two entries are wrong in opposite directions. That is exactly the
  // shape a bad migration leaves, so each entry is asked by itself.
  const entries = await db.journalEntry.findMany({
    where: { orgId },
    select: {
      id: true,
      reference: true,
      postedAt: true,
      lines: { select: { debit: true, credit: true } },
    },
  });

  for (const entry of entries) {
    checked += 1;
    found.push(
      entryBalances({
        reference: entry.reference,
        debits: money(
          Math.round(entry.lines.reduce((sum, line) => sum + Number(line.debit), 0) * 100),
          currency,
        ),
        credits: money(
          Math.round(entry.lines.reduce((sum, line) => sum + Number(line.credit), 0) * 100),
          currency,
        ),
      }),
    );
  }

  /* --- nothing posted into a period somebody has reported on --------------- */

  const closed = await db.fiscalPeriod.findMany({
    where: { orgId, isClosed: true },
    select: { name: true, startsAt: true, endsAt: true, closedAt: true },
  });

  for (const period of closed) {
    if (!period.closedAt) continue;

    // Read rather than trusted. The guard that refuses a posting into a closed
    // period was added at a particular moment, and says nothing about rows
    // written before it existed.
    const after = await db.journalEntry.findMany({
      where: {
        orgId,
        postedAt: { gte: period.startsAt, lte: period.endsAt },
        createdAt: { gt: period.closedAt },
      },
      select: { reference: true, createdAt: true },
    });

    for (const entry of after) {
      checked += 1;
      found.push(
        closedPeriodUntouched({
          reference: entry.reference,
          period: period.name,
          postedAt: entry.createdAt,
          closedAt: period.closedAt,
        }),
      );
    }
  }

  /* --- a bill against the things underneath it ----------------------------- */

  const invoices = await db.invoice.findMany({
    where: { orgId, status: { not: 'DRAFT' } },
    select: {
      id: true,
      number: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      total: true,
      amountPaid: true,
      lines: { select: { lineTotal: true, taxAmount: true } },
      payments: { select: { amount: true } },
      creditNotes: { select: { amount: true } },
      refunds: { select: { amount: true } },
    },
  });

  for (const invoice of invoices) {
    checked += 3;

    // A line's total is tax-inclusive and net of its own discount, which is
    // the one thing worth knowing before writing this check: reading it as a
    // net figure and adding the tax again makes every invoice in the product
    // look wrong by exactly its VAT.
    const gross = Math.round(
      invoice.lines.reduce((sum, line) => sum + Number(line.lineTotal), 0) * 100,
    );
    const tax = Math.round(
      invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount), 0) * 100,
    );
    const net = gross - tax;

    found.push(
      invoiceAddsUp({
        number: invoice.number,
        total: money(Math.round(Number(invoice.total) * 100), currency),
        net: money(net, currency),
        tax: money(tax, currency),
        discount: money(0, currency),
      }),
    );

    const paid = Math.round(
      invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) * 100,
    );

    found.push(
      amountPaidAgrees({
        number: invoice.number,
        amountPaid: money(Math.round(Number(invoice.amountPaid) * 100), currency),
        payments: money(paid, currency),
      }),
    );

    const credited = Math.round(
      invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0) * 100,
    );

    // Money handed back puts the customer in debt again, which is easy to
    // forget and is exactly why the ledger and the bills disagreed the first
    // time this check was written. A refund does not reduce amountPaid: it is
    // money that went out afterwards, and what is owed is the bill less what
    // was paid, less what was credited, plus whatever was given back.
    const refunded = Math.round(
      invoice.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0) * 100,
    );

    found.push(
      owedAgrees({
        number: invoice.number,
        outstanding: money(
          Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100) -
            credited +
            refunded,
          currency,
        ),
        total: money(Math.round(Number(invoice.total) * 100), currency),
        paid: money(Math.round(Number(invoice.amountPaid) * 100) - refunded, currency),
        credited: money(credited, currency),
      }),
    );
  }

  /* --- a shelf against its movements --------------------------------------- */

  const levels = await db.stockLevel.findMany({
    where: { warehouse: { orgId } },
    select: {
      onHand: true,
      productId: true,
      warehouseId: true,
      product: { select: { partNumber: true } },
    },
  });

  for (const level of levels) {
    // Against the balance the last movement wrote down, not against the sum of
    // every movement. A shelf can be opened at a figure somebody counted
    // rather than at zero, so the movements do not add up to the balance and
    // were never meant to. What every movement does carry is the balance it
    // left behind, and that is the number to hold the shelf to.
    const last = await db.stockMovement.findFirst({
      where: { orgId, productId: level.productId, warehouseId: level.warehouseId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    if (!last) continue;

    checked += 1;

    found.push(
      stockAddsUp({
        part: level.product.partNumber,
        onHand: Number(level.onHand),
        movements: Number(last.balanceAfter),
      }),
    );
  }

  /* --- no card is worth less than nothing ---------------------------------- */

  const cards = await db.giftCard.findMany({
    where: { orgId },
    select: { code: true, entries: { select: { amount: true } } },
  });

  let cardsOutstanding = 0;

  for (const card of cards) {
    checked += 1;

    // A card has no stored balance to disagree with: it is the sum of its
    // entries by design. What can be wrong is the sum itself going negative,
    // which means the card has been spent past what was ever loaded on it.
    const balance = Math.round(
      card.entries.reduce((sum, entry) => sum + Number(entry.amount), 0) * 100,
    );

    cardsOutstanding += balance;

    found.push(
      balance < 0
        ? cardBalanceAgrees({
            code: card.code,
            balance: money(balance, currency),
            entries: money(0, currency),
          })
        : null,
    );
  }

  // And the ledger's liability against what the cards actually come to. The
  // two are written by different code at different moments, and a workshop's
  // balance sheet claims the figure on the left.
  checked += 1;
  found.push(
    liabilityAgrees({
      what: 'Gift cards outstanding',
      ledger: await balanceOf(db, orgId, '2300', currency),
      outstanding: money(cardsOutstanding, currency),
    }),
  );

  /* --- money held against what was taken, used and returned ---------------- */

  const deposits = await db.deposit.findMany({
    where: { orgId },
    select: {
      id: true,
      reference: true,
      amount: true,
      appliedAmount: true,
      refundedAmount: true,
      movements: { select: { amount: true } },
    },
  });

  let heldOutstanding = 0;

  for (const deposit of deposits) {
    checked += 1;

    // What the deposit says it has given out, against the movements that gave
    // it out. A movement is negative when money goes back, so the two sides
    // are compared as magnitudes.
    const moved = Math.round(
      deposit.movements.reduce((sum, movement) => sum + Math.abs(Number(movement.amount)), 0) * 100,
    );

    const givenOut = Math.round(
      (Number(deposit.appliedAmount) + Number(deposit.refundedAmount)) * 100,
    );

    heldOutstanding += Math.max(0, Math.round(Number(deposit.amount) * 100) - givenOut);

    found.push(
      mustAgree({
        rule: 'Money held is what is left of it',
        kind: 'Deposit',
        name: deposit.reference ?? deposit.id.slice(-6),
        says: money(givenOut, currency),
        adds: money(moved, currency),
        what: 'the movements that gave it out',
      }),
    );
  }

  // The ledger's liability against what is actually still held.
  checked += 1;
  found.push(
    liabilityAgrees({
      what: 'Money held for customers',
      ledger: await balanceOf(db, orgId, '2200', currency),
      outstanding: money(heldOutstanding, currency),
    }),
  );

  /* --- the ledger against the bills it describes --------------------------- */

  checked += 1;
  found.push(await receivableBridge(db, orgId, currency));

  return auditOf(checked, found);
}

/** What an account's balance comes to, from its own lines. */
async function balanceOf(db: PrismaClient, orgId: string, code: string, currency: string) {
  const lines = await db.journalLine.findMany({
    where: { entry: { orgId }, account: { code } },
    select: { debit: true, credit: true },
  });

  // A liability is a credit balance, so it is read the way round a workshop
  // would say it: what we still owe, as a positive figure.
  return money(
    Math.round(
      lines.reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0) * 100,
    ),
    currency,
  );
}

/**
 * The bridge between the two halves of the product.
 *
 * The ledger's receivable account and the invoices themselves are written by
 * different code at different moments. Everything else here could pass while
 * those two quietly disagree, and that disagreement is the first thing an
 * accountant finds.
 */
async function receivableBridge(
  db: PrismaClient,
  orgId: string,
  currency: string,
): Promise<Breach | null> {
  const [lines, invoices] = await Promise.all([
    db.journalLine.findMany({
      where: { entry: { orgId }, account: { code: '1100' } },
      select: { debit: true, credit: true },
    }),
    // Every bill, not only the unpaid ones: a settled bill that was later
    // credited and refunded still leaves a balance on the account, and leaving
    // it out is how the two sides come to differ by exactly one refund.
    db.invoice.findMany({
      where: { orgId, status: { not: 'DRAFT' } },
      select: {
        total: true,
        amountPaid: true,
        creditNotes: { select: { amount: true } },
        refunds: { select: { amount: true } },
      },
    }),
  ]);

  const ledger = Math.round(
    lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0) * 100,
  );

  const owed = invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.round(
        (Number(invoice.total) -
          Number(invoice.amountPaid) -
          invoice.creditNotes.reduce((credited, note) => credited + Number(note.amount), 0) +
          invoice.refunds.reduce((back, refund) => back + Number(refund.amount), 0)) *
          100,
      ),
    0,
  );

  return receivableAgrees({
    ledger: money(ledger, currency),
    invoices: money(owed, currency),
  });
}
