import {
  AGE_BUCKETS,
  ageAnalysis,
  balanceSheet,
  profitAndLoss,
  taxReturn,
  toNumber,
  trialBalance,
  upTo,
  withinPeriod,
} from '@carnet/core';
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

import { openPayables, openReceivables, postedLines } from '@/lib/accounting';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Financial statements' };
export const dynamic = 'force-dynamic';

/**
 * Financial statements. FR-1206, FR-1208, FR-1210.
 *
 * Every figure is computed from posted journal lines at request time rather
 * than stored, so a statement cannot drift from the entries behind it. The
 * balance check is shown rather than hidden: a balance sheet that does not
 * balance is a fact the owner needs, not something to quietly round away.
 */

type RangeKey = 'month' | 'quarter' | 'year';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'Year to date' },
];

function rangeFor(key: RangeKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (key === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to,
      label: now.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    };
  }

  if (key === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    return {
      from: new Date(now.getFullYear(), quarter * 3, 1),
      to,
      label: `${now.getFullYear()} Q${quarter + 1} to date`,
    };
  }

  return {
    from: new Date(now.getFullYear(), 0, 1),
    to,
    label: `${now.getFullYear()} to date`,
  };
}

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { orgId } = await requireSession('report:financial');
  const { range } = await searchParams;
  const key: RangeKey = range === 'month' || range === 'quarter' ? range : 'year';
  const period = rangeFor(key);

  const [lines, receivables, payables] = await Promise.all([
    postedLines(orgId),
    openReceivables(orgId),
    openPayables(orgId),
  ]);

  // The P&L covers a window; the balance sheet is a position at a moment.
  // Using the same slice for both is the mistake that makes a balance sheet
  // fail to balance for reasons nobody can find.
  const forPeriod = withinPeriod(lines, period.from, period.to);
  const asAt = upTo(lines, period.to);

  const pl = profitAndLoss(forPeriod);
  const sheet = balanceSheet(asAt);
  const vat = taxReturn(forPeriod);
  const balance = trialBalance(asAt);

  const debtors = ageAnalysis(receivables, period.to);
  const creditors = ageAnalysis(payables, period.to);

  const profitable = pl.netProfit.minor >= 0;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Financial statements"
        description={period.label}
        actions={
          <>
            {RANGES.map((option) => (
              <Link key={option.key} href={`/financials?range=${option.key}`}>
                <Button size="sm" variant={option.key === key ? 'primary' : 'secondary'}>
                  {option.label}
                </Button>
              </Link>
            ))}
            <Link href="/ledger">
              <Button size="sm" variant="ghost">
                Ledger
              </Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Revenue"
          value={<Money amount={toNumber(pl.totalRevenue)} />}
          note={period.label}
        />
        <StatTile
          label="Gross profit"
          value={<Money amount={toNumber(pl.grossProfit)} />}
          tone="brand"
          note={pl.grossMarginPct === null ? 'No revenue yet' : `${pl.grossMarginPct}% margin`}
        />
        <StatTile
          label="Net profit"
          value={<Money amount={toNumber(pl.netProfit)} />}
          tone={profitable ? 'success' : 'danger'}
          note={pl.netMarginPct === null ? 'No revenue yet' : `${pl.netMarginPct}% margin`}
        />
        <StatTile
          label="Owed to you"
          value={<Money amount={toNumber(debtors.total)} />}
          tone={debtors.atRisk.minor > 0 ? 'warning' : 'neutral'}
          note={
            debtors.atRisk.minor > 0
              ? `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(toNumber(debtors.atRisk))} past 60 days`
              : 'Nothing seriously overdue'
          }
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --- profit and loss ------------------------------------------- */}
        <Card className="overflow-hidden">
          <CardHeader title="Profit and loss" description={period.label} />
          {forPeriod.length === 0 ? (
            <EmptyState
              title="Nothing posted in this period"
              description="Try a wider range, or check that invoices are being issued."
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <tbody>
                  <SectionRow label="Revenue" />
                  {pl.revenue.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow label="Total revenue" amount={toNumber(pl.totalRevenue)} />

                  <SectionRow label="Cost of sales" />
                  {pl.costOfSales.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow
                    label="Gross profit"
                    amount={toNumber(pl.grossProfit)}
                    note={pl.grossMarginPct === null ? undefined : `${pl.grossMarginPct}%`}
                    emphasis
                  />

                  <SectionRow label="Overheads" />
                  {pl.overheads.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow
                    label="Net profit"
                    amount={toNumber(pl.netProfit)}
                    note={pl.netMarginPct === null ? undefined : `${pl.netMarginPct}%`}
                    emphasis
                    tone={profitable ? 'success' : 'danger'}
                  />
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* --- balance sheet ---------------------------------------------- */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Balance sheet"
            description={`Position as at ${period.to.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            action={
              <Badge tone={sheet.balanced ? 'success' : 'danger'} size="sm">
                {sheet.balanced ? 'Balanced' : 'Out by ' + toNumber(sheet.difference).toFixed(2)}
              </Badge>
            }
          />
          {asAt.length === 0 ? (
            <EmptyState title="No position yet" description="Nothing has been posted." />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <tbody>
                  <SectionRow label="Assets" />
                  {sheet.assets.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow label="Total assets" amount={toNumber(sheet.totalAssets)} emphasis />

                  <SectionRow label="Liabilities" />
                  {sheet.liabilities.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <TotalRow label="Total liabilities" amount={toNumber(sheet.totalLiabilities)} />

                  <SectionRow label="Equity" />
                  {sheet.equity.map((line) => (
                    <Tr key={line.accountCode}>
                      <Td className="pl-6 text-(--text-soft)">{line.accountName}</Td>
                      <Td numeric>
                        <Money amount={toNumber(line.amount)} />
                      </Td>
                    </Tr>
                  ))}
                  <Tr>
                    <Td className="pl-6 text-(--text-soft)">
                      Profit this period
                      <span className="ml-1.5 text-[11px] text-(--text-faint)">not yet closed</span>
                    </Td>
                    <Td numeric>
                      <Money amount={toNumber(sheet.retainedThisPeriod)} />
                    </Td>
                  </Tr>
                  <TotalRow
                    label="Liabilities and equity"
                    amount={toNumber(sheet.totalLiabilities) + toNumber(sheet.totalEquity)}
                    emphasis
                  />
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* --- ageing ------------------------------------------------------ */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Owed to you"
            description="Aged debtors. The right-hand columns are the ones worth a phone call."
          />
          <Ageing analysis={debtors} emptyLabel="Every invoice is settled." tone="danger" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Owed by you" description="Aged creditors, by supplier" />
          <Ageing analysis={creditors} emptyLabel="No supplier bills outstanding." tone="warning" />
        </Card>
      </div>

      {/* --- tax and integrity ------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="VAT position" description={period.label} />
          <CardBody className="grid gap-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-(--text-faint)">Output tax charged to customers</span>
              <Money amount={toNumber(vat.outputTax)} />
            </div>
            <div className="flex justify-between">
              <span className="text-(--text-faint)">Input tax paid to suppliers</span>
              <Money amount={toNumber(vat.inputTax)} />
            </div>
            <div className="flex justify-between border-t border-(--border) pt-2 font-medium">
              <span>{vat.owed ? 'Owed to HMRC' : 'Reclaimable from HMRC'}</span>
              <Money amount={Math.abs(toNumber(vat.net))} />
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
              Computed from the tax accounts, not from invoice totals, so a credit note or a
              disputed bill is already reflected. This is a working figure, not a filed return.
            </p>
          </CardBody>
        </Card>

        <Card className={balance.balanced ? undefined : 'border-(--danger)'}>
          <CardHeader title="Integrity" description="Whether these figures can be trusted" />
          <CardBody className="grid gap-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-(--text-faint)">Trial balance</span>
              <Badge tone={balance.balanced ? 'success' : 'danger'} size="sm">
                {balance.balanced ? 'Debits equal credits' : 'Out of balance'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-(--text-faint)">Balance sheet</span>
              <Badge tone={sheet.balanced ? 'success' : 'danger'} size="sm">
                {sheet.balanced ? 'Assets equal claims' : 'Does not balance'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-(--text-faint)">Postings in scope</span>
              <span className="tabular">{asAt.length}</span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
              Nothing on this page is entered by hand. Every line traces back through the{' '}
              <Link href="/ledger?view=journal" className="underline underline-offset-2">
                journal
              </Link>{' '}
              to the job, invoice or receipt that caused it.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* --- small pieces --------------------------------------------------------- */

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="bg-(--surface-sunk)">
      <td colSpan={2} className="px-4 py-1.5">
        <span className="eyebrow">{label}</span>
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  amount,
  note,
  emphasis,
  tone,
}: {
  label: string;
  amount: number;
  note?: string;
  emphasis?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <tr className="border-t border-(--border)">
      <td className={`px-4 py-2 ${emphasis ? 'font-semibold' : 'font-medium'}`}>
        {label}
        {note ? <span className="ml-1.5 text-[11px] text-(--text-faint)">{note}</span> : null}
      </td>
      <td className="px-4 py-2 text-right">
        <Money
          amount={amount}
          className={
            emphasis
              ? `font-semibold ${tone === 'success' ? 'text-(--success)' : tone === 'danger' ? 'text-(--danger)' : ''}`
              : 'font-medium'
          }
        />
      </td>
    </tr>
  );
}

function Ageing({
  analysis,
  emptyLabel,
  tone,
}: {
  analysis: ReturnType<typeof ageAnalysis>;
  emptyLabel: string;
  tone: 'danger' | 'warning';
}) {
  if (analysis.documents.length === 0) {
    return <EmptyState title="Nothing outstanding" description={emptyLabel} />;
  }

  const total = toNumber(analysis.total);

  return (
    <>
      <div className="grid grid-cols-5 gap-px border-b border-(--border) bg-(--border)">
        {AGE_BUCKETS.map((bucket) => {
          const amount = toNumber(analysis.buckets[bucket]);
          const share = total > 0 ? (amount / total) * 100 : 0;
          const hot = bucket === '61-90' || bucket === '90+';

          return (
            <div key={bucket} className="bg-(--surface) px-2.5 py-2">
              <p className="eyebrow">{bucket === 'current' ? 'Current' : `${bucket}d`}</p>
              <p
                className={`tabular mt-0.5 text-[13px] font-medium ${
                  hot && amount > 0 ? `text-(--${tone})` : ''
                }`}
              >
                {amount === 0 ? '—' : <Money amount={amount} />}
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--surface-sunk)">
                <div
                  className={`h-full rounded-full ${hot ? `bg-(--${tone})` : 'bg-(--brand)'}`}
                  style={{ width: `${Math.max(amount > 0 ? 4 : 0, share)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <TableWrap className="rounded-none border-0">
        <Table>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Party</Th>
              <Th numeric>Overdue</Th>
              <Th numeric>Outstanding</Th>
            </tr>
          </thead>
          <tbody>
            {analysis.documents.slice(0, 8).map((document) => (
              <Tr key={document.id}>
                <Td className="tabular font-medium">{document.reference}</Td>
                <Td className="text-(--text-soft)">{document.partyName}</Td>
                <Td numeric>
                  {document.daysOverdue === 0 ? (
                    <span className="text-(--text-faint)">—</span>
                  ) : (
                    <span className={document.daysOverdue > 60 ? `text-(--${tone})` : ''}>
                      {document.daysOverdue}d
                    </span>
                  )}
                </Td>
                <Td numeric className="font-medium">
                  <Money amount={toNumber(document.outstanding)} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
