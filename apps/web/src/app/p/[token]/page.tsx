import { humaniseEventType, type VehicleEventType } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Badge,
  ChainFingerprint,
  KeyValue,
  Mileage,
  Registration,
  TimelineEntry,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { MileageFindings } from '@/components/mileage-findings';
import { mileageFindings } from '@/lib/insights';

import { hashShareToken } from '@/lib/auth';
import { reportFor } from '@/lib/handover';
import { verifyVehicleChain } from '@/lib/passport';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vehicle history',
  robots: { index: false, follow: false },
};

/**
 * The public vehicle passport.
 *
 * David (persona P5) is standing in a stranger's driveway with fourteen
 * thousand pounds at stake. He arrived from a link, has no account, and will
 * leave in three minutes.
 *
 * Everything here answers one of two questions: what happened to this car, and
 * why should I believe it. No personal details of any owner appear, and every
 * open of the link is logged for the owner to see (FR-410).
 */
export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await prisma.passportShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: {
      vehicle: {
        include: {
          events: {
            orderBy: { sequence: 'desc' },
            include: { recordedByOrg: { select: { name: true } } },
          },
          ownerships: { orderBy: { startedAt: 'desc' } },
          recalls: { where: { status: 'OPEN' }, include: { recall: true } },
          odometerReadings: { where: { anomaly: { not: 'NONE' } }, take: 5 },
        },
      },
    },
  });

  if (!share || share.revokedAt || share.expiresAt < new Date()) {
    notFound();
  }

  const headerList = await headers();

  // Record the access. The owner can see who looked and when.
  await Promise.all([
    prisma.passportShareAccess.create({
      data: {
        shareId: share.id,
        ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: headerList.get('user-agent') ?? null,
      },
    }),
    prisma.passportShare.update({
      where: { id: share.id },
      data: { openCount: { increment: 1 }, lastOpenedAt: new Date() },
    }),
  ]);

  const vehicle = share.vehicle;
  const verification = await verifyVehicleChain(vehicle.id);

  const workshops = new Set(
    vehicle.events.map((event) => event.recordedByOrg?.name).filter(Boolean),
  );

  const byYear = new Map<number, typeof vehicle.events>();
  for (const event of vehicle.events) {
    const year = event.occurredAt.getFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), event]);
  }

  // Read across every workshop that has recorded a reading. Clocking happens
  // between garages; one workshop's own records agree with themselves almost
  // by definition.
  const mileage = await mileageFindings(vehicle.id);

  // The same report the seller sees on their own screen, from the same
  // function. Two implementations of "what this record says" would eventually
  // say different things to the two people in the transaction, and the one
  // who lost by it would be the buyer.
  const report = await reportFor(vehicle.id);

  // Only the contradictions count here. A thin patch of history is worth
  // knowing and is not something the vehicle did.
  const serious = mileage.findings.filter((finding) => finding.severity === 'SERIOUS').length;

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
              className="text-(--brand)"
            >
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 4.6v5.4l3.4 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-[14px] font-semibold">Carnet</span>
            <span className="eyebrow ml-auto">Vehicle history</span>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-[26px] font-semibold leading-tight">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {vehicle.registration ? <Registration value={vehicle.registration} /> : null}
          <Vin value={vehicle.vin} className="text-[12px]" />
        </div>

        <div className="mt-4">
          <ChainFingerprint head={vehicle.chainHead} verified={verification.valid} />
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-(--text-soft)">
          This record is append-only. Each entry is cryptographically linked to the one before it,
          so an entry cannot be altered or removed without breaking the chain. The check above
          recomputes it.
        </p>

        <section className="mt-6 rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
          <KeyValue
            columns={2}
            items={[
              { label: 'Entries on record', value: vehicle.eventCount },
              {
                label: 'Workshops contributing',
                value: workshops.size || null,
              },
              {
                label: 'Latest odometer',
                value: <Mileage km={vehicle.lastOdometerKm} />,
              },
              { label: 'Owners on record', value: vehicle.ownerships.length || null },
              {
                label: 'Mileage anomalies',
                value:
                  serious > 0 ? (
                    <Badge tone="danger" dot>
                      {serious} contradiction{serious === 1 ? '' : 's'}
                    </Badge>
                  ) : (
                    <Badge tone="success" dot>
                      None
                    </Badge>
                  ),
              },
              {
                label: 'Open recalls',
                value:
                  vehicle.recalls.length > 0 ? (
                    <Badge tone="danger" dot>
                      {vehicle.recalls.length}
                    </Badge>
                  ) : (
                    <Badge tone="success" dot>
                      None
                    </Badge>
                  ),
              },
            ]}
          />
        </section>

        {report ? (
          <section className="mt-5 grid gap-4">
            <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
              <h2 className="font-display text-[15px] font-semibold">
                What this record amounts to
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed">{report.verdict}</p>
            </div>

            <div className="rounded-(--radius-lg) border border-(--warning) bg-(--surface) p-4">
              <h2 className="font-display text-[15px] font-semibold">What it does not cover</h2>
              <ul className="mt-2 grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
                {report.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>

            {report.questions.length > 0 ? (
              <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
                <h2 className="font-display text-[15px] font-semibold">Worth asking the seller</h2>
                <ul className="mt-2 grid gap-2 text-[13px] leading-relaxed">
                  {report.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
              <h2 className="font-display text-[15px] font-semibold">Who has owned it</h2>
              <ul className="mt-2 grid gap-1.5 text-[13px] text-(--text-soft)">
                {report.owners.map((owner) => (
                  <li key={owner.position}>
                    Owner {owner.position}, kept it{' '}
                    {owner.months < 24
                      ? `${owner.months} month${owner.months === 1 ? '' : 's'}`
                      : `${Math.floor(owner.months / 12)} years`}
                    {owner.current ? ' and still has it' : ''}.
                  </li>
                ))}
                {report.owners.length === 0 ? <li>No ownership on record.</li> : null}
              </ul>
              <p className="mt-2 text-[12px] text-(--text-faint)">
                No owner is named here, past or present. That is theirs, not the vehicle&rsquo;s.
              </p>
            </div>
          </section>
        ) : null}

        {/* The whole record read at once, rather than a count of rows already
            flagged. A rollback with two years of normal driving after it
            leaves no adjacent pair looking wrong, and the count above it
            would be zero. */}
        <section className="mt-4">
          <MileageFindings
            findings={mileage.findings}
            summary={mileage.summary}
            readings={mileage.readings}
          />
        </section>

        {vehicle.recalls.length > 0 ? (
          <div className="mt-4 rounded-(--radius-lg) border border-(--danger) bg-(--danger-soft) px-4 py-3">
            <p className="text-[14px] font-semibold text-(--danger)">Outstanding recall</p>
            <ul className="mt-1.5 grid gap-1.5">
              {vehicle.recalls.map((item) => (
                <li key={item.id} className="text-[13px] text-(--text-soft)">
                  {item.recall.title}{' '}
                  <span className="datum text-[11px] text-(--text-faint)">
                    {item.recall.campaignRef}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="mt-6">
          <h2 className="font-display text-[18px] font-semibold">History</h2>
          <p className="mt-1 text-[13px] text-(--text-faint)">
            Newest first. Each entry names the workshop that recorded it and how well evidenced it
            is.
          </p>

          <div className="mt-4 rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
            {vehicle.events.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-(--text-faint)">
                No entries have been recorded for this vehicle yet.
              </p>
            ) : (
              [...byYear.entries()]
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
                ))
            )}
          </div>
        </section>

        <footer className="mt-8 border-t border-(--border) pt-4 text-[12px] text-(--text-faint)">
          <p>
            Shared by the vehicle&rsquo;s owner. This link expires on{' '}
            <time className="datum">
              {share.expiresAt.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            , and the owner can revoke it at any time. Your visit has been recorded and is visible
            to them.
          </p>
          <p className="mt-2">
            No personal details of any owner are shown. Carnet does not verify claims made outside
            this record.
          </p>
        </footer>
      </main>
    </div>
  );
}
