import {
  type Agreement,
  applyFleetAgreement,
  assertAgreementSaveable,
  assertConsolidatable,
  calculateTotals,
  consolidationWindow,
  describeConsolidation,
  dueDateFor,
  FleetError,
  type JobStatus,
  type Money,
  postInvoiceIssued,
  type PriceableLine,
  sum,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postEntry } from './accounting';
import { audit } from './guard';
import { priceableLinesOf } from './money';
import { pushNow } from './outbound';
import { regionFor } from './region';

export { FleetError };

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

/* ---------------------------------------------------------------------------
   What the fleet has agreed
   --------------------------------------------------------------------------- */

export async function fleetAgreementFor(orgId: string, customerId: string) {
  return prisma.fleetAgreement.findFirst({ where: { orgId, customerId } });
}

/** Writes or replaces a fleet's terms. */
export async function saveFleetAgreement(input: {
  orgId: string;
  userId: string;
  customerId: string;
  agreement: Agreement & { notes?: string | null };
}): Promise<void> {
  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true, kind: true, displayName: true },
  });

  assertAgreementSaveable({ customerKind: customer.kind, agreement: input.agreement });

  const data = {
    labourDiscountPct: input.agreement.labourDiscountPct,
    partsDiscountPct: input.agreement.partsDiscountPct,
    paymentTermsDays: input.agreement.paymentTermsDays,
    consolidateMonthly: input.agreement.consolidateMonthly,
    purchaseOrderRequired: input.agreement.purchaseOrderRequired,
    notes: input.agreement.notes?.trim() || null,
  };

  await prisma.fleetAgreement.upsert({
    where: { customerId: customer.id },
    create: { orgId: input.orgId, customerId: customer.id, ...data },
    update: data,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fleet.agreement.saved',
    entityType: 'Customer',
    entityId: customer.id,
    after: { customer: customer.displayName, ...data },
  });
}

/* ---------------------------------------------------------------------------
   One invoice a month
   --------------------------------------------------------------------------- */

/**
 * Invoices a month of a fleet's completed work as one document.
 *
 * Each job's lines go on with the agreed discount applied at this moment, so
 * the job keeps its list-price figures and the invoice shows what was charged.
 * Every job included moves to invoiced in the same transaction as the number
 * is taken, and each invoice line remembers which job it came from, so the
 * fleet's accounts department can tie a line to a van.
 */
export async function consolidateMonth(input: {
  orgId: string;
  userId: string;
  customerId: string;
  year: number;
  month: number;
}): Promise<string> {
  const region = await regionFor(input.orgId);
  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: input.customerId, orgId: input.orgId, kind: 'COMPANY' },
    select: { id: true, displayName: true, email: true, fleetAgreement: true },
  });

  const agreement = customer.fleetAgreement;

  if (!agreement) {
    throw new FleetError(
      'NOTHING_TO_INVOICE',
      'This fleet has no agreement yet. Save the terms first, so the invoice knows what discount and payment terms to apply.',
    );
  }

  const window = consolidationWindow(input.year, input.month);

  const jobs = await prisma.job.findMany({
    where: {
      orgId: input.orgId,
      OR: [{ customerId: customer.id }, { billToCustomerId: customer.id }],
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      completedAt: { gte: window.from, lte: window.to },
    },
    include: {
      labourLines: { include: { taxRate: { select: { rate: true } } } },
      partLines: { include: { taxRate: { select: { rate: true } } } },
      feeLines: { include: { taxRate: { select: { rate: true } } } },
      invoices: { where: { status: { not: 'VOID' } }, select: { id: true } },
      invoiceLines: { select: { id: true } },
      vehicle: { select: { registration: true, make: true, model: true } },
    },
  });

  const { include, skipped } = assertConsolidatable({
    jobs: jobs.map((job) => ({
      id: job.id,
      number: job.number,
      status: job.status,
      completedAt: job.completedAt,
      purchaseOrderNumber: job.customerOrderNumber,
      alreadyInvoiced: job.invoices.length > 0 || job.invoiceLines.length > 0,
      chargeableLines: job.labourLines.length + job.partLines.length + job.feeLines.length,
    })),
    window,
    agreement,
  });

  const included = jobs.filter((job) => include.some((entry) => entry.id === job.id));

  // Every line, tagged with its job, at list and at the agreed price.
  const listLines: PriceableLine[] = [];
  const agreedLines: PriceableLine[] = [];
  const lineJobs: { jobId: string; description: string; taxRateId: string | null }[] = [];

  for (const job of included) {
    const lines = priceableLinesOf(job);
    const agreed = applyFleetAgreement(lines, {
      labourDiscountPct: Number(agreement.labourDiscountPct),
      partsDiscountPct: Number(agreement.partsDiscountPct),
    });

    const vehicle =
      job.vehicle.registration ??
      [job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ') ??
      'vehicle';

    const descriptions = [
      ...job.labourLines.map((l) => ({ description: l.description, taxRateId: l.taxRateId })),
      ...job.partLines.map((l) => ({
        description: l.partNumber ? `${l.partNumber} ${l.description}` : l.description,
        taxRateId: l.taxRateId,
      })),
      ...job.feeLines.map((l) => ({ description: l.description, taxRateId: l.taxRateId })),
    ];

    lines.forEach((_, index) => {
      listLines.push(lines[index]!);
      agreedLines.push(agreed[index]!);
      lineJobs.push({
        jobId: job.id,
        description: `${vehicle} · job ${job.number}: ${descriptions[index]!.description}`,
        taxRateId: descriptions[index]!.taxRateId,
      });
    });
  }

  const totals = calculateTotals(agreedLines, region.currency);
  const list = calculateTotals(listLines, region.currency);
  const issuedAt = new Date();
  const dueAt = dueDateFor(issuedAt, agreement.paymentTermsDays);

  const invoice = await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentSequence.upsert({
      where: { orgId_kind: { orgId: input.orgId, kind: 'INVOICE' } },
      create: { orgId: input.orgId, kind: 'INVOICE', prefix: 'INV-', next: 2 },
      update: { next: { increment: 1 } },
    });

    const created = await tx.invoice.create({
      data: {
        orgId: input.orgId,
        number: `${sequence.prefix || 'INV-'}${sequence.next - 1}`,
        jobId: null,
        customerId: customer.id,
        status: 'ISSUED',
        currency: totals.currency,
        subtotal: toNumber(totals.subtotal),
        discountTotal: toNumber(totals.discountTotal),
        taxTotal: toNumber(totals.taxTotal),
        total: toNumber(totals.total),
        amountPaid: 0,
        issuedAt,
        dueAt,
        notes: `${window.label}: ${included.length} job${included.length === 1 ? '' : 's'} under the fleet agreement.`,
        lines: {
          create: agreedLines.map((line, index) => ({
            kind: line.kind,
            description: lineJobs[index]!.description,
            quantity: line.quantity,
            unitPrice: Number(line.unitPrice),
            unitCost: Number(line.unitCost ?? 0),
            discountPct: line.discountPct ?? 0,
            taxRateId: lineJobs[index]!.taxRateId,
            taxAmount: toNumber(totals.lines[index]!.tax),
            lineTotal: toNumber(totals.lines[index]!.total),
            sortOrder: index,
            jobId: lineJobs[index]!.jobId,
          })),
        },
      },
      select: { id: true, number: true },
    });

    for (const job of included) {
      await tx.job.update({
        where: { id: job.id },
        data: { status: 'INVOICED', invoicedAt: issuedAt },
      });
      await tx.jobStatusEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status as JobStatus,
          toStatus: 'INVOICED',
          actorUserId: input.userId,
          note: `On consolidated invoice ${created.number}`,
        },
      });
    }

    return created;
  });

  const netOf = (kind: PriceableLine['kind']): Money =>
    sum(
      agreedLines.flatMap((line, index) => (line.kind === kind ? [totals.lines[index]!.net] : [])),
      totals.currency,
    );

  await postEntry(
    input.orgId,
    postInvoiceIssued({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: customer.displayName,
      issuedAt,
      labourNet: netOf('LABOUR'),
      partsNet: netOf('PART'),
      feeNet: netOf('FEE'),
      taxTotal: totals.taxTotal,
    }),
  );

  const saved: Money = {
    minor: Math.max(0, list.subtotal.minor - totals.subtotal.minor),
    currency: totals.currency,
  };

  if (customer.email) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.orgId },
      select: { name: true },
    });
    const summary = describeConsolidation({
      fleetName: customer.displayName,
      label: window.label,
      jobs: included.length,
      total: totals.total,
      saved,
    });

    const queued = await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: customer.email,
        subject: `Invoice ${invoice.number} for ${window.label} from ${org.name}`,
        body: [
          `${customer.displayName},`,
          '',
          summary,
          '',
          `Due by ${dueAt.toLocaleDateString(region.locale, { day: 'numeric', month: 'long' })}. Each line names the vehicle and the job it came from.`,
          '',
          org.name,
        ].join('\n'),
        status: 'QUEUED',
        relatedType: 'Invoice',
        relatedId: invoice.id,
      },
      select: { id: true },
    });

    await pushNow(queued.id);
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fleet.invoiced',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: {
      customer: customer.displayName,
      month: window.label,
      jobs: included.length,
      skipped: skipped.length,
      total: toNumber(totals.total),
      saved: toNumber(saved),
    },
  });

  return invoice.id;
}
