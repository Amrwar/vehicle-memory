import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  Registration,
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

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { warrantyBook } from '@/lib/warranty';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Warranty') };
}
export const dynamic = 'force-dynamic';

/**
 * What the workshop is standing behind. FR-3001.
 *
 * The thing this page exists to stop is quiet and expensive. A workshop
 * replaces a part under its own warranty while the supplier's warranty on the
 * same part is still running, absorbs the cost, and never claims it back.
 * Nothing in an ordinary system points that out, because nothing holds both
 * dates in one place.
 *
 * So the figure at the top is not the value of the claims. It is the part of
 * them nobody else will cover, which is the only number that comes out of the
 * workshop's own pocket.
 */
function date(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function WarrantyPage() {
  const { orgId, region } = await requireSession('job:read');
  const t = await tFor();

  const book = await warrantyBook(orgId);

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Warranty')}
        description={t('What is still covered, what is running out, and who should be paying')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Under cover')}
          value={book.active.length}
          note={t('{count} on record', { count: book.all.length })}
        />
        <StatTile
          label={t('Running out')}
          value={book.expiring.length}
          tone={book.expiring.length > 0 ? 'warning' : 'neutral'}
          note={t('Inside the next month')}
        />
        <StatTile
          label={t('Open claims')}
          value={book.openClaims.length}
          tone={book.openClaims.length > 0 ? 'brand' : 'neutral'}
          note={t('Not yet settled')}
        />
        <StatTile
          label={t('Carrying')}
          value={<Money currency={region.currency} locale={region.locale} amount={book.exposure} />}
          tone={book.exposure > 0 ? 'danger' : 'neutral'}
          note={t('What nobody else will cover')}
        />
      </StatRow>

      {book.expiring.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {book.expiring.length === 1
                ? t('1 warranty runs out within a month.')
                : t('{count} warranties run out within a month.', {
                    count: book.expiring.length,
                  })}
            </strong>{' '}
            {t(
              'A vehicle whose cover is about to lapse is a reason to get it in while the workshop is still the one who would put it right.',
            )}
          </CardBody>
        </Card>
      ) : null}

      {book.openClaims.length > 0 ? (
        <Card className="mb-5 overflow-hidden">
          <CardHeader
            title={t('Claims nobody has settled')}
            description={t(
              'Each one is money sitting with a supplier who has not been chased, or a cost the workshop has already absorbed.',
            )}
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What failed')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Complaint')}</Th>
                  <Th numeric>{t('Recoverable')}</Th>
                  <Th numeric>{t('On us')}</Th>
                </tr>
              </thead>
              <tbody>
                {book.openClaims.map((entry) => {
                  const claim = entry.row.claims.find((row) => row.status === 'OPEN')!;

                  return (
                    <Tr key={claim.id}>
                      <Td className="font-medium">{entry.row.description}</Td>
                      <Td>
                        <Link
                          href={`/vehicles/${entry.row.vehicle.id}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {entry.row.vehicle.make} {entry.row.vehicle.model}
                        </Link>
                      </Td>
                      <Td className="text-[12px] text-(--text-soft)">
                        {claim.complaint}
                        {claim.outsideCover ? (
                          <Badge tone="warning" size="sm" className="ms-2">
                            {t('goodwill')}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td numeric className="text-(--success)">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(claim.recoverable)}
                        />
                      </Td>
                      <Td numeric className="font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(claim.exposure)}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Everything covered')}
          description={t(
            'Cover runs from the day the work was done, and ends on time or on mileage, whichever comes first.',
          )}
        />
        {book.all.length === 0 ? (
          <EmptyState
            title={t('Nothing recorded yet')}
            description={t(
              'Cover is recorded as a job closes, and appears here with the date and mileage it runs to.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('From')}</Th>
                  <Th>{t('State')}</Th>
                  <Th>{t('Behind it')}</Th>
                </tr>
              </thead>
              <tbody>
                {book.all.map((entry) => (
                  <Tr key={entry.row.id}>
                    <Td>
                      <span className="font-medium">{entry.row.description}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {entry.row.kind === 'PART' ? t('Part') : t('Labour')} ·{' '}
                        {t('job {number}', { number: entry.row.job.number })}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/vehicles/${entry.row.vehicle.id}`}
                        className="hover:text-(--brand-text) hover:underline"
                      >
                        {entry.row.vehicle.make} {entry.row.vehicle.model}
                      </Link>
                      {entry.row.vehicle.registration ? (
                        <span className="ms-2 inline-block align-middle">
                          <Registration value={entry.row.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {date(entry.row.startedOn, region.locale)}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          entry.status.active
                            ? entry.status.daysLeft <= 30
                              ? 'warning'
                              : 'success'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {entry.status.active
                          ? t('{days}d left', { days: entry.status.daysLeft })
                          : t('expired')}
                      </Badge>
                      <span className="block text-[11px] text-(--text-faint)">
                        {t(entry.status.summary)}
                      </span>
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">
                      {entry.cover.supplierName
                        ? t('{supplier}, {months} months', {
                            supplier: entry.cover.supplierName,
                            months: entry.cover.supplierMonths ?? '—',
                          })
                        : t('Nobody. All of it falls on the workshop.')}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
