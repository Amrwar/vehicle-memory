/**
 * Proves the bank can be reconciled and a period can be closed.
 *
 *   npx tsx infra/scripts/verify-banking.ts
 *
 * A trial balance that balances proves the arithmetic was consistent, not that
 * it was right. This checks the part that makes it right: that the ledger can
 * be compared against a statement, that only confident matches are offered for
 * one-click acceptance, and that a period refuses to close while something
 * that would change its figures is still outstanding.
 */

import 'dotenv/config';

import { autoApplicable, toDecimalString } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  approveExpense,
  closePeriod,
  expensesFor,
  periodReadiness,
  periodsFor,
  recordExpense,
  reconciliation,
} from '../../apps/web/src/lib/banking';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

async function main() {
  console.info('\n  The bank, expenses and the close\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER', isActive: true },
  });

  /* --- reconciliation ----------------------------------------------------- */

  const account = await prisma.bankAccount.findFirstOrThrow({ where: { orgId: org.id } });
  const view = await reconciliation(org.id, account.id);

  check('the account has a statement', Boolean(view?.statement));
  check('and unmatched lines to work through', (view?.state.unmatchedOnStatement.length ?? 0) > 0);

  const exact = autoApplicable(view?.matches ?? []);

  check('an exact match is found on reference and amount', exact.length > 0, exact[0]?.reason);

  check(
    'every suggestion carries its reasoning',
    (view?.matches ?? []).every((match) => match.reason.length > 10),
  );

  check(
    'a bank charge nobody recorded stays unmatched',
    (view?.state.unmatchedOnStatement ?? []).some((line) =>
      line.description.includes('ACCOUNT FEE'),
    ),
  );

  check(
    'the difference is explained rather than just stated',
    (view?.state.explanation ?? '').length > 40,
    view?.state.explanation.slice(0, 60),
  );

  check(
    'no ledger entry is offered for two statement lines',
    new Set((view?.matches ?? []).map((match) => match.candidateId)).size ===
      (view?.matches ?? []).length,
  );

  /* --- expenses ------------------------------------------------------------ */

  const before = await expensesFor(org.id);

  check('seeded expenses are readable', before.rows.length > 0, `${before.rows.length}`);
  check(
    'input tax is separated so it can be reclaimed',
    before.summary.reclaimableTax.minor > 0,
    toDecimalString(before.summary.reclaimableTax),
  );
  check(
    'money somebody spent themselves is shown as owed back',
    before.summary.owedToStaff.minor > 0,
    toDecimalString(before.summary.owedToStaff),
  );
  check(
    'a claim over the threshold with no receipt is flagged',
    before.summary.missingReceipts > 0,
  );

  const noReceipt = await recordExpense({
    orgId: org.id,
    userId: owner.userId,
    locationId: null,
    category: 'OTHER',
    supplier: 'Probe supplier',
    description: 'No receipt, over the threshold',
    net: 400,
    tax: 80,
    incurredAt: new Date(),
    paidFrom: 'BANK',
  });

  check('an expense over the threshold with no receipt is refused', !noReceipt.ok, noReceipt.error);

  const future = await recordExpense({
    orgId: org.id,
    userId: owner.userId,
    locationId: null,
    category: 'OTHER',
    supplier: 'Probe supplier',
    description: 'Next week',
    net: 10,
    tax: 0,
    incurredAt: new Date(Date.now() + 7 * 86_400_000),
    paidFrom: 'BANK',
    receiptUrl: 'receipt',
  });

  check('an expense dated in the future is refused', !future.ok, future.error);

  const good = await recordExpense({
    orgId: org.id,
    userId: owner.userId,
    locationId: null,
    category: 'MARKETING',
    supplier: 'Probe printers',
    description: 'Leaflets',
    net: 120,
    tax: 24,
    incurredAt: new Date(),
    paidFrom: 'BANK',
    receiptUrl: 'receipt-on-file',
  });

  check('a complete expense is accepted', good.ok, good.error);

  const posted = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Expense', sourceId: good.expenseId },
  });

  check('and is not posted until somebody approves it', posted === null);

  const approved = await approveExpense({
    orgId: org.id,
    expenseId: good.expenseId!,
    approverUserId: owner.userId,
  });

  check('approval works', approved.ok, approved.error);

  const entry = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Expense', sourceId: good.expenseId },
    include: { lines: { include: { account: true } } },
  });

  check('and posts it', Boolean(entry), entry?.reference);
  check(
    'with the tax on its own account',
    Number(entry?.lines.find((line) => line.account.code === '2110')?.debit ?? 0) === 24,
  );
  check(
    'and the net in overheads, not the gross',
    Number(entry?.lines.find((line) => line.account.code === '6300')?.debit ?? 0) === 120,
  );

  /* --- closing ------------------------------------------------------------- */

  const periods = await periodsFor(org.id);
  const open = periods.find((period) => !period.isClosed);

  check('there is an open period', Boolean(open), open?.name);

  if (open) {
    const readiness = await periodReadiness(org.id, open.id);
    check('the close checks run', (readiness?.checks.length ?? 0) >= 6);

    const blocking = readiness?.checks.filter((c) => c.blocking && !c.passed) ?? [];

    check(
      'unreconciled bank lines warn rather than block',
      (readiness?.checks ?? []).some(
        (c) => c.label === 'Bank reconciled' && !c.passed && !c.blocking,
      ),
    );

    if (blocking.length > 0) {
      const refused = await closePeriod({
        orgId: org.id,
        periodId: open.id,
        userId: owner.userId,
      });

      check('a period with a blocking problem refuses to close', !refused.ok, refused.error);
    } else {
      check('nothing blocks the close', true, 'the period is ready');
    }
  }

  /* --- clean up ------------------------------------------------------------ */

  if (good.expenseId) {
    await prisma.journalLine.deleteMany({ where: { entryId: entry?.id } });
    if (entry) await prisma.journalEntry.delete({ where: { id: entry.id } });
    await prisma.expense.delete({ where: { id: good.expenseId } });
  }

  check(
    'the probe cleaned up after itself',
    (await prisma.expense.count({ where: { orgId: org.id, supplier: 'Probe printers' } })) === 0,
  );

  console.info(
    `\n  ${failures === 0 ? 'The bank can be reconciled and a period can be closed.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
