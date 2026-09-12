/**
 * The assistant composes from the record and decides nothing.
 *
 *   npx tsx infra/scripts/verify-assistant.ts
 *
 * Phase 22 promises: a question through the assistant is routed exactly as
 * the Ask page routes it and recorded; a draft message and an explanation
 * carry no figure the job does not have; every exchange is recorded with
 * who, what kind and what it cost; a spent budget means the plain text, not
 * a refusal; a draft is sent once, by a person's press, to the customer's
 * own address, and never twice; and the settings card's figures agree with
 * the rows. No model is called here: AI_TRANSPORT is 'none' in CI and the
 * plain path is the one that must be complete.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { draftAllowances, verifyAgainstFacts } from '@carnet/core';
import { prisma } from '@carnet/db';

import { answer } from '../../apps/web/src/lib/answers';
import {
  AssistantError,
  askAssistant,
  assistantUsage,
  budgetFor,
  draftFactsFor,
  draftFor,
  exchangesFor,
  explainFor,
  sendDraft,
  setAssistantBudget,
} from '../../apps/web/src/lib/assistant';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses<E extends Error & { code: string }>(
  label: string,
  kind: new (...args: never[]) => E,
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
    check(label, 'allowed', `refused with ${code}`);
  } catch (error) {
    if (error instanceof kind) check(label, error.code, code);
    else throw error;
  }
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER', isActive: true } } },
    select: { id: true },
  });
  const budgetBefore = (
    await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { assistantTokenBudget: true },
    })
  ).assistantTokenBudget;

  await forget(org.id);
  const startedAt = new Date();

  console.info('\nA question');

  const question = 'What did we take this month?';
  const asked = await askAssistant({ orgId: org.id, userId: owner.id, question });
  const direct = await answer(org.id, question);
  check('is routed as the Ask page routes it', asked.asked.intent?.kind, direct.intent?.kind);
  check('  to the same figure', asked.asked.answer?.figure, direct.answer?.figure);

  const refused = await askAssistant({
    orgId: org.id,
    userId: owner.id,
    question: 'Who will win the league?',
  });
  check('nonsense is refused, not guessed', refused.asked.answer, null);
  check(
    '  with the list of what can be asked',
    /can be asked|ask/i.test(refused.asked.refusal ?? ''),
    true,
  );

  await refuses('an empty question is refused', AssistantError, 'EMPTY', () =>
    askAssistant({ orgId: org.id, userId: owner.id, question: '  ' }),
  );

  console.info('\nA draft for the customer');

  // A job with an estimate, a customer with a mobile number, and lines.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { mobile: { not: null } }, estimates: { some: {} } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, customer: { select: { mobile: true } } },
  });

  const facts = await draftFactsFor(org.id, job.id);
  check('the facts name the job', facts?.jobNumber, job.number);

  const drafted = await draftFor({
    orgId: org.id,
    userId: owner.id,
    jobId: job.id,
    kind: 'WAITING_ON_APPROVAL',
  });
  check('a draft is composed', drafted.text.length > 40, true);
  check('  without a model, plainly', drafted.polished, false);
  check(
    '  and carries no figure the job does not have',
    verifyAgainstFacts(drafted.text, facts!, draftAllowances(facts!)).ok,
    true,
  );
  check('  mentions the job’s own workshop', drafted.text.includes(facts!.workshopName), true);

  await refuses('a kind of message it does not draft is refused', AssistantError, 'BAD_KIND', () =>
    draftFor({ orgId: org.id, userId: owner.id, jobId: job.id, kind: 'BIRTHDAY' as never }),
  );
  await refuses('a job from another workshop is refused', AssistantError, 'NO_JOB', () =>
    draftFor({ orgId: org.id, userId: owner.id, jobId: 'not-a-job', kind: 'PROGRESS' }),
  );

  console.info('\nAn explanation for staff');

  const explained = await explainFor({ orgId: org.id, userId: owner.id, jobId: job.id });
  check('it starts with the job', explained.text.startsWith(`Job ${job.number}:`), true);
  check('  and says where it stands', /, is [a-z ]+\./.test(explained.text), true);

  console.info('\nEvery exchange is recorded');

  const exchanges = await exchangesFor(org.id, { limit: 50 });
  const mine = exchanges.filter((row) => row.createdAt >= startedAt);
  check('four exchanges so far', mine.length, 4);
  check('  of three kinds', [...new Set(mine.map((row) => row.kind))].sort(), [
    'DRAFT',
    'EXPLAIN',
    'QUESTION',
  ]);
  check(
    '  each naming who asked',
    mine.every((row) => row.user !== null),
    true,
  );
  check(
    '  none costing anything without a model',
    mine.every((row) => row.inputTokens + row.outputTokens === 0),
    true,
  );

  const audited = await prisma.auditLog.count({
    where: { orgId: org.id, action: 'assistant.exchange', createdAt: { gte: startedAt } },
  });
  check('  and each audited', audited, 4);

  console.info('\nThe budget');

  await setAssistantBudget({ orgId: org.id, userId: owner.id, tokens: 0 });
  const off = await budgetFor(org.id);
  check('zero switches the model off', off.allowed, false);
  check('  and says so', /switched off/.test(off.statement), true);
  const stillDrafts = await draftFor({
    orgId: org.id,
    userId: owner.id,
    jobId: job.id,
    kind: 'READY',
  });
  check('the assistant still drafts, plainly', stillDrafts.text.length > 40, true);

  await refuses('a silly budget is refused', AssistantError, 'EMPTY', () =>
    setAssistantBudget({ orgId: org.id, userId: owner.id, tokens: -5 }),
  );
  await setAssistantBudget({ orgId: org.id, userId: owner.id, tokens: budgetBefore });

  console.info('\nSending a draft is a person’s press');

  await sendDraft({
    orgId: org.id,
    userId: owner.id,
    exchangeId: drafted.exchangeId,
    text: `${drafted.text} (probe)`,
  });
  const sent = await prisma.assistantExchange.findUniqueOrThrow({
    where: { id: drafted.exchangeId },
    select: { sentMessageId: true, reply: true },
  });
  check('the draft records the message it became', sent.sentMessageId !== null, true);
  check('  as edited before sending', sent.reply.endsWith('(probe)'), true);

  const message = await prisma.messageLog.findUniqueOrThrow({
    where: { id: sent.sentMessageId! },
    select: { channel: true, toAddress: true, body: true, relatedType: true, relatedId: true },
  });
  check('the message goes to the customer’s own number', message.toAddress, job.customer.mobile);
  check('  by text', message.channel, 'SMS');
  check('  about the job', [message.relatedType, message.relatedId], ['Job', job.id]);

  await refuses('and cannot be sent twice', AssistantError, 'ALREADY_SENT', () =>
    sendDraft({
      orgId: org.id,
      userId: owner.id,
      exchangeId: drafted.exchangeId,
      text: drafted.text,
    }),
  );
  await refuses('an explanation is not something to send', AssistantError, 'NO_JOB', () =>
    sendDraft({ orgId: org.id, userId: owner.id, exchangeId: explained.exchangeId, text: 'x' }),
  );

  console.info('\nThe settings card');

  const usage = await assistantUsage(org.id);
  const monthRows = await prisma.assistantExchange.count({
    where: {
      orgId: org.id,
      createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  });
  check('counts every exchange this month', usage.exchanges, monthRows);
  check(
    '  by kind, adding up',
    usage.byKind.QUESTION + usage.byKind.DRAFT + usage.byKind.EXPLAIN,
    monthRows,
  );
  check('  with nothing spent on a model', usage.costMinor, 0);

  await forget(org.id);

  console.info(
    failures === 0
      ? '\nverify-assistant: all checks passed'
      : `\nverify-assistant: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

async function forget(orgId: string) {
  const sent = await prisma.assistantExchange.findMany({
    where: { orgId, sentMessageId: { not: null } },
    select: { sentMessageId: true },
  });
  await prisma.messageLog.deleteMany({
    where: { id: { in: sent.map((row) => row.sentMessageId!) }, body: { endsWith: '(probe)' } },
  });
  await prisma.assistantExchange.deleteMany({ where: { orgId } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
