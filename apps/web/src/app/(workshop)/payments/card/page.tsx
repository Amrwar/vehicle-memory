import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { attemptsFor, checkAttempt, reconcileFor } from '@/lib/card-payments';
import { can, requireSession } from '@/lib/guard';
import { paymentProvider } from '@/lib/payments/provider';

export const metadata: Metadata = { title: 'Card payments' };
export const dynamic = 'force-dynamic';

/**
 * Every card payment tried through the provider, and the provider's
 * record against ours. Phase 32.
 *
 * A failed payment is a row with the provider's reason, not an absence.
 * "Check with the provider" asks about one attempt; "Reconcile" asks about
 * all of the last ninety days and names each difference rather than
 * fixing anything, because the ledger was posted from our side and the
 * provider may be the one that is wrong.
 */
const TONE = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
} as const;

async function check(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('payment:write');
  const attemptId = String(formData.get('attemptId') ?? '');
  const outcome = await checkAttempt({ orgId, attemptId });
  redirect(`/payments/card?checked=${outcome.outcome}`);
}

export default async function CardPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ checked?: string; reconcile?: string }>;
}) {
  const { orgId, user, region } = await requireSession('payment:read');
  const { checked, reconcile } = await searchParams;
  const attempts = await attemptsFor(orgId);
  const reconciliation = reconcile ? await reconcileFor(orgId) : null;
  const mayAct = can(user.role, 'payment:write');
  const provider = paymentProvider().name;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/payments">Payments</BackLink>
      </div>

      <PageHeader
        eyebrow="Money"
        title="Card payments"
        description={`Taken online through ${provider === 'stub' ? 'the test provider' : provider}`}
        actions={
          <Link href="/payments/card?reconcile=1">
            <Button variant="secondary">Reconcile with the provider</Button>
          </Link>
        }
      />

      {checked ? (
        <Alert tone={checked === 'recorded' ? 'success' : 'info'} className="mb-5">
          {checked === 'recorded'
            ? 'The provider says it was paid, and the payment is now recorded.'
            : checked === 'moved'
              ? 'The provider answered, and the attempt has moved.'
              : checked === 'unknown'
                ? 'The provider has no record of that attempt.'
                : 'The provider says nothing new.'}
        </Alert>
      ) : null}

      {reconciliation ? (
        <Card
          className={`mb-5 ${reconciliation.differences.length ? 'border-(--warning)' : 'border-(--success)'}`}
        >
          <CardHeader
            title={
              reconciliation.differences.length
                ? `${reconciliation.differences.length} difference${reconciliation.differences.length === 1 ? '' : 's'} between the provider and the books`
                : 'The provider and the books agree'
            }
            description={`${reconciliation.asked} attempt${reconciliation.asked === 1 ? '' : 's'} from the last ninety days asked about, ${reconciliation.askedAt.toLocaleTimeString(region.locale, { hour: '2-digit', minute: '2-digit' })}.`}
          />
          {reconciliation.differences.length ? (
            <CardBody>
              <ul className="grid gap-2 text-[13px]">
                {reconciliation.differences.map((d) => (
                  <li
                    key={`${d.attemptId}-${d.kind}`}
                    className="flex flex-wrap items-baseline gap-2"
                  >
                    <Badge tone="warning" size="sm">
                      {d.kind.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                    <span>
                      {d.invoiceNumber ?? 'Invoice'}, {d.customer}: {d.message}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-(--text-faint)">
                Nothing has been changed. A payment the provider took and the books lack is recorded
                by checking that attempt below; anything else is a conversation with the provider.
              </p>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      {attempts.length === 0 ? (
        <EmptyState
          title="No card payments yet"
          description="When a customer pays an invoice online from their portal, every try appears here: paid, declined with the reason, or cancelled."
        />
      ) : (
        <Card>
          <CardHeader
            title="Every attempt"
            description="Newest first. A declined card is kept with its reason."
          />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Outcome</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-(--border)">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {a.createdAt.toLocaleString(region.locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/invoices/${a.invoice.id}`} className="underline">
                        {a.invoice.number ?? 'Invoice'}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/customers/${a.customer.id}`} className="underline">
                        {a.customer.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Money
                        amount={Number(a.amount)}
                        currency={a.currency}
                        locale={region.locale}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={TONE[a.status]} size="sm" dot>
                        {a.status.toLowerCase()}
                      </Badge>
                      {a.failureReason ? (
                        <span className="ml-2 text-(--text-soft)">{a.failureReason}</span>
                      ) : null}
                      {a.refunds.length ? (
                        <span className="ml-2 text-(--text-faint)">
                          {a.refunds.length} refund{a.refunds.length === 1 ? '' : 's'} sent back
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {mayAct && a.status === 'PENDING' ? (
                        <form action={check}>
                          <input type="hidden" name="attemptId" value={a.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Check with the provider
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </>
  );
}
