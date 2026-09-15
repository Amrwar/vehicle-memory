import { formatMinor } from '@carnet/core';
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

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { requestBooking, servicesFor, slotsFor } from '@/lib/booking';
import { regionForUser } from '@/lib/region';
import { bookableWorkshop, customerAt, workshopDirectory, workshopsUsedBy } from '@/lib/workshops';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Book a visit') };
}
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
  const orgId = String(formData.get('orgId') ?? '');
  const org = await bookableWorkshop(orgId);
  const location = org?.locations[0];
  if (!org || !location) redirect('/portal/workshops');

  // Booking at a workshop for the first time is how somebody becomes its
  // customer. The record is made here, with the name and contact the
  // account already has, so the workshop sees a person in its diary.
  const customer = await customerAt({ userId: user.userId, orgId: org.id });

  const startAt = new Date(String(formData.get('startAt') ?? ''));
  const hours = Number(formData.get('hours') ?? 1);

  const result = await requestBooking({
    orgId: org.id,
    customerId: customer.id,
    ownerUserId: user.userId,
    vehicleId: String(formData.get('vehicleId') ?? ''),
    locationId: location.id,
    serviceItemId: String(formData.get('serviceItemId') ?? '') || null,
    description: String(formData.get('description') ?? 'Booking requested online'),
    startAt,
    hours,
    notes: String(formData.get('notes') ?? ''),
  });

  redirect(
    result.ok
      ? '/portal?booked=1'
      : `/portal/book?${new URLSearchParams({ workshop: org.id, error: result.error ?? 'That did not work.' }).toString()}`,
  );
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; vehicle?: string; error?: string; workshop?: string }>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const params = await searchParams;

  // The workshop: the one asked for, else the one the customer used last,
  // else the directory to choose from.
  const used = await workshopsUsedBy(user.userId);
  const preferred =
    params.workshop ??
    (
      await prisma.customer.findFirst({
        where: { portalUserId: user.userId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { orgId: true },
      })
    )?.orgId;
  const org = preferred ? await bookableWorkshop(preferred) : null;
  const location = org?.locations[0];
  if (!org || !location) redirect('/portal/workshops');

  const [vehicles, services, directory] = await Promise.all([
    prisma.vehicleOwnership.findMany({
      where: { ownerUserId: user.userId, endedAt: null },
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true, registration: true } },
      },
    }),
    servicesFor(org.id),
    workshopDirectory(),
  ]);

  const chosen = services.find((service) => service.id === params.service) ?? services[0] ?? null;
  const slots = chosen
    ? await slotsFor({ orgId: org.id, locationId: location.id, hours: chosen.hours })
    : [];
  const withWorkshop = (extra: Record<string, string>) =>
    `/portal/book?${new URLSearchParams({ workshop: org.id, ...extra }).toString()}`;
  const customer = { org, orgId: org.id };

  return (
    <PortalShell active="book">
      <div>
        <p className="eyebrow mb-2">{t('Book a visit')}</p>
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">
          {t('When suits you?')}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
          {t(
            'Every time below is one {workshop} can actually do. Pick one and it is in the diary.',
            {
              workshop: customer.org.name,
            },
          )}
        </p>

        <Card className="mt-5">
          <CardHeader
            title={org.name}
            description={
              used.has(org.id)
                ? t('Your workshop. Any other on Carnet can take the car too.')
                : t('A workshop you have not used before. Booking makes you their customer.')
            }
            action={
              <form method="get" className="flex items-center gap-2">
                <label htmlFor="workshop" className="sr-only">
                  {t('Workshop')}
                </label>
                <Select id="workshop" name="workshop" defaultValue={org.id} className="w-56">
                  {directory.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {used.has(w.id) ? ` ${t('(yours)')}` : ''}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" variant="secondary">
                  {t('Change')}
                </Button>
              </form>
            }
          />
        </Card>

        {params.error ? (
          <Alert tone="danger" className="mt-5">
            {t(params.error)}
          </Alert>
        ) : null}

        {vehicles.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              title={t('No vehicle on your account yet')}
              description={t(
                'Add your car first, then you can book online at any workshop on Carnet.',
              )}
            />
          </Card>
        ) : (
          <>
            {/* What for. Changing this changes the times, so it reloads. */}
            <Card className="mt-6">
              <CardHeader title={t('What needs doing?')} />
              <CardBody className="grid gap-2">
                {services.map((service) => (
                  <Link
                    key={service.id}
                    href={withWorkshop({ service: service.id })}
                    className={`flex items-center justify-between gap-3 rounded-(--radius-md) border px-3.5 py-3 transition-colors ${
                      chosen?.id === service.id
                        ? 'border-(--brand) bg-(--brand-soft)'
                        : 'border-(--border) hover:bg-(--surface-sunk)'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{service.name}</span>
                      {service.kind === 'package' && service.description ? (
                        <span className="block text-[12px] text-(--text-soft)">
                          {service.description}
                        </span>
                      ) : null}
                      <span className="block text-[12px] text-(--text-faint)">
                        {service.hours === 1
                          ? t('About 1 hour')
                          : t('About {hours} hours', { hours: service.hours })}
                        {service.price === null
                          ? ''
                          : ` · ${
                              service.kind === 'package'
                                ? formatMinor(Math.round(service.price * 100), region)
                                : t('from {price}', {
                                    price: formatMinor(Math.round(service.price * 100), region),
                                  })
                            }`}
                      </span>
                    </span>
                    {chosen?.id === service.id ? (
                      <Badge tone="brand" size="sm">
                        {t('chosen')}
                      </Badge>
                    ) : null}
                  </Link>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                  {t('Not sure? Pick the closest and add a note. Nobody minds.')}
                </p>
              </CardBody>
            </Card>

            <form action={book} className="mt-5 grid gap-5">
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="serviceItemId" value={chosen?.id ?? ''} />
              <input type="hidden" name="hours" value={chosen?.hours ?? 1} />
              <input type="hidden" name="description" value={chosen?.name ?? 'Visit'} />

              <Card>
                <CardHeader title={t('Which vehicle?')} />
                <CardBody className="grid gap-3.5">
                  <Field label={t('Vehicle')}>
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

                  <Field label={t('Anything we should know?')} hint={t('Optional')}>
                    <Input
                      name="notes"
                      placeholder={t('Noise from the front when braking.')}
                      maxLength={280}
                    />
                  </Field>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={t('When?')}
                  description={
                    slots.length > 0 ? t('Times the workshop genuinely has free') : undefined
                  }
                />
                {slots.length === 0 ? (
                  <EmptyState
                    title={t('Nothing free in the next fortnight')}
                    description={
                      customer.org.phone
                        ? t(
                            'The diary is full for this length of work. Ring {phone} and they will find something.',
                            { phone: customer.org.phone },
                          )
                        : t(
                            'The diary is full for this length of work. Get in touch and they will find something.',
                          )
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
                  {t('Book it')}
                </Button>
              ) : null}

              <p className="text-center text-[12px] leading-relaxed text-(--text-faint)">
                {t(
                  'You will get a confirmation, and a message if the work needs a decision from you. Nothing else, because a message about everything is a message about nothing.',
                )}
              </p>
            </form>
          </>
        )}
      </div>
    </PortalShell>
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
