'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Adding a piece of paperwork to a vehicle.
 *
 * The file goes straight to the store on a short-lived ticket, the same way
 * inspection photographs do, and the row is recorded only once the bytes are
 * confirmed. The form is small on purpose: what it is, what to call it, and
 * when it runs out for the two kinds that do.
 */

const KINDS: { kind: string; label: string; expires: boolean }[] = [
  { kind: 'PHOTO', label: 'Photograph', expires: false },
  { kind: 'REGISTRATION_CERTIFICATE', label: 'Registration certificate', expires: false },
  { kind: 'MOT_CERTIFICATE', label: 'MOT certificate', expires: true },
  { kind: 'INSURANCE', label: 'Insurance', expires: true },
  { kind: 'SERVICE_RECORD', label: 'Service record', expires: false },
  { kind: 'PURCHASE_INVOICE', label: 'Purchase invoice', expires: false },
  { kind: 'OTHER', label: 'Other', expires: false },
];

const field =
  'h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)';

export function DocumentUpload({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [kind, setKind] = React.useState('MOT_CERTIFICATE');
  const [title, setTitle] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const expires = KINDS.find((entry) => entry.kind === kind)?.expires ?? false;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const ticketResponse = await fetch('/api/vehicle-documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          kind,
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

      const confirm = await fetch('/api/vehicle-documents', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          kind,
          title,
          reference,
          expiresAt: expires ? expiresAt : '',
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

      setDone(`${title || file.name} added.`);
      setTitle('');
      setReference('');
      setExpiresAt('');
      setFile(null);
      if (input.current) input.current.value = '';
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not upload.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <label className="grid gap-1 text-[12px] font-medium text-(--text-soft)">
          What it is
          <select value={kind} onChange={(event) => setKind(event.target.value)} className={field}>
            {KINDS.map((entry) => (
              <option key={entry.kind} value={entry.kind}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-medium text-(--text-soft)">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
            placeholder={kind === 'PHOTO' ? 'Front bumper before repair' : 'MOT certificate 2026'}
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[12px] font-medium text-(--text-soft)">
          Reference <span className="font-normal text-(--text-faint)">(optional)</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={60}
            placeholder="Policy or certificate number"
            className={field}
          />
        </label>
        {expires ? (
          <label className="grid gap-1 text-[12px] font-medium text-(--text-soft)">
            Runs out on
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className={field}
            />
          </label>
        ) : null}
      </div>

      <label className="grid gap-1 text-[12px] font-medium text-(--text-soft)">
        File <span className="font-normal text-(--text-faint)">(PDF or a picture, up to 12MB)</span>
        <input
          ref={input}
          type="file"
          accept={kind === 'PHOTO' ? 'image/*' : 'image/*,application/pdf'}
          capture={kind === 'PHOTO' ? 'environment' : undefined}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-[13px]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center rounded-(--radius-md) bg-(--brand) px-3.5 text-[13px] font-medium text-(--on-brand) disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Add to the vehicle'}
        </button>
        {done ? <span className="text-[12px] text-(--success)">{done}</span> : null}
        {error ? <span className="text-[12px] text-(--danger)">{error}</span> : null}
      </div>
    </form>
  );
}

/** A small remove control that asks for the reason inline. */
export function DocumentRemove({
  vehicleId,
  documentId,
}: {
  vehicleId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/vehicle-documents', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vehicleId, documentId, reason }),
      });
      if (!response.ok) {
        const detail = (await response.json()) as { error?: string };
        throw new Error(detail.error ?? 'Not removed.');
      }
      setOpen(false);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Not removed.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-(--text-soft) hover:text-(--danger) hover:underline"
      >
        Remove
      </button>
    );
  }

  return (
    <form onSubmit={remove} className="flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required
        maxLength={120}
        placeholder="Why? Kept on the record."
        aria-label="Reason for removing"
        className="h-8 w-48 rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 text-[12px]"
      />
      <button
        type="submit"
        disabled={busy}
        className="h-8 rounded-(--radius-sm) border border-(--danger) px-2.5 text-[12px] text-(--danger) disabled:opacity-60"
      >
        {busy ? 'Removing…' : 'Remove'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[12px] text-(--text-faint)"
      >
        Keep
      </button>
      {error ? <span className="text-[12px] text-(--danger)">{error}</span> : null}
    </form>
  );
}
