import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { bookableCustomers, createBooking } from '@/lib/bookings';
import { requireSession } from '@/lib/guard';
import { packagesFor } from '@/lib/packages';

export const metadata: Metadata = { title: 'Take a booking' };
export const dynamic = 'force-dynamic';

/**
 * A booking taken over the counter. FR-2804.
 *
 * The customer's own flow has existed since Phase 4.6 and offers only slots
 * the workshop can genuinely do. This is the other half, and it is the one
 * most bookings still arrive through: somebody rings, and whoever answers
 * writes it down while they are still on the line.
 *
 * So the bay and the technician are optional. The person on the telephone
 * usually knows the car is coming and not yet where it will go, and an
 * unassigned slot is honest where a guessed one produces a diary that looks
 * planned and is not.
 */
async function take(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('diary:write');

  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '09:00');
  const packageId = String(formData.get('packageId') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim();

  if (!date || (!description && !packageId)) {
    redirect('/bookings/new?error=' + encodeURIComponent('A booking needs a date and a reason.'));
  }

  const startAt = new Date(`${date}T${time}`);

  if (Number.isNaN(startAt.getTime())) {
    redirect('/bookings/new?error=' + encodeURIComponent('That date could not be read.'));
  }

  const id = await createBooking({
    orgId,
    userId: user.userId,
    locationId: String(formData.get('locationId') ?? ''),
    customerId: String(formData.get('customerId') ?? ''),
    vehicleId: String(formData.get('vehicleId') ?? ''),
    startAt,
    // Blank hours with a package: the package's own time.
    estimatedHours: packageId
      ? Number(formData.get('estimatedHours') ?? 0) || 0
      : Math.max(0.25, Number(formData.get('estimatedHours') ?? 1) || 1),
    description,
    packageId,
    bayId: String(formData.get('bayId') ?? '') || null,
    technicianId: String(formData.get('technicianId') ?? '') || null,
    notes: String(formData.get('notes') ?? ''),
  });

  redirect(`/bookings/${id}`);
}

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; vehicle?: string }>;
}) {
  const { orgId } = await requireSession('diary:write');
  const { error } = await searchParams;

  const packages = await packagesFor(orgId, { activeOnly: true });
  const [customers, locations, bays, technicians] = await Promise.all([
    bookableCustomers(orgId),
    prisma.location.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.bay.findMany({
      where: { location: { orgId }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { orgId, role: 'TECHNICIAN', isActive: true },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/diary">The diary</BackLink>
      </div>

      <PageHeader
        eyebrow="Diary"
        title="Take a booking"
        description="For the ones that arrive by telephone, which is still most of them"
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title="Not booked">
          {error}
        </Alert>
      ) : null}

      {customers.length === 0 ? (
        <Alert tone="info" title="No customers yet">
          Add a customer and a vehicle first, then their appointments can be booked here.
        </Alert>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader title="The appointment" />
          <CardBody>
            <form action={take} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer" htmlFor="customerId" required>
                  <Select id="customerId" name="customerId" required>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Vehicle"
                  htmlFor="vehicleId"
                  required
                  hint="Every vehicle these customers have had in."
                >
                  <Select id="vehicleId" name="vehicleId" required>
                    {customers.flatMap((customer) =>
                      customer.jobs
                        .filter((job) => job.vehicle)
                        .map((job) => (
                          <option key={`${customer.id}-${job.vehicle.id}`} value={job.vehicle.id}>
                            {customer.displayName} — {job.vehicle.make} {job.vehicle.model}
                            {job.vehicle.registration ? ` (${job.vehicle.registration})` : ''}
                          </option>
                        )),
                    )}
                  </Select>
                </Field>
              </div>

              {packages.length > 0 ? (
                <Field
                  label="A package"
                  htmlFor="packageId"
                  hint="Sets the time, and the job starts from it when the car arrives."
                >
                  <Select id="packageId" name="packageId" defaultValue="">
                    <option value="">Not a package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} · {pkg.hours}h
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field
                label="What needs doing"
                htmlFor="description"
                hint="Blank with a package takes the package's name."
              >
                <Input id="description" name="description" placeholder="Full service and MOT" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Day" htmlFor="date" required>
                  <Input id="date" name="date" type="date" required defaultValue={today} />
                </Field>

                <Field label="Time" htmlFor="time" required>
                  <Input id="time" name="time" type="time" required defaultValue="09:00" />
                </Field>

                <Field
                  label="Hours to allow"
                  htmlFor="estimatedHours"
                  hint="Blank with a package: its own time."
                >
                  <Input
                    id="estimatedHours"
                    name="estimatedHours"
                    type="number"
                    step="0.25"
                    min={0}
                    inputMode="decimal"
                    defaultValue=""
                    placeholder="1"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Site" htmlFor="locationId" required>
                  <Select id="locationId" name="locationId" required>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Bay" htmlFor="bayId" hint="Can wait until it arrives.">
                  <Select id="bayId" name="bayId" defaultValue="">
                    <option value="">Decide later</option>
                    {bays.map((bay) => (
                      <option key={bay.id} value={bay.id}>
                        {bay.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Technician" htmlFor="technicianId" hint="Can wait too.">
                  <Select id="technicianId" name="technicianId" defaultValue="">
                    <option value="">Decide later</option>
                    {technicians.map((membership) => (
                      <option key={membership.user.id} value={membership.user.id}>
                        {membership.user.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Anything else" htmlFor="notes" hint="What the customer said.">
                <Input id="notes" name="notes" />
              </Field>

              <div>
                <Button type="submit" variant="primary">
                  Book it in
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </>
  );
}
