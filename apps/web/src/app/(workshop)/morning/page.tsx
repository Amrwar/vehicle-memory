import { COST_SENTENCE, howTheMorningLooks } from '@carnet/core';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { doNotMiss } from '@/lib/do-not-miss';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Do not miss') };
}
export const dynamic = 'force-dynamic';

/*
 * The badge descends with the ranking: danger, warning, info, neutral. Money
 * and the record were both neutral for a draft, which made two different
 * costs look like the same cost -- and the order of the list is the one thing
 * this screen is arguing. The word is in the badge as well as the colour,
 * because nothing in this product lets colour carry a meaning alone.
 */
const TONE = {
  SAFETY: 'danger',
  A_PROMISE: 'warning',
  MONEY: 'info',
  THE_RECORD: 'neutral',
} as const;

/**
 * The list you clear before you open anything else.
 *
 * Everything on it was already somewhere: `/now` says whose move a job is, the
 * plan names a booking that cannot be kept, the equipment screen names a
 * lapsed certificate. The screens were never the problem — the problem was
 * that reading all of them is not a morning.
 *
 * Two rules decide what this looks like.
 *
 * **Every row is one action**, as a verb, with somewhere to do it. A row that
 * said "3 invoices are overdue" would be a number, and a number leaves the
 * reader to work out what to do — which they do tomorrow instead.
 *
 * **It must be possible to reach the end.** So it is capped, and what is
 * behind the cap is said rather than hidden. A workshop with sixty things has
 * a problem this screen cannot solve, and showing eight would be the screen
 * lying to look calm.
 *
 * Phase 95.
 */
export default async function MorningPage() {
  const { orgId, region } = await requireSession('job:read');
  const t = await tFor();
  const list = await doNotMiss(orgId);
  const top = howTheMorningLooks(list);

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Do not miss')}
        description={t(
          'What acting on this morning changes. Ordered by what it costs to miss, and short enough to finish.',
        )}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-medium">{t(top.key, top.vars)}</span>
        {list.byCost.map((row) => (
          <Badge key={row.cost} tone={TONE[row.cost]}>
            {t('{count} · {cost}', { count: row.count, cost: t(COST_SENTENCE[row.cost]) })}
          </Badge>
        ))}
      </div>

      {list.clear ? (
        <Card className="mt-5">
          <CardBody className="py-10 text-center">
            <p className="font-display text-[18px] font-semibold">
              {t('Nothing to miss this morning.')}
            </p>
            <p className="mt-2 text-[13px] text-(--text-faint)">
              {t('Nothing is late, nothing is unusable, and nothing is waiting on somebody here.')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardHeader
            title={t('In the order they cost to miss')}
            description={t('Each one is a single thing to do.')}
          />
          <CardBody className="grid gap-1.5 p-3">
            {list.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-3 text-[13px] transition-colors hover:bg-(--surface-sunk) pointer-coarse:min-h-12"
              >
                <Badge tone={TONE[item.cost]}>{t(COST_SENTENCE[item.cost])}</Badge>
                <span className="min-w-0 flex-1">
                  {item.subject ? (
                    <bdi className="datum me-1.5 font-medium">{item.subject}</bdi>
                  ) : null}
                  <bdi>{t(item.what.key, item.what.vars)}</bdi>
                </span>
                {item.when ? (
                  <span className="datum text-[11px] text-(--text-faint)">
                    {item.when.toLocaleDateString(region.locale)}
                  </span>
                ) : null}
                <span className="font-medium text-(--brand-text)">{t(item.action.key)}</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {list.more > 0 ? (
        <p className="mt-3 text-[13px] text-(--text-faint)">
          {t(
            'And {count} more behind these. That is more than a morning: the ones above are the ones that cost most to miss.',
            { count: list.more },
          )}
        </p>
      ) : null}
    </>
  );
}
