import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
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
import { periodFor } from '@/lib/reports';
import { taxReportFor } from '@/lib/tax';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Tax') };
}
export const dynamic = 'force-dynamic';

/**
 * The report per tax. Phase 41.
 *
 * What an accountant fills a return in from: for each tax and rate, what it
 * was charged on, what it came to, what credit notes gave back, and what is
 * owed. Read only from what each document declared when it was issued, so a
 * rate changed or retired since cannot change a return already filed. Two
 * taxes on the same line both count its net, because each authority is told
 * the amount its tax was charged on.
 */
const RANGES = ['last-quarter', 'quarter', 'last-month', 'month', 'year'] as const;

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { orgId, region } = await requireSession('report:financial');
  const t = await tFor();
  const { range } = await searchParams;

  const key = (RANGES as readonly string[]).includes(range ?? '') ? range! : 'last-quarter';
  const period = periodFor(key, region.locale);
  const report = await taxReportFor(orgId, period, region.currency);

  const label = (option: (typeof RANGES)[number]) =>
    ({
      'last-quarter': t('Last quarter'),
      quarter: t('This quarter'),
      'last-month': t('Last month'),
      month: t('This month'),
      year: t('This year'),
    })[option];

  const given = report.rows.reduce((total, row) => total + row.creditedTax.minor, 0);
  const charged = report.rows.reduce((total, row) => total + row.salesTax.minor, 0);
  const money = (minor: number) => (
    <Money currency={region.currency} locale={region.locale} amount={minor / 100} />
  );

  return (
    <>
      <PageHeader
        eyebrow={t('Reporting')}
        title={t('Tax')}
        description={t(period.label)}
        actions={
          <>
            {RANGES.map((option) => (
              <Link key={option} href={`/reports/tax?range=${option}`}>
                <Button size="sm" variant={option === key ? 'primary' : 'secondary'}>
                  {label(option)}
                </Button>
              </Link>
            ))}
            <a href={`/api/reports/tax?range=${key}`} download>
              <Button size="sm" variant="ghost">
                CSV
              </Button>
            </a>
          </>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Tax owed')}
          value={money(report.tax.minor)}
          tone="brand"
          note={t('Charged, less given back')}
        />
        <StatTile
          label={t('Tax charged')}
          value={money(charged)}
          note={t('On invoices and counter sales')}
        />
        <StatTile label={t('Given back')} value={money(given)} note={t('On credit notes')} />
        <StatTile
          label={t('Documents')}
          value={report.documents}
          note={t('Issued in the period')}
        />
      </StatRow>

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Each tax')}
          description={t('As each document declared it when it was issued')}
        />
        {report.rows.length === 0 ? (
          <EmptyState
            title={t('Nothing issued in this period')}
            description={t('Invoices, credit notes and counter sales appear here once issued.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Tax')}</Th>
                  <Th numeric>{t('Rate')}</Th>
                  <Th numeric>{t('Taxable')}</Th>
                  <Th numeric>{t('Tax charged')}</Th>
                  <Th numeric>{t('Given back')}</Th>
                  <Th numeric>{t('Tax owed')}</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Tr key={`${row.name} ${row.ratePct}`}>
                    <Td className="font-medium">{t(row.name)}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {row.ratePct}%
                    </Td>
                    <Td numeric>{money(row.salesNet.minor - row.creditedNet.minor)}</Td>
                    <Td numeric>{money(row.salesTax.minor)}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {money(row.creditedTax.minor)}
                    </Td>
                    <Td numeric className="font-medium">
                      {money(row.tax.minor)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
          {t(
            'Two taxes on the same line both count its net, because each authority is told the amount its own tax was charged on. Exempt sales are listed with no tax, so the certificate behind each can be found.',
          )}
        </CardBody>
      </Card>

      {report.bySite.length > 1 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {report.bySite.map((site) => (
            <Card key={site.id} className="overflow-hidden">
              <CardHeader
                title={site.name || t('No site')}
                description={t('{amount} owed', {
                  amount: new Intl.NumberFormat(region.locale, {
                    style: 'currency',
                    currency: region.currency,
                  }).format(site.tax.minor / 100),
                })}
              />
              <ul className="divide-y divide-(--border)">
                {site.rows.map((row) => (
                  <li
                    key={`${row.name} ${row.ratePct}`}
                    className="flex justify-between gap-2 px-4 py-2 text-[13px]"
                  >
                    <span>
                      {t(row.name)} · {row.ratePct}%
                    </span>
                    <span className="tabular-nums">{money(row.tax.minor)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
