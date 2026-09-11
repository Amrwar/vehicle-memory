import type { DiaryView } from '@carnet/core';
import { Button, Card, CardBody, PageHeader, StatRow, StatTile } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { DiaryBoard } from '@/components/diary-board';
import { diaryFor, DiaryError, moveBooking } from '@/lib/diary';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Diary' };
export const dynamic = 'force-dynamic';

/**
 * The diary, in the six cuts a workshop actually asks for. FR-2900.
 *
 * It had one view, a week laid out by bay, which answers "is Thursday full"
 * and cannot answer "what is Ahmed doing" or "what is happening at Bradford".
 * Those are the same rows arranged differently, and the arrangement is the
 * whole feature.
 *
 * Which lane a card sits in is also what moving it changes. In the bay and day
 * views a lane is a bay, so a drop reassigns the bay. In the technician view a
 * lane is a person. In the week, month and site views a lane is a span of time
 * or a place, and neither is something a drag should silently rewrite, so
 * cards there do not move.
 */
const VIEWS: { id: DiaryView; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'technician', label: 'By person' },
  { id: 'bay', label: 'By bay' },
  { id: 'site', label: 'By site' },
];

/** What a lane means in each view, and therefore what a drop rewrites. */
function laneKind(view: DiaryView): 'bay' | 'technician' | 'none' {
  if (view === 'bay' || view === 'day') return 'bay';
  if (view === 'technician') return 'technician';
  return 'none';
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function step(view: DiaryView, anchor: Date, direction: -1 | 1): Date {
  const moved = new Date(anchor);

  if (view === 'day') moved.setDate(moved.getDate() + direction);
  else if (view === 'month') moved.setMonth(moved.getMonth() + direction);
  else moved.setDate(moved.getDate() + direction * 7);

  return moved;
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; on?: string }>;
}) {
  const { orgId } = await requireSession('diary:read');
  const { view: rawView, on } = await searchParams;

  const view: DiaryView = VIEWS.some((entry) => entry.id === rawView)
    ? (rawView as DiaryView)
    : 'week';

  const anchor = on ? new Date(on) : new Date();
  const { range, lanes, bookings } = await diaryFor(orgId, view, anchor);

  /**
   * Carries out a drop.
   *
   * Returns the outcome rather than redirecting, because the board has already
   * moved the card and needs to know whether to leave it there. A redirect
   * would lose the reason a refusal was refused.
   */
  async function move(bookingId: string, laneId: string) {
    'use server';

    const { orgId: org, user } = await requireSession('diary:write');
    const kind = laneKind(view);

    if (kind === 'none') return { ok: false, reason: 'Cards cannot be moved in this view.' };

    const target = laneId === 'unassigned' ? null : laneId;

    try {
      const outcome = await moveBooking({
        orgId: org,
        userId: user.userId,
        bookingId,
        ...(kind === 'bay' ? { bayId: target } : { technicianId: target }),
      });

      revalidatePath('/diary');

      return { ok: true, reason: outcome.reason };
    } catch (error) {
      if (error instanceof DiaryError) return { ok: false, reason: error.message };

      throw error;
    }
  }

  const unassigned = bookings.filter((booking) => !booking.bayId).length;
  const nobody = bookings.filter((booking) => !booking.technicianId).length;
  const hours = Math.round(bookings.reduce((total, b) => total + b.estimatedHours, 0) * 10) / 10;

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Diary"
        description={range.label}
        actions={
          <>
            <Link href={`/diary?view=${view}&on=${isoDate(step(view, anchor, -1))}`}>
              <Button size="sm">Back</Button>
            </Link>
            <Link href={`/diary?view=${view}`}>
              <Button size="sm">Today</Button>
            </Link>
            <Link href={`/diary?view=${view}&on=${isoDate(step(view, anchor, 1))}`}>
              <Button size="sm">Forward</Button>
            </Link>
            <Link href="/floor">
              <Button size="sm" variant="secondary">
                The floor
              </Button>
            </Link>
            <Link href="/bookings/new">
              <Button variant="primary">Take a booking</Button>
            </Link>
          </>
        }
      />

      {/* Six links rather than a control with state. A view is a place, so it
          has an address somebody can send to a colleague. */}
      <nav aria-label="How to look at the diary" className="mb-5 flex flex-wrap gap-1.5">
        {VIEWS.map((entry) => {
          const active = entry.id === view;

          return (
            <Link
              key={entry.id}
              href={`/diary?view=${entry.id}${on ? `&on=${on}` : ''}`}
              aria-current={active ? 'page' : undefined}
              className={[
                'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                active
                  ? 'border-(--brand) bg-(--brand-soft) text-(--brand-text)'
                  : 'border-(--border) text-(--text-soft) hover:border-(--border-strong)',
              ].join(' ')}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <StatRow className="mb-5">
        <StatTile label="Booked in" value={bookings.length} note={range.label} />
        <StatTile label="Hours" value={hours} note="Across the whole span" />
        <StatTile
          label="No bay yet"
          value={unassigned}
          tone={unassigned > 0 ? 'warning' : 'neutral'}
          note="Nowhere to put the car"
        />
        <StatTile
          label="Nobody assigned"
          value={nobody}
          tone={nobody > 0 ? 'warning' : 'neutral'}
          note="The work that will not get done"
        />
      </StatRow>

      {bookings.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="font-display text-[17px] font-semibold">Nothing booked</p>
            <p className="mt-1.5 text-[13px] text-(--text-soft)">
              Nothing is in the diary for {range.label.toLowerCase()}.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/bookings/new">
                <Button variant="primary">Take a booking</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <DiaryBoard
          laneKind={laneKind(view)}
          onMove={move}
          lanes={lanes.map((lane) => ({
            id: lane.id,
            label: lane.label,
            emptyNote: lane.emptyNote,
            hours: lane.hours,
            bookings: lane.bookings.map((booking) => ({
              id: booking.id,
              title: booking.title,
              subtitle: booking.subtitle,
              registration: booking.registration,
              startAt: booking.startAt.toISOString(),
              hours: booking.estimatedHours,
              status: booking.status,
            })),
          }))}
        />
      )}
    </>
  );
}
