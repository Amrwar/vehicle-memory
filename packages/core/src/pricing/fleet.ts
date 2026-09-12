import { type Money, money, sum } from '../shared/money';

import { type PriceableLine } from './totals';

/**
 * What a fleet has agreed, and one invoice a month.
 *
 * A company with fifty vans negotiates two things and cares about a third.
 * The two are a discount on labour and a discount on parts; the third is not
 * receiving fifty invoices. Phase 9 built the fleet view and named both as
 * missing. Both are small rules with a large effect on whether the fleet stays.
 */

export class FleetError extends Error {
  constructor(
    readonly code:
      | 'BAD_PERCENT'
      | 'NOT_A_COMPANY'
      | 'NOTHING_TO_INVOICE'
      | 'ALREADY_INVOICED'
      | 'WRONG_PERIOD'
      | 'PO_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'FleetError';
  }
}

export interface Agreement {
  labourDiscountPct: number;
  partsDiscountPct: number;
  paymentTermsDays: number;
  consolidateMonthly: boolean;
  purchaseOrderRequired: boolean;
}

/** Whether an agreement can be saved. */
export function assertAgreementSaveable(input: {
  customerKind: 'INDIVIDUAL' | 'COMPANY';
  agreement: Agreement;
}): void {
  if (input.customerKind !== 'COMPANY') {
    throw new FleetError(
      'NOT_A_COMPANY',
      'Fleet terms are for a company customer. A person with two cars is a customer, not a fleet.',
    );
  }

  for (const [label, value] of [
    ['labour discount', input.agreement.labourDiscountPct],
    ['parts discount', input.agreement.partsDiscountPct],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new FleetError('BAD_PERCENT', `The ${label} is a percentage between 0 and 100.`);
    }
  }

  if (
    !Number.isInteger(input.agreement.paymentTermsDays) ||
    input.agreement.paymentTermsDays < 0 ||
    input.agreement.paymentTermsDays > 120
  ) {
    throw new FleetError('BAD_PERCENT', 'Payment terms are a whole number of days, up to 120.');
  }
}

/**
 * The agreed discount applied to a job's lines.
 *
 * Applied at invoice time rather than written into the job, so the job shows
 * what the work was worth and the invoice shows what was charged. The
 * difference is the cost of keeping the fleet, and an owner should be able to
 * see it rather than have it hidden inside every line.
 */
export function applyFleetAgreement(
  lines: readonly PriceableLine[],
  agreement: Pick<Agreement, 'labourDiscountPct' | 'partsDiscountPct'>,
): PriceableLine[] {
  return lines.map((line) => {
    const extra =
      line.kind === 'LABOUR'
        ? agreement.labourDiscountPct
        : line.kind === 'PART'
          ? agreement.partsDiscountPct
          : 0;

    if (extra <= 0) return line;

    // Discounts compound rather than add: a 10% line discount and a 10%
    // fleet discount is 19% off, which is what both parties would work out on
    // paper and what neither would if the two were summed.
    const existing = line.discountPct ?? 0;
    const combined = 100 - ((100 - existing) * (100 - extra)) / 100;

    return { ...line, discountPct: Math.round(combined * 100) / 100 };
  });
}

export interface ConsolidatableJob {
  id: string;
  number: number;
  status: string;
  completedAt: Date | null;
  purchaseOrderNumber: string | null;
  alreadyInvoiced: boolean;
  chargeableLines: number;
}

/** The calendar month a consolidated invoice covers. */
export function consolidationWindow(
  year: number,
  month: number,
): { from: Date; to: Date; label: string } {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const label = from.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { from, to, label };
}

/**
 * Which of a fleet's jobs go on this month's invoice, and why the rest do not.
 *
 * Completed in the window, not yet invoiced, with something on them. A job
 * still on the ramp waits for next month; a job already invoiced on its own is
 * left alone rather than billed twice. If the agreement requires a purchase
 * order number, a job without one is refused by name, because the fleet's
 * accounts department will refuse the invoice for exactly that reason.
 */
export function assertConsolidatable(input: {
  jobs: readonly ConsolidatableJob[];
  window: { from: Date; to: Date };
  agreement: Pick<Agreement, 'purchaseOrderRequired'>;
}): { include: ConsolidatableJob[]; skipped: { job: ConsolidatableJob; reason: string }[] } {
  const include: ConsolidatableJob[] = [];
  const skipped: { job: ConsolidatableJob; reason: string }[] = [];

  for (const job of input.jobs) {
    if (job.alreadyInvoiced) {
      skipped.push({ job, reason: 'already invoiced on its own' });
      continue;
    }

    if (job.status !== 'COMPLETED' || !job.completedAt) {
      skipped.push({ job, reason: 'not completed' });
      continue;
    }

    if (job.completedAt < input.window.from || job.completedAt > input.window.to) {
      skipped.push({ job, reason: 'completed outside the month' });
      continue;
    }

    if (job.chargeableLines === 0) {
      skipped.push({ job, reason: 'nothing priced on it' });
      continue;
    }

    if (input.agreement.purchaseOrderRequired && !job.purchaseOrderNumber?.trim()) {
      throw new FleetError(
        'PO_REQUIRED',
        `Job ${job.number} has no purchase order number and this fleet requires one on every job. Add it to the job before invoicing the month.`,
      );
    }

    include.push(job);
  }

  if (include.length === 0) {
    throw new FleetError(
      'NOTHING_TO_INVOICE',
      skipped.length === 0
        ? 'No jobs for this fleet in that month.'
        : `Nothing to invoice for that month: ${summariseSkips(skipped)}.`,
    );
  }

  return { include, skipped };
}

function summariseSkips(skipped: readonly { reason: string }[]): string {
  const counts = new Map<string, number>();
  for (const entry of skipped) counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => `${count} ${reason}`).join(', ');
}

/** One line about the month, for the top of the invoice. */
export function describeConsolidation(input: {
  fleetName: string;
  label: string;
  jobs: number;
  total: Money;
  saved: Money;
}): string {
  const format = (value: Money) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
      value.minor / 100,
    );

  return `${input.fleetName}, ${input.label}: ${input.jobs} job${input.jobs === 1 ? '' : 's'}, ${format(input.total)}${
    input.saved.minor > 0 ? `, ${format(input.saved)} off list under the agreement` : ''
  }.`;
}

/** What the agreement cost the workshop on these lines, at list less agreed. */
export function agreementSaving(
  listNet: readonly Money[],
  agreedNet: readonly Money[],
  currency = 'GBP',
): Money {
  const list = sum(listNet, currency);
  const agreed = sum(agreedNet, currency);
  return money(Math.max(0, list.minor - agreed.minor), currency);
}
