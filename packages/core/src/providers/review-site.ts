/**
 * Where a pleased customer says so in public. Phase 43.
 *
 * A review site is a seam: given the workshop's listing, it answers with the
 * address where a customer writes a review. Google is the one a workshop is
 * found on, so it is the one built.
 *
 * No site lets a business post a review for its customer, and none should:
 * a review is the customer's words, under their own name. What the product
 * does is take somebody who has just said five out of five straight to the
 * box where they can say it again, and count who went.
 */

export interface ReviewListing {
  googlePlaceId: string | null;
}

export interface ReviewSite {
  readonly name: string;
  /** The page where the customer writes the review, or null when not set up. */
  writeReviewUrl(listing: ReviewListing): string | null;
}

export class ReviewSiteError extends Error {
  constructor(
    readonly code: 'BAD_PLACE_ID',
    message: string,
  ) {
    super(message);
    this.name = 'ReviewSiteError';
  }
}

const PLACE_ID = /^[A-Za-z0-9_-]{16,255}$/;

/**
 * A Google place ID from what the workshop pasted.
 *
 * Either the ID itself or any Google address that carries one as `placeid`
 * or `place_id`, since that is what the place ID finder and a write-review
 * link both hand people. Blank clears it. Anything else is refused, because
 * a wrong ID sends every pleased customer to somebody else's listing.
 */
export function normaliseGooglePlaceId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  let candidate = trimmed;
  const carried = /[?&](?:placeid|place_id)=([^&#\s]+)/i.exec(trimmed);
  if (carried?.[1]) {
    try {
      candidate = decodeURIComponent(carried[1]);
    } catch {
      candidate = carried[1];
    }
  }

  if (!PLACE_ID.test(candidate)) {
    throw new ReviewSiteError(
      'BAD_PLACE_ID',
      'That is not a Google place ID. It is a code of letters and digits, usually starting ChIJ, from Google’s place ID finder.',
    );
  }

  return candidate;
}

export const googleReviewSite: ReviewSite = {
  name: 'Google',
  writeReviewUrl: (listing) =>
    listing.googlePlaceId && PLACE_ID.test(listing.googlePlaceId)
      ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(listing.googlePlaceId)}`
      : null,
};

/** No public site: the invitation page thanks the customer and stops there. */
export const noReviewSite: ReviewSite = {
  name: 'None',
  writeReviewUrl: () => null,
};

/** Whether this address belongs to a site the product sends customers to. */
export function isReviewSiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'search.google.com';
  } catch {
    return false;
  }
}
