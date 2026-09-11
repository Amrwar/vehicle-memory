/**
 * Asking how it went, and what to do with the answer.
 *
 * The routing is the whole feature and it is the thing businesses get
 * backwards. Asking everybody for a public review collects the one-star ones
 * you could have fixed; asking nobody collects nothing. The useful shape is a
 * private question first, and only somebody already pleased is invited to say
 * so in public.
 *
 * That is not a trick. The person who had a bad experience gets a real
 * conversation with somebody who can put it right, which is what they wanted
 * and is worth more to the workshop than the review would have been. Nothing
 * here suppresses a review: a customer who wants to post one can, and the
 * page says so.
 *
 * The second half is knowing when not to ask. A request sent to somebody
 * already complaining, or sent twice, or sent about a job that went wrong, is
 * worse than no request at all.
 */

export type Routing = 'PUBLIC_INVITE' | 'PRIVATE_CONVERSATION' | 'THANKS_ONLY';

export interface RoutingResult {
  routing: Routing;
  /** What the customer sees next. */
  message: string;
  /** Whether somebody at the workshop has to do something. */
  needsAttention: boolean;
}

/**
 * Where a rating goes.
 *
 * Five is a public invitation; four is a thank-you without one, because four
 * out of five means something was not quite right and an invitation reads as
 * though nobody noticed. Three and below opens a conversation.
 */
export function routeRating(rating: number, comment?: string | null): RoutingResult {
  const rounded = Math.round(rating);

  if (rounded >= 5) {
    return {
      routing: 'PUBLIC_INVITE',
      message:
        'Thank you. If you have a moment, saying so publicly helps other people find a workshop they can trust.',
      needsAttention: false,
    };
  }

  if (rounded === 4) {
    // A four is not a complaint and it is not a five. Inviting a public review
    // here reads as though nobody noticed the missing star; asking what it
    // would have taken is the question worth having the answer to.
    return {
      routing: 'THANKS_ONLY',
      message:
        'Thank you. If there was something that would have made it a five, we would genuinely like to know.',
      needsAttention: Boolean(comment?.trim()),
    };
  }

  return {
    routing: 'PRIVATE_CONVERSATION',
    message:
      'Thank you for saying so. Somebody here will read this today and get in touch. We would rather put it right than leave it.',
    needsAttention: true,
  };
}

export type SkipReason =
  | 'ALREADY_ASKED'
  | 'TOO_SOON'
  | 'RECENTLY_ASKED'
  | 'NO_CONSENT'
  | 'NOT_FINISHED'
  | 'UNREACHABLE'
  | 'COMPLAINT_OPEN';

export interface Askable {
  jobId: string;
  customerId: string;
  completedAt: Date | null;
  status: string;
  /** Whether this job already has a request against it. */
  alreadyAsked: boolean;
  /** When this customer was last asked about anything. */
  lastAskedAt: Date | null;
  hasEmail: boolean;
  hasMobile: boolean;
  marketingConsent: boolean;
  /** An unresolved complaint or an open warranty claim on this job. */
  complaintOpen: boolean;
}

/**
 * How long after a job to ask.
 *
 * Long enough that the customer has driven the car, short enough that they
 * remember. Asking as the invoice prints measures the reception desk rather
 * than the repair.
 */
export const ASK_AFTER_HOURS = 24;

/** How long to leave somebody alone between requests. */
export const QUIET_DAYS = 90;

export interface AskDecision {
  ask: boolean;
  reason?: SkipReason;
  /** Why not, in a sentence, for the screen that lists what was skipped. */
  why?: string;
}

/**
 * Whether to ask this customer about this job.
 *
 * Every refusal is named rather than silently dropped, because the screen that
 * shows a workshop who was not asked is the screen that tells them why their
 * review count is low.
 */
export function shouldAsk(job: Askable, now = new Date()): AskDecision {
  if (!['COMPLETED', 'INVOICED', 'PAID'].includes(job.status)) {
    return { ask: false, reason: 'NOT_FINISHED', why: 'The work is not finished.' };
  }

  if (job.alreadyAsked) {
    return { ask: false, reason: 'ALREADY_ASKED', why: 'This job has already been asked about.' };
  }

  if (job.complaintOpen) {
    return {
      ask: false,
      reason: 'COMPLAINT_OPEN',
      why: 'Something is unresolved on this job. Asking how it went while they are waiting to hear back reads as though nobody is listening.',
    };
  }

  if (!job.hasEmail && !job.hasMobile) {
    return { ask: false, reason: 'UNREACHABLE', why: 'No email address and no mobile number.' };
  }

  if (!job.marketingConsent) {
    return {
      ask: false,
      reason: 'NO_CONSENT',
      why: 'They have not agreed to be contacted for anything but the work itself.',
    };
  }

  const finished = job.completedAt;

  if (!finished) {
    return { ask: false, reason: 'NOT_FINISHED', why: 'No completion time on the job.' };
  }

  if (now.getTime() - finished.getTime() < ASK_AFTER_HOURS * 3_600_000) {
    return {
      ask: false,
      reason: 'TOO_SOON',
      why: `Finished less than ${ASK_AFTER_HOURS} hours ago. Asking before they have driven it measures the reception desk, not the repair.`,
    };
  }

  if (job.lastAskedAt && now.getTime() - job.lastAskedAt.getTime() < QUIET_DAYS * 86_400_000) {
    return {
      ask: false,
      reason: 'RECENTLY_ASKED',
      why: `Asked within the last ${QUIET_DAYS} days. A customer who comes in monthly should not be asked monthly.`,
    };
  }

  return { ask: true };
}

export interface Rated {
  rating: number;
  respondedAt: Date;
  routing: Routing;
  resolvedAt: Date | null;
}

export interface Satisfaction {
  /** Mean rating, or null when too few people have answered to mean anything. */
  average: number | null;
  responses: number;
  sent: number;
  /** Responses over requests. */
  responseRate: number | null;
  /** Ratings of three or below that nobody has closed off. */
  openConversations: number;
  /** Ratings of five, which are the ones invited to post publicly. */
  promoters: number;
  summary: string;
}

/**
 * How few answers it takes before an average is worth printing.
 *
 * Five. Below that one unhappy customer moves the figure by a star and a half,
 * and a number that swings like that on a page reads as a measurement rather
 * than as the anecdote it actually is.
 */
export const MIN_RESPONSES = 5;

export function satisfactionOf(
  ratings: readonly Rated[],
  sent: number,
  now = new Date(),
): Satisfaction {
  const responses = ratings.length;

  const average =
    responses >= MIN_RESPONSES
      ? Math.round((ratings.reduce((total, entry) => total + entry.rating, 0) / responses) * 10) /
        10
      : null;

  const openConversations = ratings.filter(
    (entry) => entry.routing === 'PRIVATE_CONVERSATION' && entry.resolvedAt === null,
  ).length;

  const promoters = ratings.filter((entry) => entry.rating >= 5).length;

  const month = ratings.filter(
    (entry) => now.getTime() - entry.respondedAt.getTime() < 30 * 86_400_000,
  ).length;

  return {
    average,
    responses,
    sent,
    responseRate: sent === 0 ? null : Math.round((responses / sent) * 100) / 100,
    openConversations,
    promoters,
    summary:
      responses === 0
        ? sent === 0
          ? 'Nobody has been asked yet.'
          : `${sent} asked, nobody has answered.`
        : average === null
          ? `${responses} ${responses === 1 ? 'answer' : 'answers'} so far. Too few to average: one unhappy customer would move it by a star and a half.`
          : `${average} out of 5 from ${responses} answers, ${month} this month.${
              openConversations > 0 ? ` ${openConversations} waiting to be put right.` : ''
            }`,
  };
}
