import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
  PageHeader,
  Registration,
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

export const metadata: Metadata = { title: 'Invoices' };
export const dynamic = 'force-dynamic';

const TONE = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PART_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'neutral',
} as const;

/**
 * Invoices, ordered so unpaid money is at the top.
 *
 * A list sorted by date buries the overdue invoice from three weeks ago under
 * today's paid ones, which is precisely backwards: the paid invoice needs
 * nobody's attention.
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { db } = await requireSession('invoice:read');
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const invoices = await db.invoice.findMany({
    where: {
      ...(params.status === 'unpaid'
        ? { status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] } }
        : params.status
          ? { status: params.status as never }
          : {}),
      ...(query
        ? {
            OR: [
              { number: { contains: query, mode: 'insensitive' as const } },
              { customer: { displayName: { contains: query, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      customer: { select: { id: true, displayName: true } },
      job: {
        select: {
          id: true,
          number: true,
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
      payments: { select: { amount: true } },
    },
  });

  const now = Date.now();
  const rows = invoices.map((invoice) => {
    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    const overdue = outstanding > 0.005 && invoice.dueAt !== null && invoice.dueAt.getTime() < now;
    const daysOverdue = overdue ? Math.floor((now - invoice.dueAt!.getTime()) / 86_400_000) : 0;
    return { invoice, outstanding, overdue, daysOverdue };
  });

  // Overdue first, then the rest by outstanding value.
  rows.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      b.daysOverdue - a.daysOverdue ||
      b.outstanding - a.outstanding,
  );

  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const overdueValue = rows.filter((r) => r.overdue).reduce((s, r) => s + r.outstanding, 0);
  const paidCount = rows.filter((r) => r.outstanding <= 0.005).length;

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Invoices"
        description={`${rows.length} invoice${rows.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Link href="/payments">
              <Button>Payments</Button>
            </Link>
            <Link href="/jobs?status=COMPLETED">
              <Button variant="primary">Invoice a job</Button>
            </Link>
          </>
        }
      />

      <StatRow className="mb-5">
        <Link href="/invoices?status=unpaid" className="group">
          <StatTile
            label="Outstanding"
            value={<Money amount={totalOutstanding} />}
            tone={totalOutstanding > 0 ? 'warning' : 'neutral'}
            note="Invoiced but not yet paid"
          />
        </Link>
        <StatTile
          label="Overdue"
          value={<Money amount={overdueValue} />}
          tone={overdueValue > 0 ? 'danger' : 'success'}
          note={overdueValue > 0 ? 'Past the due date' : 'Nothing past due'}
        />
        <StatTile label="Settled" value={paidCount} note="Paid in full" />
        <StatTile
          label="Invoiced"
          value={<Money amount={rows.reduce((s, r) => s + Number(r.invoice.total), 0)} />}
          note="Total value listed"
        />
      </StatRow>

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/invoices">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Invoice number or customer"
          aria-label="Search invoices"
          className="h-9 w-full max-w-xs rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
        <Button type="submit">Search</Button>
        {params.status || query ? (
          <Link href="/invoices" className="text-[12px] text-(--text-faint) underline">
            Clear
          </Link>
        ) : (
          <Link
            href="/invoices?status=unpaid"
            className="text-[12px] text-(--text-faint) underline"
          >
            Only unpaid
          </Link>
        )}
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title="No invoices"
            description="An invoice is created from a completed job, carrying its approved lines."
            action={
              <Link href="/jobs?status=COMPLETED">
                <Button variant="primary">See completed jobs</Button>
              </Link>
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Vehicle</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th numeric>Total</Th>
                  <Th numeric>Paid</Th>
                  <Th numeric>Outstanding</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ invoice, outstanding, overdue, daysOverdue }) => (
                  <Tr key={invoice.id}>
                    <Td className="datum">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/customers/${invoice.customer.id}`} className="hover:underline">
                        {invoice.customer.displayName}
                      </Link>
                    </Td>
                    <Td className="text-(--text-soft)">
                      {invoice.job ? (
                        <span className="inline-flex items-center gap-1.5">
                          {invoice.job.vehicle.make} {invoice.job.vehicle.model}
                          {invoice.job.vehicle.registration ? (
                            <Registration value={invoice.job.vehicle.registration} />
                          ) : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="datum text-(--text-faint)">
                      {invoice.issuedAt?.toLocaleDateString('en-GB') ?? '—'}
                    </Td>
                    <Td className="datum text-(--text-faint)">
                      {invoice.dueAt?.toLocaleDateString('en-GB') ?? '—'}
                    </Td>
                    <Td numeric>
                      <Money amount={Number(invoice.total)} currency={invoice.currency} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      <Money amount={Number(invoice.amountPaid)} currency={invoice.currency} />
                    </Td>
                    <Td
                      numeric
                      className={outstanding > 0.005 ? 'font-medium' : 'text-(--text-faint)'}
                    >
                      <Money amount={outstanding} currency={invoice.currency} />
                    </Td>
                    <Td>
                      {overdue ? (
                        <Badge tone="danger" dot>
                          {daysOverdue}d overdue
                        </Badge>
                      ) : (
                        <Badge tone={TONE[invoice.status]} dot>
                          {invoice.status.toLowerCase().replace('_', ' ')}
                        </Badge>
                      )}
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
