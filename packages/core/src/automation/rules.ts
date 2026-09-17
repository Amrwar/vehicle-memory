/**
 * Trigger, condition, action.
 *
 * The engine a workshop uses to stop doing the same thing by hand every
 * Tuesday. Three deliberate constraints shape it, and each one exists because
 * of how these engines fail rather than how they work.
 *
 * A rule cannot trigger a rule. Chained automation is impossible to reason
 * about after the third link and impossible to debug at all: somebody sees a
 * message go out and no rule they can find sent it. Every run here comes from
 * a real event.
 *
 * Every rule is rate limited per subject. The failure mode of automation is
 * not doing nothing, it is doing something forty times to one person, and by
 * the time anybody notices the messages have been sent.
 *
 * A rule that would do nothing is refused when it is written rather than
 * shrugged at when it runs. A workshop that builds a rule and sees no effect
 * concludes the feature does not work, and they are not wrong to.
 */

export type TriggerEvent =
  | 'job.completed'
  | 'job.awaiting_approval'
  | 'invoice.issued'
  | 'invoice.overdue'
  | 'booking.created'
  | 'booking.missed'
  | 'service.due'
  // An MOT falling due was offered here and could never fire: nothing in this
  // product records an MOT expiry date, so there was no moment for it to
  // happen at. Offering a trigger the data cannot supply means a workshop
  // writes a rule, watches for it, and slowly stops trusting the rest. Phase
  // 46.6. It comes back the day a vehicle carries its MOT date.
  | 'estimate.declined'
  | 'customer.lapsing';

export type ActionKind = 'send.email' | 'send.sms' | 'task.create' | 'tag.add' | 'booking.suggest';

export type ConditionField =
  | 'invoice.total'
  | 'invoice.daysOverdue'
  | 'customer.lifetimeValue'
  | 'customer.visits'
  | 'customer.daysSinceLastVisit'
  | 'vehicle.ageYears'
  | 'vehicle.mileage'
  | 'job.total'
  | 'estimate.total';

export type Comparison = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export interface Condition {
  field: ConditionField;
  is: Comparison;
  /** Money in minor units, everything else in its own unit. */
  value: number;
}

export interface Action {
  kind: ActionKind;
  /** Template name for a message, tag name for a tag, title for a task. */
  target: string;
  /** Hours to wait after the trigger before doing it. */
  delayHours: number;
}

export interface Rule {
  id: string;
  name: string;
  trigger: TriggerEvent;
  /** All must hold. Deliberately not "any": an or-rule that fires too widely
   *  is the one nobody can work out afterwards. Two rules are clearer. */
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  /** The same subject cannot be acted on again inside this window. */
  cooldownHours: number;
}

export class RuleError extends Error {
  readonly code: 'NO_ACTIONS' | 'NO_COOLDOWN' | 'IMPOSSIBLE' | 'BAD_FIELD' | 'TOO_MANY_ACTIONS';

  constructor(code: RuleError['code'], message: string) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

/** More than this in one rule and nobody can predict what it does. */
export const MAX_ACTIONS = 5;

/** Nothing may act on the same subject more than once in this window. */
export const MIN_COOLDOWN_HOURS = 1;

/**
 * Which fields a trigger can actually see.
 *
 * A rule on job completion cannot test days overdue, because at that moment
 * no invoice exists. Allowing it produces a rule that silently never fires,
 * which is the worst outcome: the workshop believes it is covered.
 */
const AVAILABLE: Record<TriggerEvent, ConditionField[]> = {
  'job.completed': [
    'job.total',
    'customer.lifetimeValue',
    'customer.visits',
    'vehicle.ageYears',
    'vehicle.mileage',
  ],
  'job.awaiting_approval': ['estimate.total', 'customer.lifetimeValue', 'customer.visits'],
  'invoice.issued': ['invoice.total', 'customer.lifetimeValue', 'customer.visits'],
  'invoice.overdue': ['invoice.total', 'invoice.daysOverdue', 'customer.lifetimeValue'],
  'booking.created': ['customer.visits', 'customer.daysSinceLastVisit'],
  'booking.missed': ['customer.visits', 'customer.daysSinceLastVisit'],
  'service.due': ['vehicle.ageYears', 'vehicle.mileage', 'customer.daysSinceLastVisit'],
  'estimate.declined': ['estimate.total', 'customer.lifetimeValue'],
  'customer.lapsing': ['customer.lifetimeValue', 'customer.visits', 'customer.daysSinceLastVisit'],
};

export function fieldsFor(trigger: TriggerEvent): ConditionField[] {
  return AVAILABLE[trigger];
}

export function describeTrigger(trigger: TriggerEvent): string {
  switch (trigger) {
    case 'job.completed':
      return 'a job is completed';
    case 'job.awaiting_approval':
      return 'a job is waiting on the customer';
    case 'invoice.issued':
      return 'an invoice is issued';
    case 'invoice.overdue':
      return 'an invoice goes overdue';
    case 'booking.created':
      return 'a booking is made';
    case 'booking.missed':
      return 'somebody does not turn up';
    case 'service.due':
      return 'a service falls due';
    case 'estimate.declined':
      return 'an estimate is declined';
    case 'customer.lapsing':
      return 'a customer stops coming';
  }
}

export function describeField(field: ConditionField): string {
  switch (field) {
    case 'invoice.total':
      return 'the invoice total';
    case 'invoice.daysOverdue':
      return 'days overdue';
    case 'customer.lifetimeValue':
      return 'what the customer has spent with you';
    case 'customer.visits':
      return 'how many times they have been in';
    case 'customer.daysSinceLastVisit':
      return 'days since their last visit';
    case 'vehicle.ageYears':
      return "the vehicle's age in years";
    case 'vehicle.mileage':
      return 'the mileage';
    case 'job.total':
      return 'the job total';
    case 'estimate.total':
      return 'the estimate total';
  }
}

export function describeComparison(is: Comparison): string {
  switch (is) {
    case 'eq':
      return 'is';
    case 'ne':
      return 'is not';
    case 'gt':
      return 'is more than';
    case 'gte':
      return 'is at least';
    case 'lt':
      return 'is less than';
    case 'lte':
      return 'is at most';
  }
}

export function describeAction(action: Action): string {
  const when = describeDelay(action.delayHours);

  switch (action.kind) {
    case 'send.email':
      return `email them "${action.target}" ${when}`;
    case 'send.sms':
      return `text them "${action.target}" ${when}`;
    case 'task.create':
      return `create a task "${action.target}" ${when}`;
    case 'tag.add':
      return `tag them "${action.target}"`;
    case 'booking.suggest':
      return `offer them a booking ${when}`;
  }
}

/**
 * A delay, said the way somebody would say it.
 *
 * Pluralised, because "after 1 days" is the sort of thing that makes a person
 * distrust every other number on the page. A whole day is a day rather than
 * twenty-four hours, which is what the person writing the rule meant.
 */
export function describeDelay(hours: number): string {
  if (hours === 0) return 'immediately';
  if (hours === 1) return 'after an hour';
  if (hours < 24) return `after ${hours} hours`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'after a day' : `after ${days} days`;
}

/** A rule in one sentence, for the page and for an audit entry. */
export function describeRule(rule: Rule): string {
  const conditions =
    rule.conditions.length === 0
      ? ''
      : ` and ${rule.conditions
          .map(
            (condition) =>
              `${describeField(condition.field)} ${describeComparison(condition.is)} ${condition.value}`,
          )
          .join(' and ')}`;

  return `When ${describeTrigger(rule.trigger)}${conditions}, ${rule.actions.map(describeAction).join(', then ')}.`;
}

/* ---------------------------------------------------------------------------
   Validation
   --------------------------------------------------------------------------- */

/**
 * Refuses a rule that cannot work, at the moment somebody writes it.
 *
 * A workshop that builds a rule, sees nothing happen, and finds no explanation
 * concludes the whole feature is broken. They are not wrong to. So every way a
 * rule can be inert is caught here with a sentence saying which.
 */
export function assertRuleSound(rule: Rule): void {
  if (rule.actions.length === 0) {
    throw new RuleError('NO_ACTIONS', 'This rule does nothing. Add at least one action.');
  }

  if (rule.actions.length > MAX_ACTIONS) {
    throw new RuleError(
      'TOO_MANY_ACTIONS',
      `More than ${MAX_ACTIONS} actions in one rule and nobody can predict what it does. Split it.`,
    );
  }

  if (rule.cooldownHours < MIN_COOLDOWN_HOURS) {
    throw new RuleError(
      'NO_COOLDOWN',
      'A rule needs a cooldown. Without one it can act on the same person repeatedly, and by the time anybody notices the messages have gone.',
    );
  }

  const allowed = AVAILABLE[rule.trigger];

  for (const condition of rule.conditions) {
    if (!allowed.includes(condition.field)) {
      throw new RuleError(
        'BAD_FIELD',
        `${capitalise(describeField(condition.field))} is not known when ${describeTrigger(rule.trigger)}. This rule would never fire.`,
      );
    }
  }

  // Two conditions on one field that cannot both hold.
  for (const [index, condition] of rule.conditions.entries()) {
    for (const other of rule.conditions.slice(index + 1)) {
      if (other.field !== condition.field) continue;

      if (contradicts(condition, other)) {
        throw new RuleError(
          'IMPOSSIBLE',
          `${capitalise(describeField(condition.field))} cannot be both ${describeComparison(condition.is)} ${condition.value} and ${describeComparison(other.is)} ${other.value}. This rule would never fire.`,
        );
      }
    }
  }
}

function contradicts(a: Condition, b: Condition): boolean {
  const upper = (condition: Condition) =>
    condition.is === 'lt'
      ? condition.value - 1
      : condition.is === 'lte'
        ? condition.value
        : condition.is === 'eq'
          ? condition.value
          : Number.POSITIVE_INFINITY;

  const lower = (condition: Condition) =>
    condition.is === 'gt'
      ? condition.value + 1
      : condition.is === 'gte'
        ? condition.value
        : condition.is === 'eq'
          ? condition.value
          : Number.NEGATIVE_INFINITY;

  return Math.max(lower(a), lower(b)) > Math.min(upper(a), upper(b));
}

/* ---------------------------------------------------------------------------
   Evaluation
   --------------------------------------------------------------------------- */

export type Facts = Partial<Record<ConditionField, number>>;

export function matches(condition: Condition, facts: Facts): boolean {
  const actual = facts[condition.field];

  // A fact that is not there is not a match. Treating a missing figure as
  // zero would fire every "less than" rule on incomplete data.
  if (actual === undefined) return false;

  switch (condition.is) {
    case 'eq':
      return actual === condition.value;
    case 'ne':
      return actual !== condition.value;
    case 'gt':
      return actual > condition.value;
    case 'gte':
      return actual >= condition.value;
    case 'lt':
      return actual < condition.value;
    case 'lte':
      return actual <= condition.value;
  }
}

export interface RuleDecision {
  fires: boolean;
  /** Which condition stopped it, for the page that explains a quiet rule. */
  blockedBy: Condition | null;
  reason: string;
  actions: Action[];
}

/**
 * Whether a rule fires, and why not when it does not.
 *
 * The "why not" is the part that matters. A rule nobody can see the reasoning
 * behind is one nobody trusts, and an automation nobody trusts gets turned off
 * and replaced with a person doing it by hand again.
 */
export function evaluate(
  rule: Rule,
  facts: Facts,
  context: { event: TriggerEvent; lastRunAt?: Date | null; now?: Date },
): RuleDecision {
  const now = context.now ?? new Date();

  if (!rule.isActive) {
    return { fires: false, blockedBy: null, reason: 'The rule is switched off.', actions: [] };
  }

  if (context.event !== rule.trigger) {
    return {
      fires: false,
      blockedBy: null,
      reason: `This rule listens for ${describeTrigger(rule.trigger)}.`,
      actions: [],
    };
  }

  if (context.lastRunAt) {
    const hoursSince = (now.getTime() - context.lastRunAt.getTime()) / 3_600_000;

    if (hoursSince < rule.cooldownHours) {
      return {
        fires: false,
        blockedBy: null,
        reason: `Already acted on this one ${Math.round(hoursSince)} hours ago, and the cooldown is ${rule.cooldownHours}.`,
        actions: [],
      };
    }
  }

  for (const condition of rule.conditions) {
    if (matches(condition, facts)) continue;

    const actual = facts[condition.field];

    return {
      fires: false,
      blockedBy: condition,
      reason:
        actual === undefined
          ? `${capitalise(describeField(condition.field))} is not known here.`
          : `${capitalise(describeField(condition.field))} is ${actual}, and the rule needs it ${describeComparison(condition.is)} ${condition.value}.`,
      actions: [],
    };
  }

  return {
    fires: true,
    blockedBy: null,
    reason: `Everything the rule asks for holds.`,
    actions: rule.actions,
  };
}

/** When each action of a fired rule should happen. */
export function schedule(actions: readonly Action[], from: Date = new Date()) {
  return actions.map((action) => ({
    action,
    dueAt: new Date(from.getTime() + action.delayHours * 3_600_000),
  }));
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
