/**
 * The stranded car.
 *
 * Shared by every dead end in the product: an unknown URL, an expired share
 * link, a vehicle somebody no longer has access to. One drawing, so the app
 * has a single visual idea for "this road stops here" rather than three.
 *
 * Drawn rather than illustrated: line art on the page's own tokens, so it
 * inherits the theme and reads correctly on both light and dark grounds. A
 * flat raster illustration would need two exports and would still be wrong on
 * the third theme somebody asks for.
 *
 * Deliberately not comic. The audience is often a buyer about to spend real
 * money, and a jokey cartoon would undercut everything else on the page.
 */
export function StrandedCar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 210"
      className={className}
      role="img"
      aria-label="A line drawing of a car stopped at the end of a road, resting on a flat tyre"
    >
      <title>The road stops here</title>

      <defs>
        {/* The road fades out rather than ending abruptly. */}
        <linearGradient id="road-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="22%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="72%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* --- ground ------------------------------------------------------ */}
      <g className="text-(--border-strong)">
        <line x1="0" y1="171" x2="420" y2="171" stroke="url(#road-fade)" strokeWidth="2" />
        {/* centre line, running out */}
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35">
          <line x1="16" y1="183" x2="42" y2="183" />
          <line x1="58" y1="183" x2="80" y2="183" />
          <line x1="96" y1="183" x2="114" y2="183" />
          <line x1="130" y1="183" x2="144" y2="183" />
          <line x1="160" y1="183" x2="170" y2="183" />
          <line x1="186" y1="183" x2="192" y2="183" />
        </g>
      </g>

      {/* --- the car ----------------------------------------------------- */}
      <g className="text-(--text)">
        {/* shadow pooled under the settled rear */}
        <ellipse
          cx="250"
          cy="170"
          rx="118"
          ry="6"
          className="text-(--border-strong)"
          fill="currentColor"
          opacity="0.28"
        />

        {/* lower body: nose up, tail down onto the flat */}
        <path
          d="M146 148
             C 138 148, 133 143, 134 136
             L 136 124
             C 138 114, 146 108, 158 106
             L 186 101
             C 199 84, 219 75, 246 74
             C 274 73, 297 80, 311 96
             L 344 103
             C 361 107, 372 116, 373 129
             L 373 138
             C 373 145, 368 149, 360 149
             Z"
          fill="var(--surface)"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* glasshouse */}
        <path
          d="M196 99
             C 208 87, 226 80, 246 79
             C 268 78, 288 84, 300 96
             Z"
          className="text-(--brand-soft)"
          fill="currentColor"
          stroke="var(--text)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* b-pillar */}
        <line x1="249" y1="79" x2="249" y2="98" stroke="currentColor" strokeWidth="1.75" />

        {/* door line and handle */}
        <path d="M212 100 L 212 143" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <line
          x1="222"
          y1="118"
          x2="234"
          y2="118"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* headlamp, off */}
        <path
          d="M137 128 h 12"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="text-(--text-faint)"
        />

        {/* front wheel: round, still fine */}
        <circle
          cx="192"
          cy="149"
          r="21"
          fill="var(--surface)"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <circle cx="192" cy="149" r="7.5" className="text-(--border-strong)" fill="currentColor" />

        {/* rear wheel: flat. Squashed, sitting lower, and the only red on the
            page, so the eye lands on the actual problem. */}
        <ellipse
          cx="322"
          cy="154"
          rx="22"
          ry="15"
          fill="var(--surface)"
          className="text-(--danger)"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <ellipse
          cx="322"
          cy="154"
          rx="7.5"
          ry="5"
          className="text-(--border-strong)"
          fill="currentColor"
        />
      </g>

      {/* --- it has given up --------------------------------------------- */}
      <g className="text-(--text-faint)" stroke="currentColor" fill="none" strokeLinecap="round">
        {/* air leaving the tyre */}
        <path d="M348 146 q 12 -6 19 -16" strokeWidth="2" opacity="0.75" />
        <path d="M352 156 q 16 -4 26 -12" strokeWidth="2" opacity="0.5" />
      </g>

      {/* resting, not broken */}
      <g className="text-(--text-faint)" fill="currentColor" fontFamily="var(--font-mono)">
        <text x="296" y="58" fontSize="12" opacity="0.55">
          z
        </text>
        <text x="312" y="42" fontSize="15" opacity="0.75">
          z
        </text>
        <text x="332" y="24" fontSize="19">
          z
        </text>
      </g>
    </svg>
  );
}
