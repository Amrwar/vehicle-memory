import { prisma } from '@carnet/db';

/**
 * One customer's whole history as a single thread.
 *
 * Every one of these events was already in the database and each lived on its
 * own screen: visits under jobs, quotes under estimates, money under payments,
 * messages under messages. A person asking "what happened with this customer"
 * had to open four pages and hold the dates in their head.
 *
 * The thread is the answer, and it reads the way somebody recounts it: the car
 * came in, we found something, we quoted, they said yes to part of it, they
 * paid, we reminded them in September.
 *
 * Merged in memory rather than by a union query. A customer has hundreds of
 * events, not millions, and five readable queries beat one clever one that
 * nobody can change later.
 */

export type EntryKind =
  'VISIT' | 'QUOTE' | 'DECISION' | 'INVOICE' | 'PAYMENT' | 'MESSAGE' | 'BOOKING';

export interface TimelineEntry {
  id: string;
  kind: EntryKind;
  at: Date;
  /** One line, in the order somebody would say it. */
  title: string;
  detail?: string | null;
  /** Money, where the event is about money. */
  amount?: number | null;
  /** Where to go to see it properly. */
  href?: string | null;
  registration?: string | null;
}

const DONE = ['COMPLETED', 'INVOICED', 'PAID'];

export async function timelineFor(orgId: string, customerId: string, limit = 60) {
  const [jobs, invoices, payments, bookings] = await Promise.all([
    prisma.job.findMany({
      where: { orgId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        number: true,
        status: true,
        shortDescription: true,
        createdAt: true,
        completedAt: true,
        vehicle: { select: { make: true, model: true, registration: true } },
        estimates: {
          select: {
            id: true,
            version: true,
            status: true,
            total: true,
            sentAt: true,
            decidedAt: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { orgId, customerId, issuedAt: { not: null } },
      orderBy: { issuedAt: 'desc' },
      take: 30,
      select: { id: true, number: true, total: true, issuedAt: true },
    }),
    prisma.payment.findMany({
      where: { orgId, customerId },
      orderBy: { receivedAt: 'desc' },
      take: 30,
      select: { id: true, amount: true, method: true, receivedAt: true },
    }),
    prisma.booking.findMany({
      where: { orgId, customerId },
      orderBy: { startAt: 'desc' },
      take: 20,
      select: {
        id: true,
        startAt: true,
        description: true,
        status: true,
        vehicle: { select: { registration: true } },
      },
    }),
  ]);

  const entries: TimelineEntry[] = [];

  for (const job of jobs) {
    const car = `${job.vehicle.make ?? ''} ${job.vehicle.model ?? ''}`.trim() || 'the vehicle';

    entries.push({
      id: `job-${job.id}`,
      kind: 'VISIT',
      at: job.completedAt ?? job.createdAt,
      title: DONE.includes(job.status)
        ? `${car}: ${job.shortDescription}`
        : `${car} came in for ${job.shortDescription}`,
      detail: `Job ${job.number}`,
      href: `/jobs/${job.id}`,
      registration: job.vehicle.registration,
    });

    for (const estimate of job.estimates) {
      if (estimate.sentAt) {
        entries.push({
          id: `est-${estimate.id}`,
          kind: 'QUOTE',
          at: estimate.sentAt,
          title: `Quote sent for ${car}`,
          detail: `Version ${estimate.version}`,
          amount: Number(estimate.total),
          href: `/jobs/${job.id}`,
          registration: job.vehicle.registration,
        });
      }

      if (estimate.decidedAt) {
        entries.push({
          id: `dec-${estimate.id}`,
          kind: 'DECISION',
          at: estimate.decidedAt,
          title:
            estimate.status === 'DECLINED'
              ? 'They turned the work down'
              : estimate.status === 'PARTIALLY_APPROVED'
                ? 'They approved part of the quote'
                : 'They approved the work',
          detail: `Version ${estimate.version}`,
          href: `/jobs/${job.id}`,
          registration: job.vehicle.registration,
        });
      }
    }
  }

  for (const invoice of invoices) {
    entries.push({
      id: `inv-${invoice.id}`,
      kind: 'INVOICE',
      at: invoice.issuedAt!,
      title: `Invoiced ${invoice.number ?? ''}`.trim(),
      amount: Number(invoice.total),
      href: '/invoices',
    });
  }

  for (const payment of payments) {
    entries.push({
      id: `pay-${payment.id}`,
      kind: 'PAYMENT',
      at: payment.receivedAt,
      title: `Paid by ${payment.method.toLowerCase().replace(/_/g, ' ')}`,
      amount: Number(payment.amount),
      href: '/payments',
    });
  }

  for (const booking of bookings) {
    entries.push({
      id: `book-${booking.id}`,
      kind: 'BOOKING',
      at: booking.startAt,
      title:
        booking.status === 'NO_SHOW'
          ? `Did not turn up for ${booking.description}`
          : `Booked in for ${booking.description}`,
      href: `/bookings/${booking.id}`,
      registration: booking.vehicle.registration,
    });
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/**
 * Messages this customer was actually sent.
 *
 * Separate from the thread above because they are matched on the address
 * rather than joined on an id, and mixing a certain record with a probable one
 * in the same list would make the whole thing less trustworthy than either.
 */
export async function messagesFor(orgId: string, customerId: string, limit = 20) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true, mobile: true },
  });

  const addresses = [customer?.email, customer?.mobile].filter((value): value is string =>
    Boolean(value),
  );

  if (addresses.length === 0) return [];

  return prisma.messageLog.findMany({
    where: { orgId, toAddress: { in: addresses } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      channel: true,
      subject: true,
      body: true,
      status: true,
      error: true,
      sentAt: true,
      createdAt: true,
    },
  });
}
