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
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Customers') };
}
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { db } = await requireSession('customer:read');
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const t = await tFor();

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
        eyebrow={t('Workshop')}
        title={t('Customers')}
        description={
          customers.length === 1
            ? t('1 customer')
            : t('{count} customers', { count: customers.length })
        }
        actions={
          <Link href="/customers/new">
            <Button variant="primary">{t('New customer')}</Button>
          </Link>
        }
      />

      <form className="mb-4" action="/customers">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t('Name, phone or email')}
          aria-label={t('Search customers')}
          className="h-9 w-full max-w-sm rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
      </form>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState
            title={t('No customers found')}
            description={
              query ? t('Try a different search.') : t('Add your first customer to begin.')
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Name')}</Th>
                  <Th>{t('Type')}</Th>
                  <Th>{t('Mobile')}</Th>
                  <Th>{t('Email')}</Th>
                  <Th>{t('Source of business')}</Th>
                  <Th numeric>{t('Jobs')}</Th>
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
                        {customer.kind === 'COMPANY' ? t('Company') : t('Individual')}
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
