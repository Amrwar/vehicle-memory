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
import type { Metadata } from 'next';
import Link from 'next/link';

import { remindersDue } from '@/lib/booking';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Reminders' };
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
  const { orgId } = await requireSession('customer:read');
  const { days } = await searchParams;
  const window = Math.max(1, Number(days ?? 30) || 30);

  const due = await remindersDue(orgId, window);

  const overdue = due.filter((entry) => entry.overdue);
  const unreachable = due.filter((entry) => entry.unreachable);
  const sent = due.filter((entry) => entry.alreadySent);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Service reminders"
        description={`Due in the next ${window} days`}
        actions={
          <>
            {[14, 30, 90].map((option) => (
              <Link key={option} href={`/reminders?days=${option}`}>
                <Button size="sm" variant={option === window ? 'primary' : 'secondary'}>
                  {option}d
                </Button>
              </Link>
            ))}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile label="Coming up" value={due.length} note={`Within ${window} days`} />
        <StatTile
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? 'warning' : 'neutral'}
          note="Past the interval already"
        />
        <StatTile
          label="Nobody to tell"
          value={unreachable.length}
          tone={unreachable.length > 0 ? 'danger' : 'neutral'}
          note="No address on the owner"
        />
        <StatTile label="Already sent" value={sent.length} note="Reminder has gone out" />
      </StatRow>

      {unreachable.length > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {unreachable.length} vehicle{unreachable.length === 1 ? '' : 's'} due with no way to
              tell the owner.
            </strong>{' '}
            The reminder will not go out, and nothing will report a failure, because there was
            nothing to fail. These are the ones that quietly become somebody else&rsquo;s customer.
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Due"
          description="Soonest first. This is what the reminder worker will act on."
        />
        {due.length === 0 ? (
          <EmptyState
            title="Nothing due"
            description={`No vehicle reaches its service interval in the next ${window} days.`}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th>Owner</Th>
                  <Th>Service</Th>
                  <Th>Due</Th>
                  <Th numeric>At</Th>
                  <Th>State</Th>
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
                      {entry.owner?.name ?? entry.ownerName ?? 'Unknown'}
                      {entry.unreachable ? (
                        <span className="block text-[11px] text-(--danger)">no address</span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">{entry.name}</Td>
                    <Td>
                      {entry.dueAt ? (
                        <span className={entry.overdue ? 'font-medium text-(--warning)' : ''}>
                          {entry.dueAt.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-(--text-faint)">By mileage</span>
                      )}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.dueKm ? <Mileage km={entry.dueKm} /> : '—'}
                    </Td>
                    <Td>
                      {entry.alreadySent ? (
                        <Badge tone="neutral" size="sm">
                          sent
                        </Badge>
                      ) : entry.unreachable ? (
                        <Badge tone="danger" size="sm">
                          cannot send
                        </Badge>
                      ) : entry.overdue ? (
                        <Badge tone="warning" size="sm">
                          overdue
                        </Badge>
                      ) : (
                        <Badge tone="info" size="sm">
                          queued
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
        <CardHeader title="How this works" />
        <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
          <p>
            A service interval is set by time, by mileage, or by both. Where mileage is involved the
            due date is projected from how far the vehicle has actually been travelling, not from an
            average, so a van that does 30,000 a year is not reminded on the same schedule as a car
            that does 4,000.
          </p>
          <p>
            The worker sends each reminder once and records when. Nothing on this page sends
            anything: it is here so somebody can tell the difference between a quiet month and a
            worker that has stopped.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
