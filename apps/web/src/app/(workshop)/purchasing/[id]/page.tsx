import { orderTotals, toNumber } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  KeyValue,
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
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { BackLink } from '@/components/back-link';
import { audit, requireSession } from '@/lib/guard';
import { receiveGoods } from '@/lib/inventory';
import { bookBill, PayablesError } from '@/lib/payables';

export const dynamic = 'force-dynamic';

/**
 * Books the supplier's invoice against this order.
 *
 * Until Phase 16 a bill could only arrive through the seed. This is where the
 * debt enters the books: stock and input tax up, payable up, and the bill sits
 * awaiting somebody's approval before it can be paid.
 */
async function book(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const orderId = String(formData.get('orderId') ?? '');
  const billed = String(formData.get('billedAt') ?? '');

  try {
    await bookBill({
      orgId,
      userId: user.userId,
      orderId,
      reference: String(formData.get('reference') ?? ''),
      subtotal: Number(String(formData.get('subtotal') ?? '').replace(/[£,\s]/g, '')),
      taxTotal: Number(String(formData.get('taxTotal') ?? '').replace(/[£,\s]/g, '')) || 0,
      billedAt: billed ? new Date(`${billed}T12:00:00`) : new Date(),
    });
  } catch (error) {
    if (!(error instanceof PayablesError)) throw error;
    redirect(`/purchasing/${orderId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/purchasing/${orderId}`);
  redirect(`/purchasing/${orderId}?booked=1`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('inventory:read');
  const order = await db.purchaseOrder.findUnique({ where: { id }, select: { number: true } });
  return { title: order ? `Order ${order.number}` : 'Purchase order' };
}

/**
 * Booking in a delivery.
 *
 * Everything downstream depends on this being right: stock levels, weighted
 * average cost, job costing, and whether the supplier's bill can be trusted.
 * The form defaults each line to the outstanding quantity, because that is
 * what usually arrives, while still allowing a short delivery to be recorded
 * honestly.
 */
export default async function PurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; received?: string }>;
}) {
  const { id } = await params;
  const { error, received } = await searchParams;
  const { db } = await requireSession('inventory:read');

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: { orderBy: { sortOrder: 'asc' }, include: { product: true } },
      receipts: { orderBy: { receivedAt: 'desc' }, include: { lines: true } },
      bills: true,
      request: { select: { id: true, notes: true } },
    },
  });

  if (!order) notFound();

  const warehouse = await db.warehouse.findFirst({
    orderBy: { isDefault: 'desc' },
    select: { id: true, name: true },
  });

  const lines = order.lines.map((line) => ({
    id: line.id,
    description: line.description,
    quantity: Number(line.quantity),
    received: Number(line.received),
    unitCost: line.unitCost.toString(),
  }));

  const totals = orderTotals(lines);
  const receivable = ['SENT', 'PART_RECEIVED'].includes(order.status);

  async function bookIn(formData: FormData) {
    'use server';

    const session = await requireSession('inventory:write');

    const target = await session.db.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!target) notFound();

    const store = await session.db.warehouse.findFirst({
      orderBy: { isDefault: 'desc' },
      select: { id: true },
    });
    if (!store) {
      redirect(`/purchasing/${id}?error=${encodeURIComponent('No warehouse is configured.')}`);
    }

    const receiptLines = target.lines
      .map((line) => {
        const raw = formData.get(`qty_${line.id}`);
        const quantity = Number(raw ?? 0);
        const costRaw = formData.get(`cost_${line.id}`);
        return quantity > 0
          ? {
              orderLineId: line.id,
              quantity,
              unitCost: costRaw ? String(costRaw) : undefined,
            }
          : null;
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (receiptLines.length === 0) {
      redirect(
        `/purchasing/${id}?error=${encodeURIComponent('Enter a quantity for at least one line.')}`,
      );
    }

    const result = await receiveGoods({
      orgId: session.orgId,
      orderId: id,
      warehouseId: store.id,
      lines: receiptLines,
      reference: String(formData.get('reference') ?? '') || null,
    });

    if (!result.ok) {
      redirect(`/purchasing/${id}?error=${encodeURIComponent(result.problems.join(' '))}`);
    }

    await audit({
      orgId: session.orgId,
      actorUserId: session.user.userId,
      action: 'goods.received',
      entityType: 'PurchaseOrder',
      entityId: id,
      after: { lines: receiptLines.length, receiptId: result.receiptId },
    });

    revalidatePath(`/purchasing/${id}`);
    revalidatePath('/parts');
    redirect(`/purchasing/${id}?received=${result.linesReceived}`);
  }

  return (
    <>
      <div className="mb-3">
        <BackLink href="/purchasing">Purchasing</BackLink>
      </div>

      <PageHeader
        eyebrow={`Purchase order · ${order.supplier.name}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number}
            <Badge
              tone={
                order.status === 'RECEIVED' || order.status === 'BILLED'
                  ? 'success'
                  : order.status === 'PART_RECEIVED'
                    ? 'warning'
                    : 'info'
              }
              dot
            >
              {order.status.toLowerCase().replace('_', ' ')}
            </Badge>
          </span>
        }
        description={order.notes ?? undefined}
        actions={
          <Link href="/purchasing">
            <Button>All purchasing</Button>
          </Link>
        }
      />

      {error ? (
        <Alert tone="danger" title="That delivery was not booked in" className="mb-5">
          {error}
        </Alert>
      ) : null}

      {received ? (
        <Alert tone="success" title="Delivery booked in" className="mb-5">
          {received} line{received === '1' ? '' : 's'} received. Stock levels and weighted average
          cost have been updated.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Lines"
              description={
                receivable
                  ? `Booking in to ${warehouse?.name ?? 'the default store'}`
                  : 'This order is closed'
              }
            />

            <form action={bookIn}>
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Description</Th>
                      <Th numeric>Ordered</Th>
                      <Th numeric>Received</Th>
                      <Th numeric>Outstanding</Th>
                      <Th numeric>Unit cost</Th>
                      {receivable ? <Th numeric>Receiving now</Th> : null}
                      {receivable ? <Th numeric>Actual cost</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => {
                      const ordered = Number(line.quantity);
                      const done = Number(line.received);
                      const outstanding = Math.max(0, ordered - done);

                      return (
                        <Tr key={line.id}>
                          <Td>
                            {line.product ? (
                              <Link
                                href={`/parts/${line.product.id}`}
                                className="font-medium hover:underline"
                              >
                                {line.description}
                              </Link>
                            ) : (
                              line.description
                            )}
                            {line.product ? (
                              <span className="datum ml-2 text-[11px] text-(--text-faint)">
                                {line.product.partNumber}
                              </span>
                            ) : null}
                          </Td>
                          <Td numeric>{ordered}</Td>
                          <Td numeric className="text-(--text-soft)">
                            {done || '—'}
                          </Td>
                          <Td
                            numeric
                            className={outstanding > 0 ? 'font-medium' : 'text-(--text-faint)'}
                          >
                            {outstanding || '—'}
                          </Td>
                          <Td numeric className="text-(--text-soft)">
                            <Money amount={Number(line.unitCost)} />
                          </Td>

                          {receivable ? (
                            <Td numeric>
                              <Input
                                name={`qty_${line.id}`}
                                type="number"
                                min={0}
                                max={outstanding}
                                step="0.001"
                                // Defaults to what is outstanding, because that
                                // is what usually turns up.
                                defaultValue={outstanding || ''}
                                disabled={outstanding === 0}
                                aria-label={`Quantity received of ${line.description}`}
                                className="w-24 text-right"
                              />
                            </Td>
                          ) : null}

                          {receivable ? (
                            <Td numeric>
                              <Input
                                name={`cost_${line.id}`}
                                type="text"
                                inputMode="decimal"
                                defaultValue={line.unitCost.toString()}
                                disabled={outstanding === 0}
                                aria-label={`Actual unit cost of ${line.description}`}
                                className="w-24 text-right"
                              />
                            </Td>
                          ) : null}
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>

              {receivable ? (
                <CardBody className="flex flex-wrap items-end gap-3 border-t border-(--border)">
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-medium text-(--text-soft)">
                      Delivery note reference
                    </span>
                    <Input name="reference" placeholder="DN-88210" className="w-48" />
                  </label>
                  <Button type="submit" variant="primary" size="lg">
                    Book in delivery
                  </Button>
                  <p className="text-[12px] text-(--text-faint)">
                    The delivery note price wins over the ordered price, because that is what you
                    will be billed.
                  </p>
                </CardBody>
              ) : null}
            </form>
          </Card>

          {order.receipts.length > 0 ? (
            <Card>
              <CardHeader title="Deliveries" />
              <ul className="divide-y divide-(--border)">
                {order.receipts.map((receipt) => (
                  <li key={receipt.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium">{receipt.reference ?? 'Delivery'}</p>
                      <p className="datum text-[11px] text-(--text-faint)">
                        {receipt.receivedAt.toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <span className="text-[13px] text-(--text-soft)">
                      {receipt.lines.length} line{receipt.lines.length === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Order" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: 'Supplier', value: order.supplier.name },
                  { label: 'Account', value: order.supplier.accountRef },
                  { label: 'Payment terms', value: `${order.supplier.paymentTermsDays} days` },
                  {
                    label: 'Expected',
                    value: order.expectedAt?.toLocaleDateString('en-GB'),
                  },
                  { label: 'Value', value: <Money amount={toNumber(totals.subtotal)} /> },
                  {
                    label: 'Outstanding',
                    value:
                      totals.outstandingValue.minor > 0 ? (
                        <Money amount={toNumber(totals.outstandingValue)} />
                      ) : null,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Book the supplier's bill"
              description="Their invoice number and figures, as printed"
            />
            <form action={book}>
              <CardBody className="grid gap-3">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="grid gap-1">
                  <span className="eyebrow">Their invoice number</span>
                  <Input name="reference" required placeholder="PMF-40128" className="font-mono" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="eyebrow">Net</span>
                    <Input
                      name="subtotal"
                      inputMode="decimal"
                      required
                      defaultValue={toNumber(totals.subtotal).toFixed(2)}
                      className="tabular-nums"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="eyebrow">VAT</span>
                    <Input
                      name="taxTotal"
                      inputMode="decimal"
                      defaultValue={(toNumber(totals.subtotal) * 0.2).toFixed(2)}
                      className="tabular-nums"
                    />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="eyebrow">Dated</span>
                  <Input name="billedAt" type="date" />
                </label>
                <Button type="submit" variant="secondary">
                  Book the bill
                </Button>
              </CardBody>
            </form>
          </Card>

          {order.bills.length > 0 ? (
            <Card>
              <CardHeader title="Bills" />
              <ul className="divide-y divide-(--border)">
                {order.bills.map((bill) => (
                  <li key={bill.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="datum text-[12px] font-medium">{bill.reference}</span>
                      <Badge tone={bill.status === 'DISPUTED' ? 'danger' : 'neutral'} size="sm">
                        {bill.status.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[13px]">
                      <Money amount={Number(bill.total)} />
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
