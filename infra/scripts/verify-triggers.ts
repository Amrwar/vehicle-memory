/**
 * Proves a rule a workshop writes actually runs.
 *
 *   npx tsx infra/scripts/verify-triggers.ts
 *
 * The automation engine was complete and unreached. Ten triggers on the
 * screen, conditions, cooldowns, actions, and a check that refuses a rule
 * which could never match — and exactly one of the ten was ever fired, from
 * the reminder sweep. A workshop could write "when a bill goes a fortnight
 * overdue, text them", watch it never happen, and have no way to tell whether
 * the rule was wrong or the product was.
 *
 * So this writes real rules, does the real thing that should fire them, and
 * checks that a run was recorded and an action queued. It also checks the two
 * actions that used to report success without doing anything: a task that was
 * never created, and a tag on a customer the data model has no room for.
 *
 * Runs against the seeded hillside-motors and clears up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';
import { runDueAutomationActions } from '@carnet/jobs';

import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';
import { sweepOverdueInvoices } from '../../apps/web/src/lib/sweeps';

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown) {
  console.info(
    `  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${String(detail)}`}`,
  );
  if (!passed) failures += 1;
}

const TAG = 'Verify triggers probe';

async function main() {
  console.info('\n  A rule a workshop writes, and the moment it runs\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id);

  /* --- a job finishing ------------------------------------------------------ */

  console.info('\n  When a job is finished');

  const onCompletion = await prisma.automationRule.create({
    data: {
      orgId: org.id,
      name: `${TAG} completion`,
      trigger: 'job.completed',
      conditions: [],
      actions: [{ kind: 'task.create', target: `${TAG} follow up`, delayHours: 0 }],
      isActive: true,
      cooldownHours: 1,
    },
    select: { id: true },
  });

  const job = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    taxRateId: vat?.id ?? null,
  });

  const completionRuns = await prisma.automationRun.count({
    where: { ruleId: onCompletion.id, subjectId: job.jobId },
  });

  check(
    'a rule on a finished job runs when a job is finished',
    completionRuns === 1,
    completionRuns,
  );

  const queued = await prisma.automationAction.findFirst({
    where: { run: { ruleId: onCompletion.id } },
    select: { id: true, kind: true, status: true },
  });

  check('and its action is queued', queued?.status === 'PENDING', queued?.status);

  // The action that used to say it had run without running.
  await runDueAutomationActions();

  const task = await prisma.jobTask.findFirst({
    where: { jobId: job.jobId, title: `${TAG} follow up` },
    select: { id: true },
  });

  check('a task the rule asked for actually exists', Boolean(task));

  const afterRun = await prisma.automationAction.findUniqueOrThrow({
    where: { id: queued!.id },
    select: { status: true, error: true },
  });

  check('and the action says it is done', afterRun.status === 'DONE', afterRun.error);

  /* --- a bill going out ----------------------------------------------------- */

  console.info('\n  When a bill goes out, and when it goes overdue');

  const onIssue = await prisma.automationRule.create({
    data: {
      orgId: org.id,
      name: `${TAG} issued`,
      trigger: 'invoice.issued',
      conditions: [],
      actions: [{ kind: 'tag.add', target: `${TAG} billed`, delayHours: 0 }],
      isActive: true,
      cooldownHours: 1,
    },
    select: { id: true },
  });

  const second = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    taxRateId: vat?.id ?? null,
  });

  const issuedRuns = await prisma.automationRun.count({
    where: { ruleId: onIssue.id, subjectId: second.invoiceId },
  });

  check('a rule on a bill going out runs when one goes out', issuedRuns === 1, issuedRuns);

  // A bill that went past its due date. Nothing happens at that moment, so the
  // sweep is the only thing that can notice.
  const onOverdue = await prisma.automationRule.create({
    data: {
      orgId: org.id,
      name: `${TAG} overdue`,
      trigger: 'invoice.overdue',
      conditions: [{ field: 'invoice.daysOverdue', is: 'gte', value: 7 }],
      actions: [{ kind: 'task.create', target: `${TAG} chase`, delayHours: 0 }],
      isActive: true,
      cooldownHours: 1,
    },
    select: { id: true },
  });

  await prisma.invoice.update({
    where: { id: second.invoiceId },
    data: { dueAt: new Date(Date.now() - 14 * 86_400_000), status: 'ISSUED' },
  });

  const swept = await sweepOverdueInvoices();
  check('the sweep finds bills that have gone past their date', swept > 0, swept);

  const overdueRuns = await prisma.automationRun.count({
    where: { ruleId: onOverdue.id, subjectId: second.invoiceId },
  });

  check('and a rule on an overdue bill runs', overdueRuns === 1, overdueRuns);

  const blocked = await prisma.automationRule.create({
    data: {
      orgId: org.id,
      name: `${TAG} not yet`,
      trigger: 'invoice.overdue',
      conditions: [{ field: 'invoice.daysOverdue', is: 'gte', value: 400 }],
      actions: [{ kind: 'task.create', target: `${TAG} never`, delayHours: 0 }],
      isActive: true,
      cooldownHours: 1,
    },
    select: { id: true },
  });

  await sweepOverdueInvoices();

  const blockedRun = await prisma.automationRun.findFirst({
    where: { ruleId: blocked.id, subjectId: second.invoiceId },
    select: { blockedBy: true, reason: true },
  });

  check(
    'a rule whose condition is not met is written down as blocked, rather than silently skipped',
    Boolean(blockedRun?.blockedBy),
    blockedRun?.reason ?? blockedRun?.blockedBy,
  );

  /* --- what used to lie ----------------------------------------------------- */

  console.info('\n  What used to report success without running');

  const impossible = await prisma.automationRule.create({
    data: {
      orgId: org.id,
      name: `${TAG} tag an invoice`,
      trigger: 'invoice.issued',
      conditions: [],
      actions: [{ kind: 'tag.add', target: `${TAG} nowhere`, delayHours: 0 }],
      isActive: true,
      cooldownHours: 1,
    },
    select: { id: true },
  });

  const third = await bill({
    orgId: org.id,
    userId: staff.id,
    customerId: previous.customerId!,
    vehicleId: previous.vehicleId!,
    taxRateId: vat?.id ?? null,
  });

  await runDueAutomationActions();

  const impossibleAction = await prisma.automationAction.findFirst({
    where: { run: { ruleId: impossible.id, subjectId: third.invoiceId } },
    select: { status: true, error: true },
  });

  check(
    'a tag asked for on something that cannot carry one fails, and says why',
    impossibleAction?.status === 'FAILED' && Boolean(impossibleAction.error),
    impossibleAction?.error,
  );

  await forget(org.id);
  check('the probe left no rules behind', (await probeRules(org.id)) === 0);

  console.info(
    `\n  ${failures === 0 ? 'A rule written by a workshop runs when the thing it is about happens.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

async function bill(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  taxRateId: string | null;
}): Promise<{ jobId: string; invoiceId: string }> {
  const job = await createJob({
    orgId: input.orgId,
    userId: input.userId,
    locationId: null,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    shortDescription: TAG,
  });

  await prisma.jobLabourLine.create({
    data: {
      jobId: job.id,
      description: 'Probe labour',
      hours: 2,
      rate: 40,
      taxRateId: input.taxRateId,
    },
  });

  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'COMPLETED' });

  const invoiceId = await issueInvoice({
    orgId: input.orgId,
    userId: input.userId,
    jobId: job.id,
  });

  return { jobId: job.id, invoiceId };
}

async function probeRules(orgId: string): Promise<number> {
  return prisma.automationRule.count({ where: { orgId, name: { startsWith: TAG } } });
}

async function forget(orgId: string) {
  const rules = await prisma.automationRule.findMany({
    where: { orgId, name: { startsWith: TAG } },
    select: { id: true },
  });

  await prisma.automationRule.deleteMany({ where: { id: { in: rules.map((rule) => rule.id) } } });
  await prisma.tag.deleteMany({ where: { orgId, name: { startsWith: TAG } } });

  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);

  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true, number: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);

  for (const source of [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
  ]) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }

  await prisma.messageLog.deleteMany({
    where: { orgId, relatedId: { in: [...invoiceIds, ...jobIds] } },
  });
  await prisma.jobTask.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: {
      orgId,
      type: { in: ['job.completed', 'invoice.issued', 'payment.received'] },
      processedAt: null,
    },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
