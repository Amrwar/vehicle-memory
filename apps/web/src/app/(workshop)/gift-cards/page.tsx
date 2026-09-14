import { GIFT_CARD_MAX_MINOR, GIFT_CARD_MIN_MINOR, type GiftCardTender } from '@carnet/core';
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

import { GiftCardError, giftCardsFor, sellGiftCard } from '@/lib/giftcards';
import { can, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Gift cards' };
export const dynamic = 'force-dynamic';

/**
 * Gift cards: sold here, spent on an invoice.
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

async function sell(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');

  const pounds = Number(String(formData.get('amount') ?? '').replace(/[£,\s]/g, ''));
  const method = String(formData.get('method') ?? 'CARD');

  let sold: { id: string };
  try {
    sold = await sellGiftCard({
      orgId,
      userId: user.userId,
      amountMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
      method: TENDERS.some((t) => t.value === method) ? method : 'CARD',
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

  const cards = await giftCardsFor(orgId);
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
          note={`${cards.cards.length} sold in all`}
        />
        <StatTile
          label="Sold"
          value={<Money amount={cards.soldMinor / 100} />}
          note="Taken when the cards were bought"
        />
        <StatTile
          label="Spent"
          value={<Money amount={cards.spentMinor / 100} />}
          note="Put against bills since"
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
                    <Th numeric>Loaded</Th>
                    <Th numeric>Left</Th>
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
                      <Td numeric>
                        <Money amount={card.loadedMinor / 100} />
                      </Td>
                      <Td numeric>
                        {card.voided ? (
                          <Badge tone="neutral" size="sm">
                            Cancelled
                          </Badge>
                        ) : card.balanceMinor === 0 ? (
                          <Badge tone="neutral" size="sm">
                            Spent
                          </Badge>
                        ) : (
                          <span className="font-medium">
                            <Money amount={card.balanceMinor / 100} />
                          </span>
                        )}
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
