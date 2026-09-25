import { creditDue, reasonLabel } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Money,
  PageHeader,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { creditReturn, refuseReturn, ReturnError, returnsFor } from '@/lib/returns';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Returns to suppliers') };
}
export const dynamic = 'force-dynamic';

/**
 * Parts sent back to suppliers. Phase 38.
 *
 * Open returns first, each waiting on the supplier's credit note: when it
 * arrives, its number and its amounts go in and the credit comes off what
 * the supplier is owed. A supplier who will not credit is recorded as
 * refused, with the reason, and the value is written off. Returns are sent
 * from the order the parts came on.
 */
async function credit(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');
  try {
    const result = await creditReturn({
      orgId,
      userId: user.userId,
      returnId: String(formData.get('returnId') ?? ''),
      reference: String(formData.get('reference') ?? ''),
      net: Number(formData.get('net') ?? 0),
      tax: Number(formData.get('tax') ?? 0),
    });
    redirect(`/purchasing/returns?credited=1${result.unappliedMinor > 0 ? '&held=1' : ''}`);
  } catch (error) {
    if (error instanceof ReturnError) {
      redirect(`/purchasing/returns?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

/**
 * What to put in the box, which is what the supplier will credit.
 *
 * Not the held value, which is what the shelf lost. A part comes off stock at
 * the shelf's weighted average, because nobody can say which two of ten are
 * in the box; the supplier credits what they charged on the order. The two
 * coincide only when nothing has moved the average, and this screen used to
 * offer the first as the answer to the second -- PS77.82 for two parts that
 * cost PS20, on a shelf that had been restocked dearer. For a core it offered
 * nothing at all, because a core holds no stock value, when the core charge
 * is the one figure on the whole screen that is known exactly. Phase 79.
 *
 * It is a proposal either way: the operator has the supplier's credit note in
 * front of them and types what it says. A proposal that is systematically
 * wrong is worse than none, because it invites agreement.
 */
function due(returned: {
  reason: string;
  lines: readonly {
    quantity: unknown;
    unitCost: unknown;
    orderLine: { unitCost: unknown } | null;
  }[];
}): number {
  return creditDue(
    returned.lines.map((line) => ({
      reason: returned.reason as never,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      paidUnitCost: line.orderLine ? Number(line.orderLine.unitCost) : null,
    })),
  );
}

async function refuse(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');
  try {
    await refuseReturn({
      orgId,
      userId: user.userId,
      returnId: String(formData.get('returnId') ?? ''),
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (error instanceof ReturnError) {
      redirect(`/purchasing/returns?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect('/purchasing/returns?refused=1');
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; credited?: string; held?: string; refused?: string }>;
}) {
  const { orgId, user, region } = await requireSession('inventory:read');
  const params = await searchParams;
  const returns = await returnsFor(orgId);
  const open = returns.filter((r) => r.status === 'SENT');
  const closed = returns.filter((r) => r.status !== 'SENT');
  const mayWrite = can(user.role, 'ledger:write');
  const t = await tFor();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/purchasing">{t('Purchasing')}</BackLink>
      </div>
      <PageHeader
        eyebrow={t('Inventory')}
        title={t('Returns to suppliers')}
        description={t('Parts sent back, waiting on a credit note, and what became of them')}
      />

      {params.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(params.problem)}
        </Alert>
      ) : null}
      {params.credited ? (
        <Alert tone="success" className="mb-5">
          {params.held
            ? t(
                'Credited. It has come off what the supplier is owed, and what was left over is held against their next bill.',
              )
            : t('Credited. It has come off what the supplier is owed.')}
        </Alert>
      ) : null}
      {params.refused ? (
        <Alert tone="warning" className="mb-5">
          {t('Recorded as refused, and the value written off.')}
        </Alert>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Waiting on a credit note')}
          description={t('Send parts back from the order they came on.')}
        />
        {open.length === 0 ? (
          <EmptyState
            title={t('Nothing has gone back')}
            description={t(
              'A faulty part, a wrong part, one not needed, or a core: send it back from its order and it waits here for the credit.',
            )}
          />
        ) : (
          <ul className="divide-y divide-(--border)">
            {open.map((r) => (
              <li key={r.id} className="grid gap-3 px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    <span className="datum me-2">{r.number}</span>
                    {r.supplier.name}
                    <Badge tone="warning" size="sm" className="ms-2">
                      {t(reasonLabel(r.reason))}
                    </Badge>
                  </span>
                  <span className="text-(--text-soft)">
                    {r.order ? (
                      <Link href={`/purchasing/${r.order.id}`} className="underline">
                        {r.order.number}
                      </Link>
                    ) : null}{' '}
                    · {t('sent {date}', { date: r.sentAt.toLocaleDateString(region.locale) })}
                    {Number(r.heldCost) > 0 ? (
                      <>
                        {' '}
                        · {t('held')}{' '}
                        <Money
                          amount={Number(r.heldCost)}
                          currency={region.currency}
                          locale={region.locale}
                        />
                      </>
                    ) : null}
                  </span>
                </div>
                <ul className="text-(--text-soft)">
                  {r.lines.map((line) => (
                    <li key={line.id}>
                      {Number(line.quantity)} × {line.description}
                    </li>
                  ))}
                </ul>
                {mayWrite ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                    <form
                      action={credit}
                      className="flex flex-wrap items-end gap-2 rounded-(--radius-md) border border-(--border) p-3"
                    >
                      <input type="hidden" name="returnId" value={r.id} />
                      <Field label={t('Credit note number')}>
                        <Input name="reference" required className="w-36" />
                      </Field>
                      <Field label={t('Net ({currency})', { currency: region.currency })}>
                        <Input
                          name="net"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          defaultValue={due(r) > 0 ? due(r) : undefined}
                          className="w-28"
                        />
                      </Field>
                      <Field label={t('Tax')}>
                        <Input
                          name="tax"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={0}
                          className="w-24"
                        />
                      </Field>
                      <Button type="submit" variant="primary">
                        {t('Record the credit note')}
                      </Button>
                    </form>
                    <form
                      action={refuse}
                      className="flex flex-wrap items-end gap-2 rounded-(--radius-md) border border-(--border) p-3"
                    >
                      <input type="hidden" name="returnId" value={r.id} />
                      <Field label={t('They refused because')}>
                        <Input name="reason" required placeholder={t('Fitted, not faulty')} />
                      </Field>
                      <Button type="submit" variant="secondary">
                        {t('Refused')}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {closed.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader title={t('Settled')} />
          <ul className="divide-y divide-(--border)">
            {closed.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]"
              >
                <span>
                  <span className="datum me-2">{r.number}</span>
                  {r.supplier.name} · {t(reasonLabel(r.reason))}
                </span>
                <span className="text-(--text-soft)">
                  {r.status === 'CREDITED' ? (
                    <>
                      {t('Credited {reference}', { reference: r.creditReference ?? '' })} ·{' '}
                      <Money
                        amount={Number(r.creditNet ?? 0) + Number(r.creditTax ?? 0)}
                        currency={region.currency}
                        locale={region.locale}
                      />
                      {Number(r.creditUnapplied) > 0 ? (
                        <>
                          {' '}
                          · {t('held')}{' '}
                          <Money
                            amount={Number(r.creditUnapplied)}
                            currency={region.currency}
                            locale={region.locale}
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>{t('Refused: {reason}', { reason: r.refusedReason ?? '' })}</>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
