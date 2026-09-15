import type { Translator } from '@carnet/core';

import { qrSvg } from '@/lib/qr';
import type { Letterhead } from '@/lib/print';

/**
 * One printed document: the workshop's letterhead, the title and its
 * number, what the document is about, and the body. Phase 42.
 */
export function PrintSheet({
  t,
  letterhead,
  title,
  number,
  meta,
  watermark,
  size = 'a4',
  children,
}: {
  t: Translator;
  letterhead: Letterhead;
  title: string;
  number?: string;
  meta?: { label: string; value: React.ReactNode }[];
  watermark?: string | null;
  size?: 'a4' | 'receipt' | 'tag' | 'labels';
  children: React.ReactNode;
}) {
  const compact = size === 'receipt' || size === 'tag';
  return (
    <article className="print-sheet" data-size={size}>
      {watermark ? (
        <div className="print-watermark" aria-hidden>
          {t(watermark)}
        </div>
      ) : null}

      {size === 'tag' || size === 'labels' ? null : (
        <header
          className={
            compact
              ? 'mb-3 text-center'
              : 'mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#222] pb-4'
          }
        >
          <div>
            <p className={compact ? 'text-[14px] font-semibold' : 'text-[18px] font-semibold'}>
              {letterhead.name}
            </p>
            {letterhead.legalName && letterhead.legalName !== letterhead.name ? (
              <p className="text-[11px] text-[#555]">{letterhead.legalName}</p>
            ) : null}
            <p className="text-[11px] text-[#555]">
              <bdi>{letterhead.address.join(', ')}</bdi>
            </p>
            <p className="text-[11px] text-[#555]">
              <bdi>
                {[letterhead.phone, letterhead.email, letterhead.website]
                  .filter(Boolean)
                  .join(' · ')}
              </bdi>
            </p>
            {letterhead.taxNumber ? (
              <p className="text-[11px] text-[#555]">
                {t('Tax number: {number}', { number: letterhead.taxNumber })}
              </p>
            ) : null}
          </div>
          <div className={compact ? 'mt-2' : 'text-end'}>
            <h1 className={compact ? 'text-[13px] font-semibold' : 'text-[22px] font-semibold'}>
              {title}
            </h1>
            {number ? <p className="datum text-[13px]">{number}</p> : null}
          </div>
        </header>
      )}

      {meta && meta.length > 0 ? (
        <dl
          className={
            compact ? 'mb-3 grid gap-0.5 text-[11px]' : 'mb-5 grid gap-x-6 gap-y-1 sm:grid-cols-2'
          }
        >
          {meta.map((entry) => (
            <div key={entry.label} className="flex gap-2">
              <dt className="min-w-[7rem] text-[#555]">{entry.label}</dt>
              <dd className="font-medium">
                <bdi>{entry.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children}
    </article>
  );
}

/** A QR code with what it opens written under it, for anyone without a phone to hand. */
export async function PrintQr({
  text,
  caption,
  size = '26mm',
}: {
  text: string;
  caption?: string;
  size?: string;
}) {
  const svg = await qrSvg(text);
  return (
    <figure className="print-avoid grid justify-items-center gap-1" style={{ width: size }}>
      <div className="print-qr w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {caption ? (
        <figcaption className="text-center text-[9px] leading-tight text-[#555]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Money as the reader reads it, in the document's currency. */
export function formatter(locale: string, currency: string) {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return (amount: number | string | { toString(): string }) => format.format(Number(amount));
}
