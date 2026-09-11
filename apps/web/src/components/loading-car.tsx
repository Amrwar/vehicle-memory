/**
 * What a page shows while it is still fetching.
 *
 * A spinner says only that something is happening. This says what product you
 * are in, which is the whole difference between a wait that feels like part of
 * the thing and a wait that feels like a fault in it.
 *
 * Pure SVG and CSS, no script and no library. A loading state that has to
 * download and hydrate before it can appear is a loading state that shows up
 * after the content it was covering for.
 *
 * The wheels turn, the body settles on its suspension, and the road moves
 * underneath. Everything stops for anybody who has asked their system not to
 * animate, and what remains is a drawn car rather than a frozen frame of one.
 */
export function LoadingCar({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <svg
        width="168"
        height="84"
        viewBox="0 0 168 84"
        aria-hidden
        className="text-(--brand)"
        fill="none"
      >
        <defs>
          <linearGradient id="carnet-loading-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* The road, moving the other way, which is what sells the motion. */}
        <g stroke="var(--border)" strokeWidth="3" strokeLinecap="round">
          <g className="carnet-road">
            <line x1="8" y1="74" x2="34" y2="74" />
            <line x1="54" y1="74" x2="80" y2="74" />
            <line x1="100" y1="74" x2="126" y2="74" />
            <line x1="146" y1="74" x2="172" y2="74" />
            <line x1="192" y1="74" x2="218" y2="74" />
          </g>
        </g>

        <g className="carnet-body">
          {/* Cabin over a long bonnet: a shape read as a car at 30 pixels. */}
          <path
            d="M22 58 C22 44 30 40 44 39 L58 26 C62 21 68 19 75 19 L98 19 C106 19 112 22 117 28 L127 39 C140 41 148 46 148 58 Z"
            fill="url(#carnet-loading-body)"
          />
          <path
            d="M62 38 L72 26 C74 24 77 23 80 23 L95 23 C100 23 103 25 106 28 L114 38 Z"
            fill="var(--surface)"
            opacity="0.9"
          />
          <rect x="86" y="24" width="3" height="14" fill="url(#carnet-loading-body)" />
        </g>

        <g>
          <circle cx="54" cy="58" r="13" fill="var(--text)" opacity="0.9" />
          <circle cx="118" cy="58" r="13" fill="var(--text)" opacity="0.9" />
          <g className="carnet-wheel" style={{ transformOrigin: '54px 58px' }}>
            <circle cx="54" cy="58" r="5.5" fill="var(--surface)" />
            <line x1="54" y1="49" x2="54" y2="67" stroke="var(--surface)" strokeWidth="2" />
            <line x1="45" y1="58" x2="63" y2="58" stroke="var(--surface)" strokeWidth="2" />
          </g>
          <g className="carnet-wheel" style={{ transformOrigin: '118px 58px' }}>
            <circle cx="118" cy="58" r="5.5" fill="var(--surface)" />
            <line x1="118" y1="49" x2="118" y2="67" stroke="var(--surface)" strokeWidth="2" />
            <line x1="109" y1="58" x2="127" y2="58" stroke="var(--surface)" strokeWidth="2" />
          </g>
        </g>
      </svg>

      <p className="text-[13px] text-(--text-faint)">{label}</p>

      <style>{`
        @keyframes carnet-spin { to { transform: rotate(360deg); } }
        @keyframes carnet-settle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1.5px); } }
        @keyframes carnet-road { from { transform: translateX(0); } to { transform: translateX(-46px); } }
        .carnet-wheel { animation: carnet-spin 900ms linear infinite; }
        .carnet-body { animation: carnet-settle 1800ms ease-in-out infinite; }
        .carnet-road { animation: carnet-road 700ms linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .carnet-wheel, .carnet-body, .carnet-road { animation: none; }
        }
      `}</style>
    </div>
  );
}
