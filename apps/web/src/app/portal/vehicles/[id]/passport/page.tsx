import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import PortalLoading from '@/components/portal-loading';
import { PortalShell } from '@/components/portal-shell';
import { VehiclePassport } from '@/components/vehicle-passport';
import { ownsVehicle } from '@/lib/documents';
import { requireUser } from '@/lib/guard';
import { reportFor } from '@/lib/handover';
import { mileageFindings } from '@/lib/insights';
import { verifyVehicleChain } from '@/lib/passport';
import { tFor } from '@/lib/i18n';
import { regionForUser } from '@/lib/region';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Your vehicle’s passport') };
}
export const dynamic = 'force-dynamic';

/**
 * The owner's own copy of the passport. Phase 23.
 *
 * Exactly the document a buyer sees through a share link, so the owner knows
 * what they are handing over before they hand it over. The one difference is
 * the wording of the observations page, which speaks to the owner.
 */
/**
 * The status comes first. Phase 73.
 *
 * A Suspense boundary flushes the response, and with it the 200, before the
 * page underneath has looked anything up. While the whole customer side sat
 * under one, a car that was not yours answered 200 with a not-found page
 * inside it. The cheap question -- is this yours -- is asked here, where the
 * answer can still be the status line, and the rest streams behind a
 * fallback.
 */
export default async function PortalPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  if (!(await ownsVehicle(user.userId, id))) notFound();

  return (
    <Suspense fallback={<PortalLoading />}>
      <OwnersPassport userId={user.userId} id={id} />
    </Suspense>
  );
}

async function OwnersPassport({ userId, id }: { userId: string; id: string }) {
  const t = await tFor();
  const region = await regionForUser(userId);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { sequence: 'desc' },
        include: { recordedByOrg: { select: { name: true, locale: true } } },
      },
      ownerships: { orderBy: { startedAt: 'desc' }, select: { id: true } },
      recalls: { where: { status: 'OPEN' }, include: { recall: true } },
    },
  });
  if (!vehicle) notFound();

  const [verification, mileage, report] = await Promise.all([
    verifyVehicleChain(vehicle.id),
    mileageFindings(vehicle.id),
    reportFor(vehicle.id),
  ]);

  return (
    <PortalShell active="vehicles">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/portal/vehicles/${vehicle.id}`}
          className="text-[13px] text-(--text-soft) hover:underline"
        >
          {t('← Back to the vehicle')}
        </Link>
        <Link
          href={`/portal/vehicles/${vehicle.id}#share`}
          className="text-[13px] font-medium text-(--brand-text) hover:underline"
        >
          {t('Show this to somebody')}
        </Link>
      </div>

      <VehiclePassport
        locale={region.locale}
        vehicle={vehicle}
        verification={verification}
        report={report}
        mileage={mileage}
        reader="owner"
      />

      <p className="mt-6 text-[12px] leading-relaxed text-(--text-faint)">
        {t(
          'This is the document a buyer sees when you share a link, word for word. Nothing about you is on it.',
        )}
      </p>
    </PortalShell>
  );
}
