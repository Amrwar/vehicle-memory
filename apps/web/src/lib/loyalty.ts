import {
  assertPaymentRecordable,
  fromDecimal,
  type InvoiceState,
  LoyaltyError,
  money,
  pointsFor,
  valueOf,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts } from './accounting';
import { audit } from './guard';
import { recordPayment } from './money';
import { awardForInvoice, awardPoints, loyaltyFor, redeemPoints } from './retention';

export { awardForInvoice, LoyaltyError };

/**
 * Points, in the product. Phase 24.
 *
 * The programme existed since Phase 5 as arithmetic and rows; nothing awarded
 * a point and nothing let anybody spend one. Now a bill paid in full earns a
 * point a pound, once, and points come off a bill as a payment of their own
 * kind, which the ledger books as the cost of the programme rather than as
 * money in. A person still presses the button that spends them.
 */

/** The most points anybody hands out in one go without a conversation first. */
export const HAND_AWARD_CEILING = 100_000;

/** Points given by hand, with a reason: a goodwill gesture, a referral honoured. */
export async function awardByHand(input: {
  orgId: string;
  userId: string;
  customerId: string;
  points: number;
  reason: string;
}): Promise<void> {
  if (!Number.isInteger(input.points) || input.points <= 0 || input.points > HAND_AWARD_CEILING) {
    throw new LoyaltyError('NOTHING_TO_AWARD', 'Say how many points, as a whole number.');
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new LoyaltyError('NOTHING_TO_AWARD', 'Say why. The reason is what the customer sees.');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true },
  });
  if (!customer)
    throw new LoyaltyError('NOTHING_TO_AWARD', 'That customer is not in this workshop.');

  await awardPoints({
    orgId: input.orgId,
    userId: input.userId,
    customerId: customer.id,
    amountMinor: input.points * 100,
    reason,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'loyalty.awarded',
    entityType: 'Customer',
    entityId: customer.id,
    after: { points: input.points, reason },
  });
}

/**
 * Points come off a bill as a payment of kind LOYALTY, which the ledger books
 * against the programme's cost account.
 *
 * The bill is checked first with the same rule every other payment meets, so
 * a voided or unissued invoice is refused before a point is spent. Then the
 * spend is recorded, then the payment: a failure between the two leaves
 * points spent against nothing, which is a row somebody can see and undo,
 * rather than a bill paid twice, which is a figure nobody can. Both are
 * audited.
 */
export async function redeemAgainstInvoice(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  points: number;
}): Promise<{ valueMinor: number; paymentId: string }> {
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
      jobId: true,
    },
  });
  if (!invoice) throw new LoyaltyError('NOTHING_TO_AWARD', 'That invoice is not in this workshop.');

  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new LoyaltyError('NOTHING_TO_AWARD', 'Say how many points to use, as a whole number.');
  }

  const owedMinor = Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100);
  if (owedMinor <= 0) throw new LoyaltyError('NOT_ENOUGH', 'Nothing is owed on that invoice.');

  // The refusal a card payment would get, before anything is spent. Throws a
  // MoneyCycleError, which the page shows the same way.
  assertPaymentRecordable(
    {
      status: invoice.status as InvoiceState,
      total: fromDecimal(invoice.total.toString(), invoice.currency),
      amountPaid: fromDecimal(invoice.amountPaid.toString(), invoice.currency),
    },
    money(valueOf(input.points), invoice.currency),
  );

  await ensureChartOfAccounts(input.orgId);

  const valueMinor = await redeemPoints({
    orgId: input.orgId,
    userId: input.userId,
    customerId: invoice.customerId,
    points: input.points,
    owedMinor,
    jobId: invoice.jobId,
  });

  const paymentId = await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId: invoice.id,
    amount: money(valueMinor, invoice.currency),
    method: 'LOYALTY',
    reference: `${input.points} points`,
    notes: 'Loyalty points redeemed',
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'loyalty.redeemed',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: { points: input.points, valueMinor, invoice: invoice.number },
  });

  return { valueMinor, paymentId };
}

/** The card on a customer's page: balance, what is lapsing, the last few entries. */
export async function loyaltyCardFor(orgId: string, customerId: string) {
  const held = await loyaltyFor(orgId, customerId);
  return {
    balance: held.balance,
    valueMinor: valueOf(held.balance),
    expiring: held.expiring,
    recent: held.entries.slice(0, 6),
    perPound: pointsFor(100),
  };
}

/**
 * What a customer could put towards a bill: the fewer of what they hold and
 * what is owed, since points never pay out as money.
 */
export function spendableAgainst(balance: number, owedMinor: number): number {
  if (balance <= 0 || owedMinor <= 0) return 0;
  return Math.min(balance, owedMinor);
}

/** What the person signed into the portal holds, at each workshop that knows them. */
export async function pointsForPortalUser(userId: string) {
  const customers = await prisma.customer.findMany({
    where: { portalUserId: userId },
    select: {
      id: true,
      orgId: true,
      org: { select: { name: true, baseCurrency: true, locale: true } },
    },
  });

  const cards = await Promise.all(
    customers.map(async (customer) => {
      const held = await loyaltyFor(customer.orgId, customer.id);
      return {
        customerId: customer.id,
        workshop: customer.org.name,
        currency: customer.org.baseCurrency,
        locale: customer.org.locale,
        balance: held.balance,
        valueMinor: valueOf(held.balance),
        expiring: held.expiring,
      };
    }),
  );

  return cards.filter((card) => card.balance > 0 || card.expiring.points > 0);
}

/** How a payment's method reads to a person. Points are not "loyalty". */
export function methodLabel(method: string): string {
  if (method === 'LOYALTY') return 'points';
  return method.toLowerCase().replace(/_/g, ' ');
}
