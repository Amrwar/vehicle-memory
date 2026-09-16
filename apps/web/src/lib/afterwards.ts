import { prisma } from '@carnet/db';
import { log } from '@carnet/jobs';

import { awardForInvoice } from './retention';
import { settleReferralsFor } from './referrals';

/**
 * What happens after a bill is paid, and what happens when that is missed.
 * Phase 46.
 *
 * Taking the money and granting the points are not the same kind of event.
 * The payment is a fact the customer watched happen; the points and the
 * referral payout are consequences of it, and they are written after the
 * payment's transaction has committed, deliberately — a ledger or a loyalty
 * table being briefly unavailable must not undo money somebody has already
 * handed over.
 *
 * Which leaves the gap this file exists for. Between the payment committing
 * and its consequences landing there is a moment where a process can die, a
 * deploy can land, or a database can time out, and until Phase 46 anything
 * caught in that moment was simply never granted. Nobody would ever know: the
 * customer does not know how many points they should have, and the workshop
 * has no list of points it failed to give.
 *
 * So the consequences are (1) attempted inline, where they almost always
 * succeed and the customer sees them immediately, (2) unable to bring down
 * the payment if they fail, and (3) swept up afterwards. All three rely on
 * their being safe to repeat, which is what the keys on the loyalty entries
 * are for.
 */

/** How far back the sweep looks. Longer than any outage worth sweeping. */
const CATCH_UP_DAYS = 3;

/**
 * Grants what a paid bill earns. Never throws.
 *
 * A failure here is logged and left for the sweep rather than raised, because
 * the caller is holding a committed payment and there is nothing useful it
 * could do with the news.
 */
export async function consequencesOfPayment(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  customerId: string;
}): Promise<{ points: number; referrals: number; missed: boolean }> {
  try {
    const points = await awardForInvoice({
      orgId: input.orgId,
      userId: input.userId,
      invoiceId: input.invoiceId,
    });

    const referrals = await settleReferralsFor({
      orgId: input.orgId,
      userId: input.userId,
      customerId: input.customerId,
    });

    return { points, referrals, missed: false };
  } catch (error) {
    log('payment.consequences.missed', {
      invoiceId: input.invoiceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return { points: 0, referrals: 0, missed: true };
  }
}

/**
 * The sweep: bills paid in the last few days whose points never arrived.
 *
 * Found by the absence of the entry rather than by a flag on the invoice,
 * because a flag is another thing that can fail to be written, and then the
 * thing meant to catch the miss is itself missed.
 *
 * Running against a bill whose points did arrive is free: the key is already
 * taken and the award is absorbed. So there is no harm in the sweep being
 * approximate, and a great deal of harm in its being clever.
 */
export async function catchUpConsequences(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - CATCH_UP_DAYS * 86_400_000);

  const paid = await prisma.invoice.findMany({
    where: { status: 'PAID', updatedAt: { gte: since } },
    select: { id: true, orgId: true, customerId: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  if (paid.length === 0) return 0;

  const granted = new Set(
    (
      await prisma.loyaltyEntry.findMany({
        where: { once: { in: paid.map((invoice) => `invoice:${invoice.id}:paid`) } },
        select: { once: true },
      })
    ).map((entry) => entry.once),
  );

  let caught = 0;

  for (const invoice of paid) {
    if (granted.has(`invoice:${invoice.id}:paid`)) continue;

    // The award is the workshop's rather than a person's, but the audit
    // trail wants a name against it, and the owner is the truthful one: this
    // is the workshop granting what it owes, not somebody pressing a button.
    const by = await anyOwner(invoice.orgId);
    if (!by) continue;

    const done = await consequencesOfPayment({
      orgId: invoice.orgId,
      userId: by,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
    });

    if (!done.missed && (done.points > 0 || done.referrals > 0)) {
      caught += 1;
      log('payment.consequences.caught', {
        invoiceId: invoice.id,
        points: done.points,
        referrals: done.referrals,
      });
    }
  }

  return caught;
}

async function anyOwner(orgId: string): Promise<string | null> {
  const owner = await prisma.membership.findFirst({
    where: { orgId, role: 'OWNER', isActive: true },
    select: { userId: true },
  });

  return owner?.userId ?? null;
}
