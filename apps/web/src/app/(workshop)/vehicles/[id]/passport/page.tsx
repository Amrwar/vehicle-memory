import { prisma } from '@carnet/db';
import { PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { VehiclePassport } from '@/components/vehicle-passport';
import { requireSession } from '@/lib/guard';
import { reportFor } from '@/lib/handover';
import { mileageFindings } from '@/lib/insights';
import { orgCanReadVehicle, verifyVehicleChain } from '@/lib/passport';

export const metadata: Metadata = { title: 'Passport' };
export const dynamic = 'force-dynamic';

/**
 * The passport as the next owner will see it, from inside the workshop.
 * Phase 23.
 *
 * The working vehicle page is for doing the job. This is for the moment a
 * customer asks "what will a buyer see?", and the answer is the document
 * itself, unchanged.
 */
export default async function WorkshopPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { orgId, region } = await requireSession('vehicle:read');
  const { id } = await params;

  if (!(await orgCanReadVehicle(orgId, id))) notFound();

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
    <>
      <div className="mb-3">
        <BackLink href={`/vehicles/${vehicle.id}`}>The vehicle</BackLink>
      </div>
      <PageHeader
        eyebrow="Passport"
        title="As the next owner will see it"
        description="The document a buyer receives through a share link, word for word. No owner is named on it."
      />
      <div className="mx-auto max-w-3xl">
        <VehiclePassport
          locale={region.locale}
          vehicle={vehicle}
          verification={verification}
          report={report}
          mileage={mileage}
          reader="buyer"
        />
      </div>
    </>
  );
}
