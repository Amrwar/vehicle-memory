import {
  GIFT_CARD_MAX_MINOR,
  GIFT_CARD_MIN_MINOR,
  GIFT_CARD_TERMS_MONTHS,
  type GiftCardStatus,
  type GiftCardTender,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
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
import { can, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Gift cards' };
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
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const STATUS: Record<
  GiftCardStatus,
  { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }
> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  DEPLETED: { label: 'Spent', tone: 'neutral' },
  EXPIRED: { label: 'Lapsed', tone: 'warning' },
  DISABLED: { label: 'Cancelled', tone: 'danger' },
};

async function sell(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');

  const pounds = Number(String(formData.get('amount') ?? '').replace(/[£,\s]/g, ''));
  const method = String(formData.get('method') ?? 'CARD');
  const term = String(formData.get('term') ?? '');
  const site = String(formData.get('locationId') ?? '');

  let sold: { id: string };
  try {
    sold = await sellGiftCard({
      orgId,
      userId: user.userId,
      amountMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
      method: TENDERS.some((t) => t.value === method) ? method : 'CARD',
      termMonths: term ? Number(term) : null,
      locationId: site || null,
      recipientName: String(formData.get('recipientName') ?? ''),
      note: String(formData.get('note') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof GiftCardError)) throw error;
    redirect(`/gift-cards?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/gift-cards/${sold.id}?done=sold`);
}

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { orgId, user } = await requireSession('payment:read');
  const { problem } = await searchParams;

  const [cards, sites] = await Promise.all([giftCardsFor(orgId), sitesFor(orgId)]);
  const maySell = can(user.role, 'payment:write');

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Gift cards"
        description="Money taken in advance. Owed as work until it is spent."
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {problem}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label="Outstanding"
          value={<Money amount={cards.outstandingMinor / 100} />}
          tone={cards.outstandingMinor > 0 ? 'warning' : 'neutral'}
          note="What the workshop owes as work"
        />
        <StatTile
          label="Cards with money on"
          value={cards.withBalance}
          note={
            cards.lapsingSoon > 0
              ? `${cards.lapsingSoon} lapse within sixty days`
              : `${cards.cards.length} sold in all`
          }
          tone={cards.lapsingSoon > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Sold"
          value={<Money amount={cards.soldMinor / 100} />}
          note="Taken when the cards were bought"
        />
        <StatTile
          label="Spent"
          value={<Money amount={cards.spentMinor / 100} />}
          note="Put against bills and counter sales"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Every card"
            description="Newest first. Open one to see what happened on it."
          />
          {cards.cards.length === 0 ? (
            <EmptyState
              title="No cards sold yet"
              description="The first one sold here appears with its number and what is left on it."
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Number</Th>
                    <Th>Sold</Th>
                    <Th>For</Th>
                    <Th>Good</Th>
                    <Th numeric>Loaded</Th>
                    <Th numeric>Left</Th>
                    <Th>Status</Th>
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
                        {card.soldAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                        {card.soldBy ? (
                          <span className="text-(--text-faint)"> · {card.soldBy}</span>
                        ) : null}
                      </Td>
                      <Td>{card.recipientName ?? '—'}</Td>
                      <Td className="text-(--text-soft)">
                        {card.site ? `At ${card.site}` : 'Everywhere'}
                        {card.expiresAt
                          ? ` · until ${card.expiresAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}`
                          : ''}
                      </Td>
                      <Td numeric>
                        <Money amount={card.loadedMinor / 100} />
                      </Td>
                      <Td numeric>
                        <span
                          className={card.balanceMinor > 0 ? 'font-medium' : 'text-(--text-faint)'}
                        >
                          <Money amount={card.balanceMinor / 100} />
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={STATUS[card.status].tone} size="sm">
                          {STATUS[card.status].label}
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
              title="Sell a card"
              description={`Whole pounds, ${GIFT_CARD_MIN_MINOR / 100} to ${(GIFT_CARD_MAX_MINOR / 100).toLocaleString('en-GB')}. Paid for with money, never with points.`}
            />
            <form action={sell}>
              <CardBody className="grid gap-3">
                <Field label="Amount" htmlFor="sell-amount">
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
                <Field label="How they paid" htmlFor="sell-method">
                  <Select id="sell-method" name="method" defaultValue="CARD">
                    {TENDERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Lasts"
                  hint="Most cards should not lapse. A card that lapses is money paid for nothing."
                  htmlFor="sell-term"
                >
                  <Select id="sell-term" name="term" defaultValue="">
                    <option value="">For good</option>
                    {GIFT_CARD_TERMS_MONTHS.map((months) => (
                      <option key={months} value={months}>
                        {months === 12 ? 'A year' : `${months / 12} years`}
                      </option>
                    ))}
                  </Select>
                </Field>
                {sites.length > 1 ? (
                  <Field label="Good at" htmlFor="sell-site">
                    <Select id="sell-site" name="locationId" defaultValue="">
                      <option value="">Every site</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} only
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label="For" hint="Optional. Who it is a present for" htmlFor="sell-for">
                  <Input id="sell-for" name="recipientName" maxLength={120} placeholder="Dad" />
                </Field>
                <Field label="Note" hint="Optional" htmlFor="sell-note">
                  <Input id="sell-note" name="note" maxLength={200} />
                </Field>
                <Button type="submit" variant="primary">
                  Sell the card
                </Button>
              </CardBody>
            </form>
          </Card>
        ) : null}
      </div>
    </>
  );
}
