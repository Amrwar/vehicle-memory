import { formatMinor, msg } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/print-button';
import { receiptFor } from '@/lib/deposits';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await tFor();
  return { title: t('Receipt {number}', { number: id.slice(-6).toUpperCase() }) };
}

const METHOD: Record<string, string> = {
  CASH: msg('Cash'),
  CARD: msg('Card'),
  BANK_TRANSFER: msg('Bank transfer'),
  ONLINE: msg('Online'),
  CHEQUE: msg('Cheque'),
  ACCOUNT: msg('On account'),
  OTHER: msg('Other'),
  LOYALTY: msg('Loyalty points'),
  GIFT_CARD: msg('Gift card'),
  DEPOSIT: msg('Money held on account'),
};

/**
 * A receipt. Phase 30.
 *
 * One payment on one sheet: who paid, how much, how, for what, and what is
 * still owed. Built to be printed, which is why it has no sidebar and why
 * the chrome hides when it is: a customer at the counter is handed paper,
 * not a screen.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireSession('payment:read');
  const t = await tFor();

  const receipt = await receiptFor(orgId, id);
  if (!receipt) notFound();

  const { region } = receipt;
  const site = receipt.org.locations[0];
  const number = `R-${receipt.id.slice(-6).toUpperCase()}`;
  const paidOn = receipt.receivedAt.toLocaleString(region.locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: region.timezone,
  });

  return (
    <div className="mx-auto max-w-[42rem]">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/payments" className="text-[13px] text-(--text-soft) hover:underline">
          {t('← All payments')}
        </Link>
        <PrintButton label={msg('Print the receipt')} />
      </div>

      <article className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--border) pb-5">
          <div>
            <p className="font-display text-[20px] font-semibold">{receipt.org.name}</p>
            {receipt.org.legalName && receipt.org.legalName !== receipt.org.name ? (
              <p className="text-[12px] text-(--text-faint)">{receipt.org.legalName}</p>
            ) : null}
            {site ? (
              <p className="mt-1 text-[12px] text-(--text-soft)">
                {[site.addressLine1, site.addressLine2, site.locality, site.region, site.postcode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            ) : null}
            <p className="text-[12px] text-(--text-soft)">
              {[receipt.org.phone, receipt.org.email].filter(Boolean).join(' · ')}
            </p>
            {receipt.org.taxNumber ? (
              <p className="text-[12px] text-(--text-faint)">
                {t('Tax number {number}', { number: receipt.org.taxNumber })}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="eyebrow">{t('Receipt')}</p>
            <p className="datum text-[18px] font-semibold">{number}</p>
            <p className="text-[12px] text-(--text-soft)">{paidOn}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">{t('Received from')}</p>
            <p className="mt-1 text-[14px] font-medium">{receipt.customer.displayName}</p>
            <p className="text-[12px] text-(--text-soft)">
              {[
                receipt.customer.addressLine1,
                receipt.customer.addressLine2,
                receipt.customer.locality,
                receipt.customer.postcode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
          <div>
            <p className="eyebrow">{t('For')}</p>
            {receipt.invoice ? (
              <>
                <p className="mt-1 text-[14px] font-medium">
                  {t('Invoice {number}', { number: receipt.invoice.number })}
                </p>
                {receipt.invoice.job ? (
                  <p className="text-[12px] text-(--text-soft)">
                    {t('Job #{number}', { number: receipt.invoice.job.number })} ·{' '}
                    {receipt.invoice.job.shortDescription}
                    {receipt.invoice.job.vehicle.registration
                      ? ` · ${receipt.invoice.job.vehicle.registration}`
                      : ''}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-[14px] font-medium">{t('Money on account')}</p>
            )}
          </div>
        </section>

        <section className="border-t border-(--border) py-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-(--text-soft)">{t('Amount received')}</span>
            <span className="font-display text-[28px] font-semibold tabular-nums">
              {formatMinor(receipt.amountMinor, region)}
            </span>
          </div>
          <dl className="mt-4 grid gap-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-(--text-faint)">{t('Paid by')}</dt>
              <dd>{t(METHOD[receipt.method] ?? receipt.method)}</dd>
            </div>
            {receipt.reference ? (
              <div className="flex justify-between">
                <dt className="text-(--text-faint)">{t('Reference')}</dt>
                <dd className="datum">{receipt.reference}</dd>
              </div>
            ) : null}
            {receipt.invoice ? (
              <div className="flex justify-between">
                <dt className="text-(--text-faint)">{t('Still owed on the invoice')}</dt>
                <dd className="tabular-nums">
                  {formatMinor(Math.max(0, receipt.outstandingMinor), region)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-(--text-faint)">{t('Taken by')}</dt>
              <dd>{receipt.recordedBy?.name ?? t('System')}</dd>
            </div>
          </dl>
        </section>

        <footer className="border-t border-(--border) pt-4 text-[11px] text-(--text-faint)">
          {t(
            'Thank you. This receipt is a record of money received, not an invoice; the invoice is the document that shows what was done.',
          )}
        </footer>
      </article>
    </div>
  );
}
