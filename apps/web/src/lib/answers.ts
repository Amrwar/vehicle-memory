import {
  type Answer,
  describePeriod,
  formatFigure,
  fromDecimal,
  type Intent,
  money,
  observeRevenue,
  parseQuestion,
  type Period,
  periodBounds,
  profitAndLoss,
  refusal,
  withinPeriod,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { openPayables, openReceivables, postedLines } from './accounting';
import { revenueByServiceType, retention } from './reports';

/**
 * Questions in words, answered from the records.
 *
 * Every branch here calls a calculation the product already trusts and shows
 * its working. Nothing is estimated, nothing is extrapolated, and a question
 * the vocabulary does not recognise is refused with the list of what it does.
 */

const GBP = 'GBP';

export interface Asked {
  question: string;
  intent: Intent | null;
  answer: Answer | null;
  refusal: string | null;
}

export async function answer(orgId: string, question: string, now = new Date()): Promise<Asked> {
  const intent = parseQuestion(question);

  if (!intent) {
    return { question, intent: null, answer: null, refusal: refusal(question) };
  }

  return { question, intent, answer: await resolve(orgId, intent, now), refusal: null };
}

async function resolve(orgId: string, intent: Intent, now: Date): Promise<Answer> {
  switch (intent.kind) {
    case 'REVENUE':
      return revenue(orgId, intent.period, intent.breakdown, now);
    case 'PROFIT':
      return profit(orgId, intent.period, now);
    case 'OUTSTANDING':
      return outstanding(orgId, now, false);
    case 'OVERDUE_INVOICES':
      return outstanding(orgId, now, true);
    case 'OWED_TO_SUPPLIERS':
      return owedToSuppliers(orgId, now);
    case 'CASH_TAKEN':
      return cashTaken(orgId, intent.period, now);
    case 'JOBS_IN_SHOP':
      return jobsInShop(orgId);
    case 'AWAITING_APPROVAL':
      return awaitingApproval(orgId);
    case 'STOCK_VALUE':
      return stockValue(orgId);
    case 'TOP_CUSTOMERS':
      return topCustomers(orgId, intent.period, now);
    case 'LAPSED_CUSTOMERS':
      return lapsed(orgId);
    case 'DUE_SOON':
      return dueSoon(orgId, now);
    case 'WAGES':
      return wages(orgId, intent.period, now);
  }
}

/* ---------------------------------------------------------------------------
   Money in
   --------------------------------------------------------------------------- */

async function revenue(
  orgId: string,
  period: Period,
  breakdown: boolean,
  now: Date,
): Promise<Answer> {
  const bounds = periodBounds(period, now);
  const rows = await revenueByServiceType(orgId, bounds);

  const total = rows.reduce((sum, row) => sum + row.revenueMinor, 0);
  const jobs = rows.reduce((sum, row) => sum + row.jobs, 0);
  const figure = money(total, GBP);

  const reasoning = [
    `Invoices issued between ${bounds.from.toLocaleDateString('en-GB')} and ${bounds.to.toLocaleDateString('en-GB')}, net of tax.`,
    `${jobs} job${jobs === 1 ? '' : 's'} invoiced.`,
  ];

  if (breakdown || rows.length <= 6) {
    for (const row of rows.slice().sort((a, b) => b.revenueMinor - a.revenueMinor)) {
      reasoning.push(
        `${row.name}: ${formatFigure(money(row.revenueMinor, GBP))} across ${row.jobs} job${row.jobs === 1 ? '' : 's'}${
          row.marginPct !== null ? `, ${row.marginPct.toFixed(0)}% margin` : ''
        }.`,
      );
    }
  }

  return {
    figure,
    headline: `${formatFigure(figure)} invoiced ${describePeriod(period, now)}.`,
    reasoning,
    source: { label: 'Reports', href: '/reports?days=30' },
    period: describePeriod(period, now),
  };
}

async function profit(orgId: string, period: Period, now: Date): Promise<Answer> {
  const bounds = periodBounds(period, now);
  const lines = withinPeriod(await postedLines(orgId), bounds.from, bounds.to);
  const pl = profitAndLoss(lines, GBP);

  const reasoning = [
    `Revenue posted to the ledger in the period: ${formatFigure(pl.totalRevenue)}.`,
    `Cost of sales (parts consumed and labour at cost): ${formatFigure(pl.totalCostOfSales)}.`,
    `Gross profit: ${formatFigure(pl.grossProfit)}${pl.grossMarginPct !== null ? `, a ${pl.grossMarginPct.toFixed(0)}% margin` : ''}.`,
    `Overheads posted: ${formatFigure(pl.totalOverheads)}.`,
    `Net: ${formatFigure(pl.netProfit)}${pl.netMarginPct !== null ? ` (${pl.netMarginPct.toFixed(0)}%)` : ''}.`,
  ];

  return {
    figure: pl.grossProfit,
    headline:
      pl.totalRevenue.minor === 0
        ? `Nothing posted as revenue ${describePeriod(period, now)}, so there is no margin to report.`
        : `${formatFigure(pl.grossProfit)} gross profit ${describePeriod(period, now)}${
            pl.grossMarginPct !== null ? `, ${pl.grossMarginPct.toFixed(0)}% of revenue` : ''
          }.`,
    reasoning,
    source: { label: 'Statements', href: '/financials?range=month' },
    period: describePeriod(period, now),
  };
}

async function outstanding(orgId: string, now: Date, overdueOnly: boolean): Promise<Answer> {
  const open = await openReceivables(orgId);
  const overdue = open.filter((row) => row.dueAt !== null && row.dueAt < now);
  const rows = overdueOnly ? overdue : open;

  const total = rows.reduce((sum, row) => sum + row.outstanding.minor, 0);
  const figure = money(total, GBP);

  const biggest = rows
    .slice()
    .sort((a, b) => b.outstanding.minor - a.outstanding.minor)
    .slice(0, 5);

  return {
    figure,
    headline: overdueOnly
      ? `${formatFigure(figure)} is overdue across ${rows.length} invoice${rows.length === 1 ? '' : 's'}.`
      : `${formatFigure(figure)} is owed to you across ${rows.length} invoice${rows.length === 1 ? '' : 's'}, ${formatFigure(
          money(
            overdue.reduce((s, r) => s + r.outstanding.minor, 0),
            GBP,
          ),
        )} of it overdue.`,
    reasoning: [
      `Issued, part-paid and overdue invoices, total less what has been paid.`,
      ...biggest.map(
        (row) =>
          `${row.partyName}: ${formatFigure(row.outstanding)} on ${row.reference}${
            row.dueAt
              ? row.dueAt < now
                ? `, due ${row.dueAt.toLocaleDateString('en-GB')} and late`
                : `, due ${row.dueAt.toLocaleDateString('en-GB')}`
              : ''
          }.`,
      ),
      ...(rows.length > 5 ? [`And ${rows.length - 5} more.`] : []),
    ],
    source: { label: 'Invoices', href: '/invoices?status=unpaid' },
    period: null,
  };
}

async function owedToSuppliers(orgId: string, now: Date): Promise<Answer> {
  const bills = await openPayables(orgId);
  const total = bills.reduce((sum, row) => sum + row.outstanding.minor, 0);
  const overdue = bills.filter((row) => row.dueAt !== null && row.dueAt < now);

  const bySupplier = new Map<string, number>();
  for (const bill of bills)
    bySupplier.set(bill.partyName, (bySupplier.get(bill.partyName) ?? 0) + bill.outstanding.minor);

  return {
    figure: money(total, GBP),
    headline: `${formatFigure(money(total, GBP))} is owed to suppliers across ${bills.length} bill${bills.length === 1 ? '' : 's'}${
      overdue.length > 0 ? `, ${overdue.length} past due` : ''
    }.`,
    reasoning: [
      'Open supplier bills, total less what has been paid.',
      ...[...bySupplier.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, minor]) => `${name}: ${formatFigure(money(minor, GBP))}.`),
    ],
    source: { label: 'Suppliers owed', href: '/payables' },
    period: null,
  };
}

async function cashTaken(orgId: string, period: Period, now: Date): Promise<Answer> {
  const bounds = periodBounds(period, now);
  const payments = await prisma.payment.findMany({
    where: { orgId, receivedAt: { gte: bounds.from, lte: bounds.to } },
    select: { amount: true, method: true },
  });

  const byMethod = new Map<string, number>();
  let total = 0;
  for (const payment of payments) {
    const minor = Math.round(Number(payment.amount) * 100);
    total += minor;
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + minor);
  }

  return {
    figure: money(total, GBP),
    headline: `${formatFigure(money(total, GBP))} received ${describePeriod(period, now)} in ${payments.length} payment${payments.length === 1 ? '' : 's'}.`,
    reasoning: [
      'Payments recorded against invoices, by how they were paid.',
      ...[...byMethod.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([method, minor]) =>
            `${method.replace('_', ' ').toLowerCase()}: ${formatFigure(money(minor, GBP))}.`,
        ),
    ],
    source: { label: 'Payments', href: `/payments?days=${period === 'today' ? 7 : 30}` },
    period: describePeriod(period, now),
  };
}

/* ---------------------------------------------------------------------------
   The shop
   --------------------------------------------------------------------------- */

async function jobsInShop(orgId: string): Promise<Answer> {
  const grouped = await prisma.job.groupBy({
    by: ['status'],
    where: {
      orgId,
      status: {
        in: [
          'RECEIVED',
          'INSPECTING',
          'DIAGNOSED',
          'ESTIMATED',
          'AWAITING_APPROVAL',
          'APPROVED',
          'IN_PROGRESS',
          'QUALITY_CHECK',
        ],
      },
    },
    _count: { _all: true },
  });

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  return {
    figure: total,
    headline: `${total} car${total === 1 ? '' : 's'} in the workshop right now.`,
    reasoning: grouped
      .sort((a, b) => b._count._all - a._count._all)
      .map((row) => `${row._count._all} ${row.status.toLowerCase().replace('_', ' ')}.`),
    source: { label: 'Jobs', href: '/jobs?status=in-shop' },
    period: null,
  };
}

async function awaitingApproval(orgId: string): Promise<Answer> {
  const jobs = await prisma.job.findMany({
    where: { orgId, status: 'AWAITING_APPROVAL' },
    select: {
      number: true,
      customer: { select: { displayName: true } },
      estimates: {
        where: { status: 'SENT' },
        orderBy: { version: 'desc' },
        take: 1,
        select: { total: true, sentAt: true },
      },
    },
  });

  const value = jobs.reduce(
    (sum, job) => sum + Math.round(Number(job.estimates[0]?.total ?? 0) * 100),
    0,
  );

  return {
    figure: jobs.length,
    headline: `${jobs.length} quote${jobs.length === 1 ? '' : 's'} waiting on a customer, worth ${formatFigure(money(value, GBP))}.`,
    reasoning: jobs.map((job) => {
      const estimate = job.estimates[0];
      const days = estimate?.sentAt
        ? Math.floor((Date.now() - estimate.sentAt.getTime()) / 86_400_000)
        : null;
      return `Job ${job.number}, ${job.customer.displayName}: ${formatFigure(money(Math.round(Number(estimate?.total ?? 0) * 100), GBP))}${
        days !== null ? `, sent ${days} day${days === 1 ? '' : 's'} ago` : ''
      }.`;
    }),
    source: { label: 'Jobs awaiting approval', href: '/jobs?status=AWAITING_APPROVAL' },
    period: null,
  };
}

async function stockValue(orgId: string): Promise<Answer> {
  const levels = await prisma.stockLevel.findMany({
    where: { product: { orgId, isActive: true } },
    select: { onHand: true, avgCost: true, product: { select: { name: true } } },
  });

  let total = 0;
  const lines: { name: string; minor: number }[] = [];
  for (const level of levels) {
    const minor = Math.round(Number(level.onHand) * Number(level.avgCost) * 100);
    total += minor;
    if (minor > 0) lines.push({ name: level.product.name, minor });
  }

  return {
    figure: money(total, GBP),
    headline: `${formatFigure(money(total, GBP))} of stock on the shelf at what it cost.`,
    reasoning: [
      'Quantity on hand times weighted average cost, for every stocked part.',
      ...lines
        .sort((a, b) => b.minor - a.minor)
        .slice(0, 5)
        .map((line) => `${line.name}: ${formatFigure(money(line.minor, GBP))}.`),
    ],
    source: { label: 'Parts', href: '/parts' },
    period: null,
  };
}

/* ---------------------------------------------------------------------------
   Customers
   --------------------------------------------------------------------------- */

async function topCustomers(orgId: string, period: Period, now: Date): Promise<Answer> {
  const bounds = periodBounds(period, now);
  const invoices = await prisma.invoice.findMany({
    where: { orgId, status: { not: 'VOID' }, issuedAt: { gte: bounds.from, lte: bounds.to } },
    select: { subtotal: true, customer: { select: { displayName: true } } },
  });

  const byCustomer = new Map<string, number>();
  for (const invoice of invoices) {
    byCustomer.set(
      invoice.customer.displayName,
      (byCustomer.get(invoice.customer.displayName) ?? 0) +
        Math.round(Number(invoice.subtotal) * 100),
    );
  }

  const ranked = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    figure: ranked.length,
    headline: ranked[0]
      ? `${ranked[0][0]} spent the most ${describePeriod(period, now)}: ${formatFigure(money(ranked[0][1], GBP))}.`
      : `Nobody was invoiced ${describePeriod(period, now)}.`,
    reasoning: [
      'Net invoiced in the period, by customer.',
      ...ranked.map(([name, minor]) => `${name}: ${formatFigure(money(minor, GBP))}.`),
    ],
    source: { label: 'Customers', href: '/customers' },
    period: describePeriod(period, now),
  };
}

async function lapsed(orgId: string): Promise<Answer> {
  const rows = (await retention(orgId, 500)).filter((row) => row.lapsing);

  return {
    figure: rows.length,
    headline: `${rows.length} customer${rows.length === 1 ? '' : 's'} ${rows.length === 1 ? 'has' : 'have'} not been back in a while.`,
    reasoning: [
      'Customers whose gap since their last visit is well past their usual one.',
      ...rows
        .slice()
        .sort((a, b) => b.lifetimeMinor - a.lifetimeMinor)
        .slice(0, 6)
        .map(
          (row) =>
            `${row.name}: last seen ${row.lastVisit}, ${row.daysSinceLastVisit ?? '?'} days ago, ${formatFigure(money(row.lifetimeMinor, GBP))} over ${row.visits} visit${row.visits === 1 ? '' : 's'}.`,
        ),
    ],
    source: { label: 'Relationships', href: '/crm' },
    period: null,
  };
}

async function dueSoon(orgId: string, now: Date): Promise<Answer> {
  const soon = new Date(now.getTime() + 30 * 86_400_000);
  const schedules = await prisma.serviceSchedule.findMany({
    where: { orgId, isActive: true, dueAt: { lte: soon } },
    orderBy: { dueAt: 'asc' },
    take: 50,
    select: {
      name: true,
      dueAt: true,
      vehicle: { select: { registration: true, make: true, model: true } },
    },
  });

  const overdue = schedules.filter((row) => row.dueAt !== null && row.dueAt < now);

  return {
    figure: schedules.length,
    headline: `${schedules.length} service${schedules.length === 1 ? '' : 's'} due in the next month, ${overdue.length} already past.`,
    reasoning: schedules
      .slice(0, 8)
      .map(
        (row) =>
          `${row.vehicle.registration ?? `${row.vehicle.make} ${row.vehicle.model}`}: ${row.name}${row.dueAt ? `, ${row.dueAt.toLocaleDateString('en-GB')}` : ''}.`,
      ),
    source: { label: 'Reminders', href: '/reminders?days=30' },
    period: 'next 30 days',
  };
}

/* ---------------------------------------------------------------------------
   The team
   --------------------------------------------------------------------------- */

async function wages(orgId: string, period: Period, now: Date): Promise<Answer> {
  const bounds = periodBounds(period, now);
  const runs = await prisma.payrollRun.findMany({
    where: { orgId, periodEnd: { gte: bounds.from, lte: bounds.to } },
    select: { gross: true, employeeCount: true, status: true, periodEnd: true },
  });

  const total = runs.reduce((sum, run) => sum + Math.round(Number(run.gross) * 100), 0);

  return {
    figure: money(total, GBP),
    headline: `${formatFigure(money(total, GBP))} gross wages for periods ending ${describePeriod(period, now)}.`,
    reasoning: [
      'Gross pay from payroll runs whose period ended in the window. Tax and pension are worked out by the payroll software, not here.',
      ...runs.map(
        (run) =>
          `Period to ${run.periodEnd.toLocaleDateString('en-GB')}: ${formatFigure(fromDecimal(run.gross.toString(), GBP))} for ${run.employeeCount} ${run.employeeCount === 1 ? 'person' : 'people'}, ${run.status.toLowerCase()}.`,
      ),
    ],
    source: { label: 'Payroll', href: '/payroll' },
    period: describePeriod(period, now),
  };
}

/* ---------------------------------------------------------------------------
   For the dashboard
   --------------------------------------------------------------------------- */

/** This month against last, in sentences. */
export async function revenueObservations(orgId: string, now = new Date()): Promise<string[]> {
  const current = periodBounds('month', now);
  const previous = periodBounds('last-month', now);

  const [thisMonth, lastMonth] = await Promise.all([
    revenueByServiceType(orgId, current),
    revenueByServiceType(orgId, previous),
  ]);

  const slice = (rows: typeof thisMonth, label: string) => ({
    label,
    revenue: money(
      rows.reduce((s, r) => s + r.revenueMinor, 0),
      GBP,
    ),
    cost: money(
      rows.reduce((s, r) => s + r.costMinor, 0),
      GBP,
    ),
    jobs: rows.reduce((s, r) => s + r.jobs, 0),
  });

  return observeRevenue({
    current: slice(thisMonth, describePeriod('month', now)),
    previous: slice(lastMonth, describePeriod('last-month', now)),
    byKind: thisMonth
      .slice()
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .map((row) => ({ name: row.name, revenue: money(row.revenueMinor, GBP) })),
  });
}
