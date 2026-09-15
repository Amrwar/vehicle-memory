import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Translator } from '@carnet/core';
import type { Metadata } from 'next';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { quotingAssessments, stockDivergences } from '@/lib/insights';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Insights') };
}
export const dynamic = 'force-dynamic';

/**
 * What the workshop's own history is willing to say. FR-2600.
 *
 * Two questions, both answered from what actually happened rather than from a
 * setting somebody typed once: how much of each part to keep, and whether each
 * kind of work is sold for what it costs to do.
 *
 * Nothing here is a prediction in the impressive sense. There is no model,
 * because a workshop has months of history rather than years, and a part that
 * moved four times cannot support anything cleverer than an average. What it
 * can support is an average, a measure of how much that average moves about,
 * and a refusal to answer when there is not enough to go on.
 *
 * The refusal is the point. A reorder figure derived from two movements looks
 * exactly like one derived from two hundred, and whoever reads it has no way
 * to tell. So this page says how many parts it could not assess, next to the
 * ones it could.
 */
function hours(minutes: number, t: Translator): string {
  if (minutes < 90) return t('{minutes} min', { minutes: Math.round(minutes) });

  return t('{hours} hrs', { hours: (minutes / 60).toFixed(1) });
}

export default async function InsightsPage() {
  const { orgId } = await requireSession('report:operational');
  const t = await tFor();

  const [stock, quoting] = await Promise.all([stockDivergences(orgId), quotingAssessments(orgId)]);

  const tooLow = stock.divergences.filter((entry) => entry.direction === 'TOO_LOW');
  const underquoted = quoting.worst.filter((entry) => entry.verdict === 'UNDERQUOTED');

  return (
    <>
      <PageHeader
        eyebrow={t('Reports')}
        title={t('Insights')}
        description={t('What your own history supports saying, and what it does not')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Settings to change')}
          value={stock.divergences.length}
          tone={stock.divergences.length > 0 ? 'brand' : 'neutral'}
          note={t('Of {count} parts with enough history', { count: stock.assessed })}
        />
        <StatTile
          label={t('Risk running out')}
          value={tooLow.length}
          tone={tooLow.length > 0 ? 'warning' : 'neutral'}
          note={t('Reorder point below real usage')}
        />
        <StatTile
          label={t('Underquoted work')}
          value={underquoted.length}
          tone={underquoted.length > 0 ? 'danger' : 'neutral'}
          note={t('Takes longer than it is sold for')}
        />
        <StatTile
          label={t('Typical wait')}
          value={t('{days}d', { days: stock.leadTimeDays })}
          note={t('Order to delivery, from your own orders')}
        />
      </StatRow>

      {stock.total > stock.assessed ? (
        <Card className="mb-5">
          <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
            <strong className="font-semibold text-(--text)">
              {t('{count} of {total} parts could not be assessed.', {
                count: stock.total - stock.assessed,
                total: stock.total,
              })}
            </strong>{' '}
            {t(
              'They have moved too rarely for an average to mean anything. A figure produced from two movements looks exactly like one produced from two hundred, so none is offered.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Stock levels worth changing')}
          description={t(
            'Based on what left the shelf, and on orders taking about {days} days to arrive.',
            { days: stock.leadTimeDays },
          )}
        />
        {stock.divergences.length === 0 ? (
          <EmptyState
            title={t('Nothing worth changing')}
            description={t(
              'Every part with enough history is set within a sensible distance of what its usage justifies.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Part')}</Th>
                  <Th numeric>{t('Set to')}</Th>
                  <Th numeric>{t('Should be')}</Th>
                  <Th>{t('Which way')}</Th>
                  <Th>{t('Why')}</Th>
                </tr>
              </thead>
              <tbody>
                {stock.divergences.map((entry) => (
                  <Tr key={entry.productId}>
                    <Td className="font-medium">{entry.name}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.current}
                    </Td>
                    <Td numeric className="font-medium">
                      {entry.suggested}
                    </Td>
                    <Td>
                      <Badge tone={entry.direction === 'TOO_LOW' ? 'warning' : 'neutral'} size="sm">
                        {entry.direction === 'TOO_LOW' ? t('runs out') : t('cash on a shelf')}
                      </Badge>
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">{t(entry.reason)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Work sold for the wrong time')}
          description={t(
            'Ranked by what it costs across all the jobs of that kind, not by the gap on one.',
          )}
        />
        {quoting.worst.length === 0 ? (
          <EmptyState
            title={
              quoting.measured === 0
                ? t('Not enough completed work yet')
                : t('Every kind of work is booked about right')
            }
            description={
              quoting.measured === 0
                ? t(
                    'This needs several completed jobs of the same kind, with time booked against them, before it can say anything.',
                  )
                : t('Measured across {count} of {total} job types.', {
                    count: quoting.measured,
                    total: quoting.total,
                  })
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Work')}</Th>
                  <Th numeric>{t('Booked at')}</Th>
                  <Th numeric>{t('Usually takes')}</Th>
                  <Th numeric>{t('Jobs')}</Th>
                  <Th>{t('What it means')}</Th>
                </tr>
              </thead>
              <tbody>
                {quoting.worst.map((entry) => (
                  <Tr key={entry.jobType}>
                    <Td className="font-medium">
                      {entry.jobType}
                      <span className="ms-2 inline-block align-middle">
                        <Badge
                          tone={entry.verdict === 'UNDERQUOTED' ? 'danger' : 'neutral'}
                          size="sm"
                        >
                          {entry.verdict === 'UNDERQUOTED' ? t('runs over') : t('over-booked')}
                        </Badge>
                      </span>
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.booked ? hours(entry.booked, t) : '—'}
                    </Td>
                    <Td numeric className="font-medium">
                      {entry.estimate.known ? hours(entry.estimate.median, t) : '—'}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.estimate.known ? entry.estimate.samples : '—'}
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">{t(entry.note)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
