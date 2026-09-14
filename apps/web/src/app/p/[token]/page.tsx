import { prisma } from '@carnet/db';
import { PassportEmblem } from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { BackToOrigin } from '@/components/back-to-origin';
import { VehiclePassport } from '@/components/vehicle-passport';
import { hashShareToken } from '@/lib/auth';
import { reportFor } from '@/lib/handover';
import { mileageFindings } from '@/lib/insights';
import { verifyVehicleChain } from '@/lib/passport';
import { safeLocale } from '@carnet/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vehicle passport',
  robots: { index: false, follow: false },
};

/**
 * The public vehicle passport, as a passport. Phase 23.
 *
 * David (persona P5) is standing in a stranger's driveway with fourteen
 * thousand pounds at stake. He arrived from a link, has no account, and will
 * leave in three minutes. What he sees is a document: a cover, an identity
 * page with the vehicle's particulars and a machine-readable zone, a page of
 * observations about what the record does and does not say, and pages of
 * stamps, one per entry, pressed by whoever recorded it.
 *
 * Everything answers one of two questions: what happened to this car, and
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
            include: { recordedByOrg: { select: { name: true, locale: true } } },
          },
          ownerships: { orderBy: { startedAt: 'desc' }, select: { id: true } },
          recalls: { where: { status: 'OPEN' }, include: { recall: true } },
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

  // The same report and the same mileage reading the seller sees on their
  // own screen, from the same functions. Two implementations of "what this
  // record says" would eventually say different things to the two people in
  // the transaction, and the one who lost by it would be the buyer.
  const locale = safeLocale(
    vehicle.events.find((event) => event.recordedByOrg?.locale)?.recordedByOrg?.locale,
  );
  const [verification, mileage, report] = await Promise.all([
    verifyVehicleChain(vehicle.id),
    mileageFindings(vehicle.id),
    reportFor(vehicle.id),
  ]);

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <BackToOrigin label="Back" />
          <span className="ml-auto flex items-center gap-2">
            <PassportEmblem size={20} className="text-(--accent)" />
            <span className="eyebrow">Vehicle passport</span>
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        <VehiclePassport
          locale={locale}
          vehicle={vehicle}
          verification={verification}
          report={report}
          mileage={mileage}
          reader="buyer"
        />

        <footer className="mt-6 border-t border-(--border) pt-4 text-[12px] text-(--text-faint)">
          <p>
            Shared by the vehicle&rsquo;s owner. This link expires on{' '}
            <time className="datum">
              {share.expiresAt.toLocaleDateString(locale, {
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
