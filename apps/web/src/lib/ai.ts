import { customerSummary, type SummaryFacts, verifyAgainstFacts } from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { pushNow } from './outbound';

/**
 * Generated text, kept on a short lead.
 *
 * Three uses were planned, in the order they can be trusted. The first two are
 * here: a job summary for the customer, and revenue observations (which need
 * no model at all and live in `answers.ts`). The third, a service adviser
 * suggesting where to look, is deliberately absent. It needs a corpus of
 * symptoms against confirmed causes that does not exist yet, and a confident
 * wrong suggestion on a braking fault is not a small error.
 *
 * The model is a port, the way mail is. With no key configured the summary is
 * the plain one composed from the record, and that is a complete feature, not
 * a degraded one. With a key, the model may make the sentences read better;
 * its output is then checked against the record and thrown away if it says
 * anything the record does not.
 */

export interface Composed {
  text: string;
  /** Whether a model touched it. False when none is configured or it was refused. */
  polished: boolean;
  /** Why the model's version was not used, when it was not. */
  rejected: string | null;
}

/** The facts a summary may restate, straight from the job. */
export async function summaryFactsFor(orgId: string, jobId: string): Promise<SummaryFacts | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      odometerOutKm: true,
      odometerInKm: true,
      customer: { select: { displayName: true } },
      org: { select: { name: true } },
      vehicle: { select: { make: true, model: true, year: true, registration: true } },
      labourLines: { orderBy: { sortOrder: 'asc' }, select: { description: true, hours: true } },
      partLines: {
        orderBy: { sortOrder: 'asc' },
        select: { description: true, partNumber: true, quantity: true },
      },
      invoices: {
        where: { status: { not: 'VOID' } },
        take: 1,
        select: { total: true, currency: true },
      },
      estimates: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { lines: { where: { decision: 'DECLINED' }, select: { description: true } } },
      },
      inspections: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: {
          results: {
            where: { severity: { in: ['ADVISORY', 'CRITICAL'] } },
            orderBy: { sortOrder: 'asc' },
            select: { itemName: true, severity: true, note: true },
          },
        },
      },
    },
  });

  if (!job) return null;

  const invoice = job.invoices[0];

  return {
    customerFirstName: job.customer.displayName.split(' ')[0] ?? job.customer.displayName,
    vehicle:
      [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ') ||
      'vehicle',
    registration: job.vehicle.registration,
    odometerKm: job.odometerOutKm ?? job.odometerInKm,
    labour: job.labourLines.map((line) => ({
      description: line.description,
      hours: Number(line.hours),
    })),
    parts: job.partLines.map((line) => ({
      description: line.description,
      partNumber: line.partNumber,
      quantity: Number(line.quantity),
    })),
    findings:
      job.inspections[0]?.results.map((result) => ({
        item: result.itemName,
        severity: result.severity as SummaryFacts['findings'][number]['severity'],
        note: result.note,
      })) ?? [],
    declined: job.estimates[0]?.lines.map((line) => line.description) ?? [],
    total: invoice
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(
          Number(invoice.total),
        )
      : null,
    workshopName: job.org.name,
  };
}

/** The summary for a job: plain, or polished and checked. */
export async function customerSummaryFor(orgId: string, jobId: string): Promise<Composed | null> {
  const facts = await summaryFactsFor(orgId, jobId);
  if (!facts) return null;

  const plain = customerSummary(facts);
  const polished = await polish(plain, facts);

  return polished;
}

/**
 * Lets a model tidy the prose, then checks it did not add a fact.
 *
 * The prompt hands the model the plain summary and asks for the same content
 * in better sentences. Whatever comes back is checked: every number and part
 * number must appear in the record. A model that adds a torque figure, a
 * part number or a price is refused and the plain text is used. Silence, a
 * missing key, a timeout or a non-200 all mean the same thing: the plain text.
 */
async function polish(plain: string, facts: SummaryFacts): Promise<Composed> {
  const transport = process.env.AI_TRANSPORT ?? 'none';
  const key = process.env.ANTHROPIC_API_KEY;

  if (transport !== 'anthropic' || !key) {
    return { text: plain, polished: false, rejected: null };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? 'claude-sonnet-5',
        max_tokens: 600,
        system:
          'You rewrite a workshop job summary for the customer so it reads naturally. Keep every fact exactly as given. Do not add any number, price, part number, measurement, recommendation or reassurance that is not in the text. Do not remove the closing line. Plain text, no headings, no markdown.',
        messages: [{ role: 'user', content: plain }],
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { text: plain, polished: false, rejected: `The model answered ${response.status}.` };
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((part) => part.type === 'text')?.text?.trim();

    if (!text) return { text: plain, polished: false, rejected: 'The model returned nothing.' };

    const check = verifyAgainstFacts(text, facts);

    if (!check.ok) {
      return {
        text: plain,
        polished: false,
        rejected: `The model added figures the job does not have: ${check.unsupported.join(', ')}.`,
      };
    }

    return { text, polished: true, rejected: null };
  } catch (error) {
    return {
      text: plain,
      polished: false,
      rejected: error instanceof Error ? error.message : 'The model could not be reached.',
    };
  }
}

/** Sends the summary to the customer, as it is on the screen. */
export async function sendCustomerSummary(input: {
  orgId: string;
  userId: string;
  jobId: string;
  text: string;
}): Promise<boolean> {
  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      number: true,
      customer: { select: { email: true, mobile: true } },
      org: { select: { name: true } },
      vehicle: { select: { make: true, model: true } },
    },
  });

  const channel = job.customer.email ? 'EMAIL' : job.customer.mobile ? 'SMS' : null;
  if (!channel) return false;

  const queued = await prisma.messageLog.create({
    data: {
      orgId: input.orgId,
      channel,
      toAddress: (channel === 'EMAIL' ? job.customer.email : job.customer.mobile)!,
      subject: `What we did on your ${[job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ')} (job ${job.number})`,
      body: input.text,
      status: 'QUEUED',
      relatedType: 'Job',
      relatedId: input.jobId,
    },
    select: { id: true },
  });

  await pushNow(queued.id);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.summary_sent',
    entityType: 'Job',
    entityId: input.jobId,
    after: { channel, characters: input.text.length },
  });

  return true;
}
