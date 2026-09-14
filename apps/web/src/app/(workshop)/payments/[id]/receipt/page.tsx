import { formatMinor } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/print-button';
import { receiptFor } from '@/lib/deposits';
import { requireSession } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Receipt ${id.slice(-6).toUpperCase()}` };
}

const METHOD: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  ONLINE: 'Online',
  CHEQUE: 'Cheque',
  ACCOUNT: 'On account',
  OTHER: 'Other',
  LOYALTY: 'Loyalty points',
  GIFT_CARD: 'Gift card',
  DEPOSIT: 'Money held on account',
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
          ← All payments
        </Link>
        <PrintButton label="Print the receipt" />
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
              <p className="text-[12px] text-(--text-faint)">Tax number {receipt.org.taxNumber}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="eyebrow">Receipt</p>
            <p className="datum text-[18px] font-semibold">{number}</p>
            <p className="text-[12px] text-(--text-soft)">{paidOn}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Received from</p>
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
            <p className="eyebrow">For</p>
            {receipt.invoice ? (
              <>
                <p className="mt-1 text-[14px] font-medium">Invoice {receipt.invoice.number}</p>
                {receipt.invoice.job ? (
                  <p className="text-[12px] text-(--text-soft)">
                    Job #{receipt.invoice.job.number} · {receipt.invoice.job.shortDescription}
                    {receipt.invoice.job.vehicle.registration
                      ? ` · ${receipt.invoice.job.vehicle.registration}`
                      : ''}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-[14px] font-medium">Money on account</p>
            )}
          </div>
        </section>

        <section className="border-t border-(--border) py-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-(--text-soft)">Amount received</span>
            <span className="font-display text-[28px] font-semibold tabular-nums">
              {formatMinor(receipt.amountMinor, region)}
            </span>
          </div>
          <dl className="mt-4 grid gap-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-(--text-faint)">Paid by</dt>
              <dd>{METHOD[receipt.method] ?? receipt.method}</dd>
            </div>
            {receipt.reference ? (
              <div className="flex justify-between">
                <dt className="text-(--text-faint)">Reference</dt>
                <dd className="datum">{receipt.reference}</dd>
              </div>
            ) : null}
            {receipt.invoice ? (
              <div className="flex justify-between">
                <dt className="text-(--text-faint)">Still owed on the invoice</dt>
                <dd className="tabular-nums">
                  {formatMinor(Math.max(0, receipt.outstandingMinor), region)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-(--text-faint)">Taken by</dt>
              <dd>{receipt.recordedBy?.name ?? 'System'}</dd>
            </div>
          </dl>
        </section>

        <footer className="border-t border-(--border) pt-4 text-[11px] text-(--text-faint)">
          Thank you. This receipt is a record of money received, not an invoice; the invoice is the
          document that shows what was done.
        </footer>
      </article>
    </div>
  );
}
