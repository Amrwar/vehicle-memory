import { landingPathFor, surfaceFor } from '@carnet/core';
import { redirect } from 'next/navigation';

import { WorkshopNav } from '@/components/workshop-nav';
import { requireSession } from '@/lib/guard';

export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const { user, db } = await requireSession();

  // A technician who reaches a workshop URL is sent to the shop floor rather
  // than shown an access-denied page. Their interface is different by design,
  // not by restriction (ADR-0009).
  if (surfaceFor(user.role) !== 'workshop') {
    redirect(landingPathFor(user.role));
  }

  const approvalsWaiting = await db.job.count({ where: { status: 'AWAITING_APPROVAL' } });

  return (
    <div className="min-h-dvh">
      <WorkshopNav
        role={user.role}
        orgName={user.orgName ?? 'Workshop'}
        userName={user.name}
        approvalsWaiting={approvalsWaiting}
      />
      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-16 lg:px-8 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
