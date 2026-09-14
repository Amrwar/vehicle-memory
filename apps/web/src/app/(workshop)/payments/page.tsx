import {
  Badge,
  Button,
  Card,
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

import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  ONLINE: 'Online',
  CHEQUE: 'Cheque',
  ACCOUNT: 'On account',
  OTHER: 'Other',
  LOYALTY: 'Points',
  GIFT_CARD: 'Gift card',
  DEPOSIT: 'Money held',
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { db, region } = await requireSession('payment:read');
  const { days } = await searchParams;
  const window = Math.max(1, Number(days ?? 30) || 30);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (window - 1));

  const payments = await db.payment.findMany({
    where: { receivedAt: { gte: since } },
    orderBy: { receivedAt: 'desc' },
    take: 200,
    include: {
      customer: { select: { id: true, displayName: true } },
      invoice: { select: { id: true, number: true, jobId: true } },
      recordedBy: { select: { name: true } },
    },
  });

  const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = payments
    .filter((payment) => payment.receivedAt >= startOfToday)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  // By method, because "how are we actually being paid" drives whether card
  // fees or bank reconciliation is the thing worth attention.
  const byMethod = new Map<string, { count: number; value: number }>();
  for (const payment of payments) {
    const entry = byMethod.get(payment.method) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(payment.amount);
    byMethod.set(payment.method, entry);
  }
  const methods = [...byMethod.entries()].sort((a, b) => b[1].value - a[1].value);

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description={`Received in the last ${window} days`}
        actions={
          <>
            {[7, 30, 90].map((option) => (
              <Link key={option} href={`/payments?days=${option}`}>
                <Button size="sm" variant={option === window ? 'primary' : 'secondary'}>
                  {option}d
                </Button>
              </Link>
            ))}
            <Link href="/invoices?status=unpaid">
              <Button>Unpaid invoices</Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Taken today"
          value={<Money currency={region.currency} locale={region.locale} amount={today} />}
          tone={today > 0 ? 'success' : 'neutral'}
        />
        <StatTile
          label={`Last ${window} days`}
          value={<Money currency={region.currency} locale={region.locale} amount={total} />}
        />
        <StatTile label="Payments" value={payments.length} note="Individual receipts" />
        <StatTile
          label="Average"
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={payments.length ? total / payments.length : 0}
            />
          }
          note="Per payment"
        />
      </StatRow>

      {methods.length > 0 ? (
        <Card className="mb-5">
          <CardHeader title="How you were paid" description="By method, over the period" />
          <ul className="divide-y divide-(--border)">
            {methods.map(([method, stats]) => {
              const share = total > 0 ? (stats.value / total) * 100 : 0;
              return (
                <li key={method} className="flex items-center gap-4 px-4 py-2.5">
                  <span className="w-32 shrink-0 text-[13px] font-medium">
                    {METHOD_LABEL[method] ?? method}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--surface-sunk)">
                    <div
                      className="h-full rounded-full bg-(--brand)"
                      style={{ width: `${Math.max(2, share)}%` }}
                    />
                  </div>
                  <span className="tabular w-14 shrink-0 text-right text-[12px] text-(--text-faint)">
                    {share.toFixed(0)}%
                  </span>
                  <span className="tabular w-24 shrink-0 text-right text-[13px] font-medium">
                    <Money currency={region.currency} locale={region.locale} amount={stats.value} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="Receipts" />
        {payments.length === 0 ? (
          <EmptyState
            title="Nothing received in this period"
            description="Try a longer window, or check outstanding invoices."
            action={
              <Link href="/invoices?status=unpaid">
                <Button variant="primary">Unpaid invoices</Button>
              </Link>
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Received</Th>
                  <Th>Customer</Th>
                  <Th>Invoice</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Recorded by</Th>
                  <Th numeric>Amount</Th>
                  <Th>Receipt</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <Tr key={payment.id}>
                    <Td className="datum text-(--text-faint)">
                      {payment.receivedAt.toLocaleString(region.locale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </Td>
                    <Td>
                      <Link href={`/customers/${payment.customer.id}`} className="hover:underline">
                        {payment.customer.displayName}
                      </Link>
                    </Td>
                    <Td className="datum text-(--text-soft)">
                      {payment.invoice ? (
                        payment.invoice.jobId ? (
                          <Link href={`/jobs/${payment.invoice.jobId}`} className="hover:underline">
                            {payment.invoice.number}
                          </Link>
                        ) : (
                          payment.invoice.number
                        )
                      ) : (
                        <span className="text-(--text-faint)">On account</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone="neutral" size="sm">
                        {METHOD_LABEL[payment.method] ?? payment.method}
                      </Badge>
                    </Td>
                    <Td className="datum text-(--text-faint)">{payment.reference ?? '—'}</Td>
                    <Td className="text-(--text-soft)">{payment.recordedBy?.name ?? 'System'}</Td>
                    <Td numeric className="font-medium">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(payment.amount)}
                      />
                    </Td>
                    <Td>
                      <Link
                        href={`/payments/${payment.id}/receipt`}
                        className="datum text-[12px] hover:underline"
                      >
                        R-{payment.id.slice(-6).toUpperCase()}
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
