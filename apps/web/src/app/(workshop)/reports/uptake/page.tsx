import { describeTakeUp, type Uptake, uptakeVerdictOf, worthAsking } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { uptakeFor } from '@/lib/pilot';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('What you are using') };
}
export const dynamic = 'force-dynamic';

const RANGES = [30, 90, 365] as const;

/**
 * What the workshop is and is not using. FR-8901. Phase 54.
 *
 * Written for the pilot's fourth list — what nobody used — and useful well
 * beyond it. A workshop paying for a product with this much in it should be
 * able to see what it is not getting, and the honest version of that question
 * is not "which pages were opened" but "which capabilities has anybody here
 * actually put to work".
 *
 * Counted from the audit log, which has recorded every write since the first
 * phase. Nothing is instrumented for this: a product that adds a tracker in
 * order to measure itself is measuring the tracker.
 *
 * The limit is stated on the page rather than buried here, because it is the
 * sort of thing somebody would otherwise discover after acting on the figure.
 * This counts writing, not looking. A workshop that opens a passport forty
 * times a week and never adds to it reads here as never having used it.
 */
export default async function UptakePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { orgId } = await requireSession('report:operational');
  const t = await tFor();

  const { days } = await searchParams;
  const window = RANGES.includes(Number(days) as (typeof RANGES)[number]) ? Number(days) : 90;

  const uptake = await uptakeFor(orgId, new Date(Date.now() - window * 86_400_000));
  const ask = worthAsking(uptake);

  const counted = (verdict: string) =>
    uptake.filter((one) => uptakeVerdictOf(one) === verdict).length;

  const tone = (one: Uptake) => {
    const verdict = uptakeVerdictOf(one);
    return verdict === 'untouched'
      ? 'danger'
      : verdict === 'one pair of hands'
        ? 'warning'
        : verdict === 'taken up'
          ? 'success'
          : 'neutral';
  };

  const said = (one: Uptake) => {
    const verdict = uptakeVerdictOf(one);
    return verdict === 'untouched'
      ? t('Nobody has')
      : verdict === 'one pair of hands'
        ? t('One pair of hands')
        : verdict === 'taken up'
          ? t('In use')
          : t('Not for you');
  };

  const areas = [...new Set(uptake.map((one) => one.surface.area))];

  return (
    <>
      <PageHeader
        eyebrow={t('Business')}
        title={t('What you are using')}
        description={t('And what you are paying for and have not touched')}
        actions={
          <>
            {RANGES.map((option) => (
              <Link key={option} href={`/reports/uptake?days=${option}`}>
                <Badge tone={option === window ? 'brand' : 'neutral'}>
                  {t('{days} days', { days: option })}
                </Badge>
              </Link>
            ))}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('In use')}
          value={counted('taken up')}
          tone="success"
          note={t('More than one person, more than once')}
        />
        <StatTile
          label={t('One pair of hands')}
          value={counted('one pair of hands')}
          tone="warning"
          note={t('One person, or barely')}
        />
        <StatTile
          label={t('Nobody has')}
          value={counted('untouched')}
          tone={counted('untouched') === 0 ? 'success' : 'danger'}
          note={t('And it is the sort of thing most workshops use')}
        />
      </StatRow>

      {ask.length > 0 ? (
        <Card className="mb-5 overflow-hidden">
          <CardHeader
            title={t('Worth a conversation')}
            description={t('What nobody has used, and what only one person has')}
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What')}</Th>
                  <Th numeric>{t('Times')}</Th>
                  <Th numeric>{t('People')}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {ask.map((one) => (
                  <Tr key={one.surface.name}>
                    <Td>
                      <span className="font-medium">{t(one.surface.name)}</span>
                      <span className="block text-[12px] text-(--text-faint)">
                        {t(one.surface.area)}
                      </span>
                    </Td>
                    <Td numeric className="tabular">
                      {one.times}
                    </Td>
                    <Td numeric className="tabular">
                      {one.people}
                    </Td>
                    <Td>
                      <Badge tone={tone(one)}>{said(one)}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {areas.map((area) => (
          <Card key={area} className="overflow-hidden">
            <CardHeader title={t(area)} />
            <CardBody className="py-1">
              {uptake
                .filter((one) => one.surface.area === area)
                .map((one) => (
                  <div
                    key={one.surface.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-(--line) py-2.5 last:border-0"
                  >
                    <span className="text-[13px] font-medium">{t(one.surface.name)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-[12px] text-(--text-soft)">
                        {t('{times} times', { times: one.times })}
                      </span>
                      <Badge tone={tone(one)}>{said(one)}</Badge>
                    </span>
                  </div>
                ))}
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          <p>{t(describeTakeUp(uptake))}</p>
          <p className="mt-2">
            {t(
              'This counts what people did, not what they looked at. Opening a car’s history forty times and never adding to it reads here as never having used it — nothing records who looked at what, deliberately, because a record of that is a record of being watched.',
            )}
          </p>
        </CardBody>
      </Card>
    </>
  );
}
