import {
  decodeLocally,
  type FitmentFeed,
  googleReviewSite,
  noReviewSite,
  normaliseGooglePlaceId,
  normaliseVin,
  planFeedImport,
  readVpicDecoding,
  type ReviewSite,
  ReviewSiteError,
  sampleFitmentFeed,
  stubVinDecoder,
  type VinDecoder,
  VinDecodeError,
  type VinDecoding,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { createHash } from 'node:crypto';

import { env } from './env';
import { audit } from './guard';

/**
 * The providers behind seams, against the database. Phase 43.
 *
 * Each is chosen by one environment variable and each has an answer that
 * needs nobody else: the VIN decoder built in, the sample fitment feed, no
 * review site. A page never knows which one answered, only what it said and
 * who said it.
 */

export { ReviewSiteError, VinDecodeError };

/* ---------------------------------------------------------------------------
   VIN decoding
   --------------------------------------------------------------------------- */

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';

/**
 * The US registry's public decoder. Free and keyless, and strongest on cars
 * sold in North America; for a European VIN it often knows only the maker.
 * When it cannot be reached the VIN is decoded locally instead, so a slow
 * registry costs the model name and never the form.
 */
const nhtsaVinDecoder: VinDecoder = {
  name: 'NHTSA vPIC',
  async decode(vin) {
    const local = decodeLocally(vin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${VPIC_URL}${encodeURIComponent(local.vin)}?format=json`, {
        headers: { 'User-Agent': 'Carnet' },
        signal: controller.signal,
      });
      if (!response.ok) return local;
      return readVpicDecoding(local.vin, await response.json());
    } catch {
      return local;
    } finally {
      clearTimeout(timer);
    }
  },
};

export function vinDecoder(): VinDecoder {
  return env().VIN_DECODER === 'nhtsa' ? nhtsaVinDecoder : stubVinDecoder;
}

/** How long a remote answer is kept before the registry is asked again. */
const DECODE_KEPT_DAYS = 180;

/**
 * What a VIN says, from the cache when a decoder has already answered.
 *
 * Only a remote decoder's complete answer is kept: the built-in one costs
 * nothing to repeat, and keeping a partial answer would stop the registry
 * being asked again once it knows more.
 */
export async function decodeVin(vin: string, now = new Date()): Promise<VinDecoding> {
  const decoder = vinDecoder();
  const normalised = normaliseVin(vin);
  // Refuses what is not a VIN before anything is looked up.
  decodeLocally(normalised);

  if (decoder !== stubVinDecoder) {
    const cached = await prisma.vinDecode.findUnique({ where: { vin: normalised } });
    if (
      cached &&
      cached.decoder === decoder.name &&
      now.getTime() - cached.fetchedAt.getTime() < DECODE_KEPT_DAYS * 86_400_000
    ) {
      return { ...cached, decoder: cached.decoder };
    }
  }

  const decoded = await decoder.decode(normalised);

  if (decoder !== stubVinDecoder && decoded.complete) {
    const data = {
      decoder: decoded.decoder,
      make: decoded.make,
      model: decoded.model,
      year: decoded.year,
      engine: decoded.engine,
      fuel: decoded.fuel,
      body: decoded.body,
      complete: decoded.complete,
      fetchedAt: now,
    };
    await prisma.vinDecode.upsert({
      where: { vin: normalised },
      create: { vin: normalised, ...data },
      update: data,
    });
  }

  return decoded;
}

/* ---------------------------------------------------------------------------
   Fitment feeds
   --------------------------------------------------------------------------- */

/** The feed this deployment reads, or null when there is none. */
export function fitmentFeed(): FitmentFeed | null {
  return env().FITMENT_FEED === 'sample' ? sampleFitmentFeed : null;
}

export interface FeedFetchResult {
  feed: string;
  added: number;
  removed: number;
  unchanged: number;
  keptWorkshop: number;
  invalid: number;
}

/**
 * Asks the feed what one part fits and takes the answer in by the rules.
 *
 * Written in one transaction, so a fetch that fails halfway leaves the part
 * as it was rather than with half a catalogue.
 */
export async function fetchFeedFitments(input: {
  orgId: string;
  userId: string;
  productId: string;
  now?: Date;
}): Promise<FeedFetchResult> {
  const feed = fitmentFeed();
  if (!feed) throw new Error('No fitment feed is connected to this workshop.');

  const product = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
    select: { id: true, partNumber: true, brand: true },
  });
  if (!product) throw new Error('That part is not in this workshop.');

  const [incoming, held] = await Promise.all([
    feed.lookup({ partNumber: product.partNumber, brand: product.brand }),
    prisma.partFitment.findMany({
      where: { orgId: input.orgId, productId: product.id },
      select: {
        id: true,
        make: true,
        model: true,
        yearFrom: true,
        yearTo: true,
        engineCode: true,
        source: true,
        feedName: true,
      },
    }),
  ]);

  const plan = planFeedImport(held, incoming, feed.name);
  const fetchedAt = input.now ?? new Date();

  await prisma.$transaction(async (tx) => {
    if (plan.remove.length > 0) {
      await tx.partFitment.deleteMany({
        where: { id: { in: plan.remove }, orgId: input.orgId, feedName: feed.name },
      });
    }
    if (plan.create.length > 0) {
      await tx.partFitment.createMany({
        data: plan.create.map((row) => ({
          orgId: input.orgId,
          productId: product.id,
          make: row.make,
          model: row.model ?? null,
          yearFrom: row.yearFrom ?? null,
          yearTo: row.yearTo ?? null,
          engineCode: row.engineCode ?? null,
          note: row.note ?? null,
          source: feed.source,
          feedName: feed.name,
          fetchedAt,
          createdByUserId: input.userId,
        })),
      });
    }
    // What the feed still says is marked as said again today.
    await tx.partFitment.updateMany({
      where: { orgId: input.orgId, productId: product.id, feedName: feed.name },
      data: { fetchedAt },
    });
  });

  const result: FeedFetchResult = {
    feed: feed.name,
    added: plan.create.length,
    removed: plan.remove.length,
    unchanged: plan.unchanged,
    keptWorkshop: plan.keptWorkshop,
    invalid: plan.invalid,
  };

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fitment.feed_fetched',
    entityType: 'Product',
    entityId: product.id,
    after: result,
  });

  return result;
}

/* ---------------------------------------------------------------------------
   Review sites
   --------------------------------------------------------------------------- */

export function reviewSite(): ReviewSite {
  return env().REVIEW_SITE === 'google' ? googleReviewSite : noReviewSite;
}

/** Where this workshop's pleased customers are sent, or null. */
export async function reviewLinkFor(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { googlePlaceId: true },
  });
  return org ? reviewSite().writeReviewUrl({ googlePlaceId: org.googlePlaceId }) : null;
}

export async function setGooglePlaceId(input: {
  orgId: string;
  userId: string;
  value: string;
}): Promise<string | null> {
  const placeId = normaliseGooglePlaceId(input.value);
  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: { googlePlaceId: true },
  });

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { googlePlaceId: placeId },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.review_site_updated',
    entityType: 'Organization',
    entityId: input.orgId,
    before: { googlePlaceId: before.googlePlaceId },
    after: { googlePlaceId: placeId },
  });

  return placeId;
}

/**
 * The customer followed the invitation: note it, and say where to send them.
 *
 * Only an answer that was routed to a public invitation is sent anywhere. A
 * link opened from a three-star answer goes back to the thank-you page, so
 * the invitation cannot be reached by changing an address.
 */
export async function followReviewInvitation(token: string, now = new Date()) {
  const request = await prisma.reviewRequest.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    select: { id: true, orgId: true, routing: true, expiresAt: true, publicOpenedAt: true },
  });

  if (!request || request.expiresAt < now || request.routing !== 'PUBLIC_INVITE') return null;

  const url = await reviewLinkFor(request.orgId);
  if (!url) return null;

  if (!request.publicOpenedAt) {
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { publicOpenedAt: now },
    });
    await audit({
      orgId: request.orgId,
      action: 'review.public_opened',
      entityType: 'ReviewRequest',
      entityId: request.id,
      after: { site: reviewSite().name },
    });
  }

  return url;
}
