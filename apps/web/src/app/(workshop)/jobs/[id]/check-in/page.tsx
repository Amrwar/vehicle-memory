import { DAMAGE_AREAS, FUEL_LEVELS, fuelLabel, type Translator } from '@carnet/core';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Registration,
  Textarea,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CheckPhotos } from '@/components/check-photos';
import { SignaturePad } from '@/components/signature-pad';
import { ArrivalError, arrivalFor, checkIn, signatureFromForm } from '@/lib/arrival';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Check the car in') };
}
export const dynamic = 'force-dynamic';

/**
 * The car arrives. Phase 35.
 *
 * One screen, filled in with the customer standing there: the mileage off
 * the dash, the fuel off the gauge, a walk round the car ticking what is
 * already marked, what was left inside, which hook the keys go on, and a
 * signature saying both sides saw the same car. One press saves it and
 * the photographs are taken on the record it made.
 */
async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');
  const headerList = await headers();

  const damage = DAMAGE_AREAS.filter((area) => formData.get(`mark-${area}`) === 'on').map(
    (area) => ({ area, note: String(formData.get(`note-${area}`) ?? '').trim() || null }),
  );
  const odometer = String(formData.get('odometerKm') ?? '').trim();
  const fuel = String(formData.get('fuelEighths') ?? '').trim();

  try {
    await checkIn({
      orgId,
      userId: user.userId,
      jobId,
      odometerKm: odometer === '' ? null : Number(odometer),
      fuelEighths: fuel === '' ? null : Number(fuel),
      damage,
      belongings: String(formData.get('belongings') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      keysHook: String(formData.get('keysHook') ?? ''),
      signature: signatureFromForm(formData),
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent'),
    });
  } catch (error) {
    if (error instanceof ArrivalError) {
      redirect(`/jobs/${jobId}/check-in?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/jobs/${jobId}/check-in?saved=1`);
}

/** When it was done, by whom, and whether it was signed, as one sentence. */
function signedLine(
  t: Translator,
  when: string,
  by: string | null | undefined,
  signedBy: string | null | undefined,
): string {
  if (by && signedBy)
    return t('{when} by {by}, signed by {signer}.', { when, by, signer: signedBy });
  if (by) return t('{when} by {by}, not signed.', { when, by });
  if (signedBy) return t('{when}, signed by {signer}.', { when, signer: signedBy });
  return t('{when}, not signed.', { when });
}

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ problem?: string; saved?: string }>;
}) {
  const { orgId, db, region } = await requireSession('job:write');
  const t = await tFor();
  const { id } = await params;
  const { problem, saved } = await searchParams;

  const job = await db.job.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      odometerInKm: true,
      customer: { select: { displayName: true } },
      vehicle: {
        select: { make: true, model: true, year: true, registration: true, lastOdometerKm: true },
      },
      bay: { select: { name: true } },
    },
  });
  if (!job) notFound();

  const arrival = await arrivalFor(orgId, job.id);
  const done = arrival?.in ?? null;

  return (
    <>
      <div className="mb-3">
        <BackLink href={`/jobs/${job.id}`}>{t('Job #{number}', { number: job.number })}</BackLink>
      </div>
      <PageHeader
        eyebrow={t('Job #{number} · check-in', { number: job.number })}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
            {job.vehicle.registration ? (
              <Registration value={job.vehicle.registration} className="text-[15px]" />
            ) : null}
          </span>
        }
        description={t(
          '{customer} is handing the car over. Note what it is like now, so nobody has to remember later.',
          { customer: job.customer.displayName },
        )}
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="border-(--success)">
            <CardHeader
              title={saved ? t('Checked in') : t('Already checked in')}
              description={signedLine(
                t,
                done.at.toLocaleString(region.locale, { dateStyle: 'medium', timeStyle: 'short' }),
                done.by,
                done.signedBy,
              )}
            />
            <CardBody className="grid gap-4">
              <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="eyebrow">{t('Mileage in')}</dt>
                  <dd>
                    {done.odometerKm !== null
                      ? `${done.odometerKm.toLocaleString(region.locale)} km`
                      : t('not noted')}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('Fuel')}</dt>
                  <dd>{t(fuelLabel(done.fuelEighths))}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('Keys')}</dt>
                  <dd>
                    {done.keysHook
                      ? t('hook {hook}', { hook: done.keysHook })
                      : t('hook not noted')}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('Left in the car')}</dt>
                  <dd>{done.belongings ?? t('nothing noted')}</dd>
                </div>
              </dl>
              <div>
                <p className="eyebrow mb-1">{t('Already marked')}</p>
                {done.damage.length === 0 ? (
                  <p className="text-[13px] text-(--text-soft)">
                    {t('Nothing marked on arrival.')}
                  </p>
                ) : (
                  <ul className="grid gap-1 text-[13px]">
                    {done.damage.map((mark, i) => (
                      <li key={i}>
                        <span className="font-medium">{t(mark.area)}</span>
                        {mark.note ? (
                          <span className="text-(--text-soft)">: {mark.note}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {done.notes ? <p className="text-[13px] text-(--text-soft)">{done.notes}</p> : null}
              <div className="border-t border-(--border) pt-4">
                <p className="eyebrow mb-2">{t('Photographs')}</p>
                {done.photos.length > 0 ? (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {done.photos.map((photo) =>
                      photo.src ? (
                        <li key={photo.id}>
                          <img
                            src={photo.src}
                            alt={photo.caption ?? t('The car on arrival')}
                            className="h-24 w-32 rounded-(--radius-sm) object-cover"
                          />
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
                <CheckPhotos checkId={done.id} count={done.photos.length} />
              </div>
            </CardBody>
          </Card>
          <aside className="grid content-start gap-3">
            <Link href={`/jobs/${job.id}`}>
              <Button variant="primary" size="lg" block>
                {t('Back to the job')}
              </Button>
            </Link>
            <p className="text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'The record is on the job for whoever picks the car up, and on the customer’s side of Carnet so they can see it too.',
              )}
            </p>
          </aside>
        </div>
      ) : (
        <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <input type="hidden" name="jobId" value={job.id} />
          <div className="grid content-start gap-5">
            <Card>
              <CardHeader title={t('Off the dash')} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('Mileage in (km)')}
                  hint={
                    job.vehicle.lastOdometerKm
                      ? t('Last recorded {km} km.', {
                          km: job.vehicle.lastOdometerKm.toLocaleString(region.locale),
                        })
                      : t('First reading on this car.')
                  }
                >
                  <Input
                    name="odometerKm"
                    type="number"
                    inputMode="numeric"
                    min={job.vehicle.lastOdometerKm ?? 0}
                    defaultValue={job.odometerInKm ?? ''}
                    className="text-[18px]"
                  />
                </Field>
                <Field label={t('Fuel')}>
                  <div className="grid grid-cols-9 gap-1">
                    {FUEL_LEVELS.map((level) => (
                      <label
                        key={level}
                        className="flex cursor-pointer flex-col items-center gap-1 rounded-(--radius-sm) border border-(--border) px-1 py-2 text-[11px] has-checked:border-(--brand) has-checked:bg-(--brand-soft)"
                      >
                        <input
                          type="radio"
                          name="fuelEighths"
                          value={level}
                          defaultChecked={level === 4}
                          className="sr-only"
                        />
                        <span className="font-medium">{t(fuelLabel(level))}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={t('A walk round the car')}
                description={t(
                  'Tick what is already marked. A note against each says what and where.',
                )}
              />
              <CardBody className="grid gap-2 sm:grid-cols-2">
                {DAMAGE_AREAS.map((area) => (
                  <div
                    key={area}
                    className="flex items-center gap-2 rounded-(--radius-sm) border border-(--border) px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      name={`mark-${area}`}
                      id={`mark-${area}`}
                      className="h-5 w-5 shrink-0 cursor-pointer"
                    />
                    <label
                      htmlFor={`mark-${area}`}
                      className="w-32 shrink-0 text-[13px] font-medium"
                    >
                      {t(area)}
                    </label>
                    <input
                      name={`note-${area}`}
                      placeholder={t('scratch, dent, chip…')}
                      className="min-w-0 flex-1 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2 py-1 text-[13px]"
                    />
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t('Inside, and the keys')} />
              <CardBody className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <Field
                  label={t('Left in the car')}
                  hint={t('Child seat, sat nav, the locking wheel nut.')}
                >
                  <Input name="belongings" placeholder={t('nothing of note')} />
                </Field>
                <Field label={t('Keys on hook')}>
                  <Input name="keysHook" placeholder="12" className="text-[18px]" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('Anything else')}>
                    <Textarea
                      name="notes"
                      rows={2}
                      placeholder={t('Warning light on the dash, customer says…')}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>
          </div>

          <aside className="grid content-start gap-5">
            <Card className="border-(--brand)">
              <CardHeader
                title={t('Sign')}
                description={t('The customer signs that this is the car as handed over.')}
              />
              <CardBody className="grid gap-3">
                <SignaturePad />
                <Field label={t('Signed by')}>
                  <Input name="signedByName" defaultValue={job.customer.displayName} />
                </Field>
                <Button type="submit" variant="primary" size="lg" block>
                  {t('Save the check-in')}
                </Button>
                <p className="text-[12px] leading-relaxed text-(--text-faint)">
                  {t(
                    'Photographs are taken on the next screen, on the record this makes. A check-in without a signature is saved, and says so.',
                  )}
                </p>
              </CardBody>
            </Card>
          </aside>
        </form>
      )}
    </>
  );
}
