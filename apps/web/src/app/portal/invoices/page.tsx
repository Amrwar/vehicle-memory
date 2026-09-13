import { Badge, Card, CardBody, CardHeader, EmptyState, Money, Registration } from '@carnet/ui';
import type { Metadata } from 'next';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { invoicesFor } from '@/lib/portal';

export const metadata: Metadata = { title: 'Invoices' };
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
 */
function date(value: Date | null): string {
  return value
    ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

export default async function PortalInvoicesPage() {
  const user = await requireUser();
  const invoices = await invoicesFor(user.userId);

  const owing = invoices.filter((invoice) => invoice.outstanding > 0.005);
  const settled = invoices.filter((invoice) => invoice.outstanding <= 0.005);

  const owedTotal = owing.reduce((total, invoice) => total + invoice.outstanding, 0);
  const currency = invoices[0]?.currency ?? 'GBP';

  return (
    <PortalShell active="invoices">
      <h1 className="font-display text-[24px] font-semibold leading-tight">Invoices</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {invoices.length === 0
          ? 'Nothing has been invoiced to you yet.'
          : owing.length === 0
            ? 'Everything is settled. Nothing is owed.'
            : `${owing.length} still to pay.`}
      </p>

      {invoices.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title="No invoices"
          description="When a workshop invoices you for work, it appears here and stays."
        />
      ) : null}

      {owing.length > 0 ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[17px] font-semibold">Outstanding</h2>
            <p className="font-display text-[20px] font-semibold">
              <Money amount={owedTotal} currency={currency} />
            </p>
          </div>

          <ul className="mt-3 grid gap-3">
            {owing.map((invoice) => (
              <li key={invoice.id}>
                <Card className="border-(--warning)">
                  <CardHeader
                    title={invoice.number ?? 'Invoice'}
                    description={`${invoice.org.name} · issued ${date(invoice.issuedAt)}`}
                    action={
                      <Badge tone="warning" size="sm">
                        {invoice.paidNumber > 0 ? 'part paid' : 'unpaid'}
                      </Badge>
                    }
                  />
                  <CardBody className="grid gap-1.5 text-[13px]">
                    <p className="text-(--text-soft)">
                      {invoice.job?.shortDescription ?? 'Counter sale'}
                      {invoice.job?.vehicle?.registration ? (
                        <span className="ml-2 inline-block align-middle">
                          <Registration value={invoice.job.vehicle.registration} />
                        </span>
                      ) : null}
                    </p>

                    <div className="flex justify-between text-(--text-soft)">
                      <span>Invoiced</span>
                      <Money amount={invoice.totalNumber} currency={invoice.currency} />
                    </div>

                    {invoice.paidNumber > 0 ? (
                      <div className="flex justify-between text-(--text-soft)">
                        <span>Paid so far</span>
                        <Money amount={invoice.paidNumber} currency={invoice.currency} />
                      </div>
                    ) : null}

                    <div className="flex justify-between border-t border-(--border) pt-1.5 font-medium">
                      <span>Still to pay</span>
                      <Money amount={invoice.outstanding} currency={invoice.currency} />
                    </div>

                    <p className="mt-1 text-[12px] text-(--text-faint)">
                      {invoice.dueAt ? `Due ${date(invoice.dueAt)}. ` : ''}
                      Pay the workshop directly. Carnet does not take payments.
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
          <h2 className="font-display text-[17px] font-semibold">Settled</h2>
          <ul className="mt-3 grid gap-2">
            {settled.map((invoice) => (
              <li
                key={invoice.id}
                className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{invoice.number ?? 'Invoice'}</span>
                  <span className="font-medium tabular-nums">
                    <Money amount={invoice.totalNumber} currency={invoice.currency} />
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-(--text-soft)">
                  {invoice.org.name} · {date(invoice.issuedAt)}
                  {invoice.payments[0]
                    ? invoice.payments[0].method === 'LOYALTY'
                      ? ' · paid with points'
                      : ` · paid by ${invoice.payments[0].method.toLowerCase().replace('_', ' ')}`
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
