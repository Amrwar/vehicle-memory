import {
  money as moneyOf,
  splitOverpayment,
  describeSettlement,
  fromDecimal,
  msg,
  type InvoiceState,
  type PaymentMethod,
  PaymentAttemptError,
  PaymentProviderError,
} from '@carnet/core';
import { prisma } from '@carnet/db';
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
import { SubmitOnce } from '@/components/submit-once';
import { CouponError, redeemAgainstInvoice as redeemCouponOn } from '@/lib/coupons';
import { applyHeld, DepositError, heldFor, takeDeposit } from '@/lib/deposits';
import { GiftCardError, redeemGiftCard } from '@/lib/giftcards';
import { can, requireSession } from '@/lib/guard';
import { once, onceToken, StillGoingError } from '@/lib/once';
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
import { tFor } from '@/lib/i18n';
import { bandsFor } from '@/lib/tax';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('invoice:read');
  const t = await tFor();
  const invoice = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: invoice ? t('Invoice {number}', { number: invoice.number }) : t('Invoice') };
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
  { value: 'CARD', label: msg('Card') },
  { value: 'CASH', label: msg('Cash') },
  { value: 'BANK_TRANSFER', label: msg('Bank transfer') },
  { value: 'CHEQUE', label: msg('Cheque') },
  { value: 'ONLINE', label: msg('Online') },
  { value: 'ACCOUNT', label: msg('On account') },
];

/** Points are not typed in as an amount; they have a form of their own below. */
const METHOD_LABELS: Record<string, string> = {
  ...Object.fromEntries(METHODS.map((m) => [m.value, m.label])),
  LOYALTY: msg('Points'),
  GIFT_CARD: msg('Gift card'),
  DEPOSIT: msg('Money held'),
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
  if (raw === 'GIFT_CARD') return 'GIFT_CARD';
  if (raw === 'DEPOSIT') return 'DEPOSIT';
  return (METHODS.some((m) => m.value === raw) ? raw : 'CARD') as PaymentMethod;
}

/**
 * Money against the bill. FR-7802.
 *
 * Wrapped in the key the form was drawn with, because two cash payments of
 * fifty pounds against one bill on one afternoon are two real payments and
 * nothing inside them says which is which. What separates them is that they
 * came from two separately drawn forms. A double-click sends one form's key
 * twice and the second press is absorbed; taking another fifty pounds
 * tomorrow is a new form and goes through.
 */
async function pay(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await once({
      orgId,
      key: ['pay', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        recordPayment({
          orgId,
          userId: user.userId,
          invoiceId,
          amount: amountFrom(formData, 'amount'),
          method: methodFrom(formData),
          reference: String(formData.get('reference') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    if (!(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=paid`);
}

/**
 * Settles the bill and holds the rest. FR-8802.
 *
 * A customer who hands over more than the bill is not a mistake to be refused
 * at the counter. `recordPayment` still refuses an overpayment, deliberately —
 * an amount larger than the bill is as likely to be a mis-key as a deliberate
 * payment ahead, and which of the two it is should be a person's decision
 * rather than a form's guess.
 *
 * What was missing until Phase 53 is that the refusal named an action the page
 * did not offer: "take the rest as a deposit" meant leaving the invoice,
 * finding the customer, and working out the difference by hand, with somebody
 * waiting. Now the sentence has a button under it, the arithmetic is the
 * product's, and the decision is still the person's.
 */
async function payAndHold(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await once({
      orgId,
      key: ['pay-and-hold', invoiceId, String(formData.get('once') ?? '')],
      work: async () => {
        const invoice = await prisma.invoice.findFirstOrThrow({
          where: { id: invoiceId, orgId },
          select: { customerId: true, total: true, amountPaid: true, currency: true },
        });

        const outstanding = Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100);

        const handed = amountFrom(formData, 'amount');
        const split = splitOverpayment({ paid: handed.minor, outstanding });

        if (split.settles > 0) {
          await recordPayment({
            orgId,
            userId: user.userId,
            invoiceId,
            amount: moneyOf(split.settles, invoice.currency),
            method: methodFrom(formData),
            reference: String(formData.get('reference') ?? ''),
          });
        }

        if (split.credit > 0) {
          // Written in the language of whoever took it. The note is stored and
          // read back later on the customer's page, so translating it at
          // display time would mean guessing which language it was written in.
          const t = await tFor();

          await takeDeposit({
            orgId,
            userId: user.userId,
            customerId: invoice.customerId,
            amountMinor: split.credit,
            method: methodFrom(formData),
            note: t('Paid more than the bill'),
          });
        }
      },
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    if (error instanceof MoneyCycleError || error instanceof DepositError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/invoices/${invoiceId}?done=paid-and-held`);
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
    await once({
      orgId,
      key: ['redeem', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        redeemAgainstInvoice({
          orgId,
          userId: user.userId,
          invoiceId,
          points: Number(String(formData.get('points') ?? '').trim()),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    if (!(error instanceof LoyaltyError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=redeemed`);
}

/**
 * A code off the bill. FR-7703.
 *
 * Settled the way points are: the invoice keeps the total it was issued at,
 * and what the code took off posts to what the offers cost rather than to the
 * bank. Refused with the reason — out of date, all used, already used by this
 * customer, bill too small — so whoever is at the counter can decide.
 */
async function useCoupon(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');

  try {
    await redeemCouponOn({
      orgId,
      userId: user.userId,
      invoiceId,
      code: String(formData.get('code') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof CouponError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=coupon`);
}

/**
 * Money already held for the customer, put against the bill. Oldest first,
 * as much as the bill needs unless an amount is typed; refused rather than
 * clamped when the amount is more than is held or owed.
 */
async function useHeld(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const invoiceId = String(formData.get('invoiceId') ?? '');
  const typed = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');

  try {
    await once({
      orgId,
      key: ['useHeld', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        applyHeld({
          orgId,
          userId: user.userId,
          invoiceId,
          amountMinor: typed === '' ? null : Math.round(Number(typed) * 100),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    if (!(error instanceof DepositError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}?done=held`);
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
    await once({
      orgId,
      key: ['redeemCard', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        redeemGiftCard({
          orgId,
          userId: user.userId,
          invoiceId,
          code: String(formData.get('code') ?? ''),
          amountMinor: typed === '' ? null : Math.round(Number(typed) * 100),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
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
    await once({
      orgId,
      key: ['credit', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        raiseCreditNote({
          orgId,
          userId: user.userId,
          invoiceId,
          amount: amountFrom(formData, 'amount'),
          reason: String(formData.get('reason') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
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
    await once({
      orgId,
      key: ['refund', invoiceId, String(formData.get('once') ?? '')],
      work: () =>
        recordRefund({
          orgId,
          userId: user.userId,
          invoiceId,
          creditNoteId: String(formData.get('creditNoteId') ?? ''),
          amount: amountFrom(formData, 'amount'),
          method: methodFrom(formData),
          reference: String(formData.get('reference') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/invoices/${invoiceId}?problem=${encodeURIComponent(error.message)}`);
    }
    if (
      !(error instanceof MoneyCycleError) &&
      !(error instanceof GiftCardError) &&
      !(error instanceof PaymentAttemptError) &&
      !(error instanceof PaymentProviderError)
    ) {
      throw error;
    }
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
  const { orgId, user, region } = await requireSession('invoice:read');
  const t = await tFor();

  const detail = await invoiceDetail(orgId, id);
  if (!detail) notFound();

  const { invoice, money } = detail;
  // Each tax as it was declared when the invoice was issued. Phase 41.
  const bands = await bandsFor('INVOICE', invoice.id);
  const status = invoice.status as InvoiceState;

  const settlement = describeSettlement({
    status,
    total: money.total,
    amountPaid: money.amountPaid,
    dueAt: invoice.dueAt,
  });

  const mayPay =
    can(user.role, 'payment:write') && money.outstanding.minor > 0 && status !== 'VOID';

  // A key for this drawing of the page, carried by the forms that move money.
  // Every press of one of those buttons sends the same key, so the second
  // press is absorbed rather than taking the money again. Phase 46.
  const token = onceToken();
  const mayCredit =
    can(user.role, 'invoice:write') &&
    status !== 'DRAFT' &&
    status !== 'VOID' &&
    money.credited.minor < money.total.minor;
  const mayRefund = can(user.role, 'payment:write') && money.owedBack.minor > 0;
  const paidWithCard = invoice.payments.some((p) => p.method === 'GIFT_CARD');
  const paidThroughProvider = invoice.paymentAttempts.length > 0;
  const held = mayPay ? await heldFor(orgId, invoice.customer.id) : null;

  // Points are only offered when there is a bill to put them against and
  // something to put. A card with nothing to spend is a card to explain.
  const points = mayPay ? await loyaltyCardFor(orgId, invoice.customer.id) : null;
  const spendable = points ? spendableAgainst(points.balance, money.outstanding.minor) : 0;

  const format = (minor: number) =>
    new Intl.NumberFormat(region.locale, { style: 'currency', currency: invoice.currency }).format(
      minor / 100,
    );

  return (
    <>
      <div className="mb-3">
        <BackLink href="/invoices">{t('All invoices')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Invoice · {customer}', { customer: invoice.customer.displayName })}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {invoice.number}
            <Badge tone={TONE[status]} dot>
              {t(status.replace('_', ' ').toLowerCase())}
            </Badge>
          </span>
        }
        description={t(settlement)}
        actions={
          <>
            {invoice.job ? (
              <Link href={`/jobs/${invoice.job.id}`}>
                <Button>{t('Job #{number}', { number: invoice.job.number })}</Button>
              </Link>
            ) : null}
            <Link href={`/customers/${invoice.customer.id}`}>
              <Button variant="secondary">{t('Customer')}</Button>
            </Link>
            <Link href={`/print/invoice/${invoice.id}`}>
              <Button variant="secondary">{t('Print')}</Button>
            </Link>
            <a href={`/api/print/invoice/${invoice.id}`}>
              <Button variant="secondary">{t('PDF')}</Button>
            </a>
          </>
        }
      />

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'paid'
            ? t('Payment recorded and posted to the ledger.')
            : notice.done === 'redeemed'
              ? t(
                  'Points taken off the bill and booked as the cost of the programme, not as money in.',
                )
              : notice.done === 'coupon'
                ? t('Code taken off the bill and booked as what the offer cost, not as money in.')
                : notice.done === 'card'
                  ? t(
                      'Gift card redeemed. The money came in when the card was sold; this releases what was owed.',
                    )
                  : notice.done === 'held'
                    ? t(
                        'Money held for the customer put against the bill. The books release what was owed; the bank saw the money when it was taken.',
                      )
                    : notice.done === 'credited'
                      ? t(
                          'Credit note raised. The customer has been told, and revenue has been reversed in proportion.',
                        )
                      : t('Refund recorded. The customer has been told it is on its way.')}
        </Alert>
      ) : null}

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(notice.problem)}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('What it was for')}
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
                    <Th>{t('Line')}</Th>
                    <Th numeric>{t('Qty')}</Th>
                    <Th numeric>{t('Unit')}</Th>
                    <Th numeric>{t('Tax')}</Th>
                    <Th numeric>{t('Total')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <Tr key={line.id}>
                      <Td>
                        <span className="eyebrow me-2">{t(line.kind.toLowerCase())}</span>
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
                <span className="text-(--text-faint)">{t('Net')}</span>
                <Money amount={Number(invoice.subtotal)} currency={invoice.currency} />
              </div>
              {bands.length > 1 || (bands[0] && bands[0].tax.minor > 0) ? (
                bands.map((band) => (
                  <div key={`${band.name} ${band.ratePct}`} className="flex justify-between">
                    <span className="text-(--text-faint)">
                      {t('{name} at {rate}% on {net}', {
                        name: t(band.name),
                        rate: band.ratePct,
                        net: new Intl.NumberFormat(region.locale, {
                          style: 'currency',
                          currency: invoice.currency,
                        }).format(band.net.minor / 100),
                      })}
                    </span>
                    <Money amount={band.tax.minor / 100} currency={invoice.currency} />
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">{t('Tax')}</span>
                  <Money amount={Number(invoice.taxTotal)} currency={invoice.currency} />
                </div>
              )}
              <div className="flex justify-between border-t border-(--border) pt-2 font-display text-[16px] font-semibold">
                <span>{t('Total')}</span>
                <Money amount={Number(invoice.total)} currency={invoice.currency} />
              </div>
              {invoice.taxExemptReference ? (
                <p className="text-[12px] text-(--text-faint)">
                  {t('Exempt from tax: {reference}', { reference: invoice.taxExemptReference })}
                </p>
              ) : null}
              {invoice.pricesIncludeTax ? (
                <p className="text-[12px] text-(--text-faint)">
                  {t('Prices on this invoice include tax.')}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={t('Money in')}
              description={
                invoice.payments.length === 0
                  ? t('Nothing received yet.')
                  : invoice.payments.length === 1
                    ? t('1 payment')
                    : t('{count} payments', { count: invoice.payments.length })
              }
            />
            {invoice.payments.length > 0 ? (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('When')}</Th>
                      <Th>{t('How paid')}</Th>
                      <Th>{t('Reference')}</Th>
                      <Th>{t('Taken by')}</Th>
                      <Th numeric>{t('Amount')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((payment) => (
                      <Tr key={payment.id}>
                        <Td>
                          {payment.receivedAt.toLocaleString(region.locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Td>
                        <Td>{t(METHOD_LABELS[payment.method] ?? payment.method)}</Td>
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
              <CardHeader
                title={t('Put right')}
                description={t('Credit notes and money returned')}
              />
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Document')}</Th>
                      <Th>{t('Why')}</Th>
                      <Th>{t('When')}</Th>
                      <Th numeric>{t('Amount')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.creditNotes.map((note) => (
                      <Tr key={note.id}>
                        <Td>
                          <span className="eyebrow me-2">{t('credit')}</span>
                          {note.number}
                        </Td>
                        <Td>{note.reason}</Td>
                        <Td>
                          {note.issuedAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}
                        </Td>
                        <Td numeric>
                          <Money amount={-Number(note.amount)} currency={invoice.currency} />
                        </Td>
                      </Tr>
                    ))}
                    {invoice.refunds.map((row) => (
                      <Tr key={row.id}>
                        <Td>
                          <span className="eyebrow me-2">{t('refund')}</span>
                          {t('against {number}', { number: row.creditNote.number })}
                        </Td>
                        <Td>
                          {t(METHOD_LABELS[row.method] ?? row.method)}
                          {row.reference ? <span className="datum"> · {row.reference}</span> : null}
                        </Td>
                        <Td>
                          {row.refundedAt.toLocaleDateString(region.locale, {
                            dateStyle: 'medium',
                          })}
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
            <CardHeader title={t('Where it stands')} />
            <CardBody>
              <KeyValue
                columns={1}
                t={t}
                items={[
                  { label: t('Invoiced'), value: format(money.total.minor) },
                  { label: t('Paid'), value: format(money.amountPaid.minor) },
                  ...(money.credited.minor > 0
                    ? [{ label: t('Credited'), value: format(money.credited.minor) }]
                    : []),
                  ...(money.refunded.minor > 0
                    ? [{ label: t('Refunded'), value: format(money.refunded.minor) }]
                    : []),
                  { label: t('Outstanding'), value: format(money.outstanding.minor) },
                  ...(money.owedBack.minor > 0
                    ? [{ label: t('Owed back to them'), value: format(money.owedBack.minor) }]
                    : []),
                  {
                    label: t('Due'),
                    value: invoice.dueAt
                      ? invoice.dueAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })
                      : '—',
                  },
                ]}
              />
            </CardBody>
          </Card>

          {/* When there is nothing owing there is nothing to settle, so every
              way of settling disappears at once — and somebody who came here
              looking for one of them is left wondering where it went. Saying
              so is cheaper than the support call. */}
          {!mayPay && can(user.role, 'payment:write') && status !== 'VOID' ? (
            <Card>
              <CardBody className="grid gap-1 text-[13px] text-(--text-soft)">
                <p className="font-medium text-(--text)">{t('Nothing left to pay')}</p>
                <p>
                  {t(
                    'This bill is settled, so there is nothing here to take a payment, a gift card, points, a coupon or money held against. Raising a credit note is below.',
                  )}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {mayPay ? (
            <Card className="border-(--brand)">
              <CardHeader
                title={t('Take a payment')}
                description={t('{amount} outstanding', { amount: format(money.outstanding.minor) })}
              />
              <form action={pay}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field label={t('Amount')}>
                    <Input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={(money.outstanding.minor / 100).toFixed(2)}
                      className="tabular-nums"
                      required
                    />
                  </Field>
                  <Field label={t('How paid')}>
                    <Select name="method" defaultValue="CARD">
                      {METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {t(m.label)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={t('Reference')}
                    hint={t('Terminal receipt, transfer reference, cheque number')}
                  >
                    <Input name="reference" placeholder={t('Optional')} />
                  </Field>
                  <SubmitOnce>{t('Record the payment')}</SubmitOnce>

                  {/*
                    The second way out of the same form. A payment larger than
                    the bill is refused, on purpose — whether it is a mis-key
                    or a customer paying ahead is a person's call, not a
                    form's. But until Phase 53 the refusal named an action this
                    page did not offer, so making that call meant leaving the
                    invoice and doing the arithmetic by hand with somebody
                    waiting. It is one press now, and still their decision.
                  */}
                  <Button type="submit" formAction={payAndHold} variant="secondary">
                    {t('Settle the bill and hold the rest')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {points && spendable > 0 ? (
            <Card>
              <CardHeader
                title={t('Use their points')}
                description={t('{points} held, worth {amount}', {
                  points: points.balance.toLocaleString(region.locale),
                  amount: format(points.valueMinor),
                })}
              />
              <form action={redeem}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field
                    label={t('Points to use')}
                    hint={t('Up to {points}, which is {amount} off the bill', {
                      points: spendable.toLocaleString(region.locale),
                      amount: format(spendable),
                    })}
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
                      {t('{points} of these lapse on {date}.', {
                        points: points.expiring.points.toLocaleString(region.locale),
                        date: points.expiring.on.toLocaleDateString(region.locale, {
                          dateStyle: 'medium',
                        }),
                      })}
                    </p>
                  ) : null}
                  <Button type="submit" variant="secondary">
                    {t('Take the points off')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayPay && money.outstanding.minor > 0 ? (
            <Card>
              <CardHeader
                title={t('Use a coupon')}
                description={t(
                  'The code off the postcard or the email. Spaces and dashes do not matter.',
                )}
              />
              <form action={useCoupon}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Field label={t('Code')} htmlFor="coupon-code">
                    <Input
                      id="coupon-code"
                      name="code"
                      className="datum uppercase"
                      autoComplete="off"
                      placeholder={t('Their code')}
                      required
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    {t('Take the code off')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {held && held.heldMinor > 0 ? (
            <Card className="border-(--brand)">
              <CardHeader
                title={t('Use money held')}
                description={
                  held.live.some((row) => row.kind === 'CREDIT')
                    ? t(
                        '{amount} is held for this customer, some of it credit from a refund. Leave the amount blank to use as much as the bill needs.',
                        { amount: format(held.heldMinor) },
                      )
                    : t(
                        '{amount} is held for this customer. Leave the amount blank to use as much as the bill needs.',
                        { amount: format(held.heldMinor) },
                      )
                }
              />
              <form action={useHeld}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field label={t('Amount')} hint={t('Optional')} htmlFor="held-amount">
                    <Input
                      id="held-amount"
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder={(
                        Math.min(held.heldMinor, money.outstanding.minor) / 100
                      ).toFixed(2)}
                    />
                  </Field>
                  <Button type="submit" variant="primary">
                    {t('Put it against the bill')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayPay ? (
            <Card>
              <CardHeader
                title={t('Redeem a gift card')}
                description={t(
                  'Read the number off the card. Leave the amount blank to use as much as the bill needs.',
                )}
              />
              <form action={redeemCard}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field label={t('Card number')} htmlFor="card-code">
                    <Input
                      id="card-code"
                      name="code"
                      required
                      maxLength={14}
                      autoCapitalize="characters"
                      className="datum uppercase tracking-[0.12em]"
                      // i18n-ignore
                      placeholder="XXXX-XXXX-XXXX"
                    />
                  </Field>
                  <Field label={t('Amount')} hint={t('Optional')} htmlFor="card-amount">
                    <Input
                      id="card-amount"
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder={(money.outstanding.minor / 100).toFixed(2)}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    {t('Take it off the bill')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayCredit ? (
            <Card>
              <CardHeader
                title={t('Raise a credit note')}
                description={t('The invoice is never edited. This reduces what it was for.')}
              />
              <form action={credit}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field
                    label={t('Amount')}
                    hint={t('Up to {amount}', {
                      amount: format(money.total.minor - money.credited.minor),
                    })}
                  >
                    <Input
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      required
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label={t('Why')} hint={t('Goes on the credit note the customer receives')}>
                    <Input
                      name="reason"
                      required
                      placeholder={t('Part was under warranty')}
                      maxLength={200}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    {t('Raise the credit note')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayRefund ? (
            <Card className="border-(--warning)">
              <CardHeader
                title={t('Send money back')}
                description={t('{amount} is owed to the customer', {
                  amount: format(money.owedBack.minor),
                })}
              />
              <form action={refund}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="once" value={token} />
                  <Field label={t('Against')}>
                    <Select name="creditNoteId" defaultValue={invoice.creditNotes[0]?.id ?? ''}>
                      {invoice.creditNotes.map((note) => (
                        <option key={note.id} value={note.id}>
                          {note.number} · {note.reason}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('Amount')}>
                    <Input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={(money.owedBack.minor / 100).toFixed(2)}
                      className="tabular-nums"
                      required
                    />
                  </Field>
                  <Field
                    label={t('How paid')}
                    hint={
                      paidWithCard
                        ? t('This bill was paid with a gift card; the money can go back onto it.')
                        : undefined
                    }
                  >
                    <Select
                      name="method"
                      defaultValue={paidWithCard ? 'GIFT_CARD' : 'BANK_TRANSFER'}
                    >
                      {paidWithCard ? (
                        <option value="GIFT_CARD">{t('Back onto the gift card')}</option>
                      ) : null}
                      {paidThroughProvider ? (
                        <option value="ONLINE">
                          {t('Back to their card, through the provider')}
                        </option>
                      ) : null}
                      <option value="DEPOSIT">{t('Keep it as credit on their account')}</option>
                      {METHODS.filter((m) => m.value !== 'ACCOUNT' && m.value !== 'ONLINE').map(
                        (m) => (
                          <option key={m.value} value={m.value}>
                            {t(m.label)}
                          </option>
                        ),
                      )}
                    </Select>
                  </Field>
                  <Field label={t('Reference')} hint={t('Optional')}>
                    <Input name="reference" />
                  </Field>
                  <Button type="submit" variant="secondary">
                    {t('Record the refund')}
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
