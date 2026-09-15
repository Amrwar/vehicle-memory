import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Estimates') };
}
export const dynamic = 'force-dynamic';

/**
 * Estimates, as a list. FR-2004.
 *
 * They have always been built and approved on the job, which is where the work
 * is. What was missing is the view a workshop needs on a Thursday afternoon:
 * which ones nobody has answered. An estimate sitting unanswered is a bay that
 * will be empty next week, and it is invisible from the job screen because
 * nobody opens a job that is not moving.
 *
 * So this page is ordered by how long somebody has been waiting, not by value.
 */
export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { db, region } = await requireSession('estimate:read');
  const t = await tFor();
  const { status } = await searchParams;

  const estimates = await db.estimate.findMany({
    where: status && status !== 'all' ? { status: status as never } : {},
    include: {
      job: {
        select: {
          id: true,
          number: true,
          customer: { select: { id: true, displayName: true } },
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
    },
    orderBy: [{ sentAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  const now = Date.now();

  const waiting = estimates.filter((estimate) => estimate.status === 'SENT');
  const stale = waiting.filter(
    (estimate) => estimate.sentAt && now - estimate.sentAt.getTime() > 3 * 86_400_000,
  );

  const declined = estimates.filter((estimate) => estimate.status === 'DECLINED');
  const waitingValue = waiting.reduce(
    (total, estimate) => total + Math.round(Number(estimate.total) * 100),
    0,
  );

  const filters = [
    { key: 'all', label: t('All') },
    { key: 'DRAFT', label: t('Draft') },
    { key: 'SENT', label: t('Waiting') },
    { key: 'APPROVED', label: t('Approved') },
    { key: 'DECLINED', label: t('Declined') },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t('Estimates')}
        title={t('Estimates')}
        description={t('Longest wait first')}
        actions={filters.map((filter) => (
          <Link key={filter.key} href={`/estimates?status=${filter.key}`}>
            <Button size="sm" variant={(status ?? 'all') === filter.key ? 'primary' : 'secondary'}>
              {filter.label}
            </Button>
          </Link>
        ))}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Waiting on a customer')}
          value={waiting.length}
          tone={waiting.length > 0 ? 'warning' : 'neutral'}
          note={t('Sent, not yet answered')}
        />
        <StatTile
          label={t('Value waiting')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={waitingValue / 100} />
          }
          note={t('Work that has not been said yes to')}
        />
        <StatTile
          label={t('Waiting over three days')}
          value={stale.length}
          tone={stale.length > 0 ? 'danger' : 'neutral'}
          note={t('Worth a phone call')}
        />
        <StatTile label={t('Declined')} value={declined.length} note={t('In this list')} />
      </StatRow>

      {stale.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {stale.length === 1
                ? t('1 estimate has been waiting more than three days.')
                : t('{count} estimates have been waiting more than three days.', {
                    count: stale.length,
                  })}
            </strong>{' '}
            {t(
              'An unanswered estimate is a bay that will be empty next week. It is invisible from the job screen, because nobody opens a job that is not moving.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Estimates')}
          description={t('{count} shown', { count: estimates.length })}
        />
        {estimates.length === 0 ? (
          <EmptyState
            title={t('Nothing here')}
            description={t(
              'Estimates are raised from a job, usually straight after an inspection.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Job')}</Th>
                  <Th>{t('Customer')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Status')}</Th>
                  <Th numeric>{t('Waiting')}</Th>
                  <Th numeric>{t('Total')}</Th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate) => {
                  const days = estimate.sentAt
                    ? Math.floor((now - estimate.sentAt.getTime()) / 86_400_000)
                    : null;

                  const overdue = estimate.status === 'SENT' && days !== null && days > 3;

                  return (
                    <Tr key={estimate.id}>
                      <Td>
                        <Link
                          href={`/jobs/${estimate.job?.id ?? ''}`}
                          className="datum font-medium hover:text-(--brand-text) hover:underline"
                        >
                          {estimate.job?.number ?? '—'}
                        </Link>
                        <span className="ml-2 text-[11px] text-(--text-faint)">
                          v{estimate.version}
                        </span>
                      </Td>
                      <Td className="text-(--text-soft)">
                        {estimate.job?.customer.displayName ?? '—'}
                      </Td>
                      <Td>
                        <span className="text-(--text-soft)">
                          {estimate.job?.vehicle.make} {estimate.job?.vehicle.model}
                        </span>
                        {estimate.job?.vehicle.registration ? (
                          <span className="ml-2 inline-block align-middle">
                            <Registration value={estimate.job.vehicle.registration} />
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge tone={toneForEstimate(estimate.status)} size="sm">
                          {t(estimate.status.toLowerCase().replace('_', ' '))}
                        </Badge>
                      </Td>
                      <Td numeric>
                        {days === null ? (
                          <span className="text-(--text-faint)">—</span>
                        ) : (
                          <span className={overdue ? 'font-medium text-(--warning)' : ''}>
                            {t('{days}d', { days })}
                          </span>
                        )}
                      </Td>
                      <Td numeric className="font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(estimate.total)}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

/**
 * Estimate statuses have their own tones.
 *
 * `toneFor` in the domain covers job statuses, and an estimate is not a job:
 * "sent" is neutral for a job and is the whole point of this page.
 */
function toneForEstimate(status: string): 'neutral' | 'warning' | 'success' | 'danger' | 'info' {
  switch (status) {
    case 'SENT':
      return 'warning';
    case 'APPROVED':
      return 'success';
    case 'DECLINED':
      return 'danger';
    case 'SUPERSEDED':
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'info';
  }
}
