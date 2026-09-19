import {
  type CohortRow,
  type Action,
  type ArrivalContext,
  assertRuleSound,
  buildSegment,
  type Channel,
  type ConsentState,
  describeRule,
  evaluate,
  type Facts,
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
import { traceId } from './trace';

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
  // Six facts per customer, each of them an aggregate.
  //
  // This used to read every active customer with all of their jobs, each job's
  // vehicle, each job's declined estimates and all of their invoices, and
  // reduce the lot in memory. Twelve seconds at a hundred thousand customers —
  // and the relationships page called it once per segment, in parallel, which
  // is where the connection pool went.
  //
  // Nothing about the answer changed. Every field below is the same arithmetic
  // written where the rows are, and the one thing that cannot move is consent,
  // which is read from the customer's own columns by the same function as
  // before so that there is one definition of who may be written to.
  const rows = await prisma.$queryRaw<
    {
      id: string;
      displayName: string;
      email: string | null;
      mobile: string | null;
      marketingEmailConsent: boolean;
      marketingSmsConsent: boolean;
      visits: bigint;
      lastVisit: Date | null;
      lifetime: string | null;
      oldestVehicle: Date | null;
      declinedAt: Date | null;
    }[]
  >`
    SELECT
      c."id",
      c."displayName",
      c."email",
      c."mobile",
      c."marketingEmailConsent",
      c."marketingSmsConsent",
      coalesce(j.visits, 0) AS visits,
      j."lastVisit",
      coalesce(i.lifetime, 0)::text AS lifetime,
      j."oldestVehicle",
      e."declinedAt"
    FROM "customers" c
    LEFT JOIN (
      SELECT
        j."customerId",
        count(*) AS visits,
        max(coalesce(j."completedAt", j."createdAt")) AS "lastVisit",
        min(v."firstRegisteredAt") AS "oldestVehicle"
      FROM "jobs" j
      LEFT JOIN "vehicles" v ON v."id" = j."vehicleId"
      WHERE j."orgId" = ${orgId} AND j."status"::text = ANY(${DONE_STATUSES as unknown as string[]})
      GROUP BY j."customerId"
    ) j ON j."customerId" = c."id"
    LEFT JOIN (
      SELECT "customerId", sum("total") AS lifetime
      FROM "invoices"
      WHERE "orgId" = ${orgId} AND "status"::text = ANY(${BILLED_STATUSES as unknown as string[]})
      GROUP BY "customerId"
    ) i ON i."customerId" = c."id"
    LEFT JOIN (
      SELECT j."customerId", max(coalesce(e."decidedAt", e."updatedAt")) AS "declinedAt"
      FROM "estimates" e
      JOIN "jobs" j ON j."id" = e."jobId"
      WHERE j."orgId" = ${orgId} AND e."status" = 'DECLINED'
      GROUP BY j."customerId"
    ) e ON e."customerId" = c."id"
    WHERE c."orgId" = ${orgId} AND c."isActive" = true`;

  const days = (at: Date | null) =>
    at ? Math.floor((now.getTime() - at.getTime()) / 86_400_000) : null;

  return rows.map((row) => ({
    customerId: row.id,
    name: row.displayName,
    visits: Number(row.visits),
    lifetimeMinor: Math.round(Number(row.lifetime ?? 0) * 100),
    daysSinceLastVisit: days(row.lastVisit),
    oldestVehicleYears: row.oldestVehicle
      ? Math.floor((now.getTime() - row.oldestVehicle.getTime()) / (365.25 * 86_400_000))
      : null,
    declinedSinceDays: days(row.declinedAt),
    consent: consentOf(row),
  }));
}

/** The segment, split into who can be written to and who cannot, with reasons. */
export async function previewSegment(
  orgId: string,
  rules: SegmentRule[],
  channel: Channel,
  now = new Date(),
  // Every caller that previews more than one segment should read the members
  // once and hand them in. `segmentMembers` is the heaviest read in the
  // product — every active customer with their jobs, those jobs' vehicles and
  // estimates, and their invoices — and the relationships page previewed six
  // segments in parallel, which meant six of those at once and a connection
  // pool with nothing left in it. The rules are applied in memory, so the
  // members are the same for all six. Phase 51.
  members?: SegmentMember[],
) {
  const people = members ?? (await segmentMembers(orgId, now));
  const segment = buildSegment(people, rules, channel);

  return { segment, plan: planCampaign(segment, channel) };
}

export async function listCampaigns(orgId: string) {
  // bounded: campaigns a workshop has written, by hand, one at a time.
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

  const people = await prisma.customer.findMany({
    where: { id: { in: segment.members.map((member) => member.customerId) } },
    select: { id: true, lastMarketedAt: true, email: true, mobile: true },
  });

  const lastMarketed = new Map(people.map((row) => [row.id, row.lastMarketedAt]));

  // Where the message is actually going. This used to write the customer's id
  // into the address field, so every campaign message reached the sender,
  // failed as an unusable address, and reported itself as sent.
  const addressOf = new Map(
    people.map((row) => [row.id, (channel === 'EMAIL' ? row.email : row.mobile) ?? null]),
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

    if (!decision.allowed) {
      suppressed.push({ customerId: member.customerId, reason: decision.reason });
      continue;
    }

    // Consent without an address is still nobody reached. Recording it as
    // suppressed with the reason is the difference between a campaign that
    // reports four hundred sent and one that says forty of them have no
    // address on file, which is a list somebody can go and fix.
    if (!addressOf.get(member.customerId)) {
      suppressed.push({
        customerId: member.customerId,
        reason: `No ${channel === 'EMAIL' ? 'email address' : 'mobile number'} on their record.`,
      });
      continue;
    }

    sent.push(member.customerId);
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

    // One trace for the whole campaign: a person pressed send once, and every
    // message it produced belongs to that press.
    const trace = await traceId();

    await tx.messageLog.createMany({
      data: sent.map((customerId) => ({
        traceId: trace,
        orgId: input.orgId,
        channel: campaign.channel,
        toAddress: addressOf.get(customerId)!,
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
  // The cohort table, computed where the rows are.
  //
  // Three versions of this function now exist in the history and the reason is
  // worth writing down. The first loaded every customer who had ever had a job
  // with all their jobs and invoices attached: nine seconds at a hundred
  // thousand customers. The second asked the database for one row per customer
  // instead of one per job, which was better and still wrong — a hundred
  // thousand rows, each carrying an array, held a connection long enough that
  // the rest of the page could not get one, and the screen went from slow to
  // broken.
  //
  // The question being asked is "for each month somebody first came, how many
  // of them came back in each of the following months". That is a hundred or
  // so numbers. Asking for a hundred thousand rows to compute a hundred
  // numbers was the mistake, not how the hundred thousand were fetched.
  const rows = await prisma.$queryRaw<
    { cohort: Date; offset: number; returned: bigint; size: bigint; lifetime: string | null }[]
  >`
    WITH done AS (
      SELECT "customerId", coalesce("completedAt", "createdAt") AS "at"
      FROM "jobs"
      WHERE "orgId" = ${orgId} AND "status"::text = ANY(${DONE_STATUSES as unknown as string[]})
    ),
    firsts AS (
      SELECT "customerId", date_trunc('month', min("at")) AS cohort
      FROM done GROUP BY "customerId"
    ),
    sizes AS (
      SELECT f.cohort,
             count(*) AS size,
             coalesce(sum(i.lifetime), 0)::text AS lifetime
      FROM firsts f
      LEFT JOIN (
        SELECT "customerId", sum("total") AS lifetime
        FROM "invoices"
        WHERE "orgId" = ${orgId} AND "status"::text = ANY(${BILLED_STATUSES as unknown as string[]})
        GROUP BY "customerId"
      ) i ON i."customerId" = f."customerId"
      GROUP BY f.cohort
    )
    SELECT
      f.cohort,
      (extract(year FROM age(date_trunc('month', d."at"), f.cohort)) * 12
        + extract(month FROM age(date_trunc('month', d."at"), f.cohort)))::int AS "offset",
      count(DISTINCT d."customerId") AS returned,
      s.size,
      s.lifetime
    FROM done d
    JOIN firsts f ON f."customerId" = d."customerId"
    JOIN sizes s ON s.cohort = f.cohort
    WHERE date_trunc('month', d."at") <= date_trunc('month', ${asOf}::timestamp)
    GROUP BY f.cohort, 2, s.size, s.lifetime
    HAVING (extract(year FROM age(date_trunc('month', d."at"), f.cohort)) * 12
        + extract(month FROM age(date_trunc('month', d."at"), f.cohort)))::int < ${months}
    ORDER BY f.cohort DESC, 2 ASC`;

  const byCohort = new Map<string, CohortRow>();

  for (const row of rows) {
    const key = row.cohort.toISOString().slice(0, 7);

    const existing =
      byCohort.get(key) ??
      ({
        cohort: key,
        size: Number(row.size),
        retention: [],
        lifetimeMinor: Math.round(Number(row.lifetime ?? 0) * 100),
      } satisfies CohortRow);

    // The offsets come back in order and with gaps where nobody returned, so
    // the gaps are filled rather than closed up: column three has to mean
    // three months later whether or not column two had anybody in it.
    while (existing.retention.length < row.offset) existing.retention.push(0);

    existing.retention.push(
      Number(row.size) === 0
        ? 0
        : Math.round((Number(row.returned) / Number(row.size)) * 1000) / 10,
    );

    byCohort.set(key, existing);
  }

  return [...byCohort.values()].sort((a, b) => b.cohort.localeCompare(a.cohort));
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
