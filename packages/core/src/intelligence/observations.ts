import { type Money } from '../shared/money';

/**
 * A revenue observation: arithmetic with a sentence around it.
 *
 * The second use of generated text, and one that needs no model at all. Two
 * periods, four figures, and the sentences an owner would write on the back of
 * an envelope. What makes it worth having is that the arithmetic is done
 * honestly: a rise of 40% on a base of two invoices is reported as two
 * invoices, not as growth.
 */

export interface RevenueSlice {
  label: string;
  /** Net revenue in the period. */
  revenue: Money;
  /** Cost of sales in the period. */
  cost: Money;
  jobs: number;
}

export interface RevenueComparison {
  current: RevenueSlice;
  previous: RevenueSlice;
  /** Net revenue by kind of work in the current period, largest first. */
  byKind: readonly { name: string; revenue: Money }[];
}

/** Sentences about the figures. Never more than four, and none without a number. */
export function observeRevenue(input: RevenueComparison): string[] {
  const out: string[] = [];
  const { current, previous } = input;

  if (current.jobs === 0 && current.revenue.minor === 0) {
    return [`Nothing invoiced yet in ${current.label}.`];
  }

  out.push(
    `${format(current.revenue)} invoiced in ${current.label} across ${current.jobs} job${current.jobs === 1 ? '' : 's'}${
      current.jobs > 0 ? `, ${format(divide(current.revenue, current.jobs))} a job` : ''
    }.`,
  );

  // A comparison is only stated when both sides are big enough to mean
  // something. Percentages on tiny bases are how a quiet fortnight becomes a
  // headline.
  if (previous.jobs >= 5 && current.jobs >= 5 && previous.revenue.minor > 0) {
    const change =
      ((current.revenue.minor - previous.revenue.minor) / previous.revenue.minor) * 100;
    const direction = change >= 0 ? 'up' : 'down';
    out.push(
      `That is ${direction} ${Math.abs(change).toFixed(0)}% on ${previous.label} (${format(previous.revenue)} across ${previous.jobs} jobs).`,
    );
  } else if (previous.jobs > 0) {
    out.push(
      `${previous.label} was ${format(previous.revenue)} across ${previous.jobs} job${previous.jobs === 1 ? '' : 's'}. Too few jobs on one side to call a trend.`,
    );
  }

  if (current.revenue.minor > 0) {
    const marginPct = ((current.revenue.minor - current.cost.minor) / current.revenue.minor) * 100;
    const previousMargin =
      previous.revenue.minor > 0
        ? ((previous.revenue.minor - previous.cost.minor) / previous.revenue.minor) * 100
        : null;

    out.push(
      `Gross margin ${marginPct.toFixed(0)}%${
        previousMargin !== null && Math.abs(previousMargin - marginPct) >= 3
          ? `, against ${previousMargin.toFixed(0)}% ${previous.label === current.label ? 'before' : `in ${previous.label}`}`
          : ''
      }.`,
    );
  }

  const top = input.byKind[0];
  if (top && current.revenue.minor > 0 && input.byKind.length > 1) {
    const share = (top.revenue.minor / current.revenue.minor) * 100;
    if (share >= 40) {
      out.push(`${top.name} is ${share.toFixed(0)}% of it.`);
    }
  }

  return out.slice(0, 4);
}

function divide(value: Money, by: number): Money {
  return { minor: Math.round(value.minor / by), currency: value.currency };
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: value.currency,
    maximumFractionDigits: 0,
  }).format(value.minor / 100);
}
