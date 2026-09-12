import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { createJob, JobError, jobFormOptions, vehicleOption } from '@/lib/jobs';

export const metadata: Metadata = { title: 'Open a job' };
export const dynamic = 'force-dynamic';

/**
 * Opening a job. FR-3601.
 *
 * Four screens have linked here since Phase 1 and there was never a page: the
 * address matched the job detail route with an id of "new", so pressing the
 * button opened a job that does not exist rather than failing in a way
 * anybody would notice. It was found by somebody pressing it.
 *
 * The form asks for what somebody standing at a counter knows and nothing
 * else. The bay, the technician and the estimate all come later; a form that
 * demanded them would be filled in with guesses.
 */
async function open(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');

  const promised = String(formData.get('promisedAt') ?? '').trim();
  const reading = String(formData.get('odometerInKm') ?? '').trim();

  const back = (message: string) => redirect(`/jobs/new?error=${encodeURIComponent(message)}`);

  try {
    const job = await createJob({
      orgId,
      userId: user.userId,
      locationId: user.locationId,
      customerId: String(formData.get('customerId') ?? ''),
      vehicleId: String(formData.get('vehicleId') ?? ''),
      shortDescription: String(formData.get('shortDescription') ?? ''),
      details: String(formData.get('details') ?? ''),
      odometerInKm: reading ? Number(reading) : null,
      // Five in the afternoon rather than midnight: a promise dated midnight
      // is a promise for the night before in every timezone west of London.
      promisedAt: promised ? new Date(`${promised}T17:00:00`) : null,
      jobTypeId: String(formData.get('jobTypeId') ?? '') || null,
      technicianUserId: String(formData.get('technicianUserId') ?? '') || null,
    });

    redirect(`/jobs/${job.id}`);
  } catch (error) {
    if (error instanceof JobError) back(error.message);
    throw error;
  }
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; customer?: string; vehicle?: string }>;
}) {
  const { orgId } = await requireSession('job:write');
  const { error, customer, vehicle } = await searchParams;

  const options = await jobFormOptions(orgId);

  // Arriving from a customer or a vehicle page preselects that side, which is
  // most of how this page is actually reached.
  const chosen =
    options.customers.find((entry) => entry.id === customer) ??
    options.customers.find((entry) => entry.vehicles.some((row) => row.id === vehicle));

  // A vehicle nobody here has had a job on yet, just found on the network or
  // just added, is offered on its own so the first job can be opened.
  const known = options.customers.some((entry) => entry.vehicles.some((row) => row.id === vehicle));
  const newcomer = vehicle && !known ? await vehicleOption(orgId, vehicle) : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/jobs">All jobs</BackLink>
      </div>

      <PageHeader
        eyebrow="Jobs"
        title="Open a job"
        description="What is in, whose it is, and what it is here for"
      />

      {error ? (
        <Alert tone="danger" title="That cannot be opened" className="mb-5">
          {error}
        </Alert>
      ) : null}

      {options.customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="A job belongs to somebody. Add a customer first, then find or add their vehicle, and this fills in."
          action={
            <Link
              href="/customers"
              className="text-[13px] font-medium text-(--brand-text) hover:underline"
            >
              Customers
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="The job" />
            <form action={open}>
              <CardBody className="grid gap-4">
                <Field label="Customer">
                  <Select name="customerId" defaultValue={chosen?.id ?? ''} required>
                    <option value="">Choose somebody</option>
                    {options.customers.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Vehicle"
                  hint="Vehicles this workshop has seen for the customers above. A car that is new here is found or added first."
                >
                  <Select name="vehicleId" defaultValue={vehicle ?? ''} required>
                    <option value="">Choose a vehicle</option>
                    {newcomer ? (
                      <option value={newcomer.id}>
                        {[newcomer.year, newcomer.make, newcomer.model].filter(Boolean).join(' ')}
                        {newcomer.registration ? ` · ${newcomer.registration}` : ''} — first job
                        here
                      </option>
                    ) : null}
                    {options.customers.flatMap((entry) =>
                      entry.vehicles.map((row) => (
                        <option key={`${entry.id}-${row.id}`} value={row.id}>
                          {[row.year, row.make, row.model].filter(Boolean).join(' ')}
                          {row.registration ? ` · ${row.registration}` : ''} — {entry.name}
                        </option>
                      )),
                    )}
                  </Select>
                </Field>

                <Field label="What it is in for">
                  <Input
                    name="shortDescription"
                    required
                    maxLength={120}
                    placeholder="Grinding under braking"
                  />
                </Field>

                <Field label="What they said" hint="Optional. Their words, not a diagnosis.">
                  <Input name="details" maxLength={500} placeholder="Worse when cold" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mileage now" hint="Optional. Recorded against the vehicle too.">
                    <Input type="number" name="odometerInKm" min={0} placeholder="km" />
                  </Field>

                  <Field label="Promised for">
                    <Input type="date" name="promisedAt" min={today} defaultValue={today} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kind of work" hint="Optional. Drives the skills scheduling needs.">
                    <Select name="jobTypeId" defaultValue="">
                      <option value="">Not decided</option>
                      {options.jobTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Technician"
                    hint={
                      chosen?.preferredTechnicianUserId
                        ? 'Preselected: the person this customer asks for.'
                        : 'Optional. Can be left for the diary.'
                    }
                  >
                    <Select
                      name="technicianUserId"
                      defaultValue={chosen?.preferredTechnicianUserId ?? ''}
                    >
                      <option value="">Nobody yet</option>
                      {options.technicians.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </CardBody>

              <CardBody className="border-t border-(--border)">
                <Button type="submit" variant="primary">
                  Open the job
                </Button>
              </CardBody>
            </form>
          </Card>

          <Card>
            <CardHeader title="What happens next" />
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p>
                The job opens as received, with a number taken in the same breath so there is never
                a gap in the sequence.
              </p>
              <p>
                A mileage reading goes onto the vehicle as well as the job, so the passport, the
                service predictions and the mileage checks all see it straight away. A reading lower
                than the last one is refused rather than written: one of the two figures is wrong
                and somebody should say which.
              </p>
              <p>
                Everything else is added as it is known. The bay, the estimate and the inspection
                all come from the job&rsquo;s own page, and a form that demanded them now would be
                filled in with guesses.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
