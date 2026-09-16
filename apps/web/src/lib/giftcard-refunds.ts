import { formatGiftCode, GiftCardError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { isAlreadyDone } from './repeat';

/**
 * Money going back onto a card. Phase 28.
 *
 * Kept apart from the rest of the gift card library because the money
 * cycle calls it, and the gift card library calls the money cycle; a
 * module that both can import without a circle is the honest shape.
 */

/** The card that paid this invoice, if one did: the latest redemption on it. */
export async function cardThatPaid(orgId: string, invoiceId: string) {
  const entry = await prisma.giftCardEntry.findFirst({
    where: { orgId, invoiceId, kind: 'REDEEM' },
    orderBy: { createdAt: 'desc' },
    select: {
      giftCard: { select: { id: true, code: true, disabledAt: true } },
    },
  });
  return entry?.giftCard ?? null;
}

/**
 * A refund by method GIFT_CARD puts the money back on the card that paid
 * the bill. The ledger side is the ordinary refund posting, which credits
 * the cards outstanding; this is the card's own record of it.
 *
 * @repeat GUARDED(CONSTRAINT: gift_card_entries_one_per_refund) One refund
 * puts money on the card once. A retried refund lands on the index and is
 * absorbed rather than loading the card again.
 */
export async function refundOntoCard(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  /** The refund this is. One entry per refund; the database says so. */
  refundId: string;
  amountMinor: number;
  reason: string;
}): Promise<{ giftCardId: string; code: string }> {
  const card = await cardThatPaid(input.orgId, input.invoiceId);
  if (!card) {
    throw new GiftCardError(
      'NOT_FOUND',
      'No gift card paid this invoice, so there is no card to put the money back on.',
    );
  }
  if (card.disabledAt) {
    throw new GiftCardError('DISABLED', 'The card that paid this bill was cancelled.');
  }

  try {
    await prisma.giftCardEntry.create({
      data: {
        orgId: input.orgId,
        giftCardId: card.id,
        kind: 'REFUND',
        amount: input.amountMinor / 100,
        reason: `Refund: ${input.reason}`,
        invoiceId: input.invoiceId,
        refundId: input.refundId,
        createdByUserId: input.userId,
      },
    });
  } catch (error) {
    // The refund reached here twice. The card was loaded the first time, and
    // loading it again would be the workshop paying the same money back
    // twice onto a card the customer walks away with. Phase 46.
    if (!isAlreadyDone(error, 'gift_card_entries_one_per_refund')) throw error;
  }

  return { giftCardId: card.id, code: formatGiftCode(card.code) };
}
