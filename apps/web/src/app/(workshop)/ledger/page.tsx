import { describeAccountType, normalBalance, toNumber, trialBalance } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@carnet/db';

import { postedLines } from '@/lib/accounting';
import { PlanWall } from '@/components/plan-wall';
import { planIncludes, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Ledger' };
export const dynamic = 'force-dynamic';

/**
 * The general ledger. FR-1201, FR-1205.
 *
 * Two views of the same postings: the trial balance, which is the one figure
 * that says whether anything else on the finance pages can be trusted, and the
 * journal itself, where every entry names the operational document that caused
 * it. Nothing here is entered by hand — an entry exists because a job, an
 * invoice, a receipt or a payment happened.
 */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; account?: string }>;
}) {
  const { orgId, plan } = await requireSession('ledger:read');

  // Role says they may look; the plan says whether the workshop bought it.
  if (!planIncludes(plan, 'ledger')) {
    return <PlanWall feature="ledger" plan={plan} />;
  }
  const { view, account } = await searchParams;
  const tab = view === 'journal' ? 'journal' : 'trial';

  const lines = await postedLines(orgId);
  const balance = trialBalance(lines);

  const entries = await journalEntries(orgId, account);
  const accountsUsed = balance.rows.length;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="General ledger"
        description="Every posting, and the document behind it"
        actions={
          <>
            <Link href="/ledger?view=trial">
              <Button size="sm" variant={tab === 'trial' ? 'primary' : 'secondary'}>
                Trial balance
              </Button>
            </Link>
            <Link href="/ledger?view=journal">
              <Button size="sm" variant={tab === 'journal' ? 'primary' : 'secondary'}>
                Journal
              </Button>
            </Link>
            <Link href="/financials">
              <Button size="sm" variant="ghost">
                Statements
              </Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Total debits"
          value={<Money amount={toNumber(balance.totalDebits)} />}
          note={`Across ${accountsUsed} account${accountsUsed === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Total credits"
          value={<Money amount={toNumber(balance.totalCredits)} />}
          note="Must equal debits"
        />
        <StatTile
          label="Difference"
          value={<Money amount={toNumber(balance.difference)} />}
          tone={balance.balanced ? 'success' : 'danger'}
          note={balance.balanced ? 'The books balance' : 'Stop and investigate'}
        />
        <StatTile label="Entries" value={entries.length} note="Posted journal entries" />
      </StatRow>

      {!balance.balanced ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            Debits and credits do not agree. Every figure on the financial statements is derived
            from these postings, so none of them is meaningful until this is resolved.
          </CardBody>
        </Card>
      ) : null}

      {tab === 'trial' ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Trial balance"
            description="Every account carrying a movement, on its normal side"
          />
          {balance.rows.length === 0 ? (
            <EmptyState
              title="Nothing posted yet"
              description="The ledger fills itself as invoices are issued, parts are consumed and payments land."
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Account</Th>
                    <Th>Type</Th>
                    <Th numeric>Debit</Th>
                    <Th numeric>Credit</Th>
                    <Th numeric>Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {balance.rows.map((row) => (
                    <Tr key={row.accountCode}>
                      <Td className="tabular text-(--text-faint)">{row.accountCode}</Td>
                      <Td className="font-medium">
                        <Link
                          href={`/ledger?view=journal&account=${row.accountCode}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {row.accountName}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-[12px] text-(--text-soft)">
                          {describeAccountType(row.accountType)}
                          <span className="text-(--text-faint)">
                            {' · '}
                            {normalBalance(row.accountType) === 'debit' ? 'Dr' : 'Cr'}
                          </span>
                        </span>
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {row.debit.minor === 0 ? '—' : <Money amount={toNumber(row.debit)} />}
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {row.credit.minor === 0 ? '—' : <Money amount={toNumber(row.credit)} />}
                      </Td>
                      <Td numeric className="font-medium">
                        <Money amount={toNumber(row.balance)} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-(--border-strong) bg-(--surface-sunk)">
                    <Td />
                    <Td className="font-semibold">Total</Td>
                    <Td />
                    <Td numeric className="font-semibold">
                      <Money amount={toNumber(balance.totalDebits)} />
                    </Td>
                    <Td numeric className="font-semibold">
                      <Money amount={toNumber(balance.totalCredits)} />
                    </Td>
                    <Td numeric>
                      <Badge tone={balance.balanced ? 'success' : 'danger'} size="sm">
                        {balance.balanced ? 'Balanced' : 'Out'}
                      </Badge>
                    </Td>
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={account ? `Journal, account ${account}` : 'Journal'}
            description="Newest first. Each entry names the document that caused it."
            action={
              account ? (
                <Link href="/ledger?view=journal">
                  <Button size="sm" variant="ghost">
                    Clear filter
                  </Button>
                </Link>
              ) : undefined
            }
          />
          {entries.length === 0 ? (
            <EmptyState
              title="No entries"
              description={
                account
                  ? 'Nothing has posted to this account yet.'
                  : 'The journal fills itself as work is invoiced and paid.'
              }
            />
          ) : (
            <div className="divide-y divide-(--border)">
              {entries.map((entry) => {
                const debits = entry.lines.reduce((total, line) => total + Number(line.debit), 0);

                return (
                  <div key={entry.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="tabular text-(--text-faint)">{entry.reference}</span>
                          <span className="px-1.5 text-(--text-faint)">·</span>
                          {entry.description}
                        </p>
                        <p className="mt-0.5 text-[12px] text-(--text-faint)">
                          {entry.postedAt.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {entry.period ? ` · ${entry.period.name}` : ''}
                          {entry.sourceType ? ` · from ${entry.sourceType}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.period?.isClosed ? (
                          <Badge tone="neutral" size="sm">
                            Closed period
                          </Badge>
                        ) : null}
                        <Money amount={debits} className="font-medium" />
                      </div>
                    </div>

                    <ul className="mt-2 grid gap-0.5 text-[12px]">
                      {entry.lines.map((line) => (
                        <li
                          key={line.id}
                          className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] items-baseline gap-3"
                        >
                          <span className="tabular text-(--text-faint)">{line.account.code}</span>
                          <span className="truncate text-(--text-soft)">
                            {line.account.name}
                            {line.memo ? (
                              <span className="text-(--text-faint)"> · {line.memo}</span>
                            ) : null}
                          </span>
                          <span className="tabular w-24 text-right">
                            {Number(line.debit) === 0 ? (
                              <span className="text-(--text-faint)">—</span>
                            ) : (
                              <Money amount={Number(line.debit)} />
                            )}
                          </span>
                          <span className="tabular w-24 text-right">
                            {Number(line.credit) === 0 ? (
                              <span className="text-(--text-faint)">—</span>
                            ) : (
                              <Money amount={Number(line.credit)} />
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

/** Journal entries with their lines, optionally narrowed to one account. */
async function journalEntries(orgId: string, accountCode?: string) {
  return prisma.journalEntry.findMany({
    where: {
      orgId,
      ...(accountCode ? { lines: { some: { account: { code: accountCode } } } } : {}),
    },
    include: {
      period: { select: { name: true, isClosed: true } },
      lines: {
        include: { account: { select: { code: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { postedAt: 'desc' },
    take: 60,
  });
}
