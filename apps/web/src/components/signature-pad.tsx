'use client';

import * as React from 'react';

import { useT } from '@/components/language-provider';

/**
 * Somewhere to sign. Phase 35.
 *
 * A canvas that records the strokes a finger or a stylus makes and writes
 * them, as points, into a hidden field the form submits. The strokes are
 * kept rather than a picture of them, because a list of points is a few
 * hundred bytes, redraws at any size, and cannot be a pasted image of
 * somebody else's signature.
 *
 * Pointer events, so a mouse, a finger and a pen all draw. Touch scrolling
 * is switched off over the pad only, so the page still scrolls elsewhere.
 */
export function SignaturePad({
  name = 'signature',
  height = 160,
}: {
  name?: string;
  height?: number;
}) {
  const t = useT();
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const hidden = React.useRef<HTMLInputElement>(null);
  const strokes = React.useRef<[number, number][][]>([]);
  const drawing = React.useRef(false);
  const [signed, setSigned] = React.useState(false);

  const write = React.useCallback(() => {
    const el = canvas.current;
    if (!el || !hidden.current) return;
    const kept = strokes.current.filter((s) => s.length > 1);
    hidden.current.value = kept.length
      ? JSON.stringify({ strokes: kept, width: el.width, height: el.height })
      : '';
    setSigned(kept.length > 0);
  }, []);

  const redraw = React.useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(el).color;
    for (const stroke of strokes.current) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
    // The line to sign on.
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, el.height - 28);
    ctx.lineTo(el.width - 16, el.height - 28);
    ctx.stroke();
  }, []);

  React.useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const size = () => {
      const width = el.parentElement?.clientWidth ?? 400;
      el.width = Math.max(240, Math.floor(width));
      el.height = height;
      redraw();
      write();
    };
    size();
    const observer = new ResizeObserver(size);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [height, redraw, write]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(((event.clientX - rect.left) / rect.width) * event.currentTarget.width),
      Math.round(((event.clientY - rect.top) / rect.height) * event.currentTarget.height),
    ];
  }

  return (
    <div className="grid gap-2">
      <div className="relative rounded-(--radius-md) border border-(--border-strong) bg-(--surface)">
        <canvas
          ref={canvas}
          className="block w-full touch-none text-(--text)"
          style={{ height }}
          aria-label={t('Signature pad')}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            strokes.current.push([point(event)]);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1]!.push(point(event));
            redraw();
          }}
          onPointerUp={() => {
            drawing.current = false;
            write();
          }}
          onPointerLeave={() => {
            if (drawing.current) {
              drawing.current = false;
              write();
            }
          }}
        />
        {!signed ? (
          <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-[12px] text-(--text-faint)">
            {t('Sign here')}
          </p>
        ) : null}
      </div>
      <input ref={hidden} type="hidden" name={name} />
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-(--text-faint)">
          {signed
            ? t('Signed. Clear to start again.')
            : t('A finger, a stylus or a mouse all work.')}
        </p>
        <button
          type="button"
          className="text-[12px] font-medium underline underline-offset-2"
          onClick={() => {
            strokes.current = [];
            redraw();
            write();
          }}
        >
          {t('Clear')}
        </button>
      </div>
    </div>
  );
}

/** A signature drawn back from its strokes, wherever it is shown. */
export function SignatureImage({
  strokes,
  width,
  height,
  className,
}: {
  strokes: readonly (readonly (readonly [number, number])[])[];
  width: number;
  height: number;
  className?: string;
}) {
  const t = useT();
  const d = strokes
    .map((stroke) => stroke.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' '))
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={t('Signature')}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}
