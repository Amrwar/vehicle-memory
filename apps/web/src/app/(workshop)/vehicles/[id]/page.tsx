import {
  msg,
  averageKmPerDay,
  humanise,
  documentKindLabel,
  humaniseEventType,
  projectServiceDue,
  toneFor,
  type JobStatus,
  type VehicleEventType,
} from '@carnet/core';
import {
  Select,
  Input,
  Field,
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChainFingerprint,
  EmptyState,
  KeyValue,
  Mileage,
  PageHeader,
  Registration,
  TimelineEntry,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { HealthDial } from '@/components/health-dial';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { DocumentUpload, DocumentRemove } from '@/components/document-upload';
import { documentsFor, paperworkFor } from '@/lib/documents';
import { networkStatementFor } from '@/lib/network';
import { correctEvent, orgCanReadVehicle, verifyVehicleChain } from '@/lib/passport';
import { SubmitOnce } from '@/components/submit-once';
import { conditionOf } from '@/lib/condition';
import { VehicleSpecification } from '@/components/vehicle-specification';
import {
  partsThatFit,
  recordCarSheet,
  SpecificationError,
  whatTheCarTakes,
  whatWentIn,
} from '@/lib/specification';
import { coverForVehicle } from '@/lib/warranty';

import {
  expiryLabel,
  insuranceLabel,
  motLabel,
  networkSentence,
  paperworkSentence,
} from '../statements';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { make: true, model: true, registration: true },
  });
  const t = await tFor();
  return {
    title: vehicle
      ? `${vehicle.make} ${vehicle.model} ${vehicle.registration ?? ''}`.trim()
      : t('Vehicle'),
  };
}

/**
 * The vehicle passport, seen from inside a workshop.
 *
 * Note what is happening here: the vehicle is fetched from the global Prisma
 * client, not the tenant-scoped one, because a vehicle is not owned by a
 * workshop (ADR-0004). Access is checked explicitly instead.
 */
/**
 * Putting an entry on a vehicle's record right. FR-8101.
 *
 * A correction is a new entry that supersedes the old one, never an edit: both
 * stay on the chain, and anybody reading later can see that somebody noticed
 * and put it right. The screens for a corrected entry already existed and
 * nothing could ever set one.
 */
async function correct(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const odometer = String(formData.get('odometerKm') ?? '').trim();

  try {
    await correctEvent({
      orgId,
      userId: user.userId,
      eventId: String(formData.get('eventId') ?? ''),
      title: String(formData.get('title') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      odometerKm: odometer === '' ? null : Number(odometer),
    });
  } catch (error) {
    redirect(
      `/vehicles/${vehicleId}?warning=${encodeURIComponent(
        error instanceof Error ? error.message : msg('That entry could not be corrected.'),
      )}`,
    );
  }

  redirect(`/vehicles/${vehicleId}?corrected=1`);
}

/**
 * What this car takes, for this car only. Phase 88.
 *
 * Every box is optional and an empty one clears the line rather than writing
 * nought, because a part of the sheet nobody knows and a coolant capacity of
 * zero litres are different things and only one of them is true of any car.
 * A figure that is not a figure is refused rather than quietly becoming zero:
 * nought bar is a real pressure and a real thing to be wrong about.
 */
async function saveSpecification(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const vehicleId = String(formData.get('vehicleId') ?? '');

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === 'vehicleId') continue;
    values[key] = String(value);
  }

  try {
    await recordCarSheet({ orgId, userId: user.userId, vehicleId, values });
  } catch (error) {
    if (!(error instanceof SpecificationError)) throw error;
    redirect(`/vehicles/${vehicleId}?warning=${encodeURIComponent(error.message)}#specification`);
  }

  redirect(`/vehicles/${vehicleId}#specification`);
}

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    adopted?: string;
    registered?: string;
    warning?: string;
    transferred?: string;
    corrected?: string;
  }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const { db, orgId, user, region } = await requireSession('vehicle:read');
  const t = await tFor();

  const permitted = await orgCanReadVehicle(orgId, id);
  if (!permitted) notFound();

  // Where the history came from, in one sentence. The network's whole point
  // is that this is often "somewhere else", and the page says so.
  const network = await networkStatementFor(orgId, id);
  const actor = { orgId, userId: user.userId, ownsVehicle: false };
  const [documents, paperwork] = await Promise.all([documentsFor(id, actor), paperworkFor(id)]);

  // What the car takes, and the two blocks beside it that are read off
  // records this database already held: the parts a fitment row says belong
  // on it, and what has actually gone in on past jobs. Phase 88.
  const [specification, fits, wentIn] = await Promise.all([
    whatTheCarTakes(orgId, id).catch(() => null),
    partsThatFit(orgId, id).catch(() => []),
    whatWentIn(orgId, id).catch(() => []),
  ]);
  const mayAddDocuments = can(user.role, 'vehicle:write');

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { sequence: 'desc' },
        include: { recordedByOrg: { select: { name: true } } },
      },
      ownerships: { orderBy: { startedAt: 'desc' } },
      odometerReadings: { orderBy: { readAt: 'desc' }, take: 40 },
      recalls: { include: { recall: true } },
      serviceSchedules: { where: { isActive: true } },
    },
  });

  if (!vehicle) notFound();

  // Entries this workshop recorded and has not already put right. Another
  // garage's entry is not ours to correct: a correction is still a claim about
  // what happened, and a record one party can rewrite is not a record.
  const correctable = can(user.role, 'vehicle:write')
    ? vehicle.events.filter(
        (event) => event.recordedByOrgId === orgId && event.supersededById === null,
      )
    : [];

  const [jobs, verification, covers, condition] = await Promise.all([
    db.job.findMany({
      where: { vehicleId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { customer: { select: { displayName: true } } },
    }),
    verifyVehicleChain(id),
    coverForVehicle(orgId, id),
    conditionOf(orgId, id),
  ]);

  const kmPerDay = averageKmPerDay(
    vehicle.odometerReadings
      .filter((reading) => reading.anomaly === 'NONE')
      .map((reading) => ({ km: reading.km, readAt: reading.readAt })),
  );

  const schedule = vehicle.serviceSchedules[0];
  const due = schedule
    ? projectServiceDue({
        lastPerformedAt: schedule.lastPerformedAt,
        lastPerformedKm: schedule.lastPerformedKm,
        intervalMonths: schedule.intervalMonths,
        intervalKm: schedule.intervalKm,
        currentKm: vehicle.lastOdometerKm,
        kmPerDay,
      })
    : null;

  const currentOwner = vehicle.ownerships.find((o) => o.endedAt === null);
  const openRecalls = vehicle.recalls.filter((r) => r.status === 'OPEN');

  // Group the timeline by year: twenty years of history is unreadable as one
  // flat list, and a reader thinks in "what happened in 2024".
  const byYear = new Map<number, typeof vehicle.events>();
  for (const event of vehicle.events) {
    const year = event.occurredAt.getFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(event);
    byYear.set(year, bucket);
  }

  return (
    <>
      <div className="mb-3">
        <BackLink href="/vehicles">{t('All vehicles')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Vehicle passport')}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.registration ? (
              <Registration value={vehicle.registration} className="text-[15px]" />
            ) : null}
          </span>
        }
        description={vehicle.variant ?? undefined}
        actions={
          <>
            <Link href={`/audit/Vehicle/${vehicle.id}`}>
              <Button variant="secondary">{t('How this came to be')}</Button>
            </Link>
            <Link href={`/vehicles/${vehicle.id}/report`}>
              <Button>{t('Buyer report')}</Button>
            </Link>
            <Link href={`/vehicles/${vehicle.id}/transfer`}>
              <Button>{t('Transfer')}</Button>
            </Link>
            <Link href={`/jobs/new?vehicle=${vehicle.id}`}>
              <Button variant="primary">{t('New job')}</Button>
            </Link>
          </>
        }
      />

      {notice.corrected ? (
        <Alert tone="success" className="mb-5">
          {t(
            'Corrected. The original stays on the record, marked as corrected, and the new entry says what it should have said.',
          )}
        </Alert>
      ) : null}

      {notice.transferred ? (
        <Alert tone="success" className="mb-5">
          {t(
            'Handed over. The vehicle is off your books, and its history went with it rather than staying here.',
          )}
        </Alert>
      ) : null}

      {notice.adopted ? (
        <Alert tone="success" className="mb-5">
          {t(
            'This vehicle is on your books now. Its history is below, and what you record continues it.',
          )}
        </Alert>
      ) : null}

      {notice.registered ? (
        <Alert tone={notice.warning ? 'warning' : 'success'} className="mb-5">
          {notice.warning
            ? t(notice.warning)
            : t('Added. Nobody on the network had seen this vehicle; its history starts here.')}
        </Alert>
      ) : null}

      {/* The network, in one sentence. Another workshop's entries are on the
          timeline below with their commercial detail withheld: what was done,
          when and at what mileage, never what it cost or who did it. */}
      <Card className={`mb-5 ${network.otherEntries > 0 ? 'border-(--brand)' : ''}`}>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] leading-relaxed">
            {networkSentence(t, network, region.locale)}
          </p>
          <span className="flex flex-wrap gap-4">
            <Link
              href={`/vehicles/${vehicle.id}/passport`}
              className="text-[13px] font-medium text-(--brand-text) hover:underline"
            >
              {t('See it as the next owner will')}
            </Link>
            <Link href="/vehicles/find" className="text-[13px] text-(--brand-text) hover:underline">
              {t('Find another vehicle')}
            </Link>
          </span>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title={t('Identity')}
              action={
                <ChainFingerprint t={t} head={vehicle.chainHead} verified={verification.valid} />
              }
            />
            <CardBody>
              <KeyValue
                t={t}
                columns={3}
                items={[
                  { label: t('VIN'), value: <Vin value={vehicle.vin} /> },
                  { label: t('Registration'), value: vehicle.registration },
                  { label: t('Engine'), value: vehicle.engineCode },
                  {
                    label: t('Fuel'),
                    value: vehicle.fuelType ? t(vehicle.fuelType.toLowerCase()) : null,
                  },
                  {
                    label: t('Transmission'),
                    value: vehicle.transmission ? t(vehicle.transmission.toLowerCase()) : null,
                  },
                  { label: t('Body'), value: vehicle.bodyType },
                  { label: t('Colour'), value: vehicle.colour },
                  {
                    label: t('Odometer'),
                    value: <Mileage t={t} locale={region.locale} km={vehicle.lastOdometerKm} />,
                  },
                  {
                    label: t('Average use'),
                    value: kmPerDay
                      ? t('{km} km/month', {
                          km: Math.round(kmPerDay * 30).toLocaleString(region.locale),
                        })
                      : null,
                  },
                  {
                    label: t('Current owner'),
                    value: currentOwner?.ownerName,
                  },
                  {
                    label: t('Owners on record'),
                    value: vehicle.ownerships.length || null,
                  },
                  {
                    label: t('Events on record'),
                    value: vehicle.eventCount,
                  },
                ]}
              />

              {!verification.valid ? (
                <div className="mt-4 rounded-(--radius-md) border border-(--danger) bg-(--danger-soft) px-3 py-2.5 text-[13px] text-(--danger)">
                  <p className="font-semibold">{t('Integrity check failed')}</p>
                  <p className="mt-0.5">
                    {t(
                      'The chain diverges at entry {sequence} ({reason}). Entries before that point are unaffected.',
                      {
                        sequence: verification.failedAt.sequence,
                        reason: t(verification.failedAt.reason.toLowerCase().replace('_', ' ')),
                      },
                    )}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {specification ? (
            <VehicleSpecification
              sheet={specification}
              fits={fits}
              wentIn={wentIn}
              canWrite={can(user.role, 'vehicle:write')}
              vehicleId={id}
              save={saveSpecification}
            />
          ) : null}

          <Card>
            <CardHeader
              title={t('History')}
              description={t('{count} entries, oldest first at the bottom', {
                count: vehicle.eventCount,
              })}
            />

            {vehicle.events.length === 0 ? (
              <EmptyState
                title={t('No history yet')}
                description={t(
                  'Entries appear here automatically when a job on this vehicle is completed.',
                )}
              />
            ) : (
              <CardBody className="pt-2">
                {[...byYear.entries()]
                  .sort(([a], [b]) => b - a)
                  .map(([year, events]) => (
                    <section key={year} className="mb-6 last:mb-0">
                      <h3 className="datum mb-3 text-[13px] font-semibold text-(--text-faint)">
                        {year}
                      </h3>
                      <ul>
                        {events.map((event) => (
                          <TimelineEntry
                            key={event.id}
                            t={t}
                            locale={region.locale}
                            event={{
                              id: event.id,
                              type: event.type,
                              typeLabel: t(humaniseEventType(event.type as VehicleEventType)),
                              title: t(event.title),
                              summary: event.summary ? t(event.summary) : null,
                              occurredAt: event.occurredAt,
                              odometerKm: event.odometerKm,
                              verification: event.verification,
                              recordedBy: event.recordedByOrg?.name ?? null,
                              superseded: event.supersededById !== null,
                            }}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
              </CardBody>
            )}
          </Card>

          {correctable.length > 0 ? (
            <Card>
              <CardHeader
                title={t('Put an entry right')}
                description={t(
                  'A correction is a new entry that supersedes the old one. Both stay on the record, because a history that can be quietly edited is not a history.',
                )}
              />
              <form action={correct}>
                <CardBody className="grid gap-3.5">
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <Field
                    label={t('Which entry')}
                    hint={t('Only ones this workshop recorded, and has not already corrected')}
                  >
                    <Select name="eventId" required defaultValue="">
                      <option value="" disabled>
                        {t('Choose the entry that is wrong')}
                      </option>
                      {correctable.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.occurredAt.toLocaleDateString(region.locale, {
                            dateStyle: 'medium',
                          })}
                          {' · '}
                          {event.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('What it should say')}>
                    <Input name="title" required maxLength={120} />
                  </Field>
                  <Field
                    label={t('Why it is being corrected')}
                    hint={t('Read by whoever looks at this record later, including a buyer')}
                  >
                    <Input name="summary" required maxLength={300} />
                  </Field>
                  <Field label={t('Mileage')} hint={t('Optional, if that is what was wrong')}>
                    <Input name="odometerKm" type="number" min={0} className="tabular" />
                  </Field>
                  <SubmitOnce variant="secondary">{t('Record the correction')}</SubmitOnce>
                </CardBody>
              </form>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          {openRecalls.length > 0 ? (
            <Card className="border-(--danger)">
              <CardHeader title={t('Open recalls')} />
              <ul className="divide-y divide-(--border)">
                {openRecalls.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <p className="text-[13px] font-medium">{item.recall.title}</p>
                    <p className="datum mt-0.5 text-[11px] text-(--text-faint)">
                      {item.recall.campaignRef} · {item.recall.manufacturer}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {due ? (
            <Card>
              <CardHeader title={t('Next service')} />
              <CardBody className="grid gap-2 text-[13px]">
                {due.dueKm ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">{t('Due at')}</span>
                    <span className="tabular">{due.dueKm.toLocaleString(region.locale)} km</span>
                  </div>
                ) : null}
                {due.kmRemaining !== null ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">{t('Remaining')}</span>
                    <span className="tabular">
                      {due.kmRemaining.toLocaleString(region.locale)} km
                    </span>
                  </div>
                ) : null}
                {due.projectedDueAt ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">{t('Projected')}</span>
                    <span className="datum">
                      {due.projectedDueAt.toLocaleDateString(region.locale, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : null}
                {due.isOverdue ? (
                  <Badge tone="danger" dot className="mt-1 w-fit">
                    {t('Overdue')}
                  </Badge>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={t('Paperwork')}
              description={paperworkSentence(t, paperwork, region.locale)}
              action={
                paperwork.mot !== 'NONE' || paperwork.insurance !== 'NONE' ? (
                  <span className="flex flex-wrap gap-1.5">
                    {paperwork.mot !== 'NONE' ? (
                      <Badge
                        tone={
                          paperwork.mot === 'EXPIRED'
                            ? 'danger'
                            : paperwork.mot === 'SOON'
                              ? 'warning'
                              : 'success'
                        }
                        size="sm"
                      >
                        {motLabel(t, paperwork.motExpiresAt, region.locale)}
                      </Badge>
                    ) : null}
                    {paperwork.insurance !== 'NONE' ? (
                      <Badge
                        tone={
                          paperwork.insurance === 'EXPIRED'
                            ? 'danger'
                            : paperwork.insurance === 'SOON'
                              ? 'warning'
                              : 'success'
                        }
                        size="sm"
                      >
                        {insuranceLabel(t, paperwork.insuranceExpiresAt, region.locale)}
                      </Badge>
                    ) : null}
                  </span>
                ) : undefined
              }
            />
            {documents.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                {t(
                  'Nothing on file yet. The registration certificate, the MOT and the insurance are the three worth having; a photograph of damage before repair is the fourth.',
                )}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
                  >
                    <Badge tone="neutral" size="sm">
                      {t(documentKindLabel(document.kind))}
                    </Badge>
                    {document.url ? (
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate font-medium hover:underline"
                      >
                        {document.title}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium">{document.title}</span>
                    )}
                    {document.reference ? (
                      <span className="datum text-[12px] text-(--text-soft)">
                        {document.reference}
                      </span>
                    ) : null}
                    {document.expiresAt ? (
                      <Badge
                        tone={
                          document.expiry === 'EXPIRED'
                            ? 'danger'
                            : document.expiry === 'SOON'
                              ? 'warning'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {expiryLabel(t, document.expiresAt, region.locale)}
                      </Badge>
                    ) : null}
                    <span className="text-[12px] text-(--text-faint)">
                      {t(document.addedBy)} · {document.createdAt.toLocaleDateString(region.locale)}
                    </span>
                    {document.mayRemove && mayAddDocuments ? (
                      <DocumentRemove vehicleId={vehicle.id} documentId={document.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {mayAddDocuments ? (
              <CardBody className="border-t border-(--border)">
                <DocumentUpload vehicleId={vehicle.id} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title={t('Jobs at this workshop')} />
            {jobs.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                {t('This vehicle has not been worked on here.')}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {jobs.map((job) => (
                  <li key={job.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="datum text-[12px] font-medium hover:underline"
                      >
                        #{job.number}
                      </Link>
                      <Badge tone={toneFor(job.status as JobStatus)} size="sm">
                        {t(humanise(job.status as JobStatus))}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-(--text-soft)">
                      {job.shortDescription}
                    </p>
                    <p className="datum text-[11px] text-(--text-faint)">
                      {job.createdAt.toLocaleDateString(region.locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('Condition')}
              description={t('Derived from what is on record, not stored anywhere.')}
            />
            <CardBody className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <HealthDial score={condition.health.score} band={condition.health.band} size={104} />
              <div>
                <p className="text-[13px] leading-relaxed">{t(condition.health.summary)}</p>
                {condition.soon.length > 0 ? (
                  <p className="mt-2 text-[12px] text-(--text-soft)">
                    {condition.soon[0]!.kmAway != null
                      ? t('Next likely: {component} in about {km} km.', {
                          component: t(condition.soon[0]!.label),
                          km: Math.abs(condition.soon[0]!.kmAway).toLocaleString(region.locale),
                        })
                      : t('Next likely: {component}.', { component: t(condition.soon[0]!.label) })}
                  </p>
                ) : null}
                <Link
                  href={`/vehicles/${id}/condition`}
                  className="mt-2 inline-block text-[12px] font-medium text-(--brand-text) hover:underline"
                >
                  {t('The whole working')}
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('Under warranty')}
              description={t('What this workshop is still standing behind on this vehicle.')}
            />
            {covers.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                {t('Nothing recorded. Cover is written as a job closes.')}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {covers.map((entry) => (
                  <li key={entry.row.id} className="px-4 py-2.5 text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{entry.row.description}</span>
                      <Badge
                        tone={
                          entry.status.active
                            ? entry.status.daysLeft <= 30
                              ? 'warning'
                              : 'success'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {entry.status.active
                          ? t('{days}d left', { days: entry.status.daysLeft })
                          : t('expired')}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-(--text-faint)">
                      {t(entry.status.summary)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Ownership')} />
            <ul className="divide-y divide-(--border)">
              {vehicle.ownerships.map((ownership) => (
                <li key={ownership.id} className="px-4 py-2.5 text-[13px]">
                  <p className="font-medium">{ownership.ownerName ?? t('Unnamed owner')}</p>
                  <p className="datum text-[11px] text-(--text-faint)">
                    {ownership.startedAt.toLocaleDateString(region.locale)} —{' '}
                    {ownership.endedAt
                      ? ownership.endedAt.toLocaleDateString(region.locale)
                      : t('present')}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
