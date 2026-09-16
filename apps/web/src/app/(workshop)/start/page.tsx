import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, requireSession } from '@/lib/guard';
import {
  createDemonstration,
  demonstrationFor,
  removeDemonstration,
  switchWorkshop,
  workshopsFor,
} from '@/lib/demonstration';
import { tFor } from '@/lib/i18n';
import { setSetupHidden, setupFor } from '@/lib/onboarding';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Getting started') };
}
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * The first day. FR-7601.
 *
 * A workshop signs up and has forty screens and no work in any of them. This
 * page is the answer to "what now": what is left to set up, read from the
 * workshop's own data rather than from ticks somebody pressed, and a
 * demonstration workshop to look around while deciding.
 *
 * Every step says why it matters. A checklist that only names things teaches
 * somebody the order to click in; one that says why teaches them what the
 * product is for.
 */
async function hide() {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await setSetupHidden({ orgId, userId: user.userId, hidden: true });
  redirect('/dashboard');
}

async function show() {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await setSetupHidden({ orgId, userId: user.userId, hidden: false });
  redirect('/start');
}

/** Builds the demonstration, and moves this session into it. */
async function buildDemonstration() {
  'use server';

  // Building or removing a demonstration is a decision about the workshop
  // itself, so it asks for the permission that settings ask for.
  const { user } = await requireSession('settings:write');
  const { orgId } = await createDemonstration({ userId: user.userId });
  await switchWorkshop({ userId: user.userId, sessionId: user.sessionId, orgId });
  redirect('/dashboard?demonstration=1');
}

async function moveTo(formData: FormData) {
  'use server';

  const { user } = await requireSession();
  await switchWorkshop({
    userId: user.userId,
    sessionId: user.sessionId,
    orgId: String(formData.get('orgId') ?? ''),
  });
  redirect('/dashboard');
}

async function removeIt(formData: FormData) {
  'use server';

  const { user } = await requireSession('settings:write');
  const orgId = String(formData.get('orgId') ?? '');
  await removeDemonstration({ userId: user.userId, orgId });
  redirect('/start?removed=1');
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const { orgId, user } = await requireSession();
  const t = await tFor();
  const { removed } = await searchParams;

  const [setup, demonstration, workshops] = await Promise.all([
    setupFor(orgId),
    demonstrationFor(user.userId),
    workshopsFor(user.userId),
  ]);

  const mayConfigure = can(user.role, 'settings:write');
  const inDemonstration = workshops.find((shop) => shop.id === orgId)?.isDemonstration ?? false;
  const own = workshops.find((shop) => !shop.isDemonstration);

  return (
    <>
      <PageHeader
        eyebrow={t('Getting started')}
        title={t('What to do next')}
        description={t(
          'Read from your own workshop, so nothing here is ticked off until it is true',
        )}
        actions={
          <Link href="/help">
            <Button>{t('Help')}</Button>
          </Link>
        }
      />

      {removed ? (
        <Alert tone="info" className="mb-5">
          {t('The demonstration workshop and everything in it has been removed.')}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('The setup list')}
            description={t('{done} of {total} done', { done: setup.done, total: setup.total })}
            action={
              <span className="font-display text-[20px] font-semibold tabular-nums">
                {t('{percent}%', { percent: setup.percent })}
              </span>
            }
          />
          <ul className="divide-y divide-(--border)">
            {setup.steps.map((step) => (
              <li key={step.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                    step.done
                      ? 'border-(--success) bg-(--success) text-(--on-brand-solid)'
                      : 'border-(--border-strong) text-(--text-faint)'
                  }`}
                >
                  {step.done ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[14px] font-medium ${step.done ? 'text-(--text-faint) line-through' : ''}`}
                    >
                      {t(step.title)}
                    </span>
                    {step.essential && !step.done ? (
                      <Badge tone="warning" size="sm">
                        {t('needed first')}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-(--text-soft)">
                    {t(step.why)}
                  </span>
                </span>
                {step.done ? null : (
                  <Link href={step.href}>
                    <Button size="sm" variant="secondary">
                      {t('Do it')}
                    </Button>
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {mayConfigure ? (
            <CardBody className="border-t border-(--border)">
              <form action={setup.hidden ? show : hide}>
                <Button type="submit" size="sm" variant="ghost">
                  {setup.hidden ? t('Show this on the dashboard') : t('Put the list away')}
                </Button>
              </form>
            </CardBody>
          ) : null}
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader
              title={t('A workshop to look around')}
              description={t(
                'A second workshop, full of made-up work: a year of jobs, invoices, parts and vehicle histories. Nothing in it is yours, and it can be removed whole.',
              )}
            />
            <CardBody className="grid gap-3 text-[13px]">
              {inDemonstration ? (
                <>
                  <p className="font-medium">{t('You are in the demonstration now.')}</p>
                  {own ? (
                    <form action={moveTo}>
                      <input type="hidden" name="orgId" value={own.id} />
                      <Button type="submit" variant="primary" size="sm">
                        {t('Back to {name}', { name: own.name })}
                      </Button>
                    </form>
                  ) : null}
                </>
              ) : demonstration ? (
                <>
                  <p>{t('It is built and waiting.')}</p>
                  <div className="flex flex-wrap gap-2">
                    <form action={moveTo}>
                      <input type="hidden" name="orgId" value={demonstration.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        {t('Look around it')}
                      </Button>
                    </form>
                    <form action={removeIt}>
                      <input type="hidden" name="orgId" value={demonstration.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t('Remove it')}
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    {t(
                      'It takes about half a minute to build, because the work is put through the product the way real work is.',
                    )}
                  </p>
                  <form action={buildDemonstration}>
                    <Button type="submit" variant="secondary" size="sm">
                      {t('Build it and take me there')}
                    </Button>
                  </form>
                </>
              )}
              <p className="text-[12px] text-(--text-faint)">
                {t('Its customers are invented and nothing it writes is ever sent to anybody.')}
              </p>
            </CardBody>
          </Card>

          {workshops.length > 1 ? (
            <Card className="overflow-hidden">
              <CardHeader title={t('Your workshops')} />
              <ul className="divide-y divide-(--border)">
                {workshops.map((shop) => (
                  <li
                    key={shop.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]"
                  >
                    <bdi className="font-medium">{shop.name}</bdi>
                    {shop.isDemonstration ? (
                      <Badge tone="warning" size="sm">
                        {t('demonstration')}
                      </Badge>
                    ) : null}
                    {shop.id === orgId ? (
                      <span className="ms-auto text-[12px] text-(--text-faint)">
                        {t('you are here')}
                      </span>
                    ) : (
                      <form action={moveTo} className="ms-auto">
                        <input type="hidden" name="orgId" value={shop.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {t('Move here')}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">{t('Where the help is')}</p>
              <p>
                {t(
                  'Twelve short pages, one for each part of the product, searchable from the box at the top of every screen along with everything else.',
                )}
              </p>
              <Link href="/help" className="text-(--brand-text) underline underline-offset-2">
                {t('Read the help')}
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
