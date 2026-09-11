import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { askable, askAbout, reputation, resolveReview } from '@/lib/retention';

export const metadata: Metadata = { title: 'Reputation' };
export const dynamic = 'force-dynamic';

/**
 * How it went, and what was done about it. FR-3701.
 *
 * The routing is the whole feature and it is the thing businesses get
 * backwards. Asking everybody for a public review collects the one-star ones
 * you could have fixed. Asking privately first, and inviting only somebody
 * already pleased to say so in public, gives the unhappy customer a real
 * conversation instead, which is what they wanted and is worth more than the
 * review would have been.
 *
 * The second list is the one workshops never get: who was not asked, and why.
 * Without it a low review count reads as a broken feature.
 */
async function ask(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

  await askAbout({ orgId, userId: user.userId, jobId: String(formData.get('jobId') ?? '') });

  redirect('/reputation?asked=1');
}

async function resolve(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

  const note = String(formData.get('note') ?? '').trim();

  if (!note) {
    redirect(
      '/reputation?error=' +
        encodeURIComponent('Say what happened. "Resolved" with nothing against it means nothing.'),
    );
  }

  await resolveReview({
    orgId,
    userId: user.userId,
    reviewId: String(formData.get('reviewId') ?? ''),
    note,
  });

  redirect('/reputation');
}

function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function ReputationPage({
  searchParams,
}: {
  searchParams: Promise<{ asked?: string; error?: string }>;
}) {
  const { orgId } = await requireSession('customer:read');
  const { asked, error } = await searchParams;

  const [picture, candidates] = await Promise.all([reputation(orgId), askable(orgId)]);

  const toAsk = candidates.filter((entry) => entry.decision.ask);
  const skipped = candidates.filter((entry) => !entry.decision.ask);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Reputation"
        description="What people said, what was done about it, and who has not been asked"
      />

      {error ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] text-(--danger)">{error}</CardBody>
        </Card>
      ) : null}

      {asked ? (
        <Card className="mb-5 border-(--success)">
          <CardBody className="text-[13px] text-(--success)">
            Asked. The message is queued and goes out with the next run.
          </CardBody>
        </Card>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label="Satisfaction"
          value={picture.average === null ? '—' : `${picture.average}`}
          note={picture.average === null ? 'Too few answers' : 'out of 5'}
        />
        <StatTile label="Answers" value={picture.responses} note={`${picture.sent} asked`} />
        <StatTile
          label="Waiting to be put right"
          value={picture.openConversations}
          tone={picture.openConversations > 0 ? 'danger' : 'neutral'}
          note="A poor rating nobody has closed"
        />
        <StatTile
          label="Ready to ask"
          value={toAsk.length}
          tone={toAsk.length > 0 ? 'brand' : 'neutral'}
          note="Finished, reachable, not asked"
        />
      </StatRow>

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          {picture.summary}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5">
          {picture.waiting.length > 0 ? (
            <Card className="overflow-hidden border-(--danger)">
              <CardHeader
                title="Conversations to have"
                description="Somebody said it went badly. They were told a person would read it today."
              />
              <ul className="divide-y divide-(--border)">
                {picture.waiting.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-[15px] text-(--danger)">{stars(row.rating!)}</span>
                      <Link
                        href={`/customers/${row.customer.id}`}
                        className="text-[13px] font-medium hover:underline"
                      >
                        {row.customer.displayName}
                      </Link>
                      <span className="text-[12px] text-(--text-faint)">
                        job {row.job.number} · {row.job.shortDescription}
                      </span>
                    </div>

                    {row.comment ? (
                      <p className="mt-1 text-[13px] leading-relaxed">
                        &ldquo;{row.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] text-(--text-faint)">
                        They gave a rating and wrote nothing. Ringing is the only way to know why.
                      </p>
                    )}

                    <form action={resolve} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="reviewId" value={row.id} />
                      <Field label="What happened" className="min-w-[16rem] flex-1">
                        <Input name="note" required placeholder="Rang them; refitted free" />
                      </Field>
                      <Button type="submit" size="sm" variant="secondary">
                        Close it
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader
              title="What people said"
              description="Newest first. A five was invited to say so publicly."
            />
            {picture.rows.length === 0 ? (
              <EmptyState
                title="Nobody has answered yet"
                description="Answers appear here as they arrive. Asking happens from the list beside this one."
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {picture.rows.slice(0, 30).map((row) => (
                  <li key={row.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span
                        className={`text-[15px] ${row.rating! >= 4 ? 'text-(--success)' : 'text-(--danger)'}`}
                      >
                        {stars(row.rating!)}
                      </span>
                      <span className="text-[13px]">{row.customer.displayName}</span>
                      {row.resolvedAt ? (
                        <Badge tone="success" size="sm">
                          put right
                        </Badge>
                      ) : null}
                      <span className="ml-auto text-[11px] text-(--text-faint)">
                        {row.respondedAt?.toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    {row.comment ? (
                      <p className="mt-0.5 text-[12px] text-(--text-soft)">
                        &ldquo;{row.comment}&rdquo;
                      </p>
                    ) : null}
                    {row.resolutionNote ? (
                      <p className="text-[11px] text-(--text-faint)">{row.resolutionNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Ready to ask"
              description="Finished at least a day ago, reachable, and not asked recently."
            />
            {toAsk.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                Nobody to ask at the moment.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {toAsk.slice(0, 20).map(({ job }) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium">{job.customer.displayName}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        job {job.number} · {job.shortDescription}
                      </span>
                    </div>
                    <form action={ask}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <Button type="submit" size="sm">
                        Ask
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Not asked, and why"
              description="The list that explains a low review count."
            />
            {skipped.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                Nothing was skipped in the last month.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {skipped.slice(0, 20).map(({ job, decision }) => (
                  <li key={job.id} className="px-4 py-2.5">
                    <span className="text-[13px]">{job.customer.displayName}</span>
                    <span className="block text-[12px] text-(--text-faint)">{decision.why}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
