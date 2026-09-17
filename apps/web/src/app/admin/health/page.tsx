import {
  describeStanding,
  needsAttention,
  type Signal,
  standingCounts,
  type Standing,
  worstSignalsFirst,
  worstStanding,
} from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { currentUser } from '@/lib/auth';
import { systemHealth, traceMessagesTo } from '@/lib/health';
import { tFor } from '@/lib/i18n';
import { isOperator } from '@/lib/operator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('System health'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

/**
 * How Carnet itself is. FR-8501, FR-8506. Phase 50.
 *
 * The operator's page and nobody else's. Everything on it spans every
 * workshop at once, which is precisely the view the product spends the rest of
 * its time making impossible — so it is not behind a permission, which a
 * workshop owner has plenty of, but behind being the one person whose address
 * is the operator's.
 *
 * Not found rather than forbidden, the same as any other record that is none
 * of the asker's business: a workshop owner who finds this page should not
 * learn that it exists.
 *
 * The bottom half is the point. "Why did this customer not get their message?"
 * is the question a workshop rings about, and answering it meant reading a
 * status, an attempt count, a provider's error, a suppression list and a
 * consent flag in five places. Now it is one search box and one sentence.
 */
export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await currentUser();

  if (!user || !(await isOperator(user.email))) notFound();

  const t = await tFor();
  const { q } = await searchParams;

  const signals = await systemHealth();
  const attention = needsAttention(signals);
  const worst = worstStanding(signals);
  const traces = q ? await traceMessagesTo(q) : [];

  const areas = [...new Set(signals.map((one) => one.area))];

  const tone = (standing: Standing) =>
    standing === 'failed'
      ? 'danger'
      : standing === 'degraded'
        ? 'warning'
        : standing === 'unknown'
          ? 'neutral'
          : 'success';

  const row = (one: Signal) => (
    <div
      key={`${one.area}-${one.name}`}
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-(--line) py-2.5 last:border-0"
    >
      <span className="text-[13px] font-medium">{t(one.name)}</span>
      <span className="flex items-center gap-2">
        <span className="text-[12px] text-(--text-soft)">{t(one.template, one.values)}</span>
        <Badge tone={tone(one.standing)}>{t(describeStanding(one.standing))}</Badge>
      </span>
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <PageHeader
        eyebrow={t('Carnet')}
        title={t('System health')}
        description={t('For whoever runs Carnet, not for a workshop')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Overall')}
          value={t(describeStanding(worst))}
          tone={tone(worst)}
          note={t(
            '{checked} checked: {failed} not working, {degraded} struggling, {unknown} never used.',
            { checked: signals.length, ...standingCounts(signals) },
          )}
        />
        <StatTile
          label={t('Needing attention')}
          value={attention.length}
          tone={attention.length === 0 ? 'success' : 'danger'}
          note={attention.length === 0 ? t('Nothing to do') : t('Listed first below')}
        />
        <StatTile label={t('Checked')} value={signals.length} note={t('Asked just now')} />
      </StatRow>

      {attention.length > 0 ? (
        <Card className="mb-5 overflow-hidden border-(--danger)">
          <CardHeader
            title={t('What is wrong')}
            description={t('Worst first, because that is where to start')}
          />
          <CardBody className="py-1">{worstSignalsFirst(attention).map(row)}</CardBody>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {areas.map((area) => (
          <Card key={area} className="overflow-hidden">
            <CardHeader title={t(area)} />
            <CardBody className="py-1">
              {signals.filter((one) => one.area === area).map(row)}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* --- the question this page exists to answer ------------------------ */}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Why did they not get their message?')}
          description={t('An address, a telephone number, or a few words from the subject')}
        />
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label={t('Who, or what about')} className="min-w-[16rem] flex-1">
              {/* i18n-ignore: an address reads the same in every language */}
              <Input name="q" defaultValue={q ?? ''} placeholder="maria@example.test" />
            </Field>
            <Button type="submit" variant="primary">
              {t('Find it')}
            </Button>
          </form>
        </CardBody>

        {q ? (
          traces.length === 0 ? (
            <EmptyState
              title={t('Nothing sent to that')}
              description={t(
                'No message has gone to that address or carried those words. Check the spelling, or look at the customer to see which address the workshop actually holds.',
              )}
            />
          ) : (
            <CardBody className="flex flex-col gap-4 border-t border-(--line)">
              {traces.map((trace) => (
                <div key={trace.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Badge
                      tone={
                        trace.verdict.outcome === 'delivered'
                          ? 'success'
                          : trace.verdict.outcome === 'stopped'
                            ? 'danger'
                            : trace.verdict.outcome === 'waiting'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {t(trace.channel)}
                    </Badge>
                    <span className="text-[13px] font-medium">
                      {trace.subject ?? t('No subject')}
                    </span>
                    <span className="text-[12px] text-(--text-faint)">
                      {trace.to} · {trace.at.toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>

                  <p className="text-[13px] leading-relaxed">
                    {t(trace.verdict.template, trace.verdict.values)}
                  </p>

                  {trace.verdict.next ? (
                    <p className="text-[12px] leading-relaxed text-(--text-soft)">
                      {t(trace.verdict.next)}
                    </p>
                  ) : null}

                  {trace.events.length > 0 ? (
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {trace.events.map((event, index) => (
                        <li key={index} className="text-[12px] text-(--text-faint)">
                          {event.at.toISOString().slice(0, 16).replace('T', ' ')} · {event.event}
                          {event.detail ? ` — ${event.detail}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CardBody>
          )
        ) : null}
      </Card>
    </main>
  );
}
