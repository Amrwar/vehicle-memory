import {
  describeSettlement,
  fromDecimal,
  type InvoiceState,
  type PaymentMethod,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  KeyValue,
  Money,
  PageHeader,
  Registration,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { GiftCardError, redeemGiftCard } from '@/lib/giftcards';
import { can, requireSession } from '@/lib/guard';
import {
  loyaltyCardFor,
  LoyaltyError,
  redeemAgainstInvoice,
  spendableAgainst,
} from '@/lib/loyalty';
import {
  invoiceDetail,
  MoneyCycleError,
  raiseCreditNote,
  recordPayment,
  recordRefund,
} from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('invoice:read');
  const invoice = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: invoice ? `Invoice ${invoice.number}` : 'Invoice' };
}

const TONE = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PART_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'neutral',
} as const;

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'ACCOUNT', label: 'On account' },
];

/** Points are not typed in as an amount; they have a form of their own below. */
const METHOD_LABELS: Record<string, string> = {
  ...Object.fromEntries(METHODS.map((m) => [m.value, m.label])),
  LOYALTY: 'Points',
  GIFT_CARD: 'Gift card',
};

/**
 * One invoice: what it was for, what has been paid, and what has been put
 * right since.
 *
 * Three things can be done here and each is a form, not a modal. Taking a
 * payment, raising a credit note, sending money back. Every one is refused
 * with a sentence when it would make the figures wrong, because the figures
 * are the point.
 */

function amountFrom(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').replace(/[£,\s]/g, '');
  const value = Number(raw);
  return Number.isFinite(value) ? fromDecimal(value.toFixed(2)) : fromDecimal('0');
}

function methodFrom(formData: FormData): PaymentMethod {
  const raw = String(formData.get('method') ?? 'CARD');
  return (METHODS.some((m) => m.value === raw) ? raw : 'CARD') as PaymentMethod;
}

async function pay(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await recordPayment({
      orgId,
      userId: user.userId,
      invoiceId,
      amount: amountFrom(formData, 'amount'),
      method: methodFrom(formData),
      reference: String(formData.get('reference') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=paid`);
}

/**
 * Points off the bill. Refused with a sentence when they have fewer than
 * asked or the points are worth more than is owed, because the alternative
 * is quietly using fewer and a customer finding out at the counter.
 */
async function redeem(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await redeemAgainstInvoice({
      orgId,
      userId: user.userId,
      invoiceId,
      points: Number(String(formData.get('points') ?? '').trim()),
    });
  } catch (error) {
    if (!(error instanceof LoyaltyError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=redeemed`);
}

/**
 * A gift card off the bill. The amount is optional: left blank, the card
 * pays as much of the bill as it can, which is what somebody at the counter
 * nearly always means. Anything typed in is used exactly or refused.
 */
async function redeemCard(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');
  const typed = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');

  try {
    await redeemGiftCard({
      orgId,
      userId: user.userId,
      invoiceId,
      code: String(formData.get('code') ?? ''),
      amountMinor: typed === '' ? null : Math.round(Number(typed) * 100),
    });
  } catch (error) {
    if (!(error instanceof GiftCardError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=card`);
}

async function credit(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('invoice:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await raiseCreditNote({
      orgId,
      userId: user.userId,
      invoiceId,
      amount: amountFrom(formData, 'amount'),
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=credited`);
}

async function refund(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await recordRefund({
      orgId,
      userId: user.userId,
      invoiceId,
      creditNoteId: String(formData.get('creditNoteId') ?? ''),
      amount: amountFrom(formData, 'amount'),
      method: methodFrom(formData),
      reference: String(formData.get('reference') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=refunded`);
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const { orgId, user } = await requireSession('invoice:read');

  const detail = await invoiceDetail(orgId, id);
  if (!detail) notFound();

  const { invoice, money } = detail;
  const status = invoice.status as InvoiceState;

  const settlement = describeSettlement({
    status,
    total: money.total,
    amountPaid: money.amountPaid,
    dueAt: invoice.dueAt,
  });

  const mayPay =
    can(user.role, 'payment:write') && money.outstanding.minor > 0 && status !== 'VOID';
  const mayCredit =
    can(user.role, 'invoice:write') &&
    status !== 'DRAFT' &&
    status !== 'VOID' &&
    money.credited.minor < money.total.minor;
  const mayRefund = can(user.role, 'payment:write') && money.owedBack.minor > 0;

  // Points are only offered when there is a bill to put them against and
  // something to put. A card with nothing to spend is a card to explain.
  const points = mayPay ? await loyaltyCardFor(orgId, invoice.customer.id) : null;
  const spendable = points ? spendableAgainst(points.balance, money.outstanding.minor) : 0;

  const format = (minor: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(
      minor / 100,
    );

  return (
    <>
      <div className="mb-3">
        <BackLink href="/invoices">All invoices</BackLink>
      </div>

      <PageHeader
        eyebrow={`Invoice · ${invoice.customer.displayName}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {invoice.number}
            <Badge tone={TONE[status]} dot>
              {status.replace('_', ' ').toLowerCase()}
            </Badge>
          </span>
        }
        description={settlement}
        actions={
          <>
            {invoice.job ? (
              <Link href={`/jobs/${invoice.job.id}`}>
                <Button>Job #{invoice.job.number}</Button>
              </Link>
            ) : null}
            <Link href={`/customers/${invoice.customer.id}`}>
              <Button variant="secondary">Customer</Button>
            </Link>
          </>
        }
      />

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'paid'
            ? 'Payment recorded and posted to the ledger.'
            : notice.done === 'redeemed'
              ? 'Points taken off the bill and booked as the cost of the programme, not as money in.'
              : notice.done === 'card'
                ? 'Gift card redeemed. The money came in when the card was sold; this releases what was owed.'
                : notice.done === 'credited'
                  ? 'Credit note raised. The customer has been told, and revenue has been reversed in proportion.'
                  : 'Refund recorded. The customer has been told it is on its way.'}
        </Alert>
      ) : null}

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {notice.problem}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="What it was for"
              description={
                invoice.job
                  ? `${[invoice.job.vehicle.make, invoice.job.vehicle.model].filter(Boolean).join(' ')}${invoice.job.vehicle.registration ? ` · ${invoice.job.vehicle.registration}` : ''}`
                  : undefined
              }
              action={
                invoice.job?.vehicle.registration ? (
                  <Registration value={invoice.job.vehicle.registration} />
                ) : undefined
              }
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Unit</Th>
                    <Th numeric>Tax</Th>
                    <Th numeric>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <Tr key={line.id}>
                      <Td>
                        <span className="eyebrow mr-2">{line.kind.toLowerCase()}</span>
                        {line.description}
                      </Td>
                      <Td numeric>{Number(line.quantity)}</Td>
                      <Td numeric>
                        <Money amount={Number(line.unitPrice)} currency={invoice.currency} />
                      </Td>
                      <Td numeric>
                        <Money amount={Number(line.taxAmount)} currency={invoice.currency} />
                      </Td>
                      <Td numeric>
                        <Money amount={Number(line.lineTotal)} currency={invoice.currency} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <CardBody className="grid gap-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-(--text-faint)">Net</span>
                <Money amount={Number(invoice.subtotal)} currency={invoice.currency} />
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-faint)">Tax</span>
                <Money amount={Number(invoice.taxTotal)} currency={invoice.currency} />
              </div>
              <div className="flex justify-between border-t border-(--border) pt-2 font-display text-[16px] font-semibold">
                <span>Total</span>
                <Money amount={Number(invoice.total)} currency={invoice.currency} />
              </div>
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Money in"
              description={
                invoice.payments.length === 0
                  ? 'Nothing received yet.'
                  : `${invoice.payments.length} payment${invoice.payments.length === 1 ? '' : 's'}`
              }
            />
            {invoice.payments.length > 0 ? (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>How</Th>
                      <Th>Reference</Th>
                      <Th>Taken by</Th>
                      <Th numeric>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((payment) => (
                      <Tr key={payment.id}>
                        <Td>
                          {payment.receivedAt.toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Td>
                        <Td>{METHOD_LABELS[payment.method] ?? payment.method}</Td>
                        <Td className="datum">{payment.reference ?? '—'}</Td>
                        <Td>{payment.recordedBy?.name ?? '—'}</Td>
                        <Td numeric>
                          <Money amount={Number(payment.amount)} currency={invoice.currency} />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : null}
          </Card>

          {invoice.creditNotes.length > 0 || invoice.refunds.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader title="Put right" description="Credit notes and money returned" />
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Document</Th>
                      <Th>Why</Th>
                      <Th>When</Th>
                      <Th numeric>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.creditNotes.map((note) => (
                      <Tr key={note.id}>
                        <Td>
                          <span className="eyebrow mr-2">credit</span>
                          {note.number}
                        </Td>
                        <Td>{note.reason}</Td>
                        <Td>
                          {note.issuedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                        </Td>
                        <Td numeric>
                          <Money amount={-Number(note.amount)} currency={invoice.currency} />
                        </Td>
                      </Tr>
                    ))}
                    {invoice.refunds.map((row) => (
                      <Tr key={row.id}>
                        <Td>
                          <span className="eyebrow mr-2">refund</span>
                          against {row.creditNote.number}
                        </Td>
                        <Td>
                          {METHOD_LABELS[row.method] ?? row.method}
                          {row.reference ? <span className="datum"> · {row.reference}</span> : null}
                        </Td>
                        <Td>
                          {row.refundedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                        </Td>
                        <Td numeric>
                          <Money amount={-Number(row.amount)} currency={invoice.currency} />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Where it stands" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: 'Invoiced', value: format(money.total.minor) },
                  { label: 'Paid', value: format(money.amountPaid.minor) },
                  ...(money.credited.minor > 0
                    ? [{ label: 'Credited', value: format(money.credited.minor) }]
                    : []),
                  ...(money.refunded.minor > 0
                    ? [{ label: 'Refunded', value: format(money.refunded.minor) }]
                    : []),
                  { label: 'Outstanding', value: format(money.outstanding.minor) },
                  ...(money.owedBack.minor > 0
                    ? [{ label: 'Owed back to them', value: format(money.owedBack.minor) }]
                    : []),
                  {
                    label: 'Due',
                    value: invoice.dueAt
                      ? invoice.dueAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })
                      : '—',
                  },
                ]}
              />
            </CardBody>
          </Card>

          {mayPay ? (
            <Card className="border-(--brand)">
              <CardHeader
                title="Take a payment"
                description={`${format(money.outstanding.minor)} outstanding`}
              />
              <form action={pay}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field label="Amount">
                    <Input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={(money.outstanding.minor / 100).toFixed(2)}
                      className="tabular-nums"
                      required
                    />
                  </Field>
                  <Field label="How">
                    <Select name="method" defaultValue="CARD">
                      {METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Reference"
                    hint="Terminal receipt, transfer reference, cheque number"
                  >
                    <Input name="reference" placeholder="Optional" />
                  </Field>
                  <Button type="submit" variant="primary">
                    Record the payment
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {points && spendable > 0 ? (
            <Card>
              <CardHeader
                title="Use their points"
                description={`${points.balance.toLocaleString('en-GB')} held, worth ${format(points.valueMinor)}`}
              />
              <form action={redeem}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field
                    label="Points to use"
                    hint={`Up to ${spendable.toLocaleString('en-GB')}, which is ${format(spendable)} off the bill`}
                    htmlFor="redeem-points"
                  >
                    <Input
                      id="redeem-points"
                      name="points"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={spendable}
                      step={1}
                      defaultValue={spendable}
                      className="tabular-nums"
                      required
                    />
                  </Field>
                  {points.expiring.points > 0 && points.expiring.on ? (
                    <p className="text-[12px] text-(--warning)">
                      {points.expiring.points.toLocaleString('en-GB')} of these lapse on{' '}
                      {points.expiring.on.toLocaleDateString('en-GB', { dateStyle: 'medium' })}.
                    </p>
                  ) : null}
                  <Button type="submit" variant="secondary">
                    Take the points off
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayPay ? (
            <Card>
              <CardHeader
                title="Redeem a gift card"
                description="Read the number off the card. Leave the amount blank to use as much as the bill needs."
              />
              <form action={redeemCard}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field label="Card number" htmlFor="card-code">
                    <Input
                      id="card-code"
                      name="code"
                      required
                      maxLength={14}
                      autoCapitalize="characters"
                      className="datum uppercase tracking-[0.12em]"
                      placeholder="XXXX-XXXX-XXXX"
                    />
                  </Field>
                  <Field label="Amount" hint="Optional" htmlFor="card-amount">
                    <Input
                      id="card-amount"
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder={(money.outstanding.minor / 100).toFixed(2)}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Take it off the bill
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayCredit ? (
            <Card>
              <CardHeader
                title="Raise a credit note"
                description="The invoice is never edited. This reduces what it was for."
              />
              <form action={credit}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field
                    label="Amount"
                    hint={`Up to ${format(money.total.minor - money.credited.minor)}`}
                  >
                    <Input
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      required
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Why" hint="Goes on the credit note the customer receives">
                    <Input
                      name="reason"
                      required
                      placeholder="Part was under warranty"
                      maxLength={200}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Raise the credit note
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayRefund ? (
            <Card className="border-(--warning)">
              <CardHeader
                title="Send money back"
                description={`${format(money.owedBack.minor)} is owed to the customer`}
              />
              <form action={refund}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field label="Against">
                    <Select name="creditNoteId" defaultValue={invoice.creditNotes[0]?.id ?? ''}>
                      {invoice.creditNotes.map((note) => (
                        <option key={note.id} value={note.id}>
                          {note.number} · {note.reason}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Amount">
                    <Input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={(money.owedBack.minor / 100).toFixed(2)}
                      className="tabular-nums"
                      required
                    />
                  </Field>
                  <Field label="How">
                    <Select name="method" defaultValue="BANK_TRANSFER">
                      {METHODS.filter((m) => m.value !== 'ACCOUNT').map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reference" hint="Optional">
                    <Input name="reference" />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Record the refund
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
