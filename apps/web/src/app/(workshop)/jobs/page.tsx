import { humanise, IN_SHOP_STATUSES, JOB_STATUSES, toneFor, type JobStatus } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
  PageHeader,
  Registration,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Jobs' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { db } = await requireSession('job:read');
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const query = params.q?.trim() ?? '';

  // "in-shop" is a saved view rather than a status: it is the question a
  // manager actually asks, and it spans eight statuses.
  const statusFilter =
    params.status === 'in-shop'
      ? { in: [...IN_SHOP_STATUSES] }
      : params.status && (JOB_STATUSES as readonly string[]).includes(params.status)
        ? (params.status as JobStatus)
        : undefined;

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { shortDescription: { contains: query, mode: 'insensitive' as const } },
            { customer: { displayName: { contains: query, mode: 'insensitive' as const } } },
            { vehicle: { registration: { contains: query, mode: 'insensitive' as const } } },
            ...(Number.isFinite(Number(query)) ? [{ number: Number(query) }] : []),
          ],
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, displayName: true } },
        vehicle: { select: { id: true, make: true, model: true, registration: true } },
        technicians: { include: { user: { select: { name: true } } } },
        estimates: { orderBy: { version: 'desc' }, take: 1, select: { total: true, currency: true } },
      },
    }),
    db.job.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Jobs"
        description={`${total.toLocaleString('en-GB')} job${total === 1 ? '' : 's'}`}
        actions={
          <Link href="/jobs/new">
            <Button variant="primary">New job</Button>
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/jobs">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Job number, customer or registration"
          aria-label="Search jobs"
          className="h-9 w-full max-w-xs rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          aria-label="Filter by status"
          className="h-9 rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-2 pr-7 text-[13px]"
        >
          <option value="">Any status</option>
          <option value="in-shop">In the shop</option>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanise(status)}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
        {query || params.status ? (
          <Link href="/jobs" className="text-[12px] text-(--text-faint) underline">
            Clear
          </Link>
        ) : null}
      </form>

      <Card className="overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs match"
            description={
              query || params.status
                ? 'Try a different search or clear the filter.'
                : 'Jobs appear here once a vehicle is checked in.'
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Vehicle</Th>
                  <Th>Customer</Th>
                  <Th>Work</Th>
                  <Th>Technician</Th>
                  <Th numeric>Value</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const estimate = job.estimates[0];
                  const primary =
                    job.technicians.find((t) => t.isPrimary) ?? job.technicians[0];

                  return (
                    <Tr key={job.id}>
                      <Td className="datum whitespace-nowrap">
                        <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                          #{job.number}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/vehicles/${job.vehicle.id}`}
                            className="font-medium hover:underline"
                          >
                            {job.vehicle.make} {job.vehicle.model}
                          </Link>
                          {job.vehicle.registration ? (
                            <Registration value={job.vehicle.registration} />
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-(--text-soft)">
                        <Link href={`/customers/${job.customer.id}`} className="hover:underline">
                          {job.customer.displayName}
                        </Link>
                      </Td>
                      <Td className="max-w-[20rem] truncate text-(--text-soft)">
                        {job.shortDescription}
                      </Td>
                      <Td className="text-(--text-soft)">
                        {primary?.user.name ?? (
                          <span className="text-(--text-faint)">Unassigned</span>
                        )}
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {estimate ? (
                          <Money
                            amount={Number(estimate.total)}
                            currency={estimate.currency}
                          />
                        ) : (
                          <span className="text-(--text-faint)">—</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={toneFor(job.status)} dot>
                          {humanise(job.status)}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <p className="text-[12px] text-(--text-faint)">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildHref(params, page - 1)}>
                <Button size="sm">Previous</Button>
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={buildHref(params, page + 1)}>
                <Button size="sm">Next</Button>
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

function buildHref(params: { status?: string; q?: string }, page: number): string {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/jobs?${search.toString()}`;
}
