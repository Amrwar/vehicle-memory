'use client';

import { mrzLines } from '@carnet/core';
import {
  PassportCover,
  PassportFields,
  PassportMrz,
  PassportPhoto,
  PassportSeal,
  PassportStamp,
  cn,
} from '@carnet/ui';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { useT } from '@/components/language-provider';

import { DEMO_EVENTS } from './passport-scene';

/**
 * The passport, as an object you can pick up. Phase 23.
 *
 * A closed booklet that tilts toward the pointer, and opens on a press to
 * show the identity page: the vehicle turning in the photograph window, the
 * fields a passport carries, the machine-readable zone at the foot, and the
 * four entries the demonstration car really has, pressed as stamps.
 *
 * Three rules, the same ones the scene inside it keeps. It degrades: with no
 * WebGL the window shows the vehicle's mark, and the page is still a page.
 * It respects a person who has asked for less movement: no tilt, no idle
 * turn, and the cover opens without animating. And nothing is only in the
 * picture: the button is a button, the fields are text, and the stamps are
 * the same four entries as the list below the booklet.
 */

const PassportScene = dynamic(
  () => import('./passport-scene').then((module) => module.PassportScene),
  { ssr: false, loading: () => null },
);

const DEMO = {
  vin: 'WBAJA9C509G000000',
  registration: 'MK20 XRT',
  make: 'BMW',
  model: 'X5',
  year: 2020,
  firstRegisteredAt: new Date(2020, 2, 14),
  owners: 3,
  entries: 7,
};

const STAMP_INK = { record: 'verified', advisory: 'recorded', alert: 'alert' } as const;

export function PassportBooklet() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [selected, setSelected] = React.useState<string | null>('odometer');
  const [reduced, setReduced] = React.useState(false);
  const frame = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listen = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listen);
    return () => query.removeEventListener('change', listen);
  }, []);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || open) return;
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const dx = (event.clientX - (box.left + box.width / 2)) / box.width;
    const dy = (event.clientY - (box.top + box.height / 2)) / box.height;
    setTilt({ x: -dy * 10, y: dx * 14 });
  };

  const [line1, line2] = mrzLines(DEMO);
  const event = DEMO_EVENTS.find((entry) => entry.id === selected) ?? DEMO_EVENTS[0]!;

  return (
    <div className="grid gap-4">
      <div
        ref={frame}
        className="passport-booklet mx-auto w-full max-w-[460px]"
        data-open={open ? 'true' : 'false'}
        onPointerMove={onMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <div
          className="passport-booklet-body aspect-[4/5]"
          style={{
            transform: open
              ? 'rotateX(0deg) rotateY(0deg)'
              : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          {/* The inside, always rendered so it is in the DOM for everybody. */}
          <div className="passport-page passport-document absolute inset-0 flex h-full flex-col overflow-hidden">
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 p-4 sm:p-5">
              <PassportPhoto caption={t('The vehicle')}>
                <div className="absolute inset-0" aria-hidden>
                  <PassportScene onSelect={setSelected} selectedId={selected} />
                </div>
              </PassportPhoto>
              <div className="grid content-start gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="passport-label">{t('Type')}</p>
                    {/* i18n-ignore */}
                    <p className="passport-value">P · CNT</p>
                  </div>
                  <PassportSeal
                    intact
                    head="C72EDAFC"
                    className="scale-[0.72] origin-top-right"
                    t={t}
                  />
                </div>
                <PassportFields
                  fields={[
                    { label: t('Make and model'), value: `${DEMO.make} ${DEMO.model}` },
                    { label: t('Year'), value: String(DEMO.year) },
                    { label: t('Registration'), value: DEMO.registration },
                    { label: t('VIN'), value: DEMO.vin, wide: true },
                    { label: t('Owners on record'), value: String(DEMO.owners) },
                    { label: t('Entries'), value: String(DEMO.entries) },
                  ]}
                  className="gap-y-2"
                />
              </div>
            </div>
            {/* The chosen entry, pressed on the page itself. */}
            <div className="px-4 pb-4 sm:px-5">
              <PassportStamp
                ink={STAMP_INK[event.tone]}
                authority={t(event.workshop)}
                kind={
                  event.tone === 'alert'
                    ? t('Contradiction')
                    : event.tone === 'advisory'
                      ? t('Advisory')
                      : t('Recorded')
                }
                date={t(event.year)}
                title={t(event.title)}
                tilt={-1.4}
              />
            </div>
            <PassportMrz lines={[line1, line2]} t={t} />
          </div>

          {/* The cover, hinged on the left. */}
          <div className="passport-booklet-cover">
            <PassportCover className="h-full" t={t}>
              <p className="passport-foil-text text-[10px] opacity-80">{DEMO.registration}</p>
            </PassportCover>
            <div className="passport-booklet-inside passport-page passport-document grid place-items-center p-6 text-center">
              <div className="grid gap-2">
                <p className="passport-label">{t('Issued to the vehicle, not the owner')}</p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: 'var(--passport-ink-soft)' }}
                >
                  {t(
                    'Every workshop that services this car writes to the same pages. Sell it and the pages go with it.',
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            'inline-flex h-10 items-center rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-4 text-[14px] font-medium',
            'transition-colors hover:bg-(--surface-sunk)',
          )}
        >
          {open ? t('Close the passport') : t('Open the passport')}
        </button>
        <span className="text-[12px] text-(--text-faint)">
          {open
            ? t('Drag the car to turn it. Tap a mark to read the entry.')
            : t('A real vehicle, and its real record.')}
        </span>
      </div>

      {/* The same entries, as stamps and as buttons. */}
      <ul
        className="passport-page grid gap-3 p-3 sm:grid-cols-2"
        aria-label={t('Entries on the demonstration vehicle')}
      >
        {DEMO_EVENTS.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(entry.id);
                setOpen(true);
              }}
              aria-pressed={selected === entry.id}
              className={cn(
                'w-full text-start transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--border-focus)',
                selected === entry.id ? 'scale-[1.02]' : 'opacity-85 hover:opacity-100',
              )}
            >
              <PassportStamp
                ink={STAMP_INK[entry.tone]}
                authority={t(entry.workshop)}
                kind={
                  entry.tone === 'alert'
                    ? t('Contradiction')
                    : entry.tone === 'advisory'
                      ? t('Advisory')
                      : t('Recorded')
                }
                date={t(entry.year)}
                title={t(entry.title)}
                tilt={((index % 3) - 1) * 1.2}
              />
            </button>
          </li>
        ))}
      </ul>

      <p className="text-[13px] leading-relaxed text-(--text-soft)">
        <span className="font-medium text-(--text)">{t(event.title)}.</span> {t(event.detail)}
      </p>
    </div>
  );
}
