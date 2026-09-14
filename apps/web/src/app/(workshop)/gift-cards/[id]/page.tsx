import { Alert, Badge, Card, CardBody, CardHeader, KeyValue, Money, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { giftCardDetail } from '@/lib/giftcards';
import { requireSession } from '@/lib/guard';

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

/**
 * One card: its number, what is left, and every movement on it. The number
 * is large because this is the page somebody reads it from over the phone.
 */
export default async function GiftCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const { orgId } = await requireSession('payment:read');

  const card = await giftCardDetail(orgId, id);
  if (!card) notFound();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/gift-cards">All gift cards</BackLink>
      </div>

      <PageHeader
        eyebrow="Gift card"
        title={<span className="datum tracking-[0.15em]">{card.code}</span>}
        description={
          card.recipientName
            ? `For ${card.recipientName}`
            : 'Read the number out in groups of four.'
        }
      />

      {done === 'sold' ? (
        <Alert tone="success" className="mb-5">
          Card sold and booked as owed work, not as revenue. Read the number to the customer or
          write it on the card.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <CardHeader title="What happened on it" description="Oldest first." />
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
                <span className="min-w-0 flex-1 text-[13px]">
                  {entry.invoice ? (
                    <Link href={`/invoices/${entry.invoice.id}`} className="hover:underline">
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

        <aside className="grid content-start gap-5">
          <Card
            className={card.balanceMinor > 0 && !card.voidedAt ? 'border-(--brand)' : undefined}
          >
            <CardHeader title="Where it stands" />
            <CardBody className="grid gap-3">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-(--text-faint)">Left on the card</span>
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  <Money amount={card.balanceMinor / 100} />
                </span>
              </div>
              {card.voidedAt ? (
                <Badge tone="neutral">Cancelled</Badge>
              ) : card.balanceMinor === 0 ? (
                <Badge tone="neutral">Fully spent</Badge>
              ) : null}
              <KeyValue
                columns={1}
                items={[
                  { label: 'Loaded', value: <Money amount={card.loadedMinor / 100} /> },
                  { label: 'Paid for by', value: TENDER_LABEL[card.method] ?? card.method },
                  {
                    label: 'Sold',
                    value: `${card.soldAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}${card.soldBy ? ` by ${card.soldBy.name}` : ''}`,
                  },
                  { label: 'Note', value: card.note },
                ]}
              />
              <p className="text-[12px] text-(--text-faint)">
                To spend it, open the invoice and use &ldquo;Redeem a gift card&rdquo;.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
