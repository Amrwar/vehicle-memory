import { isSearchable, kindLabel, type SearchHit, type SearchKind, straightTo } from '@carnet/core';
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { searchEverything } from '@/lib/search';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Search') };
}
export const dynamic = 'force-dynamic';

/**
 * Finding anything. Phase 39.
 *
 * What was typed in the box at the top of the navigation. A single exact
 * identifier (a plate, a VIN, a job or invoice number, a part number, a
 * telephone number) goes straight to its record, because the person who
 * typed a plate wants the car and not a list with one car in it. Anything
 * else is a list grouped by kind, exact matches first.
 */
const ORDER: SearchKind[] = ['vehicle', 'job', 'invoice', 'customer', 'part', 'supplier'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string }>;
}) {
  const { orgId } = await requireSession('customer:read');
  const { q = '', all } = await searchParams;
  const t = await tFor();
  const query = q.trim();
  const hits = isSearchable(query) ? await searchEverything(orgId, query) : [];

  const direct = all ? null : straightTo(hits);
  if (direct) redirect(direct.href);

  const groups = ORDER.map((kind) => ({
    kind,
    hits: hits.filter((hit) => hit.kind === kind),
  })).filter((group) => group.hits.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={t('Search')}
        title={query ? `“${query}”` : t('Search')}
        description={t(
          'A plate, a VIN, a telephone number, a job or invoice number, a part number, or a name',
        )}
      />

      <form action="/search" method="get" role="search" className="mb-5 flex max-w-2xl gap-2">
        <Input
          name="q"
          defaultValue={query}
          autoFocus
          aria-label={t('Search')}
          // i18n-ignore
          placeholder="BJ21 OYD"
        />
        <Button type="submit" variant="primary">
          {t('Search')}
        </Button>
      </form>

      {!isSearchable(query) ? (
        <Card>
          <EmptyState
            title={t('Type at least two characters')}
            description={t(
              'Plates can be typed with or without the space, telephone numbers with or without the spaces and the country code.',
            )}
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title={t('Nothing here matches')}
            description={t(
              'Only this workshop’s own customers, jobs, invoices, parts and the vehicles it has worked on are searched.',
            )}
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.kind} className="overflow-hidden">
              <CardHeader
                title={t(kindLabel(group.kind))}
                description={t('{count} found', { count: group.hits.length })}
              />
              <ul className="divide-y divide-(--border)">
                {group.hits.map((hit: SearchHit) => (
                  <li key={hit.id}>
                    <Link
                      href={hit.href}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-(--surface-sunk)"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="block truncate text-[12px] text-(--text-faint)">
                            {hit.subtitle}
                          </span>
                        ) : null}
                      </span>
                      {hit.exact ? (
                        <Badge tone="brand" size="sm">
                          {t('exact')}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
