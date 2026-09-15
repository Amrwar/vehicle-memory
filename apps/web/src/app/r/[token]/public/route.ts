import { isReviewSiteUrl } from '@carnet/core';

import { followReviewInvitation } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * From the thank-you page to the review site. Phase 43.
 *
 * The workshop learns that the customer went, not what they wrote: what is
 * posted on the site is the customer's, under their own name. Anybody whose
 * answer was not a public invitation, or whose link has lapsed, is sent back
 * to the page they came from.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const url = await followReviewInvitation(token);

  if (url && isReviewSiteUrl(url)) {
    return Response.redirect(url, 303);
  }

  return Response.redirect(new URL(`/r/${encodeURIComponent(token)}`, request.url), 303);
}
