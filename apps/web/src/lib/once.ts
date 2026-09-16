import { keyExpiry, repeatKey } from '@carnet/core';
import { prisma } from '@carnet/db';
import { randomUUID } from 'node:crypto';

import { isAlreadyDone } from './repeat';

/**
 * Doing something once, even when it is asked for twice. Phase 46.
 *
 * Most guarded writes in this product are guarded by what they are: a coupon
 * cannot be redeemed twice against one bill because a unique index says so, a
 * tax entry cannot be written twice for one document for the same reason. The
 * key is the thing itself, and no bookkeeping is needed.
 *
 * Taking money is not like that. Two cash payments of fifty pounds against
 * one bill on one afternoon are two real payments; nothing in either of them
 * says which is which. What separates them is that somebody made two
 * decisions, at two moments, on two separately drawn forms — so the form is
 * where the key has to come from.
 *
 * `onceToken()` mints one when the form is drawn. The form carries it in a
 * hidden field. `once()` claims it before doing the work, so:
 *
 *   - a double-click sends the same key twice and the second is absorbed;
 *   - a refresh that resubmits sends the same key and is absorbed;
 *   - the back button, which redraws the page it has cached, sends the key it
 *     was drawn with and is absorbed;
 *   - deciding tomorrow to take another fifty pounds draws a new form, mints
 *     a new key, and goes through, which is correct.
 *
 * The claim is written before the work rather than after it, which is the
 * whole point and also the thing that can go wrong: a process that dies
 * holding a claim has left a key nobody can use. So a claim that never
 * finished is retaken once it is plainly not coming back, and until then the
 * second attempt is told the first is still going rather than silently doing
 * nothing.
 */

/** How long before an unfinished claim is assumed dead and retaken. */
const STUCK_AFTER_MS = 2 * 60_000;

export class StillGoingError extends Error {
  constructor() {
    super('That is already going through. Give it a moment rather than pressing again.');
    this.name = 'StillGoingError';
  }
}

/** A key for a form that is about to be drawn. */
export function onceToken(): string {
  return randomUUID();
}

export interface OnceResult<T> {
  /** False when this call was a repeat and did nothing. */
  ran: boolean;
  result?: T;
  /** What the first attempt produced, for a repeat that needs to go somewhere. */
  resultRef?: string | null;
}

/**
 * Runs `work` unless this key has already been used.
 *
 * `resultOf` names what the work produced — an invoice id, a payment id — so
 * that a repeat can be sent to the same page the first one ended on instead
 * of being told nothing happened. A person who double-clicked should land
 * where they expected to land, not on an error about double-clicking.
 */
export async function once<T>(input: {
  orgId: string;
  /** The token from the form, plus what the form was for. */
  key: readonly (string | number | null | undefined)[];
  work: () => Promise<T>;
  resultOf?: (result: T) => string | null;
  now?: Date;
}): Promise<OnceResult<T>> {
  const now = input.now ?? new Date();
  const key = repeatKey(input.key);

  const claimed = await claim(input.orgId, key, now);

  if (!claimed.ours) {
    if (!claimed.doneAt) throw new StillGoingError();
    return { ran: false, resultRef: claimed.resultRef };
  }

  let result: T;
  try {
    result = await input.work();
  } catch (error) {
    // A claim whose work failed is released, so the person can fix whatever
    // it complained about and press the same button again. Holding the key
    // would make one refusal permanent.
    await prisma.onceRequest.deleteMany({ where: { orgId: input.orgId, key } });
    throw error;
  }

  const resultRef = input.resultOf?.(result) ?? null;

  await prisma.onceRequest.updateMany({
    where: { orgId: input.orgId, key },
    data: { doneAt: new Date(), resultRef },
  });

  return { ran: true, result, resultRef };
}

/**
 * Takes the key, or reports who has it.
 *
 * The insert is the claim: two requests racing here both try to write the
 * same row and the index decides, which is the only way to decide it that
 * does not have a gap in the middle.
 */
async function claim(
  orgId: string,
  key: string,
  now: Date,
): Promise<{ ours: boolean; doneAt?: Date | null; resultRef?: string | null }> {
  try {
    await prisma.onceRequest.create({
      data: { orgId, key, expiresAt: keyExpiry(now) },
    });
    return { ours: true };
  } catch (error) {
    if (!isAlreadyDone(error)) throw error;
  }

  const held = await prisma.onceRequest.findUnique({
    where: { orgId_key: { orgId, key } },
    select: { doneAt: true, resultRef: true, createdAt: true },
  });

  if (!held) {
    // Swept between the failed insert and this read. Whoever held it is
    // finished with it either way, so the work is ours to do.
    return { ours: true };
  }

  if (!held.doneAt && now.getTime() - held.createdAt.getTime() > STUCK_AFTER_MS) {
    // Plainly not coming back. Retaken rather than left to block the button
    // for a month, and the retake is itself a claim so two rescuers cannot
    // both take it.
    const retaken = await prisma.onceRequest.updateMany({
      where: { orgId, key, doneAt: null, createdAt: held.createdAt },
      data: { createdAt: now },
    });

    if (retaken.count === 1) return { ours: true };
  }

  return { ours: false, doneAt: held.doneAt, resultRef: held.resultRef };
}

/** Keys old enough that no retry will ever arrive for them. */
export async function sweepOnceRequests(now = new Date()): Promise<number> {
  const gone = await prisma.onceRequest.deleteMany({ where: { expiresAt: { lt: now } } });
  return gone.count;
}
