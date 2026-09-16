import { HELP_ARTICLES, helpArticle } from '@carnet/core';
import { Button, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = await tFor();
  const article = helpArticle((await params).slug);
  return { title: article ? t(article.title) : t('Help') };
}
export const dynamic = 'force-dynamic';

/** One answer, and the screen it is about. FR-7603. */
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const t = await tFor();
  const { slug } = await params;

  const article = helpArticle(slug);
  if (!article) notFound();

  const others = HELP_ARTICLES.filter((entry) => entry.slug !== article.slug).slice(0, 4);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/help">{t('Help')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Help')}
        title={t(article.title)}
        description={t(article.summary)}
        actions={
          article.href ? (
            <Link href={article.href}>
              <Button variant="secondary">{t('Go to the screen')}</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardBody className="grid gap-3 text-[15px] leading-relaxed">
            {article.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{t(paragraph)}</p>
            ))}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={t('Also worth reading')} />
          <ul className="divide-y divide-(--border)">
            {others.map((entry) => (
              <li key={entry.slug} className="px-4 py-2.5 text-[13px]">
                <Link href={`/help/${entry.slug}`} className="font-medium hover:underline">
                  {t(entry.title)}
                </Link>
                <span className="block text-[12px] text-(--text-faint)">{t(entry.summary)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
