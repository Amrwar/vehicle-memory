import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from '@carnet/ui';
import { msg } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { markAllRead, notificationsFor } from '@/lib/search';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Notifications') };
}
export const dynamic = 'force-dynamic';

/**
 * What happened that this person may need to act on. Phase 39.
 *
 * A customer approved a quote, somebody wrote in, a booking came in online,
 * a card payment arrived, a technician needs a part. Each is sent to the
 * people whose role would act on it, never to whoever caused it, and each
 * opens the record it is about. Unread first.
 */
async function readAll() {
  'use server';

  const { orgId, user } = await requireSession();
  await markAllRead(orgId, user.userId);
  redirect('/notifications');
}

const KIND = {
  ESTIMATE_DECIDED: msg('quote'),
  MESSAGE_RECEIVED: msg('message'),
  BOOKING_REQUESTED: msg('booking'),
  PAYMENT_RECEIVED: msg('payment'),
  PART_REQUESTED: msg('part'),
} as const;

export default async function NotificationsPage() {
  const { orgId, user, region } = await requireSession();
  const rows = await notificationsFor(orgId, user.userId);
  const unread = rows.filter((row) => !row.readAt).length;
  const t = await tFor();

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Notifications')}
        description={t('What happened that you may need to act on, each opening what it is about')}
        actions={
          unread > 0 ? (
            <form action={readAll}>
              <Button type="submit" variant="secondary">
                {t('Mark all read')}
              </Button>
            </form>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <CardHeader title={unread > 0 ? t('{count} unread', { count: unread }) : t('All read')} />
        {rows.length === 0 ? (
          <EmptyState
            title={t('Nothing to tell you yet')}
            description={t(
              'Approvals, messages from customers, online bookings, card payments and part requests appear here.',
            )}
          />
        ) : (
          <ul className="divide-y divide-(--border)">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/notifications/${row.id}`}
                  className={[
                    'flex items-start justify-between gap-3 px-4 py-3 hover:bg-(--surface-sunk)',
                    row.readAt ? '' : 'bg-(--brand-soft)/40',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className={`block text-[14px] ${row.readAt ? '' : 'font-semibold'}`}>
                      {t(row.title)}
                    </span>
                    {row.body ? (
                      <span className="block truncate text-[12px] text-(--text-soft)">
                        {row.body}
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-(--text-faint)">
                      {row.createdAt.toLocaleString(region.locale, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <Badge tone={row.readAt ? 'neutral' : 'brand'} size="sm">
                    {t(KIND[row.kind as keyof typeof KIND] ?? row.kind.toLowerCase())}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
