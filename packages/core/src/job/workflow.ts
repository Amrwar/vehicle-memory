/**
 * The five workflows, counted in presses. Phase 34.
 *
 * A workshop does not buy features; it buys the number of times somebody at
 * the counter has to press something, and the number of screens they have to
 * find, between a car arriving and the money being in the bank. This file is
 * that count, written down, so that it can be tested against and so that the
 * next phase that adds a screen has to say why.
 *
 * A "press" is one deliberate act by a person: a button, a link, a choice in
 * a list. Typing into a field is not a press; the button that submits it is.
 * A hand-off is the moment the work passes from one person or screen to the
 * next. Each hand-off names the screen it happens on, and the walkthrough
 * script fails if a step needs a screen its hand-off does not name.
 *
 * `before` is the count as it stood at the end of Phase 33. `presses` is the
 * count now. The two are kept side by side on purpose: a count with no
 * history is a number, and a number nobody remembers reducing is one that
 * will quietly grow back.
 */

export type Screen =
  | 'diary'
  | 'booking'
  | 'job'
  | 'check-in'
  | 'check-out'
  | 'tablet'
  | 'customer phone'
  | 'invoice'
  | 'today'
  | 'passport';

export interface Handoff {
  /** What passes from whom to whom. */
  readonly name: string;
  /** The one screen it happens on. */
  readonly screen: Screen;
  /** Presses at the end of Phase 33. */
  readonly before: number;
  /** Presses now. */
  readonly presses: number;
  /** What changed, when the count did. */
  readonly note?: string;
}

export interface Workflow {
  readonly id: 'arrives' | 'needs-work' | 'completed' | 'returns' | 'owner';
  readonly title: string;
  readonly handoffs: readonly Handoff[];
}

export const WORKFLOWS: readonly Workflow[] = [
  {
    id: 'arrives',
    title: 'The customer arrives',
    handoffs: [
      {
        name: 'Booking to job, at the desk',
        screen: 'booking',
        before: 6,
        presses: 1,
        note: 'One button on the booking opens the job with the customer, the vehicle, the description and the technician already on it. Before, the desk opened a new-job form and chose the customer, the vehicle and the technician again, then typed the description a second time.',
      },
      {
        name: 'Car checked in',
        screen: 'check-in',
        before: 1,
        presses: 1,
        note: 'New in Phase 35, counted from its first day. The booking button lands on the check-in: mileage, fuel, a walk round the car, what was left inside, the hook, a signature, one press. Photographs go on the record it makes.',
      },
      {
        name: 'Job to the technician',
        screen: 'job',
        before: 1,
        presses: 1,
        note: 'Start the work.',
      },
      {
        name: 'Technician opens the inspection',
        screen: 'tablet',
        before: 1,
        presses: 1,
        note: 'Inspect, from the job on the tablet.',
      },
    ],
  },
  {
    id: 'needs-work',
    title: 'The vehicle needs work',
    handoffs: [
      {
        name: 'Inspection to estimate',
        screen: 'tablet',
        before: 1,
        presses: 1,
        note: 'Completing the inspection raises the estimate, priced from the findings, and totals it. Before, the estimate was raised with a zero total and could not be sent until somebody noticed.',
      },
      {
        name: 'Estimate to the customer',
        screen: 'job',
        before: 1,
        presses: 1,
        note: 'Send the quote.',
      },
      {
        name: 'Customer answers',
        screen: 'customer phone',
        before: 2,
        presses: 2,
        note: 'Tick what they want, press Approve. Or one press at the counter: "Approved in person" records the same decision under the name of the person who gave it.',
      },
      {
        name: 'Customer answers at the counter',
        screen: 'job',
        before: 4,
        presses: 1,
        note: '"Customer approved in person" records the same decision, under the name of the person who gave it and the member of staff who took it. Before, there was no way to record it: the desk sent the link and asked the customer to open the message, tick the lines and approve in front of them.',
      },
      {
        name: 'Approval to a job with the work on it',
        screen: 'job',
        before: 3,
        presses: 0,
        note: 'The approval itself puts the approved lines on the job and reserves every part that names a stock item, or raises the purchase request for the shortfall. Before, the lines landed but the parts were requested by hand, one at a time, from the parts page.',
      },
      {
        name: 'Extra work found mid-job',
        screen: 'job',
        before: 7,
        presses: 1,
        note: 'One form on the job: what, how many, at what price, which part. "Quote it now" raises a supplementary estimate and sends it; the work already approved carries on. Before: a new estimate version from the estimates page, a line at a time, then back to the job to send it, and the job stopped while the customer decided.',
      },
      {
        name: 'Customer answers the extra work',
        screen: 'customer phone',
        before: 2,
        presses: 2,
        note: 'The approved extra lines join the job; the job status does not move backwards.',
      },
    ],
  },
  {
    id: 'completed',
    title: 'The work is completed',
    handoffs: [
      {
        name: 'Technician to quality check or completed',
        screen: 'job',
        before: 1,
        presses: 1,
        note: 'One button that already knows whether this job type needs a check.',
      },
      {
        name: 'Completed to invoice',
        screen: 'job',
        before: 1,
        presses: 1,
        note: 'Issue the invoice, from the job.',
      },
      {
        name: 'Invoice to payment',
        screen: 'invoice',
        before: 2,
        presses: 2,
        note: 'Take payment: method, then confirm. Or the customer pays by card from their phone.',
      },
      {
        name: 'Payment to pickup',
        screen: 'invoice',
        before: 0,
        presses: 0,
        note: 'The paid invoice closes the job and writes the passport entry. Nothing to press.',
      },
      {
        name: 'Car handed back',
        screen: 'check-out',
        before: 1,
        presses: 1,
        note: 'New in Phase 35, counted from its first day. What was done, the final mileage, what is owed and whether it was paid, what goes back with the car, the keys, a signature, one press. A car cannot leave owing money without a reason written down.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'The customer returns',
    handoffs: [
      {
        name: 'Plate or VIN to the passport',
        screen: 'today',
        before: 2,
        presses: 2,
        note: 'Type the plate, choose the vehicle.',
      },
      {
        name: 'Passport to a new job',
        screen: 'passport',
        before: 1,
        presses: 1,
        note: 'New job, with the customer and vehicle already chosen; warranty still running is shown on the job the moment it opens.',
      },
    ],
  },
  {
    id: 'owner',
    title: 'The owner runs the business',
    handoffs: [
      {
        name: 'Today to the job that needs them',
        screen: 'today',
        before: 1,
        presses: 1,
        note: 'The card names the job; the job is one press away.',
      },
      {
        name: 'Today to cash and profit',
        screen: 'today',
        before: 1,
        presses: 1,
        note: 'The figures are on the page; the ledger behind each is one press.',
      },
    ],
  },
];

/** Presses across a workflow, now. */
export function pressesFor(workflow: Workflow): number {
  return workflow.handoffs.reduce((total, step) => total + step.presses, 0);
}

/** Presses across a workflow, before Phase 34. */
export function pressesBefore(workflow: Workflow): number {
  return workflow.handoffs.reduce((total, step) => total + step.before, 0);
}

export function workflowById(id: Workflow['id']): Workflow {
  const found = WORKFLOWS.find((entry) => entry.id === id);
  if (!found) throw new Error(`No workflow ${id}`);
  return found;
}

export function handoffNamed(name: string): Handoff {
  for (const workflow of WORKFLOWS) {
    const found = workflow.handoffs.find((entry) => entry.name === name);
    if (found) return found;
  }
  throw new Error(`No hand-off named ${name}`);
}

/**
 * A step the walkthrough took: which hand-off it was, on which screen, and
 * how many presses it cost. `check()` says whether it kept to the budget.
 */
export interface WalkedStep {
  handoff: string;
  screen: Screen;
  presses: number;
}

export interface BudgetBreach {
  handoff: string;
  reason: 'over budget' | 'second screen' | 'unknown hand-off';
  detail: string;
}

/** Every way the walk broke the budget. Empty means it kept to it. */
export function checkWalk(steps: readonly WalkedStep[]): BudgetBreach[] {
  const breaches: BudgetBreach[] = [];
  for (const step of steps) {
    let handoff: Handoff;
    try {
      handoff = handoffNamed(step.handoff);
    } catch {
      breaches.push({
        handoff: step.handoff,
        reason: 'unknown hand-off',
        detail: 'not written down',
      });
      continue;
    }
    if (step.presses > handoff.presses) {
      breaches.push({
        handoff: step.handoff,
        reason: 'over budget',
        detail: `${step.presses} presses, budget ${handoff.presses}`,
      });
    }
    if (step.screen !== handoff.screen) {
      breaches.push({
        handoff: step.handoff,
        reason: 'second screen',
        detail: `needed the ${step.screen}, should stay on the ${handoff.screen}`,
      });
    }
  }
  return breaches;
}

/** The whole table as Markdown, for the design document. */
export function workflowsAsMarkdown(): string {
  const out: string[] = [];
  for (const workflow of WORKFLOWS) {
    out.push(`### ${workflow.title}`, '');
    out.push('| Hand-off | Screen | Before | Now | What changed |');
    out.push('| --- | --- | ---: | ---: | --- |');
    for (const step of workflow.handoffs) {
      out.push(
        `| ${step.name} | ${step.screen} | ${step.before} | ${step.presses} | ${step.note ?? ''} |`,
      );
    }
    out.push(
      `| **Whole workflow** | | **${pressesBefore(workflow)}** | **${pressesFor(workflow)}** | |`,
      '',
    );
  }
  return out.join('\n');
}
