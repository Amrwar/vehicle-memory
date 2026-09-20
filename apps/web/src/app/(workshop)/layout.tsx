import { landingPathFor, surfaceFor } from '@carnet/core';
import { prisma } from '@carnet/db';
import { redirect } from 'next/navigation';

import { Suspense } from 'react';

import { AccessNotice } from '@/components/access-notice';
import { WorkshopNav } from '@/components/workshop-nav';
import { requireSession } from '@/lib/guard';
import { currentLanguage, tFor } from '@/lib/i18n';
import { unreadNotifications } from '@/lib/search';

export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const { user, db } = await requireSession();
  const language = await currentLanguage();
  const t = await tFor();

  // A technician who reaches a workshop URL is sent to the shop floor rather
  // than shown an access-denied page. Their interface is different by design,
  // not by restriction (ADR-0009).
  if (surfaceFor(user.role) !== 'workshop') {
    redirect(landingPathFor(user.role));
  }

  // Nothing inside until the address is proven.
  //
  // Everything in here sends things in the workshop's name: quotes, invoices,
  // reminders to customers. An address nobody has confirmed is how a stranger
  // opens a business under somebody else's name and starts emailing from it.
  // Invited colleagues and seeded accounts arrive already confirmed, so the
  // only person who ever sees the holding page is the one who has just signed
  // up and has a link waiting in their inbox.
  const [approvalsWaiting, account, unread, workshop] = await Promise.all([
    db.job.count({ where: { status: 'AWAITING_APPROVAL' } }),
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { emailVerifiedAt: true },
    }),
    user.orgId ? unreadNotifications(user.orgId, user.userId) : Promise.resolve(0),
    user.orgId
      ? prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { isDemonstration: true },
        })
      : Promise.resolve(null),
  ]);

  if (!account?.emailVerifiedAt) redirect('/confirm-email');

  return (
    <div className="min-h-dvh">
      <WorkshopNav
        role={user.role}
        orgName={user.orgName ?? t('Workshop')}
        belongings={user.belongings.length}
        userName={user.name}
        approvalsWaiting={approvalsWaiting}
        language={language}
        unreadNotifications={unread}
      />
      <main id="main" tabIndex={-1} className="outline-none lg:ps-64">
        {/* A demonstration workshop says so on every screen, because somebody
            who forgets which one they are in will believe what they read.
            Phase 45. */}
        {workshop?.isDemonstration ? (
          <p className="border-b border-(--warning) bg-(--warning-soft) px-4 py-1.5 text-center text-[13px] font-medium text-(--warning)">
            {t('Demonstration workshop: none of this is real work.')}{' '}
            <a href="/start" className="underline underline-offset-2">
              {t('Go back to your own')}
            </a>
          </p>
        ) : null}
        <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-16 lg:px-8 lg:pt-8">
          {/* Reads searchParams, so it needs its own boundary or it would
              opt the whole layout out of static rendering. */}
          <Suspense fallback={null}>
            <AccessNotice />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
