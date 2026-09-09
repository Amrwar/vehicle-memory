import { prisma } from '@carnet/db';

/**
 * The reports a workshop actually runs.
 *
 * Every figure here is derived from the records at request time. Nothing is
 * accumulated in a column, because a stored total drifts from the rows behind
 * it and the drift is invisible: the number still looks authoritative.
 */

export interface Period {
  from: Date;
  to: Date;
}

export function periodFor(key: string): Period & { label: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (key === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to,
      label: now.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    };
  }

  if (key === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    return {
      from: new Date(now.getFullYear(), quarter * 3, 1),
      to,
      label: `${now.getFullYear()} Q${quarter + 1} to date`,
    };
  }

  return { from: new Date(now.getFullYear(), 0, 1), to, label: `${now.getFullYear()} to date` };
}

/* ---------------------------------------------------------------------------
   Revenue by service type
   --------------------------------------------------------------------------- */

export interface ServiceTypeRow {
  name: string;
  jobs: number;
  revenueMinor: number;
  costMinor: number;
  marginPct: number | null;
  averageMinor: number;
}

/**
 * What kind of work actually pays.
 *
 * Cost includes both parts and clocked labour, so a job type that looks busy
 * and earns nothing is visible. Revenue alone would rank a brake job above a
 * diagnostic hour, which is exactly backwards for most workshops.
 */
export async function revenueByServiceType(
  orgId: string,
  period: Period,
): Promise<ServiceTypeRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      completedAt: { gte: period.from, lte: period.to },
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
    },
    include: {
      jobTypes: { include: { jobType: { select: { name: true } } } },
      labourLines: true,
      partLines: true,
      feeLines: true,
      timeEntries: { select: { minutes: true, costRate: true } },
    },
  });

  const byType = new Map<string, ServiceTypeRow>();

  for (const job of jobs) {
    const revenue =
      job.labourLines.reduce(
        (total, line) => total + Math.round(Number(line.hours) * Number(line.rate) * 100),
        0,
      ) +
      job.partLines.reduce(
        (total, line) => total + Math.round(Number(line.quantity) * Number(line.unitPrice) * 100),
        0,
      ) +
      job.feeLines.reduce((total, line) => total + Math.round(Number(line.amount) * 100), 0);

    const cost =
      job.partLines.reduce(
        (total, line) => total + Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
        0,
      ) +
      job.timeEntries.reduce(
        (total, entry) =>
          total + Math.round(((entry.minutes ?? 0) / 60) * Number(entry.costRate ?? 0) * 100),
        0,
      );

    // A job with no type is still work somebody did.
    const names = job.jobTypes.length
      ? job.jobTypes.map((link) => link.jobType.name)
      : ['Not categorised'];

    for (const name of names) {
      const row = byType.get(name) ?? {
        name,
        jobs: 0,
        revenueMinor: 0,
        costMinor: 0,
        marginPct: null,
        averageMinor: 0,
      };

      // Split across types rather than counted once per type, so a job tagged
      // twice does not appear as two jobs' worth of revenue.
      row.jobs += 1 / names.length;
      row.revenueMinor += Math.round(revenue / names.length);
      row.costMinor += Math.round(cost / names.length);
      byType.set(name, row);
    }
  }

  return [...byType.values()]
    .map((row) => ({
      ...row,
      jobs: Math.round(row.jobs * 10) / 10,
      marginPct:
        row.revenueMinor === 0
          ? null
          : Math.round(((row.revenueMinor - row.costMinor) / row.revenueMinor) * 1000) / 10,
      averageMinor: row.jobs > 0 ? Math.round(row.revenueMinor / row.jobs) : 0,
    }))
    .sort((a, b) => b.revenueMinor - a.revenueMinor);
}

/* ---------------------------------------------------------------------------
   Parts profitability
   --------------------------------------------------------------------------- */

export interface PartsRow {
  category: string;
  partNumber: string;
  name: string;
  quantity: number;
  revenueMinor: number;
  costMinor: number;
  marginPct: number | null;
}

/**
 * Which parts earn and which are sold at a loss.
 *
 * Loss-making lines are the finding. A part whose sell price has not moved
 * since the supplier put their cost up is invisible everywhere else in the
 * system, and it goes on being sold at a loss until somebody looks.
 */
export async function partsProfitability(orgId: string, period: Period): Promise<PartsRow[]> {
  const [jobLines, saleLines] = await Promise.all([
    prisma.jobPartLine.findMany({
      where: {
        job: {
          orgId,
          completedAt: { gte: period.from, lte: period.to },
          status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
        },
      },
      include: { product: { include: { category: { select: { name: true } } } } },
    }),
    prisma.counterSaleLine.findMany({
      where: {
        sale: { orgId, status: 'PAID', soldAt: { gte: period.from, lte: period.to } },
        productId: { not: null },
      },
      include: { product: { include: { category: { select: { name: true } } } } },
    }),
  ]);

  const rows = new Map<string, PartsRow>();

  const add = (
    key: string,
    category: string,
    partNumber: string,
    name: string,
    quantity: number,
    revenueMinor: number,
    costMinor: number,
  ) => {
    const row = rows.get(key) ?? {
      category,
      partNumber,
      name,
      quantity: 0,
      revenueMinor: 0,
      costMinor: 0,
      marginPct: null,
    };

    row.quantity += quantity;
    row.revenueMinor += revenueMinor;
    row.costMinor += costMinor;
    rows.set(key, row);
  };

  for (const line of jobLines) {
    const key = line.productId ?? `free:${line.description}`;

    add(
      key,
      line.product?.category?.name ?? 'Uncategorised',
      line.product?.partNumber ?? line.partNumber ?? '—',
      line.product?.name ?? line.description,
      Number(line.quantity),
      Math.round(Number(line.quantity) * Number(line.unitPrice) * 100),
      Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
    );
  }

  for (const line of saleLines) {
    const key = line.productId ?? `free:${line.description}`;

    add(
      key,
      line.product?.category?.name ?? 'Uncategorised',
      line.product?.partNumber ?? '—',
      line.product?.name ?? line.description,
      Number(line.quantity),
      Math.round(Number(line.quantity) * Number(line.unitPrice) * 100),
      Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
    );
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      marginPct:
        row.revenueMinor === 0
          ? null
          : Math.round(((row.revenueMinor - row.costMinor) / row.revenueMinor) * 1000) / 10,
    }))
    .sort((a, b) => b.revenueMinor - a.revenueMinor);
}

/* ---------------------------------------------------------------------------
   Customer retention
   --------------------------------------------------------------------------- */

export interface RetentionRow {
  customerId: string;
  name: string;
  visits: number;
  firstVisit: Date | null;
  lastVisit: Date | null;
  lifetimeMinor: number;
  averageMinor: number;
  daysSinceLastVisit: number | null;
  /** Past twice their usual gap, so probably gone elsewhere. */
  lapsing: boolean;
}

/**
 * Who comes back, and who has quietly stopped.
 *
 * Lapsing is measured against each customer's own rhythm rather than a fixed
 * number of months. Somebody who services twice a year is not lapsed at seven
 * months; somebody who comes every six weeks is.
 */
export async function retention(orgId: string, limit = 50): Promise<RetentionRow[]> {
  const customers = await prisma.customer.findMany({
    where: { orgId, isActive: true },
    include: {
      jobs: {
        where: { status: { in: ['COMPLETED', 'INVOICED', 'PAID'] } },
        select: { completedAt: true },
        orderBy: { completedAt: 'asc' },
      },
      // VOID rather than CANCELLED: a voided invoice never counted as revenue.
      invoices: { where: { status: { not: 'VOID' } }, select: { total: true } },
    },
  });

  const now = Date.now();

  return customers
    .map((customer): RetentionRow => {
      const visits = customer.jobs.filter((job) => job.completedAt !== null);
      const first = visits[0]?.completedAt ?? null;
      const last = visits[visits.length - 1]?.completedAt ?? null;

      const lifetimeMinor = customer.invoices.reduce(
        (total, invoice) => total + Math.round(Number(invoice.total) * 100),
        0,
      );

      const days = last ? Math.floor((now - last.getTime()) / 86_400_000) : null;

      // Their own average gap, from their own history.
      const gap =
        visits.length > 1 && first && last
          ? (last.getTime() - first.getTime()) / 86_400_000 / (visits.length - 1)
          : null;

      return {
        customerId: customer.id,
        name: customer.displayName,
        visits: visits.length,
        firstVisit: first,
        lastVisit: last,
        lifetimeMinor,
        averageMinor: visits.length > 0 ? Math.round(lifetimeMinor / visits.length) : 0,
        daysSinceLastVisit: days,
        lapsing: gap !== null && days !== null && days > gap * 2,
      };
    })
    .sort((a, b) => b.lifetimeMinor - a.lifetimeMinor)
    .slice(0, limit);
}

/* ---------------------------------------------------------------------------
   Where the work comes from
   --------------------------------------------------------------------------- */

export interface SourceRow {
  source: string;
  bookings: number;
  converted: number;
  conversionPct: number;
}

/**
 * Which channel actually produces work.
 *
 * Conversion matters more than volume: a source that books ten and turns two
 * into jobs is worse than one that books three and converts all of them, and
 * counting bookings alone says the opposite.
 */
export async function bySource(orgId: string, period: Period): Promise<SourceRow[]> {
  const bookings = await prisma.booking.findMany({
    where: { orgId, startAt: { gte: period.from, lte: period.to } },
    select: { source: true, status: true, jobId: true },
  });

  const rows = new Map<string, SourceRow>();

  for (const booking of bookings) {
    const row = rows.get(booking.source) ?? {
      source: booking.source,
      bookings: 0,
      converted: 0,
      conversionPct: 0,
    };

    row.bookings += 1;
    if (booking.jobId || booking.status === 'CONVERTED') row.converted += 1;
    rows.set(booking.source, row);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      conversionPct:
        row.bookings === 0 ? 0 : Math.round((row.converted / row.bookings) * 1000) / 10,
    }))
    .sort((a, b) => b.bookings - a.bookings);
}
