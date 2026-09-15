import { isSearchable, kindLabel, type SearchHit, type SearchKind, straightTo } from '@carnet/core';
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { searchEverything } from '@/lib/search';

export const metadata: Metadata = { title: 'Search' };
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
        eyebrow="Search"
        title={query ? `“${query}”` : 'Search'}
        description="A plate, a VIN, a telephone number, a job or invoice number, a part number, or a name"
      />

      <form action="/search" method="get" role="search" className="mb-5 flex max-w-2xl gap-2">
        <Input name="q" defaultValue={query} autoFocus aria-label="Search" placeholder="BJ21 OYD" />
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      {!isSearchable(query) ? (
        <Card>
          <EmptyState
            title="Type at least two characters"
            description="Plates can be typed with or without the space, telephone numbers with or without the spaces and the country code."
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing here matches"
            description="Only this workshop's own customers, jobs, invoices, parts and the vehicles it has worked on are searched."
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.kind} className="overflow-hidden">
              <CardHeader
                title={kindLabel(group.kind)}
                description={`${group.hits.length} found`}
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
                          exact
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
