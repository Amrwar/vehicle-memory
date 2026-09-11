import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@carnet/ui';
import { clock } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { capacityOn, proposeDay } from '@/lib/planning';

export const metadata: Metadata = { title: 'Plan the day' };
export const dynamic = 'force-dynamic';

/**
 * A proposed day, with the reasoning shown. FR-3305.
 *
 * It proposes; a person accepts. Nothing on this page writes anything, which
 * is the same rule the arrival suggestions and the mileage findings follow
 * and the reason it can be useful before it is perfect.
 *
 * The left-over column is not a failure of the plan. It is the most useful
 * thing here: six jobs nobody can start, each saying which of the four
 * reasons it is, is a morning meeting somebody can hold in ninety seconds.
 */
const REASON_TONE = {
  NOBODY_QUALIFIED: 'danger',
  NO_ROOM: 'warning',
  NO_BAY: 'warning',
  WAITING_ON_PARTS: 'brand',
  TOO_LONG: 'neutral',
} as const;

const REASON_LABEL = {
  NOBODY_QUALIFIED: 'nobody qualified',
  NO_ROOM: 'no room',
  NO_BAY: 'no bay',
  WAITING_ON_PARTS: 'waiting on parts',
  TOO_LONG: 'too long for one day',
} as const;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ on?: string }>;
}) {
  const { orgId, user } = await requireSession('diary:read');
  const { on } = await searchParams;

  // Nine in the morning rather than midnight, so a bare date does not land on
  // the previous day for anybody west of London.
  const date = on ? new Date(`${on}T09:00:00`) : new Date();

  const [plan, capacity] = await Promise.all([
    proposeDay(orgId, user.locationId, date),
    capacityOn(orgId, user.locationId, date),
  ]);

  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const shift = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return `/plan?on=${iso(next)}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Plan the day"
        description={date.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        actions={
          <>
            <Link
              href={shift(-1)}
              className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken)"
            >
              Previous day
            </Link>
            <Link
              href={shift(1)}
              className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken)"
            >
              Next day
            </Link>
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed">
          <strong className="font-semibold">{plan.summary}</strong>{' '}
          <span className="text-(--text-soft)">{capacity.summary}</span>
          <p className="mt-2 text-[12px] text-(--text-faint)">
            This is a proposal. Nothing has been written to the diary, nobody has been told, and
            every line says why it is where it is so you can disagree with it.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="The day"
            description="Longest first within what was promised, on the least loaded person who can do it."
          />
          {plan.assignments.length === 0 ? (
            <EmptyState
              title="Nothing could be placed"
              description="Either nobody is in, no work is open, or everything open is waiting on something. The column beside this says which."
            />
          ) : (
            <ul className="divide-y divide-(--border)">
              {plan.assignments.map((assignment) => (
                <li key={assignment.itemId} className="grid gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="datum text-[13px] font-semibold">
                      {clock(assignment.startMinute)}
                    </span>
                    <Link
                      href={`/jobs/${assignment.itemId}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-(--brand-text) hover:underline"
                    >
                      {assignment.label}
                    </Link>
                    <span className="text-[12px] text-(--text-soft)">
                      {assignment.technicianName}
                    </span>
                    <Badge tone="neutral" size="sm">
                      {assignment.bayName}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-(--text-faint)">{assignment.why}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Left over"
            description="Each one says which of the reasons it is, so the morning meeting is short."
          />
          {plan.unplaced.length === 0 ? (
            <CardBody className="text-[13px] text-(--text-soft)">
              Everything open fits into the day.
            </CardBody>
          ) : (
            <ul className="divide-y divide-(--border)">
              {plan.unplaced.map((entry) => (
                <li key={entry.itemId} className="grid gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/jobs/${entry.itemId}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-(--brand-text) hover:underline"
                    >
                      {entry.label}
                    </Link>
                    <Badge tone={REASON_TONE[entry.reason]} size="sm">
                      {REASON_LABEL[entry.reason]}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-(--text-faint)">{entry.why}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
          <strong className="font-semibold text-(--text-soft)">How it decides.</strong> Work
          promised soonest goes first; within the same promise, the longest job, because packing the
          long ones first is what stops a six-hour clutch being the thing left at four
          o&rsquo;clock. Skill is a hard rule, never a preference. Among people who can do it, the
          least loaded, and among equals the one whose sign-off is lowest while still sufficient, so
          an expert stays free for whatever comes through the door at eleven.{' '}
          <Link href="/skills" className="font-medium text-(--brand-text) hover:underline">
            The skill matrix
          </Link>{' '}
          is where those sign-offs live.
        </CardBody>
      </Card>
    </>
  );
}
