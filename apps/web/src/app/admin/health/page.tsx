import {
  describeStanding,
  needsAttention,
  runbookFor,
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

import { openAlerts } from '@/lib/alerts';
import { currentUser } from '@/lib/auth';
import { follow } from '@/lib/followed';
import { systemHealth, traceMessagesTo } from '@/lib/health';
import { tFor } from '@/lib/i18n';
import { isOperator } from '@/lib/operator';
import { looksLikeTrace } from '@/lib/trace';

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
  // The same box takes two questions. An address asks "why did this person
  // not get their message"; a trace asks "I pressed the button and nothing
  // happened" — the same question pointed the other way, needing the chain
  // rather than the last link. Phase 59.
  const asked = q?.trim() ?? '';
  const chain = asked && looksLikeTrace(asked) ? await follow(asked) : null;
  const traces = asked && !chain ? await traceMessagesTo(asked) : [];

  // What has already been said about each of these, so the page and the
  // mailbox agree. An operator reading this after a message wants to know
  // whether the message they have is about the state they are looking at.
  const told = new Map((await openAlerts()).map((one) => [one.key, one]));

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
            description={t('Worst first, with the first thing to do')}
          />
          <CardBody className="py-1">
            {worstSignalsFirst(attention).map((one) => {
              const book = runbookFor(one.name);
              const sent = told.get(one.name)?.sentAt ?? null;

              return (
                <div
                  key={`wrong-${one.area}-${one.name}`}
                  className="border-b border-(--line) py-3 last:border-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[13px] font-medium">{t(one.name)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] text-(--text-soft)">
                        {t(one.template, one.values)}
                      </span>
                      <Badge tone={tone(one.standing)}>{t(describeStanding(one.standing))}</Badge>
                    </span>
                  </div>

                  {book ? (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-(--text-soft)">
                      <span className="font-medium">{t('First thing')}: </span>
                      {t(book.first)}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-(--danger)">
                      {t(
                        'Nothing is written down about what to do here, so nobody was told. Add a runbook entry.',
                      )}
                    </p>
                  )}

                  <p className="mt-1 text-[11px] text-(--text-faint)">
                    {sent
                      ? t('You were told at {at}.', { at: sent.toISOString().slice(11, 16) })
                      : t('Nobody has been told yet.')}
                  </p>
                </div>
              );
            })}
          </CardBody>
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
          description={t(
            'An address, a telephone number, a few words from the subject — or a trace, to follow one press all the way through',
          )}
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

        {chain ? (
          chain.moments.length === 0 ? (
            <EmptyState
              title={t('Nothing came of that')}
              description={t(
                'No record carries that trace. Either nothing was written at all — which is itself the answer — or the identifier has been mistyped.',
              )}
            />
          ) : (
            <CardBody className="border-t border-(--line)">
              <p className="mb-3 text-[12px] text-(--text-soft)">
                {t('{count} things came of that press, oldest first.', {
                  count: chain.moments.length,
                })}
              </p>

              {chain.moments.map((moment, index) => (
                <div
                  key={`${moment.step}-${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-(--line) py-2.5 last:border-0"
                >
                  <span className="flex items-baseline gap-2">
                    <Badge tone="neutral">{t(moment.step)}</Badge>
                    <span className="text-[13px]">{moment.what}</span>
                  </span>
                  <span className="text-[12px] text-(--text-faint)">
                    {moment.outcome ? `${moment.outcome} · ` : ''}
                    {moment.at.toISOString().slice(11, 19)}
                  </span>
                </div>
              ))}
            </CardBody>
          )
        ) : q ? (
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
