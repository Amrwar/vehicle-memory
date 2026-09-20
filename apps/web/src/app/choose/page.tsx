import { describeChoice, humaniseRole } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { enterWorkshop, workshopsFor } from '@/lib/belonging';
import { requireUser } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Which workshop am I in? Phase 63. FR-108, FR-9801.
 *
 * A contractor services two garages on alternate days; a bookkeeper keeps the
 * books for four. The schema has allowed that since the first month and the
 * product had nowhere to ask about it, so it guessed — `memberships[0]`, in
 * whatever order the database returned.
 *
 * This is the question instead. It is asked once, at sign-in, and after that
 * the answer lives on the session until the person changes it: a page load is
 * not a decision and must never be treated as one.
 *
 * Deliberately outside the workshop layout. That layout needs an organisation
 * to render its navigation — the workshop's name, its initials, what the
 * person may see in it — and the whole point of this page is that there is no
 * organisation yet.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Which workshop?') };
}

function safeNext(value: string | undefined): string | null {
  // Same rule as the login page: our own paths only, never protocol-relative.
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

async function enter(formData: FormData) {
  'use server';

  const user = await requireUser();
  const onwards = safeNext(String(formData.get('next') ?? '') || undefined);

  await enterWorkshop({
    userId: user.userId,
    sessionId: user.sessionId,
    orgId: String(formData.get('orgId') ?? ''),
  });

  redirect(onwards ?? '/dashboard');
}

export default async function ChoosePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const { next } = await searchParams;
  const onwards = safeNext(next);

  const workshops = await workshopsFor(user.userId);

  // Nobody's team: they are a customer, and the portal is their surface.
  if (workshops.length === 0) redirect('/portal');

  // One workshop is not a choice, and asking about it would be ceremony.
  // Reached by typing the address, or by arriving here from a page that was
  // right to send them at the time.
  if (workshops.length === 1) {
    await enterWorkshop({
      userId: user.userId,
      sessionId: user.sessionId,
      orgId: workshops[0]!.orgId,
    });
    redirect(onwards ?? '/dashboard');
  }

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-(--ground) px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader title={t('Which workshop?')} description={t(describeChoice(workshops))} />

          <ul className="divide-y divide-(--border)">
            {workshops.map((shop) => (
              <li key={shop.orgId}>
                <form action={enter}>
                  <input type="hidden" name="orgId" value={shop.orgId} />
                  {onwards ? <input type="hidden" name="next" value={onwards} /> : null}

                  <Button
                    type="submit"
                    variant="ghost"
                    className="flex w-full items-center gap-3 rounded-none px-4 py-3 text-start"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--brand-solid) font-display text-[13px] font-bold text-(--on-brand-solid)"
                    >
                      {shop.orgName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join('')
                        .toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <bdi className="block truncate font-medium">{shop.orgName}</bdi>
                      <span className="block text-[12px] text-(--text-faint)">
                        {t(humaniseRole(shop.role))}
                      </span>
                    </span>

                    {shop.isDemonstration ? (
                      <Badge tone="warning" size="sm">
                        {t('demonstration')}
                      </Badge>
                    ) : null}
                  </Button>
                </form>
              </li>
            ))}
          </ul>

          <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
            {t('You can move between them at any time from the workshop’s name.')}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
