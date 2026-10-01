import { humanise, type StoryEntry, type StorySide } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Money,
  PageHeader,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { storyOf } from '@/lib/story';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Minute by minute') };
}
export const dynamic = 'force-dynamic';

const SIDE_TONE: Record<StorySide, 'brand' | 'warning' | 'neutral'> = {
  us: 'brand',
  customer: 'warning',
  system: 'neutral',
};

const SIDE_WORD: Record<StorySide, string> = {
  us: 'Workshop',
  customer: 'Customer',
  system: 'The product',
};

const CHANNEL_WORD: Record<string, string> = {
  SMS: 'a text message',
  EMAIL: 'an email',
  WHATSAPP: 'a WhatsApp message',
  PORTAL: 'a portal message',
};

const METHOD_WORD: Record<string, string> = {
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank transfer',
  ONLINE: 'online',
  CHEQUE: 'cheque',
  ACCOUNT: 'account',
  OTHER: 'other',
  LOYALTY: 'loyalty points',
  GIFT_CARD: 'gift card',
  COUPON: 'coupon',
};

/**
 * One job, minute by minute. Phase 99.
 *
 * The job page shows everything that happened in eleven cards, each in its
 * own order. This is the same records in one order, by day, with who did it
 * and on which side — the page somebody opens when a customer rings to ask
 * why it took nine days, or when a comeback needs the original job read
 * back from the start.
 *
 * Nothing on it is stored or inferred. Where a record names its actor the
 * actor is named; where it does not, the audit log's row supplies the name;
 * where neither does, the line says what happened and not who. The silences
 * are the thing a reader of a complaint is looking for, so a day or more with
 * nothing recorded is drawn as a line between the days it separates.
 */
export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, region } = await requireSession('job:read');
  const t = await tFor();

  const told = await storyOf(orgId, id, region.timezone);
  if (!told) notFound();

  const { job, story, headline } = told;
  const { summary } = story;

  const clock = (at: Date) =>
    at.toLocaleTimeString(region.locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: region.timezone,
    });
  const dayName = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(region.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const span = (minutes: number) =>
    minutes >= 24 * 60
      ? t('{days} days', { days: Math.round(minutes / (24 * 60)) })
      : minutes >= 60
        ? t('{hours} hours', { hours: Math.round(minutes / 60) })
        : t('{minutes} minutes', { minutes });

  // A sentence's values travel in English from the library; the two that
  // are words rather than names -- the channel and the payment method -- are
  // translated here, where the translator is.
  const say = (entry: StoryEntry) => {
    if (entry.kind === 'status') {
      return t('Moved to {status}', { status: t(humanise(entry.status ?? 'DRAFT')) });
    }
    if (!entry.what) return '';
    const vars = { ...(entry.what.vars ?? {}) };
    if (typeof vars.channel === 'string') {
      vars.channel = t(CHANNEL_WORD[vars.channel] ?? vars.channel);
    }
    if (typeof vars.method === 'string') vars.method = t(METHOD_WORD[vars.method] ?? vars.method);
    return t(entry.what.key, vars);
  };

  const silenceBefore = new Map(story.silences.map((one) => [one.to.getTime(), one]));

  return (
    <>
      <div className="mb-4">
        <BackLink href={`/jobs/${job.id}`}>{t('Job #{number}', { number: job.number })}</BackLink>
      </div>

      <PageHeader
        eyebrow={[`#${job.number}`, job.registration, job.vehicle, job.customer]
          .filter(Boolean)
          .join(' · ')}
        title={t('Minute by minute')}
        description={
          <>
            {job.what}. {t(headline.key, { ...headline.vars, span: span(summary.minutes) })}
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('From first to last')}
          value={summary.minutes === 0 ? '—' : span(summary.minutes)}
          note={
            summary.first && summary.last
              ? t('{from} to {to}', {
                  from: summary.first.toLocaleDateString(region.locale, {
                    day: 'numeric',
                    month: 'short',
                    timeZone: region.timezone,
                  }),
                  to: summary.last.toLocaleDateString(region.locale, {
                    day: 'numeric',
                    month: 'short',
                    timeZone: region.timezone,
                  }),
                })
              : t('Nothing recorded')
          }
        />
        <StatTile
          label={t('Messages')}
          value={t('{out} out, {in} in', { out: summary.messagesOut, in: summary.messagesIn })}
          tone={summary.messagesIn > 0 && summary.messagesOut === 0 ? 'warning' : 'neutral'}
          note={
            summary.messagesIn > 0 && summary.messagesOut === 0
              ? t('The customer wrote and nobody wrote back')
              : t('Both ways, people and the product')
          }
        />
        <StatTile
          label={t('Longest silence')}
          value={summary.longestSilence ? span(summary.longestSilence.minutes) : '—'}
          tone={summary.longestSilence ? 'warning' : 'neutral'}
          note={
            summary.longestSilence
              ? t('After: {what}', { what: say(summary.longestSilence.after) })
              : t('Never a day without something recorded')
          }
        />
      </StatRow>

      {story.days.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[14px] text-(--text-soft)">
              {t('Nothing has happened on this job yet.')}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {story.days.map((day) => {
          const first = day.entries[0];
          const silence = first ? silenceBefore.get(first.at.getTime()) : undefined;
          return (
            <div key={day.day} className="grid gap-2">
              {silence ? (
                <p className="flex items-center gap-3 text-[12px] text-(--warning)">
                  <span className="h-px flex-1 bg-(--warning)" aria-hidden="true" />
                  {t('{span} with nothing recorded', { span: span(silence.minutes) })}
                  <span className="h-px flex-1 bg-(--warning)" aria-hidden="true" />
                </p>
              ) : null}
              <Card>
                <CardHeader
                  title={dayName(day.day)}
                  description={
                    day.entries.length === 1
                      ? t('1 moment')
                      : t('{count} moments', { count: day.entries.length })
                  }
                />
                <ol className="divide-y divide-(--border-soft)">
                  {day.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="grid grid-cols-[auto_auto_1fr] items-start gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] sm:grid-cols-[4.5rem_7rem_1fr]"
                    >
                      <span className="datum tabular-nums text-(--text-faint)">
                        {clock(entry.at)}
                      </span>
                      <span>
                        <Badge tone={SIDE_TONE[entry.side]} size="sm" dot>
                          {t(SIDE_WORD[entry.side])}
                        </Badge>
                      </span>
                      <div className="col-span-3 min-w-0 sm:col-span-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          {entry.href ? (
                            <Link href={entry.href} className="font-medium hover:underline">
                              {say(entry)}
                            </Link>
                          ) : (
                            <span className="font-medium">{say(entry)}</span>
                          )}
                          {entry.amount !== null && entry.amount !== undefined ? (
                            <span className="tabular-nums text-(--text-soft)">
                              <Money
                                amount={entry.amount}
                                currency={region.currency}
                                locale={region.locale}
                              />
                            </span>
                          ) : null}
                          {entry.who ? (
                            <span className="text-(--text-faint)">— {entry.who}</span>
                          ) : null}
                        </p>
                        {entry.detail ? (
                          <p className="mt-0.5 text-[12px] text-(--text-soft)">{entry.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}
