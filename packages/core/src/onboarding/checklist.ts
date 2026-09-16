/**
 * The first day. Phase 45.
 *
 * A workshop signs up with enough furniture to take a booking — a site, two
 * bays, a tax rate, six kinds of work — and then has to decide what to do
 * next with a product that has forty screens. Most of them go to the wrong
 * one, or to none.
 *
 * So the product says what is left, in the order that matters, and says why
 * each one matters rather than only naming it. Every step is read from the
 * workshop's own data: nothing is ticked off by pressing "done", because a
 * checklist that can be ticked without the thing being true is worse than no
 * checklist. That also means a workshop that did something before being asked
 * finds it already ticked.
 */

export type SetupStepId =
  'details' | 'rate' | 'tax' | 'team' | 'parts' | 'customer' | 'job' | 'invoice' | 'reminders';

export interface SetupFacts {
  /** The details an invoice needs: legal name, address and tax number. */
  hasLetterhead: boolean;
  labourRates: number;
  taxRates: number;
  /** People with a login, the owner included. */
  members: number;
  products: number;
  customers: number;
  jobs: number;
  invoicesIssued: number;
  /** Service reminders that will go out by themselves. */
  reminders: number;
}

export interface SetupStep {
  id: SetupStepId;
  title: string;
  /** Why it is worth doing, in the workshop's own terms. */
  why: string;
  /** Where it is done. */
  href: string;
  done: boolean;
  /** True where the product cannot work at all without it. */
  essential: boolean;
}

/**
 * What is left to do, in the order a workshop would do it.
 *
 * Paperwork first, because an invoice with no address on it has to be done
 * again; then what the work is charged at; then the people; then the first
 * real job, which is what proves the thing works.
 */
export function setupSteps(facts: SetupFacts): SetupStep[] {
  return [
    {
      id: 'details',
      title: 'Put your details on the paperwork',
      why: 'Your legal name, address and tax number appear on every invoice. An invoice without them is one a customer’s accountant sends back.',
      href: '/settings/organisation',
      done: facts.hasLetterhead,
      essential: true,
    },
    {
      id: 'rate',
      title: 'Say what an hour costs',
      why: 'Quotes and jobs take this rate by themselves. Without it, every line starts at nothing and somebody has to remember the figure.',
      href: '/settings/site#rates',
      done: facts.labourRates > 0,
      essential: true,
    },
    {
      id: 'tax',
      title: 'Check the tax rate',
      why: 'One was created when you signed up, at the usual rate for your country. It is on every invoice, so it is worth ten seconds now.',
      href: '/settings/catalogue',
      done: facts.taxRates > 0,
      essential: true,
    },
    {
      id: 'team',
      title: 'Invite whoever else works here',
      why: 'Technicians clock on to jobs and see only what they need. Working from one login makes the hours, the commission and the audit trail meaningless.',
      href: '/team',
      done: facts.members > 1,
      essential: false,
    },
    {
      id: 'parts',
      title: 'Put a few parts on the shelf',
      why: 'Parts on jobs come from here, with their cost, so the profit on a job is real. Start with the dozen you fit every week.',
      href: '/parts',
      done: facts.products > 0,
      essential: false,
    },
    {
      id: 'customer',
      title: 'Add a customer and their vehicle',
      why: 'A vehicle is the whole point: its history stays with it, whoever owns it next.',
      href: '/customers',
      done: facts.customers > 0,
      essential: false,
    },
    {
      id: 'job',
      title: 'Put a job through',
      why: 'One job, start to finish, is the only way to know the product fits how you work. Book it, inspect it, quote it, do it.',
      href: '/jobs/new',
      done: facts.jobs > 0,
      essential: false,
    },
    {
      id: 'invoice',
      title: 'Issue your first invoice',
      why: 'Invoices are numbered without gaps and cannot be edited once issued, which is what makes them worth having.',
      href: '/invoices',
      done: facts.invoicesIssued > 0,
      essential: false,
    },
    {
      id: 'reminders',
      title: 'Let the reminders run',
      why: 'A service due in six months is work you have already won. The product writes to them so nobody has to remember.',
      href: '/reminders',
      done: facts.reminders > 0,
      essential: false,
    },
  ];
}

export interface SetupProgress {
  steps: SetupStep[];
  done: number;
  total: number;
  /** Whole per cent, for the ring on the dashboard. */
  percent: number;
  /** The one to do next, or null when there is nothing left. */
  next: SetupStep | null;
  /** True once nothing essential is outstanding. */
  ready: boolean;
  complete: boolean;
}

export function setupProgress(facts: SetupFacts): SetupProgress {
  const steps = setupSteps(facts);
  const done = steps.filter((step) => step.done).length;

  return {
    steps,
    done,
    total: steps.length,
    percent: Math.round((done / steps.length) * 100),
    next: steps.find((step) => !step.done) ?? null,
    ready: steps.every((step) => step.done || !step.essential),
    complete: done === steps.length,
  };
}

/** One line for the dashboard, which says what is left rather than a number. */
export function describeSetup(progress: SetupProgress): string {
  if (progress.complete) return 'Everything on the setup list is done.';

  const left = progress.total - progress.done;

  return progress.ready
    ? `${left} ${left === 1 ? 'thing' : 'things'} left on the setup list, none of them urgent.`
    : `${left} ${left === 1 ? 'thing' : 'things'} left to set up, and one of them is needed before you invoice anybody.`;
}
