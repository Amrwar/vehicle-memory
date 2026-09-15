import { PaymentAttemptError, PaymentProviderError } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PortalShell } from '@/components/portal-shell';
import { attemptForCustomer, checkAttempt, startCardPayment } from '@/lib/card-payments';
import { requireUser } from '@/lib/guard';
import { cardPaymentsOffered } from '@/lib/payments/provider';
import { invoicesFor } from '@/lib/portal';
import { regionForUser } from '@/lib/region';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Invoices') };
}
export const dynamic = 'force-dynamic';

/**
 * Every invoice this customer has, everywhere. FR-2303.
 *
 * Not filtered by workshop. Somebody with a car serviced in one town and a van
 * serviced in another has one history, and splitting it by whoever happened to
 * do the work is the workshop's convenience rather than theirs.
 *
 * What is outstanding leads, because that is the only figure on the page that
 * asks anything of the reader. Everything settled is a record, and a record
 * can wait below the fold.
 *
 * Since Phase 32 an outstanding invoice can be paid here by card, through
 * the provider behind the seam. The customer comes back to this page with
 * the outcome, whichever way it went.
 */
function date(value: Date | null, locale: string): string {
  return value
    ? value.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

async function pay(formData: FormData) {
  'use server';

  const user = await requireUser();
  const invoiceId = String(formData.get('invoiceId') ?? '');
  let url: string;
  try {
    ({ url } = await startCardPayment({ userId: user.userId, invoiceId }));
  } catch (error) {
    if (error instanceof PaymentAttemptError || error instanceof PaymentProviderError) {
      redirect(`/portal/invoices?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(url);
}

export default async function PortalInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string; problem?: string }>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const { paid, cancelled, problem } = await searchParams;
  const region = await regionForUser(user.userId);

  // Back from the checkout: if the provider has not told us yet, ask it now,
  // so the page the customer lands on already says what happened.
  let outcome: { status: string; reason: string | null; number: string | null } | null = null;
  if (paid) {
    let attempt = await attemptForCustomer(user.userId, paid);
    if (attempt?.status === 'PENDING') {
      await checkAttempt({ orgId: attempt.orgId, attemptId: attempt.id });
      attempt = await attemptForCustomer(user.userId, paid);
    }
    if (attempt)
      outcome = {
        status: attempt.status,
        reason: attempt.failureReason,
        number: attempt.invoice.number,
      };
  }

  const invoices = await invoicesFor(user.userId);
  const owing = invoices.filter((invoice) => invoice.outstanding > 0.005);
  const settled = invoices.filter((invoice) => invoice.outstanding <= 0.005);

  const owedTotal = owing.reduce((total, invoice) => total + invoice.outstanding, 0);
  const currency = invoices[0]?.currency ?? 'GBP';
  const offered = cardPaymentsOffered();

  return (
    <PortalShell active="invoices">
      <h1 className="font-display text-[24px] font-semibold leading-tight">{t('Invoices')}</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {invoices.length === 0
          ? t('Nothing has been invoiced to you yet.')
          : owing.length === 0
            ? t('Everything is settled. Nothing is owed.')
            : owing.length === 1
              ? t('1 still to pay.')
              : t('{count} still to pay.', { count: owing.length })}
      </p>

      {outcome?.status === 'SUCCEEDED' ? (
        <Alert tone="success" className="mt-4">
          {outcome.number
            ? t(
                'Paid. Thank you. Invoice {number} is settled, and a receipt is on its way to you.',
                {
                  number: outcome.number,
                },
              )
            : t('Paid. Thank you. The invoice is settled, and a receipt is on its way to you.')}
        </Alert>
      ) : null}
      {outcome?.status === 'FAILED' ? (
        <Alert tone="danger" title={t('That payment did not go through')} className="mt-4">
          {outcome.reason ? t(outcome.reason) : t('The provider did not say why.')}{' '}
          {t('Nothing has been taken. You can try again, or pay the workshop directly.')}
        </Alert>
      ) : null}
      {outcome?.status === 'PENDING' ? (
        <Alert tone="warning" className="mt-4">
          {t(
            'The provider has not confirmed the payment yet. This page will show it once it does; nothing needs doing.',
          )}
        </Alert>
      ) : null}
      {cancelled ? (
        <Alert tone="info" className="mt-4">
          {t('Cancelled. Nothing has been taken.')}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mt-4">
          {t(problem)}
        </Alert>
      ) : null}

      {invoices.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title={t('No invoices')}
          description={t('When a workshop invoices you for work, it appears here and stays.')}
        />
      ) : null}

      {owing.length > 0 ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[17px] font-semibold">{t('Outstanding')}</h2>
            <p className="font-display text-[20px] font-semibold">
              <Money amount={owedTotal} currency={currency} />
            </p>
          </div>

          <ul className="mt-3 grid gap-3">
            {owing.map((invoice) => (
              <li key={invoice.id}>
                <Card className="border-(--warning)">
                  <CardHeader
                    title={invoice.number ?? t('Invoice')}
                    description={t('{workshop} · issued {date}', {
                      workshop: invoice.org.name,
                      date: date(invoice.issuedAt, region.locale),
                    })}
                    action={
                      <Badge tone="warning" size="sm">
                        {invoice.paidNumber > 0 ? t('part paid') : t('unpaid')}
                      </Badge>
                    }
                  />
                  <CardBody className="grid gap-1.5 text-[13px]">
                    <p className="text-(--text-soft)">
                      {invoice.job?.shortDescription ?? t('Counter sale')}
                      {invoice.job?.vehicle?.registration ? (
                        <span className="ms-2 inline-block align-middle">
                          <Registration value={invoice.job.vehicle.registration} />
                        </span>
                      ) : null}
                    </p>

                    <div className="flex justify-between text-(--text-soft)">
                      <span>{t('Invoiced')}</span>
                      <Money amount={invoice.totalNumber} currency={invoice.currency} />
                    </div>

                    {invoice.paidNumber > 0 ? (
                      <div className="flex justify-between text-(--text-soft)">
                        <span>{t('Paid so far')}</span>
                        <Money amount={invoice.paidNumber} currency={invoice.currency} />
                      </div>
                    ) : null}

                    <div className="flex justify-between border-t border-(--border) pt-1.5 font-medium">
                      <span>{t('Still to pay')}</span>
                      <Money amount={invoice.outstanding} currency={invoice.currency} />
                    </div>

                    <a
                      href={`/api/print/invoice/${invoice.id}`}
                      className="text-[13px] text-(--brand-text) hover:underline"
                    >
                      {t('Download the invoice as a PDF')}
                    </a>

                    {offered ? (
                      <form action={pay} className="mt-3">
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <Button type="submit" variant="primary" size="lg" block>
                          <svg
                            aria-hidden
                            viewBox="0 0 24 24"
                            className="h-[18px] w-[18px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
                            <path d="M2.5 10h19M6.5 14.5h4" />
                          </svg>
                          <span>
                            {t('Pay {amount} by card')
                              .split('{amount}')
                              .flatMap((part, index) =>
                                index === 0
                                  ? [part]
                                  : [
                                      <Money
                                        key={index}
                                        amount={invoice.outstanding}
                                        currency={invoice.currency}
                                      />,
                                      part,
                                    ],
                              )}
                          </span>
                        </Button>
                        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-(--text-faint)">
                          <svg
                            aria-hidden
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
                            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                          </svg>
                          {t('Secure checkout. Your card details never reach the workshop.')}
                        </p>
                      </form>
                    ) : null}

                    <p className="mt-1 text-[12px] text-(--text-faint)">
                      {invoice.dueAt
                        ? `${t('Due {date}.', { date: date(invoice.dueAt, region.locale) })} `
                        : ''}
                      {offered
                        ? t('You can also pay the workshop directly.')
                        : t('Pay the workshop directly.')}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {settled.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display text-[17px] font-semibold">{t('Settled')}</h2>
          <ul className="mt-3 grid gap-2">
            {settled.map((invoice) => (
              <li
                key={invoice.id}
                className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={`/api/print/invoice/${invoice.id}`}
                    className="font-medium hover:underline"
                  >
                    {invoice.number ?? t('Invoice')}
                  </a>
                  <span className="font-medium tabular-nums">
                    <Money amount={invoice.totalNumber} currency={invoice.currency} />
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-(--text-soft)">
                  {invoice.org.name} · {date(invoice.issuedAt, region.locale)}
                  {invoice.payments[0]
                    ? ` · ${
                        invoice.payments[0].method === 'LOYALTY'
                          ? t('paid with points')
                          : invoice.payments[0].method === 'ONLINE'
                            ? t('paid by card online')
                            : t(
                                `paid by ${invoice.payments[0].method.toLowerCase().replace('_', ' ')}`,
                              )
                      }`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PortalShell>
  );
}
