import { HELP_ARTICLES, searchHelp } from '@carnet/core';
import { Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Help') };
}
export const dynamic = 'force-dynamic';

/**
 * Help, inside the product. FR-7603.
 *
 * Twelve pages, each about something somebody actually asks, each two
 * paragraphs long and each linking to the screen it is about. Short enough to
 * read all of, which is the only kind of help anybody reads.
 *
 * The same words are also found from the search box at the top of every
 * screen, because somebody who does not know where a thing lives types it
 * there rather than coming here.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();
  const t = await tFor();
  const { q } = await searchParams;
  const asked = q?.trim() ?? '';

  const hits = asked ? searchHelp(asked) : [];
  const articles = asked ? hits.map((hit) => hit.article) : HELP_ARTICLES;

  return (
    <>
      <PageHeader
        eyebrow={t('Help')}
        title={t('How this works')}
        description={t('Twelve short pages. Each one links to the screen it is about.')}
      />

      <Card className="mb-5">
        <form action="/help" method="get">
          <CardBody className="flex flex-wrap items-end gap-3">
            <Field label={t('What are you looking for')} className="min-w-0 flex-1">
              <Input
                name="q"
                defaultValue={asked}
                autoFocus
                placeholder={t('invoice, stock, who can see what')}
              />
            </Field>
          </CardBody>
        </form>
      </Card>

      {asked && articles.length === 0 ? (
        <EmptyState
          title={t('Nothing here matches')}
          description={t(
            'Try a word from the screen you are on. The search box at the top finds records as well as help.',
          )}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <Card key={article.slug}>
              <CardHeader title={t(article.title)} description={t(article.summary)} />
              <CardBody className="flex flex-wrap gap-3 text-[13px]">
                <Link
                  href={`/help/${article.slug}`}
                  className="text-(--brand-text) underline underline-offset-2"
                >
                  {t('Read it')}
                </Link>
                {article.href ? (
                  <Link href={article.href} className="text-(--text-faint) hover:text-(--text)">
                    {t('Go to the screen')}
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
