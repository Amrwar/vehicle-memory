import {
  coverage,
  type Measured,
  medianSeconds,
  secondsAs,
  slowestTenth,
  verdictOf,
  worstStretchesFirst,
} from '@carnet/core';
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

import { workshopClock } from '@/lib/clock';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('How long things take') };
}
export const dynamic = 'force-dynamic';

const RANGES = [30, 90, 365] as const;

/**
 * The workshop's own clock. FR-8701. Phase 52.
 *
 * Every other report says what the work was worth. This says how long it took,
 * which is the number a workshop can actually do something about on Monday:
 * revenue is the consequence of a hundred decisions and a market, and the gap
 * between a car arriving and a job being written is one person's morning.
 *
 * Two things here are deliberate and easy to get wrong.
 *
 * It shows the median rather than the average, because one car left over a
 * bank holiday adds three days to an average and tells nobody anything. And it
 * shows the slowest tenth beside it, because a median of twenty minutes with a
 * ninetieth percentile of two days is a process that works and something that
 * regularly escapes it — which is where the complaints come from and what the
 * median on its own hides completely.
 *
 * And it says how much it could measure. A stretch it saw four times is shown
 * as unmeasured rather than as a figure, because a median over four jobs is an
 * anecdote with a decimal point, and a workshop that acts on one will be
 * acting on nothing.
 */
export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { orgId } = await requireSession('report:operational');
  const t = await tFor();

  const { days } = await searchParams;
  // A year by default, not a quarter. This is a report about how the work
  // flows rather than about this week's trading, and the figures it reports
  // refuse to speak below five jobs — so a short window on a small workshop
  // produces a page of "too few" that says nothing anybody can act on.
  const window = RANGES.includes(Number(days) as (typeof RANGES)[number]) ? Number(days) : 365;

  const clock = await workshopClock(orgId, new Date(Date.now() - window * 86_400_000));
  const ordered = worstStretchesFirst(clock);

  const slow = clock.filter((one) => verdictOf(one) === 'slow').length;
  const unknown = clock.filter((one) => verdictOf(one) === 'unknown').length;

  const tone = (one: Measured) => {
    const verdict = verdictOf(one);
    return verdict === 'slow' ? 'danger' : verdict === 'unknown' ? 'neutral' : 'success';
  };

  // The figure and its unit are one phrase with a slot in it, because "9" and
  // "minutes" do not join the same way in every language.
  const duration = (seconds: number) => {
    const { template, values } = secondsAs(seconds);
    return t(template, values);
  };

  const said = (one: Measured) => {
    const verdict = verdictOf(one);
    return verdict === 'slow' ? t('Slower') : verdict === 'unknown' ? t('Too few') : t('Fine');
  };

  return (
    <>
      <PageHeader
        eyebrow={t('Business')}
        title={t('How long things take')}
        description={t('Your own clock, from the records of the work itself')}
        actions={
          <>
            {RANGES.map((option) => (
              <Link key={option} href={`/reports/clock?days=${option}`}>
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
          label={t('Slower than they should be')}
          value={slow}
          tone={slow === 0 ? 'success' : 'danger'}
          note={slow === 0 ? t('Nothing to chase') : t('Listed first below')}
        />
        <StatTile
          label={t('Too little to go on')}
          value={unknown}
          note={t('Not enough work recorded to say')}
        />
        <StatTile
          label={t('Stretches watched')}
          value={clock.length}
          note={t('From moments the records already keep')}
        />
      </StatRow>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('From one moment to the next')}
          description={t('Furthest past its target first, because that is where to start')}
        />
        <TableWrap className="rounded-none border-0">
          <Table>
            <thead>
              <tr>
                <Th>{t('From, to')}</Th>
                <Th numeric>{t('Usually')}</Th>
                <Th numeric>{t('Slowest tenth')}</Th>
                <Th numeric>{t('Target')}</Th>
                <Th numeric>{t('Measured on')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {ordered.map((one) => {
                const median = medianSeconds(one.samples);
                const tail = slowestTenth(one.samples);
                const enough = verdictOf(one) !== 'unknown';

                return (
                  <Tr key={one.stretch.name}>
                    <Td>
                      <span className="font-medium">{t(one.stretch.name)}</span>
                      <span className="block text-[12px] text-(--text-faint)">
                        {t(one.stretch.span)}
                      </span>
                    </Td>
                    <Td numeric className="tabular font-medium">
                      {enough && median !== null ? duration(median) : '—'}
                    </Td>
                    <Td numeric className="tabular text-(--text-soft)">
                      {enough && tail !== null ? duration(tail) : '—'}
                    </Td>
                    <Td numeric className="tabular text-(--text-soft)">
                      {duration(one.stretch.target)}
                    </Td>
                    <Td numeric className="tabular text-(--text-soft)">
                      {t('{seen} of {candidates}', {
                        seen: one.samples.length,
                        candidates: one.candidates,
                      })}
                      <span className="block text-[12px] text-(--text-faint)">
                        {t('{percent}%', { percent: coverage(one) })}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={tone(one)}>{said(one)}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card className="mt-4">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          {t(
            'Every figure here is the middle one, not the average: one car left over a bank holiday would add three days to an average and tell you nothing. The slowest tenth is beside it because that is where complaints come from. A stretch measured on fewer than five jobs is shown as too few rather than as a number, because a middle figure taken from four jobs is a story rather than a measurement.',
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={t('Why these targets')}
          description={t('Each is a judgement made when this page was written, not a requirement.')}
        />
        <CardBody className="flex flex-col gap-3">
          {clock.map((one) => (
            <div key={one.stretch.name}>
              <p className="text-[13px] font-medium">{t(one.stretch.name)}</p>
              <p className="text-[12px] leading-relaxed text-(--text-soft)">
                {t(one.stretch.because)}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
