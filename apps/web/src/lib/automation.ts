import {
  type Action,
  type ArrivalContext,
  assertRuleSound,
  buildSegment,
  type Channel,
  cohorts,
  type ConsentState,
  describeRule,
  evaluate,
  type Facts,
  type FirstVisit,
  type Rule,
  mayMarket,
  planCampaign,
  schedule as scheduleActions,
  type SegmentMember,
  type SegmentRule,
  type Suggestion,
  suggestOnArrival,
  type TriggerEvent,
} from '@carnet/core';
import { type InvoiceStatus, type JobStatus, prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Automation and CRM, against the database.
 *
 * The domain layer decides; this layer records. That split matters more here
 * than anywhere else in the product, because the thing being decided is
 * whether to write to a customer, and the record of why is the only defence
 * anybody has when the question comes back six months later.
 *
 * Two rules run through everything below.
 *
 * A run is written whether or not it fired. "Why did this rule not send
 * anything" is the question people actually ask, and a system that records
 * only its successes cannot answer it.
 *
 * Consent is checked at the moment of sending, never at the moment the list
 * was built. Lists go stale between the two, and the person who withdrew
 * consent on Tuesday must not receive Wednesday's campaign.
 */

/** A visit that happened. Anything earlier is an intention, not a visit. */
const DONE_STATUSES: JobStatus[] = ['COMPLETED', 'INVOICED', 'PAID'];

/** An invoice that counts towards what somebody has spent. */
const BILLED_STATUSES: InvoiceStatus[] = ['ISSUED', 'PART_PAID', 'PAID'];

/* ---------------------------------------------------------------------------
   Rules
   --------------------------------------------------------------------------- */

interface RuleRow {
  id: string;
  name: string;
  trigger: string;
  conditions: unknown;
  actions: unknown;
  isActive: boolean;
  cooldownHours: number;
}

function toRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger as TriggerEvent,
    conditions: (row.conditions ?? []) as Rule['conditions'],
    actions: (row.actions ?? []) as Action[],
    isActive: row.isActive,
    cooldownHours: row.cooldownHours,
  };
}

export async function listRules(orgId: string) {
  const rows = await prisma.automationRule.findMany({
    where: { orgId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { runs: true } },
      runs: { orderBy: { firedAt: 'desc' }, take: 1, select: { firedAt: true, blockedBy: true } },
    },
  });

  return rows.map((row) => {
    const rule = toRule(row);

    return {
      ...rule,
      sentence: describeRule(rule),
      runCount: row._count.runs,
      lastRunAt: row.runs[0]?.firedAt ?? null,
      lastRunBlocked: Boolean(row.runs[0]?.blockedBy),
    };
  });
}

export async function saveRule(input: {
  orgId: string;
  userId: string;
  id?: string;
  name: string;
  trigger: TriggerEvent;
  conditions: Rule['conditions'];
  actions: Action[];
  cooldownHours: number;
  isActive: boolean;
}) {
  const candidate: Rule = {
    id: input.id ?? 'new',
    name: input.name,
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
    isActive: input.isActive,
    cooldownHours: input.cooldownHours,
  };

  // Refused here rather than when it runs. A workshop that writes a rule and
  // sees nothing happen concludes the feature is broken, and they are right to.
  assertRuleSound(candidate);

  const data = {
    name: input.name,
    trigger: input.trigger,
    conditions: input.conditions as never,
    actions: input.actions as never,
    cooldownHours: input.cooldownHours,
    isActive: input.isActive,
  };

  const saved = input.id
    ? await prisma.automationRule.update({ where: { id: input.id }, data })
    : await prisma.automationRule.create({ data: { ...data, orgId: input.orgId } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.id ? 'automation.rule.updated' : 'automation.rule.created',
    entityType: 'AutomationRule',
    entityId: saved.id,
    after: { sentence: describeRule(candidate) },
  });

  return saved;
}

/**
 * Switches a rule on or off.
 *
 * Kept separate from saving, because turning a rule off is the thing somebody
 * does in a hurry when it is misbehaving, and it must not require them to get
 * the rest of the form past validation first.
 */
export async function setRuleActive(input: {
  orgId: string;
  userId: string;
  ruleId: string;
  isActive: boolean;
}) {
  const rule = await prisma.automationRule.findFirstOrThrow({
    where: { id: input.ruleId, orgId: input.orgId },
    select: { id: true, name: true },
  });

  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { isActive: input.isActive },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.isActive ? 'automation.rule.enabled' : 'automation.rule.disabled',
    entityType: 'AutomationRule',
    entityId: rule.id,
    after: { name: rule.name, isActive: input.isActive },
  });
}

/**
 * Stops a queued action before it goes out.
 *
 * The window between a rule firing and its delay elapsing is the only moment
 * anything can still be called back, which is the whole reason the queue is
 * rows on a page rather than timers in memory.
 */
export async function cancelAction(input: { orgId: string; userId: string; actionId: string }) {
  const action = await prisma.automationAction.findFirstOrThrow({
    where: { id: input.actionId, status: 'PENDING', run: { rule: { orgId: input.orgId } } },
    select: { id: true, kind: true, target: true },
  });

  await prisma.automationAction.update({
    where: { id: action.id },
    data: { status: 'CANCELLED' },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'automation.action.cancelled',
    entityType: 'AutomationAction',
    entityId: action.id,
    after: { kind: action.kind, target: action.target },
  });
}

/**
 * Runs one event past every rule that listens for it.
 *
 * The blocked runs are written too, and that is the point. A rule that has
 * been silently failing a condition for three weeks looks identical, from the
 * outside, to a rule nobody has triggered, and the two need entirely different
 * responses.
 *
 * The cooldown is enforced by the database as well as here. This check gives a
 * readable reason; the trigger guarantees the thing that actually matters.
 */
export async function fireEvent(input: {
  orgId: string;
  event: TriggerEvent;
  subjectType: string;
  subjectId: string;
  customerId?: string | null;
  facts: Facts;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const rows = await prisma.automationRule.findMany({
    where: { orgId: input.orgId, trigger: input.event, isActive: true },
  });

  const outcomes: { rule: string; fired: boolean; reason: string }[] = [];

  for (const row of rows) {
    const rule = toRule(row);

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

    if (decision.fires) {
      // Queued as rows rather than held as timers, so a restart does not lose
      // them and a person can see what is about to happen and stop it.
      await prisma.automationAction.createMany({
        data: scheduleActions(decision.actions, now).map((planned) => ({
          runId: run.id,
          kind: planned.action.kind,
          target: planned.action.target,
          dueAt: planned.dueAt,
        })),
      });
    }

    outcomes.push({ rule: rule.name, fired: decision.fires, reason: decision.reason });
  }

  return outcomes;
}

/** What the engine is about to do, which is the only way to trust it. */
export async function pendingActions(orgId: string, limit = 50) {
  const rows = await prisma.automationAction.findMany({
    where: { status: 'PENDING', run: { rule: { orgId } } },
    orderBy: { dueAt: 'asc' },
    take: limit,
    include: { run: { include: { rule: { select: { name: true } } } } },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    target: row.target,
    dueAt: row.dueAt,
    overdue: row.dueAt < new Date(),
    ruleName: row.run.rule.name,
    subjectType: row.run.subjectType,
    subjectId: row.run.subjectId,
  }));
}

/** The last thing each rule did, fired or not. */
export async function recentRuns(orgId: string, limit = 30) {
  const rows = await prisma.automationRun.findMany({
    where: { rule: { orgId } },
    orderBy: { firedAt: 'desc' },
    take: limit,
    include: {
      rule: { select: { name: true } },
      _count: { select: { actions: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    ruleName: row.rule.name,
    firedAt: row.firedAt,
    fired: row.blockedBy === null,
    reason: row.reason,
    subjectType: row.subjectType,
    actionCount: row._count.actions,
  }));
}

/* ---------------------------------------------------------------------------
   Segments and campaigns
   --------------------------------------------------------------------------- */

function consentOf(customer: {
  email: string | null;
  mobile: string | null;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
}): ConsentState {
  return {
    email: customer.marketingEmailConsent,
    sms: customer.marketingSmsConsent,
    hasEmail: Boolean(customer.email),
    hasMobile: Boolean(customer.mobile),
  };
}

/**
 * Everybody in the org, with the facts a segment rule can ask about.
 *
 * One pass over customers, jobs and vehicles rather than a query per rule: the
 * rules are combined in memory because a workshop has thousands of customers,
 * not millions, and a comprehensible filter beats a clever one at this size.
 */
export async function segmentMembers(orgId: string, now = new Date()): Promise<SegmentMember[]> {
  const customers = await prisma.customer.findMany({
    where: { orgId, isActive: true },
    select: {
      id: true,
      displayName: true,
      email: true,
      mobile: true,
      marketingEmailConsent: true,
      marketingSmsConsent: true,
      jobs: {
        where: { status: { in: DONE_STATUSES } },
        select: {
          completedAt: true,
          createdAt: true,
          vehicle: { select: { firstRegisteredAt: true } },
          // An estimate belongs to a job, not to a customer, so the last
          // refusal has to be reached through the work it was quoted for.
          estimates: {
            where: { status: 'DECLINED' },
            select: { decidedAt: true, updatedAt: true },
          },
        },
      },
      invoices: {
        where: { status: { in: BILLED_STATUSES } },
        select: { total: true },
      },
    },
  });

  return customers.map((customer) => {
    const visits = customer.jobs
      .map((job) => job.completedAt ?? job.createdAt)
      .sort((a, b) => b.getTime() - a.getTime());

    const lifetimeMinor = customer.invoices.reduce(
      (total, invoice) => total + Math.round(Number(invoice.total) * 100),
      0,
    );

    const oldestVehicle = customer.jobs
      .map((job) => job.vehicle?.firstRegisteredAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const declinedAt = customer.jobs
      .flatMap((job) => job.estimates.map((estimate) => estimate.decidedAt ?? estimate.updatedAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      customerId: customer.id,
      name: customer.displayName,
      visits: visits.length,
      lifetimeMinor,
      daysSinceLastVisit: visits[0]
        ? Math.floor((now.getTime() - visits[0].getTime()) / 86_400_000)
        : null,
      oldestVehicleYears: oldestVehicle
        ? Math.floor((now.getTime() - oldestVehicle.getTime()) / (365.25 * 86_400_000))
        : null,
      declinedSinceDays: declinedAt
        ? Math.floor((now.getTime() - declinedAt.getTime()) / 86_400_000)
        : null,
      consent: consentOf(customer),
    };
  });
}

/** The segment, split into who can be written to and who cannot, with reasons. */
export async function previewSegment(
  orgId: string,
  rules: SegmentRule[],
  channel: Channel,
  now = new Date(),
) {
  const members = await segmentMembers(orgId, now);
  const segment = buildSegment(members, rules, channel);

  return { segment, plan: planCampaign(segment, channel) };
}

export async function listCampaigns(orgId: string) {
  const rows = await prisma.campaign.findMany({
    where: { orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { _count: { select: { recipients: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    recipients: row._count.recipients,
    plannedRecipients: row.plannedRecipients,
    plannedSuppressed: row.plannedSuppressed,
  }));
}

/**
 * Writes a campaign as a draft. It sends nothing.
 *
 * The two steps are deliberate. A campaign is the only action in this product
 * that cannot be undone, so composing it and sending it are separated by a
 * page that says how many people it will actually reach.
 */
export async function draftCampaign(input: {
  orgId: string;
  userId: string;
  name: string;
  channel: Channel;
  segment: SegmentRule[];
  subject: string;
  body: string;
}) {
  const campaign = await prisma.campaign.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      channel: input.channel,
      segment: input.segment as never,
      subject: input.subject || null,
      body: input.body,
      status: 'DRAFT',
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'campaign.drafted',
    entityType: 'Campaign',
    entityId: campaign.id,
    after: { name: input.name, channel: input.channel },
  });

  return campaign;
}

export class CampaignError extends Error {
  readonly code: 'NOT_DRAFT' | 'NOBODY_REACHABLE';

  constructor(code: CampaignError['code'], message: string) {
    super(message);
    this.name = 'CampaignError';
    this.code = code;
  }
}

/**
 * Sends a campaign, rechecking consent for every single recipient first.
 *
 * The segment stored on the campaign is a set of rules, not a list of people,
 * so this is where the list is actually made, at the last possible moment.
 * Anybody who cannot be written to is recorded as suppressed with the reason,
 * because the gap between what a campaign intended and what it did is the
 * number worth keeping.
 *
 * There is no undo. A job can be reopened and an invoice credited; a message
 * that has reached four hundred people has reached them.
 */
export async function sendCampaign(input: {
  orgId: string;
  userId: string;
  campaignId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { id: input.campaignId, orgId: input.orgId },
  });

  if (campaign.status !== 'DRAFT') {
    throw new CampaignError(
      'NOT_DRAFT',
      `This campaign is ${campaign.status.toLowerCase()}, and a campaign cannot be sent twice.`,
    );
  }

  const channel = campaign.channel as Channel;
  const rules = (campaign.segment ?? []) as SegmentRule[];

  const members = await segmentMembers(input.orgId, now);
  const segment = buildSegment(members, rules, channel);

  const lastMarketed = new Map(
    (
      await prisma.customer.findMany({
        where: { id: { in: segment.members.map((member) => member.customerId) } },
        select: { id: true, lastMarketedAt: true },
      })
    ).map((row) => [row.id, row.lastMarketedAt]),
  );

  const sent: string[] = [];
  const suppressed: { customerId: string; reason: string }[] = [];

  for (const member of segment.members) {
    // Rechecked per person, now, rather than trusted from when the segment was
    // built. This is also where the floor between marketing messages applies,
    // so a campaign cannot pester somebody a rule contacted on Tuesday.
    const decision = mayMarket({
      channel,
      consent: member.consent,
      lastMarketedAt: lastMarketed.get(member.customerId) ?? null,
      now,
    });

    if (decision.allowed) sent.push(member.customerId);
    else suppressed.push({ customerId: member.customerId, reason: decision.reason });
  }

  if (sent.length === 0) {
    throw new CampaignError(
      'NOBODY_REACHABLE',
      'Nobody in this segment can be written to on this channel right now.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.campaignRecipient.createMany({
      data: [
        ...sent.map((customerId) => ({
          campaignId: campaign.id,
          customerId,
          status: 'SENT',
          sentAt: now,
        })),
        ...suppressed.map((entry) => ({
          campaignId: campaign.id,
          customerId: entry.customerId,
          status: 'SUPPRESSED',
          reason: entry.reason,
        })),
      ],
      skipDuplicates: true,
    });

    await tx.messageLog.createMany({
      data: sent.map((customerId) => ({
        orgId: input.orgId,
        channel: campaign.channel,
        toAddress: customerId,
        subject: campaign.subject,
        body: campaign.body,
        status: 'QUEUED' as const,
        relatedType: 'Campaign',
        relatedId: campaign.id,
      })),
    });

    await tx.customer.updateMany({
      where: { id: { in: sent } },
      data: { lastMarketedAt: now },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENT',
        sentAt: now,
        plannedRecipients: sent.length,
        plannedSuppressed: suppressed.length,
      },
    });
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'campaign.sent',
    entityType: 'Campaign',
    entityId: campaign.id,
    after: { name: campaign.name, sent: sent.length, suppressed: suppressed.length },
  });

  return { sent: sent.length, suppressed: suppressed.length };
}

/* ---------------------------------------------------------------------------
   Retention
   --------------------------------------------------------------------------- */

/** Retention by the month somebody first came in, which is the only honest cut. */
export async function retention(orgId: string, months = 12, asOf = new Date()) {
  const customers = await prisma.customer.findMany({
    where: { orgId, jobs: { some: {} } },
    select: {
      id: true,
      jobs: {
        where: { status: { in: DONE_STATUSES } },
        select: { completedAt: true, createdAt: true },
      },
      invoices: {
        where: { status: { in: BILLED_STATUSES } },
        select: { total: true },
      },
    },
  });

  const facts: FirstVisit[] = customers
    .map((customer) => {
      const visits = customer.jobs
        .map((job) => job.completedAt ?? job.createdAt)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        customerId: customer.id,
        firstVisit: visits[0] as Date,
        visits,
        lifetimeMinor: customer.invoices.reduce(
          (total, invoice) => total + Math.round(Number(invoice.total) * 100),
          0,
        ),
      };
    })
    .filter((fact) => Boolean(fact.firstVisit));

  return cohorts(facts, months, asOf);
}

/* ---------------------------------------------------------------------------
   Arrival
   --------------------------------------------------------------------------- */

/**
 * What to raise about a vehicle while it is on the ramp. FR-1506.
 *
 * Read at the gate, so it has to be one query's worth of work: the answer is
 * wanted in the seconds between a car arriving and somebody writing the job.
 */
export async function arrivalSuggestions(
  vehicleId: string,
  now = new Date(),
): Promise<Suggestion[]> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      lastOdometerKm: true,
      serviceSchedules: {
        where: { isActive: true },
        select: {
          name: true,
          dueAt: true,
          dueKm: true,
          lastPerformedAt: true,
          intervalMonths: true,
        },
      },
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          estimates: {
            select: {
              decidedAt: true,
              updatedAt: true,
              lines: {
                where: { decision: 'DECLINED' },
                select: { description: true, lineTotal: true },
              },
            },
          },
          inspections: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: {
              startedAt: true,
              results: {
                where: { severity: { in: ['ADVISORY', 'CRITICAL'] } },
                select: { itemName: true, severity: true },
              },
            },
          },
        },
      },
    },
  });

  if (!vehicle) return [];

  const context: ArrivalContext = {
    now,
    odometerKm: vehicle.lastOdometerKm ?? null,
    schedules: vehicle.serviceSchedules.map((row) => ({
      serviceItemId: null,
      name: row.name,
      dueAt: row.dueAt,
      dueKm: row.dueKm,
      lastPerformedAt: row.lastPerformedAt,
      intervalMonths: row.intervalMonths,
    })),
    declined: vehicle.jobs.flatMap((job) =>
      job.estimates.flatMap((estimate) =>
        estimate.lines.map((line) => ({
          serviceItemId: null,
          name: line.description,
          declinedAt: estimate.decidedAt ?? estimate.updatedAt,
          quotedMinor: Math.round(Number(line.lineTotal) * 100),
        })),
      ),
    ),
    // Only the most recent inspection on each of the last few jobs. An
    // advisory from four visits ago has either been done or has become
    // something worse, and either way the latest sheet is the truth.
    advisories: vehicle.jobs.flatMap((job) =>
      job.inspections.flatMap((inspection) =>
        inspection.results.map((result) => ({
          name: result.itemName,
          severity: result.severity === 'CRITICAL' ? ('RED' as const) : ('AMBER' as const),
          notedAt: inspection.startedAt,
        })),
      ),
    ),
  };

  return suggestOnArrival(context);
}
