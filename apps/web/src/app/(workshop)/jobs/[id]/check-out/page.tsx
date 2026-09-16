import {
  DAMAGE_AREAS,
  FUEL_LEVELS,
  fuelLabel,
  humanise,
  type JobStatus,
  msg,
  type Translator,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Money,
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
import {
  ArrivalError,
  arrivalFor,
  checkOut,
  outstandingOn,
  signatureFromForm,
} from '@/lib/arrival';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Hand the car back') };
}
export const dynamic = 'force-dynamic';

/**
 * The car leaves. Phase 35.
 *
 * What was done, the final mileage, what is owed and whether it was paid,
 * what goes back with the car, the keys, and a signature. The page refuses
 * to let a car leave with money owing unless somebody says why, and it
 * says so in a sentence rather than a disabled button.
 */
const DOCUMENTS = [
  msg('Keys'),
  msg('Invoice'),
  msg('Old parts'),
  msg('Service book stamped'),
  msg('MOT certificate'),
];

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
    await checkOut({
      orgId,
      userId: user.userId,
      jobId,
      odometerKm: odometer === '' ? null : Number(odometer),
      fuelEighths: fuel === '' ? null : Number(fuel),
      damage,
      documents: formData.getAll('document').map(String),
      notes: String(formData.get('notes') ?? ''),
      letGoOwingReason: String(formData.get('letGoOwingReason') ?? ''),
      signature: signatureFromForm(formData),
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent'),
    });
  } catch (error) {
    if (error instanceof ArrivalError) {
      redirect(`/jobs/${jobId}/check-out?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/jobs/${jobId}/check-out?saved=1`);
}

export default async function CheckOutPage({
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
      vehicle: { select: { make: true, model: true, year: true, registration: true } },
      labourLines: { select: { description: true } },
      partLines: { select: { description: true } },
      feeLines: { select: { description: true } },
      invoices: {
        where: { status: { not: 'VOID' } },
        select: {
          id: true,
          number: true,
          total: true,
          amountPaid: true,
          currency: true,
          status: true,
        },
      },
    },
  });
  if (!job) notFound();

  const [arrival, outstandingMinor] = await Promise.all([
    arrivalFor(orgId, job.id),
    outstandingOn(job.id),
  ]);
  const done = arrival?.out ?? null;
  const invoice = job.invoices[0];
  const finished = ['COMPLETED', 'INVOICED', 'PAID'].includes(job.status);

  return (
    <>
      <div className="mb-3">
        <BackLink href={`/jobs/${job.id}`}>{t('Job #{number}', { number: job.number })}</BackLink>
      </div>
      <PageHeader
        eyebrow={t('Job #{number} · check-out', { number: job.number })}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
            {job.vehicle.registration ? (
              <Registration value={job.vehicle.registration} className="text-[15px]" />
            ) : null}
            <Badge tone={outstandingMinor > 0 ? 'warning' : 'success'} dot>
              {outstandingMinor > 0 ? t('money owing') : t('nothing owing')}
            </Badge>
          </span>
        }
        description={t(
          '{customer} is collecting. What was done, what is owed, what goes back with the car.',
          { customer: job.customer.displayName },
        )}
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {!finished && !done ? (
        <Alert tone="warning" title={t('The work is not marked completed')} className="mb-5">
          {t(
            'The job is {status}. Complete it first, so the customer is handed back a finished car; then this page lets it go.',
            { status: t(humanise(job.status as JobStatus)).toLowerCase() },
          )}
        </Alert>
      ) : null}

      {done ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="border-(--success)">
            <CardHeader
              title={saved ? t('Handed back') : t('Already handed back')}
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
                  <dt className="eyebrow">{t('Mileage out')}</dt>
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
                  <dt className="eyebrow">{t('Went back with the car')}</dt>
                  <dd>
                    {done.documents.length
                      ? done.documents.map((doc) => t(doc)).join(', ')
                      : t('not noted')}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('Money')}</dt>
                  <dd>
                    {done.letGoOwingReason
                      ? t('Left owing: {reason}', { reason: done.letGoOwingReason })
                      : t('Nothing owing at hand-back.')}
                  </dd>
                </div>
              </dl>
              {done.damage.length > 0 ? (
                <div>
                  <p className="eyebrow mb-1">{t('Noted at hand-back')}</p>
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
                </div>
              ) : null}
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
                            alt={photo.caption ?? t('The car at hand-back')}
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
          </aside>
        </div>
      ) : (
        <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <input type="hidden" name="jobId" value={job.id} />
          <div className="grid content-start gap-5">
            <Card>
              <CardHeader title={t('What was done')} />
              <CardBody>
                <ul className="grid gap-1 text-[13px]">
                  {[...job.labourLines, ...job.partLines, ...job.feeLines].map((line, i) => (
                    <li key={i}>{line.description}</li>
                  ))}
                  {job.labourLines.length + job.partLines.length + job.feeLines.length === 0 ? (
                    <li className="text-(--text-faint)">{t('No lines on the job.')}</li>
                  ) : null}
                </ul>
              </CardBody>
            </Card>

            <Card className={outstandingMinor > 0 ? 'border-(--warning)' : undefined}>
              <CardHeader
                title={t('The money')}
                action={
                  invoice ? (
                    <Link href={`/invoices/${invoice.id}`} className="text-[13px] underline">
                      {t('Invoice {number}', { number: invoice.number })}
                    </Link>
                  ) : null
                }
              />
              <CardBody className="grid gap-3 text-[13px]">
                {invoice ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">{t('Outstanding')}</span>
                    <Money
                      amount={outstandingMinor / 100}
                      currency={invoice.currency}
                      locale={region.locale}
                    />
                  </div>
                ) : (
                  <p className="text-(--text-soft)">
                    {t('No invoice has been issued on this job.')}
                  </p>
                )}
                {outstandingMinor > 0 ? (
                  <>
                    {invoice ? (
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="primary" size="lg" block>
                          {t('Take the payment first')}
                        </Button>
                      </Link>
                    ) : null}
                    <Field
                      label={t('Or say why the car is leaving unpaid')}
                      hint={t(
                        'An account customer, a fleet, an agreed later date. Recorded on the hand-back.',
                      )}
                    >
                      <Input
                        name="letGoOwingReason"
                        placeholder={t('Fleet account, invoiced monthly')}
                      />
                    </Field>
                  </>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t('Off the dash, and what goes back')} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('Mileage out (km)')}
                  hint={
                    job.odometerInKm
                      ? t('Came in at {km} km.', {
                          km: job.odometerInKm.toLocaleString(region.locale),
                        })
                      : undefined
                  }
                >
                  <Input
                    name="odometerKm"
                    type="number"
                    inputMode="numeric"
                    min={job.odometerInKm ?? 0}
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
                          defaultChecked={level === (arrival?.in?.fuelEighths ?? 4)}
                          className="sr-only"
                        />
                        <span className="font-medium">{t(fuelLabel(level))}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[13px] font-medium">{t('Goes back with the car')}</p>
                  <div className="flex flex-wrap gap-2">
                    {DOCUMENTS.map((doc) => (
                      <label
                        key={doc}
                        className="flex cursor-pointer items-center gap-2 rounded-(--radius-sm) border border-(--border) px-3 py-2 text-[13px] has-checked:border-(--brand) has-checked:bg-(--brand-soft)"
                      >
                        <input
                          type="checkbox"
                          name="document"
                          value={doc}
                          defaultChecked={doc === 'Keys' || doc === 'Invoice'}
                          className="h-4 w-4 pointer-coarse:h-6 pointer-coarse:w-6"
                        />
                        {t(doc)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t('Anything noted at hand-back')}>
                    <Textarea
                      name="notes"
                      rows={2}
                      placeholder={t('Advisory explained; next service due…')}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            <details className="rounded-(--radius-lg) border border-(--border) bg-(--surface) px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium">
                {t('A new mark on the car since it arrived')}
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {DAMAGE_AREAS.map((area) => (
                  <div
                    key={area}
                    className="flex items-center gap-2 rounded-(--radius-sm) border border-(--border) px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      name={`mark-${area}`}
                      id={`out-${area}`}
                      className="h-5 w-5 shrink-0 cursor-pointer"
                    />
                    <label
                      htmlFor={`out-${area}`}
                      className="w-32 shrink-0 text-[13px] font-medium"
                    >
                      {t(area)}
                    </label>
                    <input
                      name={`note-${area}`}
                      placeholder={t('what, and where')}
                      className="min-w-0 flex-1 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2 py-1 text-[13px]"
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>

          <aside className="grid content-start gap-5">
            <Card className="border-(--brand)">
              <CardHeader
                title={t('Sign')}
                description={t('The customer signs that the car and the keys are back with them.')}
              />
              <CardBody className="grid gap-3">
                <SignaturePad />
                <Field label={t('Signed by')}>
                  <Input name="signedByName" defaultValue={job.customer.displayName} />
                </Field>
                <Button type="submit" variant="primary" size="lg" block disabled={!finished}>
                  {t('Hand the car back')}
                </Button>
                {arrival?.in ? (
                  <p className="text-[12px] leading-relaxed text-(--text-faint)">
                    {arrival.in.damage.length === 1
                      ? t('Came in {when} at {reading}, fuel {fuel}, 1 mark noted.', {
                          when: arrival.in.at.toLocaleString(region.locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                          reading:
                            arrival.in.odometerKm !== null
                              ? `${arrival.in.odometerKm.toLocaleString(region.locale)} km`
                              : t('no reading'),
                          fuel: t(fuelLabel(arrival.in.fuelEighths)),
                        })
                      : t('Came in {when} at {reading}, fuel {fuel}, {count} marks noted.', {
                          when: arrival.in.at.toLocaleString(region.locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                          reading:
                            arrival.in.odometerKm !== null
                              ? `${arrival.in.odometerKm.toLocaleString(region.locale)} km`
                              : t('no reading'),
                          fuel: t(fuelLabel(arrival.in.fuelEighths)),
                          count: arrival.in.damage.length,
                        })}
                  </p>
                ) : (
                  <p className="text-[12px] leading-relaxed text-(--text-faint)">
                    {t(
                      'This car was not checked in, so there is no arrival record to compare with.',
                    )}
                  </p>
                )}
              </CardBody>
            </Card>
          </aside>
        </form>
      )}
    </>
  );
}
