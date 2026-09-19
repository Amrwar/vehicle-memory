import { type Capability, type Uptake } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * What the workshop actually used. Phase 54.
 *
 * Counted from the audit log, which has been recording every write since the
 * first phase and was never read for this. Nothing new is instrumented: a
 * product that adds a tracker in order to measure its pilot is measuring the
 * tracker.
 *
 * The capabilities below are named the way somebody in a workshop would name
 * them rather than the way the code is organised, because the question at the
 * end of four weeks is "did you use the gift cards", not "were there writes
 * against giftcard.sold".
 *
 * `expected` is the judgement that makes the list worth reading. Most of this
 * product is optional — a garage with no fleet customers should not be marked
 * down for never opening the fleet pages — and a handful is not: a workshop
 * that never issued an invoice in four weeks was not using the product, and
 * that is a finding rather than a preference.
 */

const CAPABILITIES: Capability[] = [
  // --- the day, which a workshop cannot not use ---------------------------
  {
    name: 'Booking work in',
    area: 'The day',
    expected: true,
    actions: ['booking.created', 'booking.requested', 'booking.converted', 'booking.moved'],
  },
  { name: 'Opening jobs', area: 'The day', expected: true, actions: ['job.created'] },
  {
    name: 'Moving work along',
    area: 'The day',
    expected: true,
    actions: [
      'job.in_progress',
      'job.completed',
      'job.cancelled',
      'job.clock.started',
      'job.clock.stopped',
    ],
  },
  {
    name: 'Checking cars in and out',
    area: 'The day',
    expected: true,
    actions: ['vehicle.registered', 'vehicle.adopted'],
  },
  { name: 'Planning the day', area: 'The day', expected: false, actions: ['plan.accepted'] },

  // --- finding and quoting work -------------------------------------------
  {
    name: 'Inspections',
    area: 'Finding work',
    expected: true,
    actions: ['inspection.started', 'inspection.completed', 'inspection.photo.added'],
  },
  {
    name: 'Quotes',
    area: 'Finding work',
    expected: true,
    actions: ['estimate.sent', 'estimate.decided'],
  },
  {
    name: 'Warranty',
    area: 'Finding work',
    expected: false,
    actions: ['warranty.recorded', 'warranty.claim.raised'],
  },
  {
    name: 'Recalls and fitments',
    area: 'Finding work',
    expected: false,
    actions: ['fitment.recorded', 'fitment.removed'],
  },

  // --- money ---------------------------------------------------------------
  { name: 'Invoicing', area: 'Money', expected: true, actions: ['invoice.issued'] },
  {
    name: 'Taking payment',
    area: 'Money',
    expected: true,
    actions: ['payment.recorded', 'payment.attempt.started', 'payment.attempt.succeeded'],
  },
  {
    name: 'Credit notes and refunds',
    area: 'Money',
    expected: false,
    actions: ['creditnote.raised', 'refund.recorded'],
  },
  {
    name: 'Money held for customers',
    area: 'Money',
    expected: false,
    actions: ['deposit.taken', 'deposit.applied', 'deposit.returned'],
  },
  {
    name: 'Gift cards',
    area: 'Money',
    expected: false,
    actions: ['giftcard.sold', 'giftcard.redeemed', 'giftcard.adjusted', 'giftcard.cancelled'],
  },
  {
    name: 'The counter',
    area: 'Money',
    expected: false,
    actions: ['countersale.completed', 'till.closed'],
  },
  { name: 'Coupons', area: 'Money', expected: false, actions: ['coupon.redeemed'] },
  {
    name: 'Points and referrals',
    area: 'Money',
    expected: false,
    actions: [
      'loyalty.awarded',
      'loyalty.redeemed',
      'referral.issued',
      'referral.used',
      'referral.credited',
    ],
  },

  // --- the books -----------------------------------------------------------
  {
    name: 'Expenses',
    area: 'The books',
    expected: false,
    actions: ['expense.recorded', 'expense.approved'],
  },
  { name: 'Reconciling the bank', area: 'The books', expected: false, actions: ['bank.matched'] },
  { name: 'Closing a period', area: 'The books', expected: false, actions: ['period.closed'] },
  {
    name: 'Suppliers owed',
    area: 'The books',
    expected: false,
    actions: [
      'supplierbill.booked',
      'supplierbill.approved',
      'supplierbill.disputed',
      'supplier.paid',
    ],
  },

  // --- parts ---------------------------------------------------------------
  {
    name: 'Ordering parts',
    area: 'Parts',
    expected: true,
    actions: ['purchase.requested', 'supplier.created'],
  },
  {
    name: 'Sublet work',
    area: 'Parts',
    expected: false,
    actions: ['sublet.ordered', 'sublet.done', 'sublet.billed'],
  },
  {
    name: 'Returns',
    area: 'Parts',
    expected: false,
    actions: ['return.sent', 'return.credited', 'return.refused'],
  },
  { name: 'Stock between sites', area: 'Parts', expected: false, actions: ['transfer.started'] },
  { name: 'The parts catalogue', area: 'Parts', expected: false, actions: ['product.created'] },

  // --- the customer --------------------------------------------------------
  {
    name: 'Customers',
    area: 'The customer',
    expected: true,
    actions: ['customer.created', 'customer.updated', 'customer.registered'],
  },
  {
    name: 'Talking to customers',
    area: 'The customer',
    expected: true,
    actions: ['conversation.replied', 'conversation.assigned', 'template.saved'],
  },
  {
    name: 'Asking for reviews',
    area: 'The customer',
    expected: false,
    actions: ['review.asked', 'review.answered', 'review.resolved'],
  },
  {
    name: 'Campaigns',
    area: 'The customer',
    expected: false,
    actions: ['campaign.drafted', 'campaign.sent'],
  },
  {
    name: 'Fleets',
    area: 'The customer',
    expected: false,
    actions: ['fleet.agreement.saved', 'fleet.invoiced'],
  },

  // --- the passport --------------------------------------------------------
  {
    name: 'Sharing a passport',
    area: 'The passport',
    expected: false,
    actions: ['passport.shared', 'passport.share.revoked'],
  },
  {
    name: 'Correcting a passport',
    area: 'The passport',
    expected: false,
    actions: ['passport.corrected'],
  },
  {
    name: "The car's paperwork",
    area: 'The passport',
    expected: false,
    actions: ['vehicle.document.added', 'vehicle.document.removed'],
  },
  {
    name: 'Changing keeper',
    area: 'The passport',
    expected: false,
    actions: ['vehicle.transferred', 'vehicle.claim.asked'],
  },

  // --- the workshop itself -------------------------------------------------
  {
    name: 'People and pay',
    area: 'The workshop',
    expected: false,
    actions: [
      'timesheet.submitted',
      'timesheet.approved',
      'payroll.paid',
      'payroll.exported',
      'skill.added',
    ],
  },
  {
    name: 'Settings',
    area: 'The workshop',
    expected: true,
    actions: [
      'settings.organisation',
      'settings.site',
      'settings.bay',
      'settings.jobtype',
      'settings.taxrate',
      'settings.taxrate.default',
      'settings.numbering',
    ],
  },
  {
    name: 'The team',
    area: 'The workshop',
    expected: false,
    actions: [
      'invitation.sent',
      'invitation.accepted',
      'invitation.revoked',
      'membership.deactivated',
    ],
  },
  {
    name: 'Bringing data in',
    area: 'The workshop',
    expected: false,
    actions: ['import.uploaded', 'import.ran'],
  },
  { name: 'The assistant', area: 'The workshop', expected: false, actions: ['assistant.exchange'] },
  { name: 'Working offline', area: 'The workshop', expected: false, actions: ['offline.synced'] },
];

/** What each capability saw, over a window. */
export async function uptakeFor(orgId: string, since: Date, until = new Date()): Promise<Uptake[]> {
  const rows = await prisma.auditLog.groupBy({
    by: ['action', 'actorUserId'],
    where: { orgId, createdAt: { gte: since, lte: until } },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return CAPABILITIES.map((surface) => {
    const mine = rows.filter((row) => surface.actions.includes(row.action));

    const people = new Set(
      mine.map((row) => row.actorUserId).filter((id): id is string => id !== null),
    );

    const last = mine
      .map((row) => row._max.createdAt)
      .filter((at): at is Date => at !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      surface,
      times: mine.reduce((total, row) => total + row._count._all, 0),
      // An action with no actor is the product acting on the workshop's behalf
      // — a sweep, a webhook — and counting it as a person would be wrong.
      people: people.size,
      last: last ?? null,
    };
  });
}

/** Every capability the product knows how to count, whether used or not. */
export function capabilities(): readonly Capability[] {
  return CAPABILITIES;
}

/**
 * Every audited action the register does not mention.
 *
 * A capability added next month with no place in this list would be invisible
 * at the debrief, and invisible is the one thing the "what nobody used" list
 * cannot afford to be. So the register is checked against the audit log rather
 * than trusted.
 */
export async function unmapped(orgId: string, since: Date): Promise<string[]> {
  const rows = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { orgId, createdAt: { gte: since } },
  });

  const known = new Set(CAPABILITIES.flatMap((one) => one.actions));

  return rows
    .map((row) => row.action)
    .filter((action) => !known.has(action))
    .sort();
}
