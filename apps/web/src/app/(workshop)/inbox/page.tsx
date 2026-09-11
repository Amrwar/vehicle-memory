import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { prisma } from '@carnet/db';
import { requireSession } from '@/lib/guard';
import { handleInbound, inbox } from '@/lib/retention';

export const metadata: Metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

/**
 * What customers sent in. FR-3704.
 *
 * Everything outbound has been recorded and sent since Phase 5 and nothing
 * inbound has ever arrived: a customer replying to a text about their car
 * reached somebody's phone, or nothing at all.
 *
 * Two decisions shape this screen. A message is matched with a stated
 * confidence rather than filed silently, because a reply against the wrong job
 * is worse than one against nothing. And the order is what has to be dealt
 * with rather than what arrived first: somebody asking to be left alone has to
 * be acted on today, and somebody apparently approving work is holding up a
 * car.
 */
const TONE = {
  CERTAIN: 'success',
  PROBABLE: 'brand',
  POSSIBLE: 'warning',
  NONE: 'danger',
} as const;

async function file(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

  await handleInbound({
    orgId,
    userId: user.userId,
    messageId: String(formData.get('messageId') ?? ''),
    jobId: String(formData.get('jobId') ?? '') || null,
    done: formData.get('done') === '1',
  });

  redirect('/inbox');
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { orgId } = await requireSession('customer:read');
  const { all } = await searchParams;

  const messages = await inbox(orgId, all === '1');

  // Open jobs, so a message with no match can be filed against one without
  // leaving the page.
  const openJobs = await prisma.job.findMany({
    where: {
      orgId,
      status: { in: ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'AWAITING_APPROVAL', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      number: true,
      shortDescription: true,
      customer: { select: { displayName: true } },
    },
  });

  const needing = messages.filter((message) => message.priority.rank <= 2);

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Inbox"
        description="Replies from customers, in the order they have to be dealt with"
        actions={
          <Link
            href={all === '1' ? '/inbox' : '/inbox?all=1'}
            className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-[13px] hover:bg-(--surface-sunken)"
          >
            {all === '1' ? 'Only what is open' : 'Everything'}
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile label="Waiting" value={messages.length} note="Not yet dealt with" />
        <StatTile
          label="Needing attention"
          value={needing.length}
          tone={needing.length > 0 ? 'warning' : 'neutral'}
          note="Opt-outs, approvals, unfiled"
        />
        <StatTile
          label="Nobody could file"
          value={messages.filter((message) => message.confidence === 'NONE').length}
          note="No customer on that address"
        />
      </StatRow>

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          Nothing here is acted on automatically. A reply that looks like &ldquo;yes&rdquo; is put
          at the top for somebody to read, not treated as an approval: work worth thousands of
          pounds does not rest on a pattern match.
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Messages"
          description="Matched with a confidence rather than filed silently."
        />
        {messages.length === 0 ? (
          <EmptyState
            title="Nothing has come in"
            description="Replies appear here once a provider is delivering them. Until then the workshop can send and cannot hear."
          />
        ) : (
          <ul className="divide-y divide-(--border)">
            {messages.map((message) => (
              <li key={message.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Badge
                    tone={TONE[message.confidence as keyof typeof TONE] ?? 'neutral'}
                    size="sm"
                  >
                    {message.confidence.toLowerCase()}
                  </Badge>

                  {message.priority.label ? (
                    <Badge tone={message.priority.rank === 0 ? 'danger' : 'warning'} dot>
                      {message.priority.label}
                    </Badge>
                  ) : null}

                  <span className="datum text-[12px] text-(--text-soft)">
                    {message.fromAddress}
                  </span>

                  <span className="ml-auto text-[11px] text-(--text-faint)">
                    {message.receivedAt.toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                <p className="mt-1 text-[14px] leading-relaxed">{message.body}</p>

                <p className="mt-1 text-[12px] text-(--text-faint)">
                  {message.matchNote}
                  {message.customer ? (
                    <>
                      {' '}
                      <Link
                        href={`/customers/${message.customer.id}`}
                        className="text-(--brand-text) hover:underline"
                      >
                        {message.customer.displayName}
                      </Link>
                    </>
                  ) : null}
                  {message.job ? (
                    <>
                      {' · '}
                      <Link
                        href={`/jobs/${message.job.id}`}
                        className="text-(--brand-text) hover:underline"
                      >
                        job {message.job.number}
                      </Link>
                    </>
                  ) : null}
                </p>

                {message.handledAt ? (
                  <p className="mt-1 text-[11px] text-(--success)">
                    Dealt with {message.handledAt.toLocaleDateString('en-GB')}
                  </p>
                ) : (
                  <form action={file} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="messageId" value={message.id} />

                    <Select name="jobId" defaultValue={message.job?.id ?? ''} className="max-w-md">
                      <option value="">Leave it unfiled</option>
                      {openJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.number} · {job.customer.displayName} · {job.shortDescription}
                        </option>
                      ))}
                    </Select>

                    <Button type="submit" size="sm" variant="secondary">
                      File it
                    </Button>

                    <Button type="submit" name="done" value="1" size="sm">
                      Dealt with
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
