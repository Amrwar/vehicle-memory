import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PortalShell } from '@/components/portal-shell';
import { VehiclePassport } from '@/components/vehicle-passport';
import { ownsVehicle } from '@/lib/documents';
import { requireUser } from '@/lib/guard';
import { reportFor } from '@/lib/handover';
import { mileageFindings } from '@/lib/insights';
import { verifyVehicleChain } from '@/lib/passport';
import { regionForUser } from '@/lib/region';

export const metadata: Metadata = { title: 'Your vehicle’s passport' };
export const dynamic = 'force-dynamic';

/**
 * The owner's own copy of the passport. Phase 23.
 *
 * Exactly the document a buyer sees through a share link, so the owner knows
 * what they are handing over before they hand it over. The one difference is
 * the wording of the observations page, which speaks to the owner.
 */
export default async function PortalPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const { id } = await params;

  if (!(await ownsVehicle(user.userId, id))) notFound();

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
          ← Back to the vehicle
        </Link>
        <Link
          href={`/portal/vehicles/${vehicle.id}#share`}
          className="text-[13px] font-medium text-(--brand-text) hover:underline"
        >
          Show this to somebody
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
        This is the document a buyer sees when you share a link, word for word. Nothing about you is
        on it.
      </p>
    </PortalShell>
  );
}
