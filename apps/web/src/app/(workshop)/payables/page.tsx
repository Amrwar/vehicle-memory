import { fromDecimal, msg, type PaymentMethod } from '@carnet/core';
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
import { tFor } from '@/lib/i18n';
import { heldCreditBySupplier } from '@/lib/returns';
import { once, onceToken, StillGoingError } from '@/lib/once';
import {
  approveBill,
  disputeBill,
  payablesFor,
  PayablesError,
  paySupplier,
  supplierPaymentsFor,
} from '@/lib/payables';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Suppliers owed') };
}
export const dynamic = 'force-dynamic';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: msg('Bank transfer') },
  { value: 'CARD', label: msg('Card') },
  { value: 'CHEQUE', label: msg('Cheque') },
  { value: 'CASH', label: msg('Cash') },
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
    await once({
      orgId,
      key: ['pay-supplier', String(formData.get('once') ?? '')],
      work: () =>
        paySupplier({
          orgId,
          userId: user.userId,
          supplierId: String(formData.get('supplierId') ?? ''),
          amount: fromDecimal((Number(raw) || 0).toFixed(2)),
          method: (METHODS.some((m) => m.value === method)
            ? method
            : 'BANK_TRANSFER') as PaymentMethod,
          reference: String(formData.get('reference') ?? ''),
        }),
    });
  } catch (error) {
    if (!(error instanceof PayablesError) && !(error instanceof StillGoingError)) throw error;
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
  const t = await tFor();
  const notice = await searchParams;

  // A key for this drawing of the page; every press of a pay button carries
  // it, so a supplier is paid once. Phase 46.
  const token = onceToken();

  const [suppliers, payments, held] = await Promise.all([
    payablesFor(orgId),
    supplierPaymentsFor(orgId, 20),
    heldCreditBySupplier(orgId),
  ]);

  const owed = suppliers.reduce((total, entry) => total + entry.outstanding.minor, 0);
  const payable = suppliers.reduce((total, entry) => total + entry.payable.minor, 0);
  const overdue = suppliers.reduce((total, entry) => total + entry.overdue, 0);
  const mayWrite = can(user.role, 'ledger:write');

  return (
    <>
      <PageHeader
        eyebrow={t('Money')}
        title={t('Suppliers owed')}
        description={t('Bills to approve, suppliers to pay, and what has gone out')}
        actions={
          <Link href="/purchasing">
            <Button>{t('Purchasing')}</Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Owed')}
          value={<Money currency={region.currency} locale={region.locale} amount={owed / 100} />}
          note={t('Every open bill')}
        />
        <StatTile
          label={t('Ready to pay')}
          value={<Money currency={region.currency} locale={region.locale} amount={payable / 100} />}
          tone={payable > 0 ? 'warning' : 'neutral'}
          note={t('Approved and not yet settled')}
        />
        <StatTile
          label={t('Overdue bills')}
          value={overdue}
          tone={overdue > 0 ? 'danger' : 'success'}
          note={overdue > 0 ? t('Past their due date') : t('Nothing past due')}
        />
      </StatRow>

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(notice.problem)}
        </Alert>
      ) : null}

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'paid'
            ? t(
                'Paid and posted. The supplier has been sent a remittance advice naming each bill it covers.',
              )
            : notice.done === 'approved'
              ? t('Approved. It can be paid now.')
              : t('Parked as disputed. It will not be paid until somebody approves it again.')}
        </Alert>
      ) : null}

      {suppliers.length === 0 ? (
        <Card>
          <EmptyState
            title={t('Nothing is owed')}
            description={t(
              'A supplier’s bill is booked against its purchase order. Until one is, there is nobody to pay.',
            )}
            action={
              <Link href="/purchasing">
                <Button variant="primary">{t('See purchase orders')}</Button>
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
                description={[
                  entry.bills.length === 1
                    ? t('1 open bill')
                    : t('{count} open bills', { count: entry.bills.length }),
                  entry.overdue > 0 ? t('{count} overdue', { count: entry.overdue }) : null,
                  held.get(entry.supplier.id)
                    ? t('{amount} credit held from a return', {
                        amount: held.get(entry.supplier.id)!.toFixed(2),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
                        {t(bill.status.replace('_', ' ').toLowerCase())}
                      </Badge>
                      <span
                        className={`text-[12px] ${late ? 'text-(--danger)' : 'text-(--text-faint)'}`}
                      >
                        {bill.dueAt
                          ? t('due {date}', { date: bill.dueAt.toLocaleDateString(region.locale) })
                          : t('no due date')}
                      </span>
                      <span className="ms-auto tabular-nums">
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
                            {t('Approve')}
                          </Button>
                        </form>
                      ) : null}

                      {mayWrite && bill.status !== 'DISPUTED' ? (
                        <form action={dispute} className="flex items-center gap-1.5">
                          <input type="hidden" name="billId" value={bill.id} />
                          <Input
                            name="reason"
                            placeholder={t('What is wrong')}
                            className="h-8 w-40 text-[12px]"
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            {t('Dispute')}
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
                    <input type="hidden" name="once" value={`${token}:${entry.supplier.id}`} />
                    <Field
                      label={t('Pay')}
                      hint={t('Up to {amount} on approved bills', {
                        amount: (entry.payable.minor / 100).toFixed(2),
                      })}
                    >
                      <Input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={(entry.payable.minor / 100).toFixed(2)}
                        className="tabular-nums"
                        required
                      />
                    </Field>
                    <Field label={t('By')}>
                      <Select name="method" defaultValue="BANK_TRANSFER">
                        {METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {t(m.label)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('Reference')} hint={t('What they will see on their statement')}>
                      <Input name="reference" placeholder={t('Optional')} />
                    </Field>
                    <Button type="submit" variant="primary">
                      {t('Pay {supplier}', { supplier: entry.supplier.name })}
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
          title={t('Paid')}
          description={
            payments.length === 0
              ? t('Nothing has been paid yet.')
              : t('Newest first, with what each payment covered.')
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
                    {t(METHODS.find((m) => m.value === payment.method)?.label ?? payment.method)}
                    {payment.reference ? (
                      <span className="datum"> · {payment.reference}</span>
                    ) : null}
                  </span>
                  <span className="ms-auto font-medium tabular-nums">
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
                  {payment.recordedBy
                    ? ` · ${t('by {name}', { name: payment.recordedBy.name })}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
