import { type GiftCardStatus, msg } from '@carnet/core';
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
import { once, onceToken, StillGoingError } from '@/lib/once';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { orgId } = await requireSession('payment:read');
  const t = await tFor();
  const card = await giftCardDetail(orgId, id);
  return { title: card ? t('Gift card {code}', { code: card.code }) : t('Gift card') };
}

const TENDER_LABEL: Record<string, string> = {
  CARD: msg('card'),
  CASH: msg('cash'),
  BANK_TRANSFER: msg('bank transfer'),
  ONLINE: msg('online'),
  CHEQUE: msg('cheque'),
};

const KIND_LABEL: Record<string, string> = {
  ISSUE: msg('Loaded'),
  REDEEM: msg('Spent'),
  REFUND: msg('Returned'),
  ADJUSTMENT: msg('By hand'),
};

const STATUS: Record<
  GiftCardStatus,
  { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }
> = {
  ACTIVE: { label: msg('Active'), tone: 'success' },
  DEPLETED: { label: msg('Fully spent'), tone: 'neutral' },
  EXPIRED: { label: msg('Lapsed'), tone: 'warning' },
  DISABLED: { label: msg('Cancelled'), tone: 'danger' },
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
    await once({
      orgId,
      key: ['adjust-card', id, String(formData.get('once') ?? '')],
      work: () =>
        adjustGiftCard({
          orgId,
          userId: user.userId,
          giftCardId: id,
          amountMinor: direction === 'DOWN' ? -amountMinor : amountMinor,
          reason: String(formData.get('reason') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/gift-cards/${id}?problem=${encodeURIComponent(error.message)}`);
    }
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
  const { orgId, user, region } = await requireSession('payment:read');
  const t = await tFor();

  const card = await giftCardDetail(orgId, id);
  if (!card) notFound();

  const mayChange = can(user.role, 'payment:write') && card.status !== 'DISABLED';

  // A key for this drawing of the page; every press of the adjust button
  // carries it, so a correction is made once. Phase 46.
  const token = onceToken();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/gift-cards">{t('All gift cards')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Gift card')}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="datum tracking-[0.15em]">{card.code}</span>
            <Badge tone={STATUS[card.status].tone} dot>
              {t(STATUS[card.status].label)}
            </Badge>
          </span>
        }
        description={
          card.recipientName
            ? t('For {name}', { name: card.recipientName })
            : t('Read the number out in groups of four.')
        }
      />

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'sold'
            ? t(
                'Card sold and booked as owed work, not as revenue. Read the number to the customer or write it on the card.',
              )
            : done === 'adjusted'
              ? t(
                  'Changed, with the reason kept on the card and the books moved by the same amount.',
                )
              : t(
                  'Cancelled. Whatever was on it has been written off with the reason, and the number will not be taken again.',
                )}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('What happened on it')}
              description={t('Oldest first. Every movement says what it was for.')}
            />
            <ul className="divide-y divide-(--border)">
              {card.entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
                  <time className="datum w-24 shrink-0 text-[12px] text-(--text-faint)">
                    {entry.createdAt.toLocaleDateString(region.locale, {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </time>
                  <span className="eyebrow w-16 shrink-0">
                    {t(KIND_LABEL[entry.kind] ?? entry.kind)}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    {entry.invoice ? (
                      <Link href={`/invoices/${entry.invoice.id}`} className="hover:underline">
                        {t(entry.reason)}
                      </Link>
                    ) : entry.counterSale ? (
                      <Link href="/counter" className="hover:underline">
                        {t(entry.reason)}
                      </Link>
                    ) : (
                      t(entry.reason)
                    )}
                    {entry.createdBy ? (
                      <span className="ms-2 text-[11px] text-(--text-faint)">
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
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={entry.amountMinor / 100}
                      signed
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {mayChange ? (
            <Card>
              <CardHeader
                title={t('Change it by hand')}
                description={t(
                  'Money added is a gift from the workshop; money taken off is a card it no longer owes on. The reason stays on the card.',
                )}
              />
              <form action={adjust}>
                <input type="hidden" name="once" value={token} />
                <CardBody className="grid gap-3 sm:grid-cols-[8rem_9rem_minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="id" value={card.id} />
                  <Field label={t('Which way')} htmlFor="adjust-direction">
                    <select
                      id="adjust-direction"
                      name="direction"
                      defaultValue="UP"
                      className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                    >
                      <option value="UP">{t('Add')}</option>
                      <option value="DOWN">{t('Take off')}</option>
                    </select>
                  </Field>
                  <Field label={t('Amount')} htmlFor="adjust-amount">
                    <Input
                      id="adjust-amount"
                      name="amount"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder="5.00"
                      required
                    />
                  </Field>
                  <Field label={t('Why')} htmlFor="adjust-reason">
                    <Input
                      id="adjust-reason"
                      name="reason"
                      required
                      maxLength={200}
                      placeholder={t('Sorry about the wait on Tuesday')}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    {t('Change it')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <Card className={card.status === 'ACTIVE' ? 'border-(--brand)' : undefined}>
            <CardHeader title={t('Where it stands')} />
            <CardBody className="grid gap-3">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-(--text-faint)">{t('Left on the card')}</span>
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={card.balanceMinor / 100}
                  />
                </span>
              </div>
              <KeyValue
                columns={1}
                t={t}
                items={[
                  {
                    label: t('Loaded'),
                    value: (
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={card.loadedMinor / 100}
                      />
                    ),
                  },
                  { label: t('Paid for by'), value: t(TENDER_LABEL[card.method] ?? card.method) },
                  {
                    label: t('Sold'),
                    value: `${card.soldAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}${card.soldBy ? ` ${t('by {name}', { name: card.soldBy.name })}` : ''}`,
                  },
                  {
                    label: t('Good at'),
                    value: card.site ? t('{site} only', { site: card.site }) : t('Every site'),
                  },
                  {
                    label: t('Lasts'),
                    value: card.expiresAt
                      ? t('Until {date}', {
                          date: card.expiresAt.toLocaleDateString(region.locale, {
                            dateStyle: 'medium',
                          }),
                        })
                      : t('For good'),
                  },
                  { label: t('Note'), value: card.note },
                  ...(card.disabledAt
                    ? [
                        {
                          label: t('Cancelled'),
                          value: `${card.disabledAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}: ${card.disabledReason ?? ''}`,
                        },
                      ]
                    : []),
                ]}
              />
              <p className="text-[12px] text-(--text-faint)">
                {t('To spend it, open the invoice and use “{action}”, or take it at the counter.', {
                  action: t('Redeem a gift card'),
                })}
              </p>
            </CardBody>
          </Card>

          {mayChange ? (
            <Card className="border-(--danger)">
              <CardHeader
                title={t('Cancel this card')}
                description={t(
                  'For a card lost, stolen or sold in error. Whatever is on it is written off with the reason. There is no way back.',
                )}
              />
              <form action={cancel}>
                <CardBody className="grid gap-3">
                  <input type="hidden" name="id" value={card.id} />
                  <Field label={t('Why')} htmlFor="cancel-reason">
                    <Input
                      id="cancel-reason"
                      name="reason"
                      required
                      maxLength={200}
                      placeholder={t('Reported lost by the buyer')}
                    />
                  </Field>
                  <Button type="submit" variant="danger">
                    {t('Cancel the card')}
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
