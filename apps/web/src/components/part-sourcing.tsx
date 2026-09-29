import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';

import { tFor } from '@/lib/i18n';
import type { whereToBuy } from '@/lib/sourcing';

/**
 * Where to buy this part.
 *
 * Four columns because a buyer asks four questions, and price is only the
 * first of them. The recommendation is one row with a mark on it, and
 * directly beneath it — never hidden behind a tooltip — the cheaper offer it
 * passed over and what that would have saved. A screen that quietly picks the
 * dearer supplier gets overruled the first time somebody notices and is never
 * trusted again.
 *
 * Old prices are marked rather than hidden. A workshop with nothing but
 * two-year-old prices still has to buy the part today; what it must not do is
 * quote a customer from one without knowing.
 *
 * Phase 87.
 */
export async function PartSourcing({
  where,
  suppliers,
  currency,
  canWrite,
  productId,
  save,
  retire,
}: {
  where: Awaited<ReturnType<typeof whereToBuy>>;
  suppliers: { id: string; name: string }[];
  currency: string;
  canWrite: boolean;
  productId: string;
  save: (formData: FormData) => Promise<void>;
  retire: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();

  const money = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

  return (
    <Card id="sourcing">
      <CardHeader
        title={t('Where to buy it')}
        description={t(
          'What it costs, whether they have it, when it gets here and how long they stand behind it. The cheapest that arrives in time is the one marked.',
        )}
      />

      <CardBody className="grid gap-4">
        {where ? (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>{t('Supplier')}</Th>
                    <Th numeric>{t('Price')}</Th>
                    <Th>{t('Stock')}</Th>
                    <Th>{t('Delivery#wait')}</Th>
                    <Th>{t('Warranty')}</Th>
                    <Th>{t('Their record')}</Th>
                    <Th>{t('Confirmed#date')}</Th>
                    <Th> </Th>
                  </Tr>
                </thead>
                <tbody>
                  {where.all.map((offer) => (
                    <Tr key={offer.supplierId}>
                      <Td>
                        <span className="font-medium">{offer.supplierName}</span>
                        {offer.supplierId === where.pick.supplierId ? (
                          <Badge tone="success" className="ms-2">
                            {t('Buy here')}
                          </Badge>
                        ) : null}
                        {offer.supplierPartNumber ? (
                          <span className="datum ms-2 text-[11px] text-(--text-faint)">
                            {offer.supplierPartNumber}
                          </span>
                        ) : null}
                      </Td>
                      <Td numeric>{money(offer.price)}</Td>
                      <Td>
                        {offer.inStock === null
                          ? t('Not said')
                          : offer.inStock
                            ? t('On their shelf')
                            : t('To order')}
                      </Td>
                      <Td>
                        {offer.leadTimeDays === null ? (
                          t('Not said')
                        ) : offer.arrival === 'TOO_LATE' ? (
                          <span className="text-(--danger-text)">
                            {t('{count}d — too late', { count: offer.leadTimeDays })}
                          </span>
                        ) : (
                          t('{count}d', { count: offer.leadTimeDays })
                        )}
                      </Td>
                      <Td>
                        {offer.warrantyMonths === null
                          ? t('Not said')
                          : t('{count} months', { count: offer.warrantyMonths })}
                      </Td>
                      <Td>
                        {/* What they say, beside what they have done. A
                            next-day promise from somebody who keeps it two
                            thirds of the time is not a next-day promise. */}
                        {offer.record === 'UNMEASURED' ? (
                          // Two different silences, and calling both of them
                          // "never ordered" was a lie on the screen the first
                          // time this was looked at: a supplier with two
                          // orders behind them has been ordered from, and
                          // `measureSupplier` simply refuses to state a share
                          // under three. Say which silence it is.
                          <span className="text-(--text-faint)">
                            {offer.ordersBehindIt === 0
                              ? t('Never ordered')
                              : t('Too few orders to say')}
                          </span>
                        ) : (
                          <span
                            className={
                              offer.record === 'SLIPS' ? 'text-(--warning-text)' : undefined
                            }
                          >
                            {t('On time {pct}% of {count}', {
                              pct: offer.onTimePct ?? 0,
                              count: offer.ordersBehindIt,
                            })}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className={offer.stale ? 'text-(--warning-text)' : undefined}>
                          {offer.confirmedAt.toISOString().slice(0, 10)}
                          {offer.stale ? ` · ${t('old')}` : ''}
                        </span>
                      </Td>
                      <Td>
                        {canWrite ? (
                          <form action={retire}>
                            <input type="hidden" name="rowId" value={offer.rowId} />
                            <Button type="submit" variant="ghost" className="text-[12px]">
                              {t('Remove')}
                            </Button>
                          </form>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>

            {where.cheaper ? (
              <p className="rounded-(--radius-md) border border-(--border) p-2.5 text-[13px]">
                {where.passedOver === 'TOO_LATE'
                  ? t(
                      '{supplier} is {amount} cheaper but would arrive after the car is promised.',
                      {
                        supplier: where.cheaper.supplierName,
                        amount: money(where.saving),
                      },
                    )
                  : t('{supplier} is {amount} cheaper but has not said when they could deliver.', {
                      supplier: where.cheaper.supplierName,
                      amount: money(where.saving),
                    })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-(--text-faint)">
            {t('No supplier has been priced for this part yet.')}
          </p>
        )}

        {canWrite && suppliers.length > 0 ? (
          <form action={save} className="grid gap-2 border-t border-(--border) pt-3 md:grid-cols-6">
            <input type="hidden" name="productId" value={productId} />
            <Select name="supplierId" required aria-label={t('Supplier')} defaultValue="">
              <option value="" disabled>
                {t('Supplier')}
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            <Input
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder={t('Price')}
              aria-label={t('Price')}
            />
            <Select name="inStock" defaultValue="" aria-label={t('Stock')}>
              <option value="">{t('Stock not said')}</option>
              <option value="yes">{t('On their shelf')}</option>
              <option value="no">{t('To order')}</option>
            </Select>
            <Input
              name="leadTimeDays"
              type="number"
              min="0"
              max="365"
              placeholder={t('Days')}
              aria-label={t('Delivery#wait')}
            />
            <Input
              name="warrantyMonths"
              type="number"
              min="0"
              max="600"
              placeholder={t('Warranty months')}
              aria-label={t('Warranty')}
            />
            <Button type="submit" variant="secondary">
              {t('Save the price')}
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
