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

export const metadata: Metadata = { title: 'Suppliers' };
export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const { db, region } = await requireSession('inventory:read');

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
        eyebrow="Inventory"
        title="Suppliers"
        description={`${suppliers.length} active supplier${suppliers.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Link href="/purchasing">
              <Button>Purchasing</Button>
            </Link>
            <Link href="/suppliers/new">
              <Button variant="primary">New supplier</Button>
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden">
        {suppliers.length === 0 ? (
          <EmptyState
            title="No suppliers yet"
            description="Add the motor factors you actually buy from."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Account</Th>
                  <Th>Contact</Th>
                  <Th numeric>Terms</Th>
                  <Th numeric>Open orders</Th>
                  <Th numeric>Owed</Th>
                  <Th>Flags</Th>
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
                        {supplier.paymentTermsDays} days
                      </Td>
                      <Td numeric>{open || '—'}</Td>
                      <Td numeric className={owed > 0 ? 'font-medium' : 'text-(--text-faint)'}>
                        <Money currency={region.currency} locale={region.locale} amount={owed} />
                      </Td>
                      <Td>
                        {disputed > 0 ? (
                          <Badge tone="danger" size="sm">
                            {disputed} disputed
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
