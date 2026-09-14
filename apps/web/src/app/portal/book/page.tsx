import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { prisma } from '@carnet/db';

import { Mark } from '@/components/marketing';
import { requireUser } from '@/lib/guard';
import { requestBooking, servicesFor, slotsFor } from '@/lib/booking';
import { regionForUser } from '@/lib/region';

export const metadata: Metadata = { title: 'Book a visit' };
export const dynamic = 'force-dynamic';

/**
 * A customer booking a visit. FR-1305, FR-1904.
 *
 * Three questions on one page: which car, what for, and when. Not a wizard.
 * A wizard is the right shape when each step changes what the next one can
 * offer, and here only the last one does, so three steps would be two extra
 * pages for the pleasure of a progress bar.
 *
 * The times offered are ones the workshop can genuinely do. A free hour at
 * half past four next to a three-hour job is not an opportunity, it is a
 * promise that gets broken on the day.
 */

async function book(formData: FormData) {
  'use server';

  const user = await requireUser();

  const customer = await prisma.customer.findFirst({
    where: { portalUserId: user.userId, isActive: true },
    include: { org: { include: { locations: { where: { isActive: true }, take: 1 } } } },
  });

  if (!customer) redirect('/portal');

  const startAt = new Date(String(formData.get('startAt') ?? ''));
  const hours = Number(formData.get('hours') ?? 1);

  const result = await requestBooking({
    orgId: customer.orgId,
    customerId: customer.id,
    ownerUserId: user.userId,
    vehicleId: String(formData.get('vehicleId') ?? ''),
    locationId: customer.org.locations[0]!.id,
    serviceItemId: String(formData.get('serviceItemId') ?? '') || null,
    description: String(formData.get('description') ?? 'Booking requested online'),
    startAt,
    hours,
    notes: String(formData.get('notes') ?? ''),
  });

  redirect(
    result.ok
      ? '/portal?booked=1'
      : `/portal/book?error=${encodeURIComponent(result.error ?? 'That did not work.')}`,
  );
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; vehicle?: string; error?: string }>;
}) {
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const params = await searchParams;

  const customer = await prisma.customer.findFirst({
    where: { portalUserId: user.userId, isActive: true },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          phone: true,
          locations: { where: { isActive: true }, take: 1, select: { id: true, name: true } },
        },
      },
    },
  });

  if (!customer) redirect('/portal');

  const location = customer.org.locations[0];
  if (!location) redirect('/portal');

  const [vehicles, services] = await Promise.all([
    prisma.vehicleOwnership.findMany({
      where: { ownerUserId: user.userId, endedAt: null },
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true, registration: true } },
      },
    }),
    servicesFor(customer.orgId),
  ]);

  const chosen = services.find((service) => service.id === params.service) ?? services[0] ?? null;
  const slots = chosen
    ? await slotsFor({ orgId: customer.orgId, locationId: location.id, hours: chosen.hours })
    : [];

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="font-display text-[15px] font-semibold">{customer.org.name}</span>
          </Link>
          <Link href="/portal" className="text-[13px] text-(--text-faint) underline">
            Back
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        <p className="eyebrow mb-2">Book a visit</p>
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">
          When suits you?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
          Every time below is one {customer.org.name} can actually do. Pick one and it is in the
          diary.
        </p>

        {params.error ? (
          <Alert tone="danger" className="mt-5">
            {params.error}
          </Alert>
        ) : null}

        {vehicles.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              title="No vehicle on your account yet"
              description={`Ask ${customer.org.name} to link your vehicle, then you can book online.`}
            />
          </Card>
        ) : (
          <>
            {/* What for. Changing this changes the times, so it reloads. */}
            <Card className="mt-6">
              <CardHeader title="What needs doing?" />
              <CardBody className="grid gap-2">
                {services.map((service) => (
                  <Link
                    key={service.id}
                    href={`/portal/book?service=${service.id}`}
                    className={`flex items-center justify-between gap-3 rounded-(--radius-md) border px-3.5 py-3 transition-colors ${
                      chosen?.id === service.id
                        ? 'border-(--brand) bg-(--brand-soft)'
                        : 'border-(--border) hover:bg-(--surface-sunk)'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{service.name}</span>
                      <span className="block text-[12px] text-(--text-faint)">
                        {`About ${service.hours} hour${service.hours === 1 ? '' : 's'}`}
                        {service.price === null ? '' : ` · from £${service.price}`}
                      </span>
                    </span>
                    {chosen?.id === service.id ? (
                      <Badge tone="brand" size="sm">
                        chosen
                      </Badge>
                    ) : null}
                  </Link>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  Not sure? Pick the closest and add a note. Nobody minds.
                </p>
              </CardBody>
            </Card>

            <form action={book} className="mt-5 grid gap-5">
              <input type="hidden" name="serviceItemId" value={chosen?.id ?? ''} />
              <input type="hidden" name="hours" value={chosen?.hours ?? 1} />
              <input type="hidden" name="description" value={chosen?.name ?? 'Visit'} />

              <Card>
                <CardHeader title="Which vehicle?" />
                <CardBody className="grid gap-3.5">
                  <Field label="Vehicle">
                    {/* Preselected when the customer arrived from one
                        vehicle's card, so somebody with three cars does not
                        have to find the one they were just looking at. */}
                    <Select name="vehicleId" required defaultValue={params.vehicle ?? undefined}>
                      {vehicles.map(({ vehicle }) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                          {vehicle.registration ? ` — ${vehicle.registration}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Anything we should know?" hint="Optional">
                    <Input
                      name="notes"
                      placeholder="Noise from the front when braking."
                      maxLength={280}
                    />
                  </Field>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="When?"
                  description={
                    slots.length > 0 ? 'Times the workshop genuinely has free' : undefined
                  }
                />
                {slots.length === 0 ? (
                  <EmptyState
                    title="Nothing free in the next fortnight"
                    description={
                      customer.org.phone
                        ? `The diary is full for this length of work. Ring ${customer.org.phone} and they will find something.`
                        : 'The diary is full for this length of work. Get in touch and they will find something.'
                    }
                  />
                ) : (
                  <CardBody className="grid gap-4">
                    {groupByDay(slots, region.locale).map(([day, daySlots]) => (
                      <fieldset key={day}>
                        <legend className="eyebrow mb-2">{day}</legend>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {daySlots.map((slot) => (
                            <label
                              key={slot.startAt.toISOString()}
                              className="relative flex cursor-pointer items-center justify-center rounded-(--radius-md) border border-(--border) bg-(--surface) px-2 py-3 text-[14px] transition-colors hover:bg-(--surface-sunk) has-[:checked]:border-(--brand) has-[:checked]:bg-(--brand-soft) has-[:checked]:font-medium has-[:checked]:text-(--brand-text)"
                            >
                              <input
                                type="radio"
                                name="startAt"
                                value={slot.startAt.toISOString()}
                                required
                                className="sr-only"
                              />
                              {slot.startAt.toLocaleTimeString(region.locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </CardBody>
                )}
              </Card>

              {slots.length > 0 ? (
                <Button type="submit" variant="primary" size="touch" block>
                  Book it
                </Button>
              ) : null}

              <p className="text-center text-[12px] leading-relaxed text-(--text-faint)">
                You will get a confirmation, and a message if the work needs a decision from you.
                Nothing else, because a message about everything is a message about nothing.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function groupByDay(slots: { startAt: Date }[], locale: string): [string, { startAt: Date }[]][] {
  const days = new Map<string, { startAt: Date }[]>();

  for (const slot of slots) {
    const key = slot.startAt.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  return [...days.entries()];
}
