import { COVERAGE, describeExchange, formatFigure } from '@carnet/core';
import { Alert, Button, Card, CardBody, CardHeader, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { askAssistant, exchangesFor } from '@/lib/assistant';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Ask' };
export const dynamic = 'force-dynamic';

/**
 * The owner asks a question in words.
 *
 * Every figure this page can give is computed somewhere in the product
 * already. What it adds is not intelligence but routing: recognising which
 * calculation is being asked for, over what period, and showing the working
 * so the number can be checked against the page it came from. A question the
 * records cannot answer gets a plain statement to that effect, never a guess.
 *
 * Stateless by design. The question is in the URL, the answer is computed on
 * the way in, and nothing is stored. An owner's questions are their own.
 */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { orgId, user, region } = await requireSession('report:operational');
  const { q } = await searchParams;

  // Asked through the assistant so the exchange is recorded; the answer is
  // the same one the router gives.
  const asked = q?.trim()
    ? (await askAssistant({ orgId, userId: user.userId, question: q.trim() })).asked
    : null;
  const recent = await exchangesFor(orgId, { limit: 12 });

  return (
    <>
      <PageHeader
        eyebrow="Command centre"
        title="Ask"
        description="A question in words, answered from the records with the working shown."
      />

      <Card className="mb-5">
        <form action="/ask" method="get">
          <CardBody className="flex flex-wrap items-center gap-2">
            <Input
              name="q"
              defaultValue={q ?? ''}
              autoFocus
              placeholder="What did we take this month?"
              aria-label="Your question"
              className="min-w-0 flex-1 text-[15px]"
            />
            <Button type="submit" variant="primary">
              Ask
            </Button>
          </CardBody>
        </form>
      </Card>

      {asked?.refusal ? (
        <Alert tone="warning" className="mb-5">
          {asked.refusal}
        </Alert>
      ) : null}

      {asked?.answer ? (
        <Card className="mb-5 border-(--brand)">
          <CardHeader
            title={asked.answer.headline}
            description={asked.answer.period ? `Covering ${asked.answer.period}.` : undefined}
            action={
              asked.answer.figure !== null && typeof asked.answer.figure !== 'number' ? (
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  {formatFigure(asked.answer.figure)}
                </span>
              ) : typeof asked.answer.figure === 'number' ? (
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  {asked.answer.figure}
                </span>
              ) : undefined
            }
          />
          <CardBody className="grid gap-3">
            {/* The working, so the figure can be checked rather than believed. */}
            <ol className="grid gap-1.5 text-[13px] leading-relaxed text-(--text-soft)">
              {asked.answer.reasoning.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="datum shrink-0 text-(--text-faint)">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-[13px]">
              The same figure as a page:{' '}
              <Link
                href={asked.answer.source.href}
                className="font-medium text-(--brand-text) underline underline-offset-2"
              >
                {asked.answer.source.label}
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      ) : null}

      {recent.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            title="Recently asked"
            description="Every exchange with the assistant, here and on jobs, with what each cost"
          />
          <ul className="divide-y divide-(--border)">
            {recent.map((exchange) => (
              <li key={exchange.id} className="grid gap-0.5 px-4 py-2.5 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  {exchange.relatedType === 'Job' && exchange.relatedId ? (
                    <Link
                      href={`/jobs/${exchange.relatedId}?exchange=${exchange.id}#assistant`}
                      className="font-medium hover:underline"
                    >
                      {exchange.prompt}
                    </Link>
                  ) : (
                    <Link
                      href={`/ask?q=${encodeURIComponent(exchange.prompt)}`}
                      className="font-medium hover:underline"
                    >
                      {exchange.prompt}
                    </Link>
                  )}
                  <span className="text-(--text-faint)">{exchange.user?.name ?? 'Somebody'}</span>
                  <span className="datum text-[12px] text-(--text-faint)">
                    {exchange.createdAt.toLocaleString(region.locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p className="text-[12px] text-(--text-soft)">
                  {describeExchange(exchange)}
                  {exchange.inputTokens + exchange.outputTokens > 0
                    ? ` ${(exchange.inputTokens + exchange.outputTokens).toLocaleString(region.locale)} tokens.`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="What the records can answer"
          description="Ask in your own words. These are the shapes of question it recognises."
        />
        <ul className="divide-y divide-(--border)">
          {COVERAGE.map((entry) => (
            <li
              key={entry.example}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
            >
              <Link
                href={`/ask?q=${encodeURIComponent(entry.example)}`}
                className="font-medium text-(--brand-text) hover:underline"
              >
                {entry.example}
              </Link>
              <span className="text-(--text-faint)">{entry.answers}</span>
            </li>
          ))}
        </ul>
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          Nothing here decides anything, and nothing is estimated. A question outside this list is
          refused rather than guessed at. A service adviser that suggests where to look on a fault
          is deliberately not built: it needs a record of symptoms against confirmed causes that
          does not exist yet, and a confident wrong suggestion on a braking fault is not a small
          error.
        </CardBody>
      </Card>
    </>
  );
}
