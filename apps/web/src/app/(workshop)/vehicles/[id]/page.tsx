import {
  averageKmPerDay,
  humanise,
  describeExpiry,
  documentKindLabel,
  humaniseEventType,
  projectServiceDue,
  toneFor,
  type JobStatus,
  type VehicleEventType,
} from '@carnet/core';
import {
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
import { notFound } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { HealthDial } from '@/components/health-dial';
import { can, requireSession } from '@/lib/guard';
import { DocumentUpload, DocumentRemove } from '@/components/document-upload';
import { documentsFor, paperworkFor } from '@/lib/documents';
import { networkStatementFor } from '@/lib/network';
import { orgCanReadVehicle, verifyVehicleChain } from '@/lib/passport';
import { conditionOf } from '@/lib/condition';
import { coverForVehicle } from '@/lib/warranty';

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
  return {
    title: vehicle
      ? `${vehicle.make} ${vehicle.model} ${vehicle.registration ?? ''}`.trim()
      : 'Vehicle',
  };
}

/**
 * The vehicle passport, seen from inside a workshop.
 *
 * Note what is happening here: the vehicle is fetched from the global Prisma
 * client, not the tenant-scoped one, because a vehicle is not owned by a
 * workshop (ADR-0004). Access is checked explicitly instead.
 */
export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adopted?: string; registered?: string; warning?: string }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const { db, orgId, user } = await requireSession('vehicle:read');

  const permitted = await orgCanReadVehicle(orgId, id);
  if (!permitted) notFound();

  // Where the history came from, in one sentence. The network's whole point
  // is that this is often "somewhere else", and the page says so.
  const network = await networkStatementFor(orgId, id);
  const actor = { orgId, userId: user.userId, ownsVehicle: false };
  const [documents, paperwork] = await Promise.all([documentsFor(id, actor), paperworkFor(id)]);
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
        <BackLink href="/vehicles">All vehicles</BackLink>
      </div>

      <PageHeader
        eyebrow="Vehicle passport"
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
              <Button variant="secondary">How this came to be</Button>
            </Link>
            <Link href={`/vehicles/${vehicle.id}/report`}>
              <Button>Buyer report</Button>
            </Link>
            <Link href={`/vehicles/${vehicle.id}/transfer`}>
              <Button>Transfer</Button>
            </Link>
            <Link href={`/jobs/new?vehicle=${vehicle.id}`}>
              <Button variant="primary">New job</Button>
            </Link>
          </>
        }
      />

      {notice.adopted ? (
        <Alert tone="success" className="mb-5">
          This vehicle is on your books now. Its history is below, and what you record continues it.
        </Alert>
      ) : null}

      {notice.registered ? (
        <Alert tone={notice.warning ? 'warning' : 'success'} className="mb-5">
          {notice.warning ??
            'Added. Nobody on the network had seen this vehicle; its history starts here.'}
        </Alert>
      ) : null}

      {/* The network, in one sentence. Another workshop's entries are on the
          timeline below with their commercial detail withheld: what was done,
          when and at what mileage, never what it cost or who did it. */}
      <Card className={`mb-5 ${network.otherEntries > 0 ? 'border-(--brand)' : ''}`}>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] leading-relaxed">{network.statement}</p>
          <Link href="/vehicles/find" className="text-[13px] text-(--brand-text) hover:underline">
            Find another vehicle
          </Link>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title="Identity"
              action={<ChainFingerprint head={vehicle.chainHead} verified={verification.valid} />}
            />
            <CardBody>
              <KeyValue
                columns={3}
                items={[
                  { label: 'VIN', value: <Vin value={vehicle.vin} /> },
                  { label: 'Registration', value: vehicle.registration },
                  { label: 'Engine', value: vehicle.engineCode },
                  { label: 'Fuel', value: vehicle.fuelType?.toLowerCase() },
                  { label: 'Transmission', value: vehicle.transmission?.toLowerCase() },
                  { label: 'Body', value: vehicle.bodyType },
                  { label: 'Colour', value: vehicle.colour },
                  {
                    label: 'Odometer',
                    value: <Mileage km={vehicle.lastOdometerKm} />,
                  },
                  {
                    label: 'Average use',
                    value: kmPerDay
                      ? `${Math.round(kmPerDay * 30).toLocaleString()} km/month`
                      : null,
                  },
                  {
                    label: 'Current owner',
                    value: currentOwner?.ownerName,
                  },
                  {
                    label: 'Owners on record',
                    value: vehicle.ownerships.length || null,
                  },
                  {
                    label: 'Events on record',
                    value: vehicle.eventCount,
                  },
                ]}
              />

              {!verification.valid ? (
                <div className="mt-4 rounded-(--radius-md) border border-(--danger) bg-(--danger-soft) px-3 py-2.5 text-[13px] text-(--danger)">
                  <p className="font-semibold">Integrity check failed</p>
                  <p className="mt-0.5">
                    The chain diverges at entry {verification.failedAt.sequence} (
                    {verification.failedAt.reason.toLowerCase().replace('_', ' ')}). Entries before
                    that point are unaffected.
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="History"
              description={`${vehicle.eventCount} entries, oldest first at the bottom`}
            />

            {vehicle.events.length === 0 ? (
              <EmptyState
                title="No history yet"
                description="Entries appear here automatically when a job on this vehicle is completed."
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
                            event={{
                              id: event.id,
                              type: event.type,
                              typeLabel: humaniseEventType(event.type as VehicleEventType),
                              title: event.title,
                              summary: event.summary,
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
        </div>

        <aside className="grid content-start gap-5">
          {openRecalls.length > 0 ? (
            <Card className="border-(--danger)">
              <CardHeader title="Open recalls" />
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
              <CardHeader title="Next service" />
              <CardBody className="grid gap-2 text-[13px]">
                {due.dueKm ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">Due at</span>
                    <span className="tabular">{due.dueKm.toLocaleString()} km</span>
                  </div>
                ) : null}
                {due.kmRemaining !== null ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">Remaining</span>
                    <span className="tabular">{due.kmRemaining.toLocaleString()} km</span>
                  </div>
                ) : null}
                {due.projectedDueAt ? (
                  <div className="flex justify-between">
                    <span className="text-(--text-faint)">Projected</span>
                    <span className="datum">
                      {due.projectedDueAt.toLocaleDateString('en-GB', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : null}
                {due.isOverdue ? (
                  <Badge tone="danger" dot className="mt-1 w-fit">
                    Overdue
                  </Badge>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Paperwork"
              description={paperwork.statement}
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
                        MOT {describeExpiry(paperwork.motExpiresAt).toLowerCase()}
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
                        Insurance {describeExpiry(paperwork.insuranceExpiresAt).toLowerCase()}
                      </Badge>
                    ) : null}
                  </span>
                ) : undefined
              }
            />
            {documents.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                Nothing on file yet. The registration certificate, the MOT and the insurance are the
                three worth having; a photograph of damage before repair is the fourth.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
                  >
                    <Badge tone="neutral" size="sm">
                      {documentKindLabel(document.kind)}
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
                        {describeExpiry(document.expiresAt)}
                      </Badge>
                    ) : null}
                    <span className="text-[12px] text-(--text-faint)">
                      {document.addedBy} · {document.createdAt.toLocaleDateString('en-GB')}
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
            <CardHeader title="Jobs at this workshop" />
            {jobs.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                This vehicle has not been worked on here.
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
                        {humanise(job.status as JobStatus)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-(--text-soft)">
                      {job.shortDescription}
                    </p>
                    <p className="datum text-[11px] text-(--text-faint)">
                      {job.createdAt.toLocaleDateString('en-GB')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Condition"
              description="Derived from what is on record, not stored anywhere."
            />
            <CardBody className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <HealthDial score={condition.health.score} band={condition.health.band} size={104} />
              <div>
                <p className="text-[13px] leading-relaxed">{condition.health.summary}</p>
                {condition.soon.length > 0 ? (
                  <p className="mt-2 text-[12px] text-(--text-soft)">
                    Next likely: {condition.soon[0]!.label}
                    {condition.soon[0]!.kmAway != null
                      ? ` in about ${Math.abs(condition.soon[0]!.kmAway).toLocaleString('en-GB')} km`
                      : ''}
                    .
                  </p>
                ) : null}
                <Link
                  href={`/vehicles/${id}/condition`}
                  className="mt-2 inline-block text-[12px] font-medium text-(--brand-text) hover:underline"
                >
                  The whole working
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Under warranty"
              description="What this workshop is still standing behind on this vehicle."
            />
            {covers.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                Nothing recorded. Cover is written as a job closes.
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
                        {entry.status.active ? `${entry.status.daysLeft}d left` : 'expired'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-(--text-faint)">{entry.status.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Ownership" />
            <ul className="divide-y divide-(--border)">
              {vehicle.ownerships.map((ownership) => (
                <li key={ownership.id} className="px-4 py-2.5 text-[13px]">
                  <p className="font-medium">{ownership.ownerName ?? 'Unnamed owner'}</p>
                  <p className="datum text-[11px] text-(--text-faint)">
                    {ownership.startedAt.toLocaleDateString('en-GB')} —{' '}
                    {ownership.endedAt ? ownership.endedAt.toLocaleDateString('en-GB') : 'present'}
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
