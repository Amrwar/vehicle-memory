import * as React from 'react';

import { Badge } from './primitives';
import { cn } from './cn';

/* ===========================================================================
   Domain-aware display components.

   These know about vehicles, jobs and inspections. Keeping them here rather
   than in the app means the passport renders identically in the workshop, in
   the customer portal and on a public share link — which matters, because a
   buyer comparing what the seller showed them against what they see on their
   own phone must see the same thing.
   =========================================================================== */

/* --- VIN and registration ------------------------------------------------ */

export function Vin({
  value,
  className,
  grouped = true,
}: {
  value: string;
  className?: string;
  grouped?: boolean;
}) {
  const normalised = value.replace(/[\s-]/g, '').toUpperCase();
  const display =
    grouped && normalised.length === 17
      ? `${normalised.slice(0, 3)} ${normalised.slice(3, 9)} ${normalised.slice(9)}`
      : normalised;

  return (
    <span className={cn('datum text-(--text-soft)', className)} title={normalised}>
      {display}
    </span>
  );
}

/**
 * A number plate, drawn as a plate. Recognisable at a glance across a busy
 * diary in a way that plain text is not.
 */
export function Registration({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'datum inline-flex items-center rounded-(--radius-xs) border',
        'border-(--border-strong) bg-(--surface-sunk) px-1.5 py-px',
        'text-[12px] font-semibold uppercase tracking-wider',
        className,
      )}
    >
      {value}
    </span>
  );
}

/* --- money and mileage --------------------------------------------------- */

export function Money({
  amount,
  currency = 'GBP',
  locale = 'en-GB',
  className,
  signed = false,
}: {
  amount: number;
  currency?: string;
  locale?: string;
  className?: string;
  signed?: boolean;
}) {
  const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  return (
    <span
      className={cn(
        'tabular',
        signed && amount < 0 && 'text-(--danger)',
        signed && amount > 0 && 'text-(--success)',
        className,
      )}
    >
      {signed && amount > 0 ? '+' : ''}
      {formatted}
    </span>
  );
}

export function Mileage({
  km,
  locale = 'en-GB',
  anomaly,
  className,
}: {
  km: number | null | undefined;
  locale?: string;
  anomaly?: 'NONE' | 'DECREASE' | 'IMPLAUSIBLE_RATE' | null;
  className?: string;
}) {
  if (km === null || km === undefined) {
    return <span className={cn('text-(--text-faint)', className)}>Not recorded</span>;
  }

  const flagged = anomaly && anomaly !== 'NONE';

  return (
    <span className={cn('tabular inline-flex items-center gap-1.5', className)}>
      {km.toLocaleString(locale)} km
      {flagged ? (
        <Badge tone="danger" size="sm" title={describeAnomaly(anomaly)}>
          Flagged
        </Badge>
      ) : null}
    </span>
  );
}

function describeAnomaly(anomaly: string | null | undefined): string {
  if (anomaly === 'DECREASE') return 'Lower than a previously recorded reading';
  if (anomaly === 'IMPLAUSIBLE_RATE') return 'Implies an unusually high daily distance';
  return '';
}

/* --- inspection severity -------------------------------------------------- */

export type Severity = 'PASS' | 'ADVISORY' | 'CRITICAL' | 'NOT_CHECKED';

const SEVERITY: Record<
  Severity,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; glyph: string }
> = {
  PASS: { label: 'Pass', tone: 'success', glyph: '✓' },
  ADVISORY: { label: 'Advisory', tone: 'warning', glyph: '!' },
  CRITICAL: { label: 'Critical', tone: 'danger', glyph: '×' },
  NOT_CHECKED: { label: 'Not checked', tone: 'neutral', glyph: '–' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY[severity];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

/**
 * The traffic-light summary. Shows a count per severity with both a glyph and
 * a number, so it survives being printed in black and white or read by
 * someone who cannot distinguish the hues.
 */
export function SeveritySummary({
  pass,
  advisory,
  critical,
  className,
}: {
  pass: number;
  advisory: number;
  critical: number;
  className?: string;
}) {
  const items: { severity: Severity; count: number }[] = [
    { severity: 'CRITICAL', count: critical },
    { severity: 'ADVISORY', count: advisory },
    { severity: 'PASS', count: pass },
  ];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {items.map(({ severity, count }) => {
        const meta = SEVERITY[severity];
        return (
          <span
            key={severity}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-(--radius-sm) px-2 py-1',
              'text-[12px] font-medium',
              meta.tone === 'danger' && 'bg-(--danger-soft) text-(--danger)',
              meta.tone === 'warning' && 'bg-(--warning-soft) text-(--warning)',
              meta.tone === 'success' && 'bg-(--success-soft) text-(--success)',
              meta.tone === 'neutral' && 'bg-(--surface-sunk) text-(--text-soft)',
            )}
          >
            <span aria-hidden className="datum text-[13px] leading-none">
              {meta.glyph}
            </span>
            <span className="tabular">{count}</span>
            <span className="sr-only">{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/* --- job progress --------------------------------------------------------- */

export type StageState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface Stage {
  status: string;
  label: string;
  state: StageState;
}

/**
 * The job progress trail (story E1). Deliberately vertical: it reads as a
 * checklist rather than a wizard, and it holds eleven stages without becoming
 * unreadably small on a laptop.
 */
export function ProgressTrail({ stages, className }: { stages: Stage[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <li key={stage.status} className="relative flex gap-3 pb-3 last:pb-0">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[7px] top-[18px] bottom-0 w-px',
                  stage.state === 'done' ? 'bg-(--success)' : 'bg-(--border)',
                )}
              />
            ) : null}

            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-1 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border-2 text-[9px] font-bold',
                stage.state === 'done' &&
                  'border-(--success) bg-(--success) text-white',
                stage.state === 'current' &&
                  'border-(--brand) bg-(--surface) ring-4 ring-(--brand-soft)',
                stage.state === 'upcoming' && 'border-(--border-strong) bg-(--surface)',
                stage.state === 'skipped' &&
                  'border-dashed border-(--border-strong) bg-(--surface)',
              )}
            >
              {stage.state === 'done' ? '✓' : ''}
            </span>

            <span
              className={cn(
                'text-[13px] leading-tight pt-px',
                stage.state === 'current' && 'font-semibold text-(--text)',
                stage.state === 'done' && 'text-(--text-soft)',
                stage.state === 'upcoming' && 'text-(--text-faint)',
                stage.state === 'skipped' && 'text-(--text-faint) line-through decoration-1',
              )}
            >
              {stage.label}
              {stage.state === 'skipped' ? <span className="sr-only"> (skipped)</span> : null}
              {stage.state === 'current' ? <span className="sr-only"> (current stage)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --- passport timeline ---------------------------------------------------- */

export type VerificationLevel =
  | 'SELF_REPORTED'
  | 'WORKSHOP_RECORDED'
  | 'WORKSHOP_VERIFIED'
  | 'AUTHORITY';

const VERIFICATION: Record<
  VerificationLevel,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'accent'; explain: string }
> = {
  SELF_REPORTED: {
    label: 'Owner',
    tone: 'neutral',
    explain: 'Reported by the vehicle owner',
  },
  WORKSHOP_RECORDED: {
    label: 'Workshop',
    tone: 'info',
    explain: 'Recorded by a workshop during work',
  },
  WORKSHOP_VERIFIED: {
    label: 'Evidenced',
    tone: 'success',
    explain: 'Recorded by a workshop with photographic evidence',
  },
  AUTHORITY: {
    label: 'Official',
    tone: 'accent',
    explain: 'Supplied by a registry, manufacturer or insurer',
  },
};

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  const meta = VERIFICATION[level];
  return (
    <Badge tone={meta.tone} size="sm" title={meta.explain}>
      {meta.label}
    </Badge>
  );
}

export interface TimelineEvent {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  summary?: string | null;
  occurredAt: Date | string;
  odometerKm?: number | null;
  verification: VerificationLevel;
  recordedBy?: string | null;
  superseded?: boolean;
}

/**
 * One entry on the vehicle passport. Written for David (persona P5), who has
 * no account, no context and about ninety seconds of patience: what happened,
 * when, at what mileage, who says so, and how well evidenced it is.
 */
export function TimelineEntry({
  event,
  locale = 'en-GB',
  className,
}: {
  event: TimelineEvent;
  locale?: string;
  className?: string;
}) {
  const date = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);

  return (
    <li
      className={cn(
        'relative grid grid-cols-[auto_1fr] gap-x-3 pb-5 last:pb-0',
        event.superseded && 'opacity-55',
        className,
      )}
    >
      <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-(--border)" />

      <span
        aria-hidden
        className={cn(
          'relative z-10 mt-1.5 h-[11px] w-[11px] rounded-full border-2 border-(--surface)',
          event.verification === 'WORKSHOP_VERIFIED' && 'bg-(--success)',
          event.verification === 'WORKSHOP_RECORDED' && 'bg-(--info)',
          event.verification === 'AUTHORITY' && 'bg-(--accent)',
          event.verification === 'SELF_REPORTED' && 'bg-(--border-strong)',
        )}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="eyebrow">{event.typeLabel}</span>
          <time
            dateTime={date.toISOString()}
            className="datum text-[11px] text-(--text-faint)"
          >
            {date.toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </time>
          {event.odometerKm != null ? (
            <span className="datum text-[11px] text-(--text-faint)">
              {event.odometerKm.toLocaleString(locale)} km
            </span>
          ) : null}
          {event.superseded ? (
            <Badge tone="neutral" size="sm">
              Superseded
            </Badge>
          ) : null}
        </div>

        <p className="text-[14px] font-medium leading-snug mt-1">{event.title}</p>

        {event.summary ? (
          <p className="text-[13px] text-(--text-soft) leading-snug mt-0.5">{event.summary}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <VerificationBadge level={event.verification} />
          {event.recordedBy ? (
            <span className="text-[12px] text-(--text-faint)">{event.recordedBy}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The chain fingerprint, shown at the head of a passport. Two people can
 * compare a history over the phone without reading 64 hex characters aloud.
 */
export function ChainFingerprint({
  head,
  verified,
  className,
}: {
  head: string | null;
  verified: boolean;
  className?: string;
}) {
  const short = head ? `${head.slice(0, 4)}-${head.slice(4, 8)}`.toUpperCase() : '--------';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-(--radius-md) border px-3 py-2',
        verified
          ? 'border-(--success) bg-(--success-soft)'
          : 'border-(--danger) bg-(--danger-soft)',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-6 w-6 place-items-center rounded-full text-[13px] font-bold text-white',
          verified ? 'bg-(--success)' : 'bg-(--danger)',
        )}
      >
        {verified ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'text-[12px] font-semibold leading-tight',
            verified ? 'text-(--success)' : 'text-(--danger)',
          )}
        >
          {verified ? 'History intact' : 'History integrity check failed'}
        </p>
        <p className="datum text-[11px] text-(--text-faint) leading-tight">
          Chain {short}
        </p>
      </div>
    </div>
  );
}
