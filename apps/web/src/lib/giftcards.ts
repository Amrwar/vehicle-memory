import {
  assertCardRedeemable,
  assertCardSellable,
  assertPaymentRecordable,
  formatGiftCode,
  fromDecimal,
  giftCardBalance,
  giftCardCode,
  GiftCardError,
  type InvoiceState,
  looksLikeGiftCode,
  money,
  normaliseGiftCode,
  postGiftCardSold,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts, postEntry } from './accounting';
import { audit } from './guard';
import { recordPayment } from './money';

export { formatGiftCode, GiftCardError };

/**
 * Gift cards, in the product. Phase 26.
 *
 * Sold at the counter for whole pounds, paid for with money, and booked as a
 * liability until spent. Redeemed against a bill as a payment of its own
 * kind, which releases the liability rather than touching the bank a second
 * time. The balance is the sum of the entries.
 */

const minor = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);

/** Sells a card: a row, a loading entry, a ledger posting, an audit line. */
export async function sellGiftCard(input: {
  orgId: string;
  userId: string;
  amountMinor: number;
  method: string;
  recipientName?: string | null;
  note?: string | null;
}): Promise<{ id: string; code: string }> {
  assertCardSellable({ amountMinor: input.amountMinor, method: input.method });

  await ensureChartOfAccounts(input.orgId);

  const amount = input.amountMinor / 100;
  const soldAt = new Date();

  // Retried on collision rather than assumed unique. Twelve characters is a
  // large space, but a large space is not a guarantee.
  let created: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 8 && !created; attempt += 1) {
    const code = giftCardCode();
    const taken = await prisma.giftCard.findFirst({
      where: { orgId: input.orgId, code },
      select: { id: true },
    });
    if (taken) continue;

    created = await prisma.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          orgId: input.orgId,
          code,
          amount,
          method: input.method as 'CARD',
          recipientName: input.recipientName?.trim() || null,
          note: input.note?.trim() || null,
          soldAt,
          soldByUserId: input.userId,
        },
        select: { id: true, code: true },
      });
      await tx.giftCardEntry.create({
        data: {
          orgId: input.orgId,
          giftCardId: card.id,
          amount,
          reason: 'Sold',
          createdByUserId: input.userId,
        },
      });
      return card;
    });
  }
  if (!created) throw new Error('Could not find an unused code. Try again.');

  await postEntry(
    input.orgId,
    postGiftCardSold({
      giftCardId: created.id,
      reference: `GC/${formatGiftCode(created.code)}`,
      amount: money(input.amountMinor, 'GBP'),
      method: input.method as 'CARD',
      soldAt,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'giftcard.sold',
    entityType: 'GiftCard',
    entityId: created.id,
    after: { amountMinor: input.amountMinor, method: input.method },
  });

  return created;
}

/** The card behind a code, or a refusal that says which kind of wrong it was. */
export async function findGiftCard(orgId: string, code: string) {
  if (!looksLikeGiftCode(code)) {
    throw new GiftCardError('NOT_A_CODE', 'That is not one of our card numbers.');
  }
  const card = await prisma.giftCard.findFirst({
    where: { orgId, code: normaliseGiftCode(code) },
    select: {
      id: true,
      code: true,
      amount: true,
      currency: true,
      voidedAt: true,
      entries: { select: { amount: true } },
    },
  });
  if (!card) throw new GiftCardError('NOT_FOUND', 'No card has that number.');
  return {
    ...card,
    balanceMinor: giftCardBalance(card.entries.map((e) => ({ amountMinor: minor(e.amount) }))),
  };
}

/**
 * A card comes off a bill as a payment of kind GIFT_CARD.
 *
 * The bill is checked with the same rule every other payment meets, then the
 * card's own rules, before anything is written. Then the spend is recorded on
 * the card, then the payment, then the two are linked: a failure between the
 * first two leaves a spend against nothing, which is visible and undoable,
 * rather than a bill paid twice.
 */
export async function redeemGiftCard(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  code: string;
  /** Null means as much as the bill needs. */
  amountMinor: number | null;
}): Promise<{ amountMinor: number; paymentId: string; leftMinor: number }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
    },
  });
  if (!invoice) throw new GiftCardError('NOT_FOUND', 'That invoice is not in this workshop.');

  const card = await findGiftCard(input.orgId, input.code);
  const owedMinor = minor(invoice.total) - minor(invoice.amountPaid);

  const amountMinor = assertCardRedeemable({
    balanceMinor: card.balanceMinor,
    amountMinor: input.amountMinor,
    owedMinor,
    voided: card.voidedAt !== null,
  });

  assertPaymentRecordable(
    {
      status: invoice.status as InvoiceState,
      total: fromDecimal(invoice.total.toString(), invoice.currency),
      amountPaid: fromDecimal(invoice.amountPaid.toString(), invoice.currency),
    },
    money(amountMinor, invoice.currency),
  );

  await ensureChartOfAccounts(input.orgId);

  const entry = await prisma.giftCardEntry.create({
    data: {
      orgId: input.orgId,
      giftCardId: card.id,
      amount: -amountMinor / 100,
      reason: `Against invoice ${invoice.number}`,
      invoiceId: invoice.id,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });

  const paymentId = await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: invoice.id,
    amount: money(amountMinor, invoice.currency),
    method: 'GIFT_CARD',
    reference: formatGiftCode(card.code),
    notes: 'Gift card redeemed',
  });

  await prisma.giftCardEntry.update({ where: { id: entry.id }, data: { paymentId } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'giftcard.redeemed',
    entityType: 'GiftCard',
    entityId: card.id,
    after: { amountMinor, invoice: invoice.number, paymentId },
  });

  return { amountMinor, paymentId, leftMinor: card.balanceMinor - amountMinor };
}

/** Every card, newest first, with its balance, and the figures the page leads with. */
export async function giftCardsFor(orgId: string) {
  const rows = await prisma.giftCard.findMany({
    where: { orgId },
    orderBy: { soldAt: 'desc' },
    take: 200,
    select: {
      id: true,
      code: true,
      amount: true,
      method: true,
      recipientName: true,
      soldAt: true,
      voidedAt: true,
      soldBy: { select: { name: true } },
      entries: { select: { amount: true } },
    },
  });

  const cards = rows.map((row) => {
    const loadedMinor = minor(row.amount);
    const balanceMinor = giftCardBalance(
      row.entries.map((e) => ({ amountMinor: minor(e.amount) })),
    );
    return {
      id: row.id,
      code: formatGiftCode(row.code),
      loadedMinor,
      balanceMinor,
      method: row.method,
      recipientName: row.recipientName,
      soldAt: row.soldAt,
      soldBy: row.soldBy?.name ?? null,
      voided: row.voidedAt !== null,
    };
  });

  const live = cards.filter((card) => !card.voided);
  return {
    cards,
    outstandingMinor: live.reduce((total, card) => total + card.balanceMinor, 0),
    soldMinor: live.reduce((total, card) => total + card.loadedMinor, 0),
    spentMinor: live.reduce((total, card) => total + (card.loadedMinor - card.balanceMinor), 0),
    withBalance: live.filter((card) => card.balanceMinor > 0).length,
  };
}

/** One card and everything that happened on it. */
export async function giftCardDetail(orgId: string, id: string) {
  const card = await prisma.giftCard.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      code: true,
      amount: true,
      currency: true,
      method: true,
      recipientName: true,
      note: true,
      soldAt: true,
      voidedAt: true,
      soldBy: { select: { name: true } },
      entries: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          amount: true,
          reason: true,
          createdAt: true,
          invoice: { select: { id: true, number: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });
  if (!card) return null;

  return {
    ...card,
    code: formatGiftCode(card.code),
    loadedMinor: minor(card.amount),
    balanceMinor: giftCardBalance(card.entries.map((e) => ({ amountMinor: minor(e.amount) }))),
    entries: card.entries.map((entry) => ({ ...entry, amountMinor: minor(entry.amount) })),
  };
}
