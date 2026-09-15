import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { forOrg } from '@carnet/db';
import { Badge, Button, EmptyState, Mileage, Registration } from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/guard';
import { startInspection } from '@/lib/inspections';
import { requestPart, ShopFloorError, toggleClock } from '@/lib/shopfloor';
import { ArrivalError, moveKeys } from '@/lib/arrival';
import { keyState } from '@carnet/core';
import { OutboxStatus } from '@/components/outbox';
import { ThemeToggle } from '@/components/theme-toggle';

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
/**
 * Starts or stops the clock.
 *
 * Every labour cost, utilisation figure and job profit in the product is built
 * on time entries, and until this existed the only way one got written was the
 * seed. The button on this screen had no action behind it at all.
 */
async function clock(formData: FormData) {
  'use server';

  const user = await requireUser();
  if (!user.orgId) redirect('/login');

  try {
    await toggleClock({
      orgId: user.orgId,
      userId: user.userId,
      jobId: String(formData.get('jobId') ?? ''),
    });
  } catch (error) {
    if (error instanceof ShopFloorError) {
      redirect(`/shop?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  redirect('/shop');
}

/** Opens the inspection, or returns to the one already started. */
async function inspect(formData: FormData) {
  'use server';

  const user = await requireUser();
  if (!user.orgId) redirect('/login');

  const id = await startInspection({
    orgId: user.orgId,
    userId: user.userId,
    jobId: String(formData.get('jobId') ?? ''),
  });

  redirect(`/shop/inspect/${id}`);
}

/** Raises a part request against the job, for whoever approves spending. */
async function askForPart(formData: FormData) {
  'use server';

  const user = await requireUser();
  if (!user.orgId) redirect('/login');

  const notes = String(formData.get('notes') ?? '').trim();

  if (!notes) redirect('/shop?error=' + encodeURIComponent('Say which part you need.'));

  await requestPart({
    orgId: user.orgId,
    userId: user.userId,
    jobId: String(formData.get('jobId') ?? ''),
    notes,
  });

  redirect('/shop?requested=1');
}

/** Took the keys off the hook, or put them back. One press. Phase 35. */
async function keys(formData: FormData) {
  'use server';

  const user = await requireUser();
  if (!user.orgId) redirect('/login');
  try {
    await moveKeys({
      orgId: user.orgId,
      userId: user.userId,
      jobId: String(formData.get('jobId') ?? ''),
      action: String(formData.get('action') ?? 'TAKEN') as 'TAKEN' | 'RETURNED',
    });
  } catch (error) {
    if (!(error instanceof ArrivalError)) throw error;
    redirect('/shop?error=' + encodeURIComponent(error.message));
  }
  redirect('/shop');
}

export default async function ShopFloorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; requested?: string; inspected?: string }>;
}) {
  const user = await requireUser();
  const notice = await searchParams;

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
      timeEntries: {
        where: { userId: user.userId, endedAt: null },
        select: { id: true, startedAt: true },
      },
      keyEvents: {
        orderBy: { at: 'asc' },
        select: { action: true, hook: true, at: true, by: { select: { name: true } } },
      },
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
          <div className="flex items-center gap-3">
            {/* Night shifts run the bay lights low. The tablet's own setting
                is usually not the one the technician wants here. */}
            <ThemeToggle className="w-[6.5rem]" />
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
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-4">
        <OutboxStatus />

        {notice.error ? (
          <div className="mb-4 rounded-(--radius-lg) border border-(--danger) bg-(--danger-soft) px-4 py-3">
            <p className="text-[14px] text-(--danger)">{notice.error}</p>
          </div>
        ) : null}

        {notice.requested ? (
          <div className="mb-4 rounded-(--radius-lg) border border-(--success) bg-(--success-soft) px-4 py-3">
            <p className="text-[14px] text-(--success)">
              Asked for. It will show up for whoever approves spending.
            </p>
          </div>
        ) : null}

        {notice.inspected ? (
          <div className="mb-4 rounded-(--radius-lg) border border-(--success) bg-(--success-soft) px-4 py-3">
            <p className="text-[14px] text-(--success)">
              Inspection sent.{' '}
              {Number(notice.inspected) > 0
                ? `${notice.inspected} item${notice.inspected === '1' ? '' : 's'} went onto a quote for the customer to approve.`
                : 'Nothing needed quoting.'}
            </p>
          </div>
        ) : null}

        {openEntry ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-(--radius-lg) border border-(--success) bg-(--success-soft) px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-(--success)">Clocked on</p>
              <p className="datum text-[13px] text-(--text-soft)">
                Since{' '}
                {openEntry.startedAt.toLocaleTimeString(user.region.locale, {
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
              const blocked = job.status === 'AWAITING_APPROVAL' || job.status === 'ESTIMATED';

              // The query already limits time entries to this person's open
              // ones, so any row here means their clock is running on this job.
              const running = job.timeEntries.length > 0;
              const keysNow = keyState(
                job.keyEvents.map((e) => ({
                  action: e.action,
                  hook: e.hook,
                  byName: e.by?.name ?? null,
                  at: e.at,
                })),
              );

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
                      <div className="flex items-center gap-1.5">
                        <dt>Keys</dt>
                        <dd className="text-(--text-soft)">{keysNow.sentence}</dd>
                        {keysNow.where === 'hook' || keysNow.where === 'unknown' ? (
                          <form action={keys}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <input type="hidden" name="action" value="TAKEN" />
                            <button
                              type="submit"
                              className="rounded-(--radius-sm) border border-(--border-strong) px-2 py-0.5 text-[12px] font-medium hover:bg-(--surface-sunk)"
                            >
                              I have them
                            </button>
                          </form>
                        ) : keysNow.where === 'with' ? (
                          <form action={keys}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <input type="hidden" name="action" value="RETURNED" />
                            <button
                              type="submit"
                              className="rounded-(--radius-sm) border border-(--border-strong) px-2 py-0.5 text-[12px] font-medium hover:bg-(--surface-sunk)"
                            >
                              Back on the hook
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </dl>

                    {blocked ? (
                      <p className="mt-3 rounded-(--radius-md) border-l-[3px] border-(--warning) bg-(--warning-soft) px-3 py-2.5 text-[14px] text-(--warning)">
                        Waiting for the customer to approve the estimate. Do not start this work
                        yet.
                      </p>
                    ) : null}

                    {/* Every control here was inert until Phase 7: the clock
                        had no action, and the inspection link pointed at a
                        route that did not exist. Photographs are absent rather
                        than present and dead, because they need a file store
                        nobody has chosen yet. */}
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <form action={clock}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <Button
                          type="submit"
                          size="touch"
                          variant="primary"
                          disabled={blocked && !running}
                          block
                        >
                          {running ? 'Stop the clock' : 'Start the clock'}
                        </Button>
                      </form>

                      <form action={inspect}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <Button type="submit" size="touch" block>
                          {inspection?.status === 'COMPLETED'
                            ? 'Inspection sent'
                            : inspection
                              ? 'Carry on inspecting'
                              : 'Inspect'}
                        </Button>
                      </form>

                      <form action={askForPart} className="flex gap-2">
                        <input type="hidden" name="jobId" value={job.id} />
                        <input
                          name="notes"
                          placeholder="Part needed"
                          aria-label={`Part needed for job ${job.number}`}
                          className="min-w-0 flex-1 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3 text-[15px]"
                        />
                        <Button type="submit" size="touch">
                          Ask
                        </Button>
                      </form>
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
