'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';

import { DEMO_EVENTS } from './passport-scene';

/**
 * The vehicle, its record, and the way between them.
 *
 * The canvas is decoration in the strict sense: everything it shows is also
 * here as text and as real buttons. Somebody on a keyboard, on a screen
 * reader, on a browser with WebGL switched off or on a phone that gave up
 * gets the identical story. That is why the canvas carries aria-hidden and the
 * list beside it does not.
 *
 * Loaded on the client only. Three.js is a couple of hundred kilobytes and
 * touches the DOM on construction, so rendering it on the server buys nothing
 * and costs the first paint.
 */
const PassportScene = dynamic(
  () => import('./passport-scene').then((module) => module.PassportScene),
  {
    ssr: false,
    // Deliberately nothing. The card behind it is already the right shape and
    // colour, so an empty frame reads as the scene about to arrive rather than
    // as something broken.
    loading: () => null,
  },
);

const TONES = {
  record: { dot: 'bg-(--brand-solid)', label: 'Recorded' },
  advisory: { dot: 'bg-(--warning)', label: 'Advisory' },
  alert: { dot: 'bg-(--danger)', label: 'Contradiction' },
};

export function PassportHero() {
  const [selected, setSelected] = React.useState<string | null>('odometer');

  const event = DEMO_EVENTS.find((entry) => entry.id === selected) ?? DEMO_EVENTS[0]!;

  const choose = React.useCallback((id: string) => {
    setSelected(id);
  }, []);

  return (
    <div className="grid gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-lg) border border-(--border) bg-gradient-to-b from-(--surface) to-(--surface-sunk)">
        <PassportScene onSelect={choose} selectedId={selected} />

        <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-(--text-faint)">
          Drag to turn. The marks are real entries on this vehicle.
        </p>
      </div>

      {/* The same four events, as controls. This is the accessible path and
          also the one that works on a phone that would rather not run a
          renderer. */}
      <div className="flex flex-wrap gap-1.5">
        {DEMO_EVENTS.map((entry) => {
          const active = entry.id === selected;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => choose(entry.id)}
              aria-pressed={active}
              className={[
                'rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                active
                  ? 'border-(--brand) bg-(--brand-soft) text-(--brand-text)'
                  : 'border-(--border) text-(--text-soft) hover:border-(--border-strong)',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${TONES[entry.tone].dot}`}
              />
              {entry.year}
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="rounded-(--radius-lg) border border-(--border) bg-(--surface) p-4"
      >
        <p className="eyebrow">
          {TONES[event.tone].label} · {event.workshop}
        </p>
        <h2 className="mt-1 font-display text-[17px] font-semibold leading-snug">{event.title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-(--text-soft)">{event.detail}</p>
      </div>
    </div>
  );
}
