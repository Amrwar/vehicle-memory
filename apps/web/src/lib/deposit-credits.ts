import { prisma } from '@carnet/db';

/**
 * A refund kept on account. Phase 30.
 *
 * Apart from the rest of the deposits library because the money cycle calls
 * it while the deposits library calls the money cycle; a module both can
 * import without a circle is the honest shape.
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
}
