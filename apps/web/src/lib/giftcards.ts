import {
  assertCardAdjustable,
  assertCardRedeemable,
  assertCardSellable,
  assertPaymentRecordable,
  formatGiftCode,
  fromDecimal,
  giftCardBalance,
  giftCardCode,
  GiftCardError,
  giftCardExpiry,
  giftCardStatus,
  type GiftCardStatus,
  type InvoiceState,
  looksLikeGiftCode,
  money,
  normaliseGiftCode,
  postGiftCardAdjustment,
  postGiftCardSold,
} from '@carnet/core';
import { type Prisma, prisma } from '@carnet/db';

import { ensureChartOfAccounts, postEntry } from './accounting';
import { audit } from './guard';
import { recordPayment } from './money';

export { cardThatPaid, refundOntoCard } from './giftcard-refunds';
export { formatGiftCode, GiftCardError };

/**
 * Gift cards, in the product. Phases 26 and 28.
 *
 * Sold at the counter for whole pounds, paid for with money, and booked as a
 * liability until spent. Redeemed against a bill or at the counter as a
 * payment of its own kind, which releases the liability rather than touching
 * the bank a second time. Every movement is typed and says why, so the
 * balance, which is the sum of them, can always be explained.
 */

const minor = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);

type Tx = Prisma.TransactionClient;

/** Sells a card: a row, a loading entry, a ledger posting, an audit line. */
export async function sellGiftCard(input: {
  orgId: string;
  userId: string;
  amountMinor: number;
  method: string;
  termMonths?: number | null;
  locationId?: string | null;
  recipientName?: string | null;
  note?: string | null;
}): Promise<{ id: string; code: string }> {
  assertCardSellable({
    amountMinor: input.amountMinor,
    method: input.method,
    termMonths: input.termMonths ?? null,
  });

  if (input.locationId) {
    const site = await prisma.location.findFirst({
      where: { id: input.locationId, orgId: input.orgId },
      select: { id: true },
    });
    if (!site) throw new GiftCardError('WRONG_SITE', 'That site is not in this workshop.');
  }

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
          expiresAt: giftCardExpiry(input.termMonths ?? null, soldAt),
          locationId: input.locationId ?? null,
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
          kind: 'ISSUE',
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
    after: {
      amountMinor: input.amountMinor,
      method: input.method,
      termMonths: input.termMonths ?? null,
      locationId: input.locationId ?? null,
    },
  });

  return created;
}

const CARD_SELECT = {
  id: true,
  code: true,
  amount: true,
  currency: true,
  expiresAt: true,
  disabledAt: true,
  locationId: true,
  entries: { select: { amount: true } },
} as const;

function withBalance<
  T extends {
    entries: { amount: { toString(): string } }[];
    expiresAt: Date | null;
    disabledAt: Date | null;
  },
>(card: T, now = new Date()) {
  const balanceMinor = giftCardBalance(card.entries.map((e) => ({ amountMinor: minor(e.amount) })));
  return { ...card, balanceMinor, status: giftCardStatus({ ...card, balanceMinor }, now) };
}

/** The card behind a code, or a refusal that says which kind of wrong it was. */
export async function findGiftCard(orgId: string, code: string, db: Tx | typeof prisma = prisma) {
  if (!looksLikeGiftCode(code)) {
    throw new GiftCardError('NOT_A_CODE', 'That is not one of our card numbers.');
  }
  const card = await db.giftCard.findFirst({
    where: { orgId, code: normaliseGiftCode(code) },
    select: CARD_SELECT,
  });
  if (!card) throw new GiftCardError('NOT_FOUND', 'No card has that number.');
  return withBalance(card);
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
  now?: Date;
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
      job: { select: { locationId: true } },
    },
  });
  if (!invoice) throw new GiftCardError('NOT_FOUND', 'That invoice is not in this workshop.');

  const card = await findGiftCard(input.orgId, input.code);
  const owedMinor = minor(invoice.total) - minor(invoice.amountPaid);

  const amountMinor = assertCardRedeemable({
    balanceMinor: card.balanceMinor,
    amountMinor: input.amountMinor,
    owedMinor,
    disabledAt: card.disabledAt,
    expiresAt: card.expiresAt,
    cardLocationId: card.locationId,
    atLocationId: invoice.job?.locationId ?? null,
    now: input.now,
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
      kind: 'REDEEM',
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

/**
 * A card spent at the counter, inside the sale's own transaction, so the
 * sale and the spend stand or fall together. The counter has already
 * settled the tenders; this checks the card can cover its share and writes
 * the movement against the sale.
 */
export async function redeemAtCounter(
  tx: Tx,
  input: {
    orgId: string;
    userId: string;
    code: string;
    amountMinor: number;
    counterSaleId: string;
    reference: string;
    locationId: string | null;
  },
): Promise<void> {
  const card = await findGiftCard(input.orgId, input.code, tx);
  assertCardRedeemable({
    balanceMinor: card.balanceMinor,
    amountMinor: input.amountMinor,
    owedMinor: input.amountMinor,
    disabledAt: card.disabledAt,
    expiresAt: card.expiresAt,
    cardLocationId: card.locationId,
    atLocationId: input.locationId,
  });
  await tx.giftCardEntry.create({
    data: {
      orgId: input.orgId,
      giftCardId: card.id,
      kind: 'REDEEM',
      amount: -input.amountMinor / 100,
      reason: `At the counter, sale ${input.reference}`,
      counterSaleId: input.counterSaleId,
      createdByUserId: input.userId,
    },
  });
}

/**
 * A person changes what a card holds, with a reason that stays on it.
 * Money added is booked as goodwill; money taken off as sundry income.
 */
export async function adjustGiftCard(input: {
  orgId: string;
  userId: string;
  giftCardId: string;
  amountMinor: number;
  reason: string;
}): Promise<{ balanceMinor: number }> {
  const card = await prisma.giftCard.findFirst({
    where: { id: input.giftCardId, orgId: input.orgId },
    select: CARD_SELECT,
  });
  if (!card) throw new GiftCardError('NOT_FOUND', 'That card is not in this workshop.');
  const held = withBalance(card);

  const reason = input.reason.trim();
  assertCardAdjustable({
    amountMinor: input.amountMinor,
    balanceMinor: held.balanceMinor,
    reason,
    disabledAt: card.disabledAt,
  });

  await ensureChartOfAccounts(input.orgId);

  const entry = await prisma.giftCardEntry.create({
    data: {
      orgId: input.orgId,
      giftCardId: card.id,
      kind: 'ADJUSTMENT',
      amount: input.amountMinor / 100,
      reason,
      createdByUserId: input.userId,
    },
    select: { id: true, createdAt: true },
  });

  await postEntry(
    input.orgId,
    postGiftCardAdjustment({
      entryId: entry.id,
      reference: `GC/${formatGiftCode(card.code)}/A`,
      amount: money(Math.abs(input.amountMinor), 'GBP'),
      direction: input.amountMinor > 0 ? 'UP' : 'DOWN',
      reason,
      at: entry.createdAt,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'giftcard.adjusted',
    entityType: 'GiftCard',
    entityId: card.id,
    after: { amountMinor: input.amountMinor, reason },
  });

  return { balanceMinor: held.balanceMinor + input.amountMinor };
}

/**
 * Cancels a card. Whatever is on it is written off with the reason, so the
 * liability goes with it and the history says where the money went. There
 * is no way back: a cancelled card stays cancelled and a new one is sold.
 */
export async function disableGiftCard(input: {
  orgId: string;
  userId: string;
  giftCardId: string;
  reason: string;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason) throw new GiftCardError('NO_REASON', 'Say why. The reason stays on the card.');

  const card = await prisma.giftCard.findFirst({
    where: { id: input.giftCardId, orgId: input.orgId },
    select: CARD_SELECT,
  });
  if (!card) throw new GiftCardError('NOT_FOUND', 'That card is not in this workshop.');
  if (card.disabledAt) throw new GiftCardError('DISABLED', 'That card was already cancelled.');

  const held = withBalance(card);
  if (held.balanceMinor > 0) {
    await adjustGiftCard({
      orgId: input.orgId,
      userId: input.userId,
      giftCardId: card.id,
      amountMinor: -held.balanceMinor,
      reason: `Cancelled: ${reason}`,
    });
  }

  await prisma.giftCard.update({
    where: { id: card.id },
    data: { disabledAt: new Date(), disabledReason: reason },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'giftcard.cancelled',
    entityType: 'GiftCard',
    entityId: card.id,
    after: { reason, writtenOffMinor: held.balanceMinor },
  });
}

/** Every card, newest first, with its balance and status, and the figures the page leads with. */
export async function giftCardsFor(orgId: string, now = new Date()) {
  const rows = await prisma.giftCard.findMany({
    where: { orgId },
    orderBy: { soldAt: 'desc' },
    take: 200,
    select: {
      ...CARD_SELECT,
      method: true,
      recipientName: true,
      soldAt: true,
      soldBy: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  const cards = rows.map((row) => {
    const held = withBalance(row, now);
    return {
      id: row.id,
      code: formatGiftCode(row.code),
      loadedMinor: minor(row.amount),
      balanceMinor: held.balanceMinor,
      status: held.status as GiftCardStatus,
      method: row.method,
      recipientName: row.recipientName,
      soldAt: row.soldAt,
      expiresAt: row.expiresAt,
      site: row.location?.name ?? null,
      soldBy: row.soldBy?.name ?? null,
    };
  });

  const live = cards.filter((card) => card.status === 'ACTIVE');
  const soonest = new Date(now.getTime() + 60 * 86_400_000);
  return {
    cards,
    outstandingMinor: live.reduce((total, card) => total + card.balanceMinor, 0),
    soldMinor: cards
      .filter((card) => card.status !== 'DISABLED')
      .reduce((total, card) => total + card.loadedMinor, 0),
    spentMinor: cards.reduce(
      (total, card) =>
        total + (card.status === 'DISABLED' ? 0 : card.loadedMinor - card.balanceMinor),
      0,
    ),
    withBalance: live.length,
    lapsingSoon: live.filter((card) => card.expiresAt && card.expiresAt <= soonest).length,
  };
}

/** One card and everything that happened on it. */
export async function giftCardDetail(orgId: string, id: string, now = new Date()) {
  const card = await prisma.giftCard.findFirst({
    where: { id, orgId },
    select: {
      ...CARD_SELECT,
      method: true,
      recipientName: true,
      note: true,
      soldAt: true,
      disabledReason: true,
      soldBy: { select: { name: true } },
      location: { select: { name: true } },
      entries: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          amount: true,
          reason: true,
          createdAt: true,
          invoice: { select: { id: true, number: true } },
          counterSale: { select: { id: true, reference: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });
  if (!card) return null;

  const held = withBalance(card, now);
  return {
    ...card,
    code: formatGiftCode(card.code),
    loadedMinor: minor(card.amount),
    balanceMinor: held.balanceMinor,
    status: held.status as GiftCardStatus,
    site: card.location?.name ?? null,
    entries: card.entries.map((entry) => ({ ...entry, amountMinor: minor(entry.amount) })),
  };
}

/** The sites a card can be tied to, for the sell form. */
export async function sitesFor(orgId: string) {
  return prisma.location.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
