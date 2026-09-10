import { describe, expect, it } from 'vitest';

import { toDecimalString } from '../shared/money';
import {
  buildSegment,
  type CohortRow,
  cohorts,
  type ConsentState,
  describeSegment,
  type FirstVisit,
  inSegment,
  lifetimeValue,
  mayMarket,
  mayNotify,
  MIN_DAYS_BETWEEN_MARKETING,
  planCampaign,
  type SegmentMember,
} from './crm';
import {
  type Action,
  assertRuleSound,
  type Condition,
  describeDelay,
  describeRule,
  evaluate,
  type Facts,
  fieldsFor,
  MAX_ACTIONS,
  matches,
  type Rule,
  type RuleError,
  schedule,
} from './rules';

/* ===========================================================================
   Rules
   =========================================================================== */

const EMAIL: Action = { kind: 'send.email', target: 'Thanks for your visit', delayHours: 24 };

const RULE: Rule = {
  id: 'r1',
  name: 'Thank the customer',
  trigger: 'job.completed',
  conditions: [{ field: 'job.total', is: 'gte', value: 10_000 }],
  actions: [EMAIL],
  isActive: true,
  cooldownHours: 24 * 30,
};

describe('writing a rule', () => {
  it('accepts a sound one', () => {
    expect(() => assertRuleSound(RULE)).not.toThrow();
  });

  it('refuses a rule with no actions', () => {
    // A workshop that builds a rule and sees nothing happen concludes the
    // feature is broken, and they are not wrong to.
    expect(() => assertRuleSound({ ...RULE, actions: [] })).toThrow(/does nothing/);
  });

  it('refuses more actions than anybody can predict', () => {
    const many = Array.from({ length: MAX_ACTIONS + 1 }, () => EMAIL);
    expect(() => assertRuleSound({ ...RULE, actions: many })).toThrow(/Split it/);
  });

  it('refuses a rule with no cooldown', () => {
    // The failure mode of automation is not doing nothing, it is doing
    // something forty times to one person.
    expect(() => assertRuleSound({ ...RULE, cooldownHours: 0 })).toThrow(/cooldown/);
  });

  it('refuses a condition the trigger cannot see', () => {
    // At job completion no invoice exists, so days overdue is unknowable and
    // the rule would silently never fire.
    expect(() =>
      assertRuleSound({
        ...RULE,
        conditions: [{ field: 'invoice.daysOverdue', is: 'gt', value: 30 }],
      }),
    ).toThrow(/would never fire/);
  });

  it('refuses two conditions that cannot both hold', () => {
    expect(() =>
      assertRuleSound({
        ...RULE,
        conditions: [
          { field: 'job.total', is: 'gt', value: 50_000 },
          { field: 'job.total', is: 'lt', value: 10_000 },
        ],
      }),
    ).toThrow(/would never fire/);
  });

  it('allows two conditions that narrow a range', () => {
    expect(() =>
      assertRuleSound({
        ...RULE,
        conditions: [
          { field: 'job.total', is: 'gte', value: 10_000 },
          { field: 'job.total', is: 'lte', value: 50_000 },
        ],
      }),
    ).not.toThrow();
  });

  it('names the fields each trigger can see', () => {
    expect(fieldsFor('invoice.overdue')).toContain('invoice.daysOverdue');
    expect(fieldsFor('job.completed')).not.toContain('invoice.daysOverdue');
  });

  it('describes itself in a sentence', () => {
    expect(describeRule(RULE)).toBe(
      'When a job is completed and the job total is at least 10000, email them "Thanks for your visit" after a day.',
    );
  });

  it('says delays the way a person would', () => {
    // "After 1 days" is the sort of thing that makes somebody distrust every
    // other number on the page.
    expect(describeDelay(0)).toBe('immediately');
    expect(describeDelay(1)).toBe('after an hour');
    expect(describeDelay(6)).toBe('after 6 hours');
    expect(describeDelay(24)).toBe('after a day');
    expect(describeDelay(72)).toBe('after 3 days');
  });

  it('carries a RuleError code', () => {
    try {
      assertRuleSound({ ...RULE, actions: [] });
    } catch (error) {
      expect((error as RuleError).code).toBe('NO_ACTIONS');
    }
  });
});

describe('conditions', () => {
  const facts: Facts = { 'job.total': 25_000, 'customer.visits': 3 };

  it('compares every way', () => {
    const cases: [Condition, boolean][] = [
      [{ field: 'job.total', is: 'eq', value: 25_000 }, true],
      [{ field: 'job.total', is: 'ne', value: 25_000 }, false],
      [{ field: 'job.total', is: 'gt', value: 24_999 }, true],
      [{ field: 'job.total', is: 'gte', value: 25_000 }, true],
      [{ field: 'job.total', is: 'lt', value: 25_000 }, false],
      [{ field: 'job.total', is: 'lte', value: 25_000 }, true],
    ];

    for (const [condition, expected] of cases) {
      expect(matches(condition, facts)).toBe(expected);
    }
  });

  it('treats a missing fact as no match, never as zero', () => {
    // Treating it as zero would fire every "less than" rule on incomplete
    // data, which is the worst possible default.
    expect(matches({ field: 'vehicle.mileage', is: 'lt', value: 100 }, facts)).toBe(false);
  });
});

describe('evaluating a rule', () => {
  const facts: Facts = { 'job.total': 25_000 };
  const context = { event: 'job.completed' as const, now: new Date('2026-09-08T12:00:00') };

  it('fires when everything holds', () => {
    const decision = evaluate(RULE, facts, context);

    expect(decision.fires).toBe(true);
    expect(decision.actions).toHaveLength(1);
  });

  it('says which condition stopped it', () => {
    // A rule nobody can see the reasoning behind is one nobody trusts, and an
    // automation nobody trusts gets turned off.
    const decision = evaluate(RULE, { 'job.total': 5_000 }, context);

    expect(decision.fires).toBe(false);
    expect(decision.blockedBy?.field).toBe('job.total');
    expect(decision.reason).toMatch(/is 5000, and the rule needs it is at least 10000/);
  });

  it('says when a fact is simply unknown', () => {
    const decision = evaluate(RULE, {}, context);
    expect(decision.reason).toMatch(/is not known here/);
  });

  it('does not fire on a different event', () => {
    const decision = evaluate(RULE, facts, { ...context, event: 'invoice.issued' });

    expect(decision.fires).toBe(false);
    expect(decision.reason).toMatch(/listens for a job is completed/);
  });

  it('does not fire while switched off', () => {
    expect(evaluate({ ...RULE, isActive: false }, facts, context).fires).toBe(false);
  });

  it('honours the cooldown, and says how long is left', () => {
    const decision = evaluate(RULE, facts, {
      ...context,
      lastRunAt: new Date('2026-09-07T12:00:00'),
    });

    expect(decision.fires).toBe(false);
    expect(decision.reason).toMatch(/Already acted on this one 24 hours ago/);
  });

  it('fires again once the cooldown has passed', () => {
    const decision = evaluate(RULE, facts, {
      ...context,
      lastRunAt: new Date('2026-06-01T12:00:00'),
    });

    expect(decision.fires).toBe(true);
  });

  it('schedules each action by its delay', () => {
    const from = new Date('2026-09-08T09:00:00');
    const planned = schedule([EMAIL, { ...EMAIL, delayHours: 0 }], from);

    expect(planned[0]!.dueAt.getTime() - from.getTime()).toBe(24 * 3_600_000);
    expect(planned[1]!.dueAt.getTime()).toBe(from.getTime());
  });
});

/* ===========================================================================
   Consent
   =========================================================================== */

const FULL: ConsentState = { email: true, sms: true, hasEmail: true, hasMobile: true };

describe('consent', () => {
  it('allows a marketing message when they agreed', () => {
    expect(mayMarket({ channel: 'EMAIL', consent: FULL }).allowed).toBe(true);
  });

  it('refuses when they did not agree', () => {
    const decision = mayMarket({ channel: 'SMS', consent: { ...FULL, sms: false } });

    expect(decision.refusal).toBe('NO_CONSENT');
    expect(decision.reason).toMatch(/have not agreed/);
  });

  it('refuses when there is nowhere to send', () => {
    const decision = mayMarket({ channel: 'EMAIL', consent: { ...FULL, hasEmail: false } });
    expect(decision.refusal).toBe('NO_ADDRESS');
  });

  it('refuses to market again too soon', () => {
    const decision = mayMarket({
      channel: 'EMAIL',
      consent: FULL,
      lastMarketedAt: new Date('2026-09-05'),
      now: new Date('2026-09-08'),
    });

    expect(decision.refusal).toBe('RECENTLY_CONTACTED');
    expect(MIN_DAYS_BETWEEN_MARKETING).toBeGreaterThan(3);
  });

  it('allows it again once enough time has passed', () => {
    const decision = mayMarket({
      channel: 'EMAIL',
      consent: FULL,
      lastMarketedAt: new Date('2026-07-01'),
      now: new Date('2026-09-08'),
    });

    expect(decision.allowed).toBe(true);
  });

  it('never gates a message about their own work on marketing consent', () => {
    // Somebody who asked for work done has asked to be told about it.
    const noMarketing: ConsentState = { ...FULL, email: false, sms: false };

    expect(mayNotify({ channel: 'EMAIL', consent: noMarketing }).allowed).toBe(true);
  });

  it('still needs somewhere to send a transactional message', () => {
    expect(mayNotify({ channel: 'SMS', consent: { ...FULL, hasMobile: false } }).allowed).toBe(
      false,
    );
  });
});

/* ===========================================================================
   Segments
   =========================================================================== */

const MEMBER: SegmentMember = {
  customerId: 'c1',
  name: 'Maria Okonkwo',
  visits: 4,
  lifetimeMinor: 120_000,
  daysSinceLastVisit: 400,
  oldestVehicleYears: 9,
  declinedSinceDays: 20,
  consent: FULL,
};

describe('segments', () => {
  it('matches on every rule shape', () => {
    expect(inSegment(MEMBER, { kind: 'lapsed', days: 365 })).toBe(true);
    expect(inSegment(MEMBER, { kind: 'spent-over', minorUnits: 100_000 })).toBe(true);
    expect(inSegment(MEMBER, { kind: 'visits-at-least', count: 4 })).toBe(true);
    expect(inSegment(MEMBER, { kind: 'has-vehicle-older-than', years: 8 })).toBe(true);
    expect(inSegment(MEMBER, { kind: 'never-returned' })).toBe(false);
    expect(inSegment(MEMBER, { kind: 'declined-work-since', days: 30 })).toBe(true);
  });

  it('requires every rule to hold, not any', () => {
    const result = buildSegment(
      [MEMBER],
      [
        { kind: 'lapsed', days: 365 },
        { kind: 'spent-over', minorUnits: 500_000 },
      ],
      'EMAIL',
    );

    expect(result.members).toHaveLength(0);
  });

  it('separates who can actually be contacted', () => {
    // A campaign reporting 480 customers when 90 have no consent is reporting
    // an intention, not a send.
    const members: SegmentMember[] = [
      MEMBER,
      { ...MEMBER, customerId: 'c2', consent: { ...FULL, email: false } },
      { ...MEMBER, customerId: 'c3', consent: { ...FULL, hasEmail: false } },
    ];

    const result = buildSegment(members, [{ kind: 'lapsed', days: 365 }], 'EMAIL');

    expect(result.members).toHaveLength(3);
    expect(result.reachable).toHaveLength(1);
    expect(result.unreachable).toHaveLength(2);
  });

  it('totals what the segment is worth', () => {
    const result = buildSegment([MEMBER], [], 'EMAIL');
    expect(toDecimalString(result.totalValue)).toBe('1200.00');
  });

  it('describes each rule in words', () => {
    expect(describeSegment({ kind: 'never-returned' })).toBe('Came once and never came back');
    expect(describeSegment({ kind: 'spent-over', minorUnits: 50_000 })).toMatch(/£500/);
  });

  it('treats somebody with no visit history as not lapsed', () => {
    const never = { ...MEMBER, daysSinceLastVisit: null };
    expect(inSegment(never, { kind: 'lapsed', days: 30 })).toBe(false);
  });
});

/* ===========================================================================
   Campaigns
   =========================================================================== */

describe('planning a campaign', () => {
  const members: SegmentMember[] = [
    MEMBER,
    { ...MEMBER, customerId: 'c2', consent: { ...FULL, email: false } },
    { ...MEMBER, customerId: 'c3', consent: { ...FULL, email: false } },
  ];

  it('counts who will and will not be sent to', () => {
    const plan = planCampaign(buildSegment(members, [], 'EMAIL'), 'EMAIL');

    expect(plan.recipients).toBe(1);
    expect(plan.suppressed).toBe(2);
  });

  it('warns when more of the segment cannot be reached than can', () => {
    const plan = planCampaign(buildSegment(members, [], 'EMAIL'), 'EMAIL');
    expect(plan.warnings.some((warning) => warning.includes('cannot be reached'))).toBe(true);
  });

  it('says how many have not agreed', () => {
    const plan = planCampaign(buildSegment(members, [], 'EMAIL'), 'EMAIL');
    expect(plan.warnings.some((warning) => warning.includes('not agreed to marketing'))).toBe(true);
  });

  it('warns when nobody at all can be contacted', () => {
    const nobody = members.map((member) => ({
      ...member,
      consent: { ...FULL, email: false },
    }));

    const plan = planCampaign(buildSegment(nobody, [], 'EMAIL'), 'EMAIL');
    expect(plan.warnings[0]).toMatch(/Nobody in this segment/);
  });

  it('estimates the cost of a text campaign and nothing for email', () => {
    const segment = buildSegment([MEMBER], [], 'SMS');

    expect(planCampaign(segment, 'SMS').estimatedCost.minor).toBeGreaterThan(0);
    expect(planCampaign(segment, 'EMAIL').estimatedCost.minor).toBe(0);
  });
});

/* ===========================================================================
   Cohorts
   =========================================================================== */

describe('cohorts', () => {
  const asOf = new Date('2026-09-30');

  const customers: FirstVisit[] = [
    {
      customerId: 'a',
      firstVisit: new Date('2026-01-15'),
      visits: [new Date('2026-01-15'), new Date('2026-03-10')],
      lifetimeMinor: 40_000,
    },
    {
      customerId: 'b',
      firstVisit: new Date('2026-01-20'),
      visits: [new Date('2026-01-20')],
      lifetimeMinor: 12_000,
    },
    {
      customerId: 'c',
      firstVisit: new Date('2026-03-02'),
      visits: [new Date('2026-03-02'), new Date('2026-05-04')],
      lifetimeMinor: 30_000,
    },
  ];

  it('groups by the month somebody first arrived', () => {
    const rows = cohorts(customers, 12, asOf);

    expect(rows.map((row) => row.cohort)).toEqual(['2026-03', '2026-01']);
    expect(rows.find((row) => row.cohort === '2026-01')?.size).toBe(2);
  });

  it('counts everybody as present in their first month', () => {
    const january = cohorts(customers, 12, asOf).find((row) => row.cohort === '2026-01')!;
    expect(january.retention[0]).toBe(100);
  });

  it('measures who came back, by months since their first visit', () => {
    // One of the two January customers returned in March, two months on.
    const january = cohorts(customers, 12, asOf).find((row) => row.cohort === '2026-01')!;

    expect(january.retention[1]).toBe(0);
    expect(january.retention[2]).toBe(50);
  });

  it('stops a cohort short rather than reporting a cliff', () => {
    // A cohort three months old has not had twelve months to return in.
    // Including it in a twelve-month column produces a fall that is purely
    // arithmetic.
    const march = cohorts(customers, 12, asOf).find((row) => row.cohort === '2026-03')!;

    expect(march.retention.length).toBeLessThan(12);
    expect(march.retention.length).toBe(7);
  });

  it('reports what a customer from a cohort is worth', () => {
    const january = cohorts(customers, 12, asOf).find((row) => row.cohort === '2026-01')!;
    expect(toDecimalString(lifetimeValue(january))).toBe('260.00');
  });

  it('reports nothing rather than dividing by zero on an empty cohort', () => {
    const empty: CohortRow = { cohort: '2026-01', size: 0, retention: [], lifetimeMinor: 0 };
    expect(lifetimeValue(empty).minor).toBe(0);
  });
});
