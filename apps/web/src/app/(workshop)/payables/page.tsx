import { fromDecimal, type PaymentMethod } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Money,
  PageHeader,
  Select,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, requireSession } from '@/lib/guard';
import {
  approveBill,
  disputeBill,
  payablesFor,
  PayablesError,
  paySupplier,
  supplierPaymentsFor,
} from '@/lib/payables';

export const metadata: Metadata = { title: 'Suppliers owed' };
export const dynamic = 'force-dynamic';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
];

/**
 * What the workshop owes, and paying it.
 *
 * Supplier by supplier, oldest due first, because that is how the supplier's
 * own statement reads and how the telephone call goes when it is not paid.
 * A bill is approved by somebody who has checked it against the delivery, and
 * only approved bills can be paid: paying one nobody has checked is how a
 * wrong delivery gets paid for.
 *
 * Paying spreads the amount oldest first across the supplier's approved bills
 * and sends them a remittance advice naming each one.
 */

async function approve(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');
  await approveBill({ orgId, userId: user.userId, billId: String(formData.get('billId') ?? '') });
  redirect('/payables?done=approved');
}

async function dispute(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');

  try {
    await disputeBill({
      orgId,
      userId: user.userId,
      billId: String(formData.get('billId') ?? ''),
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof PayablesError)) throw error;
    redirect(`/payables?problem=${encodeURIComponent(error.message)}`);
  }

  redirect('/payables?done=disputed');
}

async function pay(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');
  const raw = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');
  const method = String(formData.get('method') ?? 'BANK_TRANSFER');

  try {
    await paySupplier({
      orgId,
      userId: user.userId,
      supplierId: String(formData.get('supplierId') ?? ''),
      amount: fromDecimal((Number(raw) || 0).toFixed(2)),
      method: (METHODS.some((m) => m.value === method) ? method : 'BANK_TRANSFER') as PaymentMethod,
      reference: String(formData.get('reference') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof PayablesError)) throw error;
    redirect(`/payables?problem=${encodeURIComponent(error.message)}`);
  }

  redirect('/payables?done=paid');
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { orgId, user, region } = await requireSession('ledger:read');
  const notice = await searchParams;

  const [suppliers, payments] = await Promise.all([
    payablesFor(orgId),
    supplierPaymentsFor(orgId, 20),
  ]);

  const owed = suppliers.reduce((total, entry) => total + entry.outstanding.minor, 0);
  const payable = suppliers.reduce((total, entry) => total + entry.payable.minor, 0);
  const overdue = suppliers.reduce((total, entry) => total + entry.overdue, 0);
  const mayWrite = can(user.role, 'ledger:write');

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Suppliers owed"
        description="Bills to approve, suppliers to pay, and what has gone out"
        actions={
          <Link href="/purchasing">
            <Button>Purchasing</Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="Owed"
          value={<Money currency={region.currency} locale={region.locale} amount={owed / 100} />}
          note="Every open bill"
        />
        <StatTile
          label="Ready to pay"
          value={<Money currency={region.currency} locale={region.locale} amount={payable / 100} />}
          tone={payable > 0 ? 'warning' : 'neutral'}
          note="Approved and not yet settled"
        />
        <StatTile
          label="Overdue bills"
          value={overdue}
          tone={overdue > 0 ? 'danger' : 'success'}
          note={overdue > 0 ? 'Past their due date' : 'Nothing past due'}
        />
      </StatRow>

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {notice.problem}
        </Alert>
      ) : null}

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'paid'
            ? 'Paid and posted. The supplier has been sent a remittance advice naming each bill it covers.'
            : notice.done === 'approved'
              ? 'Approved. It can be paid now.'
              : 'Parked as disputed. It will not be paid until somebody approves it again.'}
        </Alert>
      ) : null}

      {suppliers.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing is owed"
            description="A supplier's bill is booked against its purchase order. Until one is, there is nobody to pay."
            action={
              <Link href="/purchasing">
                <Button variant="primary">See purchase orders</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5">
          {suppliers.map((entry) => (
            <Card key={entry.supplier.id} className="overflow-hidden">
              <CardHeader
                title={entry.supplier.name}
                description={`${entry.bills.length} open bill${entry.bills.length === 1 ? '' : 's'}${entry.overdue > 0 ? ` · ${entry.overdue} overdue` : ''}`}
                action={
                  <span className="font-display text-[16px] font-semibold">
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={entry.outstanding.minor / 100}
                    />
                  </span>
                }
              />

              <ul className="divide-y divide-(--border)">
                {entry.bills.map((bill) => {
                  const outstanding = Number(bill.total) - Number(bill.amountPaid);
                  const late = bill.dueAt !== null && bill.dueAt.getTime() < Date.now();

                  return (
                    <li
                      key={bill.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
                    >
                      <span className="datum font-medium">{bill.reference}</span>
                      {bill.order ? (
                        <Link
                          href={`/purchasing/${bill.order.id}`}
                          className="text-(--text-faint) hover:underline"
                        >
                          {bill.order.number}
                        </Link>
                      ) : null}
                      <Badge
                        tone={
                          bill.status === 'DISPUTED'
                            ? 'danger'
                            : bill.status === 'AWAITING'
                              ? 'warning'
                              : bill.status === 'PART_PAID'
                                ? 'info'
                                : 'success'
                        }
                        size="sm"
                      >
                        {bill.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                      <span
                        className={`text-[12px] ${late ? 'text-(--danger)' : 'text-(--text-faint)'}`}
                      >
                        {bill.dueAt
                          ? `due ${bill.dueAt.toLocaleDateString(region.locale)}`
                          : 'no due date'}
                      </span>
                      <span className="ml-auto tabular-nums">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={outstanding}
                        />
                      </span>

                      {mayWrite && (bill.status === 'AWAITING' || bill.status === 'DISPUTED') ? (
                        <form action={approve}>
                          <input type="hidden" name="billId" value={bill.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Approve
                          </Button>
                        </form>
                      ) : null}

                      {mayWrite && bill.status !== 'DISPUTED' ? (
                        <form action={dispute} className="flex items-center gap-1.5">
                          <input type="hidden" name="billId" value={bill.id} />
                          <Input
                            name="reason"
                            placeholder="What is wrong"
                            className="h-8 w-40 text-[12px]"
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            Dispute
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {mayWrite && entry.payable.minor > 0 ? (
                <form action={pay}>
                  <CardBody className="grid gap-3 border-t border-(--border) bg-(--surface-sunk) sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end">
                    <input type="hidden" name="supplierId" value={entry.supplier.id} />
                    <Field
                      label="Pay"
                      hint={`Up to ${(entry.payable.minor / 100).toFixed(2)} on approved bills`}
                    >
                      <Input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={(entry.payable.minor / 100).toFixed(2)}
                        className="tabular-nums"
                        required
                      />
                    </Field>
                    <Field label="By">
                      <Select name="method" defaultValue="BANK_TRANSFER">
                        {METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Reference" hint="What they will see on their statement">
                      <Input name="reference" placeholder="Optional" />
                    </Field>
                    <Button type="submit" variant="primary">
                      Pay {entry.supplier.name}
                    </Button>
                  </CardBody>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Paid"
          description={
            payments.length === 0
              ? 'Nothing has been paid yet.'
              : 'Newest first, with what each payment covered.'
          }
        />
        {payments.length > 0 ? (
          <ul className="divide-y divide-(--border)">
            {payments.map((payment) => (
              <li key={payment.id} className="px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{payment.supplier.name}</span>
                  <span className="text-(--text-faint)">
                    {payment.paidAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })} ·{' '}
                    {METHODS.find((m) => m.value === payment.method)?.label ?? payment.method}
                    {payment.reference ? (
                      <span className="datum"> · {payment.reference}</span>
                    ) : null}
                  </span>
                  <span className="ml-auto font-medium tabular-nums">
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={Number(payment.amount)}
                    />
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-(--text-faint)">
                  {payment.allocations
                    .map((a) => `${a.bill.reference} ${Number(a.amount).toFixed(2)}`)
                    .join(' · ')}
                  {payment.recordedBy ? ` · by ${payment.recordedBy.name}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
