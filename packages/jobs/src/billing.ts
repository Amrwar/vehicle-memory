import { formatMinor, planPrice, TRIAL_DAYS, trialReminderDue } from '@carnet/core';
import { prisma } from '@carnet/db';

import { log } from './log';

/**
 * The trial reminder. Phase 32.6.
 *
 * Three days before a trial ends, the owner is told, in plain words, that
 * the card on file will be charged on the day it ends, what for and how
 * much, and how to cancel. Sent once. A trial that turns into a charge
 * without a warning is the thing this exists to prevent, and it is also
 * what the law in most places asks for.
 */
export async function remindTrialsEnding(now = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + 4 * 86_400_000);
  const orgs = await prisma.organization.findMany({
    where: {
      trialEndsAt: { gt: now, lte: soon },
      subscribedAt: null,
      cancelledAt: null,
      suspendedAt: null,
      trialReminderSentAt: null,
      billingSubscriptionRef: { not: null },
    },
    select: {
      id: true,
      name: true,
      plan: true,
      trialEndsAt: true,
      subscribedAt: true,
      cancelledAt: true,
      billingSubscriptionRef: true,
      billingCardBrand: true,
      billingCardLast4: true,
      locale: true,
      baseCurrency: true,
      locations: {
        where: { isActive: true },
        select: { _count: { select: { bays: { where: { isActive: true } } } } },
      },
      memberships: {
        where: { role: 'OWNER', isActive: true },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  let sent = 0;
  for (const org of orgs) {
    const due = trialReminderDue({
      trialEndsAt: org.trialEndsAt,
      subscribedAt: org.subscribedAt,
      cancelledAt: org.cancelledAt,
      cardOnFile: Boolean(org.billingSubscriptionRef),
      reminderSentAt: null,
      now,
    });
    const owner = org.memberships[0]?.user;
    if (!due || !owner || !org.trialEndsAt) continue;

    const ends = org.trialEndsAt.toLocaleDateString(org.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const bays = Math.max(
      1,
      org.locations.reduce((n, l) => n + l._count.bays, 0),
    );
    const price = planPrice(org.plan, org.baseCurrency, 'monthly');
    const amount = formatMinor(price.minor * bays, {
      currency: price.currency,
      locale: org.locale,
    });
    const card =
      org.billingCardBrand && org.billingCardLast4
        ? `the ${org.billingCardBrand} card ending ${org.billingCardLast4}`
        : 'the card on file';

    await prisma.messageLog.create({
      data: {
        orgId: org.id,
        channel: 'EMAIL',
        toAddress: owner.email,
        subject: `Your Carnet trial ends on ${ends}`,
        body: [
          `Hello ${owner.name.split(' ')[0]}.`,
          '',
          `The ${TRIAL_DAYS}-day free trial for ${org.name} ends on ${ends}. On that day ${card} is charged ${amount} for the first month of the ${org.plan.charAt(0) + org.plan.slice(1).toLowerCase()} plan (${bays} ${bays === 1 ? 'bay' : 'bays'}), and then each month until you cancel.`,
          '',
          'If you would rather not continue, cancel before then from Settings, Subscription, and nothing is charged. Everything you have put in stays readable and exportable either way.',
          '',
          'Carnet',
        ].join('\n'),
        status: 'QUEUED',
        relatedType: 'TrialReminder',
        relatedId: org.id,
      },
    });
    await prisma.organization.update({
      where: { id: org.id },
      data: { trialReminderSentAt: now },
    });
    sent += 1;
    log('billing.trial-reminder', { orgId: org.id });
  }
  return sent;
}
