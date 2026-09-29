import { CERTIFICATE_WARNING_DAYS, clock, msg, PlanError } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, requireSession } from '@/lib/guard';
import { diaryTrouble } from '@/lib/equipment-diary';
import { tFor } from '@/lib/i18n';
import { acceptPlan, capacityOn, proposeDay } from '@/lib/planning';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Plan the day') };
}
export const dynamic = 'force-dynamic';

/**
 * A proposed day, with the reasoning shown. FR-3305, FR-4606.
 *
 * It proposes; a person accepts. Reading the page writes nothing. Pressing
 * the one button writes each placement into the diary as a booking against
 * its job, and the next proposal treats those as fixed.
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
  NOBODY_QUALIFIED: msg('nobody qualified'),
  NO_ROOM: msg('no room'),
  NO_BAY: msg('no bay'),
  WAITING_ON_PARTS: msg('waiting on parts'),
  TOO_LONG: msg('too long for one day'),
} as const;

async function accept(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('diary:write');
  const on = String(formData.get('on') ?? '');
  const date = on ? new Date(`${on}T09:00:00`) : new Date();
  const back = (key: string, value: string) =>
    redirect(`/plan?on=${on}&${key}=${encodeURIComponent(value)}`);

  try {
    const result = await acceptPlan({
      orgId,
      userId: user.userId,
      locationId: user.locationId,
      date,
    });
    back('accepted', result.message);
  } catch (error) {
    if (error instanceof PlanError) back('problem', error.message);
    throw error;
  }
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ on?: string; accepted?: string; problem?: string }>;
}) {
  const { orgId, user, region } = await requireSession('diary:read');
  const { on, accepted, problem } = await searchParams;
  const mayAccept = can(user.role, 'diary:write');
  const t = await tFor();

  // Nine in the morning rather than midnight, so a bare date does not land on
  // the previous day for anybody west of London.
  const date = on ? new Date(`${on}T09:00:00`) : new Date();

  // Ahead, not the day: a certificate lapsing on the eighteenth is no use to
  // somebody who only sees it by opening the eighteenth. The point of knowing
  // is knowing early.
  //
  // The horizon is `CERTIFICATE_WARNING_DAYS`, the same thirty the equipment
  // screen warns on, because the reason for that number -- booking a
  // calibration engineer takes a fortnight -- is the reason here too. A first
  // draft used fourteen days and the band rendered empty against a
  // certificate expiring in eighteen, which was this page disagreeing with
  // its own stated argument. Phase 91.
  const horizon = new Date(date.getTime() + CERTIFICATE_WARNING_DAYS * 86_400_000);

  const [plan, capacity, machines] = await Promise.all([
    proposeDay(orgId, user.locationId, date),
    capacityOn(orgId, user.locationId, date),
    diaryTrouble(orgId, { from: date, to: horizon }),
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
        eyebrow={t('Planning')}
        title={t('Plan the day')}
        description={date.toLocaleDateString(region.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        actions={
          <>
            <Link
              href={shift(-1)}
              className="inline-flex items-center rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken) pointer-coarse:min-h-10"
            >
              {t('Previous day')}
            </Link>
            <Link
              href={shift(1)}
              className="inline-flex items-center rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken) pointer-coarse:min-h-10"
            >
              {t('Next day')}
            </Link>
          </>
        }
      />

      {/* Promises the workshop cannot keep, and certificates that run out
          inside the fortnight ahead. The second is not a clash -- nothing is
          booked against those machines yet, which is exactly why it is worth
          saying while there is time to book the engineer rather than cancel
          the work. Phase 91. */}
      {machines.clashes.length > 0 ? (
        <Alert tone="danger" className="mt-4">
          <p className="font-medium">
            {t('{count} bookings need a machine that will not be free', {
              count: new Set(machines.clashes.map((one) => one.bookingId)).size,
            })}
          </p>
          <ul className="mt-1 grid gap-0.5 text-[13px]">
            {machines.clashes.map((clash) => (
              <li key={`${clash.bookingId}-${clash.equipmentId}-${clash.kind}`}>
                <span className="datum">{clash.startAt.toLocaleDateString(region.locale)}</span>{' '}
                <bdi>{clash.label}</bdi> —{' '}
                {clash.kind === 'DOUBLE_BOOKED'
                  ? t('{machine} is already promised to {other}', {
                      machine: clash.machineName,
                      other: clash.againstLabel ?? '',
                    })
                  : t('{machine} will not be usable that day', { machine: clash.machineName })}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {machines.lapsing.length > 0 ? (
        <Alert tone="warning" className="mt-4">
          <p className="font-medium">
            {t('Certificates running out in the next {count} days', {
              count: CERTIFICATE_WARNING_DAYS,
            })}
          </p>
          <ul className="mt-1 grid gap-0.5 text-[13px]">
            {machines.lapsing.map((one) => (
              <li key={one.equipmentId}>
                <Link href={`/equipment/${one.equipmentId}`} className="hover:underline">
                  <bdi>{one.name}</bdi>
                </Link>{' '}
                — <span className="datum">{one.on.toLocaleDateString(region.locale)}</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {accepted ? (
        <Alert tone="success" className="mb-5">
          {t(accepted)}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardBody className="grid gap-3 text-[13px] leading-relaxed sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <strong className="font-semibold">{t(plan.summary)}</strong>{' '}
            <span className="text-(--text-soft)">{t(capacity.summary)}</span>
            {plan.alreadyInDiary > 0 ? (
              <p className="mt-1 text-(--text-soft)">
                {plan.alreadyInDiary === 1
                  ? t(
                      '1 job is already in the diary for this day from an earlier acceptance, and is left where it was.',
                    )
                  : t(
                      '{count} jobs are already in the diary for this day from an earlier acceptance, and are left where they were.',
                      { count: plan.alreadyInDiary },
                    )}
              </p>
            ) : null}
            <p className="mt-2 text-[12px] text-(--text-faint)">
              {t(
                'This is a proposal. Reading it writes nothing, and every line says why it is where it is so you can disagree with it. Accepting writes each placement into the diary as a booking against its job, between {open} and {close}, the site’s hours.',
                { open: clock(plan.openMinute), close: clock(plan.closeMinute) },
              )}
            </p>
          </div>
          {mayAccept && plan.assignments.length > 0 ? (
            <form action={accept}>
              <input type="hidden" name="on" value={iso(date)} />
              <Button type="submit" variant="primary">
                {plan.assignments.length === 1
                  ? t('Write 1 placement to the diary')
                  : t('Write {count} placements to the diary', {
                      count: plan.assignments.length,
                    })}
              </Button>
            </form>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('The day')}
            description={t(
              'Longest first within what was promised, on the least loaded person who can do it.',
            )}
          />
          {plan.assignments.length === 0 ? (
            <EmptyState
              title={t('Nothing could be placed')}
              description={t(
                'Either nobody is in, no work is open, or everything open is waiting on something. The column beside this says which.',
              )}
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
                  <p className="text-[12px] text-(--text-faint)">{t(assignment.why)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={t('Left over')}
            description={t(
              'Each one says which of the reasons it is, so the morning meeting is short.',
            )}
          />
          {plan.unplaced.length === 0 ? (
            <CardBody className="text-[13px] text-(--text-soft)">
              {t('Everything open fits into the day.')}
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
                      {t(REASON_LABEL[entry.reason])}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-(--text-faint)">{t(entry.why)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
          <strong className="font-semibold text-(--text-soft)">{t('How it decides.')}</strong>{' '}
          {t(
            'Work promised soonest goes first; within the same promise, the longest job, because packing the long ones first is what stops a six-hour clutch being the thing left at four o’clock. Skill is a hard rule, never a preference. Among people who can do it, the least loaded, and among equals the one whose sign-off is lowest while still sufficient, so an expert stays free for whatever comes through the door at eleven.',
          )}{' '}
          <Link href="/skills" className="font-medium text-(--brand-text) hover:underline">
            {t('The skill matrix is where those sign-offs live.')}
          </Link>
        </CardBody>
      </Card>
    </>
  );
}
