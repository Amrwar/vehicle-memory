import { money, msg, type Region } from '@carnet/core';
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

import { PlanWall } from '@/components/plan-wall';
import { closeTill, completeSale, openTill, recentSales, sellableParts } from '@/lib/counter';
import { findGiftCard, GiftCardError } from '@/lib/giftcards';
import { planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Counter') };
}
export const dynamic = 'force-dynamic';

/**
 * Selling over the counter. FR-2001, FR-2002, FR-2003.
 *
 * A counter queue is not a service desk. Somebody wants a bulb and there are
 * two people behind them, so the whole sale is one form on one screen: pick
 * the part, say how it was paid, done. No draft, no basket to review, no
 * confirmation step.
 *
 * Everything that a job would normally anchor happens behind that one submit:
 * the stock leaves the shelf, the ledger is posted, and the money lands in a
 * till session that has to reconcile at the end of the day.
 */

async function sell(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('invoice:write');

  const productId = String(formData.get('productId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 1);
  const unitPrice = Number(formData.get('unitPrice') ?? 0);
  const tender = String(formData.get('tender') ?? 'CASH') as 'CASH' | 'CARD' | 'GIFT_CARD';
  const given = Number(formData.get('given') ?? 0);
  const cardNumber = String(formData.get('cardNumber') ?? '');

  const [part] = productId
    ? await sellableParts(orgId, user.locationId, undefined).then((parts) =>
        parts.filter((candidate) => candidate.id === productId),
      )
    : [];

  const description = part?.name ?? String(formData.get('description') ?? 'Counter item');
  const price = unitPrice > 0 ? unitPrice : Number(part?.sellPrice ?? 0);
  const total = price * quantity * 1.2;
  const totalMinor = Math.round(total * 100);

  // A gift card pays what it can; whatever is left is cash. Looked up here
  // so the person at the counter is told the card's state before the sale,
  // not after the stock has moved.
  let tenders: {
    kind: 'CASH' | 'CARD' | 'GIFT_CARD';
    amount: ReturnType<typeof money>;
    code?: string;
  }[];
  if (tender === 'GIFT_CARD') {
    let fromCard = 0;
    try {
      const card = await findGiftCard(orgId, cardNumber);
      fromCard = Math.min(card.balanceMinor, totalMinor);
      if (fromCard <= 0) throw new GiftCardError('EMPTY', 'There is nothing left on that card.');
    } catch (error) {
      if (!(error instanceof GiftCardError)) throw error;
      redirect(`/counter?error=${encodeURIComponent(error.message)}`);
    }
    tenders = [{ kind: 'GIFT_CARD', amount: money(fromCard), code: cardNumber }];
    if (fromCard < totalMinor) {
      const rest = totalMinor - fromCard;
      tenders.push({ kind: 'CASH', amount: money(Math.max(rest, Math.round(given * 100))) });
    }
  } else {
    tenders = [
      {
        kind: tender,
        // Cash can be over-tendered; a card is always the exact amount.
        amount: money(Math.round((tender === 'CASH' ? given || total : total) * 100)),
      },
    ];
  }

  const result = await completeSale({
    orgId,
    locationId: user.locationId,
    userId: user.userId,
    lines: [
      {
        productId: productId || null,
        kind: productId ? 'PART' : 'FEE',
        description,
        quantity,
        unitPrice: price,
      },
    ],
    tenders,
  });

  redirect(
    result.ok
      ? `/counter?sold=${result.reference}&change=${result.changeMinor ?? 0}`
      : `/counter?error=${encodeURIComponent(result.error ?? msg('That sale could not be taken.'))}`,
  );
}

async function close(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('invoice:write');

  await closeTill({
    orgId,
    sessionId: String(formData.get('sessionId') ?? ''),
    countedMinor: Math.round(Number(formData.get('counted') ?? 0) * 100),
    userId: user.userId,
    note: String(formData.get('note') ?? ''),
  });

  redirect('/counter?closed=1');
}

export default async function CounterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, user, plan, region } = await requireSession('invoice:write');

  if (!planIncludes(plan, 'inventory')) {
    return <PlanWall feature="inventory" plan={plan} />;
  }

  const params = await searchParams;
  const t = await tFor();

  const [till, sales, parts] = await Promise.all([
    openTill(orgId, user.locationId),
    recentSales(orgId, 12),
    sellableParts(orgId, user.locationId),
  ]);

  const todaysTotal = sales
    .filter((sale) => sale.soldAt && isToday(sale.soldAt))
    .reduce((total, sale) => total + Math.round(Number(sale.total) * 100), 0);

  return (
    <>
      <PageHeader
        eyebrow={t('Counter')}
        title={t('Over the counter')}
        description={t('A sale with no job behind it')}
        actions={
          <Link href="/parts">
            <Button size="sm" variant="ghost">
              {t('Parts')}
            </Button>
          </Link>
        }
      />

      {params.error ? (
        <Alert tone="danger" className="mb-5">
          {t(params.error)}
        </Alert>
      ) : null}

      {params.sold ? (
        <Alert tone="success" className="mb-5">
          {Number(params.change ?? 0) > 0
            ? t('{reference} taken. Change {change}.', {
                reference: params.sold,
                change: formatMoney(Number(params.change) / 100, region),
              })
            : t('{reference} taken.', { reference: params.sold })}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Taken today')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={todaysTotal / 100} />
          }
          note={t('Counter sales only')}
        />
        <StatTile
          label={t('Cash in the drawer')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={(till?.expectedMinor ?? 0) / 100}
            />
          }
          note={till ? t('Float plus takings') : t('No till open')}
        />
        <StatTile
          label={t('On card')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={(till?.cardMinor ?? 0) / 100}
            />
          }
          note={t('Settles with the processor')}
        />
        <StatTile
          label={t('Sales this session')}
          value={till?.saleCount ?? 0}
          note={t('Since the till opened')}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title={t('New sale')} description={t('One screen, one submit')} />
            <CardBody>
              <form action={sell} className="grid gap-3.5">
                <Field label={t('Part')} hint={t('Or leave blank and describe it')}>
                  <Select name="productId" defaultValue="">
                    <option value="">{t('Something not in the catalogue')}</option>
                    {parts.map((part) => {
                      const onHand = part.stockLevels.reduce(
                        (total, level) => total + Number(level.onHand),
                        0,
                      );

                      return (
                        <option key={part.id} value={part.id}>
                          {part.partNumber} — {part.name} ({t('{count} on hand', { count: onHand })}
                          )
                        </option>
                      );
                    })}
                  </Select>
                </Field>

                <Field label={t('Description')} hint={t('Used when no part is chosen')}>
                  <Input name="description" placeholder={t('Wiper blade, generic')} />
                </Field>

                <div className="grid grid-cols-2 gap-3.5">
                  <Field label={t('Quantity')}>
                    <Input
                      name="quantity"
                      type="number"
                      min={1}
                      step="1"
                      defaultValue="1"
                      required
                    />
                  </Field>

                  <Field label={t('Price each')} hint={t('Blank uses the catalogue')}>
                    <Input name="unitPrice" type="number" min={0} step="0.01" placeholder="0.00" />
                  </Field>
                </div>

                <Field label={t('Paid by')}>
                  <Select name="tender" defaultValue="CASH">
                    <option value="CASH">{t('Cash')}</option>
                    <option value="CARD">{t('Card')}</option>
                    <option value="GIFT_CARD">{t('Gift card, the rest in cash')}</option>
                  </Select>
                </Field>

                <Field
                  label={t('Gift card number')}
                  hint={t('Only for a gift card. Read it off the card.')}
                >
                  <Input
                    name="cardNumber"
                    maxLength={14}
                    autoCapitalize="characters"
                    className="datum uppercase tracking-[0.12em]"
                    // i18n-ignore
                    placeholder="XXXX-XXXX-XXXX"
                  />
                </Field>

                <Field label={t('Cash given')} hint={t('Leave blank for the exact amount')}>
                  <Input name="given" type="number" min={0} step="0.01" placeholder="20.00" />
                </Field>

                <Button type="submit" variant="primary" size="touch" block>
                  {t('Take the sale')}
                </Button>

                <p className="text-[12px] leading-relaxed text-(--text-faint)">
                  {t(
                    'The stock comes off the shelf and the ledger is posted as part of this one submit. There is no job to do it later.',
                  )}
                </p>
              </form>
            </CardBody>
          </Card>

          {till ? (
            <Card>
              <CardHeader
                title={t('Close the till')}
                description={t('Open since {time}', {
                  time: till.session.openedAt.toLocaleTimeString(region.locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              />
              <CardBody>
                <dl className="mb-3 grid gap-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-(--text-faint)">{t('Opening float')}</dt>
                    <dd>
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(till.session.openingFloat)}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-(--text-faint)">{t('Cash taken')}</dt>
                    <dd>
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={till.cashMinor / 100}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-(--border) pt-1.5 font-medium">
                    <dt>{t('Should be in the drawer')}</dt>
                    <dd>
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={till.expectedMinor / 100}
                      />
                    </dd>
                  </div>
                </dl>

                <form action={close} className="grid gap-3">
                  <input type="hidden" name="sessionId" value={till.session.id} />

                  <Field label={t('Counted')} hint={t('What is actually there')}>
                    <Input name="counted" type="number" min={0} step="0.01" required />
                  </Field>

                  <Field label={t('Note')} hint={t('Optional')}>
                    <Input
                      name="note"
                      placeholder={t('Twenty short, checking the card machine.')}
                    />
                  </Field>

                  <Button type="submit" block>
                    {t('Close and record the count')}
                  </Button>
                </form>

                <p className="mt-2.5 text-[12px] leading-relaxed text-(--text-faint)">
                  {t(
                    'The difference is recorded, not absorbed. A drawer that agrees with itself every evening is a formality, not a control.',
                  )}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <Card className="overflow-hidden">
          <CardHeader title={t('Recent sales')} description={t('Newest first')} />
          {sales.length === 0 ? (
            <EmptyState
              title={t('Nothing sold over the counter yet')}
              description={t('The first sale opens a till session.')}
            />
          ) : (
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Receipt')}</Th>
                    <Th>{t('What')}</Th>
                    <Th>{t('Paid by')}</Th>
                    <Th>{t('Sold by')}</Th>
                    <Th numeric>{t('Total')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <Tr key={sale.id}>
                      <Td className="datum font-medium">{sale.reference}</Td>
                      <Td className="text-(--text-soft)">
                        {sale.lines[0]?.description ?? '—'}
                        {sale.lines.length > 1 ? (
                          <span className="text-(--text-faint)">
                            {` +${sale.lines.length - 1}`}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {sale.tenders.map((tender) => (
                          <Badge key={tender.id} tone="neutral" size="sm" className="me-1">
                            {t(tender.kind.toLowerCase().replace('_', ' '))}
                          </Badge>
                        ))}
                      </Td>
                      <Td className="text-(--text-faint)">{sale.soldBy?.name ?? '—'}</Td>
                      <Td numeric className="font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(sale.total)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatMoney(value: number, region: Region): string {
  return new Intl.NumberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
  }).format(value);
}
