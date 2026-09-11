import { prisma } from '@carnet/db';

/**
 * A company with vehicles, rather than fifty unrelated customer records.
 *
 * No new table. A fleet is a company customer that happens to have several
 * vehicles, and inventing a separate entity for it would mean two places a
 * vehicle can belong and an eventual argument about which one is right.
 *
 * What a fleet manager needs is not another list of jobs. It is the four
 * numbers they are asked for in their own meetings: how many vehicles they
 * have, how many are off the road right now, how many are due, and what the
 * month cost. Everything else on the page exists to explain one of those.
 */

/** A visit that happened, rather than one that is merely booked. */
const DONE = ['COMPLETED', 'INVOICED', 'PAID'] as const;

export interface FleetSummary {
  id: string;
  name: string;
  vehicles: number;
  /** In the workshop at this moment. */
  offTheRoad: number;
  /** Service due inside the next month. */
  dueSoon: number;
  /** Service due and already past it. */
  overdue: number;
  /** Invoiced in the last thirty days. */
  spend: number;
  /** Quotes waiting on somebody at the company to decide. */
  awaitingApproval: number;
}

/**
 * Every company customer with more than one vehicle.
 *
 * The threshold is deliberate. A company with one van is a customer; the
 * fleet screens only earn their place once somebody is managing several, and
 * listing every sole trader here would bury the two accounts that matter.
 */
export async function fleets(orgId: string, now = new Date()): Promise<FleetSummary[]> {
  const soon = new Date(now.getTime() + 30 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const customers = await prisma.customer.findMany({
    where: { orgId, kind: 'COMPANY', isActive: true },
    select: {
      id: true,
      displayName: true,
      jobs: {
        select: {
          status: true,
          vehicleId: true,
          vehicle: {
            select: {
              id: true,
              serviceSchedules: {
                where: { isActive: true },
                select: { dueAt: true },
              },
            },
          },
        },
      },
      invoices: {
        where: { issuedAt: { gte: monthAgo }, status: { in: ['ISSUED', 'PART_PAID', 'PAID'] } },
        select: { total: true },
      },
    },
  });

  const summaries = customers.map((customer) => {
    // A fleet's vehicles are the distinct ones it has brought in. There is no
    // register of ownership to read, and inventing one would be a second
    // answer to a question the job history already answers.
    const vehicles = new Map<string, { dueAt: Date | null }>();

    for (const job of customer.jobs) {
      if (!job.vehicle) continue;

      const due = job.vehicle.serviceSchedules
        .map((schedule) => schedule.dueAt)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      vehicles.set(job.vehicle.id, { dueAt: due ?? null });
    }

    const dueDates = [...vehicles.values()].map((entry) => entry.dueAt);

    return {
      id: customer.id,
      name: customer.displayName,
      vehicles: vehicles.size,
      offTheRoad: customer.jobs.filter((job) =>
        ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(
          job.status,
        ),
      ).length,
      dueSoon: dueDates.filter((date) => date && date >= now && date <= soon).length,
      overdue: dueDates.filter((date) => date && date < now).length,
      spend: customer.invoices.reduce((total, invoice) => total + Number(invoice.total), 0),
      awaitingApproval: customer.jobs.filter((job) => job.status === 'AWAITING_APPROVAL').length,
    };
  });

  return summaries.filter((fleet) => fleet.vehicles > 1).sort((a, b) => b.vehicles - a.vehicles);
}

/**
 * One fleet, vehicle by vehicle.
 *
 * The order is what somebody can act on: off the road first, then overdue,
 * then due soon, then everything healthy. A fleet manager opens this to find
 * out what is wrong, not to admire the vans that are fine.
 */
export async function fleetDetail(orgId: string, customerId: string, now = new Date()) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId, kind: 'COMPANY' },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      mobile: true,
      jobs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          shortDescription: true,
          completedAt: true,
          createdAt: true,
          promisedAt: true,
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              registration: true,
              lastOdometerKm: true,
              serviceSchedules: {
                where: { isActive: true },
                orderBy: { dueAt: 'asc' },
                select: { name: true, dueAt: true, dueKm: true },
              },
            },
          },
          estimates: {
            where: { status: 'SENT' },
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true, total: true, currency: true },
          },
          invoices: { select: { total: true, amountPaid: true } },
        },
      },
    },
  });

  if (!customer) return null;

  const byVehicle = new Map<
    string,
    {
      vehicle: NonNullable<(typeof customer.jobs)[number]['vehicle']>;
      lastVisit: Date | null;
      openJob: (typeof customer.jobs)[number] | null;
      awaiting: (typeof customer.jobs)[number] | null;
      spend: number;
    }
  >();

  for (const job of customer.jobs) {
    if (!job.vehicle) continue;

    const existing = byVehicle.get(job.vehicle.id) ?? {
      vehicle: job.vehicle,
      lastVisit: null,
      openJob: null,
      awaiting: null,
      spend: 0,
    };

    if (DONE.includes(job.status as (typeof DONE)[number])) {
      const when = job.completedAt ?? job.createdAt;
      if (!existing.lastVisit || when > existing.lastVisit) existing.lastVisit = when;
    }

    if (
      !existing.openJob &&
      ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(job.status)
    ) {
      existing.openJob = job;
    }

    if (!existing.awaiting && job.status === 'AWAITING_APPROVAL') existing.awaiting = job;

    existing.spend += job.invoices.reduce((total, invoice) => total + Number(invoice.total), 0);

    byVehicle.set(job.vehicle.id, existing);
  }

  const rows = [...byVehicle.values()].map((entry) => {
    const due = entry.vehicle.serviceSchedules[0]?.dueAt ?? null;

    return {
      ...entry,
      dueAt: due,
      overdue: Boolean(due && due < now),
      dueSoon: Boolean(due && due >= now && due <= new Date(now.getTime() + 30 * 86_400_000)),
    };
  });

  // What is wrong, first.
  const rank = (row: (typeof rows)[number]) =>
    row.awaiting ? 0 : row.openJob ? 1 : row.overdue ? 2 : row.dueSoon ? 3 : 4;

  rows.sort((a, b) => rank(a) - rank(b));

  return {
    customer,
    vehicles: rows,
    totals: {
      vehicles: rows.length,
      offTheRoad: rows.filter((row) => row.openJob).length,
      overdue: rows.filter((row) => row.overdue).length,
      awaiting: rows.filter((row) => row.awaiting).length,
      spend: rows.reduce((total, row) => total + row.spend, 0),
    },
  };
}
