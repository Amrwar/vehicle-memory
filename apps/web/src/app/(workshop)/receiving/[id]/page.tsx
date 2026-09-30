import { stillOwedOn } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { countIn, ReceivingError, scanIntoOrder, whatIsOnTheOrder } from '@/lib/receiving';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Receiving') };
}
export const dynamic = 'force-dynamic';

/**
 * Scan, quantity, bin, next.
 *
 * The scan box is focused on arrival and again after every count, because a
 * wedge scanner types into whatever has focus and a person holding a box
 * cannot click first. Pull the trigger, the line appears, type how many, press
 * return, and the box is back under the cursor for the next one.
 *
 * The scan never counts. It selects the line and a person types the number on
 * the box — one more keystroke, and the keystroke that makes the figure
 * somebody's rather than the scanner's. A system that added one per scan
 * receives eleven of ten the first time a scanner double-fires.
 *
 * Phase 93.
 */

function back(id: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(`/receiving/${id}${query ? `?${query}` : ''}`);
}

async function scan(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('inventory:read');
  const id = String(formData.get('orderId') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  if (!code) back(id, {});

  const found = await scanIntoOrder(orgId, id, code);

  if (found.found === 'line') back(id, { line: found.line.orderLineId });
  if (found.found === 'settled') back(id, { settled: found.line.description });
  if (found.found === 'several')
    back(id, { several: found.lines.map((l) => l.orderLineId).join(',') });
  back(id, { unknown: found.scanned });
}

async function count(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const id = String(formData.get('orderId') ?? '');
  const orderLineId = String(formData.get('orderLineId') ?? '');
  const quantity = Number(String(formData.get('quantity') ?? '').replace(',', '.'));

  try {
    const after = await countIn({
      orgId,
      userId: user.userId,
      orderId: id,
      orderLineId,
      quantity,
      bin: String(formData.get('bin') ?? ''),
      reference: String(formData.get('reference') ?? ''),
    });

    back(id, after.done ? { done: '1' } : { booked: String(quantity) });
  } catch (error) {
    if (!(error instanceof ReceivingError)) throw error;
    back(id, { problem: error.message, line: orderLineId });
  }
}

export default async function ReceiveOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    line?: string;
    settled?: string;
    several?: string;
    unknown?: string;
    problem?: string;
    booked?: string;
    done?: string;
  }>;
}) {
  const { id } = await params;
  const { orgId, user } = await requireSession('inventory:read');
  const t = await tFor();
  const query = await searchParams;

  const order = await whatIsOnTheOrder(orgId, id).catch(() => null);
  if (!order) notFound();

  const mayWrite = can(user.role, 'inventory:write');
  const selected = query.line ? order.lines.find((one) => one.orderLineId === query.line) : null;
  const several = query.several
    ? order.lines.filter((one) => query.several!.split(',').includes(one.orderLineId))
    : [];

  return (
    <>
      <div className="mb-3">
        <BackLink href="/receiving">{t('Receiving')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Receiving')}
        title={t('Order #{number}', { number: order.number })}
        description={order.supplier}
      />

      {query.problem ? (
        <Alert tone="danger" className="mt-4">
          {query.problem}
        </Alert>
      ) : null}

      {query.unknown ? (
        <Alert tone="danger" className="mt-4">
          <p className="font-medium">
            {t('“{code}” is not on this order.', { code: query.unknown })}
          </p>
          <p className="mt-1 text-[13px]">
            {t(
              'Either the supplier sent something nobody ordered, or this is the wrong order for this pallet. Worth stopping for.',
            )}
          </p>
        </Alert>
      ) : null}

      {query.settled ? (
        <Alert tone="warning" className="mt-4">
          {t('All of “{what}” have already been received on this order.', { what: query.settled })}
        </Alert>
      ) : null}

      {query.booked ? (
        <Alert tone="success" className="mt-4">
          {t('{count} booked in.', { count: query.booked })}
        </Alert>
      ) : null}

      {query.done ? (
        <Alert tone="success" className="mt-4">
          {t('That is the whole order. Nothing is still to come.')}
        </Alert>
      ) : null}

      {mayWrite ? (
        <Card className="mt-5">
          <CardHeader
            title={t('Scan a box')}
            description={t(
              'Point the scanner at the box. The line appears; you say how many arrived.',
            )}
          />
          <CardBody>
            <form action={scan} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <Input
                name="code"
                autoFocus
                className="w-96"
                placeholder={t('Scan or type a part number')}
                aria-label={t('Scan or type a part number')}
              />
              <Button type="submit">{t('Find the line')}</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      {several.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('This order has two lines for that part')}
            description={t(
              'A split delivery, two prices or two dates. Choosing for you would book it against whichever was created first.',
            )}
          />
          <CardBody className="grid gap-1.5 text-[13px]">
            {several.map((line) => (
              <a
                key={line.orderLineId}
                href={`/receiving/${order.id}?line=${line.orderLineId}`}
                className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--border) p-2.5 hover:bg-(--surface-sunken)"
              >
                <bdi>{line.description}</bdi>
                <span className="text-(--text-faint)">
                  {t('{count} still owed', { count: stillOwedOn(line) })}
                </span>
              </a>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {selected && mayWrite ? (
        <Card className="mt-5 border-(--brand)">
          <CardHeader
            title={selected.description}
            description={t('{count} still owed on this order', { count: stillOwedOn(selected) })}
          />
          <CardBody>
            <form action={count} className="grid gap-2 md:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="orderLineId" value={selected.orderLineId} />
              <Input
                name="quantity"
                type="number"
                step="0.001"
                min="0"
                autoFocus
                required
                defaultValue={stillOwedOn(selected)}
                placeholder={t('How many arrived')}
                aria-label={t('How many arrived')}
              />
              <Input
                name="bin"
                defaultValue={selected.bin ?? ''}
                placeholder={t('Bin')}
                aria-label={t('Bin')}
              />
              <Input
                name="reference"
                placeholder={t('Delivery note')}
                aria-label={t('Delivery note')}
              />
              <Button type="submit">{t('Book it in#goods')}</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('Still to come')}
          description={
            order.left.done
              ? t('Nothing. The whole order has arrived.')
              : t('{lines} lines, {items} items', {
                  lines: order.left.outstandingLines,
                  items: order.left.outstandingItems,
                })
          }
        />
        <CardBody className="p-0">
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>{t('Part')}</Th>
                  <Th numeric>{t('Ordered')}</Th>
                  <Th numeric>{t('Received')}</Th>
                  <Th numeric>{t('Still owed')}</Th>
                  <Th>{t('Bin')}</Th>
                </Tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <Tr key={line.orderLineId}>
                    <Td>
                      <bdi>{line.description}</bdi>
                      {line.partNumber ? (
                        <span className="datum ms-2 text-[11px] text-(--text-faint)">
                          {line.partNumber}
                        </span>
                      ) : null}
                    </Td>
                    <Td numeric>{line.ordered}</Td>
                    <Td numeric>{line.alreadyReceived}</Td>
                    <Td numeric>
                      {stillOwedOn(line) === 0 ? (
                        <Badge tone="success">{t('All in')}</Badge>
                      ) : (
                        stillOwedOn(line)
                      )}
                    </Td>
                    <Td className="text-(--text-faint)">{line.bin ?? '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>
    </>
  );
}
