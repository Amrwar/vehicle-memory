import {
  assertInvoiceCreditable,
  assertInvoiceRefundable,
  assertInvoiceable,
  assertPaymentRecordable,
  assertTransition,
  calculateTotals,
  dueDateFor,
  fromDecimal,
  type InvoiceState,
  type JobStatus,
  type Money,
  MoneyCycleError,
  type PaymentMethod,
  postCreditNote,
  postInvoiceIssued,
  postPartsConsumed,
  postPaymentReceived,
  postRefund,
  type PriceableLine,
  stateAfterCredit,
  stateAfterPayment,
  sum,
  toNumber,
  type TransitionContext,
  zero,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postEntry } from './accounting';
import { siteUrl } from './credentials';
import { audit } from './guard';
import { consumeForJob } from './inventory';
import { pushNow } from './outbound';
import { writeJobCompletion } from './passport';

/**
 * The money cycle, against the database.
 *
 * Moving a job, issuing the invoice, taking the payment, and putting things
 * right afterwards. Every write here has a ledger consequence and the ledger
 * is idempotent on the source document, so each posting sits outside the
 * transaction that wrote the document: a retry cannot double-post, and a
 * momentary ledger failure cannot undo a payment somebody has already handed
 * over.
 */

export { MoneyCycleError };

/* ---------------------------------------------------------------------------
   The job moves
   --------------------------------------------------------------------------- */

const JOB_LINES = {
  labourLines: { include: { taxRate: { select: { rate: true } } } },
  partLines: { include: { taxRate: { select: { rate: true } } } },
  feeLines: { include: { taxRate: { select: { rate: true } } } },
} as const;

type LinedJob = {
  labourLines: {
    hours: unknown;
    rate: unknown;
    discountPct: unknown;
    taxRate: { rate: unknown } | null;
  }[];
  partLines: {
    quantity: unknown;
    unitPrice: unknown;
    unitCost: unknown;
    discountPct: unknown;
    taxRate: { rate: unknown } | null;
  }[];
  feeLines: { amount: unknown; taxRate: { rate: unknown } | null }[];
};

/** The job's lines as the pricing engine wants them. */
export function priceableLinesOf(job: LinedJob): PriceableLine[] {
  return [
    ...job.labourLines.map((line) => ({
      kind: 'LABOUR' as const,
      quantity: Number(line.hours),
      unitPrice: String(line.rate),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.partLines.map((line) => ({
      kind: 'PART' as const,
      quantity: Number(line.quantity),
      unitPrice: String(line.unitPrice),
      unitCost: String(line.unitCost),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.feeLines.map((line) => ({
      kind: 'FEE' as const,
      quantity: 1,
      unitPrice: String(line.amount),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
  ];
}

/**
 * Moves a job to its next status, with everything that has to happen at the
 * same moment.
 *
 * The rules are the lifecycle's own. What is added here is the consequence of
 * completion: parts leave the shelf at what they actually cost, the passport
 * receives the events the job contributes, and the customer-facing follow-up
 * goes into the outbox. All of it in one transaction with the status change,
 * because a job that reads as completed while its parts still sit in stock is
 * the kind of inconsistency that surfaces at the stocktake.
 */
export async function moveJob(input: {
  orgId: string;
  userId: string;
  jobId: string;
  to: JobStatus;
  note?: string | null;
}): Promise<void> {
  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    include: {
      ...JOB_LINES,
      jobTypes: { include: { jobType: { select: { name: true, requiresQualityCheck: true } } } },
      qualityChecks: { orderBy: { createdAt: 'desc' }, take: 1, select: { passed: true } },
      estimates: { orderBy: { version: 'desc' }, take: 1, select: { status: true } },
      vehicle: { select: { id: true } },
      org: { select: { name: true } },
      inspections: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          performedBy: { select: { name: true } },
          results: { select: { severity: true, _count: { select: { photos: true } } } },
        },
      },
    },
  });

  const lines = priceableLinesOf(job);
  const latestEstimate = job.estimates[0];

  const context: TransitionContext = {
    requiresQualityCheck: job.jobTypes.some((entry) => entry.jobType.requiresQualityCheck),
    hasPassedQualityCheck: job.qualityChecks[0]?.passed === true,
    hasApprovedEstimate: latestEstimate
      ? latestEstimate.status === 'APPROVED' || latestEstimate.status === 'PARTIALLY_APPROVED'
      : undefined,
    hasChargeableLines: lines.length > 0,
    hasOdometerIn: job.odometerInKm !== null,
  };

  assertTransition(job.status as JobStatus, input.to, context);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: input.to,
        ...(input.to === 'IN_PROGRESS' && !job.startedAt ? { startedAt: now } : {}),
        ...(input.to === 'COMPLETED' ? { completedAt: now } : {}),
        ...(input.to === 'CANCELLED' ? { cancelledAt: now, cancelReason: input.note ?? null } : {}),
      },
    });

    await tx.jobStatusEvent.create({
      data: {
        jobId: job.id,
        fromStatus: job.status,
        toStatus: input.to,
        actorUserId: input.userId,
        note: input.note?.trim() || null,
      },
    });

    if (input.to === 'COMPLETED') {
      await tx.outboxEvent.create({
        data: {
          orgId: input.orgId,
          type: 'job.completed',
          payload: { jobId: job.id, customerId: job.customerId } as never,
        },
      });
    }
  });

  if (input.to === 'COMPLETED') {
    // Parts leave the shelf at their weighted average cost, and that cost is
    // written back onto the lines so the margin is real.
    const consumed = await consumeForJob(job.id);

    if (consumed.cost > 0) {
      await postEntry(
        input.orgId,
        postPartsConsumed({
          jobId: job.id,
          jobNumber: job.number,
          cost: fromDecimal(consumed.cost.toFixed(2)),
          at: now,
        }),
      );
    }

    const inspection = job.inspections[0];

    // The passport. This is the product's whole promise: a completed job is a
    // permanent, verifiable entry on the car's own record.
    await writeJobCompletion({
      jobId: job.id,
      jobNumber: job.number,
      vehicleId: job.vehicle.id,
      orgId: input.orgId,
      orgName: job.org.name,
      completedAt: now,
      shortDescription: job.shortDescription,
      diagnosis: job.diagnosis,
      odometerKm: job.odometerOutKm ?? job.odometerInKm,
      jobTypeNames: job.jobTypes.map((entry) => entry.jobType.name),
      labour: job.labourLines.map((line) => ({
        description: line.description,
        hours: Number(line.hours),
      })),
      parts: job.partLines.map((line) => ({
        id: line.id,
        description: line.description,
        partNumber: line.partNumber,
        quantity: Number(line.quantity),
      })),
      inspection: inspection
        ? {
            id: inspection.id,
            passCount: inspection.results.filter((r) => r.severity === 'PASS').length,
            advisoryCount: inspection.results.filter((r) => r.severity === 'ADVISORY').length,
            criticalCount: inspection.results.filter((r) => r.severity === 'CRITICAL').length,
            performedBy: inspection.performedBy?.name ?? null,
          }
        : null,
      hasPhotoEvidence: inspection?.results.some((r) => r._count.photos > 0) ?? false,
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: `job.${input.to.toLowerCase()}`,
    entityType: 'Job',
    entityId: job.id,
    before: { status: job.status },
    after: { status: input.to, note: input.note ?? null },
  });
}

/* ---------------------------------------------------------------------------
   Issuing the invoice
   --------------------------------------------------------------------------- */

/**
 * Turns a completed job into an issued invoice.
 *
 * The lines are the job's lines, priced as the job priced them, with tax per
 * line. Revenue is split by kind on the way into the ledger. The customer is
 * told, with a link to the invoice on their portal, and the job moves to
 * INVOICED in the same transaction as the number is taken so a crash cannot
 * leave a numbered invoice against a job that still says completed.
 */
export async function issueInvoice(input: {
  orgId: string;
  userId: string;
  jobId: string;
  termsDays?: number;
}): Promise<string> {
  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    include: {
      ...JOB_LINES,
      invoices: { where: { status: { not: 'VOID' } }, select: { id: true } },
      customer: { select: { id: true, displayName: true, email: true, portalUserId: true } },
      vehicle: { select: { make: true, model: true, registration: true } },
      org: { select: { name: true } },
    },
  });

  const lines = priceableLinesOf(job);

  assertInvoiceable({
    status: job.status as JobStatus,
    alreadyInvoiced: job.invoices.length > 0,
    chargeableLines: lines.length,
  });

  assertTransition(job.status as JobStatus, 'INVOICED', { hasChargeableLines: lines.length > 0 });

  const totals = calculateTotals(lines);
  const issuedAt = new Date();
  const dueAt = dueDateFor(issuedAt, input.termsDays);

  const taxRateIds = [
    ...job.labourLines.map((l) => l.taxRateId),
    ...job.partLines.map((l) => l.taxRateId),
    ...job.feeLines.map((l) => l.taxRateId),
  ];

  const descriptions = [
    ...job.labourLines.map((l) => ({ kind: 'LABOUR' as const, description: l.description })),
    ...job.partLines.map((l) => ({
      kind: 'PART' as const,
      description: l.partNumber ? `${l.partNumber} ${l.description}` : l.description,
    })),
    ...job.feeLines.map((l) => ({ kind: 'FEE' as const, description: l.description })),
  ];

  const invoice = await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentSequence.upsert({
      where: { orgId_kind: { orgId: input.orgId, kind: 'INVOICE' } },
      create: { orgId: input.orgId, kind: 'INVOICE', prefix: 'INV-', next: 2 },
      update: { next: { increment: 1 } },
    });

    const number = `${sequence.prefix || 'INV-'}${sequence.next - 1}`;

    const created = await tx.invoice.create({
      data: {
        orgId: input.orgId,
        number,
        jobId: job.id,
        customerId: job.billToCustomerId ?? job.customerId,
        status: 'ISSUED',
        currency: totals.currency,
        subtotal: toNumber(totals.subtotal),
        discountTotal: toNumber(totals.discountTotal),
        taxTotal: toNumber(totals.taxTotal),
        total: toNumber(totals.total),
        amountPaid: 0,
        issuedAt,
        dueAt,
        lines: {
          create: lines.map((line, index) => ({
            kind: line.kind,
            description: descriptions[index]!.description,
            quantity: line.quantity,
            unitPrice: Number(line.unitPrice),
            unitCost: Number(line.unitCost ?? 0),
            discountPct: line.discountPct ?? 0,
            taxRateId: taxRateIds[index] ?? null,
            taxAmount: toNumber(totals.lines[index]!.tax),
            lineTotal: toNumber(totals.lines[index]!.total),
            sortOrder: index,
          })),
        },
      },
      select: { id: true, number: true },
    });

    await tx.job.update({
      where: { id: job.id },
      data: { status: 'INVOICED', invoicedAt: issuedAt },
    });

    await tx.jobStatusEvent.create({
      data: {
        jobId: job.id,
        fromStatus: job.status,
        toStatus: 'INVOICED',
        actorUserId: input.userId,
      },
    });

    await tx.outboxEvent.create({
      data: {
        orgId: input.orgId,
        type: 'invoice.issued',
        payload: { invoiceId: created.id, jobId: job.id } as never,
      },
    });

    return created;
  });

  const netOf = (kind: PriceableLine['kind']): Money =>
    sum(
      lines.flatMap((line, index) => (line.kind === kind ? [totals.lines[index]!.net] : [])),
      totals.currency,
    );

  await postEntry(
    input.orgId,
    postInvoiceIssued({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: job.customer.displayName,
      issuedAt,
      labourNet: netOf('LABOUR'),
      partsNet: netOf('PART'),
      feeNet: netOf('FEE'),
      taxTotal: totals.taxTotal,
    }),
  );

  // Told, with somewhere to go. The portal shows the invoice to a customer
  // with an account; everybody else gets the figures in the message itself.
  if (job.customer.email) {
    const vehicle =
      [job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ') ||
      job.vehicle.registration ||
      'your vehicle';

    const queued = await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: job.customer.email,
        subject: `Invoice ${invoice.number} from ${job.org.name}`,
        body: [
          `Hello ${job.customer.displayName.split(' ')[0]}.`,
          '',
          `The work on the ${vehicle} (job ${job.number}) is finished. Invoice ${invoice.number} is for ${formatMoney(totals.total)}, due by ${dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
          '',
          job.customer.portalUserId
            ? `The invoice is on your account: ${siteUrl()}/portal/invoices`
            : 'Ring or reply if anything on it is unclear, and we will go through it with you.',
          '',
          job.org.name,
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
    action: 'invoice.issued',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: { number: invoice.number, jobId: job.id, total: toNumber(totals.total) },
  });

  return invoice.id;
}

/* ---------------------------------------------------------------------------
   Taking payment
   --------------------------------------------------------------------------- */

export async function recordPayment(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  amount: Money;
  method: PaymentMethod;
  reference?: string | null;
  receivedAt?: Date;
  notes?: string | null;
}): Promise<string> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: input.invoiceId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      customerId: true,
      jobId: true,
    },
  });

  const view = {
    status: invoice.status as InvoiceState,
    total: fromDecimal(invoice.total.toString(), invoice.currency),
    amountPaid: fromDecimal(invoice.amountPaid.toString(), invoice.currency),
  };

  assertPaymentRecordable(view, input.amount);

  const next = stateAfterPayment(view, input.amount);
  const receivedAt = input.receivedAt ?? new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        orgId: input.orgId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount: toNumber(input.amount),
        method: input.method,
        reference: input.reference?.trim() || null,
        receivedAt,
        notes: input.notes?.trim() || null,
        recordedByUserId: input.userId,
      },
      select: { id: true },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: { increment: toNumber(input.amount) }, status: next },
    });

    // The job is settled when the invoice is. Its final status is the one the
    // dashboard, the reports and the customer's own history all key on.
    if (next === 'PAID' && invoice.jobId) {
      const job = await tx.job.findUnique({
        where: { id: invoice.jobId },
        select: { status: true },
      });
      if (job?.status === 'INVOICED') {
        await tx.job.update({ where: { id: invoice.jobId }, data: { status: 'PAID' } });
        await tx.jobStatusEvent.create({
          data: {
            jobId: invoice.jobId,
            fromStatus: 'INVOICED',
            toStatus: 'PAID',
            actorUserId: input.userId,
          },
        });
      }
    }

    await tx.outboxEvent.create({
      data: {
        orgId: input.orgId,
        type: 'payment.received',
        payload: { paymentId: created.id, invoiceId: invoice.id } as never,
      },
    });

    return created;
  });

  await postEntry(
    input.orgId,
    postPaymentReceived({
      paymentId: payment.id,
      reference: `${invoice.number}/P`,
      amount: input.amount,
      method: input.method,
      receivedAt,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'payment.recorded',
    entityType: 'Payment',
    entityId: payment.id,
    after: {
      invoice: invoice.number,
      amount: toNumber(input.amount),
      method: input.method,
      settled: next === 'PAID',
    },
  });

  return payment.id;
}

/* ---------------------------------------------------------------------------
   Putting it right
   --------------------------------------------------------------------------- */

async function creditedOn(invoiceId: string, currency: string): Promise<Money> {
  const notes = await prisma.creditNote.findMany({
    where: { invoiceId },
    select: { amount: true },
  });
  return sum(
    notes.map((note) => fromDecimal(note.amount.toString(), currency)),
    currency,
  );
}

async function refundedOn(invoiceId: string, currency: string): Promise<Money> {
  const refunds = await prisma.refund.findMany({ where: { invoiceId }, select: { amount: true } });
  return sum(
    refunds.map((row) => fromDecimal(row.amount.toString(), currency)),
    currency,
  );
}

/**
 * Raises a credit note against an issued invoice.
 *
 * The invoice is never edited. The credit reduces what is owed and reverses
 * revenue and tax in proportion to what the invoice was made of, so a credit
 * on a parts-heavy invoice comes mostly out of parts revenue.
 */
export async function raiseCreditNote(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  amount: Money;
  reason: string;
}): Promise<string> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: input.invoiceId, orgId: input.orgId },
    include: {
      lines: { select: { kind: true, lineTotal: true, taxAmount: true } },
      customer: { select: { displayName: true, email: true } },
      org: { select: { name: true } },
    },
  });

  const currency = invoice.currency;
  const credited = await creditedOn(invoice.id, currency);

  const view = {
    status: invoice.status as InvoiceState,
    total: fromDecimal(invoice.total.toString(), currency),
    amountPaid: fromDecimal(invoice.amountPaid.toString(), currency),
    credited,
  };

  assertInvoiceCreditable(view, input.amount, input.reason);

  // Proportional split. The ratio of the credit to the invoice total is applied
  // to each kind's net and to the tax, so revenue comes back from where it was
  // recorded rather than from one account by convention.
  const ratio = input.amount.minor / view.total.minor;
  const netFor = (kind: string): Money => {
    const net = invoice.lines
      .filter((line) => line.kind === kind)
      .reduce((total, line) => total + (Number(line.lineTotal) - Number(line.taxAmount)), 0);
    return fromDecimal((net * ratio).toFixed(2), currency);
  };

  const taxTotal = fromDecimal((Number(invoice.taxTotal) * ratio).toFixed(2), currency);
  const labourNet = netFor('LABOUR');
  const partsNet = netFor('PART');
  const feeNet = netFor('FEE');

  // Rounding lands on labour, the largest account, so the four parts add up
  // to exactly the credit and the entry balances to the penny.
  const drift =
    input.amount.minor - (labourNet.minor + partsNet.minor + feeNet.minor + taxTotal.minor);
  const labourAdjusted: Money = { minor: labourNet.minor + drift, currency };

  const next = stateAfterCredit(view, input.amount);
  const issuedAt = new Date();

  const note = await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentSequence.upsert({
      where: { orgId_kind: { orgId: input.orgId, kind: 'CREDIT_NOTE' } },
      create: { orgId: input.orgId, kind: 'CREDIT_NOTE', prefix: 'CN-', next: 2 },
      update: { next: { increment: 1 } },
    });

    const created = await tx.creditNote.create({
      data: {
        orgId: input.orgId,
        number: `${sequence.prefix || 'CN-'}${sequence.next - 1}`,
        invoiceId: invoice.id,
        amount: toNumber(input.amount),
        reason: input.reason.trim(),
        issuedAt,
      },
      select: { id: true, number: true },
    });

    await tx.invoice.update({ where: { id: invoice.id }, data: { status: next } });

    return created;
  });

  await postEntry(
    input.orgId,
    postCreditNote({
      creditNoteId: note.id,
      number: note.number,
      invoiceNumber: invoice.number,
      labourNet: labourAdjusted,
      partsNet,
      feeNet,
      taxTotal,
      reason: input.reason.trim(),
      issuedAt,
    }),
  );

  if (invoice.customer.email) {
    const queued = await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: invoice.customer.email,
        subject: `Credit note ${note.number} against invoice ${invoice.number}`,
        body: [
          `Hello ${invoice.customer.displayName.split(' ')[0]}.`,
          '',
          `We have credited ${formatMoney(input.amount)} against invoice ${invoice.number}. Reason: ${input.reason.trim()}`,
          '',
          view.amountPaid.minor > 0
            ? 'If you had already paid, the difference is on its way back to you and we will confirm when it has been sent.'
            : 'The amount you owe has been reduced by the same figure.',
          '',
          invoice.org.name,
        ].join('\n'),
        status: 'QUEUED',
        relatedType: 'CreditNote',
        relatedId: note.id,
      },
      select: { id: true },
    });

    await pushNow(queued.id);
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'creditnote.raised',
    entityType: 'CreditNote',
    entityId: note.id,
    after: {
      number: note.number,
      invoice: invoice.number,
      amount: toNumber(input.amount),
      reason: input.reason,
    },
  });

  return note.id;
}

/** Sends money back, against a credit note. */
export async function recordRefund(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  creditNoteId: string;
  amount: Money;
  method: PaymentMethod;
  reference?: string | null;
}): Promise<string> {
  const [invoice, note] = await Promise.all([
    prisma.invoice.findFirstOrThrow({
      where: { id: input.invoiceId, orgId: input.orgId },
      select: {
        id: true,
        number: true,
        currency: true,
        amountPaid: true,
        customerId: true,
        customer: { select: { displayName: true, email: true } },
        org: { select: { name: true } },
      },
    }),
    prisma.creditNote.findFirst({
      where: { id: input.creditNoteId, invoiceId: input.invoiceId, orgId: input.orgId },
      select: { id: true, number: true, reason: true },
    }),
  ]);

  const currency = invoice.currency;
  const [credited, refunded] = await Promise.all([
    creditedOn(invoice.id, currency),
    refundedOn(invoice.id, currency),
  ]);

  // The rule about needing a credit note is checked before the note itself is
  // looked for, so somebody with no credit note at all is told to raise one
  // rather than told that an id they never had does not exist.
  if (!note) {
    assertInvoiceRefundable({
      amountPaid: fromDecimal(invoice.amountPaid.toString(), currency),
      refunded,
      credited,
      amount: input.amount,
    });

    throw new MoneyCycleError('NO_CREDIT', 'That credit note is not on this invoice.');
  }

  assertInvoiceRefundable({
    amountPaid: fromDecimal(invoice.amountPaid.toString(), currency),
    refunded,
    credited,
    amount: input.amount,
  });

  const refundedAt = new Date();

  const refund = await prisma.refund.create({
    data: {
      orgId: input.orgId,
      invoiceId: invoice.id,
      creditNoteId: note.id,
      customerId: invoice.customerId,
      amount: toNumber(input.amount),
      method: input.method,
      reference: input.reference?.trim() || null,
      reason: note.reason,
      refundedAt,
      recordedByUserId: input.userId,
    },
    select: { id: true },
  });

  await postEntry(
    input.orgId,
    postRefund({
      refundId: refund.id,
      reference: `${note.number}/R`,
      amount: input.amount,
      method: input.method,
      refundedAt,
      reason: note.reason,
    }),
  );

  if (invoice.customer.email) {
    const queued = await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: invoice.customer.email,
        subject: `Refund of ${formatMoney(input.amount)} from ${invoice.org.name}`,
        body: [
          `Hello ${invoice.customer.displayName.split(' ')[0]}.`,
          '',
          `${formatMoney(input.amount)} is on its way back to you by ${describeMethod(input.method)}, against credit note ${note.number} on invoice ${invoice.number}.`,
          '',
          input.reference ? `Reference: ${input.reference}` : '',
          invoice.org.name,
        ]
          .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
          .join('\n'),
        status: 'QUEUED',
        relatedType: 'Refund',
        relatedId: refund.id,
      },
      select: { id: true },
    });

    await pushNow(queued.id);
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'refund.recorded',
    entityType: 'Refund',
    entityId: refund.id,
    after: {
      invoice: invoice.number,
      creditNote: note.number,
      amount: toNumber(input.amount),
      method: input.method,
    },
  });

  return refund.id;
}

/* ---------------------------------------------------------------------------
   Reading
   --------------------------------------------------------------------------- */

/** Everything the invoice page shows, in one query. */
export async function invoiceDetail(orgId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    include: {
      customer: { select: { id: true, displayName: true, email: true, mobile: true } },
      job: {
        select: {
          id: true,
          number: true,
          status: true,
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { taxRate: { select: { name: true, rate: true } } },
      },
      payments: {
        orderBy: { receivedAt: 'desc' },
        include: { recordedBy: { select: { name: true } } },
      },
      creditNotes: { orderBy: { issuedAt: 'desc' } },
      refunds: {
        orderBy: { refundedAt: 'desc' },
        include: { creditNote: { select: { number: true } } },
      },
    },
  });

  if (!invoice) return null;

  const currency = invoice.currency;
  const total = fromDecimal(invoice.total.toString(), currency);
  const amountPaid = fromDecimal(invoice.amountPaid.toString(), currency);
  const credited = sum(
    invoice.creditNotes.map((n) => fromDecimal(n.amount.toString(), currency)),
    currency,
  );
  const refunded = sum(
    invoice.refunds.map((r) => fromDecimal(r.amount.toString(), currency)),
    currency,
  );

  const owed = total.minor - amountPaid.minor - credited.minor;

  return {
    invoice,
    money: {
      total,
      amountPaid,
      credited,
      refunded,
      outstanding: { minor: Math.max(0, owed), currency } as Money,
      /** Money the customer is owed back and has not yet received. */
      owedBack: {
        minor: Math.max(0, Math.min(amountPaid.minor, credited.minor) - refunded.minor),
        currency,
      } as Money,
      zero: zero(currency),
    },
  };
}

function formatMoney(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

function describeMethod(method: PaymentMethod): string {
  switch (method) {
    case 'CASH':
      return 'cash';
    case 'CARD':
      return 'card';
    case 'BANK_TRANSFER':
      return 'bank transfer';
    case 'CHEQUE':
      return 'cheque';
    case 'ONLINE':
      return 'online payment';
    case 'ACCOUNT':
      return 'account credit';
    default:
      return 'the original method';
  }
}
