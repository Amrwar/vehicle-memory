import type { SummaryFacts } from './summary';

/**
 * The assistant inside the workflow. Phase 22, ADR-0013.
 *
 * Three things a person can ask it for, and the rule that governs all
 * three: it composes from the record and decides nothing. A question goes to
 * the same router the Ask page uses. A draft message to a customer is written
 * from the job's own facts, in plain sentences, and a person sends it or does
 * not. An explanation of a job is the job's state read back as prose so that
 * somebody picking it up cold knows where it stands. Where a model is
 * configured it may tidy the prose, and its output is checked against the
 * facts before anybody sees it; where it is not, or the month's budget is
 * spent, the plain version is what the person gets, and it is complete.
 */

export type AssistantKind = 'QUESTION' | 'DRAFT' | 'EXPLAIN';

export type DraftKind = 'PROGRESS' | 'WAITING_ON_APPROVAL' | 'READY';

export const DRAFT_KINDS: readonly { kind: DraftKind; label: string; when: string }[] = [
  {
    kind: 'PROGRESS',
    label: 'Progress update',
    when: 'The work is under way and the customer has heard nothing since drop-off',
  },
  {
    kind: 'WAITING_ON_APPROVAL',
    label: 'Waiting on a decision',
    when: 'An estimate has been sent and not answered',
  },
  {
    kind: 'READY',
    label: 'Ready for collection',
    when: 'The work is complete and the car can be collected',
  },
];

export interface DraftFacts extends SummaryFacts {
  jobNumber: number;
  status: string;
  promisedAt: Date | null;
  estimateTotal: string | null;
  /** Hours the workshop is open, for "we are here until". */
  closesAt: string | null;
}

/**
 * A message to the customer, from the job's facts and nothing else.
 *
 * Short, because it goes to a phone. No adjectives about the work. Every
 * number in it is a fact the job carries, which is what lets the model's
 * tidied version be checked against the same facts.
 */
export function draftMessage(kind: DraftKind, facts: DraftFacts): string {
  const car = [facts.vehicle, facts.registration ? `(${facts.registration})` : null]
    .filter(Boolean)
    .join(' ');
  const lines: string[] = [
    `Hello ${facts.customerFirstName}, ${facts.workshopName} here about your ${car}.`,
  ];

  if (kind === 'PROGRESS') {
    if (facts.labour.length > 0) {
      lines.push(
        `We are working on: ${facts.labour.map((line) => line.description.toLowerCase()).join(', ')}.`,
      );
    } else {
      lines.push('The work is under way.');
    }
    if (facts.findings.some((finding) => finding.severity === 'CRITICAL')) {
      lines.push(
        'The inspection found something that needs your attention before the car goes back on the road; we will send the detail separately.',
      );
    }
    if (facts.promisedAt) {
      lines.push(
        `We expect it to be ready by ${facts.promisedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`,
      );
    }
  }

  if (kind === 'WAITING_ON_APPROVAL') {
    lines.push(
      facts.estimateTotal
        ? `We have sent you an estimate for ${facts.estimateTotal} and are waiting on your decision before going further.`
        : 'We have sent you an estimate and are waiting on your decision before going further.',
    );
    lines.push(
      'Nothing on it is started until you say so, and you can approve or decline each line.',
    );
  }

  if (kind === 'READY') {
    lines.push(`Your car is ready to collect. Job ${facts.jobNumber}.`);
    if (facts.total) lines.push(`The total is ${facts.total}.`);
    if (facts.declined.length > 0) {
      lines.push(`Not done, at your request: ${facts.declined.join(', ')}.`);
    }
    if (facts.closesAt) lines.push(`We are here until ${facts.closesAt} today.`);
  }

  lines.push(`Reply to this message if anything is unclear.`);
  return lines.join(' ');
}

/**
 * What a draft may say beyond the summary facts: the job number, the closing
 * time, the promised day, the estimate. Handed to `verifyAgainstFacts` so a
 * model's tidied draft is checked against the same set the plain one used.
 */
export function draftAllowances(facts: DraftFacts): (string | number | null)[] {
  return [
    facts.jobNumber,
    facts.closesAt,
    facts.estimateTotal,
    facts.promisedAt ? facts.promisedAt.getDate() : null,
    facts.promisedAt ? facts.promisedAt.getFullYear() : null,
  ];
}

/** The state of a job, as facts. */
export interface JobStory {
  jobNumber: number;
  status: string;
  shortDescription: string;
  customerName: string;
  vehicle: string;
  registration: string | null;
  technician: string | null;
  promisedAt: Date | null;
  openedAt: Date;
  estimate: { status: string; total: string | null; sentAt: Date | null } | null;
  partsRequested: number;
  partsReserved: number;
  findings: { critical: number; advisory: number };
  invoice: { number: string; status: string; outstanding: string | null } | null;
  hoursLogged: number;
}

const STATUS_IN_WORDS: Record<string, string> = {
  DRAFT: 'not yet opened',
  BOOKED: 'booked and not yet in',
  RECEIVED: 'in the building, not yet looked at',
  INSPECTING: 'being inspected',
  DIAGNOSED: 'diagnosed, not yet quoted',
  ESTIMATED: 'quoted, not yet sent',
  AWAITING_APPROVAL: 'waiting on the customer',
  APPROVED: 'approved and waiting to start',
  IN_PROGRESS: 'being worked on',
  QUALITY_CHECK: 'finished and waiting for a second pair of eyes',
  COMPLETED: 'complete and not yet invoiced',
  INVOICED: 'invoiced and not yet paid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

/**
 * Where a job stands, in sentences somebody picking it up cold can act on.
 *
 * It says what is blocking, if anything, before it says anything else,
 * because that is the question the person actually has.
 */
export function explainJob(story: JobStory, now = new Date()): string {
  const car = [story.vehicle, story.registration ? `(${story.registration})` : null]
    .filter(Boolean)
    .join(' ');
  const lines: string[] = [];

  lines.push(
    `Job ${story.jobNumber}: ${story.customerName}'s ${car}, in for "${story.shortDescription}", is ${STATUS_IN_WORDS[story.status] ?? story.status.toLowerCase()}.`,
  );

  const blockers: string[] = [];
  if (story.status === 'AWAITING_APPROVAL' && story.estimate) {
    const days = story.estimate.sentAt
      ? Math.floor((now.getTime() - story.estimate.sentAt.getTime()) / 86_400_000)
      : null;
    blockers.push(
      `the estimate${story.estimate.total ? ` for ${story.estimate.total}` : ''} has been with the customer${days !== null ? ` for ${days} day${days === 1 ? '' : 's'}` : ''}`,
    );
  }
  if (story.partsRequested > 0) {
    blockers.push(
      `${story.partsRequested} part${story.partsRequested === 1 ? ' is' : 's are'} requested and not on the shelf`,
    );
  }
  if (story.status === 'QUALITY_CHECK')
    blockers.push('it needs a quality check before it can be completed');
  if (blockers.length > 0) lines.push(`Waiting on: ${blockers.join('; ')}.`);

  if (story.findings.critical > 0 || story.findings.advisory > 0) {
    lines.push(
      `The inspection found ${story.findings.critical} critical and ${story.findings.advisory} advisory item${story.findings.advisory === 1 ? '' : 's'}.`,
    );
  }

  if (story.technician)
    lines.push(
      `${story.technician} has it${story.hoursLogged > 0 ? `, with ${story.hoursLogged} hours logged` : ''}.`,
    );
  else lines.push('Nobody is assigned to it yet.');

  if (story.promisedAt) {
    const late =
      story.promisedAt < now &&
      !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(story.status);
    lines.push(
      `${late ? 'It was promised for' : 'Promised for'} ${story.promisedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${late ? ', which has passed' : ''}.`,
    );
  }

  if (story.invoice) {
    lines.push(
      story.invoice.outstanding
        ? `Invoice ${story.invoice.number} is ${story.invoice.status.toLowerCase()} with ${story.invoice.outstanding} outstanding.`
        : `Invoice ${story.invoice.number} is ${story.invoice.status.toLowerCase()}.`,
    );
  }

  return lines.join(' ');
}

/* ------------------------------------------------------------------ budget */

export interface BudgetState {
  monthlyTokenBudget: number;
  usedInputTokens: number;
  usedOutputTokens: number;
}

export interface BudgetDecision {
  /** Whether a model may be called for the next exchange. */
  allowed: boolean;
  used: number;
  remaining: number;
  statement: string;
}

export function assistantBudget(state: BudgetState): BudgetDecision {
  const used = state.usedInputTokens + state.usedOutputTokens;
  const remaining = Math.max(0, state.monthlyTokenBudget - used);
  const allowed = state.monthlyTokenBudget > 0 && used < state.monthlyTokenBudget;
  const pct =
    state.monthlyTokenBudget > 0 ? Math.round((used / state.monthlyTokenBudget) * 100) : 0;

  return {
    allowed,
    used,
    remaining,
    statement:
      state.monthlyTokenBudget === 0
        ? 'The model is switched off for this workshop; the assistant uses the plain text.'
        : allowed
          ? `${used.toLocaleString('en-GB')} of ${state.monthlyTokenBudget.toLocaleString('en-GB')} tokens used this month (${pct}%).`
          : `This month's ${state.monthlyTokenBudget.toLocaleString('en-GB')} tokens are spent; the assistant is using the plain text until the month turns.`,
  };
}

/**
 * Rough cost, in minor units of USD, at list prices per million tokens.
 * Illustrative: shown to the owner so the budget means something in money,
 * and updated when the prices change, not authoritative for billing.
 */
export const MODEL_PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-5': { input: 15, output: 75 },
};

export function estimateCostMinor(
  inputTokens: number,
  outputTokens: number,
  model: string | null,
): number {
  const price = (model ? MODEL_PRICES_PER_MILLION[model] : undefined) ?? { input: 3, output: 15 };
  const dollars = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(dollars * 100);
}

/** One line for the list of exchanges. */
export function describeExchange(exchange: {
  kind: AssistantKind;
  polished: boolean;
  rejected: string | null;
  model: string | null;
}): string {
  const what =
    exchange.kind === 'QUESTION'
      ? 'Answered from the records'
      : exchange.kind === 'DRAFT'
        ? 'Drafted from the job'
        : 'Explained from the job';
  if (exchange.polished && exchange.model)
    return `${what}, tidied by ${exchange.model} and checked.`;
  if (exchange.rejected) return `${what}; the model's version was not used: ${exchange.rejected}`;
  return `${what}, plain.`;
}
