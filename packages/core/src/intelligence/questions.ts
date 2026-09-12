import { type Money } from '../shared/money';

/**
 * A question in words, routed to a calculation that already exists.
 *
 * The command centre is not a search engine and not a language model. Every
 * figure it can give is computed somewhere in the product already; what this
 * does is recognise which one is being asked for, over which period, and say
 * plainly when the question is one the data cannot answer. A confident answer
 * to a question the workshop's records cannot support is worse than none, so
 * the vocabulary is deliberately narrow and every intent names the calculation
 * behind it.
 */

export type Period = 'today' | 'week' | 'month' | 'last-month' | 'quarter' | 'year';

export type Intent =
  | { kind: 'REVENUE'; period: Period; breakdown: boolean }
  | { kind: 'PROFIT'; period: Period }
  | { kind: 'OUTSTANDING' }
  | { kind: 'OVERDUE_INVOICES' }
  | { kind: 'OWED_TO_SUPPLIERS' }
  | { kind: 'CASH_TAKEN'; period: Period }
  | { kind: 'JOBS_IN_SHOP' }
  | { kind: 'AWAITING_APPROVAL' }
  | { kind: 'STOCK_VALUE' }
  | { kind: 'TOP_CUSTOMERS'; period: Period }
  | { kind: 'LAPSED_CUSTOMERS' }
  | { kind: 'DUE_SOON' }
  | { kind: 'WAGES'; period: Period };

/** What the product can be asked, in the words an owner would use. */
export const COVERAGE: readonly { example: string; answers: string }[] = [
  { example: 'What did we take this month?', answers: 'Revenue, with a split by kind of work' },
  { example: 'How profitable were we last month?', answers: 'Gross margin from the ledger' },
  { example: 'Who owes us money?', answers: 'Outstanding and overdue invoices' },
  { example: 'What do we owe suppliers?', answers: 'Open supplier bills' },
  { example: 'How much cash came in today?', answers: 'Payments received, by method' },
  { example: 'How many cars are in the shop?', answers: 'Jobs on the ramps right now' },
  { example: 'What is waiting on customers?', answers: 'Quotes sent and not yet answered' },
  { example: 'What is our stock worth?', answers: 'Stock at weighted average cost' },
  { example: 'Who are our best customers this year?', answers: 'Customers by what they spent' },
  {
    example: 'Which customers have we not seen for a while?',
    answers: 'Customers who are lapsing',
  },
  {
    example: 'Which vehicles are due a service?',
    answers: 'Services falling due in the next month',
  },
  { example: 'What did wages cost last month?', answers: 'Gross pay from payroll runs' },
];

const PERIOD_WORDS: readonly [RegExp, Period][] = [
  [/\btoday\b|\bso far today\b/, 'today'],
  [/\bthis week\b|\bthe week\b/, 'week'],
  [/\blast month\b|\bprevious month\b/, 'last-month'],
  [/\bthis month\b|\bthe month\b|\bmonth to date\b/, 'month'],
  [/\bthis quarter\b|\bthe quarter\b|\bq[1-4]\b/, 'quarter'],
  [/\bthis year\b|\bthe year\b|\byear to date\b|\bytd\b/, 'year'],
];

/** The period named in the question, or the one that makes sense for the intent. */
export function periodIn(text: string, fallback: Period): Period {
  const lower = text.toLowerCase();
  for (const [pattern, period] of PERIOD_WORDS) {
    if (pattern.test(lower)) return period;
  }
  return fallback;
}

/**
 * Recognises the question, or does not.
 *
 * Ordered from the most specific vocabulary to the least, so "who owes us"
 * is receivables before "owe" could be read as payables, and "stock" is read
 * as inventory rather than as shares.
 */
export function parseQuestion(text: string): Intent | null {
  const q = text
    .toLowerCase()
    .replace(/[?.!,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!q) return null;

  if (
    /\b(overdue|late|past due)\b/.test(q) &&
    /\b(invoice|invoices|payment|payments|owe|owed|debt)\b/.test(q)
  ) {
    return { kind: 'OVERDUE_INVOICES' };
  }

  if (
    /\b(owe|owed|owes|owing)\b.*\b(supplier|suppliers|factor|factors)\b/.test(q) ||
    /\bsupplier bills?\b|\bpayables?\b|\bcreditors?\b/.test(q)
  ) {
    return { kind: 'OWED_TO_SUPPLIERS' };
  }

  if (
    /\bwho owes\b|\bowed to us\b|\bowe us\b|\boutstanding\b|\bunpaid\b|\breceivables?\b|\bdebtors?\b/.test(
      q,
    )
  ) {
    return { kind: 'OUTSTANDING' };
  }

  if (/\bwages?\b|\bpayroll\b|\bsalar(y|ies)\b|\bpay bill\b/.test(q)) {
    return { kind: 'WAGES', period: periodIn(q, 'month') };
  }

  if (
    /\bcash\b|\bpayments? (came|come|received|taken)\b|\btaken in payments?\b|\bbanked\b/.test(q)
  ) {
    return { kind: 'CASH_TAKEN', period: periodIn(q, 'today') };
  }

  if (/\bstock\b|\binventory\b/.test(q)) {
    return { kind: 'STOCK_VALUE' };
  }

  if (/\b(profit|profitable|margin|margins|make on|made on)\b/.test(q)) {
    return { kind: 'PROFIT', period: periodIn(q, 'month') };
  }

  if (
    /\bbest customers?\b|\btop customers?\b|\bbiggest customers?\b|\bspent the most\b|\bmost valuable\b/.test(
      q,
    )
  ) {
    return { kind: 'TOP_CUSTOMERS', period: periodIn(q, 'year') };
  }

  if (
    /\bnot seen\b|\bhaven'?t (we )?seen\b|\blapsed\b|\blapsing\b|\bstopped coming\b|\blost customers?\b/.test(
      q,
    )
  ) {
    return { kind: 'LAPSED_CUSTOMERS' };
  }

  if (
    /\bdue (a |for )?(service|mot)\b|\bservices? due\b|\bdue soon\b|\bcoming due\b|\breminders? due\b/.test(
      q,
    )
  ) {
    return { kind: 'DUE_SOON' };
  }

  if (
    /\bwaiting on\b|\bawaiting approval\b|\bnot (yet )?(answered|approved|decided)\b|\bquotes? (out|sent|open|pending)\b/.test(
      q,
    )
  ) {
    return { kind: 'AWAITING_APPROVAL' };
  }

  if (
    /\b(in the shop|in the workshop|on the ramps?|on the floor|being worked on)\b|\bhow many (cars|jobs|vehicles)\b/.test(
      q,
    )
  ) {
    return { kind: 'JOBS_IN_SHOP' };
  }

  if (/\b(revenue|turnover|sales|take|took|taken|invoiced|billed|earn|earned|income)\b/.test(q)) {
    return {
      kind: 'REVENUE',
      period: periodIn(q, 'month'),
      breakdown:
        /\bby\b|\bsplit\b|\bbreak ?down\b|\bwhat kind\b|\bwhich (work|services?|types?)\b/.test(q),
    };
  }

  return null;
}

export interface Answer {
  /** The figure, when the question has one. */
  figure: Money | number | null;
  /** How the figure is shown, in words. */
  headline: string;
  /** Each step of the arithmetic, so the number can be checked. */
  reasoning: string[];
  /** Where the same figure lives as a page. */
  source: { label: string; href: string };
  /** The period the answer covers, in words. */
  period: string | null;
}

/** The honest answer to a question outside the vocabulary. */
export function refusal(text: string): string {
  const trimmed = text.trim();
  return trimmed
    ? `The records cannot answer "${trimmed}". This asks the product's own figures a question in words; it can tell you about revenue, profit, money owed and owing, cash taken, cars in the shop, quotes waiting, stock, customers and services due. It does not guess.`
    : 'Ask something. The list below is what the records can answer.';
}

/** The period, for a headline. */
export function describePeriod(period: Period, now = new Date()): string {
  switch (period) {
    case 'today':
      return 'today';
    case 'week':
      return 'this week';
    case 'month':
      return now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    case 'last-month': {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    case 'quarter':
      return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()} to date`;
    case 'year':
      return `${now.getFullYear()} to date`;
  }
}

/** The dates a period covers. */
export function periodBounds(period: Period, now = new Date()): { from: Date; to: Date } {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: endOfToday };
    case 'week': {
      const day = (now.getDay() + 6) % 7;
      return {
        from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - day),
        to: endOfToday,
      };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    case 'last-month':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), quarter * 3, 1), to: endOfToday };
    }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday };
  }
}

export function formatFigure(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}
