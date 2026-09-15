import { humaniseEventType, msg, mrzLines, type VehicleEventType } from '@carnet/core';
import {
  inkFor,
  Mileage,
  PassportCover,
  PassportEmblem,
  PassportFields,
  PassportMrz,
  PassportPage,
  PassportPhoto,
  PassportSeal,
  PassportStamp,
  stampTilt,
} from '@carnet/ui';
import type * as React from 'react';

import { MileageFindings } from '@/components/mileage-findings';
import type { mileageFindings } from '@/lib/insights';
import type { reportFor } from '@/lib/handover';
import { tFor } from '@/lib/i18n';

/**
 * The vehicle passport, as a document. Phase 23.
 *
 * One component for every reader: the buyer with a share link, the owner in
 * their portal, and (in a compact form) the workshop on the vehicle's page.
 * Two implementations of "what this record says" would eventually say
 * different things to the two people in a transaction, so there is one.
 *
 * What it does not show is as deliberate as what it does. Names of owners
 * never appear on a stamp, even where the event's own summary names them;
 * the transfer is the fact, the people are theirs.
 */

export interface PassportEventRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  occurredAt: Date;
  odometerKm: number | null;
  verification: string;
  supersededById: string | null;
  recordedByOrg: { name: string; locale?: string } | null;
}

export interface PassportVehicle {
  vin: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  firstRegisteredAt: Date | null;
  chainHead: string | null;
  eventCount: number;
  lastOdometerKm: number | null;
  events: PassportEventRow[];
  ownerships: { id: string }[];
  recalls: { id: string; recall: { title: string; campaignRef: string | null } }[];
}

/** Who pressed the stamp, when no workshop did. */
export function authorityFor(event: PassportEventRow): string {
  if (event.recordedByOrg) return event.recordedByOrg.name;
  if (event.type.startsWith('RECALL')) return msg('Manufacturer');
  if (event.type === 'OWNERSHIP_TRANSFER' || event.type === 'REGISTRATION_CHANGE')
    return msg('Registry');
  return msg('The owner');
}

/** What the stamp may say beneath its title. A transfer names nobody. */
export function detailFor(event: PassportEventRow): string | null {
  if (event.type === 'OWNERSHIP_TRANSFER') return null;
  return event.summary;
}

export async function VehiclePassport({
  vehicle,
  verification,
  report,
  mileage,
  reader,
  afterIdentity,
  locale = 'en-GB',
}: {
  vehicle: PassportVehicle;
  /** How dates and figures are written, from the region of whoever is reading. */
  locale?: string;
  verification: { valid: boolean };
  report: Awaited<ReturnType<typeof reportFor>>;
  mileage: Awaited<ReturnType<typeof mileageFindings>>;
  /** Who is reading: the wording of the observations page differs. */
  reader: 'buyer' | 'owner';
  /** Anything the caller wants between the identity page and the rest, such as sharing controls. */
  afterIdentity?: React.ReactNode;
}) {
  const t = await tFor();
  const workshops = new Set(
    vehicle.events.map((event) => event.recordedByOrg?.name).filter(Boolean),
  );

  const byYear = new Map<number, PassportEventRow[]>();
  for (const event of vehicle.events) {
    const year = event.occurredAt.getFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), event]);
  }
  const years = [...byYear.entries()].sort(([a], [b]) => b - a);

  const serious = mileage.findings.filter((finding) => finding.severity === 'SERIOUS').length;
  const name =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || t('Vehicle');
  const passportNumber = vehicle.chainHead
    ? `${vehicle.chainHead.slice(0, 4)}-${vehicle.chainHead.slice(4, 8)}`.toUpperCase()
    : '—';
  const [line1, line2] = mrzLines({
    vin: vehicle.vin,
    registration: vehicle.registration,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    firstRegisteredAt: vehicle.firstRegisteredAt,
    owners: vehicle.ownerships.length,
    entries: vehicle.eventCount,
  });

  let page = 2;

  return (
    <div className="grid gap-5">
      <PassportCover
        className="min-h-[220px] rounded-(--radius-lg) sm:min-h-[260px]"
        title={t('Vehicle Passport')}
        t={t}
        footer={
          <p className="passport-foil-text text-[11px] opacity-90">
            {vehicle.registration ?? vehicle.vin}
          </p>
        }
      />

      <PassportPage
        number={1}
        heading={t('Particulars of the vehicle')}
        className="overflow-hidden"
        t={t}
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <PassportPhoto caption={vehicle.registration ?? undefined}>
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid place-items-center gap-2 text-center">
                  <PassportEmblem
                    size={64}
                    className="text-(--passport-ink-soft) [&_*]:stroke-current"
                  />
                  <p
                    className="passport-document text-[15px] leading-tight"
                    style={{ color: 'var(--passport-ink)' }}
                  >
                    {vehicle.make ?? t('Vehicle')}
                    <br />
                    <span className="text-[13px]" style={{ color: 'var(--passport-ink-soft)' }}>
                      {vehicle.model ?? ''}
                    </span>
                  </p>
                </div>
              </div>
            </PassportPhoto>
            <PassportSeal intact={verification.valid} head={vehicle.chainHead} t={t} />
          </div>

          <div className="grid content-start gap-4">
            <h1
              className="passport-document text-[24px] leading-tight"
              style={{ color: 'var(--passport-ink)' }}
            >
              {name}
            </h1>
            <PassportFields
              fields={[
                { label: t('Type'), value: 'P' },
                { label: t('Code'), value: 'CNT' },
                { label: t('Passport number'), value: passportNumber },
                { label: t('Registration'), value: vehicle.registration ?? '—' },
                { label: t('Vehicle identification number'), value: vehicle.vin, wide: true },
                { label: t('Make'), value: vehicle.make ?? '—' },
                { label: t('Model'), value: vehicle.model ?? '—' },
                { label: t('Year'), value: vehicle.year ? String(vehicle.year) : '—' },
                {
                  label: t('First registered'),
                  value: vehicle.firstRegisteredAt
                    ? vehicle.firstRegisteredAt.toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—',
                },
                { label: t('Entries on record'), value: String(vehicle.eventCount) },
                { label: t('Workshops contributing'), value: String(workshops.size) },
                { label: t('Owners on record'), value: String(vehicle.ownerships.length) },
                {
                  label: t('Latest odometer'),
                  value: <Mileage km={vehicle.lastOdometerKm} t={t} />,
                },
                {
                  label: t('Mileage anomalies'),
                  value:
                    serious === 1
                      ? t('1 contradiction')
                      : serious > 1
                        ? t('{count} contradictions', { count: serious })
                        : t('None'),
                },
                {
                  label: t('Open recalls'),
                  value: vehicle.recalls.length > 0 ? String(vehicle.recalls.length) : t('None'),
                },
              ]}
            />
          </div>
        </div>
        <p
          className="mt-5 text-[12px] leading-relaxed"
          style={{ color: 'var(--passport-ink-soft)' }}
        >
          {t(
            'This record is append-only. Each entry is linked to the one before it, so an entry cannot be altered or removed without breaking the chain. The seal recomputes it.',
          )}
        </p>
        <div className="-mx-6 -mb-5 mt-4 sm:-mx-8">
          <PassportMrz lines={[line1, line2]} t={t} />
        </div>
      </PassportPage>

      {afterIdentity}

      {report ? (
        <PassportPage number={page++} heading={t('Observations')} t={t}>
          <div className="grid gap-5">
            <div>
              <p className="passport-label">{t('What this record amounts to')}</p>
              <p className="mt-1 text-[14px] leading-relaxed">{t(report.verdict)}</p>
            </div>
            <div>
              <p className="passport-label">{t('What it does not cover')}</p>
              <ul
                className="mt-1 grid gap-1.5 text-[13px] leading-relaxed"
                style={{ color: 'var(--passport-ink-soft)' }}
              >
                {report.gaps.map((gap) => (
                  <li key={gap}>{t(gap)}</li>
                ))}
              </ul>
            </div>
            {report.questions.length > 0 ? (
              <div>
                <p className="passport-label">
                  {reader === 'buyer' ? t('Worth asking the seller') : t('What a buyer will ask')}
                </p>
                <ul className="mt-1 grid gap-1.5 text-[13px] leading-relaxed">
                  {report.questions.map((question) => (
                    <li key={question}>{t(question)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="passport-label">{t('Who has owned it')}</p>
              <ul
                className="mt-1 grid gap-1 text-[13px]"
                style={{ color: 'var(--passport-ink-soft)' }}
              >
                {report.owners.map((owner) => (
                  <li key={owner.position}>
                    {owner.months < 24
                      ? owner.months === 1
                        ? owner.current
                          ? t('Owner {position}, kept it {months} month and still has it.', {
                              position: owner.position,
                              months: owner.months,
                            })
                          : t('Owner {position}, kept it {months} month.', {
                              position: owner.position,
                              months: owner.months,
                            })
                        : owner.current
                          ? t('Owner {position}, kept it {months} months and still has it.', {
                              position: owner.position,
                              months: owner.months,
                            })
                          : t('Owner {position}, kept it {months} months.', {
                              position: owner.position,
                              months: owner.months,
                            })
                      : owner.current
                        ? t('Owner {position}, kept it {years} years and still has it.', {
                            position: owner.position,
                            years: Math.floor(owner.months / 12),
                          })
                        : t('Owner {position}, kept it {years} years.', {
                            position: owner.position,
                            years: Math.floor(owner.months / 12),
                          })}
                  </li>
                ))}
                {report.owners.length === 0 ? <li>{t('No ownership on record.')}</li> : null}
              </ul>
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--passport-ink-faint)' }}>
                {t(
                  'No owner is named on these pages, past or present. That is theirs, not the vehicle’s.',
                )}
              </p>
            </div>
            {vehicle.recalls.length > 0 ? (
              <div
                className="passport-stamp grid gap-1"
                data-ink="alert"
                style={{ transform: 'rotate(-1.5deg)' }}
              >
                <span className="passport-stamp-title">{t('Outstanding recall')}</span>
                <ul
                  className="grid gap-1 font-sans text-[13px]"
                  style={{ color: 'var(--passport-ink)' }}
                >
                  {vehicle.recalls.map((item) => (
                    <li key={item.id}>
                      {item.recall.title}{' '}
                      {item.recall.campaignRef ? (
                        <span
                          className="font-mono text-[11px]"
                          style={{ color: 'var(--passport-ink-faint)' }}
                        >
                          {item.recall.campaignRef}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </PassportPage>
      ) : null}

      <PassportPage number={page++} heading={t('Mileage')} t={t}>
        <MileageFindings
          findings={mileage.findings}
          summary={mileage.summary}
          readings={mileage.readings}
        />
      </PassportPage>

      {vehicle.events.length === 0 ? (
        <PassportPage number={page++} heading={t('Entries')} t={t}>
          <p
            className="py-6 text-center text-[13px]"
            style={{ color: 'var(--passport-ink-faint)' }}
          >
            {t(
              'No entries have been recorded for this vehicle yet. The pages are blank, and that is itself the record.',
            )}
          </p>
        </PassportPage>
      ) : (
        years.map(([year, events]) => (
          <PassportPage key={year} number={page++} heading={t('Entries · {year}', { year })} t={t}>
            <p className="mb-4 text-[12px]" style={{ color: 'var(--passport-ink-faint)' }}>
              {t(
                'Newest first. Each stamp names who pressed it and how well evidenced the entry is.',
              )}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {events.map((event) => {
                const cancelled = event.supersededById !== null;
                // A mileage reading on a record with a contradiction is stamped
                // in red: the page's own finding, not a guess.
                const alert = serious > 0 && event.type === 'MILEAGE_READING';
                return (
                  <li key={event.id} className="min-w-0">
                    <PassportStamp
                      ink={inkFor(event.verification, { alert, cancelled })}
                      authority={event.recordedByOrg ? authorityFor(event) : t(authorityFor(event))}
                      kind={t(humaniseEventType(event.type as VehicleEventType))}
                      date={event.occurredAt.toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      odometer={
                        event.odometerKm !== null
                          ? `${event.odometerKm.toLocaleString(locale)} km`
                          : null
                      }
                      title={event.title}
                      detail={detailFor(event)}
                      cancelled={cancelled}
                      tilt={stampTilt(event.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </PassportPage>
        ))
      )}
    </div>
  );
}
