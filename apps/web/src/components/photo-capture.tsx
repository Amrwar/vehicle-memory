'use client';

import * as React from 'react';

import { useT } from '@/components/language-provider';

/**
 * Taking a photograph of what was found.
 *
 * The file never touches the server. It is handed a short-lived signed URL and
 * uploaded straight to the store, because a workshop picture is commonly three
 * or four megabytes and a serverless request body caps well below that. A
 * server that proxied them would fail on the photographs that matter most,
 * which are the close ones somebody took to prove a point.
 *
 * `capture="environment"` opens the rear camera directly on a phone rather
 * than a file browser. A technician standing next to a wheel wants the camera,
 * not their downloads folder.
 *
 * Nothing here is optimistic. The thumbnail appears when the store has
 * confirmed the bytes, not when the file was chosen, because a photograph that
 * looks uploaded and is not is exactly the failure that gets discovered when
 * the customer asks to see it.
 */
export function PhotoCapture({
  resultId,
  count,
  onDone,
}: {
  resultId: string;
  count: number;
  onDone?: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(count);
  const input = React.useRef<HTMLInputElement>(null);

  async function send(file: File) {
    setBusy(true);
    setError(null);

    try {
      const ticketResponse = await fetch('/api/inspection-photos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resultId,
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

      // Recorded only now, so a row never points at bytes that are not there.
      const confirm = await fetch('/api/inspection-photos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resultId,
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
      onDone?.();
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
        className="sr-only"
        id={`photo-${resultId}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />

      <label
        htmlFor={`photo-${resultId}`}
        className={[
          'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-(--radius-md)',
          'border border-(--border-strong) px-4 text-[15px] transition-colors',
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
            ? t('Photo ({count})', { count: added })
            : t('Take a photo')}
      </label>

      {error ? <p className="text-[12px] text-(--danger)">{t(error)}</p> : null}
    </div>
  );
}
