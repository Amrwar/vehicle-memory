import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
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
  return { title: t('Suppliers') };
}
export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const { db, region } = await requireSession('inventory:read');
  const t = await tFor();

  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      purchaseOrders: { select: { id: true, status: true, total: true } },
      bills: { select: { id: true, status: true, total: true, amountPaid: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow={t('Inventory')}
        title={t('Suppliers')}
        description={
          suppliers.length === 1
            ? t('1 active supplier')
            : t('{count} active suppliers', { count: suppliers.length })
        }
        actions={
          <>
            <Link href="/purchasing">
              <Button>{t('Purchasing')}</Button>
            </Link>
            <Link href="/suppliers/new">
              <Button variant="primary">{t('New supplier')}</Button>
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden">
        {suppliers.length === 0 ? (
          <EmptyState
            title={t('No suppliers yet')}
            description={t('Add the motor factors you actually buy from.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Supplier')}</Th>
                  <Th>{t('Account')}</Th>
                  <Th>{t('Contact')}</Th>
                  <Th numeric>{t('Terms')}</Th>
                  <Th numeric>{t('Open orders')}</Th>
                  <Th numeric>{t('Owed')}</Th>
                  <Th>{t('Flags')}</Th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const open = supplier.purchaseOrders.filter((order) =>
                    ['SENT', 'PART_RECEIVED'].includes(order.status),
                  ).length;

                  const owed = supplier.bills.reduce(
                    (total, bill) => total + Number(bill.total) - Number(bill.amountPaid),
                    0,
                  );

                  const disputed = supplier.bills.filter(
                    (bill) => bill.status === 'DISPUTED',
                  ).length;

                  return (
                    <Tr key={supplier.id}>
                      <Td className="font-medium">{supplier.name}</Td>
                      <Td className="datum text-(--text-faint)">{supplier.accountRef ?? '—'}</Td>
                      <Td className="text-(--text-soft)">
                        {supplier.email ?? supplier.phone ?? '—'}
                      </Td>
                      <Td numeric className="text-(--text-soft)">
                        {t('{count} days', { count: supplier.paymentTermsDays })}
                      </Td>
                      <Td numeric>{open || '—'}</Td>
                      <Td numeric className={owed > 0 ? 'font-medium' : 'text-(--text-faint)'}>
                        <Money currency={region.currency} locale={region.locale} amount={owed} />
                      </Td>
                      <Td>
                        {disputed > 0 ? (
                          <Badge tone="danger" size="sm">
                            {t('{count} disputed', { count: disputed })}
                          </Badge>
                        ) : (
                          <span className="text-(--text-faint)">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
