import {
  type Action,
  evaluate,
  mayNotify,
  type Rule,
  schedule as scheduleActions,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { consentOf } from './consent';
import { log } from './log';

/**
 * Carrying out the rules a workshop wrote.
 */

const BATCH_SIZE = Number(process.env.WORKER_BATCH ?? 25);

/* ---------------------------------------------------------------------------
   Automation
   --------------------------------------------------------------------------- */

/**
 * Runs one event past every rule listening for it, and queues what fires.
 *
 * Written against Prisma here rather than shared with the web application,
 * which is the convention this worker already follows: the domain layer holds
 * every decision and each caller does its own recording. The two call sites
 * genuinely differ, because the web one writes an audit entry against the
 * person who caused the event and there is no person here.
 */
export async function fireEvent(input: {
  orgId: string;
  event: Rule['trigger'];
  subjectType: string;
  subjectId: string;
  customerId?: string | null;
  facts: Record<string, number>;
}): Promise<number> {
  const now = new Date();

  const rows = await prisma.automationRule.findMany({
    where: { orgId: input.orgId, trigger: input.event, isActive: true },
  });

  let fired = 0;

  for (const row of rows) {
    const rule: Rule = {
      id: row.id,
      name: row.name,
      trigger: row.trigger as Rule['trigger'],
      conditions: (row.conditions ?? []) as unknown as Rule['conditions'],
      actions: (row.actions ?? []) as unknown as Action[],
      isActive: row.isActive,
      cooldownHours: row.cooldownHours,
    };

    const previous = await prisma.automationRun.findFirst({
      where: {
        ruleId: rule.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        blockedBy: null,
      },
      orderBy: { firedAt: 'desc' },
      select: { firedAt: true },
    });

    const decision = evaluate(rule, input.facts, {
      event: input.event,
      now,
      lastRunAt: previous?.firedAt ?? null,
    });

    // The run is written either way. A rule that has been quietly failing a
    // condition for a fortnight looks identical, from outside, to one nobody
    // has triggered, and the two need completely different responses.
    const run = await prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        customerId: input.customerId ?? null,
        firedAt: now,
        blockedBy: decision.fires ? null : (decision.blockedBy?.field ?? 'rule'),
        reason: decision.fires ? null : decision.reason,
      },
    });

    if (!decision.fires) continue;

    await prisma.automationAction.createMany({
      data: scheduleActions(decision.actions, now).map((planned) => ({
        runId: run.id,
        kind: planned.action.kind,
        target: planned.action.target,
        dueAt: planned.dueAt,
      })),
    });

    fired += 1;
  }

  return fired;
}

/**
 * Carries out the actions rules queued once their delay has passed.
 *
 * Every message written here is transactional: it concerns work on the
 * customer's own vehicle, so it goes to the address they gave rather than
 * being gated on marketing consent. That distinction belongs to the domain
 * layer, which is why mayNotify is asked rather than a flag being read.
 *
 * A failure marks the row FAILED with its reason and moves on. Retrying a
 * message forever is how one bad address becomes forty sends.
 */
export async function runDueAutomationActions(): Promise<number> {
  const due = await prisma.automationAction.findMany({
    where: { status: 'PENDING', dueAt: { lte: new Date() } },
    orderBy: { dueAt: 'asc' },
    take: BATCH_SIZE,
    include: { run: { include: { rule: { select: { orgId: true, name: true } } } } },
  });

  let done = 0;

  for (const action of due) {
    try {
      const customer = action.run.customerId
        ? await prisma.customer.findUnique({
            where: { id: action.run.customerId },
            select: {
              email: true,
              mobile: true,
              marketingEmailConsent: true,
              marketingSmsConsent: true,
            },
          })
        : null;

      if (action.kind !== 'send.email' && action.kind !== 'send.sms') {
        // Tasks and tags stay inside the building, so there is nothing that
        // can fail on the way out.
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'DONE', doneAt: new Date() },
        });
        done += 1;
        continue;
      }

      const channel = action.kind === 'send.email' ? 'EMAIL' : 'SMS';

      if (!customer) {
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'FAILED', error: 'The rule fired about nobody in particular.' },
        });
        continue;
      }

      const decision = mayNotify({ channel, consent: consentOf(customer) });

      if (!decision.allowed) {
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'FAILED', error: decision.reason },
        });
        continue;
      }

      const message = await prisma.messageLog.create({
        data: {
          orgId: action.run.rule.orgId,
          channel,
          toAddress: (channel === 'EMAIL' ? customer.email : customer.mobile) ?? '',
          subject: action.target,
          body: action.target,
          status: 'QUEUED',
          relatedType: 'AutomationAction',
          relatedId: action.id,
        },
      });

      await prisma.automationAction.update({
        where: { id: action.id },
        data: { status: 'DONE', doneAt: new Date(), messageId: message.id },
      });

      done += 1;
    } catch (error) {
      await prisma.automationAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (done > 0) log('automation.actions.done', { count: done });
  return done;
}
