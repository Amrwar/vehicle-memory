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
import { tFor } from '@/lib/i18n';
import { packagesFor } from '@/lib/packages';
import { createJob, JobError, jobFormOptions, vehicleOption } from '@/lib/jobs';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Open a job') };
}
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
      packageId: String(formData.get('packageId') ?? '') || null,
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
  searchParams: Promise<{ error?: string; customer?: string; vehicle?: string; package?: string }>;
}) {
  const { orgId } = await requireSession('job:write');
  const t = await tFor();
  const { error, customer, vehicle, package: packageParam } = await searchParams;

  const [options, packages] = await Promise.all([
    jobFormOptions(orgId),
    packagesFor(orgId, { activeOnly: true }),
  ]);
  const preset = packages.find((p) => p.id === packageParam) ?? null;

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
        <BackLink href="/jobs">{t('All jobs')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Jobs')}
        title={t('Open a job')}
        description={t('What is in, whose it is, and what it is here for')}
      />

      {error ? (
        <Alert tone="danger" title={t('That cannot be opened')} className="mb-5">
          {t(error)}
        </Alert>
      ) : null}

      {options.customers.length === 0 ? (
        <EmptyState
          title={t('No customers yet')}
          description={t(
            'A job belongs to somebody. Add a customer first, then find or add their vehicle, and this fills in.',
          )}
          action={
            <Link
              href="/customers"
              className="text-[13px] font-medium text-(--brand-text) hover:underline"
            >
              {t('Customers')}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title={t('The job')} />
            <form action={open}>
              <CardBody className="grid gap-4">
                <Field label={t('Customer')}>
                  <Select name="customerId" defaultValue={chosen?.id ?? ''} required>
                    <option value="">{t('Choose somebody')}</option>
                    {options.customers.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label={t('Vehicle')}
                  hint={t(
                    'Vehicles this workshop has seen for the customers above. A car that is new here is found or added first.',
                  )}
                >
                  <Select name="vehicleId" defaultValue={vehicle ?? ''} required>
                    <option value="">{t('Choose a vehicle')}</option>
                    {newcomer ? (
                      <option value={newcomer.id}>
                        {t('{vehicle} — first job here', {
                          vehicle:
                            [newcomer.year, newcomer.make, newcomer.model]
                              .filter(Boolean)
                              .join(' ') +
                            (newcomer.registration ? ` · ${newcomer.registration}` : ''),
                        })}
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

                {packages.length > 0 ? (
                  <Field
                    label={t('From a package')}
                    hint={t(
                      'Its labour, parts, checklist, kind of work and time go on the job in this one press.',
                    )}
                  >
                    <Select name="packageId" defaultValue={preset?.id ?? ''}>
                      <option value="">{t('No package, just the description')}</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} · {pkg.hours}h
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                <Field label={t('What it is in for')}>
                  <Input
                    name="shortDescription"
                    required
                    maxLength={120}
                    defaultValue={preset?.name ?? ''}
                    placeholder={t('Grinding under braking')}
                  />
                </Field>

                <Field
                  label={t('What they said')}
                  hint={t('Optional. Their words, not a diagnosis.')}
                >
                  <Input name="details" maxLength={500} placeholder={t('Worse when cold')} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('Mileage now')}
                    hint={t('Optional. Recorded against the vehicle too.')}
                  >
                    <Input type="number" name="odometerInKm" min={0} placeholder="km" />
                  </Field>

                  <Field label={t('Promised for')}>
                    <Input type="date" name="promisedAt" min={today} defaultValue={today} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('Kind of work')}
                    hint={t('Optional. Drives the skills scheduling needs.')}
                  >
                    <Select name="jobTypeId" defaultValue="">
                      <option value="">{t('Not decided')}</option>
                      {options.jobTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label={t('Technician')}
                    hint={
                      chosen?.preferredTechnicianUserId
                        ? t('Preselected: the person this customer asks for.')
                        : t('Optional. Can be left for the diary.')
                    }
                  >
                    <Select
                      name="technicianUserId"
                      defaultValue={chosen?.preferredTechnicianUserId ?? ''}
                    >
                      <option value="">{t('Nobody yet')}</option>
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
                  {t('Open the job')}
                </Button>
              </CardBody>
            </form>
          </Card>

          <Card>
            <CardHeader title={t('What happens next')} />
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p>
                {t(
                  'The job opens as received, with a number taken in the same breath so there is never a gap in the sequence.',
                )}
              </p>
              <p>
                {t(
                  'A mileage reading goes onto the vehicle as well as the job, so the passport, the service predictions and the mileage checks all see it straight away. A reading lower than the last one is refused rather than written: one of the two figures is wrong and somebody should say which.',
                )}
              </p>
              <p>
                {t(
                  'Everything else is added as it is known. The bay, the estimate and the inspection all come from the job’s own page, and a form that demanded them now would be filled in with guesses.',
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
