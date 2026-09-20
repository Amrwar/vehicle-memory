import { type Erased, ERASURE, type Export, FORGOTTEN, REDACTED, treatmentOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Taking everything, and being forgotten. Phase 62. FR-209, NFR-502, NFR-503.
 *
 * Maria sells her car and asks the workshop to forget her. Her name, her
 * address, her telephone number and her signature must go. The fact that the
 * brake discs were replaced at 82,430 km must stay, because it belongs to the
 * vehicle and the next person to buy it is entitled to it — and so must what
 * the workshop charged, for seven years, because that is the law.
 *
 * The register in `core/privacy` says what happens to every place the product
 * holds something of hers, and why. This does it, in one transaction, and
 * `verify-erasure` afterwards searches the whole database for her name and
 * finds nothing.
 *
 * Two things are deliberately not automatic.
 *
 *   The export is offered first and separately. Somebody asking to be
 *   forgotten should be able to take their record with them, and a product
 *   that erases and then offers an export is offering nothing.
 *
 *   Erasure is not reversible and does not pretend to be. There is no undo,
 *   no soft delete and no thirty-day grace: a request to be forgotten that
 *   leaves the data sitting behind a flag has not been honoured.
 */

/* ---------------------------------------------------------------------------
   Everything held
   --------------------------------------------------------------------------- */

/**
 * NFR-502, answered immediately rather than within thirty days.
 *
 * Thirty days is the law's patience. The product holds all of it in one
 * database and can answer while somebody is still on the telephone, and the
 * export is the same shape as the register: one key per kind of holding,
 * including the ones that come back empty, so a reader can see that a kind
 * was looked at rather than left out.
 */
export async function exportCustomer(orgId: string, customerId: string): Promise<Export> {
  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: customerId, orgId },
    include: { org: { select: { name: true } } },
  });

  const addresses = [customer.email, customer.mobile, customer.phone].filter((one): one is string =>
    Boolean(one),
  );

  const [
    jobs,
    invoices,
    payments,
    messages,
    inbound,
    conversations,
    reviews,
    signatures,
    deposits,
  ] = await Promise.all([
    prisma.job.findMany({
      // bounded: one customer's jobs. A workshop's busiest customer is a
      // fleet with hundreds, not millions.
      where: { orgId, customerId },
      select: {
        number: true,
        status: true,
        createdAt: true,
        completedAt: true,
        shortDescription: true,
      },
    }),
    prisma.invoice.findMany({
      // bounded: as above.
      where: { orgId, customerId },
      select: { number: true, status: true, total: true, issuedAt: true, amountPaid: true },
    }),
    prisma.payment.findMany({
      // bounded: as above.
      where: { orgId, customerId },
      select: { amount: true, method: true, receivedAt: true, reference: true },
    }),
    addresses.length > 0
      ? prisma.messageLog.findMany({
          // bounded: the messages sent to this person's own addresses.
          where: { orgId, toAddress: { in: addresses } },
          select: { channel: true, toAddress: true, subject: true, body: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.inboundMessage.findMany({
      // bounded: one customer's replies.
      where: { orgId, customerId },
      select: { fromAddress: true, subject: true, body: true, receivedAt: true },
    }),
    prisma.conversation.findMany({
      // bounded: one customer's threads.
      where: { orgId, customerId },
      select: { subject: true, status: true, createdAt: true },
    }),
    prisma.reviewRequest.findMany({
      // bounded: one per job.
      where: { orgId, customerId },
      select: { rating: true, comment: true, respondedAt: true },
    }),
    prisma.signature.findMany({
      // bounded: one per check-in, check-out or approval.
      where: { orgId, customerId },
      select: { purpose: true, signedByName: true, signedAt: true },
    }),
    prisma.deposit.findMany({
      // bounded: deposits are an unusual event rather than part of every job.
      where: { orgId, customerId },
      select: { amount: true, kind: true, receivedAt: true },
    }),
  ]);

  return {
    about: customer.displayName,
    taken: new Date(),
    workshop: customer.org.name,
    holdings: {
      // The record itself, with the relations stripped: a person asking for
      // their data wants the data, not the shape of the database.
      customer: [
        {
          displayName: customer.displayName,
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.companyName,
          email: customer.email,
          mobile: customer.mobile,
          phone: customer.phone,
          address: [
            customer.addressLine1,
            customer.addressLine2,
            customer.locality,
            customer.region,
            customer.postcode,
            customer.country,
          ].filter(Boolean),
          notes: customer.notes,
          marketing: {
            email: customer.marketingEmailConsent,
            sms: customer.marketingSmsConsent,
          },
          since: customer.createdAt,
        },
      ],
      jobs,
      invoices,
      payments,
      messagesSentToThem: messages,
      messagesTheySent: inbound,
      conversations,
      reviews,
      signatures,
      deposits,
    },
  };
}

/* ---------------------------------------------------------------------------
   Being forgotten
   --------------------------------------------------------------------------- */

export class ErasureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErasureError';
  }
}

/**
 * Does what the register says, and nothing it does not say.
 *
 * In one transaction, so a half-erasure cannot exist. The exception is the
 * passport: an event cannot be changed, so a redacted version is written after
 * it and the original points forward — the same correction path any other
 * mistake takes, which keeps the chain verifying.
 */
export async function eraseCustomer(input: {
  orgId: string;
  customerId: string;
  userId: string;
  /** Why, in the workshop's own words. Kept on the audit record. */
  reason: string;
}): Promise<Erased> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: {
      id: true,
      displayName: true,
      email: true,
      mobile: true,
      phone: true,
      portalUserId: true,
    },
  });

  if (!customer) throw new ErasureError('That customer is not one of yours.');

  if (customer.displayName === FORGOTTEN) {
    throw new ErasureError('That person has already been erased.');
  }

  if (!input.reason.trim()) {
    throw new ErasureError('Say why, so the record shows this was asked for.');
  }

  const addresses = [customer.email, customer.mobile, customer.phone].filter((one): one is string =>
    Boolean(one),
  );

  const counts: Record<string, number> = {};
  const count = (table: string, n: number) => {
    counts[table] = (counts[table] ?? 0) + n;
  };

  // The passport is looked at first and changed not at all. A name inside a
  // hashed chain cannot be taken out: superseding preserves the original,
  // which is the point of superseding, and rewriting the hash would destroy
  // the only thing the chain is for. Since Phase 62 the passport carries no
  // name at all; anything written before that is reported rather than
  // pretended about.
  const unerasable = await nameStillInThePassport(input.orgId, customer.displayName);

  await prisma.$transaction(async (tx) => {
    // Their signature: their hand, not a record about them.
    count(
      'signatures',
      (await tx.signature.deleteMany({ where: { orgId: input.orgId, customerId: customer.id } }))
        .count,
    );

    // Their words, kept only so somebody could reply.
    count(
      'inbound_messages',
      (
        await tx.inboundMessage.deleteMany({
          where: { orgId: input.orgId, customerId: customer.id },
        })
      ).count,
    );

    count(
      'conversations',
      (
        await tx.conversation.updateMany({
          where: { orgId: input.orgId, customerId: customer.id },
          data: { subject: REDACTED },
        })
      ).count,
    );

    // The rating is a figure about the workshop and stays; the comment is a
    // person speaking, and goes with them.
    count(
      'review_requests',
      (
        await tx.reviewRequest.updateMany({
          where: { orgId: input.orgId, customerId: customer.id, comment: { not: null } },
          data: { comment: null },
        })
      ).count,
    );

    if (addresses.length > 0) {
      count(
        'message_logs',
        (
          await tx.messageLog.updateMany({
            where: { orgId: input.orgId, toAddress: { in: addresses } },
            data: { toAddress: REDACTED, subject: REDACTED, body: REDACTED },
          })
        ).count,
      );

      count(
        'handover_invitations',
        (
          await tx.handoverInvitation.updateMany({
            where: {
              OR: [
                { toEmail: { in: addresses } },
                { toPhone: { in: addresses } },
                { toName: customer.displayName },
              ],
            },
            data: { toName: FORGOTTEN, toEmail: null, toPhone: null },
          })
        ).count,
      );
    }

    // How long a car was in one pair of hands is the vehicle's record. Whose
    // hands they were is not, once they have asked.
    count(
      'vehicle_ownerships',
      (
        await tx.vehicleOwnership.updateMany({
          where: customer.portalUserId
            ? { OR: [{ ownerUserId: customer.portalUserId }, { ownerName: customer.displayName }] }
            : { ownerName: customer.displayName },
          data: { ownerName: FORGOTTEN, ownerUserId: null },
        })
      ).count,
    );

    // The record itself: everything identifying emptied, the row kept, because
    // seven years of invoices point at it.
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        displayName: FORGOTTEN,
        firstName: null,
        lastName: null,
        companyName: null,
        taxNumber: null,
        email: null,
        mobile: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        locality: null,
        region: null,
        postcode: null,
        notes: null,
        sourceOfBusiness: null,
        marketingEmailConsent: false,
        marketingSmsConsent: false,
        portalUserId: null,
        isActive: false,
      },
    });
    count('customers', 1);

    // An anonymised login is still a login.
    if (customer.portalUserId) {
      await tx.session.deleteMany({ where: { userId: customer.portalUserId } });
      await tx.user.delete({ where: { id: customer.portalUserId } });
      count('users', 1);
    }
  });

  // The audit log, last, and by its own single permitted route. It refuses
  // every other change by design, which is most of why it is worth having.
  count('audit_logs', await redactAudit(input.orgId, customer.id, customer.portalUserId));

  // And a record that this happened, which is itself an audit entry: erasure
  // is a thing a workshop did, and the account of it names no one but the
  // person who did it.
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'customer.erased',
    entityType: 'Customer',
    entityId: customer.id,
    after: { reason: input.reason.trim(), unerasable: unerasable.length, counts },
  });

  return { counts, unerasable };
}

/**
 * Any passport event still carrying the name — which cannot be removed.
 *
 * This is the hardest thing in the phase and the answer is uncomfortable, so
 * it is written down rather than worked around. The chain is append-only and
 * hashed. Superseding an event *preserves* the original, which is the entire
 * point of superseding, so it erases nothing. Rewriting the event and
 * recomputing the hash would remove the name and destroy the only property
 * that makes the chain worth having.
 *
 * So the resolution is upstream: since Phase 62 the passport carries no name
 * at all. It records that a car changed hands and how many keepers it has had
 * — the vehicle's record — while who they were lives in the ownership rows,
 * which are anonymised above.
 *
 * Events written before that change still carry names. They are found here and
 * returned, so the workshop is told exactly what could not be erased instead
 * of being told everything was.
 */
async function nameStillInThePassport(orgId: string, name: string): Promise<Erased['unerasable']> {
  const carrying = await prisma.vehicleEvent.findMany({
    // bounded: events recorded by this workshop that mention one name. A
    // person's name appears in a handful of events, not in a table's worth.
    where: {
      recordedByOrgId: orgId,
      OR: [{ title: { contains: name } }, { summary: { contains: name } }],
    },
    select: { id: true, title: true, summary: true },
  });

  return carrying.map((event) => ({
    eventId: event.id,
    where: event.title.includes(name) ? 'the title' : 'the summary',
  }));
}

/**
 * The copy of the values the audit log happens to keep.
 *
 * Raw SQL rather than Prisma, because this is the one permitted mutation on a
 * table that refuses every other, and writing it here in the shape the trigger
 * allows makes the pairing visible: `before` and `after` to NULL, nothing
 * else touched, and the trigger enforcing that rather than trusting it.
 */
async function redactAudit(
  orgId: string,
  customerId: string,
  portalUserId: string | null,
): Promise<number> {
  const redacted = await prisma.$executeRaw`
    UPDATE "audit_logs"
       SET "before" = NULL, "after" = NULL
     WHERE "orgId" = ${orgId}
       AND ("before" IS NOT NULL OR "after" IS NOT NULL)
       AND ( ("entityType" = 'Customer' AND "entityId" = ${customerId})
          OR ${portalUserId}::text IS NOT NULL
             AND "entityType" = 'User' AND "entityId" = ${portalUserId} )
  `;

  return redacted;
}

/** Whether somebody has already been forgotten, for a page that must not offer it twice. */
export function isErased(customer: { displayName: string }): boolean {
  return customer.displayName === FORGOTTEN;
}

/** The register, for the page that has to say what will happen before it happens. */
export function whatErasureDoes() {
  return ERASURE.map((one) => ({ ...one, known: treatmentOf(one.table) !== null }));
}
