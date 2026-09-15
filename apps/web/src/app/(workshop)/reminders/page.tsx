import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Mileage,
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
import { documentKindLabel } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { remindersDue } from '@/lib/booking';
import { paperworkDue } from '@/lib/documents';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

import { expiryLabel } from '../vehicles/statements';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Reminders') };
}
export const dynamic = 'force-dynamic';

/**
 * What the reminder engine is about to do. FR-1504, FR-1905.
 *
 * The engine has been running since Phase 1 and nobody could see it. A machine
 * that sends messages on a schedule, with no screen showing what it is about
 * to send, is indistinguishable from one that stopped three weeks ago. The
 * first anybody notices is a quiet month.
 *
 * So this page is a window on the machine rather than a control panel. The
 * things worth acting on are the exceptions: a vehicle overdue, and a vehicle
 * whose owner has no address to send to.
 */
export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { orgId, region } = await requireSession('customer:read');
  const { days } = await searchParams;
  const window = Math.max(1, Number(days ?? 30) || 30);
  const t = await tFor();

  const [due, paperwork] = await Promise.all([
    remindersDue(orgId, window),
    paperworkDue(orgId, 45),
  ]);

  const overdue = due.filter((entry) => entry.overdue);
  const unreachable = due.filter((entry) => entry.unreachable);
  const sent = due.filter((entry) => entry.alreadySent);

  return (
    <>
      <PageHeader
        eyebrow={t('Customers')}
        title={t('Service reminders')}
        description={t('Due in the next {days} days', { days: window })}
        actions={
          <>
            {[14, 30, 90].map((option) => (
              <Link key={option} href={`/reminders?days=${option}`}>
                <Button size="sm" variant={option === window ? 'primary' : 'secondary'}>
                  {t('{days}d', { days: option })}
                </Button>
              </Link>
            ))}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Coming up')}
          value={due.length}
          note={t('Within {days} days', { days: window })}
        />
        <StatTile
          label={t('Overdue')}
          value={overdue.length}
          tone={overdue.length > 0 ? 'warning' : 'neutral'}
          note={t('Past the interval already')}
        />
        <StatTile
          label={t('Nobody to tell')}
          value={unreachable.length}
          tone={unreachable.length > 0 ? 'danger' : 'neutral'}
          note={t('No address on the owner')}
        />
        <StatTile label={t('Already sent')} value={sent.length} note={t('Reminder has gone out')} />
      </StatRow>

      {unreachable.length > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {unreachable.length === 1
                ? t('1 vehicle due with no way to tell the owner.')
                : t('{count} vehicles due with no way to tell the owner.', {
                    count: unreachable.length,
                  })}
            </strong>{' '}
            {t(
              'The reminder will not go out, and nothing will report a failure, because there was nothing to fail. These are the ones that quietly become somebody else’s customer.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Due')}
          description={t('Soonest first. This is what the reminder worker will act on.')}
        />
        {due.length === 0 ? (
          <EmptyState
            title={t('Nothing due')}
            description={t('No vehicle reaches its service interval in the next {days} days.', {
              days: window,
            })}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Owner')}</Th>
                  <Th>{t('Service')}</Th>
                  <Th>{t('Due')}</Th>
                  <Th numeric>{t('At')}</Th>
                  <Th>{t('State')}</Th>
                </tr>
              </thead>
              <tbody>
                {due.map((entry) => (
                  <Tr key={entry.id}>
                    <Td>
                      <Link
                        href={`/vehicles/${entry.vehicle.id}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {entry.vehicle.make} {entry.vehicle.model}
                      </Link>
                      {entry.vehicle.registration ? (
                        <span className="ml-2 inline-block align-middle">
                          <Registration value={entry.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {entry.owner?.name ?? entry.ownerName ?? t('Unknown')}
                      {entry.unreachable ? (
                        <span className="block text-[11px] text-(--danger)">{t('no address')}</span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">{entry.name}</Td>
                    <Td>
                      {entry.dueAt ? (
                        <span className={entry.overdue ? 'font-medium text-(--warning)' : ''}>
                          {entry.dueAt.toLocaleDateString(region.locale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-(--text-faint)">{t('By mileage')}</span>
                      )}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.dueKm ? (
                        <Mileage t={t} locale={region.locale} km={entry.dueKm} />
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      {entry.alreadySent ? (
                        <Badge tone="neutral" size="sm">
                          {t('sent')}
                        </Badge>
                      ) : entry.unreachable ? (
                        <Badge tone="danger" size="sm">
                          {t('cannot send')}
                        </Badge>
                      ) : entry.overdue ? (
                        <Badge tone="warning" size="sm">
                          {t('overdue')}
                        </Badge>
                      ) : (
                        <Badge tone="info" size="sm">
                          {t('queued')}
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader
          title={t('Paperwork running out')}
          description={t(
            'The latest MOT or insurance on file for a vehicle this workshop looks after, within forty-five days or already gone',
          )}
        />
        {paperwork.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            {t(
              'Nothing on file is running out. Paperwork is added on the vehicle’s page, or by the owner from their portal.',
            )}
          </CardBody>
        ) : (
          <ul className="divide-y divide-(--border)">
            {paperwork.map((row) => (
              <li
                key={row.documentId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
              >
                <Badge tone={row.state === 'EXPIRED' ? 'danger' : 'warning'} size="sm">
                  {t(documentKindLabel(row.kind))}
                </Badge>
                <Link href={`/vehicles/${row.vehicleId}`} className="font-medium hover:underline">
                  {row.vehicle}
                  {row.registration ? ` · ${row.registration}` : ''}
                </Link>
                {row.customer ? (
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="text-(--text-soft) hover:underline"
                  >
                    {row.customer.displayName}
                  </Link>
                ) : null}
                <span className="ml-auto text-[12px] text-(--text-soft)">
                  {expiryLabel(t, row.expiresAt, region.locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title={t('How this works')} />
        <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
          <p>
            {t(
              'A service interval is set by time, by mileage, or by both. Where mileage is involved the due date is projected from how far the vehicle has actually been travelling, not from an average, so a van that does 30,000 a year is not reminded on the same schedule as a car that does 4,000.',
            )}
          </p>
          <p>
            {t(
              'The worker sends each reminder once and records when. Nothing on this page sends anything: it is here so somebody can tell the difference between a quiet month and a worker that has stopped.',
            )}
          </p>
        </CardBody>
      </Card>
    </>
  );
}
