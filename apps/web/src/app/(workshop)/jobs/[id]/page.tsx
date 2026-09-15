import {
  calculateTotals,
  humanise,
  type JobStatus,
  jobProfit,
  JobTransitionError,
  money,
  progressFor,
  summarise,
  toneFor,
  toNumber,
  type PriceableLine,
  DRAFT_KINDS,
  describeExchange,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  KeyValue,
  Mileage,
  Money,
  PageHeader,
  Select,
  Textarea,
  ProgressTrail,
  Registration,
  SeverityBadge,
  SeveritySummary,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import {
  ArrivalError,
  arrivalFor,
  moveKeys,
  recordSignature,
  signatureFromForm,
} from '@/lib/arrival';
import { coverWorthChecking } from '@/lib/condition';
import { ConversationError, conversationForJob, sendReply } from '@/lib/conversations';
import { type Channel, channelLabel } from '@carnet/core';
import { approveInPerson, QuoteError, quoteExtraWork, sendEstimate } from '@/lib/estimates';
import { customerSummaryFor, sendCustomerSummary } from '@/lib/ai';
import { AssistantError, draftFor, exchangesFor, explainFor, sendDraft } from '@/lib/assistant';
import { issueInvoice, MoneyCycleError, moveJob } from '@/lib/money';
import { fitmentWarningsForJob } from '@/lib/provenance';
import { SignaturePad } from '@/components/signature-pad';
import { fuelLabel } from '@carnet/core';
import { can, requireSession } from '@/lib/guard';

export const dynamic = 'force-dynamic';

/**
 * Sends the current quote to the customer.
 *
 * The button has been on this page since Phase 1. Until now nothing answered
 * it, so the only quote any customer ever opened was the seeded one.
 */
async function send(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('estimate:write');
  const jobId = String(formData.get('jobId') ?? '');

  try {
    await sendEstimate({
      orgId,
      userId: user.userId,
      estimateId: String(formData.get('estimateId') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof QuoteError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/jobs/${jobId}?sent=1`);
}

/**
 * The customer said yes at the counter. One press records the decision under
 * their name, puts the approved lines on the job and reserves the parts.
 * Phase 34.
 */
async function approve(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('estimate:write');
  const jobId = String(formData.get('jobId') ?? '');
  const headerList = await headers();

  try {
    // Signed on the pad if the customer was in front of somebody; the
    // approval row points at the signature. Phase 35.
    const signature = signatureFromForm(formData);
    const signatureId = signature
      ? await recordSignature({
          orgId,
          purpose: 'ESTIMATE_APPROVAL',
          jobId,
          capturedByUserId: user.userId,
          ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: headerList.get('user-agent'),
          signature,
        })
      : null;
    await approveInPerson({
      orgId,
      userId: user.userId,
      estimateId: String(formData.get('estimateId') ?? ''),
      approvedByName: signature?.name || null,
      signatureId,
    });
  } catch (error) {
    if (!(error instanceof QuoteError) && !(error instanceof ArrivalError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/jobs/${jobId}?approved=1`);
}

/**
 * Extra work found with the car on the ramp, quoted from the job. One line
 * per press; "Quote it now" sends it in the same press. Phase 34.
 */
async function extra(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('estimate:write');
  const jobId = String(formData.get('jobId') ?? '');
  const send = formData.get('send') === '1';
  const price = String(formData.get('unitPrice') ?? '').trim();

  try {
    await quoteExtraWork({
      orgId,
      userId: user.userId,
      jobId,
      kind: String(formData.get('kind') ?? 'LABOUR') as 'LABOUR' | 'PART' | 'FEE',
      description: String(formData.get('description') ?? ''),
      quantity: Number(formData.get('quantity') ?? 1),
      unitPrice: price === '' ? null : Number(price),
      partNumber: String(formData.get('partNumber') ?? ''),
      send,
    });
  } catch (error) {
    if (!(error instanceof QuoteError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}#extra`);
  }

  redirect(`/jobs/${jobId}?quoted=${send ? 'sent' : '1'}#extra`);
}

/** A word to the customer, from the job, on the channel they can be reached on. Phase 36. */
async function write(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const jobId = String(formData.get('jobId') ?? '');
  try {
    await sendReply({
      orgId,
      userId: user.userId,
      conversationId: String(formData.get('conversationId') ?? ''),
      channel: String(formData.get('channel') ?? 'SMS') as Channel,
      body: String(formData.get('body') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof ConversationError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}#conversation`);
  }
  redirect(`/jobs/${jobId}?wrote=1#conversation`);
}

/** The keys moved: hung on a hook, taken by somebody, put back. Phase 35. */
async function keys(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');
  try {
    await moveKeys({
      orgId,
      userId: user.userId,
      jobId,
      action: String(formData.get('action') ?? 'TAKEN') as 'HUNG' | 'TAKEN' | 'RETURNED',
      hook: String(formData.get('hook') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof ArrivalError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}#keys`);
  }
  redirect(`/jobs/${jobId}#keys`);
}

/**
 * Moves the job on.
 *
 * Every button in the header that changes the status lands here, with the
 * target status in the form. The rules are the lifecycle's own and the refusal
 * it gives is shown verbatim, because "the customer has not approved the
 * estimate yet" is more use than a disabled button.
 */
async function move(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');

  try {
    await moveJob({
      orgId,
      userId: user.userId,
      jobId,
      to: String(formData.get('to') ?? '') as JobStatus,
      note: String(formData.get('note') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof JobTransitionError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/jobs/${jobId}`);
}

/** Issues the invoice for a completed job and goes to it. */
async function issue(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('invoice:write');
  const jobId = String(formData.get('jobId') ?? '');

  let invoiceId: string;

  try {
    invoiceId = await issueInvoice({ orgId, userId: user.userId, jobId });
  } catch (error) {
    if (!(error instanceof JobTransitionError) && !(error instanceof MoneyCycleError)) throw error;
    redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}`);
}

/**
 * Sends the customer the summary exactly as it appears on the page.
 *
 * The text is composed from the job's own lines and findings, and where a
 * model has tidied it the result has been checked against the record before
 * it was shown. What the staff member read is what the customer gets.
 */
async function sendSummary(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');

  const sent = await sendCustomerSummary({
    orgId,
    userId: user.userId,
    jobId,
    text: String(formData.get('text') ?? ''),
  });

  redirect(
    sent
      ? `/jobs/${jobId}?summary=sent`
      : `/jobs/${jobId}?problem=${encodeURIComponent('The customer has no email address or mobile number on file, so there is nowhere to send it.')}`,
  );
}

/**
 * The assistant, on the job. FR-4901, FR-4902.
 *
 * Two things it does here: explains where the job stands, for somebody
 * picking it up cold, and drafts a message to the customer from the job's
 * own facts. Sending is a separate press; the assistant only wrote the words.
 */
async function explain(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:read');
  const jobId = String(formData.get('jobId') ?? '');

  try {
    const { exchangeId } = await explainFor({ orgId, userId: user.userId, jobId });
    redirect(`/jobs/${jobId}?exchange=${exchangeId}#assistant`);
  } catch (error) {
    if (error instanceof AssistantError) {
      redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

async function draft(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');

  try {
    const { exchangeId } = await draftFor({
      orgId,
      userId: user.userId,
      jobId,
      kind: String(formData.get('kind') ?? '') as never,
    });
    redirect(`/jobs/${jobId}?exchange=${exchangeId}#assistant`);
  } catch (error) {
    if (error instanceof AssistantError) {
      redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

async function sendDrafted(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');

  try {
    await sendDraft({
      orgId,
      userId: user.userId,
      exchangeId: String(formData.get('exchangeId') ?? ''),
      text: String(formData.get('text') ?? ''),
    });
    redirect(`/jobs/${jobId}?summary=sent#assistant`);
  } catch (error) {
    if (error instanceof AssistantError) {
      redirect(`/jobs/${jobId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('job:read');
  const job = await db.job.findUnique({ where: { id }, select: { number: true } });
  return { title: job ? `Job #${job.number}` : 'Job' };
}

/**
 * The job screen.
 *
 * The product thesis in one page: a manager opens a job and sees the customer,
 * the vehicle, the inspection, the estimate, the approval, the labour, the
 * parts, the photographs, the invoice and the passport entries without
 * navigating between ten modules (story E1).
 */
export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sent?: string;
    problem?: string;
    summary?: string;
    exchange?: string;
    approved?: string;
    quoted?: string;
    started?: string;
    wrote?: string;
  }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const { db, user, orgId, region } = await requireSession('job:read');

  const job = await db.job.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      bay: { select: { name: true } },
      location: { select: { name: true } },
      technicians: { include: { user: { select: { id: true, name: true } } } },
      jobTypes: {
        include: { jobType: { select: { name: true, colour: true, requiresQualityCheck: true } } },
      },
      statusEvents: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { name: true } } },
      },
      tasks: { orderBy: { sortOrder: 'asc' } },
      labourLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      partLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      feeLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: 'desc' } },
      timeEntries: { include: { user: { select: { name: true } } } },
      qualityChecks: { include: { checkedBy: { select: { name: true } } } },
      inspections: {
        orderBy: { startedAt: 'desc' },
        include: {
          performedBy: { select: { name: true } },
          results: { orderBy: { sortOrder: 'asc' }, include: { photos: true } },
        },
      },
      estimates: {
        orderBy: { version: 'desc' },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          approvals: { orderBy: { createdAt: 'desc' } },
          shares: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      invoices: { orderBy: { createdAt: 'desc' }, include: { payments: true } },
    },
  });

  if (!job) notFound();

  // Cover on this vehicle that is still running and has nothing claimed
  // against it. The moment somebody needs to know is the moment the job is
  // open, not a month later when the invoice is written and the part has been
  // paid for twice.
  const [cover, misfits, arrival, conversation] = await Promise.all([
    coverWorthChecking(orgId, job.vehicle.id),
    // Only the lines worth interrupting somebody for. A screen that confirmed
    // every correct part would train them to dismiss the one that matters.
    fitmentWarningsForJob(orgId, job.id),
    arrivalFor(orgId, job.id),
    conversationForJob(orgId, job.id),
  ]);

  const reached = job.statusEvents.map((event) => event.toStatus as JobStatus);
  const stages = progressFor(job.status as JobStatus, reached);

  const lines: PriceableLine[] = [
    ...job.labourLines.map((line) => ({
      kind: 'LABOUR' as const,
      quantity: Number(line.hours),
      unitPrice: line.rate.toString(),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.partLines.map((line) => ({
      kind: 'PART' as const,
      quantity: Number(line.quantity),
      unitPrice: line.unitPrice.toString(),
      unitCost: line.unitCost.toString(),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.feeLines.map((line) => ({
      kind: 'FEE' as const,
      quantity: 1,
      unitPrice: line.amount.toString(),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
  ];

  const totals = calculateTotals(lines, region.currency);
  // The most recent one that actually has something in it. Taking the newest
  // regardless meant an inspection somebody opened and abandoned hid the
  // completed one underneath it, so the job page showed nothing was found on a
  // vehicle where ten things were.
  const inspection =
    job.inspections.find((entry) => entry.results.length > 0) ?? job.inspections[0];
  const estimate = job.estimates[0];
  const invoice = job.invoices[0];

  // Written for the customer once the work is done, from the job's own lines
  // and findings. Composed on every render rather than stored, so it always
  // matches the record it restates.
  const summary = ['COMPLETED', 'INVOICED', 'PAID'].includes(job.status)
    ? await customerSummaryFor(orgId, job.id)
    : null;

  const exchanges = await exchangesFor(orgId, { jobId: job.id, limit: 10 });
  const shown = exchanges.find((entry) => entry.id === notice.exchange) ?? null;

  const clockedMinutes = job.timeEntries.reduce((total, entry) => total + (entry.minutes ?? 0), 0);

  // Profitability. FR-613.
  //
  // Labour cost comes from clocked time at each technician's own rate, not
  // from an average: the whole point of the figure is to show when a job was
  // quoted at one skill level and done at another. Parts cost is the weighted
  // average carried on the line, which is what the stock was actually worth.
  const labourCostMinor = job.timeEntries.reduce(
    (total, entry) =>
      total + Math.round(((entry.minutes ?? 0) / 60) * Number(entry.costRate ?? 0) * 100),
    0,
  );

  const netOf = (kind: 'LABOUR' | 'PART' | 'FEE') =>
    lines.reduce(
      (total, line, index) => (line.kind === kind ? total + totals.lines[index]!.net.minor : total),
      0,
    );

  const partsCostMinor = job.partLines.reduce(
    (total, line) => total + Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
    0,
  );

  const profit = jobProfit({
    labourRevenue: money(netOf('LABOUR')),
    partsRevenue: money(netOf('PART')),
    feeRevenue: money(netOf('FEE')),
    partsCost: money(partsCostMinor),
    labourCost: money(labourCostMinor),
  });

  // A service advisor discussing price with a customer should not have the
  // margin on screen. It is the owner's number, not the counter's.
  const showsProfit = can(user.role, 'report:financial');

  const findings = inspection
    ? summarise(
        inspection.results.map((result) => ({
          id: result.id,
          sectionName: result.sectionName,
          itemName: result.itemName,
          severity: result.severity,
        })),
      )
    : null;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/jobs">All jobs</BackLink>
      </div>

      <PageHeader
        eyebrow={`Job #${job.number} · ${job.location.name}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.vehicle.make} {job.vehicle.model}
            {job.vehicle.registration ? (
              <Registration value={job.vehicle.registration} className="text-[15px]" />
            ) : null}
            <Badge tone={toneFor(job.status as JobStatus)} dot>
              {humanise(job.status as JobStatus)}
            </Badge>
          </span>
        }
        description={job.shortDescription}
        actions={
          <>
            <Link href={`/audit/Job/${job.id}`}>
              <Button variant="secondary">How this came to be</Button>
            </Link>
            <Link href={`/vehicles/${job.vehicle.id}`}>
              <Button>Vehicle passport</Button>
            </Link>
            {estimate && estimate.status === 'DRAFT' && can(user.role, 'estimate:write') ? (
              <form action={send}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="estimateId" value={estimate.id} />
                <Button type="submit" variant="primary">
                  {estimate.supplementary ? 'Send the extra-work quote' : 'Send the quote'}
                </Button>
              </form>
            ) : null}
            {estimate &&
            (estimate.status === 'DRAFT' || estimate.status === 'SENT') &&
            can(user.role, 'estimate:write') ? (
              <details className="relative">
                <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3.5 text-[13px] font-semibold shadow-xs hover:bg-(--surface-sunk)">
                  Customer approved in person
                </summary>
                <form
                  action={approve}
                  className="absolute right-0 z-20 mt-2 grid w-[22rem] max-w-[calc(100vw-2rem)] gap-3 rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4 shadow-lg"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="estimateId" value={estimate.id} />
                  <p className="text-[13px] text-(--text-soft)">
                    Every line on quote v{estimate.version} is approved under the customer&apos;s
                    name and yours. Sign if they are in front of you; leave it blank if it was on
                    the telephone.
                  </p>
                  <SignaturePad height={120} />
                  <Input
                    name="signedByName"
                    defaultValue={job.customer.displayName}
                    aria-label="Signed by"
                  />
                  <Button type="submit" variant="primary">
                    Record the approval
                  </Button>
                </form>
              </details>
            ) : null}

            {can(user.role, 'job:write') &&
            !arrival?.in &&
            !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(job.status) ? (
              <Link href={`/jobs/${job.id}/check-in`}>
                <Button variant={job.status === 'RECEIVED' ? 'primary' : 'secondary'}>
                  Check the car in
                </Button>
              </Link>
            ) : null}

            {/* The next step, and only the next step. A row of every possible
                status is a state machine drawn on the screen; one button that
                says what happens next is a job moving through a workshop. */}
            {can(user.role, 'job:write') &&
            ['RECEIVED', 'DIAGNOSED', 'APPROVED'].includes(job.status) ? (
              <form action={move}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="to" value="IN_PROGRESS" />
                <Button type="submit" variant="primary">
                  Start the work
                </Button>
              </form>
            ) : null}

            {can(user.role, 'job:write') && job.status === 'IN_PROGRESS' ? (
              <form action={move}>
                <input type="hidden" name="jobId" value={job.id} />
                <input
                  type="hidden"
                  name="to"
                  value={
                    job.jobTypes.some((entry) => entry.jobType.requiresQualityCheck)
                      ? 'QUALITY_CHECK'
                      : 'COMPLETED'
                  }
                />
                <Button type="submit" variant="primary">
                  {job.jobTypes.some((entry) => entry.jobType.requiresQualityCheck)
                    ? 'Send for quality check'
                    : 'Mark completed'}
                </Button>
              </form>
            ) : null}

            {can(user.role, 'job:write') && job.status === 'QUALITY_CHECK' ? (
              <form action={move}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="to" value="COMPLETED" />
                <Button type="submit" variant="primary">
                  Mark completed
                </Button>
              </form>
            ) : null}

            {can(user.role, 'invoice:write') && job.status === 'COMPLETED' && !invoice ? (
              <form action={issue}>
                <input type="hidden" name="jobId" value={job.id} />
                <Button type="submit" variant="primary">
                  Issue the invoice
                </Button>
              </form>
            ) : null}

            {invoice ? (
              <Link href={`/invoices/${invoice.id}`}>
                <Button variant={invoice.status === 'PAID' ? 'secondary' : 'primary'}>
                  {invoice.status === 'PAID' ? `Invoice ${invoice.number}` : 'Take payment'}
                </Button>
              </Link>
            ) : null}

            {can(user.role, 'job:write') &&
            !arrival?.out &&
            ['COMPLETED', 'INVOICED', 'PAID'].includes(job.status) ? (
              <Link href={`/jobs/${job.id}/check-out`}>
                <Button variant={job.status === 'PAID' ? 'primary' : 'secondary'}>
                  Hand the car back
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {notice.sent ? (
        <Alert tone="success" className="mb-5">
          The quote is on its way to {job.customer.displayName}. The job is waiting on their answer,
          and you will see it here the moment they give one.
        </Alert>
      ) : null}

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {notice.problem}
        </Alert>
      ) : null}

      {notice.wrote ? (
        <Alert tone="success" className="mb-5">
          Sent to {job.customer.displayName}. It is on the conversation below with what became of
          it.
        </Alert>
      ) : null}

      {notice.started ? (
        <Alert tone="success" className="mb-5">
          The job is open, with everything from the booking on it. The technician can start.
        </Alert>
      ) : null}

      {notice.approved ? (
        <Alert tone="success" className="mb-5">
          Approval recorded under {job.customer.displayName}&apos;s name. The approved work is on
          the job and any part on your books is reserved, or on the purchase list if you are short.
        </Alert>
      ) : null}

      {notice.quoted === 'sent' ? (
        <Alert tone="success" className="mb-5">
          The extra work is quoted and on its way to {job.customer.displayName}. The work already
          approved carries on; their answer will add to it.
        </Alert>
      ) : notice.quoted ? (
        <Alert tone="success" className="mb-5">
          Added to the extra-work quote. Add more, or send it.
        </Alert>
      ) : null}

      {notice.summary === 'sent' ? (
        <Alert tone="success" className="mb-5">
          The summary is on its way to {job.customer.displayName}, word for word as it appears
          below.
        </Alert>
      ) : null}

      {misfits.length > 0 ? (
        <Alert
          tone={
            misfits.some((entry) => entry.result.verdict === 'DOES_NOT_FIT') ? 'danger' : 'warning'
          }
          title="Check these parts against this vehicle"
          className="mb-5"
        >
          <ul className="mt-1 grid gap-1">
            {misfits.map((entry) => (
              <li key={entry.lineId}>
                <strong className="font-semibold">{entry.description}</strong> {entry.result.why}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {cover.length > 0 ? (
        <Alert tone="info" title="This vehicle has work still under warranty" className="mb-5">
          <ul className="mt-1 grid gap-1">
            {cover.map((entry) => (
              <li key={entry.id}>
                <strong className="font-semibold">{entry.description}</strong>, fitted on job{' '}
                <Link href={`/jobs/${entry.jobId}`} className="underline">
                  #{entry.jobNumber}
                </Link>{' '}
                on {entry.startedOn.toLocaleDateString(region.locale)}.
                {entry.supplierName
                  ? ` ${entry.supplierName} still covers the part, so check before charging for it.`
                  : ' No supplier behind it, so any replacement falls on the workshop.'}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {job.status === 'AWAITING_APPROVAL' ? (
        <Alert tone="warning" title="Waiting on the customer" className="mb-5">
          Work cannot proceed until the estimate is approved. Sent
          {estimate?.sentAt
            ? ` ${estimate.sentAt.toLocaleString(region.locale, { dateStyle: 'medium', timeStyle: 'short' })}`
            : ' but not yet delivered'}
          .
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------- main column ---------------- */}
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Vehicle and customer" />
            <CardBody>
              <KeyValue
                columns={3}
                items={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/customers/${job.customer.id}`} className="hover:underline">
                        {job.customer.displayName}
                      </Link>
                    ),
                  },
                  { label: 'Contact', value: job.customer.mobile ?? job.customer.phone },
                  { label: 'Email', value: job.customer.email },
                  {
                    label: 'Vehicle',
                    value: (
                      <Link href={`/vehicles/${job.vehicle.id}`} className="hover:underline">
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </Link>
                    ),
                  },
                  { label: 'VIN', value: <Vin value={job.vehicle.vin} /> },
                  {
                    label: 'Odometer in',
                    value: <Mileage locale={region.locale} km={job.odometerInKm} />,
                  },
                  {
                    label: 'Technician',
                    value: job.technicians.map((t) => t.user.name).join(', ') || 'Unassigned',
                  },
                  { label: 'Bay', value: job.bay?.name },
                  {
                    label: 'Promised',
                    value: job.promisedAt
                      ? job.promisedAt.toLocaleString(region.locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : null,
                  },
                  { label: 'Customer order number', value: job.customerOrderNumber },
                  {
                    label: 'Job types',
                    value: job.jobTypes.map((t) => t.jobType.name).join(', ') || null,
                  },
                  {
                    label: 'Clocked time',
                    value:
                      clockedMinutes > 0 ? `${(clockedMinutes / 60).toFixed(1)} h actual` : null,
                  },
                ]}
              />

              {job.diagnosis ? (
                <div className="mt-5 border-t border-(--border) pt-4">
                  <p className="eyebrow mb-1">Diagnosis</p>
                  <p className="text-[13px] leading-relaxed">{job.diagnosis}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {inspection && findings ? (
            <Card>
              <CardHeader
                title="Inspection"
                description={
                  inspection.performedBy
                    ? `${inspection.performedBy.name} · ${inspection.status === 'COMPLETED' ? 'completed' : 'in progress'}`
                    : undefined
                }
                action={
                  <SeveritySummary
                    pass={findings.pass}
                    advisory={findings.advisory}
                    critical={findings.critical}
                  />
                }
              />
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Section</Th>
                      <Th>Item</Th>
                      <Th>Measurement</Th>
                      <Th>Finding</Th>
                      <Th>Recommended</Th>
                      <Th numeric>Estimate</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspection.results
                      .filter((result) => result.severity !== 'PASS')
                      .map((result) => (
                        <Tr key={result.id}>
                          <Td className="text-(--text-faint)">{result.sectionName}</Td>
                          <Td className="font-medium">{result.itemName}</Td>
                          <Td className="datum text-(--text-soft)">
                            {result.measurementValue !== null
                              ? `${result.measurementValue} ${measurementUnit(result.measurementType)}`
                              : '—'}
                          </Td>
                          <Td>
                            <SeverityBadge severity={result.severity} />
                          </Td>
                          <Td className="max-w-[16rem] text-(--text-soft)">
                            {result.recommendedAction ?? result.note ?? '—'}
                            {result.photos.length > 0 ? (
                              <span className="ml-1.5 text-[11px] text-(--text-faint)">
                                ({result.photos.length} photo
                                {result.photos.length === 1 ? '' : 's'})
                              </span>
                            ) : null}
                          </Td>
                          <Td numeric>
                            {result.estimatedCost ? (
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={Number(result.estimatedCost)}
                              />
                            ) : (
                              '—'
                            )}
                          </Td>
                        </Tr>
                      ))}
                  </tbody>
                </Table>
              </TableWrap>
              {findings.allClear ? (
                <CardBody className="text-[13px] text-(--text-soft)">
                  Everything checked passed. {findings.pass} items inspected.
                </CardBody>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Labour and parts"
              description="Charged at book time; costed at clocked time."
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Unit</Th>
                    <Th numeric>Net</Th>
                    <Th numeric>Tax</Th>
                    <Th numeric>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {job.labourLines.map((line, index) => (
                    <Tr key={line.id}>
                      <Td>
                        <span className="eyebrow mr-2">Labour</span>
                        {line.description}
                      </Td>
                      <Td numeric>{Number(line.hours).toFixed(2)} h</Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(line.rate)}
                        />
                      </Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(totals.lines[index]!.net)}
                        />
                      </Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(totals.lines[index]!.tax)}
                        />
                      </Td>
                      <Td numeric className="font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(totals.lines[index]!.total)}
                        />
                      </Td>
                    </Tr>
                  ))}
                  {job.partLines.map((line, index) => {
                    const computed = totals.lines[job.labourLines.length + index]!;
                    return (
                      <Tr key={line.id}>
                        <Td>
                          <span className="eyebrow mr-2">Part</span>
                          {line.description}
                          {line.partNumber ? (
                            <span className="datum ml-2 text-[11px] text-(--text-faint)">
                              {line.partNumber}
                            </span>
                          ) : null}
                        </Td>
                        <Td numeric>{Number(line.quantity)}</Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={Number(line.unitPrice)}
                          />
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.net)}
                          />
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.tax)}
                          />
                        </Td>
                        <Td numeric className="font-medium">
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.total)}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                  {job.feeLines.map((line, index) => {
                    const computed =
                      totals.lines[job.labourLines.length + job.partLines.length + index]!;
                    return (
                      <Tr key={line.id}>
                        <Td>
                          <span className="eyebrow mr-2">Fee</span>
                          {line.description}
                        </Td>
                        <Td numeric>1</Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={Number(line.amount)}
                          />
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.net)}
                          />
                        </Td>
                        <Td numeric>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.tax)}
                          />
                        </Td>
                        <Td numeric className="font-medium">
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(computed.total)}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-(--surface-sunk)">
                    <Td colSpan={3} className="font-medium">
                      Total
                    </Td>
                    <Td numeric className="font-medium">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(totals.subtotal)}
                      />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(totals.taxTotal)}
                      />
                    </Td>
                    <Td numeric className="font-display text-[15px] font-semibold">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(totals.total)}
                      />
                    </Td>
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          </Card>

          {can(user.role, 'estimate:write') &&
          !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED', 'DRAFT', 'BOOKED'].includes(
            job.status,
          ) ? (
            <Card id="extra">
              <CardHeader
                title="Extra work found"
                description="Something seen with the car up on the ramp. Quote it from here; the work already approved carries on while the customer decides."
              />
              <CardBody className="grid gap-4">
                {estimate?.supplementary && estimate.status === 'DRAFT' ? (
                  <div className="rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) px-3.5 py-3 text-[13px]">
                    <p className="mb-1.5 font-medium">
                      On the extra-work quote (v{estimate.version}), not yet sent
                    </p>
                    <ul className="grid gap-1">
                      {estimate.lines.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3">
                          <span>
                            <span className="eyebrow mr-2">{line.kind.toLowerCase()}</span>
                            {line.description}
                            {line.detail ? (
                              <span className="ml-1 text-(--text-faint)">({line.detail})</span>
                            ) : null}
                          </span>
                          <Money
                            amount={Number(line.lineTotal)}
                            currency={estimate.currency}
                            locale={region.locale}
                          />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={send}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="estimateId" value={estimate.id} />
                        <Button type="submit" variant="primary" size="sm">
                          Send it to {job.customer.displayName}
                        </Button>
                      </form>
                      <form action={approve}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="estimateId" value={estimate.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Approved in person
                        </Button>
                      </form>
                    </div>
                  </div>
                ) : null}

                <form action={extra} className="grid gap-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <Field label="What kind">
                      <Select name="kind" defaultValue="LABOUR">
                        <option value="LABOUR">Labour</option>
                        <option value="PART">Part</option>
                        <option value="FEE">Fee</option>
                      </Select>
                    </Field>
                    <Field label="What was found" hint="As the customer will read it.">
                      <Input
                        name="description"
                        placeholder="Rear brake pads worn to 2 mm, replace"
                        maxLength={200}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="How many, or hours">
                      <Input
                        name="quantity"
                        type="number"
                        step="0.25"
                        min="0.25"
                        defaultValue="1"
                      />
                    </Field>
                    <Field
                      label={`Unit price (${region.currency})`}
                      hint="Blank takes the part's price."
                    >
                      <Input name="unitPrice" type="number" step="0.01" min="0" />
                    </Field>
                    <Field label="Part number" hint="From your parts; reserved on approval.">
                      <Input name="partNumber" placeholder="optional" maxLength={64} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" name="send" value="1" variant="primary">
                      Quote it now
                    </Button>
                    <Button type="submit" name="send" value="0" variant="secondary">
                      Add to the quote, send later
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {job.tasks.length > 0 ? (
            <Card>
              <CardHeader
                title="Tasks"
                description={`${job.tasks.filter((t) => t.isDone).length} of ${job.tasks.length} complete`}
              />
              <ul className="divide-y divide-(--border)">
                {job.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      aria-hidden
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border text-[10px] font-bold ${
                        task.isDone
                          ? 'border-(--success) bg-(--success) text-white'
                          : 'border-(--border-strong)'
                      }`}
                    >
                      {task.isDone ? '✓' : ''}
                    </span>
                    <span
                      className={`text-[13px] ${task.isDone ? 'text-(--text-faint) line-through' : ''}`}
                    >
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card id="assistant">
            <CardHeader
              title="Assistant"
              description="Reads the job back, or drafts a message from it. It writes; you send."
            />
            <CardBody className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <form action={explain}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Where does this job stand?
                  </Button>
                </form>
                {can(user.role, 'job:write') ? (
                  <form action={draft} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <select
                      name="kind"
                      aria-label="Kind of message to draft"
                      defaultValue={
                        job.status === 'AWAITING_APPROVAL'
                          ? 'WAITING_ON_APPROVAL'
                          : ['COMPLETED', 'INVOICED', 'QUALITY_CHECK'].includes(job.status)
                            ? 'READY'
                            : 'PROGRESS'
                      }
                      className="h-8 rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 text-[13px]"
                    >
                      {DRAFT_KINDS.map((entry) => (
                        <option key={entry.kind} value={entry.kind}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" size="sm">
                      Draft a message
                    </Button>
                  </form>
                ) : null}
              </div>

              {shown ? (
                <div className="grid gap-2 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-3">
                  <p className="text-[12px] text-(--text-soft)">{describeExchange(shown)}</p>
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-(--text)">
                    {shown.reply}
                  </pre>
                  {shown.kind === 'DRAFT' && !shown.sentMessageId && can(user.role, 'job:write') ? (
                    <form action={sendDrafted} className="grid gap-2">
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="exchangeId" value={shown.id} />
                      <textarea
                        name="text"
                        defaultValue={shown.reply}
                        rows={4}
                        aria-label="The message as it will be sent"
                        className="w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) p-2 text-[13px] leading-relaxed"
                      />
                      <div className="flex justify-end">
                        <Button type="submit" variant="primary" size="sm">
                          Send this to {job.customer.displayName.split(' ')[0]}
                        </Button>
                      </div>
                    </form>
                  ) : shown.sentMessageId ? (
                    <p className="text-[12px] text-(--success)">Sent.</p>
                  ) : null}
                </div>
              ) : null}

              {exchanges.length > 0 ? (
                <ul className="divide-y divide-(--border) text-[12px] text-(--text-soft)">
                  {exchanges.slice(0, 5).map((exchange) => (
                    <li key={exchange.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <Link
                        href={`/jobs/${job.id}?exchange=${exchange.id}#assistant`}
                        className="font-medium text-(--text) hover:underline"
                      >
                        {exchange.prompt}
                      </Link>
                      <span>{exchange.user?.name ?? 'Somebody'}</span>
                      <span className="datum">
                        {exchange.createdAt.toLocaleString(region.locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {exchange.sentMessageId ? (
                        <Badge tone="success" size="sm">
                          sent
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          {summary ? (
            <Card>
              <CardHeader
                title="Summary for the customer"
                description={
                  summary.polished
                    ? 'Tidied by a model and checked against the job: every figure in it is on the record.'
                    : summary.rejected
                      ? `Plain version. ${summary.rejected}`
                      : 'Composed from the job’s own lines and findings. Nothing here is not on the record.'
                }
              />
              <CardBody className="grid gap-3">
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-(--text)">
                  {summary.text}
                </pre>
                {can(user.role, 'job:write') ? (
                  <form action={sendSummary} className="flex justify-end">
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="text" value={summary.text} />
                    <Button type="submit" variant="secondary">
                      Send this to {job.customer.displayName.split(' ')[0]}
                    </Button>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {job.notes.length > 0 ? (
            <Card>
              <CardHeader title="Notes" />
              <ul className="divide-y divide-(--border)">
                {job.notes.map((note) => (
                  <li key={note.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium">
                        {note.author?.name ?? 'System'}
                      </span>
                      <time className="datum text-[11px] text-(--text-faint)">
                        {note.createdAt.toLocaleString(region.locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                      {note.isCustomerVisible ? (
                        <Badge tone="info" size="sm">
                          Customer sees this
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed">{note.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ---------------- side column ---------------- */}
        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Progress" />
            <CardBody>
              <ProgressTrail stages={stages} />
            </CardBody>
          </Card>

          <Card id="keys">
            <CardHeader
              title="Arrival and keys"
              action={
                <Badge
                  tone={
                    arrival?.keys.where === 'hook'
                      ? 'success'
                      : arrival?.keys.where === 'with'
                        ? 'info'
                        : arrival?.keys.where === 'customer'
                          ? 'neutral'
                          : 'warning'
                  }
                  dot
                >
                  {arrival?.keys.where === 'hook'
                    ? `hook ${arrival.keys.hook ?? '?'}`
                    : arrival?.keys.where === 'with'
                      ? `with ${arrival.keys.holder ?? 'somebody'}`
                      : arrival?.keys.where === 'customer'
                        ? 'keys returned'
                        : 'keys not noted'}
                </Badge>
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              {arrival?.in ? (
                <p className="text-(--text-soft)">
                  Checked in{' '}
                  {arrival.in.at.toLocaleString(region.locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {arrival.in.odometerKm !== null
                    ? ` at ${arrival.in.odometerKm.toLocaleString(region.locale)} km`
                    : ''}
                  , fuel {fuelLabel(arrival.in.fuelEighths)}, {arrival.in.damage.length} mark
                  {arrival.in.damage.length === 1 ? '' : 's'} noted
                  {arrival.in.photos.length
                    ? `, ${arrival.in.photos.length} photo${arrival.in.photos.length === 1 ? '' : 's'}`
                    : ''}
                  {arrival.in.signedBy ? `, signed by ${arrival.in.signedBy}` : ', not signed'}.{' '}
                  <Link href={`/jobs/${job.id}/check-in`} className="underline">
                    The record
                  </Link>
                </p>
              ) : (
                <p className="text-(--text-faint)">Not checked in.</p>
              )}
              {arrival?.out ? (
                <p className="text-(--text-soft)">
                  Handed back{' '}
                  {arrival.out.at.toLocaleString(region.locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {arrival.out.odometerKm !== null
                    ? ` at ${arrival.out.odometerKm.toLocaleString(region.locale)} km`
                    : ''}
                  {arrival.out.signedBy ? `, signed by ${arrival.out.signedBy}` : ''}
                  {arrival.out.letGoOwingReason
                    ? `, left owing: ${arrival.out.letGoOwingReason}`
                    : ''}
                  .{' '}
                  <Link href={`/jobs/${job.id}/check-out`} className="underline">
                    The record
                  </Link>
                </p>
              ) : null}
              {can(user.role, 'job:write') && !arrival?.out ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-(--border) pt-3">
                  {arrival?.keys.where === 'hook' || arrival?.keys.where === 'unknown' ? (
                    <form action={keys}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="action" value="TAKEN" />
                      <Button type="submit" size="sm" variant="secondary">
                        I have the keys
                      </Button>
                    </form>
                  ) : null}
                  {arrival?.keys.where === 'with' ? (
                    <form action={keys}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="action" value="RETURNED" />
                      <Button type="submit" size="sm" variant="secondary">
                        Keys back on hook {arrival.keys.hook ?? ''}
                      </Button>
                    </form>
                  ) : null}
                  {arrival?.keys.where !== 'with' ? (
                    <form action={keys} className="flex items-end gap-1.5">
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="action" value="HUNG" />
                      <Input
                        name="hook"
                        placeholder="hook"
                        aria-label="Hook"
                        className="h-8 w-16 text-[13px]"
                        defaultValue={arrival?.keys.hook ?? ''}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        Hang
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card id="conversation">
            <CardHeader
              title="Conversation"
              description={
                conversation
                  ? `${conversation.entries.length} message${conversation.entries.length === 1 ? '' : 's'}${conversation.unread ? ', unread' : ''}`
                  : undefined
              }
              action={
                conversation ? (
                  <Link href={`/inbox?c=${conversation.id}`} className="text-[12px] underline">
                    Whole thread
                  </Link>
                ) : null
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              {conversation && conversation.entries.length > 0 ? (
                <div className="grid gap-2">
                  {conversation.entries.slice(-3).map((entry) => (
                    <div
                      key={entry.id}
                      className={[
                        'rounded-(--radius-md) px-3 py-2',
                        entry.direction === 'out'
                          ? 'ml-4 bg-(--brand-soft)'
                          : 'mr-4 border border-(--border)',
                      ].join(' ')}
                    >
                      <p className="line-clamp-3 whitespace-pre-wrap leading-relaxed">
                        {entry.body}
                      </p>
                      <p className="mt-1 text-[11px] text-(--text-faint)">
                        {entry.direction === 'out' ? 'Sent' : 'Received'} ·{' '}
                        {channelLabel(entry.channel)} ·{' '}
                        {entry.at.toLocaleString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {entry.state === 'failed' ? ' · did not arrive' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-(--text-faint)">Nothing said yet on this job.</p>
              )}
              {conversation &&
              conversation.channels.length > 0 &&
              can(user.role, 'customer:write') ? (
                <form action={write} className="grid gap-2 border-t border-(--border) pt-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="conversationId" value={conversation.id} />
                  <Textarea
                    name="body"
                    rows={2}
                    required
                    placeholder={`A word to ${job.customer.displayName}…`}
                  />
                  <div className="flex items-center gap-2">
                    <Select
                      name="channel"
                      defaultValue={conversation.preferred ?? conversation.channels[0]}
                      className="h-8 w-32 text-[12px]"
                    >
                      {conversation.channels.map((c) => (
                        <option key={c} value={c}>
                          {channelLabel(c)}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" size="sm" variant="primary">
                      Send
                    </Button>
                  </div>
                </form>
              ) : conversation && conversation.channels.length === 0 ? (
                <p className="text-(--text-faint)">
                  No email address or mobile number on file, so there is nowhere to write to.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {estimate ? (
            <Card>
              <CardHeader
                title={
                  estimate.supplementary
                    ? `Extra work, quote v${estimate.version}`
                    : `Estimate v${estimate.version}`
                }
                action={
                  <Badge
                    tone={
                      estimate.status === 'APPROVED'
                        ? 'success'
                        : estimate.status === 'DECLINED'
                          ? 'danger'
                          : estimate.status === 'SENT'
                            ? 'warning'
                            : 'neutral'
                    }
                    dot
                  >
                    {estimate.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                }
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Subtotal</span>
                  <Money amount={Number(estimate.subtotal)} currency={estimate.currency} />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Tax</span>
                  <Money amount={Number(estimate.taxTotal)} currency={estimate.currency} />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-display text-[16px] font-semibold">
                  <span>Total</span>
                  <Money amount={Number(estimate.total)} currency={estimate.currency} />
                </div>

                {estimate.approvals[0] ? (
                  <div className="mt-2 rounded-(--radius-sm) bg-(--success-soft) px-2.5 py-2 text-[12px] text-(--success)">
                    <p className="font-semibold">
                      {estimate.approvals[0].decision === 'APPROVED'
                        ? 'Approved'
                        : estimate.approvals[0].decision === 'DECLINED'
                          ? 'Declined'
                          : 'Partly approved'}
                      {estimate.approvals[0].approvedByName
                        ? ` by ${estimate.approvals[0].approvedByName}`
                        : ''}
                    </p>
                    <p className="datum mt-0.5 text-[11px]">
                      {estimate.approvals[0].createdAt.toLocaleString(region.locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {invoice ? (
            <Card>
              <CardHeader
                title={`Invoice ${invoice.number}`}
                action={
                  <Badge tone={invoice.status === 'PAID' ? 'success' : 'warning'} dot>
                    {invoice.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                }
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Total</span>
                  <Money amount={Number(invoice.total)} currency={invoice.currency} />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Paid</span>
                  <Money amount={Number(invoice.amountPaid)} currency={invoice.currency} />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-medium">
                  <span>Outstanding</span>
                  <Money
                    amount={Number(invoice.total) - Number(invoice.amountPaid)}
                    currency={invoice.currency}
                  />
                </div>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="mt-1 text-[13px] text-(--brand-text) hover:underline"
                >
                  Open the invoice
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {job.qualityChecks.length > 0 ? (
            <Card>
              <CardHeader title="Quality control" />
              <CardBody className="text-[13px]">
                {job.qualityChecks.map((check) => (
                  <div key={check.id} className="flex items-center gap-2">
                    <Badge tone={check.passed ? 'success' : 'danger'} dot>
                      {check.passed ? 'Passed' : 'Failed'}
                    </Badge>
                    <span className="text-(--text-soft)">{check.checkedBy.name}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {showsProfit ? (
            <Card>
              <CardHeader
                title="Profitability"
                description="Clocked time at cost, parts at what the stock was worth"
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Revenue, net of tax</span>
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={toNumber(profit.revenue)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Parts at cost</span>
                  <span className="tabular text-(--text-soft)">
                    &minus;
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={toNumber(profit.partsCost)}
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">
                    Labour at cost
                    <span className="ml-1 text-[11px]">
                      {(clockedMinutes / 60).toFixed(1)}h clocked
                    </span>
                  </span>
                  <span className="tabular text-(--text-soft)">
                    &minus;
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={toNumber(profit.labourCost)}
                    />
                  </span>
                </div>

                <div className="mt-1 flex items-baseline justify-between border-t border-(--border) pt-2">
                  <span className="font-medium">Gross profit</span>
                  <span className="text-right">
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={toNumber(profit.grossProfit)}
                      className={`font-display text-[20px] font-semibold ${
                        profit.grossProfit.minor < 0 ? 'text-(--danger)' : 'text-(--brand-text)'
                      }`}
                    />
                    {profit.marginPct === null ? null : (
                      <span className="tabular block text-[11px] text-(--text-faint)">
                        {profit.marginPct}% margin
                      </span>
                    )}
                  </span>
                </div>

                {profit.partsMarginPct !== null ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                    Parts alone returned {profit.partsMarginPct}%. This is where margin leaks
                    quietly: a discount given at the counter never shows up in the labour figure.
                  </p>
                ) : null}

                {clockedMinutes === 0 ? (
                  <p className="rounded-(--radius-sm) bg-(--warning-soft) px-2.5 py-2 text-[12px] leading-relaxed text-(--warning)">
                    No time has been clocked against this job, so labour cost is zero and this
                    margin is flattering. Treat it as revenue less parts, nothing more.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="History" />
            <ul className="divide-y divide-(--border) text-[12px]">
              {job.statusEvents
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="px-4 py-2">
                    <p className="font-medium">{humanise(event.toStatus as JobStatus)}</p>
                    <p className="text-(--text-faint)">
                      {event.actor?.name ?? 'System'} ·{' '}
                      <time className="datum">
                        {event.createdAt.toLocaleString(region.locale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </p>
                  </li>
                ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

function measurementUnit(type: string): string {
  switch (type) {
    case 'TREAD_DEPTH_MM':
    case 'PAD_THICKNESS_MM':
    case 'DISC_THICKNESS_MM':
    case 'MM':
      return 'mm';
    case 'PERCENT':
      return '%';
    case 'VOLTAGE':
      return 'V';
    case 'PRESSURE_BAR':
      return 'bar';
    case 'TEMPERATURE_C':
      return 'C';
    default:
      return '';
  }
}
