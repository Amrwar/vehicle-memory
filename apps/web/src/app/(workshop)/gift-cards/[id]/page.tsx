import type { GiftCardStatus } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  KeyValue,
  Money,
  PageHeader,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { adjustGiftCard, disableGiftCard, GiftCardError, giftCardDetail } from '@/lib/giftcards';
import { can, requireSession } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { orgId } = await requireSession('payment:read');
  const card = await giftCardDetail(orgId, id);
  return { title: card ? `Gift card ${card.code}` : 'Gift card' };
}

const TENDER_LABEL: Record<string, string> = {
  CARD: 'card',
  CASH: 'cash',
  BANK_TRANSFER: 'bank transfer',
  ONLINE: 'online',
  CHEQUE: 'cheque',
};

const KIND_LABEL: Record<string, string> = {
  ISSUE: 'Loaded',
  REDEEM: 'Spent',
  REFUND: 'Returned',
  ADJUSTMENT: 'By hand',
};

const STATUS: Record<
  GiftCardStatus,
  { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }
> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  DEPLETED: { label: 'Fully spent', tone: 'neutral' },
  EXPIRED: { label: 'Lapsed', tone: 'warning' },
  DISABLED: { label: 'Cancelled', tone: 'danger' },
};

/**
 * One card: its number, what is left, every movement on it, and the two
 * things a person can do to it by hand. The number is large because this is
 * the page somebody reads it from over the phone.
 */
async function adjust(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const id = String(formData.get('id') ?? '');
  const typed = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');
  const direction = String(formData.get('direction') ?? 'UP');
  const pounds = Number(typed);
  const amountMinor = Number.isFinite(pounds) ? Math.round(Math.abs(pounds) * 100) : 0;

  try {
    await adjustGiftCard({
      orgId,
      userId: user.userId,
      giftCardId: id,
      amountMinor: direction === 'DOWN' ? -amountMinor : amountMinor,
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof GiftCardError)) throw error;
    redirect(`/gift-cards/${id}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/gift-cards/${id}?done=adjusted`);
}

async function cancel(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const id = String(formData.get('id') ?? '');

  try {
    await disableGiftCard({
      orgId,
      userId: user.userId,
      giftCardId: id,
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof GiftCardError)) throw error;
    redirect(`/gift-cards/${id}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/gift-cards/${id}?done=cancelled`);
}

export default async function GiftCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; problem?: string }>;
}) {
  const { id } = await params;
  const { done, problem } = await searchParams;
  const { orgId, user } = await requireSession('payment:read');

  const card = await giftCardDetail(orgId, id);
  if (!card) notFound();

  const mayChange = can(user.role, 'payment:write') && card.status !== 'DISABLED';

  return (
    <>
      <div className="mb-3">
        <BackLink href="/gift-cards">All gift cards</BackLink>
      </div>

      <PageHeader
        eyebrow="Gift card"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="datum tracking-[0.15em]">{card.code}</span>
            <Badge tone={STATUS[card.status].tone} dot>
              {STATUS[card.status].label}
            </Badge>
          </span>
        }
        description={
          card.recipientName
            ? `For ${card.recipientName}`
            : 'Read the number out in groups of four.'
        }
      />

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'sold'
            ? 'Card sold and booked as owed work, not as revenue. Read the number to the customer or write it on the card.'
            : done === 'adjusted'
              ? 'Changed, with the reason kept on the card and the books moved by the same amount.'
              : 'Cancelled. Whatever was on it has been written off with the reason, and the number will not be taken again.'}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mb-5">
          {problem}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="What happened on it"
              description="Oldest first. Every movement says what it was for."
            />
            <ul className="divide-y divide-(--border)">
              {card.entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
                  <time className="datum w-24 shrink-0 text-[12px] text-(--text-faint)">
                    {entry.createdAt.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </time>
                  <span className="eyebrow w-16 shrink-0">
                    {KIND_LABEL[entry.kind] ?? entry.kind}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    {entry.invoice ? (
                      <Link href={`/invoices/${entry.invoice.id}`} className="hover:underline">
                        {entry.reason}
                      </Link>
                    ) : entry.counterSale ? (
                      <Link href="/counter" className="hover:underline">
                        {entry.reason}
                      </Link>
                    ) : (
                      entry.reason
                    )}
                    {entry.createdBy ? (
                      <span className="ml-2 text-[11px] text-(--text-faint)">
                        {entry.createdBy.name}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      entry.amountMinor < 0
                        ? 'text-[13px] tabular-nums text-(--text-faint)'
                        : 'text-[13px] font-medium tabular-nums'
                    }
                  >
                    <Money amount={entry.amountMinor / 100} signed />
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {mayChange ? (
            <Card>
              <CardHeader
                title="Change it by hand"
                description="Money added is a gift from the workshop; money taken off is a card it no longer owes on. The reason stays on the card."
              />
              <form action={adjust}>
                <CardBody className="grid gap-3 sm:grid-cols-[8rem_9rem_minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="id" value={card.id} />
                  <Field label="Which way" htmlFor="adjust-direction">
                    <select
                      id="adjust-direction"
                      name="direction"
                      defaultValue="UP"
                      className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                    >
                      <option value="UP">Add</option>
                      <option value="DOWN">Take off</option>
                    </select>
                  </Field>
                  <Field label="Amount" htmlFor="adjust-amount">
                    <Input
                      id="adjust-amount"
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder="5.00"
                      required
                    />
                  </Field>
                  <Field label="Why" htmlFor="adjust-reason">
                    <Input
                      id="adjust-reason"
                      name="reason"
                      required
                      maxLength={200}
                      placeholder="Sorry about the wait on Tuesday"
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    Change it
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card className={card.status === 'ACTIVE' ? 'border-(--brand)' : undefined}>
            <CardHeader title="Where it stands" />
            <CardBody className="grid gap-3">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-(--text-faint)">Left on the card</span>
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  <Money amount={card.balanceMinor / 100} />
                </span>
              </div>
              <KeyValue
                columns={1}
                items={[
                  { label: 'Loaded', value: <Money amount={card.loadedMinor / 100} /> },
                  { label: 'Paid for by', value: TENDER_LABEL[card.method] ?? card.method },
                  {
                    label: 'Sold',
                    value: `${card.soldAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}${card.soldBy ? ` by ${card.soldBy.name}` : ''}`,
                  },
                  { label: 'Good at', value: card.site ? `${card.site} only` : 'Every site' },
                  {
                    label: 'Lasts',
                    value: card.expiresAt
                      ? `Until ${card.expiresAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}`
                      : 'For good',
                  },
                  { label: 'Note', value: card.note },
                  ...(card.disabledAt
                    ? [
                        {
                          label: 'Cancelled',
                          value: `${card.disabledAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}: ${card.disabledReason ?? ''}`,
                        },
                      ]
                    : []),
                ]}
              />
              <p className="text-[12px] text-(--text-faint)">
                To spend it, open the invoice and use &ldquo;Redeem a gift card&rdquo;, or take it
                at the counter.
              </p>
            </CardBody>
          </Card>

          {mayChange ? (
            <Card className="border-(--danger)">
              <CardHeader
                title="Cancel this card"
                description="For a card lost, stolen or sold in error. Whatever is on it is written off with the reason. There is no way back."
              />
              <form action={cancel}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="id" value={card.id} />
                  <Field label="Why" htmlFor="cancel-reason">
                    <Input
                      id="cancel-reason"
                      name="reason"
                      required
                      maxLength={200}
                      placeholder="Reported lost by the buyer"
                    />
                  </Field>
                  <Button type="submit" variant="danger">
                    Cancel the card
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
