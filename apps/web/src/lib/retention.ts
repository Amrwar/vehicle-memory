import { createHash, randomBytes } from 'node:crypto';

import {
  assertCreditable,
  assertRedeemable,
  type Askable,
  balanceOf,
  type Candidate,
  type InboundConfidence,
  LoyaltyError,
  looksLikeCode,
  matchInbound,
  pointsExpiringWithin,
  pointsFor,
  priorityOf,
  quotedJobNumber,
  type Rated,
  referralCode,
  routeRating,
  satisfactionOf,
  shouldAsk,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { isAlreadyDone } from './repeat';

/**
 * Asking how it went, points, referrals, and replies coming back.
 *
 * Four things that share one idea: what happens to a customer after the car
 * leaves. The product has been able to send since Phase 5 and has never been
 * able to hear, and has never asked anybody anything.
 *
 * The rules are all in `@carnet/core` and pure. This is the part that reads
 * the rows those rules are applied to, which is where this kind of feature
 * actually goes wrong: asking the wrong person, asking twice, or filing a
 * reply against the wrong car.
 */

export { LoyaltyError };

const DAY = 86_400_000;

/** How long a review link lives. Long enough to answer, short enough to end. */
const REVIEW_WINDOW_DAYS = 30;

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* ------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Jobs finished recently, and whether each should be asked about.
 *
 * Every refusal comes back with it. The screen listing who was not asked is
 * the screen that explains a low review count, and a workshop that cannot see
 * the reasons concludes the feature is broken.
 */
export async function askable(orgId: string, now = new Date()) {
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      completedAt: { gte: new Date(now.getTime() - 30 * DAY) },
    },
    orderBy: { completedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      shortDescription: true,
      completedAt: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          displayName: true,
          email: true,
          mobile: true,
          marketingEmailConsent: true,
          marketingSmsConsent: true,
        },
      },
      reviewRequest: { select: { id: true } },
      vehicle: { select: { make: true, model: true, registration: true } },
      // An unsettled warranty claim is somebody waiting to hear back.
      warranties: { select: { claims: { where: { status: 'OPEN' }, select: { id: true } } } },
    },
  });

  const lastAsked = await prisma.reviewRequest.groupBy({
    by: ['customerId'],
    where: { orgId, customerId: { in: jobs.map((job) => job.customerId) } },
    _max: { sentAt: true },
  });

  const asked = new Map(lastAsked.map((row) => [row.customerId, row._max.sentAt]));

  return jobs.map((job) => {
    const candidate: Askable = {
      jobId: job.id,
      customerId: job.customerId,
      completedAt: job.completedAt,
      status: job.status,
      alreadyAsked: Boolean(job.reviewRequest),
      lastAskedAt: asked.get(job.customerId) ?? null,
      hasEmail: Boolean(job.customer.email),
      hasMobile: Boolean(job.customer.mobile),
      marketingConsent: job.customer.marketingEmailConsent || job.customer.marketingSmsConsent,
      complaintOpen: job.warranties.some((warranty) => warranty.claims.length > 0),
    };

    return { job, decision: shouldAsk(candidate, now) };
  });
}

/**
 * Asks one customer how a job went.
 *
 * The token is random and only its digest is stored, the same shape every
 * capability in this product uses. A link that leaks cannot be read back out
 * of the database, and revoking it is one row.
 *
 * @repeat GUARDED(CONSTRAINT: review_requests_jobId_key) A job is asked
 * about once. Asking again is refused by the database rather than sending
 * the customer a second request about the same visit.
 */
export async function askAbout(input: {
  orgId: string;
  userId: string;
  jobId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      customerId: true,
      customer: {
        select: { displayName: true, email: true, mobile: true, marketingEmailConsent: true },
      },
      vehicle: { select: { make: true, model: true } },
    },
  });

  const token = randomBytes(18).toString('base64url');

  const request = await prisma.reviewRequest.create({
    data: {
      orgId: input.orgId,
      jobId: job.id,
      customerId: job.customerId,
      tokenHash: digest(token),
      channel: job.customer.marketingEmailConsent && job.customer.email ? 'EMAIL' : 'SMS',
      expiresAt: new Date(now.getTime() + REVIEW_WINDOW_DAYS * DAY),
    },
    select: { id: true, channel: true },
  });

  const to = request.channel === 'EMAIL' ? job.customer.email : job.customer.mobile;

  if (to) {
    // Queued rather than sent here. The sending layer decides quiet hours,
    // retries and which transport; a second path around it would be a second
    // set of rules about when a customer may be disturbed.
    await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: request.channel === 'EMAIL' ? 'EMAIL' : 'SMS',
        toAddress: to,
        subject: `How did we do with your ${job.vehicle.make ?? 'vehicle'}?`,
        body: `Hello ${job.customer.displayName}. Your ${[job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ')} was with us recently, job ${job.number}. It would help us to know how it went: /r/${token}`,
        status: 'QUEUED',
        relatedType: 'ReviewRequest',
        relatedId: request.id,
      },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'review.asked',
    entityType: 'Job',
    entityId: job.id,
    after: { channel: request.channel, reachable: Boolean(to) },
  });

  return { id: request.id, token, reachable: Boolean(to) };
}

/** The request behind a link, or nothing. */
export async function reviewByToken(token: string, now = new Date()) {
  const request = await prisma.reviewRequest.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      orgId: true,
      rating: true,
      routing: true,
      expiresAt: true,
      org: { select: { name: true } },
      job: {
        select: {
          number: true,
          shortDescription: true,
          vehicle: { select: { make: true, model: true } },
        },
      },
    },
  });

  if (!request || request.expiresAt < now) return null;

  return request;
}

/**
 * Records what a customer said, and routes it.
 *
 * The routing is the feature. A five is invited to say so publicly; anything
 * lower opens a conversation with somebody who can put it right, which is
 * worth more to the workshop than the review would have been.
 *
 * @repeat GUARDED(STATE: the request already carries a rating) Answering
 * twice returns that it was already answered and leaves the first answer
 * alone, which is the one the customer meant.
 */
export async function recordRating(input: {
  token: string;
  rating: number;
  comment?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const request = await prisma.reviewRequest.findUnique({
    where: { tokenHash: digest(input.token) },
    select: { id: true, orgId: true, rating: true, expiresAt: true },
  });

  if (!request || request.expiresAt < now) return null;

  // Answering twice keeps the first answer. A link forwarded to somebody else
  // must not overwrite what the customer actually said.
  if (request.rating !== null) return { alreadyAnswered: true, routing: null };

  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const routed = routeRating(rating, input.comment);

  await prisma.reviewRequest.update({
    where: { id: request.id },
    data: {
      rating,
      comment: input.comment?.trim() || null,
      respondedAt: now,
      routing: routed.routing,
    },
  });

  await audit({
    orgId: request.orgId,
    action: 'review.answered',
    entityType: 'ReviewRequest',
    entityId: request.id,
    after: { rating, routing: routed.routing },
  });

  return { alreadyAnswered: false, routing: routed };
}

/** Closes a conversation that a poor rating opened. *
 * @repeat HARMLESS(OVERWRITE: the note and the moment it was resolved)
 * Resolving a resolved review writes the same words again and changes
 * nothing anybody reads.
 */
export async function resolveReview(input: {
  orgId: string;
  userId: string;
  reviewId: string;
  note: string;
}) {
  const note = input.note.trim();

  if (!note) {
    throw new Error('Say what happened. "Resolved" with nothing against it means nothing later.');
  }

  await prisma.reviewRequest.update({
    where: { id: input.reviewId, orgId: input.orgId },
    data: { resolvedAt: new Date(), resolvedByUserId: input.userId, resolutionNote: note },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'review.resolved',
    entityType: 'ReviewRequest',
    entityId: input.reviewId,
    after: { note },
  });
}

/** The satisfaction picture, honest about how little it may rest on. */
export async function reputation(orgId: string, now = new Date()) {
  const [rows, sent] = await Promise.all([
    prisma.reviewRequest.findMany({
      where: { orgId, rating: { not: null } },
      orderBy: { respondedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        rating: true,
        comment: true,
        respondedAt: true,
        routing: true,
        publicOpenedAt: true,
        resolvedAt: true,
        resolutionNote: true,
        customer: { select: { id: true, displayName: true } },
        job: { select: { id: true, number: true, shortDescription: true } },
      },
    }),
    prisma.reviewRequest.count({ where: { orgId } }),
  ]);

  // Who was invited to say so publicly, and who went. Phase 43.
  const invited = rows.filter((row) => row.routing === 'PUBLIC_INVITE').length;
  const wentPublic = rows.filter((row) => row.publicOpenedAt !== null).length;

  const rated: Rated[] = rows.map((row) => ({
    rating: row.rating!,
    respondedAt: row.respondedAt!,
    routing: row.routing as Rated['routing'],
    resolvedAt: row.resolvedAt,
  }));

  return {
    ...satisfactionOf(rated, sent, now),
    invited,
    wentPublic,
    rows,
    waiting: rows.filter((row) => row.routing === 'PRIVATE_CONVERSATION' && !row.resolvedAt),
  };
}

/* ------------------------------------------------------------------------- */
/* Loyalty and referrals                                                      */
/* ------------------------------------------------------------------------- */

/** How long an award lasts before it lapses. */
const POINTS_LAST_DAYS = 730;

export async function loyaltyFor(orgId: string, customerId: string, now = new Date()) {
  const entries = await prisma.loyaltyEntry.findMany({
    where: { orgId, customerId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      points: true,
      reason: true,
      expiresAt: true,
      createdAt: true,
      job: { select: { id: true, number: true } },
    },
  });

  return {
    entries,
    balance: balanceOf(entries, now),
    expiring: pointsExpiringWithin(entries, 60, now),
  };
}

/** Awards points for a spend. *
 * @repeat GUARDED(CONSTRAINT: loyalty_entries_once_key) An award that says
 * what it is the one-and-only of lands once however many times it is asked
 * for. Points granted by hand carry no key, because a second grant is a
 * second decision.
 */
export async function awardPoints(input: {
  orgId: string;
  userId: string;
  customerId: string;
  amountMinor: number;
  jobId?: string | null;
  reason?: string;
  /**
   * What this award is the one-and-only of, where there is such a thing.
   * With it, a repeat lands on the unique index and is absorbed; without it,
   * a repeat is a second award, which is correct for points somebody is
   * granting by hand. Phase 46.
   */
  once?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const points = pointsFor(input.amountMinor);

  // Nothing earned is no row. An entry of zero changes nothing and still
  // appears in somebody's history as though it did; the database refuses it.
  if (points === 0) return 0;

  try {
    await prisma.loyaltyEntry.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        points,
        reason: input.reason ?? 'Work done',
        once: input.once ?? null,
        jobId: input.jobId ?? null,
        expiresAt: new Date(now.getTime() + POINTS_LAST_DAYS * DAY),
        createdByUserId: input.userId,
      },
    });
  } catch (error) {
    // The same award arriving twice — two workers, a retried request, a
    // customer pressing pay again — lands on the index and is nothing at all.
    // Told apart from a real failure by the code, because swallowing every
    // error here would hide the ones worth knowing about.
    if (isAlreadyDone(error)) return 0;
    throw error;
  }

  return points;
}

/** Spends points against a bill. *
 * @repeat GUARDED(KEY: the form key its callers hand to once) Spending the
 * same points twice is stopped by the key; past that the balance refuses,
 * but only once the first spend has already gone through.
 */
export async function redeemPoints(input: {
  orgId: string;
  userId: string;
  customerId: string;
  points: number;
  owedMinor: number;
  jobId?: string | null;
  now?: Date;
}) {
  const held = await loyaltyFor(input.orgId, input.customerId, input.now);

  const value = assertRedeemable({
    balance: held.balance,
    points: input.points,
    owedMinor: input.owedMinor,
  });

  await prisma.loyaltyEntry.create({
    data: {
      orgId: input.orgId,
      customerId: input.customerId,
      points: -input.points,
      reason: `Redeemed against ${(value / 100).toFixed(2)}`,
      jobId: input.jobId ?? null,
      createdByUserId: input.userId,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'loyalty.redeemed',
    entityType: 'Customer',
    entityId: input.customerId,
    after: { points: input.points, valueMinor: value },
  });

  return value;
}

/** A code for a customer to hand out, made once and kept. *
 * @repeat GUARDED(CONSTRAINT: referrals_one_per_customer) A customer has one
 * code per workshop. Two pages asking at once no longer end with two codes,
 * of which the one they hand out is the wrong one half the time.
 */
export async function referralFor(orgId: string, customerId: string, userId: string) {
  const existing = await prisma.referral.findFirst({
    where: { orgId, referrerCustomerId: customerId, referredCustomerId: null },
    select: { id: true, code: true },
  });

  if (existing) return existing;

  // Retried on collision rather than assumed unique. Six characters from a
  // restricted alphabet is a small space, and a workshop with a thousand
  // customers will meet a clash.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = referralCode();

    const taken = await prisma.referral.findFirst({ where: { orgId, code }, select: { id: true } });
    if (taken) continue;

    const created = await prisma.referral.create({
      data: { orgId, referrerCustomerId: customerId, code },
      select: { id: true, code: true },
    });

    await audit({
      orgId,
      actorUserId: userId,
      action: 'referral.issued',
      entityType: 'Customer',
      entityId: customerId,
      after: { code },
    });

    return created;
  }

  throw new Error('Could not find an unused code. Try again.');
}

/** Somebody arrived with a code. *
 * @repeat GUARDED(STATE: the code already names who it brought in) A code
 * used twice is refused with the sentence saying so, rather than paying out
 * on the same introduction again.
 */
export async function useReferral(input: {
  orgId: string;
  userId: string;
  code: string;
  customerId: string;
  jobId?: string | null;
}) {
  if (!looksLikeCode(input.code)) {
    throw new LoyaltyError('NOT_SPENT', 'That is not one of our codes.');
  }

  const cleaned = input.code.trim().toUpperCase().replace(/[\s-]/g, '');

  const referral = await prisma.referral.findFirst({
    where: { orgId: input.orgId, code: cleaned },
    select: { id: true, referrerCustomerId: true, referredCustomerId: true },
  });

  if (!referral) throw new LoyaltyError('NOT_SPENT', 'Nobody has that code.');

  if (referral.referredCustomerId) {
    throw new LoyaltyError('ALREADY_CREDITED', 'That code has already been used.');
  }

  if (referral.referrerCustomerId === input.customerId) {
    throw new LoyaltyError(
      'SELF_REFERRAL',
      'That is their own code. A referral pays for bringing somebody new.',
    );
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      referredCustomerId: input.customerId,
      referredJobId: input.jobId ?? null,
      usedAt: new Date(),
    },
  });

  return referral.id;
}

/** What a referral pays each side. */
export const REFERRAL_POINTS = 500;

/** Pays a referral, once the referred customer has actually spent something. *
 * @repeat GUARDED(KEY: the referral claimed while still uncredited) Two
 * bills paid a millisecond apart both pass the check above; the claim
 * decides between them, and the loser credits nobody.
 */
export async function creditReferral(input: { orgId: string; userId: string; referralId: string }) {
  const referral = await prisma.referral.findFirstOrThrow({
    where: { id: input.referralId, orgId: input.orgId },
    select: { id: true, referrerCustomerId: true, referredCustomerId: true, creditedAt: true },
  });

  const spend = referral.referredCustomerId
    ? await prisma.invoice.aggregate({
        where: {
          orgId: input.orgId,
          customerId: referral.referredCustomerId,
          status: { in: ['ISSUED', 'PART_PAID', 'PAID'] },
        },
        _sum: { total: true },
      })
    : { _sum: { total: null } };

  assertCreditable({
    referrerCustomerId: referral.referrerCustomerId,
    referredCustomerId: referral.referredCustomerId,
    creditedAt: referral.creditedAt,
    referredSpendMinor: Math.round(Number(spend._sum.total ?? 0) * 100),
  });

  // Both sides in one transaction. Crediting one and failing on the other
  // leaves a customer owed points nobody can see they are owed.
  //
  // The referral is claimed first, and only if it was still uncredited at
  // that moment. Two bills paid a millisecond apart, or a request retried
  // while the first is still running, both passed the check above; the claim
  // is what decides between them, and the loser credits nobody. Each entry
  // also carries the key it is the one-and-only of, so even a claim that
  // somehow ran twice cannot put the points in twice. Phase 46.
  const credited = await prisma.$transaction(async (tx) => {
    const claim = await tx.referral.updateMany({
      where: { id: referral.id, creditedAt: null },
      data: { creditedAt: new Date(), points: REFERRAL_POINTS },
    });

    if (claim.count === 0) return false;

    await tx.loyaltyEntry.create({
      data: {
        orgId: input.orgId,
        customerId: referral.referrerCustomerId,
        points: REFERRAL_POINTS,
        reason: 'Referral, for introducing somebody',
        once: `referral:${referral.id}:referrer`,
        createdByUserId: input.userId,
      },
    });

    await tx.loyaltyEntry.create({
      data: {
        orgId: input.orgId,
        customerId: referral.referredCustomerId!,
        points: REFERRAL_POINTS,
        reason: 'Referral, for being introduced',
        once: `referral:${referral.id}:referred`,
        createdByUserId: input.userId,
      },
    });

    return true;
  });

  if (!credited) {
    throw new LoyaltyError('ALREADY_CREDITED', 'That referral has already been paid.');
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'referral.credited',
    entityType: 'Customer',
    entityId: referral.referrerCustomerId,
    after: { points: REFERRAL_POINTS, bothSides: true },
  });
}

/* ------------------------------------------------------------------------- */
/* The inbox                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Takes something a customer sent in, and works out what it is about.
 *
 * Matched with a stated confidence rather than assigned silently. A reply
 * filed against the wrong job is worse than one filed against nothing: a
 * person reads it in the context of another car.
 *
 * @repeat GUARDED(CONSTRAINT: inbound_messages_orgId_providerRef_key) A
 * webhook retried by the provider is one message rather than a customer
 * appearing to write in twice.
 */
export async function receiveInbound(input: {
  orgId: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
  fromAddress: string;
  subject?: string | null;
  body: string;
  providerRef?: string | null;
  receivedAt?: Date;
}) {
  const from = input.fromAddress.trim();
  const body = input.body.trim();

  if (!from || !body) return null;

  // The provider's own id, so the same message delivered twice is one row.
  // Every webhook retries, and a duplicate reply reads as a customer
  // repeating themselves.
  //
  // Looked for first because that is the cheap path and the usual one; the
  // unique index below is what actually decides it when two deliveries of the
  // same message arrive together and both look and both find nothing.
  if (input.providerRef) {
    const seen = await prisma.inboundMessage.findFirst({
      where: { orgId: input.orgId, providerRef: input.providerRef },
      select: { id: true },
    });

    if (seen) return seen;
  }

  const customers = await prisma.customer.findMany({
    where: {
      orgId: input.orgId,
      OR: [{ email: from }, { mobile: from }, { phone: from }],
    },
    take: 10,
    select: {
      id: true,
      displayName: true,
      jobs: {
        where: {
          status: {
            in: [
              'RECEIVED',
              'INSPECTING',
              'DIAGNOSED',
              'ESTIMATED',
              'AWAITING_APPROVAL',
              'IN_PROGRESS',
              'QUALITY_CHECK',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, number: true, shortDescription: true },
      },
    },
  });

  const quotedNumber = quotedJobNumber(body);

  const quotedJob = quotedNumber
    ? await prisma.job.findFirst({
        where: { orgId: input.orgId, number: quotedNumber },
        select: { id: true, number: true, customerId: true },
      })
    : null;

  const candidates: Candidate[] = customers.map((customer) => ({
    customerId: customer.id,
    customerName: customer.displayName,
    openJobs: customer.jobs,
    lastMessagedJobId: null,
  }));

  const match = matchInbound({ body, candidates, quotedJob });

  let row: { id: string };
  try {
    row = await prisma.inboundMessage.create({
      data: {
        orgId: input.orgId,
        channel: input.channel,
        fromAddress: from,
        subject: input.subject?.trim() || null,
        body,
        providerRef: input.providerRef ?? null,
        receivedAt: input.receivedAt ?? new Date(),
        customerId: match.customerId,
        // The database refuses a job with no customer beside it, so a certain
        // match on a job carries its customer or neither is written.
        jobId: match.customerId ? match.jobId : null,
        confidence: match.confidence,
        matchNote: match.why,
      },
      select: { id: true },
    });
  } catch (error) {
    // The other delivery of the same message got here first. That is the
    // guard working, so the answer is the row it wrote rather than an error
    // the provider will read as a failure and retry again. Phase 46.
    if (!isAlreadyDone(error, 'providerRef') || !input.providerRef) throw error;

    return prisma.inboundMessage.findFirstOrThrow({
      where: { orgId: input.orgId, providerRef: input.providerRef },
      select: { id: true },
    });
  }

  // Onto its thread, the job's or the customer's, and the thread is unread
  // from this moment. A message nobody could match stays in the inbox for
  // a person to file. Phase 36.
  const { fileInbound } = await import('./conversations');
  const conversationId = await fileInbound(row.id);

  // Somebody wrote in; whoever answers customers is told. Phase 39.
  const { notifyStaff } = await import('./search');
  const sender = match.customerId
    ? (
        await prisma.customer.findUnique({
          where: { id: match.customerId },
          select: { displayName: true },
        })
      )?.displayName
    : null;
  await notifyStaff({
    orgId: input.orgId,
    kind: 'MESSAGE_RECEIVED',
    title: `${sender ?? from} wrote in`,
    body: body.slice(0, 140),
    href: conversationId ? `/inbox?c=${conversationId}` : '/inbox',
    entityType: 'InboundMessage',
    entityId: row.id,
  });

  return row;
}

/** The inbox, ordered by what has to be dealt with rather than by arrival. */
export async function inbox(orgId: string, includeHandled = false) {
  const rows = await prisma.inboundMessage.findMany({
    where: { orgId, ...(includeHandled ? {} : { handledAt: null }) },
    orderBy: { receivedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      channel: true,
      fromAddress: true,
      subject: true,
      body: true,
      receivedAt: true,
      confidence: true,
      matchNote: true,
      handledAt: true,
      customer: { select: { id: true, displayName: true } },
      job: { select: { id: true, number: true, shortDescription: true } },
    },
  });

  return rows
    .map((row) => ({
      ...row,
      priority: priorityOf({
        body: row.body,
        confidence: row.confidence as InboundConfidence,
        receivedAt: row.receivedAt,
      }),
    }))
    .sort(
      (a, b) =>
        a.priority.rank - b.priority.rank || b.receivedAt.getTime() - a.receivedAt.getTime(),
    );
}

/** Files a message against a job, or marks it dealt with. *
 * @repeat HARMLESS(OVERWRITE: where the message is filed and who dealt with
 * it) Filing it against the same job twice leaves it filed against that job.
 */
export async function handleInbound(input: {
  orgId: string;
  userId: string;
  messageId: string;
  jobId?: string | null;
  done?: boolean;
}) {
  const job = input.jobId
    ? await prisma.job.findFirst({
        where: { id: input.jobId, orgId: input.orgId },
        select: { id: true, customerId: true },
      })
    : null;

  await prisma.inboundMessage.update({
    where: { id: input.messageId, orgId: input.orgId },
    data: {
      ...(job ? { jobId: job.id, customerId: job.customerId, confidence: 'CERTAIN' } : {}),
      ...(input.done ? { handledAt: new Date(), handledByUserId: input.userId } : {}),
      // Filed by hand onto a job: it moves to that job's thread. Phase 36.
      ...(job ? { conversationId: null } : {}),
    },
  });

  if (job) {
    const { fileInbound } = await import('./conversations');
    await fileInbound(input.messageId);
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.done ? 'inbox.handled' : 'inbox.filed',
    entityType: 'InboundMessage',
    entityId: input.messageId,
    after: { jobId: job?.id ?? null },
  });
}

/** A bill paid in full earns a point a pound, once. */
export async function awardForInvoice(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
}): Promise<number> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: input.orgId, status: 'PAID' },
    select: { id: true, number: true, total: true, customerId: true, jobId: true },
  });
  if (!invoice) return 0;

  const reason = `Invoice ${invoice.number} paid`;

  // Once. A second payment on the same invoice, a refund and repayment, a
  // retried request or two workers reaching here together all end at the same
  // key, and the database decides which of them is the one. Looking first and
  // then writing — which is what this did until Phase 46 — leaves room
  // between the two for the other request to look as well, and then both see
  // nothing and both award.
  const once = `invoice:${invoice.id}:paid`;

  // Points on money the customer actually paid: the total less what the
  // programme itself paid, so redeeming points does not earn points.
  const redeemed = await prisma.payment.aggregate({
    where: { invoiceId: invoice.id, method: 'LOYALTY' },
    _sum: { amount: true },
  });
  const paidMinor = Math.round((Number(invoice.total) - Number(redeemed._sum.amount ?? 0)) * 100);

  const points = await awardPoints({
    orgId: input.orgId,
    userId: input.userId,
    customerId: invoice.customerId,
    amountMinor: paidMinor,
    jobId: invoice.jobId,
    reason,
    once,
  });

  if (points > 0) {
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'loyalty.awarded',
      entityType: 'Customer',
      entityId: invoice.customerId,
      after: { points, invoice: invoice.number },
    });
  }

  return points;
}
