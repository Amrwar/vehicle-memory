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
import { tFor } from '@/lib/i18n';
import { paymentProvider } from '@/lib/payments/provider';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Card payments') };
}
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
  const t = await tFor();
  const { checked, reconcile } = await searchParams;
  const attempts = await attemptsFor(orgId);
  const reconciliation = reconcile ? await reconcileFor(orgId) : null;
  const mayAct = can(user.role, 'payment:write');
  const provider = paymentProvider().name;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/payments">{t('Payments')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Money')}
        title={t('Card payments')}
        description={
          provider === 'stub'
            ? t('Taken online through the test provider')
            : t('Taken online through {provider}', { provider })
        }
        actions={
          <Link href="/payments/card?reconcile=1">
            <Button variant="secondary">{t('Reconcile with the provider')}</Button>
          </Link>
        }
      />

      {checked ? (
        <Alert tone={checked === 'recorded' ? 'success' : 'info'} className="mb-5">
          {checked === 'recorded'
            ? t('The provider says it was paid, and the payment is now recorded.')
            : checked === 'moved'
              ? t('The provider answered, and the attempt has moved.')
              : checked === 'unknown'
                ? t('The provider has no record of that attempt.')
                : t('The provider says nothing new.')}
        </Alert>
      ) : null}

      {reconciliation ? (
        <Card
          className={`mb-5 ${reconciliation.differences.length ? 'border-(--warning)' : 'border-(--success)'}`}
        >
          <CardHeader
            title={
              reconciliation.differences.length === 1
                ? t('1 difference between the provider and the books')
                : reconciliation.differences.length
                  ? t('{count} differences between the provider and the books', {
                      count: reconciliation.differences.length,
                    })
                  : t('The provider and the books agree')
            }
            description={t(
              reconciliation.asked === 1
                ? '1 attempt from the last ninety days asked about, {time}.'
                : '{count} attempts from the last ninety days asked about, {time}.',
              {
                count: reconciliation.asked,
                time: reconciliation.askedAt.toLocaleTimeString(region.locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            )}
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
                      {t(d.kind.toLowerCase().replace(/_/g, ' '))}
                    </Badge>
                    <span>
                      {d.invoiceNumber ?? t('Invoice')}, {d.customer}: {t(d.message)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-(--text-faint)">
                {t(
                  'Nothing has been changed. A payment the provider took and the books lack is recorded by checking that attempt below; anything else is a conversation with the provider.',
                )}
              </p>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      {attempts.length === 0 ? (
        <EmptyState
          title={t('No card payments yet')}
          description={t(
            'When a customer pays an invoice online from their portal, every try appears here: paid, declined with the reason, or cancelled.',
          )}
        />
      ) : (
        <Card>
          <CardHeader
            title={t('Every attempt')}
            description={t('Newest first. A declined card is kept with its reason.')}
          />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                <tr>
                  <th className="px-4 py-2">{t('When')}</th>
                  <th className="px-4 py-2">{t('Invoice')}</th>
                  <th className="px-4 py-2">{t('Customer')}</th>
                  <th className="px-4 py-2 text-right">{t('Amount')}</th>
                  <th className="px-4 py-2">{t('Outcome')}</th>
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
                        {a.invoice.number ?? t('Invoice')}
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
                        {t(a.status.toLowerCase())}
                      </Badge>
                      {a.failureReason ? (
                        <span className="ml-2 text-(--text-soft)">{t(a.failureReason)}</span>
                      ) : null}
                      {a.refunds.length ? (
                        <span className="ml-2 text-(--text-faint)">
                          {a.refunds.length === 1
                            ? t('1 refund sent back')
                            : t('{count} refunds sent back', { count: a.refunds.length })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {mayAct && a.status === 'PENDING' ? (
                        <form action={check}>
                          <input type="hidden" name="attemptId" value={a.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {t('Check with the provider')}
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
