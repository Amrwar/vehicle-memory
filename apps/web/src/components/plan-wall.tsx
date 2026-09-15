import { type FeatureKey, cheapestWith, describeFeature, PLANS, type PlanId } from '@carnet/core';
import { Button, Card, CardBody } from '@carnet/ui';
import Link from 'next/link';

import { tFor } from '@/lib/i18n';

import { StrandedCar } from './stranded-car';

/**
 * What somebody sees when their plan does not include a page.
 *
 * "Upgrade to continue" with no destination is the worst version of this
 * screen. A person who has hit a wall should learn three things in the
 * sentence that stops them: what they hit, which plan clears it, and what that
 * costs. Then they can decide, rather than going to find somebody to ask.
 *
 * The page is not hidden from the navigation and then broken here. The sidebar
 * filters by permission, which is about role; this is about plan, and the two
 * are different questions. A manager on Core genuinely has permission to see
 * the ledger. Their workshop has not bought one.
 */
export async function PlanWall({ feature, plan }: { feature: FeatureKey; plan: PlanId }) {
  const t = await tFor();
  const suggestion = cheapestWith(feature);
  const target = suggestion ? PLANS[suggestion] : null;
  const current = PLANS[plan];

  return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <div className="mx-auto max-w-sm">
        <StrandedCar />
      </div>

      <p className="eyebrow mt-6">{t('Not on this plan')}</p>
      <h1 className="mt-2 font-display text-[24px] font-semibold leading-tight tracking-tight">
        {capitalise(
          t('{feature} is not part of {plan}', {
            feature: t(describeFeature(feature)),
            plan: current.name,
          }),
        )}
      </h1>

      {target ? (
        <>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-(--text-soft)">
            {t(
              'It comes with {plan}, at £{price} per bay per month billed annually. Everything already in {current} stays exactly as it is.',
              { plan: target.name, price: target.price.minor / 100, current: current.name },
            )}
          </p>

          <Card className="mx-auto mt-6 max-w-md text-start">
            <CardBody>
              <p className="eyebrow mb-2.5">{t('{plan} adds', { plan: target.name })}</p>
              <ul className="grid gap-1.5">
                {target.headline.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent)" />
                    <span className="text-(--text-soft)">{t(line)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      ) : (
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-(--text-soft)">
          {t('This is not available on any plan yet.')}
        </p>
      )}

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/pricing">
          <Button variant="primary" size="lg">
            {t('Compare plans')}
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg">{t('Back to the workshop')}</Button>
        </Link>
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-(--text-faint)">
        {t(
          'Nothing you have recorded is affected by which plan you are on. The work, the invoices and every vehicle passport stay where they are.',
        )}
      </p>
    </div>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
