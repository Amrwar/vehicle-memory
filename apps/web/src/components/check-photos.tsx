'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useT } from '@/components/language-provider';

/**
 * Photographs of the car as it arrived or as it left. Phase 35.
 *
 * The same two-step upload as inspection photographs: a ticket, the bytes
 * straight to the store, then the row. Several in a row, because a walk
 * round a car is six pictures and nobody wants to press the same button six
 * times with a confirmation in between.
 */
export function CheckPhotos({ checkId, count }: { checkId: string; count: number }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(count);
  const input = React.useRef<HTMLInputElement>(null);

  async function send(files: File[]) {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const ticketResponse = await fetch('/api/check-photos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            checkId,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });
        const ticket = (await ticketResponse.json()) as {
          url?: string;
          key?: string;
          headers?: Record<string, string>;
          error?: string;
        };
        if (!ticketResponse.ok || !ticket.url || !ticket.key) {
          throw new Error(ticket.error ?? 'The store would not take it.');
        }
        const upload = await fetch(ticket.url, {
          method: 'PUT',
          headers: ticket.headers ?? {},
          body: file,
        });
        if (!upload.ok) throw new Error(`The store refused the file (${upload.status}).`);
        const confirm = await fetch('/api/check-photos', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            checkId,
            key: ticket.key,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });
        if (!confirm.ok) {
          const detail = (await confirm.json()) as { error?: string };
          throw new Error(detail.error ?? 'Uploaded, but not recorded.');
        }
        setAdded((value) => value + 1);
      }
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not upload.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="grid gap-1.5">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id={`check-photo-${checkId}`}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void send(files);
        }}
      />
      <label
        htmlFor={`check-photo-${checkId}`}
        className={[
          'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-(--radius-md)',
          'border border-(--border-strong) bg-(--surface) px-4 text-[15px] font-semibold transition-colors',
          busy ? 'opacity-60' : 'hover:bg-(--surface-sunk)',
        ].join(' ')}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M2.6 6.4h3l1.2-1.8h6.4l1.2 1.8h3v9.2H2.6z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10.6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {busy
          ? t('Sending…')
          : added > 0
            ? t('Add photos ({count} so far)', { count: added })
            : t('Photograph the car')}
      </label>
      {error ? <p className="text-[12px] text-(--danger)">{t(error)}</p> : null}
    </div>
  );
}
