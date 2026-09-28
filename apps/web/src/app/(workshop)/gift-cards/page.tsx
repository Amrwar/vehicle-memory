import {
  GIFT_CARD_MAX_MINOR,
  GIFT_CARD_MIN_MINOR,
  GIFT_CARD_TERMS_MONTHS,
  type GiftCardStatus,
  msg,
  type GiftCardTender,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Money,
  PageHeader,
  Select,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GiftCardError, giftCardsFor, sellGiftCard, sitesFor } from '@/lib/giftcards';
import { once, onceToken, StillGoingError } from '@/lib/once';
import { SubmitOnce } from '@/components/submit-once';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Gift cards') };
}
export const dynamic = 'force-dynamic';

/**
 * Gift cards: sold here, spent on an invoice or at the counter.
 *
 * The figure this page leads with is what the workshop owes, because that is
 * what a gift card is. Money taken for work not yet done is a liability, and
 * a workshop that reads the sales figure as income has a good December and a
 * confusing January.
 */
const TENDERS: { value: GiftCardTender; label: string }[] = [
  { value: 'CARD', label: msg('Card') },
  { value: 'CASH', label: msg('Cash') },
  { value: 'BANK_TRANSFER', label: msg('Bank transfer') },
  { value: 'ONLINE', label: msg('Online') },
  { value: 'CHEQUE', label: msg('Cheque') },
];

const STATUS: Record<
  GiftCardStatus,
  { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }
> = {
  ACTIVE: { label: msg('Active#card'), tone: 'success' },
  DEPLETED: { label: msg('Spent'), tone: 'neutral' },
  EXPIRED: { label: msg('Lapsed'), tone: 'warning' },
  DISABLED: { label: msg('Cancelled#card'), tone: 'danger' },
};

async function sell(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');

  const pounds = Number(String(formData.get('amount') ?? '').replace(/[£,\s]/g, ''));
  const method = String(formData.get('method') ?? 'CARD');
  const term = String(formData.get('term') ?? '');
  const site = String(formData.get('locationId') ?? '');

  // One press, one card. Each sale mints a new code, so a second press does
  // not collide with the first — it sells another card, takes the money
  // again, and puts a second liability on the books. Phase 46.
  let sold: { id?: string } = {};
  try {
    const taken = await once({
      orgId,
      key: ['sell-card', String(formData.get('once') ?? '')],
      resultOf: (card) => card.id,
      work: () =>
        sellGiftCard({
          orgId,
          userId: user.userId,
          amountMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
          method: TENDERS.some((tender) => tender.value === method) ? method : 'CARD',
          termMonths: term ? Number(term) : null,
          locationId: site || null,
          recipientName: String(formData.get('recipientName') ?? ''),
          note: String(formData.get('note') ?? ''),
        }),
    });

    sold = { id: taken.result?.id ?? taken.resultRef ?? undefined };
  } catch (error) {
    if (error instanceof StillGoingError) {
      redirect(`/gift-cards?problem=${encodeURIComponent(error.message)}`);
    }
    if (!(error instanceof GiftCardError)) throw error;
    redirect(`/gift-cards?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(sold.id ? `/gift-cards/${sold.id}?done=sold` : '/gift-cards?done=sold');
}

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { orgId, user, region } = await requireSession('payment:read');
  const t = await tFor();
  const { problem } = await searchParams;

  const [cards, sites] = await Promise.all([giftCardsFor(orgId), sitesFor(orgId)]);
  const maySell = can(user.role, 'payment:write');

  // A key for this drawing of the form; every press of the button carries it.
  const token = onceToken();

  return (
    <>
      <PageHeader
        eyebrow={t('Money')}
        title={t('Gift cards')}
        description={t('Money taken in advance. Owed as work until it is spent.')}
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Outstanding')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={cards.outstandingMinor / 100}
            />
          }
          tone={cards.outstandingMinor > 0 ? 'warning' : 'neutral'}
          note={t('What the workshop owes as work')}
        />
        <StatTile
          label={t('Cards with money on')}
          value={cards.withBalance}
          note={
            cards.lapsingSoon > 0
              ? t('{count} lapse within sixty days', { count: cards.lapsingSoon })
              : t('{count} sold in all', { count: cards.cards.length })
          }
          tone={cards.lapsingSoon > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label={t('Sold')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={cards.soldMinor / 100}
            />
          }
          note={t('Taken when the cards were bought')}
        />
        <StatTile
          label={t('Spent')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={cards.spentMinor / 100}
            />
          }
          note={t('Put against bills and counter sales')}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Every card')}
            description={t('Newest first. Open one to see what happened on it.')}
          />
          {cards.cards.length === 0 ? (
            <EmptyState
              title={t('No cards sold yet')}
              description={t(
                'The first one sold here appears with its number and what is left on it.',
              )}
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Number')}</Th>
                    <Th>{t('Sold')}</Th>
                    <Th>{t('For')}</Th>
                    <Th>{t('Valid until')}</Th>
                    <Th numeric>{t('Loaded')}</Th>
                    <Th numeric>{t('Remaining')}</Th>
                    <Th>{t('Status')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {cards.cards.map((card) => (
                    <Tr key={card.id}>
                      <Td>
                        <Link
                          href={`/gift-cards/${card.id}`}
                          className="datum font-medium tracking-[0.12em] hover:underline"
                        >
                          {card.code}
                        </Link>
                      </Td>
                      <Td>
                        {card.soldAt.toLocaleDateString(region.locale, { dateStyle: 'medium' })}
                        {card.soldBy ? (
                          <span className="text-(--text-faint)"> · {card.soldBy}</span>
                        ) : null}
                      </Td>
                      <Td>{card.recipientName ?? '—'}</Td>
                      <Td className="text-(--text-soft)">
                        {card.site ? t('At {site}', { site: card.site }) : t('Everywhere')}
                        {card.expiresAt
                          ? ` · ${t('until {date}', {
                              date: card.expiresAt.toLocaleDateString(region.locale, {
                                dateStyle: 'medium',
                              }),
                            })}`
                          : ''}
                      </Td>
                      <Td numeric>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={card.loadedMinor / 100}
                        />
                      </Td>
                      <Td numeric>
                        <span
                          className={card.balanceMinor > 0 ? 'font-medium' : 'text-(--text-faint)'}
                        >
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={card.balanceMinor / 100}
                          />
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={STATUS[card.status].tone} size="sm">
                          {t(STATUS[card.status].label)}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {maySell ? (
          <Card className="border-(--brand) self-start">
            <CardHeader
              title={t('Sell a card')}
              description={t(
                'Whole pounds, {min} to {max}. Paid for with money, never with points.',
                {
                  min: GIFT_CARD_MIN_MINOR / 100,
                  max: (GIFT_CARD_MAX_MINOR / 100).toLocaleString(region.locale),
                },
              )}
            />
            <form action={sell}>
              <CardBody className="grid gap-3">
                <input type="hidden" name="once" value={token} />
                <Field label={t('Amount')} htmlFor="sell-amount">
                  <Input
                    id="sell-amount"
                    name="amount"
                    type="number"
                    inputMode="numeric"
                    min={GIFT_CARD_MIN_MINOR / 100}
                    max={GIFT_CARD_MAX_MINOR / 100}
                    step={1}
                    defaultValue={50}
                    className="tabular-nums"
                    required
                  />
                </Field>
                <Field label={t('How they paid')} htmlFor="sell-method">
                  <Select id="sell-method" name="method" defaultValue="CARD">
                    {TENDERS.map((tender) => (
                      <option key={tender.value} value={tender.value}>
                        {t(tender.label)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t('Lasts')}
                  hint={t(
                    'Most cards should not lapse. A card that lapses is money paid for nothing.',
                  )}
                  htmlFor="sell-term"
                >
                  <Select id="sell-term" name="term" defaultValue="">
                    <option value="">{t('For good')}</option>
                    {GIFT_CARD_TERMS_MONTHS.map((months) => (
                      <option key={months} value={months}>
                        {months === 12 ? t('A year') : t('{years} years', { years: months / 12 })}
                      </option>
                    ))}
                  </Select>
                </Field>
                {sites.length > 1 ? (
                  <Field label={t('Good at')} htmlFor="sell-site">
                    <Select id="sell-site" name="locationId" defaultValue="">
                      <option value="">{t('Every site')}</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {t('{site} only', { site: site.name })}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field
                  label={t('For')}
                  hint={t('Optional. Who it is a present for')}
                  htmlFor="sell-for"
                >
                  <Input
                    id="sell-for"
                    name="recipientName"
                    maxLength={120}
                    placeholder={t('Dad')}
                  />
                </Field>
                <Field label={t('Note')} hint={t('Optional')} htmlFor="sell-note">
                  <Input id="sell-note" name="note" maxLength={200} />
                </Field>
                <SubmitOnce>{t('Sell the card')}</SubmitOnce>
              </CardBody>
            </form>
          </Card>
        ) : null}
      </div>
    </>
  );
}
