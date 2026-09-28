import { needsSomebody } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { JobStandingBand } from '@/components/job-standing';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { whereJobsStand } from '@/lib/standing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Where everything stands') };
}

export const dynamic = 'force-dynamic';

/**
 * Every open job, worst first, with the one thing to do about each.
 *
 * The diary answers "what is booked". The floor answers "where is that car".
 * Neither answers the question a service manager asks twenty times a day:
 * **what is holding things up, and whose fault is it.**
 *
 * Ours first, because those are the ones this morning can change. A workshop
 * cannot make a customer approve an estimate or a supplier deliver a part, and
 * a board that shows those in the same colour as the jobs nobody has started
 * teaches somebody to read none of them.
 *
 * Nothing on this page is stored. Every line is derived from the job's own
 * records when the page is asked for — `standingOfJob` in core decides, and
 * the band on the job's own page renders the same answer from the same
 * function, so the two can never disagree. Phase 84, and the first floor of
 * the control tower.
 */
export default async function NowPage() {
  const t = await tFor();
  const { orgId, region } = await requireSession('job:read');

  const jobs = await whereJobsStand(orgId);

  const ours = jobs.filter((job) => job.standing.move === 'us');
  const waiting = jobs.filter(
    (job) => job.standing.move === 'customer' || job.standing.move === 'supplier',
  );
  const settled = jobs.filter((job) => !needsSomebody(job.standing));
  const late = jobs.filter((job) => job.standing.late);

  const groups = [
    {
      key: 'ours',
      title: t('Ours to move'),
      note: t('Nothing is stopping these but us.'),
      jobs: ours,
    },
    {
      key: 'waiting',
      title: t('Waiting on somebody else'),
      note: t('A customer or a supplier has to move before these can.'),
      jobs: waiting,
    },
    {
      key: 'settled',
      title: t('Nothing outstanding'),
      note: t('Still open, but nobody is waiting on anything.'),
      jobs: settled,
    },
  ].filter((group) => group.jobs.length > 0);

  return (
    <>
      <PageHeader
        title={t('Where everything stands')}
        description={t(
          'Every open job, hardest first. What it is waiting for, how long it has been waiting, and the one thing that moves it.',
        )}
      />

      {late.length > 0 ? (
        <p className="mb-5 rounded-(--radius-md) border border-(--danger) bg-(--danger-soft) p-3 text-[13px]">
          {late.length === 1
            ? t('One job is past the time it was promised back.')
            : t('{count} jobs are past the time they were promised back.', { count: late.length })}
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState
          title={t('Nothing open')}
          description={t('Every job is finished, paid and collected.')}
        />
      ) : null}

      <div className="grid gap-5">
        {groups.map((group) => (
          <Card key={group.key}>
            <CardHeader title={`${group.title} · ${group.jobs.length}`} description={group.note} />
            <CardBody className="grid gap-2">
              {group.jobs.map((job) => (
                <div key={job.id} className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-(--brand-text) hover:underline"
                    >
                      #{job.number}
                    </Link>
                    {job.registration ? <Registration value={job.registration} /> : null}
                    <span className="min-w-0 truncate">{job.vehicle}</span>
                    {job.who ? (
                      <span className="truncate text-(--text-faint)">· {job.who}</span>
                    ) : null}
                    <Badge tone="neutral">{job.what}</Badge>
                  </div>

                  <JobStandingBand
                    standing={job.standing}
                    currency={region.currency}
                    locale={region.locale}
                  />
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
