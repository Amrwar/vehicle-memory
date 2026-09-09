import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { forOrg } from '@carnet/db';
import { Badge, Button, EmptyState, Mileage, Registration } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/guard';

export const metadata: Metadata = { title: 'My jobs' };
export const dynamic = 'force-dynamic';

/**
 * The shop floor.
 *
 * John (persona P2) has gloves on, the tablet is on a wall bracket, and he has
 * about fifteen seconds of patience. He sees his jobs for today and nothing
 * else. No navigation tree, no reports, no money.
 *
 * Everything here is at least 48px (NFR-605), nothing depends on hover
 * (NFR-611), and the type is a size larger than the desktop application
 * because the tablet is at arm's length.
 */
export default async function ShopFloorPage() {
  const user = await requireUser();

  if (user.role !== 'TECHNICIAN') {
    redirect(user.orgId ? '/dashboard' : '/portal');
  }
  if (!user.orgId) redirect('/login');

  const db = forOrg(user.orgId);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Includes the statuses where the technician cannot yet proceed. Hiding a
  // job that is blocked on the customer would leave John looking at an empty
  // screen while the car sits in his bay, and he would go and ask the front
  // desk — which is exactly the interruption this interface exists to remove.
  const jobs = await db.job.findMany({
    where: {
      technicians: { some: { userId: user.userId } },
      status: {
        in: [
          'RECEIVED',
          'INSPECTING',
          'DIAGNOSED',
          'ESTIMATED',
          'AWAITING_APPROVAL',
          'APPROVED',
          'IN_PROGRESS',
          'QUALITY_CHECK',
        ],
      },
    },
    orderBy: [{ promisedAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      vehicle: { select: { make: true, model: true, registration: true, lastOdometerKm: true } },
      customer: { select: { displayName: true } },
      tasks: { select: { isDone: true } },
      inspections: { select: { id: true, status: true } },
      timeEntries: { where: { userId: user.userId, endedAt: null }, select: { id: true, startedAt: true } },
    },
  });

  const openEntry = jobs.flatMap((job) => job.timeEntries)[0];

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="sticky top-0 z-20 border-b border-(--border) bg-(--surface) px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Carnet</p>
            <h1 className="font-display text-[20px] font-semibold leading-tight">My jobs</h1>
          </div>
          <div className="text-right">
            <p className="text-[14px] font-medium">{user.name}</p>
            <form action="/api/sign-out" method="post">
              <button
                type="submit"
                className="text-[13px] text-(--text-faint) underline underline-offset-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-4">
        {openEntry ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-(--radius-lg) border border-(--success) bg-(--success-soft) px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-(--success)">Clocked on</p>
              <p className="datum text-[13px] text-(--text-soft)">
                Since{' '}
                {openEntry.startedAt.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <Button size="touch" variant="secondary">
              Stop
            </Button>
          </div>
        ) : null}

        {jobs.length === 0 ? (
          <EmptyState
            title="Nothing assigned"
            description="Jobs appear here when the front desk assigns one to you."
            className="rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          />
        ) : (
          <ul className="grid gap-3">
            {jobs.map((job) => {
              const done = job.tasks.filter((task) => task.isDone).length;
              const inspection = job.inspections[0];
              // Work must not begin on unapproved chargeable work. The screen
              // says why rather than simply disabling the button.
              const blocked =
                job.status === 'AWAITING_APPROVAL' || job.status === 'ESTIMATED';

              return (
                <li key={job.id}>
                  <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-[19px] font-semibold leading-tight">
                            {job.vehicle.make} {job.vehicle.model}
                          </h2>
                          {job.vehicle.registration ? (
                            <Registration
                              value={job.vehicle.registration}
                              className="text-[14px]"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 text-[15px] text-(--text-soft)">
                          {job.shortDescription}
                        </p>
                      </div>
                      <Badge tone={toneFor(job.status as JobStatus)} dot>
                        {humanise(job.status as JobStatus)}
                      </Badge>
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-(--text-faint)">
                      <div className="flex gap-1.5">
                        <dt>Job</dt>
                        <dd className="datum text-(--text-soft)">#{job.number}</dd>
                      </div>
                      {job.estimatedHours ? (
                        <div className="flex gap-1.5">
                          <dt>Allowed</dt>
                          <dd className="tabular text-(--text-soft)">
                            {Number(job.estimatedHours).toFixed(1)} h
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex gap-1.5">
                        <dt>Odometer</dt>
                        <dd className="text-(--text-soft)">
                          <Mileage km={job.odometerInKm ?? job.vehicle.lastOdometerKm} />
                        </dd>
                      </div>
                      {job.tasks.length > 0 ? (
                        <div className="flex gap-1.5">
                          <dt>Tasks</dt>
                          <dd className="tabular text-(--text-soft)">
                            {done}/{job.tasks.length}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {blocked ? (
                      <p className="mt-3 rounded-(--radius-md) border-l-[3px] border-(--warning) bg-(--warning-soft) px-3 py-2.5 text-[14px] text-(--warning)">
                        Waiting for the customer to approve the estimate. Do not start
                        this work yet.
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        size="touch"
                        variant="primary"
                        disabled={blocked}
                        className="col-span-2 sm:col-span-1"
                      >
                        {job.timeEntries.length > 0 ? 'Stop job' : 'Start job'}
                      </Button>
                      <Link href={`/shop/${job.id}/inspection`}>
                        <Button size="touch" block>
                          {inspection?.status === 'COMPLETED' ? 'Inspection ✓' : 'Inspect'}
                        </Button>
                      </Link>
                      <Button size="touch">Add photo</Button>
                      <Button size="touch">Request part</Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
