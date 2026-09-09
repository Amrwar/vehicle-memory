/**
 * Proves the books.
 *
 *   npx tsx infra/scripts/verify-ledger.ts
 *
 * A ledger that does not balance is worse than no ledger, because every figure
 * derived from it still looks like a number. This checks the three things that
 * must hold, and tries to break the two the database is supposed to refuse.
 */

import 'dotenv/config';

import {
  ageAnalysis,
  balanceSheet,
  profitAndLoss,
  taxReturn,
  toDecimalString,
  trialBalance,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { openPayables, openReceivables, postedLines } from '../../apps/web/src/lib/accounting';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow();

  console.info(`\n  Ledger integrity, ${org.name}\n`);

  const lines = await postedLines(org.id);
  const balance = trialBalance(lines);
  const pl = profitAndLoss(lines);
  const sheet = balanceSheet(lines);
  const vat = taxReturn(lines);

  check('postings exist', lines.length > 0, `${lines.length} lines`);
  check(
    'trial balance balances',
    balance.balanced,
    `Dr ${toDecimalString(balance.totalDebits)} / Cr ${toDecimalString(balance.totalCredits)}`,
  );
  check(
    'balance sheet balances',
    sheet.balanced,
    `assets ${toDecimalString(sheet.totalAssets)} vs claims ${toDecimalString(sheet.difference)} out`,
  );

  // Every entry must balance on its own, not merely in aggregate. Two opposite
  // errors that cancel across the whole ledger still corrupt both accounts.
  const entries = await prisma.journalEntry.findMany({
    where: { orgId: org.id },
    include: { lines: true },
  });

  const unbalanced = entries.filter((entry) => {
    const debits = entry.lines.reduce((total, line) => total + Number(line.debit), 0);
    const credits = entry.lines.reduce((total, line) => total + Number(line.credit), 0);
    return Math.abs(debits - credits) > 0.005;
  });

  check(
    'every entry balances individually',
    unbalanced.length === 0,
    unbalanced.length ? unbalanced.map((entry) => entry.reference).join(', ') : `${entries.length} entries`,
  );

  const orphaned = entries.filter((entry) => entry.lines.length === 0);
  check('no empty entries', orphaned.length === 0);

  // The database refuses a line that is both a debit and a credit.
  const account = await prisma.account.findFirstOrThrow({ where: { orgId: org.id } });
  const victim = entries[0]!;

  let refused = false;
  try {
    await prisma.journalLine.create({
      data: { entryId: victim.id, accountId: account.id, debit: 10, credit: 10 },
    });
  } catch {
    refused = true;
  }
  check('database refuses a debit-and-credit line', refused);

  // And it refuses an entry whose lines do not balance, at commit time.
  refused = false;
  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          orgId: org.id,
          reference: 'PROBE-UNBALANCED',
          description: 'Should never commit',
          sourceType: 'Probe',
          sourceId: 'probe',
        },
      });
      await tx.journalLine.create({
        data: { entryId: entry.id, accountId: account.id, debit: 100, credit: 0 },
      });
    });
  } catch {
    refused = true;
  }
  check('database refuses an unbalanced entry', refused);

  const survived = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, reference: 'PROBE-UNBALANCED' },
  });
  check('the refused entry left nothing behind', survived === null);

  // The report and the account must agree. When they drift, one of them is
  // lying and there is no way to tell which from either page alone.
  const debtors = ageAnalysis(await openReceivables(org.id));
  const creditors = ageAnalysis(await openPayables(org.id));

  const receivableAccount = balance.rows.find((row) => row.accountCode === '1100');
  const payableAccount = balance.rows.find((row) => row.accountCode === '2000');

  check(
    'aged debtors ties to the receivable account',
    (receivableAccount?.balance.minor ?? 0) === debtors.total.minor,
    `account ${toDecimalString(receivableAccount?.balance ?? debtors.total)} vs report ${toDecimalString(debtors.total)}`,
  );

  check(
    'aged creditors does not exceed the payable account',
    (payableAccount?.balance.minor ?? 0) >= creditors.total.minor,
    `account ${toDecimalString(payableAccount?.balance ?? creditors.total)} vs report ${toDecimalString(creditors.total)}`,
  );

  console.info('');
  console.info(`  Revenue          ${toDecimalString(pl.totalRevenue)}`);
  console.info(`  Gross profit     ${toDecimalString(pl.grossProfit)}  (${pl.grossMarginPct}%)`);
  console.info(`  Net profit       ${toDecimalString(pl.netProfit)}  (${pl.netMarginPct}%)`);
  console.info(`  Total assets     ${toDecimalString(sheet.totalAssets)}`);
  console.info(`  Liabilities      ${toDecimalString(sheet.totalLiabilities)}`);
  console.info(`  Equity           ${toDecimalString(sheet.totalEquity)}`);
  console.info(`  VAT ${vat.owed ? 'owed' : 'reclaimable'}     ${toDecimalString(vat.net)}`);

  console.info(`  Owed to you      ${toDecimalString(debtors.total)}`);
  console.info(`  Owed by you      ${toDecimalString(creditors.total)}`);

  console.info(`\n  ${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
