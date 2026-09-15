import { customerProgressFor, describeExpiry, documentKindLabel, fuelLabel } from '@carnet/core';
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
  Mileage,
  Money,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DocumentRemove, DocumentUpload } from '@/components/document-upload';
import { PortalShell } from '@/components/portal-shell';
import { PassportCover } from '@carnet/ui';
import { documentsFor, paperworkFor } from '@/lib/documents';
import { requireUser } from '@/lib/guard';
import { revokeShare, shareVehicle, sharesFor, vehicleHistory } from '@/lib/portal';
import { regionForUser } from '@/lib/region';
import { tFor } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Vehicle history' };
export const dynamic = 'force-dynamic';

/**
 * One vehicle's history, read by the person who owns it. FR-2302.
 *
 * The same record a stranger sees through a share link, with the two things a
 * stranger is not entitled to: what each visit cost, and the ability to hand
 * the record to somebody else.
 *
 * The sharing controls are here rather than in a settings screen because the
 * moment somebody wants to share a car's history is the moment they are
 * looking at it, usually with a buyer standing next to them.
 */
async function share(formData: FormData) {
  'use server';

  const user = await requireUser();
  const vehicleId = String(formData.get('vehicleId') ?? '');

  const token = await shareVehicle({
    userId: user.userId,
    vehicleId,
    days: Number(formData.get('days') ?? 30) || 30,
  });

  // Shown once, in the URL, because only its digest was stored and there is
  // nowhere to read it back from afterwards.
  redirect(
    token
      ? `/portal/vehicles/${vehicleId}?link=${encodeURIComponent(token)}`
      : `/portal/vehicles/${vehicleId}`,
  );
}

async function withdraw(formData: FormData) {
  'use server';

  const user = await requireUser();
  const vehicleId = String(formData.get('vehicleId') ?? '');

  await revokeShare({ userId: user.userId, shareId: String(formData.get('shareId') ?? '') });

  redirect(`/portal/vehicles/${vehicleId}?withdrawn=1`);
}

function date(value: Date | null, locale: string): string {
  return value
    ? value.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

export default async function PortalVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ link?: string; withdrawn?: string }>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const { id } = await params;
  const { link, withdrawn } = await searchParams;

  const vehicle = await vehicleHistory(user.userId, id);

  // A vehicle somebody no longer owns is not theirs to read. Sold cars stop
  // being visible to the previous owner the day the ownership ends, which is
  // the promise the passport makes to whoever bought it.
  if (!vehicle) notFound();

  const shares = await sharesFor(user.userId, vehicle.id);
  const actor = { orgId: null, userId: user.userId, ownsVehicle: true };
  const [documents, paperwork] = await Promise.all([
    documentsFor(vehicle.id, actor),
    paperworkFor(vehicle.id),
  ]);
  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

  return (
    <PortalShell active="vehicles">
      <p className="eyebrow">{t('Your vehicle')}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[24px] font-semibold leading-tight">
          {name || 'Your vehicle'}
        </h1>
        {vehicle.registration ? <Registration value={vehicle.registration} /> : null}
      </div>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        <Mileage km={vehicle.lastOdometerKm} /> · {vehicle.eventCount} entries on record
        {vehicle.colour ? ` · ${vehicle.colour}` : ''}
      </p>

      <Link
        href={`/portal/vehicles/${vehicle.id}/passport`}
        className="group mt-5 block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--border-focus)"
        aria-label={t("Open the vehicle's passport")}
      >
        <PassportCover
          className="min-h-[150px] rounded-(--radius-lg) transition-transform group-hover:-translate-y-0.5"
          title={t('Vehicle Passport')}
          footer={
            <p className="passport-foil-text text-[10px] opacity-90">
              {vehicle.eventCount} entries · open the passport
            </p>
          }
        />
      </Link>

      {link ? (
        <Alert tone="success" className="mt-4" title={t('Your link is ready')}>
          <span className="break-all">
            {t('Send this to whoever needs it. It is the only time it will be shown.')}
            <br />
            <code className="text-[12px]">/p/{link}</code>
          </span>
        </Alert>
      ) : null}

      {withdrawn ? (
        <Alert tone="info" className="mt-4" title={t('Link withdrawn')}>
          {t('Anybody holding it now sees nothing.')}
        </Alert>
      ) : null}

      {vehicle.recalls.length > 0 ? (
        <Alert
          tone="danger"
          className="mt-4"
          title={t('There is an open safety recall on this vehicle')}
        >
          {vehicle.recalls[0]?.recall.title}. Contact any workshop and the work is carried out free
          of charge by the manufacturer.
        </Alert>
      ) : null}

      <section className="mt-7">
        <h2 className="font-display text-[17px] font-semibold">{t('Coming up')}</h2>
        {vehicle.serviceSchedules.length === 0 ? (
          <EmptyState
            className="mt-3 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
            title={t('Nothing scheduled')}
            description={t('Your workshop sets service intervals when they next see the car.')}
          />
        ) : (
          <ul className="mt-3 grid gap-2">
            {vehicle.serviceSchedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-2.5"
              >
                <span className="font-medium">{schedule.name}</span>
                <span className="text-[13px] text-(--text-soft)">
                  {schedule.dueAt ? date(schedule.dueAt, region.locale) : null}
                  {schedule.dueKm ? (
                    <>
                      {schedule.dueAt ? ' · ' : ''}
                      at <Mileage km={schedule.dueKm} />
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[17px] font-semibold">{t('Every visit')}</h2>
          <Link href="/portal/book">
            <Button size="sm" variant="primary">
              {t('Book a visit')}
            </Button>
          </Link>
        </div>

        {vehicle.jobs.length === 0 ? (
          <EmptyState
            className="mt-3 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
            title={t('No visits recorded yet')}
            description={t(
              'Once this car has been in, every visit appears here and stays with the vehicle.',
            )}
          />
        ) : (
          <ul className="mt-3 grid gap-3">
            {vehicle.jobs.map((job) => {
              const progress = customerProgressFor(job.status);
              const invoice = job.invoices[0];

              return (
                <li key={job.id}>
                  <Card>
                    <CardHeader
                      title={job.shortDescription}
                      description={`${job.org.name} · ${date(job.completedAt ?? job.createdAt, region.locale)}`}
                      action={
                        <Badge tone={progress.done ? 'neutral' : 'brand'} size="sm">
                          {progress.label}
                        </Badge>
                      }
                    />
                    <CardBody className="grid gap-2 text-[13px] text-(--text-soft)">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          {job.odometerInKm ? (
                            <>
                              {t('At')}
                              <Mileage km={job.odometerInKm} />
                            </>
                          ) : (
                            'Mileage not recorded'
                          )}
                        </span>
                        {invoice ? (
                          <span className="font-medium text-(--text)">
                            <Money amount={Number(invoice.total)} currency={invoice.currency} />
                          </span>
                        ) : null}
                      </div>
                      {job.checks.length > 0 ? (
                        <ul className="grid gap-0.5 text-[12px]">
                          {job.checks.map((check) => {
                            const marks = Array.isArray(check.damage) ? check.damage.length : 0;
                            return (
                              <li key={check.kind}>
                                {check.kind === 'IN' ? 'Handed over' : 'Handed back'}{' '}
                                {date(check.createdAt, region.locale)}
                                {check.odometerKm !== null
                                  ? ` at ${check.odometerKm.toLocaleString(region.locale)} km`
                                  : ''}
                                , fuel {fuelLabel(check.fuelEighths)}, {marks} mark
                                {marks === 1 ? '' : 's'} noted
                                {check._count.photos
                                  ? `, ${check._count.photos} photo${check._count.photos === 1 ? '' : 's'}`
                                  : ''}
                                {check.signature
                                  ? `, signed by ${check.signature.signedByName}`
                                  : ''}
                                .
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="share" className="mt-7">
        <h2 className="font-display text-[17px] font-semibold">
          {t('Show this history to somebody')}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-(--text-soft)">
          A buyer, an insurer, or the next garage. They see the vehicle&rsquo;s record and nothing
          about you. You can take the link back at any time.
        </p>

        <Card className="mt-3">
          <CardBody>
            <form action={share} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <Field label={t('Let them see it for')} htmlFor="days" className="min-w-40">
                <Input
                  id="days"
                  name="days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  defaultValue={30}
                />
              </Field>
              <Button type="submit" size="touch" variant="secondary">
                {t('Create a link')}
              </Button>
            </form>
          </CardBody>
        </Card>

        {shares.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {shares.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-2.5 text-[13px]"
              >
                <span className="text-(--text-soft)">
                  Live until {date(entry.expiresAt, region.locale)} ·{' '}
                  {entry.openCount === 0
                    ? 'not opened yet'
                    : `opened ${entry.openCount} time${entry.openCount === 1 ? '' : 's'}`}
                </span>
                <form action={withdraw}>
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <input type="hidden" name="shareId" value={entry.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    {t('Take it back')}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Card className="mt-5">
        <CardHeader title={t('Paperwork')} description={paperwork.statement} />
        {documents.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            Keep the registration certificate, the MOT and the insurance here and they go with the
            car. A workshop that services it sees them; nobody else does.
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
                <span className="text-[12px] text-(--text-faint)">{document.addedBy}</span>
                <DocumentRemove vehicleId={vehicle.id} documentId={document.id} />
              </li>
            ))}
          </ul>
        )}
        <CardBody className="border-t border-(--border)">
          <DocumentUpload vehicleId={vehicle.id} />
        </CardBody>
      </Card>
    </PortalShell>
  );
}
