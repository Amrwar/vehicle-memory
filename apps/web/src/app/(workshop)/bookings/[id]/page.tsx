import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  KeyValue,
  Mileage,
  PageHeader,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { bookingDetail, BookingError, setBookingStatus, startJobFromBooking } from '@/lib/bookings';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

/**
 * One appointment. FR-2803.
 *
 * The diary has linked here since Phase 1 and the page did not exist, so every
 * appointment in the product was a link to a page that was not there.
 *
 * Built around the telephone call it exists to support. Somebody rings about
 * their car, and whoever answers needs the time, the vehicle, a number to ring
 * back on and one press to say the customer has turned up. Everything else is
 * below that.
 */
async function move(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('diary:write');
  const bookingId = String(formData.get('bookingId') ?? '');

  try {
    await setBookingStatus({
      orgId,
      userId: user.userId,
      bookingId,
      status: String(formData.get('status') ?? 'CONFIRMED') as 'CONFIRMED',
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      redirect(`/bookings/${bookingId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  redirect(`/bookings/${bookingId}`);
}

/**
 * The car is here. One press: the booking becomes the job, with everything
 * the booking knew already on it, and the desk is looking at the job.
 * Phase 34.
 */
async function start(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const bookingId = String(formData.get('bookingId') ?? '');

  let jobId: string;
  try {
    ({ jobId } = await startJobFromBooking({ orgId, userId: user.userId, bookingId }));
  } catch (error) {
    if (error instanceof BookingError) {
      redirect(`/bookings/${bookingId}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/jobs/${jobId}?started=1`);
}

const STATES: Record<
  string,
  { label: string; tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }
> = {
  SCHEDULED: { label: 'booked in', tone: 'brand' },
  CONFIRMED: { label: 'confirmed', tone: 'success' },
  ARRIVED: { label: 'arrived', tone: 'success' },
  CONVERTED: { label: 'now a job', tone: 'neutral' },
  NO_SHOW: { label: 'did not turn up', tone: 'warning' },
  CANCELLED: { label: 'cancelled', tone: 'neutral' },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId, region } = await requireSession('diary:read');
  const { id } = await params;
  const { error } = await searchParams;

  const booking = await bookingDetail(orgId, id);
  if (!booking) notFound();

  const state = STATES[booking.status] ?? STATES.SCHEDULED!;
  const open = !['CONVERTED', 'CANCELLED'].includes(booking.status);
  const vehicle = booking.vehicle;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/diary">The diary</BackLink>
      </div>

      <PageHeader
        eyebrow="Diary"
        title={booking.description}
        description={booking.startAt.toLocaleString(region.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
        actions={
          <>
            <Badge tone={state.tone} dot>
              {state.label}
            </Badge>
            {booking.job ? (
              <Link href={`/jobs/${booking.job.id}`}>
                <Button size="sm" variant="secondary">
                  Open job {booking.job.number}
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title="Not changed">
          {error}
        </Alert>
      ) : null}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="The vehicle" />
          <CardBody className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/vehicles/${vehicle.id}`}
                className="font-display text-[17px] font-semibold hover:text-(--brand-text) hover:underline"
              >
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              </Link>
              {vehicle.registration ? <Registration value={vehicle.registration} /> : null}
            </div>
            <p className="text-[13px] text-(--text-soft)">
              Last recorded at <Mileage locale={region.locale} km={vehicle.lastOdometerKm} />
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Who to ring" />
          <CardBody>
            <KeyValue
              items={[
                {
                  label: 'Customer',
                  value: (
                    <Link
                      href={`/customers/${booking.customer.id}`}
                      className="hover:text-(--brand-text) hover:underline"
                    >
                      {booking.customer.displayName}
                    </Link>
                  ),
                },
                {
                  label: 'Mobile',
                  value: booking.customer.mobile ? (
                    <a href={`tel:${booking.customer.mobile}`} className="hover:underline">
                      {booking.customer.mobile}
                    </a>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: 'Phone',
                  value: booking.customer.phone ? (
                    <a href={`tel:${booking.customer.phone}`} className="hover:underline">
                      {booking.customer.phone}
                    </a>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Email', value: booking.customer.email ?? '—' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="The slot" />
          <CardBody>
            <KeyValue
              items={[
                { label: 'Site', value: booking.location.name },
                { label: 'Bay', value: booking.bay?.name ?? 'Not assigned yet' },
                { label: 'Technician', value: booking.technician?.name ?? 'Not assigned yet' },
                { label: 'Allowed', value: `${Number(booking.estimatedHours)} hours` },
                { label: 'Booked by', value: booking.source.toLowerCase().replace('_', ' ') },
                {
                  label: 'Reminder',
                  value: booking.reminderSentAt
                    ? booking.reminderSentAt.toLocaleDateString(region.locale)
                    : 'Not sent',
                },
              ]}
            />

            {booking.notes ? (
              <p className="mt-4 border-t border-(--border) pt-3 text-[13px] leading-relaxed text-(--text-soft)">
                {booking.notes}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What happened"
            description="One press each, because this is done while somebody is on the telephone."
          />
          <CardBody className="grid gap-3">
            {booking.status === 'CONVERTED' ? (
              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                This booking became a job, so it is the job that changes from here.
              </p>
            ) : booking.status === 'CANCELLED' ? (
              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                Cancelled{booking.cancelReason ? `: ${booking.cancelReason}` : '.'}
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <form action={move}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="status" value="CONFIRMED" />
                    <Button
                      type="submit"
                      size="touch"
                      block
                      variant="secondary"
                      disabled={booking.status === 'CONFIRMED'}
                    >
                      They confirmed
                    </Button>
                  </form>
                  {/* One press. The booking already knows the customer, the
                      car, the work and who is doing it; the job is opened
                      with all of it and this screen is left behind. */}
                  <form action={start}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <Button type="submit" size="touch" block variant="primary">
                      Car is here, start the job
                    </Button>
                  </form>
                  <form action={move}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="status" value="NO_SHOW" />
                    <Button type="submit" size="touch" block variant="secondary">
                      Did not turn up
                    </Button>
                  </form>
                </div>

                <form
                  action={move}
                  className="flex flex-wrap items-end gap-2 border-t border-(--border) pt-3"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="status" value="CANCELLED" />
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[12px] font-medium text-(--text-soft)">
                      Cancelling? Say why
                    </span>
                    <Input name="reason" placeholder="Goes on the record" />
                  </label>
                  <Button type="submit" variant="ghost">
                    Cancel it
                  </Button>
                </form>
              </>
            )}

            {open && !booking.job ? (
              <p className="text-[12px] text-(--text-faint)">
                A job is created when the car is received, so nothing is charged for an appointment
                that never arrives.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
