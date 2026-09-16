import {
  assertCouponSaveable,
  type Coupon,
  CouponError,
  couponDiscount,
  type CouponKind,
  couponResults,
  couponState,
  describeCoupon,
  fromDecimal,
  money,
  normaliseCouponCode,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts } from './accounting';
import { audit } from './guard';
import { recordPayment } from './money';
import { regionFor } from './region';

/**
 * Codes, against the database. Phase 45.5.
 *
 * A coupon is settled the way loyalty points are: as a payment of its own
 * kind against the bill, which leaves the invoice exactly as it was issued
 * and puts what the offer gave away where a workshop can read it. Nothing
 * here edits an invoice, and nothing here posts to the bank.
 *
 * Every refusal comes back as a sentence a person can repeat to whoever is
 * standing in front of them.
 */

export { CouponError };

const asCoupon = (
  row: {
    id: string;
    code: string;
    kind: string;
    percent: unknown;
    amount: unknown;
    minSpend: unknown;
    startsOn: Date | null;
    endsOn: Date | null;
    maxRedemptions: number | null;
    perCustomer: number;
    redeemed: number;
    isActive: boolean;
  },
  currency: string,
): Coupon => ({
  id: row.id,
  code: row.code,
  kind: row.kind as CouponKind,
  percent: Number(row.percent),
  amount: fromDecimal(String(row.amount), currency),
  minSpend: row.minSpend === null ? null : fromDecimal(String(row.minSpend), currency),
  startsOn: row.startsOn,
  endsOn: row.endsOn,
  maxRedemptions: row.maxRedemptions,
  perCustomer: row.perCustomer,
  redeemed: row.redeemed,
  isActive: row.isActive,
});

/** Every code the workshop has, with where each stands and what it has given away. */
export async function coupons(orgId: string, now = new Date()) {
  const region = await regionFor(orgId);

  const rows = await prisma.coupon.findMany({
    where: { orgId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: {
      redemptions: { select: { amount: true, billed: true } },
      createdBy: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const coupon = asCoupon(row, region.currency);
    const given = row.redemptions.reduce((total, use) => total + Number(use.amount), 0);
    const billed = row.redemptions.reduce((total, use) => total + Number(use.billed), 0);

    return {
      ...row,
      coupon,
      state: couponState(coupon, now),
      summary: describeCoupon(coupon, now),
      given,
      billed,
      currency: region.currency,
    };
  });
}

/** What the codes gave away and what came in on the visits they were used on. */
export async function couponResultsFor(orgId: string, period: { from: Date; to: Date }) {
  const region = await regionFor(orgId);

  const rows = await prisma.couponRedemption.findMany({
    where: { orgId, redeemedAt: { gte: period.from, lte: period.to } },
    select: { amount: true, billed: true, coupon: { select: { code: true } } },
  });

  return couponResults(
    rows.map((row) => ({
      code: row.coupon.code,
      given: fromDecimal(String(row.amount), region.currency),
      billed: fromDecimal(String(row.billed), region.currency),
    })),
    region.currency,
  );
}

export async function saveCoupon(input: {
  orgId: string;
  userId: string;
  id?: string | null;
  code: string;
  kind: CouponKind;
  percent: number;
  amount: number;
  minSpend: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
  maxRedemptions: number | null;
  perCustomer: number;
  note?: string | null;
}): Promise<string> {
  const region = await regionFor(input.orgId);
  const code = normaliseCouponCode(input.code);

  assertCouponSaveable({
    code,
    kind: input.kind,
    percent: input.percent,
    amount: money(Math.round((input.amount || 0) * 100), region.currency),
    minSpend:
      input.minSpend === null ? null : money(Math.round(input.minSpend * 100), region.currency),
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    maxRedemptions: input.maxRedemptions,
    perCustomer: input.perCustomer,
  });

  const taken = await prisma.coupon.findFirst({
    where: { orgId: input.orgId, code, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  });

  if (taken) {
    throw new CouponError(
      'BAD_CODE',
      `${code} is already a code in this workshop. Two codes with one name is two offers nobody can tell apart.`,
    );
  }

  const data = {
    orgId: input.orgId,
    code,
    kind: input.kind,
    // The database refuses a code that is worth two things; the form cannot
    // send one, because the kind decides which box is read.
    percent: input.kind === 'PERCENT' ? input.percent : 0,
    amount: input.kind === 'AMOUNT' ? input.amount : 0,
    minSpend: input.minSpend,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    maxRedemptions: input.maxRedemptions,
    perCustomer: input.perCustomer,
    note: input.note?.trim() || null,
  };

  const id = input.id
    ? (
        await prisma.coupon.update({
          where: { id: input.id },
          data,
          select: { id: true },
        })
      ).id
    : (
        await prisma.coupon.create({
          data: { ...data, createdByUserId: input.userId },
          select: { id: true },
        })
      ).id;

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.id ? 'coupon.updated' : 'coupon.created',
    entityType: 'Coupon',
    entityId: id,
    after: { code, kind: input.kind, percent: data.percent, amount: data.amount },
  });

  return id;
}

/** Stops a code being honoured. Codes already used keep their redemptions. */
export async function retireCoupon(input: {
  orgId: string;
  userId: string;
  id: string;
}): Promise<void> {
  const coupon = await prisma.coupon.findFirst({
    where: { id: input.id, orgId: input.orgId },
    select: { id: true, code: true, isActive: true },
  });

  if (!coupon) throw new CouponError('NOT_FOUND', 'That code is not in this workshop.');

  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { isActive: !coupon.isActive },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: coupon.isActive ? 'coupon.retired' : 'coupon.restored',
    entityType: 'Coupon',
    entityId: coupon.id,
    after: { code: coupon.code },
  });
}

/**
 * What a code is worth against this bill, without spending it.
 *
 * Used by the counter before the sale is taken and by the invoice page before
 * anybody presses anything, so the refusal arrives while the customer is
 * still standing there rather than after the money has moved.
 */
export async function quoteCoupon(input: {
  orgId: string;
  code: string;
  billMinor: number;
  owedMinor?: number;
  customerId?: string | null;
  now?: Date;
}): Promise<{ coupon: Coupon; discountMinor: number }> {
  const region = await regionFor(input.orgId);
  const code = normaliseCouponCode(input.code);

  if (!code) throw new CouponError('NO_CODE', 'Type the code the customer has.');

  const row = await prisma.coupon.findUnique({
    where: { orgId_code: { orgId: input.orgId, code } },
  });

  if (!row) {
    throw new CouponError('NOT_FOUND', `${code} is not a code this workshop has issued.`);
  }

  const coupon = asCoupon(row, region.currency);

  const usedByCustomer = input.customerId
    ? await prisma.couponRedemption.count({
        where: { couponId: coupon.id, customerId: input.customerId },
      })
    : 0;

  const discount = couponDiscount({
    coupon,
    bill: money(input.billMinor, region.currency),
    owed: money(input.owedMinor ?? input.billMinor, region.currency),
    usedByCustomer,
    now: input.now,
  });

  return { coupon, discountMinor: discount.minor };
}

/**
 * Redeems a code against an issued invoice.
 *
 * The invoice keeps the total it was issued at. What the code takes off is a
 * payment of its own kind, which posts to what the offers cost rather than to
 * the bank, and the customer's debt comes down by exactly that much.
 */
export async function redeemAgainstInvoice(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  code: string;
  now?: Date;
}): Promise<{ discountMinor: number; paymentId: string; code: string }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      customerId: true,
    },
  });

  if (!invoice) throw new CouponError('NOT_FOUND', 'That invoice is not in this workshop.');

  const billMinor = Math.round(Number(invoice.total) * 100);
  const owedMinor = billMinor - Math.round(Number(invoice.amountPaid) * 100);

  const { coupon, discountMinor } = await quoteCoupon({
    orgId: input.orgId,
    code: input.code,
    billMinor,
    owedMinor,
    customerId: invoice.customerId,
    now: input.now,
  });

  await ensureChartOfAccounts(input.orgId);

  // The redemption is written first and the counter moved in the same
  // transaction, so two people pressing at once cannot take one code twice:
  // the unique index on the coupon and the invoice refuses the second.
  await prisma.$transaction(async (tx) => {
    await tx.couponRedemption.create({
      data: {
        orgId: input.orgId,
        couponId: coupon.id,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        amount: discountMinor / 100,
        billed: Number(invoice.total),
        byUserId: input.userId,
      },
    });

    await tx.coupon.update({
      where: { id: coupon.id },
      data: { redeemed: { increment: 1 } },
    });
  });

  const paymentId = await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: invoice.id,
    amount: money(discountMinor, invoice.currency),
    method: 'COUPON',
    reference: coupon.code,
    notes: `Coupon ${coupon.code}`,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'coupon.redeemed',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: { code: coupon.code, discountMinor, invoice: invoice.number },
  });

  return { discountMinor, paymentId, code: coupon.code };
}

/**
 * Records that a code was used on a counter sale.
 *
 * Written inside the sale's own transaction, the way a gift card is spent, so
 * the sale and the redemption stand or fall together. A sale that rolled back
 * leaving the code marked used would refuse the customer their discount the
 * second time they tried.
 */
export async function recordCounterRedemption(
  tx: Pick<typeof prisma, 'couponRedemption' | 'coupon'>,
  input: {
    orgId: string;
    userId: string;
    couponId: string;
    counterSaleId: string;
    customerId?: string | null;
    discountMinor: number;
    billMinor: number;
  },
): Promise<void> {
  await tx.couponRedemption.create({
    data: {
      orgId: input.orgId,
      couponId: input.couponId,
      counterSaleId: input.counterSaleId,
      customerId: input.customerId ?? null,
      amount: input.discountMinor / 100,
      billed: input.billMinor / 100,
      byUserId: input.userId,
    },
  });

  await tx.coupon.update({
    where: { id: input.couponId },
    data: { redeemed: { increment: 1 } },
  });
}

/** What a code has done, for the page that lists them. */
export async function couponHistory(orgId: string, couponId: string) {
  return prisma.couponRedemption.findMany({
    where: { orgId, couponId },
    orderBy: { redeemedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      amount: true,
      billed: true,
      redeemedAt: true,
      customer: { select: { id: true, displayName: true } },
      invoice: { select: { id: true, number: true } },
      counterSale: { select: { id: true, reference: true } },
    },
  });
}

export { toNumber };
