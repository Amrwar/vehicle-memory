import { TransferError } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  KeyValue,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { SubmitOnce } from '@/components/submit-once';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { once, onceToken, StillGoingError } from '@/lib/once';
import { cancelTransfer, dispatchTransfer, receiveTransfer } from '@/lib/transfers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Transfer') };
}
export const dynamic = 'force-dynamic';

/**
 * One transfer, and the three things that can happen to it.
 *
 * The page the transfer cycle was missing. Sending, receiving and cancelling
 * were all written, tested and unreachable: a workshop could be told which
 * parts to move between sites, could not start a transfer, and — worse — if
 * one had ever been started, could never book it in. Stock booked out of one
 * site and never into the other is stock nobody can find, and at the next
 * count it reads as theft.
 *
 * Receiving is a form rather than a button because a van does not always
 * arrive with what left. Each line is counted in, short deliveries are shown
 * as short, and the difference stays in transit until somebody says it is
 * not coming — which is a decision, so it is a separate press.
 */

const back = (id: string, problem: string): never =>
  redirect(`/transfers/${id}?problem=${encodeURIComponent(problem)}`);

async function send(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const id = String(formData.get('transferId') ?? '');

  try {
    await once({
      orgId,
      key: ['dispatch-transfer', id, String(formData.get('once') ?? '')],
      work: () => dispatchTransfer(orgId, id, user.userId),
    });
  } catch (error) {
    if (error instanceof StillGoingError) back(id, error.message);
    if (!(error instanceof TransferError)) throw error;
    back(id, error.message);
  }

  redirect(`/transfers/${id}?done=sent`);
}

async function receive(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');
  const id = String(formData.get('transferId') ?? '');

  // One entry per line, read from the form by product. A line left blank is
  // nothing received on that line rather than an error: a van that arrived
  // with four of the six is a normal Tuesday.
  const received = [...formData.entries()]
    .filter(([key]) => key.startsWith('count:'))
    .map(([key, value]) => ({
      productId: key.slice('count:'.length),
      quantity: Number(String(value ?? '').trim() || 0),
    }))
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

  try {
    await once({
      orgId,
      key: ['receive-transfer', id, String(formData.get('once') ?? '')],
      work: () =>
        receiveTransfer(orgId, id, received, user.userId, {
          // Closing it short is a decision somebody makes deliberately: the
          // difference stops being in transit and becomes a loss with a name
          // against it.
          closeShort: formData.get('closeShort') === 'on',
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) back(id, error.message);
    if (!(error instanceof TransferError)) throw error;
    back(id, error.message);
  }

  redirect(`/transfers/${id}?done=received`);
}

async function callOff(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('inventory:write');
  const id = String(formData.get('transferId') ?? '');

  try {
    await cancelTransfer(orgId, id);
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    back(id, error.message);
  }

  redirect('/transfers?done=cancelled');
}

export default async function TransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { id } = await params;
  const { orgId, user, region } = await requireSession('inventory:read');
  const t = await tFor();
  const { problem, done } = await searchParams;

  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, orgId },
    include: {
      fromWarehouse: { select: { name: true, location: { select: { name: true } } } },
      toWarehouse: { select: { name: true, location: { select: { name: true } } } },
      dispatchedBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { product: { select: { partNumber: true, name: true } } },
      },
    },
  });

  if (!transfer) notFound();

  const mayMove = can(user.role, 'inventory:write');

  // A short delivery leaves the transfer part-received, not in transit, and
  // the rest still has to be bookable in when it turns up. Deciding this in
  // one place is how the second half of a split delivery stops being
  // unreachable.
  const arriving = transfer.status === 'IN_TRANSIT' || transfer.status === 'PART_RECEIVED';
  const token = onceToken();
  const from = transfer.fromWarehouse.location?.name ?? transfer.fromWarehouse.name;
  const to = transfer.toWarehouse.location?.name ?? transfer.toWarehouse.name;

  const outstanding = transfer.lines.reduce(
    (total, line) => total + Math.max(0, Number(line.quantity) - Number(line.received)),
    0,
  );

  const tone =
    transfer.status === 'RECEIVED'
      ? 'success'
      : transfer.status === 'IN_TRANSIT' || transfer.status === 'PART_RECEIVED'
        ? 'warning'
        : transfer.status === 'CANCELLED'
          ? 'neutral'
          : 'info';

  return (
    <>
      <BackLink href="/transfers">{t('Transfers')}</BackLink>
      <PageHeader
        eyebrow={t('Stock')}
        title={transfer.reference}
        description={t('{from} to {to}', { from, to })}
        actions={<Badge tone={tone}>{t(transfer.status)}</Badge>}
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'sent'
            ? t(
                'Sent. The parts are off the first shelf and counted as in transit until they land.',
              )
            : t('Booked in. What arrived is on the shelf at {to}.', { to })}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('What is on it')}
            description={
              arriving
                ? t('Count each line in as it comes off the van')
                : t('What was put on this transfer')
            }
          />
          <form action={receive}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <input type="hidden" name="once" value={token} />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Part')}</Th>
                    <Th numeric>{t('Sent')}</Th>
                    <Th numeric>{t('Received')}</Th>
                    {arriving && mayMove ? <Th numeric>{t('Counting in')}</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {transfer.lines.map((line) => (
                    <Tr key={line.id}>
                      <Td>
                        <span className="datum text-[13px] font-medium">
                          {line.product.partNumber}
                        </span>
                        <span className="ms-2 text-(--text-soft)">{line.product.name}</span>
                      </Td>
                      <Td numeric className="tabular">
                        {Number(line.quantity)}
                      </Td>
                      <Td numeric className="tabular text-(--text-soft)">
                        {Number(line.received)}
                      </Td>
                      {arriving && mayMove ? (
                        <Td numeric>
                          <Input
                            name={`count:${line.productId}`}
                            type="number"
                            min={0}
                            step="1"
                            defaultValue={Math.max(
                              0,
                              Number(line.quantity) - Number(line.received),
                            )}
                            className="w-24 text-end tabular"
                          />
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>

            {arriving && mayMove ? (
              <CardBody className="grid gap-3 border-t border-(--border)">
                <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <input
                    type="checkbox"
                    name="closeShort"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-(--warning)"
                  />
                  <span>
                    {t(
                      'Anything still missing is not coming. Close the transfer short and write the difference off.',
                    )}
                  </span>
                </label>
                <SubmitOnce>{t('Book in what arrived')}</SubmitOnce>
              </CardBody>
            ) : null}
          </form>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title={t('The journey')} />
            <CardBody>
              <KeyValue
                items={[
                  { label: t('From'), value: from },
                  { label: t('To'), value: to },
                  {
                    label: t('Sent'),
                    value: transfer.dispatchedAt
                      ? `${transfer.dispatchedAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}${
                          transfer.dispatchedBy ? ` · ${transfer.dispatchedBy.name}` : ''
                        }`
                      : t('Not yet'),
                  },
                  {
                    label: t('Received'),
                    value: transfer.receivedAt
                      ? `${transfer.receivedAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}${
                          transfer.receivedBy ? ` · ${transfer.receivedBy.name}` : ''
                        }`
                      : t('Not yet'),
                  },
                  { label: t('Still to arrive'), value: String(outstanding) },
                  { label: t('Note'), value: transfer.note },
                ]}
              />
            </CardBody>
          </Card>

          {mayMove && transfer.status === 'DRAFT' ? (
            <Card className="border-(--brand)">
              <CardHeader
                title={t('Send it')}
                description={t(
                  'The parts come off the shelf at {from} now, and count as in transit until they are booked in.',
                  { from },
                )}
              />
              <form action={send}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <input type="hidden" name="once" value={token} />
                  <SubmitOnce>{t('Send the transfer')}</SubmitOnce>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {mayMove && transfer.status === 'DRAFT' ? (
            <Card>
              <CardHeader
                title={t('Call it off')}
                description={t('Nothing has left a shelf yet, so there is nothing to undo.')}
              />
              <form action={callOff}>
                <CardBody>
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <Button type="submit" variant="ghost" block>
                    {t('Cancel this transfer')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          {arriving ? (
            <Card>
              <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
                {t(
                  'These parts are counted in the group’s stock while they are in the van. They belong to neither shelf until somebody books them in, which is why the difference is worth watching.',
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
