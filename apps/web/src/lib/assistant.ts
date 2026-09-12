import {
  type AssistantKind,
  assistantBudget,
  type BudgetDecision,
  DRAFT_KINDS,
  draftAllowances,
  type DraftFacts,
  type DraftKind,
  draftMessage,
  estimateCostMinor,
  explainJob,
  formatClock,
  type JobStory,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { compose, summaryFactsFor } from './ai';
import { answer } from './answers';
import { audit } from './guard';
import { pushNow } from './outbound';

/**
 * The assistant, against the database. Phase 22.
 *
 * Every exchange is recorded with what it cost, so an owner can see what the
 * assistant is doing and spending. A question is routed exactly as the Ask
 * page routes it. A draft or an explanation is composed from the job's facts
 * in core; a model may tidy it when one is configured and the month's budget
 * allows, and its version is checked against the same facts before anybody
 * sees it. Nothing here changes a job, posts to the ledger or sends a message
 * without a person pressing the button that does that.
 */

export class AssistantError extends Error {
  constructor(
    readonly code: 'NO_JOB' | 'EMPTY' | 'ALREADY_SENT' | 'NO_ADDRESS' | 'BAD_KIND',
    message: string,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

/** The same formatting the summary facts use, so figures compare token for token. */
function gbp(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function monthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Tokens spent this month against the organisation's budget. */
export async function budgetFor(orgId: string, now = new Date()): Promise<BudgetDecision> {
  const [org, used] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { assistantTokenBudget: true },
    }),
    prisma.assistantExchange.aggregate({
      where: { orgId, createdAt: { gte: monthStart(now) } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  return assistantBudget({
    monthlyTokenBudget: org.assistantTokenBudget,
    usedInputTokens: used._sum.inputTokens ?? 0,
    usedOutputTokens: used._sum.outputTokens ?? 0,
  });
}

async function record(input: {
  orgId: string;
  userId: string;
  kind: AssistantKind;
  prompt: string;
  reply: string;
  usage: { model: string | null; inputTokens: number; outputTokens: number };
  polished: boolean;
  rejected: string | null;
  relatedType?: string;
  relatedId?: string;
}) {
  const exchange = await prisma.assistantExchange.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      kind: input.kind,
      prompt: input.prompt.slice(0, 2000),
      reply: input.reply,
      model: input.usage.model,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      polished: input.polished,
      rejected: input.rejected,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'assistant.exchange',
    entityType: input.relatedType ?? 'Organization',
    entityId: input.relatedId ?? input.orgId,
    after: {
      exchangeId: exchange.id,
      kind: input.kind,
      model: input.usage.model,
      tokens: input.usage.inputTokens + input.usage.outputTokens,
      polished: input.polished,
    },
  });

  return exchange.id;
}

/** A question in words, routed as the Ask page routes it, and recorded. */
export async function askAssistant(input: { orgId: string; userId: string; question: string }) {
  const question = input.question.trim();
  if (!question) throw new AssistantError('EMPTY', 'Ask something.');

  const asked = await answer(input.orgId, question);
  const reply = asked.answer
    ? [asked.answer.headline, ...asked.answer.reasoning].join('\n')
    : (asked.refusal ?? 'The records cannot answer that.');

  const exchangeId = await record({
    orgId: input.orgId,
    userId: input.userId,
    kind: 'QUESTION',
    prompt: question,
    reply,
    usage: { model: null, inputTokens: 0, outputTokens: 0 },
    polished: false,
    rejected: null,
  });

  return { exchangeId, asked };
}

/** The facts a draft may use: the summary facts plus the job's state. */
export async function draftFactsFor(orgId: string, jobId: string): Promise<DraftFacts | null> {
  const [facts, job] = await Promise.all([
    summaryFactsFor(orgId, jobId),
    prisma.job.findFirst({
      where: { id: jobId, orgId },
      select: {
        number: true,
        status: true,
        promisedAt: true,
        location: { select: { closesAtMinute: true } },
        estimates: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { total: true, status: true },
        },
      },
    }),
  ]);
  if (!facts || !job) return null;

  const estimate = job.estimates[0];
  return {
    ...facts,
    jobNumber: job.number,
    status: job.status,
    promisedAt: job.promisedAt,
    estimateTotal: estimate && estimate.status !== 'DRAFT' ? gbp(Number(estimate.total)) : null,
    closesAt: formatClock(job.location.closesAtMinute),
  };
}

/**
 * A message to the customer, drafted from the job. Shown to a person; sent
 * only by `sendDraft`, which is a separate press.
 */
export async function draftFor(input: {
  orgId: string;
  userId: string;
  jobId: string;
  kind: DraftKind;
}) {
  if (!DRAFT_KINDS.some((entry) => entry.kind === input.kind)) {
    throw new AssistantError('BAD_KIND', 'That is not a kind of message the assistant drafts.');
  }

  const facts = await draftFactsFor(input.orgId, input.jobId);
  if (!facts) throw new AssistantError('NO_JOB', 'That job is not in this workshop.');

  const plain = draftMessage(input.kind, facts);
  const budget = await budgetFor(input.orgId);

  const composed = await compose({
    plain,
    facts,
    allowances: draftAllowances(facts),
    allowModel: budget.allowed,
    maxTokens: 400,
    system:
      'You rewrite a short message from a workshop to its customer so it reads warmly and naturally, as a text message. Keep every fact exactly as given. Do not add any number, price, date, time, part or promise that is not in the text. Keep the closing line. Plain text, no markdown, under 90 words.',
  });

  const exchangeId = await record({
    orgId: input.orgId,
    userId: input.userId,
    kind: 'DRAFT',
    prompt: `${input.kind} for job ${facts.jobNumber}`,
    reply: composed.text,
    usage: composed.usage,
    polished: composed.polished,
    rejected: composed.rejected,
    relatedType: 'Job',
    relatedId: input.jobId,
  });

  return {
    exchangeId,
    text: composed.text,
    polished: composed.polished,
    rejected: composed.rejected,
  };
}

/** The job's state as facts, for the explanation. */
export async function jobStoryFor(orgId: string, jobId: string): Promise<JobStory | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      number: true,
      status: true,
      shortDescription: true,
      promisedAt: true,
      createdAt: true,
      customer: { select: { displayName: true } },
      vehicle: { select: { make: true, model: true, year: true, registration: true } },
      technicians: { take: 1, select: { user: { select: { name: true } } } },
      partLines: { select: { status: true } },
      timeEntries: { select: { startedAt: true, endedAt: true } },
      estimates: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { status: true, total: true, sentAt: true },
      },
      inspections: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { results: { select: { severity: true } } },
      },
      invoices: {
        where: { status: { not: 'VOID' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { number: true, status: true, total: true, amountPaid: true },
      },
    },
  });
  if (!job) return null;

  const estimate = job.estimates[0];
  const invoice = job.invoices[0];
  const results = job.inspections[0]?.results ?? [];
  const hours = job.timeEntries.reduce((sum, entry) => {
    if (!entry.endedAt) return sum;
    return sum + (entry.endedAt.getTime() - entry.startedAt.getTime()) / 3_600_000;
  }, 0);

  return {
    jobNumber: job.number,
    status: job.status,
    shortDescription: job.shortDescription,
    customerName: job.customer.displayName,
    vehicle: [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' '),
    registration: job.vehicle.registration,
    technician: job.technicians[0]?.user.name ?? null,
    promisedAt: job.promisedAt,
    openedAt: job.createdAt,
    estimate: estimate
      ? {
          status: estimate.status,
          total: gbp(Number(estimate.total)),
          sentAt: estimate.sentAt,
        }
      : null,
    partsRequested: job.partLines.filter((line) => line.status === 'REQUESTED').length,
    partsReserved: job.partLines.filter((line) => line.status === 'RESERVED').length,
    findings: {
      critical: results.filter((result) => result.severity === 'CRITICAL').length,
      advisory: results.filter((result) => result.severity === 'ADVISORY').length,
    },
    invoice: invoice
      ? {
          number: invoice.number,
          status: invoice.status,
          outstanding:
            Number(invoice.total) - Number(invoice.amountPaid) > 0
              ? gbp(Number(invoice.total) - Number(invoice.amountPaid))
              : null,
        }
      : null,
    hoursLogged: Math.round(hours * 10) / 10,
  };
}

/** Where a job stands, in sentences, recorded as an exchange. Plain only: it is for staff. */
export async function explainFor(input: { orgId: string; userId: string; jobId: string }) {
  const story = await jobStoryFor(input.orgId, input.jobId);
  if (!story) throw new AssistantError('NO_JOB', 'That job is not in this workshop.');

  const text = explainJob(story);

  const exchangeId = await record({
    orgId: input.orgId,
    userId: input.userId,
    kind: 'EXPLAIN',
    prompt: `Explain job ${story.jobNumber}`,
    reply: text,
    usage: { model: null, inputTokens: 0, outputTokens: 0 },
    polished: false,
    rejected: null,
    relatedType: 'Job',
    relatedId: input.jobId,
  });

  return { exchangeId, text };
}

/**
 * Sends a draft, as it is on the screen, once. The person's press is the
 * decision; the assistant only wrote the words.
 */
export async function sendDraft(input: {
  orgId: string;
  userId: string;
  exchangeId: string;
  text: string;
}): Promise<void> {
  const exchange = await prisma.assistantExchange.findFirst({
    where: { id: input.exchangeId, orgId: input.orgId, kind: 'DRAFT' },
    select: { id: true, relatedId: true, sentMessageId: true },
  });
  if (!exchange || !exchange.relatedId)
    throw new AssistantError('NO_JOB', 'That draft is not on record.');
  if (exchange.sentMessageId)
    throw new AssistantError('ALREADY_SENT', 'That draft has already been sent.');

  const text = input.text.trim();
  if (!text) throw new AssistantError('EMPTY', 'There is nothing to send.');

  const job = await prisma.job.findFirstOrThrow({
    where: { id: exchange.relatedId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      customer: { select: { email: true, mobile: true } },
      vehicle: { select: { make: true, model: true } },
    },
  });

  const channel = job.customer.mobile ? 'SMS' : job.customer.email ? 'EMAIL' : null;
  if (!channel) {
    throw new AssistantError(
      'NO_ADDRESS',
      'The customer has no mobile number or email address on file, so there is nowhere to send it.',
    );
  }

  const queued = await prisma.messageLog.create({
    data: {
      orgId: input.orgId,
      channel,
      toAddress: (channel === 'SMS' ? job.customer.mobile : job.customer.email)!,
      subject: `About your ${[job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ')} (job ${job.number})`,
      body: text,
      status: 'QUEUED',
      relatedType: 'Job',
      relatedId: job.id,
    },
    select: { id: true },
  });

  await prisma.assistantExchange.update({
    where: { id: exchange.id },
    data: { sentMessageId: queued.id, reply: text },
  });

  await pushNow(queued.id);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'assistant.draft_sent',
    entityType: 'Job',
    entityId: job.id,
    after: { exchangeId: exchange.id, channel, characters: text.length },
  });
}

/** Recent exchanges, for the Ask page and the job page. */
export async function exchangesFor(
  orgId: string,
  options: { jobId?: string; limit?: number } = {},
) {
  return prisma.assistantExchange.findMany({
    where: { orgId, ...(options.jobId ? { relatedType: 'Job', relatedId: options.jobId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: options.limit ?? 20,
    select: {
      id: true,
      kind: true,
      prompt: true,
      reply: true,
      model: true,
      polished: true,
      rejected: true,
      inputTokens: true,
      outputTokens: true,
      relatedType: true,
      relatedId: true,
      sentMessageId: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

/** This month's use, for the Settings card. */
export async function assistantUsage(orgId: string, now = new Date()) {
  const [budget, rows] = await Promise.all([
    budgetFor(orgId, now),
    prisma.assistantExchange.groupBy({
      by: ['kind', 'model'],
      where: { orgId, createdAt: { gte: monthStart(now) } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  const exchanges = rows.reduce((sum, row) => sum + row._count._all, 0);
  const costMinor = rows.reduce(
    (sum, row) =>
      sum + estimateCostMinor(row._sum.inputTokens ?? 0, row._sum.outputTokens ?? 0, row.model),
    0,
  );

  return {
    budget,
    exchanges,
    byKind: {
      QUESTION: rows.filter((r) => r.kind === 'QUESTION').reduce((s, r) => s + r._count._all, 0),
      DRAFT: rows.filter((r) => r.kind === 'DRAFT').reduce((s, r) => s + r._count._all, 0),
      EXPLAIN: rows.filter((r) => r.kind === 'EXPLAIN').reduce((s, r) => s + r._count._all, 0),
    },
    costMinor,
    transport:
      process.env.AI_TRANSPORT === 'anthropic' && process.env.ANTHROPIC_API_KEY
        ? 'anthropic'
        : 'none',
    model: process.env.AI_MODEL ?? 'claude-sonnet-5',
  };
}

/** The monthly budget, set on Settings. Zero switches the model off. */
export async function setAssistantBudget(input: {
  orgId: string;
  userId: string;
  tokens: number;
}): Promise<void> {
  if (!Number.isInteger(input.tokens) || input.tokens < 0 || input.tokens > 100_000_000) {
    throw new AssistantError(
      'EMPTY',
      'The budget is a whole number of tokens, from 0 to 100,000,000.',
    );
  }
  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: { assistantTokenBudget: true },
  });
  await prisma.organization.update({
    where: { id: input.orgId },
    data: { assistantTokenBudget: input.tokens },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.assistant_budget',
    entityType: 'Organization',
    entityId: input.orgId,
    before: { tokens: before.assistantTokenBudget },
    after: { tokens: input.tokens },
  });
}
