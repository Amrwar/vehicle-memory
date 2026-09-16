import { prisma } from '@carnet/db';

import { isAlreadyDone } from './repeat';

/**
 * A refund kept on account. Phase 30.
 *
 * Apart from the rest of the deposits library because the money cycle calls
 * it while the deposits library calls the money cycle; a module both can
 * import without a circle is the honest shape.
 *
 * @repeat GUARDED(CONSTRAINT: deposits_one_credit_per_refund) One refund
 * becomes credit once. A second attempt reads back the credit the first one
 * made.
 */
export async function keepAsCredit(input: {
  orgId: string;
  userId: string;
  customerId: string;
  refundId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  reason: string;
}): Promise<string> {
  // One credit per refund. Kept as credit twice is money the workshop has
  // given the customer twice, and the second one reads exactly like the
  // first to anybody looking at the account afterwards. Phase 46.
  const already = await prisma.deposit.findFirst({
    where: { orgId: input.orgId, sourceRefundId: input.refundId },
    select: { id: true },
  });

  if (already) return already.id;

  try {
    const credit = await prisma.deposit.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        kind: 'CREDIT',
        amount: input.amountMinor / 100,
        currency: input.currency,
        method: 'DEPOSIT',
        reference: input.invoiceNumber,
        note: `Credit from a refund on ${input.invoiceNumber}: ${input.reason}`,
        takenByUserId: input.userId,
        sourceRefundId: input.refundId,
      },
      select: { id: true },
    });
    return credit.id;
  } catch (error) {
    if (!isAlreadyDone(error, 'deposits_one_credit_per_refund')) throw error;

    // The other attempt wrote it between the look and the write, which is
    // exactly the gap the index is there for.
    const theirs = await prisma.deposit.findFirstOrThrow({
      where: { orgId: input.orgId, sourceRefundId: input.refundId },
      select: { id: true },
    });
    return theirs.id;
  }
}
