import {
  Badge,
  Card,
  CardBody,
  CardHeader,
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
import { ordersAwaitingDelivery } from '@/lib/receiving';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Receiving') };
}
export const dynamic = 'force-dynamic';

/**
 * What is still to come, so the person at the door knows which order the
 * pallet belongs to before they open anything. Phase 93.
 */
export default async function ReceivingPage() {
  const { orgId, region } = await requireSession('inventory:read');
  const t = await tFor();
  const orders = await ordersAwaitingDelivery(orgId);

  return (
    <>
      <PageHeader
        eyebrow={t('Purchasing')}
        title={t('Receiving')}
        description={t('Orders with something still to come. Open one and scan the boxes into it.')}
      />

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('Waiting on a delivery')}
          description={t('{count} orders', { count: orders.length })}
        />
        <CardBody className="p-0">
          {orders.length === 0 ? (
            <p className="p-4 text-[13px] text-(--text-faint)">
              {t('Nothing is outstanding. Every order has arrived.')}
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>{t('Order')}</Th>
                    <Th>{t('Supplier')}</Th>
                    <Th>{t('Expected')}</Th>
                    <Th numeric>{t('Still to come')}</Th>
                  </Tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <Tr key={order.id}>
                      <Td>
                        <Link
                          href={`/receiving/${order.id}`}
                          className="font-medium text-(--brand-text) hover:underline"
                        >
                          #{order.number}
                        </Link>
                        {order.status === 'PART_RECEIVED' ? (
                          <Badge tone="warning" className="ms-2">
                            {t('Part received')}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td>
                        <bdi>{order.supplier}</bdi>
                      </Td>
                      <Td className="text-(--text-faint)">
                        {order.expectedAt
                          ? order.expectedAt.toLocaleDateString(region.locale)
                          : '—'}
                      </Td>
                      <Td numeric>{order.outstanding}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </>
  );
}
