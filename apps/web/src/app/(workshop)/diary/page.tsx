import { utilisationFor } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Registration,
  UtilisationBar,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Diary' };
export const dynamic = 'force-dynamic';

const OPENING_HOUR = 8;
const CLOSING_HOUR = 18;

/**
 * The workshop diary, week view.
 *
 * Bookings are laid out against the hours of the day so a service advisor can
 * answer "when can you take it?" by looking rather than by clicking. Capacity
 * is shown per day, because an empty Tuesday is a problem the diary should
 * make as visible as an overbooked Monday.
 */
export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { db, user } = await requireSession('diary:read');
  const { week } = await searchParams;

  const anchor = week ? new Date(week) : new Date();
  const start = startOfWeek(anchor);
  const end = new Date(start.getTime() + 7 * 86_400_000);

  const [bookings, location] = await Promise.all([
    db.booking.findMany({
      where: { startAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      orderBy: { startAt: 'asc' },
      include: {
        customer: { select: { displayName: true } },
        vehicle: { select: { id: true, make: true, model: true, registration: true } },
        technician: { select: { name: true } },
        bay: { select: { id: true, name: true } },
        job: { select: { id: true, status: true } },
      },
    }),
    db.location.findFirst({
      where: user.locationId ? { id: user.locationId } : {},
      select: { name: true, dailyCapacityHours: true },
    }),
  ]);

  const capacity = Number(location?.dailyCapacityHours ?? 40);
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(start.getTime() + index * 86_400_000),
  );
  const hours = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) => OPENING_HOUR + i);

  const scheduled = bookings.map((booking) => ({
    id: booking.id,
    startAt: booking.startAt,
    endAt: booking.endAt,
    bayId: booking.bayId,
    technicianId: booking.technicianId,
    estimatedHours: Number(booking.estimatedHours),
  }));

  return (
    <>
      <PageHeader
        eyebrow={location?.name ?? 'Workshop'}
        title="Diary"
        description={`${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(
          end.getTime() - 86_400_000,
        ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        actions={
          <>
            <Link href={`/diary?week=${isoDate(shiftWeek(start, -1))}`}>
              <Button size="sm">Previous</Button>
            </Link>
            <Link href="/diary">
              <Button size="sm">This week</Button>
            </Link>
            <Link href={`/diary?week=${isoDate(shiftWeek(start, 1))}`}>
              <Button size="sm">Next</Button>
            </Link>
            <Link href="/bookings/new">
              <Button variant="primary">New booking</Button>
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Week"
          description={`${bookings.length} booking${bookings.length === 1 ? '' : 's'} scheduled`}
        />

        <div className="scroll-x">
          <div className="min-w-[64rem]">
            {/* Day headers with capacity */}
            <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-(--border) bg-(--surface-sunk)">
              <div />
              {days.map((day) => {
                const utilisation = utilisationFor(day, scheduled, capacity);
                const today = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={`border-l border-(--border) px-2 py-2 ${today ? 'bg-(--brand-soft)' : ''}`}
                  >
                    <p className="text-[12px] font-semibold">
                      {day.toLocaleDateString('en-GB', { weekday: 'short' })}{' '}
                      <span className="datum font-normal text-(--text-faint)">
                        {day.getDate()}/{String(day.getMonth() + 1).padStart(2, '0')}
                      </span>
                    </p>
                    <UtilisationBar
                      className="mt-1.5"
                      bookedHours={utilisation.bookedHours}
                      capacityHours={capacity}
                      state={utilisation.state}
                    />
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-(--border) last:border-b-0"
              >
                <div className="datum px-2 py-2 text-[11px] text-(--text-faint)">
                  {String(hour).padStart(2, '0')}:00
                </div>

                {days.map((day) => {
                  const slot = bookings.filter(
                    (booking) =>
                      isSameDay(booking.startAt, day) && booking.startAt.getHours() === hour,
                  );

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="min-h-[3.25rem] border-l border-(--border) p-1"
                    >
                      {slot.map((booking) => (
                        <Link
                          key={booking.id}
                          href={booking.job ? `/jobs/${booking.job.id}` : `/bookings/${booking.id}`}
                          className="mb-1 block rounded-(--radius-sm) border-l-[3px] border-(--brand) bg-(--brand-soft) px-2 py-1.5 transition-colors hover:bg-(--surface-sunk)"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12px] font-medium">
                              {booking.vehicle.make} {booking.vehicle.model}
                            </span>
                            {booking.vehicle.registration ? (
                              <Registration
                                value={booking.vehicle.registration}
                                className="shrink-0 text-[10px]"
                              />
                            ) : null}
                          </div>
                          <p className="truncate text-[11px] text-(--text-soft)">
                            {booking.description}
                          </p>
                          <p className="truncate text-[11px] text-(--text-faint)">
                            {booking.technician?.name ?? 'Unassigned'}
                            {booking.bay ? ` · ${booking.bay.name}` : ''}
                          </p>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-(--text-faint)">
        <span className="eyebrow">Capacity</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-(--info)" /> Light
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-(--success)" /> Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-(--warning)" /> Full
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-(--danger)" /> Over
        </span>
        <Badge tone="neutral" size="sm">
          {capacity}h per day
        </Badge>
      </div>
    </>
  );
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  // Monday start: workshops do not think of Sunday as the first working day.
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function shiftWeek(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * 86_400_000);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
