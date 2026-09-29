import {
  fitText,
  fuelLabel,
  humanise,
  type JobStatus,
  keyTagFor,
  msg,
  type Translator,
  watermarkFor,
} from '@carnet/core';

import type {
  counterSaleDocument,
  estimateDocument,
  inspectionDocument,
  invoiceDocument,
  labelsDocument,
  Reader,
  workOrderDocument,
} from '@/lib/print';

import { formatter, PrintQr, PrintSheet } from './sheet';

/**
 * What goes on each printed document. Phase 42.
 *
 * Every word through the translator; names, plates, part numbers and what
 * staff typed as they are. Amounts in the document's own currency, written
 * the way the reader reads numbers.
 */

type Doc<F extends (...args: never[]) => unknown> = NonNullable<Awaited<ReturnType<F>>>;

const SEVERITY: Record<string, string> = {
  PASS: msg('Pass'),
  ADVISORY: msg('Advisory'),
  CRITICAL: msg('Critical'),
  NOT_CHECKED: msg('Not checked'),
};
const GLYPH: Record<string, string> = { PASS: '✓', ADVISORY: '!', CRITICAL: '×', NOT_CHECKED: '–' };

const UNIT: Record<string, string> = {
  TREAD_DEPTH_MM: 'mm',
  PAD_THICKNESS_MM: 'mm',
  DISC_THICKNESS_MM: 'mm',
  MM: 'mm',
  PERCENT: '%',
  VOLTAGE: 'V',
  PRESSURE_BAR: 'bar',
  TEMPERATURE_C: '°C',
};

const DECISION: Record<string, string> = {
  PENDING: msg('Waiting for a decision'),
  APPROVED: msg('Approved'),
  DECLINED: msg('Declined'),
};

const TENDER: Record<string, string> = {
  CASH: msg('Cash'),
  CARD: msg('Card'),
  ACCOUNT: msg('On account'),
  GIFT_CARD: msg('Gift card'),
};

const PART_STATUS: Record<string, string> = {
  REQUESTED: msg('Requested'),
  RESERVED: msg('Reserved'),
  ON_ORDER: msg('On order'),
  FITTED: msg('Fitted'),
  RETURNED: msg('Returned'),
};

function dateOf(value: Date | null | undefined, reader: Reader, withTime = false): string {
  if (!value) return '—';
  return value.toLocaleString(reader.region.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: reader.region.timezone,
  });
}

function vehicleLine(vehicle: {
  make: string | null;
  model: string | null;
  registration: string | null;
}): string {
  return [vehicle.registration, [vehicle.make, vehicle.model].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}

/* ------------------------------------------------------------------ invoice */

export async function InvoicePrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof invoiceDocument>;
}) {
  const { invoice, bands, outstanding } = doc;
  const money = formatter(reader.region.locale, invoice.currency);
  const taxed = bands.some((band) => band.tax.minor !== 0);

  return (
    <PrintSheet
      t={t}
      letterhead={reader.letterhead}
      title={t('Invoice')}
      number={invoice.number}
      watermark={watermarkFor('invoice', invoice.status)}
      meta={[
        {
          label: t('Issued#invoice'),
          value: dateOf(invoice.issuedAt ?? invoice.createdAt, reader),
        },
        { label: t('Due'), value: dateOf(invoice.dueAt, reader) },
        { label: t('Customer'), value: invoice.customer.displayName },
        ...(invoice.job
          ? [
              { label: t('Job'), value: `#${invoice.job.number}` },
              { label: t('Vehicle'), value: vehicleLine(invoice.job.vehicle) },
            ]
          : []),
      ]}
    >
      <table>
        <thead>
          <tr>
            <th>{t('Description')}</th>
            <th className="num">{t('Quantity')}</th>
            <th className="num">{t('Unit price')}</th>
            <th className="num">{t('Tax')}</th>
            <th className="num">{t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>
                <bdi>{line.description}</bdi>
              </td>
              <td className="num">{Number(line.quantity)}</td>
              <td className="num">{money(line.unitPrice)}</td>
              <td className="num">{money(line.taxAmount)}</td>
              <td className="num">{money(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-1 text-[11px] text-[#555]">
          {invoice.taxExemptReference ? (
            <p>{t('Exempt from tax: {reference}', { reference: invoice.taxExemptReference })}</p>
          ) : null}
          {invoice.pricesIncludeTax ? <p>{t('Prices on this invoice include tax.')}</p> : null}
          {outstanding > 0.005 && reader.audience === 'workshop' ? (
            <PrintQr text={doc.link} caption={t('Pay or view it online')} />
          ) : null}
        </div>
        <table className="max-w-[80mm]">
          <tbody>
            <tr>
              <td>{t('Net')}</td>
              <td className="num">{money(invoice.subtotal)}</td>
            </tr>
            {taxed
              ? bands.map((band) => (
                  <tr key={`${band.name} ${band.ratePct}`}>
                    <td>
                      {t('{name} at {rate}% on {net}', {
                        name: t(band.name),
                        rate: band.ratePct,
                        net: money(band.net.minor / 100),
                      })}
                    </td>
                    <td className="num">{money(band.tax.minor / 100)}</td>
                  </tr>
                ))
              : null}
            {!taxed ? (
              <tr>
                <td>{t('Tax')}</td>
                <td className="num">{money(invoice.taxTotal)}</td>
              </tr>
            ) : null}
            <tr>
              <td className="font-semibold">{t('Total')}</td>
              <td className="num font-semibold">{money(invoice.total)}</td>
            </tr>
            <tr>
              <td className="font-semibold">{t('Still to pay')}</td>
              <td className="num font-semibold">{money(outstanding)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.notes ? <p className="mt-4 text-[11px] text-[#555]">{invoice.notes}</p> : null}
    </PrintSheet>
  );
}

/* ----------------------------------------------------------------- estimate */

export async function EstimatePrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof estimateDocument>;
}) {
  const { estimate } = doc;
  const money = formatter(reader.region.locale, estimate.currency);

  return (
    <PrintSheet
      t={t}
      letterhead={reader.letterhead}
      title={t('Quote')}
      number={t('#{job}, version {version}', {
        job: estimate.job.number,
        version: estimate.version,
      })}
      watermark={watermarkFor('estimate', estimate.status)}
      meta={[
        { label: t('Customer'), value: estimate.job.customer.displayName },
        { label: t('Vehicle'), value: vehicleLine(estimate.job.vehicle) },
        { label: t('Work'), value: estimate.job.shortDescription },
        { label: t('Valid until'), value: dateOf(estimate.validUntil, reader) },
      ]}
    >
      <table>
        <thead>
          <tr>
            <th>{t('Description')}</th>
            <th className="num">{t('Quantity')}</th>
            <th className="num">{t('Unit price')}</th>
            <th className="num">{t('Amount')}</th>
            <th>{t('Decision')}</th>
          </tr>
        </thead>
        <tbody>
          {estimate.lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.description}
                {line.isOptional ? (
                  <span className="block text-[10px] text-[#555]">{t('Optional')}</span>
                ) : null}
                {line.detail ? (
                  <span className="block text-[10px] text-[#555]">{line.detail}</span>
                ) : null}
              </td>
              <td className="num">{Number(line.quantity)}</td>
              <td className="num">{money(line.unitPrice)}</td>
              <td className="num">{money(line.lineTotal)}</td>
              <td>{t(DECISION[line.decision] ?? line.decision)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        {reader.audience === 'workshop' && ['SENT', 'DRAFT'].includes(estimate.status) ? (
          <PrintQr text={doc.link} caption={t('Approve or decline it online')} />
        ) : (
          <span />
        )}
        <table className="max-w-[80mm]">
          <tbody>
            <tr>
              <td>{t('Net')}</td>
              <td className="num">{money(estimate.subtotal)}</td>
            </tr>
            <tr>
              <td>{t('Tax')}</td>
              <td className="num">{money(estimate.taxTotal)}</td>
            </tr>
            <tr>
              <td className="font-semibold">{t('Total')}</td>
              <td className="num font-semibold">{money(estimate.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {estimate.notes ? <p className="mt-4 text-[11px] text-[#555]">{estimate.notes}</p> : null}
      <p className="mt-6 text-[11px] text-[#555]">
        {t('A quote, not an invoice. Nothing is charged until the work is approved and done.')}
      </p>
    </PrintSheet>
  );
}

/* --------------------------------------------------------------- inspection */

export async function InspectionPrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof inspectionDocument>;
}) {
  const { inspection, sheet } = doc;
  const job = inspection.job;
  const money = formatter(reader.region.locale, reader.region.currency);
  const sections = new Map<string, typeof inspection.results>();
  for (const result of inspection.results) {
    const list = sections.get(result.sectionName) ?? [];
    list.push(result);
    sections.set(result.sectionName, list);
  }

  return (
    <PrintSheet
      t={t}
      letterhead={reader.letterhead}
      title={t('Inspection report')}
      number={`#${job.number}`}
      watermark={watermarkFor('inspection', inspection.status)}
      meta={[
        { label: t('Customer'), value: job.customer.displayName },
        { label: t('Vehicle'), value: vehicleLine(job.vehicle) },
        { label: t('VIN'), value: <span className="datum">{job.vehicle.vin}</span> },
        {
          label: t('Mileage'),
          value: job.odometerInKm
            ? `${job.odometerInKm.toLocaleString(reader.region.locale)} km`
            : '—',
        },
        { label: t('Inspected by'), value: inspection.performedBy?.name ?? '—' },
        { label: t('Completed'), value: dateOf(inspection.completedAt, reader) },
        // Which sheet, so a report read years later says what it was. Phase 90.
        {
          label: t('Checklist'),
          value: sheet
            ? t('{name}, version {version} — {count} checks', {
                name: sheet.name,
                version: sheet.version,
                count: sheet.itemCount,
              })
            : t('Not recorded'),
        },
      ]}
    >
      <p className="mb-4 flex flex-wrap gap-4 text-[13px] font-semibold">
        <span>× {t('{count} critical', { count: inspection.criticalCount })}</span>
        <span>! {t('{count} advisory', { count: inspection.advisoryCount })}</span>
        <span>✓ {t('{count} passed', { count: inspection.passCount })}</span>
      </p>

      {/* What the sheet did not ask.
          A customer reading a March report with no brake-fluid line must be
          able to see that it was not on the sheet in March. Without this the
          silence reads as an omission, or as a pass, and both are wrong.
          Phase 90. */}
      {sheet && sheet.didNotAsk.length > 0 ? (
        <p className="print-avoid mb-4 border border-black/20 p-2 text-[12px]">
          <span className="font-semibold">{t('This check did not include:')}</span>{' '}
          <bdi>{sheet.didNotAsk.join(' · ')}</bdi>{' '}
          <span>{t('These were added to the checklist after this inspection was taken.')}</span>
        </p>
      ) : null}

      {[...sections.entries()].map(([section, results]) => (
        <section key={section} className="print-avoid mb-4">
          <h2 className="mb-1 text-[13px] font-semibold">
            <bdi>{section}</bdi>
          </h2>
          <table>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td className="w-[40%]">
                    <bdi>{result.itemName}</bdi>
                  </td>
                  <td className="w-[18%] font-medium">
                    {GLYPH[result.severity]} {t(SEVERITY[result.severity] ?? result.severity)}
                  </td>
                  <td>
                    {result.measurementValue !== null ? (
                      <>
                        <bdi className="font-medium tabular-nums">
                          {Number(result.measurementValue)}
                          {UNIT[result.measurementType] ?? ''}
                        </bdi>{' '}
                      </>
                    ) : null}
                    <bdi>{result.note}</bdi>
                    {result.recommendedAction ? (
                      <span className="block text-[11px] text-[#555]">
                        {t('Recommended: {action}', { action: result.recommendedAction })}
                        {result.estimatedCost !== null
                          ? ` · ${t('about {amount}', { amount: money(result.estimatedCost) })}`
                          : ''}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {inspection.notes ? <p className="mt-2 text-[12px]">{inspection.notes}</p> : null}

      {reader.audience === 'workshop' ? (
        <div className="mt-6 flex justify-end">
          <PrintQr text={doc.link} caption={t('The car’s record, online')} />
        </div>
      ) : null}
    </PrintSheet>
  );
}

/* --------------------------------------------------------------- work order */

export async function WorkOrderPrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof workOrderDocument>;
}) {
  const { job, keys } = doc;
  const arrival = job.checks[0];
  const damage = Array.isArray(arrival?.damage)
    ? (arrival.damage as { area?: string; note?: string }[])
    : [];
  const findings = job.inspections[0]?.results ?? [];

  return (
    <PrintSheet
      t={t}
      letterhead={reader.letterhead}
      title={t('Work order')}
      number={`#${job.number}`}
      watermark={watermarkFor('work-order', job.status)}
      meta={[
        { label: t('Vehicle'), value: vehicleLine(job.vehicle) },
        { label: t('VIN'), value: <span className="datum">{job.vehicle.vin}</span> },
        { label: t('Customer'), value: job.customer.displayName },
        { label: t('Telephone'), value: job.customer.mobile ?? '—' },
        { label: t('Promised'), value: dateOf(job.promisedAt, reader, true) },
        { label: t('Status'), value: t(humanise(job.status as JobStatus)) },
        { label: t('Bay'), value: job.bay?.name ?? '—' },
        {
          label: t('Technicians'),
          value: job.technicians.map((entry) => entry.user.name).join(', ') || '—',
        },
        {
          label: t('Keys'),
          value: keys.hook ? t('Hook {hook}', { hook: keys.hook }) : '—',
        },
        {
          label: t('Mileage in'),
          value: job.odometerInKm
            ? `${job.odometerInKm.toLocaleString(reader.region.locale)} km`
            : '—',
        },
      ]}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">{job.shortDescription}</h2>
          {job.details ? <p className="mt-1 whitespace-pre-line">{job.details}</p> : null}
          {job.diagnosis ? (
            <p className="mt-1">
              <span className="font-semibold">{t('Diagnosis')}: </span>
              {job.diagnosis}
            </p>
          ) : null}
          {job.jobTypes.length > 0 ? (
            <p className="mt-1 text-[11px] text-[#555]">
              {job.jobTypes.map((entry) => entry.jobType.name).join(' · ')}
            </p>
          ) : null}
        </div>
        <PrintQr text={doc.link} caption={t('Open the job')} size="24mm" />
      </div>

      {job.tasks.length > 0 ? (
        <section className="print-avoid mb-4">
          <h3 className="mb-1 text-[13px] font-semibold">{t('Checklist')}</h3>
          <ul className="grid gap-1">
            {job.tasks.map((task) => (
              <li key={task.id} className="flex gap-2">
                <span aria-hidden className="font-mono">
                  {task.isDone ? '☑' : '☐'}
                </span>
                <span>
                  <bdi>{task.title}</bdi>
                  {task.detail ? (
                    <span className="block text-[11px] text-[#555]">{task.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.labourLines.length > 0 ? (
        <section className="print-avoid mb-4">
          <h3 className="mb-1 text-[13px] font-semibold">{t('Labour')}</h3>
          <table>
            <thead>
              <tr>
                <th>{t('Description')}</th>
                <th className="num">{t('Hours')}</th>
              </tr>
            </thead>
            <tbody>
              {job.labourLines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <bdi>{line.description}</bdi>
                  </td>
                  <td className="num">{Number(line.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {job.partLines.length > 0 ? (
        <section className="print-avoid mb-4">
          <h3 className="mb-1 text-[13px] font-semibold">{t('Parts')}</h3>
          <table>
            <thead>
              <tr>
                <th>{t('Part number')}</th>
                <th>{t('Description')}</th>
                <th className="num">{t('Quantity')}</th>
                <th>{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {job.partLines.map((line) => (
                <tr key={line.id}>
                  <td className="datum">{line.partNumber ?? '—'}</td>
                  <td>
                    <bdi>{line.description}</bdi>
                  </td>
                  <td className="num">{Number(line.quantity)}</td>
                  <td>{t(PART_STATUS[line.status] ?? line.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {findings.length > 0 ? (
        <section className="print-avoid mb-4">
          <h3 className="mb-1 text-[13px] font-semibold">{t('Found at inspection')}</h3>
          <ul className="grid gap-1">
            {findings.map((finding) => (
              <li key={finding.id}>
                {GLYPH[finding.severity]} <bdi>{finding.itemName}</bdi>
                {finding.note ? <span className="text-[#555]"> · {finding.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {arrival ? (
        <section className="print-avoid mb-4">
          <h3 className="mb-1 text-[13px] font-semibold">{t('When it came in')}</h3>
          <p>
            {t('Fuel: {level}', { level: t(fuelLabel(arrival.fuelEighths)) })}
            {arrival.belongings
              ? ` · ${t('Left in the car: {items}', { items: arrival.belongings })}`
              : ''}
          </p>
          {damage.length > 0 ? (
            <ul className="mt-1 grid gap-0.5 text-[11px]">
              {damage.map((mark, index) => (
                <li key={index}>
                  {t(mark.area ?? '')}
                  {mark.note ? ` · ${mark.note}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-[#555]">{t('No damage noted.')}</p>
          )}
        </section>
      ) : null}

      <section className="print-avoid mt-8 grid gap-8 sm:grid-cols-2">
        {[t('Technician'), t('Quality check')].map((role) => (
          <div key={role}>
            <div className="h-10 border-b border-[#222]" />
            <p className="mt-1 text-[11px] text-[#555]">
              {t('{role}: signature and date', { role })}
            </p>
          </div>
        ))}
      </section>
    </PrintSheet>
  );
}

/* ------------------------------------------------------------------ key tag */

export async function KeyTagPrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof workOrderDocument>;
}) {
  const { job, keys } = doc;
  const tag = keyTagFor({
    registration: job.vehicle.registration,
    jobNumber: job.number,
    customerName: job.customer.displayName,
    make: job.vehicle.make,
    model: job.vehicle.model,
    hook: keys.hook,
  });

  return (
    <PrintSheet t={t} letterhead={reader.letterhead} title={t('Key tag')} size="tag">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="datum text-[24px] font-bold leading-none">{tag.headline}</p>
          <p className="mt-1 text-[13px] font-semibold">
            {tag.job} · {tag.customer}
          </p>
          <p className="text-[11px]">{tag.vehicle}</p>
          {tag.hook ? (
            <p className="mt-1 text-[14px] font-bold">{t('Hook {hook}', { hook: tag.hook })}</p>
          ) : null}
          <p className="mt-1 text-[9px] text-[#555]">{reader.letterhead.name}</p>
        </div>
        <PrintQr text={doc.link} size="22mm" />
      </div>
    </PrintSheet>
  );
}

/* ------------------------------------------------------------------- labels */

export async function LabelsPrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof labelsDocument>;
}) {
  const money = formatter(reader.region.locale, reader.region.currency);
  return (
    <>
      {doc.sheets.map((sheet, index) => (
        <PrintSheet
          key={index}
          t={t}
          letterhead={reader.letterhead}
          title={t('Part labels')}
          size="labels"
        >
          <div className={`label-grid ${index < doc.sheets.length - 1 ? 'print-page-break' : ''}`}>
            {sheet.map((part, cell) => (
              <div key={`${part.id}-${cell}`} className="label-cell">
                <PrintQr text={doc.link(part.id)} size="18mm" />
                <div className="min-w-0">
                  <p className="datum truncate text-[13px] font-bold">{part.partNumber}</p>
                  <p className="text-[10px] leading-tight">{fitText(part.name, 42)}</p>
                  {part.stockLevels[0]?.binLocation ? (
                    <p className="mt-0.5 text-[10px] font-semibold">
                      {t('Bin {bin}', { bin: part.stockLevels[0].binLocation })}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums">
                    {money(part.sellPrice)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PrintSheet>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- counter sale */

export async function CounterSalePrint({
  t,
  reader,
  doc,
}: {
  t: Translator;
  reader: Reader;
  doc: Doc<typeof counterSaleDocument>;
}) {
  const { sale, bands } = doc;
  const money = formatter(reader.region.locale, reader.region.currency);

  return (
    <PrintSheet
      t={t}
      letterhead={reader.letterhead}
      title={t('Receipt')}
      number={sale.reference}
      size="receipt"
      watermark={watermarkFor('counter-sale', sale.status)}
      meta={[
        { label: t('Date'), value: dateOf(sale.soldAt ?? sale.createdAt, reader, true) },
        { label: t('Served by'), value: sale.soldBy?.name ?? '—' },
        ...(sale.customer ? [{ label: t('Customer'), value: sale.customer.displayName }] : []),
      ]}
    >
      <table>
        <tbody>
          {sale.lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.description}
                <span className="block text-[10px] text-[#555]">
                  {Number(line.quantity)} × {money(line.unitPrice)}
                </span>
              </td>
              <td className="num">{money(line.lineTotal)}</td>
            </tr>
          ))}
          {bands
            .filter((band) => band.tax.minor !== 0)
            .map((band) => (
              <tr key={`${band.name} ${band.ratePct}`}>
                <td className="text-[#555]">
                  {t('{name} at {rate}% on {net}', {
                    name: t(band.name),
                    rate: band.ratePct,
                    net: money(band.net.minor / 100),
                  })}
                </td>
                <td className="num text-[#555]">{money(band.tax.minor / 100)}</td>
              </tr>
            ))}
          <tr>
            <td className="font-semibold">{t('Total')}</td>
            <td className="num font-semibold">{money(sale.total)}</td>
          </tr>
          {sale.tenders.map((tender) => (
            <tr key={tender.id}>
              <td>{t(TENDER[tender.kind] ?? tender.kind)}</td>
              <td className="num">{money(tender.amount)}</td>
            </tr>
          ))}
          {Number(sale.changeGiven) > 0 ? (
            <tr>
              <td>{t('Change')}</td>
              <td className="num">{money(sale.changeGiven)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="mt-3 text-center text-[11px]">{t('Thank you.')}</p>
    </PrintSheet>
  );
}
