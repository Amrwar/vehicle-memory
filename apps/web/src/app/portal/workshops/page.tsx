import { Badge, Button, Card, CardBody, EmptyState, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { workshopDirectory, workshopsUsedBy } from '@/lib/workshops';

export const metadata: Metadata = { title: 'Workshops' };
export const dynamic = 'force-dynamic';

/**
 * Every workshop on Carnet, for a customer choosing where to take the car.
 * Phase 32.5.
 *
 * Findable by name or place. Booking at one the customer has never used is
 * a button here, not a phone call: the booking makes them its customer, and
 * the car's passport follows them there.
 */
export default async function PortalWorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const [workshops, used] = await Promise.all([workshopDirectory(q), workshopsUsedBy(user.userId)]);
  const mine = workshops.filter((w) => used.has(w.id));
  const others = workshops.filter((w) => !used.has(w.id));

  const card = (w: (typeof workshops)[number]) => (
    <li key={w.id}>
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-[17px] font-semibold leading-tight">{w.name}</h3>
              {used.has(w.id) ? (
                <Badge tone="brand" size="sm">
                  You have been here
                </Badge>
              ) : null}
            </div>
            <ul className="mt-1.5 grid gap-0.5 text-[13px] text-(--text-soft)">
              {w.sites.map((site) => (
                <li key={site.name}>
                  {w.sites.length > 1 ? (
                    <span className="font-medium text-(--text)">{site.name}. </span>
                  ) : null}
                  {site.address || 'Address not given'}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[13px]">
              {w.phone ? (
                <a href={`tel:${w.phone}`} className="text-(--brand-text) underline">
                  {w.phone}
                </a>
              ) : null}
              {w.website ? (
                <a
                  href={w.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-(--brand-text) underline"
                >
                  Website
                </a>
              ) : null}
            </p>
          </div>
          <Link href={`/portal/book?workshop=${w.id}`}>
            <Button variant={used.has(w.id) ? 'secondary' : 'primary'}>Book here</Button>
          </Link>
        </CardBody>
      </Card>
    </li>
  );

  return (
    <PortalShell active="workshops">
      <h1 className="font-display text-[24px] font-semibold leading-tight">Workshops</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        Every workshop on Carnet. Book at any of them; your car&apos;s history goes with you.
      </p>

      <form method="get" className="mt-4 flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, town or postcode"
          aria-label="Search workshops"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {workshops.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title={q ? 'No workshop matches that' : 'No workshops yet'}
          description={
            q
              ? 'Try the town or the first part of the postcode.'
              : 'Workshops appear here as they join Carnet.'
          }
        />
      ) : null}

      {mine.length > 0 ? (
        <section className="mt-6">
          <h2 className="eyebrow mb-3">Your workshops</h2>
          <ul className="grid gap-3">{mine.map(card)}</ul>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="mt-6">
          <h2 className="eyebrow mb-3">{mine.length > 0 ? 'Other workshops' : 'Workshops'}</h2>
          <ul className="grid gap-3">{others.map(card)}</ul>
        </section>
      ) : null}
    </PortalShell>
  );
}
