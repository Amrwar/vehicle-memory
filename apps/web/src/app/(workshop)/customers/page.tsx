import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { db } = await requireSession('customer:read');
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const customers = await db.customer.findMany({
    where: query
      ? {
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { mobile: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: { displayName: 'asc' },
    take: 100,
    include: {
      _count: { select: { jobs: true, invoices: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Customers"
        description={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <Link href="/customers/new">
            <Button variant="primary">New customer</Button>
          </Link>
        }
      />

      <form className="mb-4" action="/customers">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Name, phone or email"
          aria-label="Search customers"
          className="h-9 w-full max-w-sm rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
      </form>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={query ? 'Try a different search.' : 'Add your first customer to begin.'}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Mobile</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th numeric>Jobs</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <Tr key={customer.id}>
                    <Td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.displayName}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={customer.kind === 'COMPANY' ? 'info' : 'neutral'} size="sm">
                        {customer.kind === 'COMPANY' ? 'Company' : 'Individual'}
                      </Badge>
                    </Td>
                    <Td className="datum text-(--text-soft)">{customer.mobile ?? '—'}</Td>
                    <Td className="text-(--text-soft)">{customer.email ?? '—'}</Td>
                    <Td className="text-(--text-faint)">{customer.sourceOfBusiness ?? '—'}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {customer._count.jobs}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
