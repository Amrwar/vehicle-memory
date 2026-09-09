import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Link expired',
  robots: { index: false, follow: false },
};

/**
 * A dead passport link.
 *
 * Whoever lands here has no account, arrived from a link somebody sent them,
 * and is probably standing next to a car deciding whether to buy it. Next's
 * default "This page could not be found" tells them nothing and implies the
 * fault is theirs.
 *
 * So this page does three things: says plainly what happened, explains that
 * expiry is a feature rather than a failure, and tells them exactly how to get
 * a working link. The illustration is there to take the sting out of a dead
 * end, not to decorate it.
 */
export default function PassportLinkNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-(--ground) px-4 py-10">
      <main id="main" className="w-full max-w-lg text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="text-(--brand)"
          >
            <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 4.6v5.4l3.4 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display text-[14px] font-semibold">Carnet</span>
        </div>

        <TiredCar />

        <h1 className="mt-6 font-display text-[26px] font-semibold leading-tight">
          This link has run out of road
        </h1>

        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-(--text-soft)">
          The vehicle history it pointed to is still there. The link itself has expired, or the
          owner has withdrawn it.
        </p>

        <div className="mx-auto mt-7 max-w-md rounded-(--radius-lg) border border-(--border) bg-(--surface) p-5 text-left">
          <p className="eyebrow mb-2">Why links expire</p>
          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            A vehicle&rsquo;s history belongs to the vehicle, and its owner decides who may read it.
            Every share link is time-limited and can be revoked at any moment, so a record shared
            once for a sale does not stay open to the internet forever.
          </p>
        </div>

        <div className="mx-auto mt-4 max-w-md rounded-(--radius-lg) border border-(--brand) bg-(--brand-soft) p-5 text-left">
          <p className="eyebrow mb-2 text-(--brand-text)">What to do</p>
          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            Ask whoever sent it to share the vehicle again. It takes them a few seconds and produces
            a fresh link.
          </p>
        </div>

        <p className="mt-8 text-[12px] leading-relaxed text-(--text-faint)">
          Carnet keeps a permanent, append-only record of what has happened to a vehicle: services,
          repairs, parts, mileage and inspections, each attributed to the workshop that recorded it.
          The history follows the car, not the owner.
        </p>
      </main>
    </div>
  );
}

/**
 * A car that has had enough. Line art rather than a cartoon: the audience is a
 * buyer about to spend real money, and a jokey illustration would undercut the
 * seriousness of everything else on the site.
 *
 * The flat rear tyre and the drooping stance carry the "expired" idea without
 * needing a caption.
 */
function TiredCar() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="mx-auto w-full max-w-[340px]"
      role="img"
      aria-label="A line drawing of a car resting on a flat rear tyre"
    >
      <title>An expired link</title>

      {/* ground */}
      <line
        x1="20"
        y1="146"
        x2="340"
        y2="146"
        stroke="currentColor"
        className="text-(--border-strong)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />

      {/* body: nose high, tail settled onto the flat tyre */}
      <path
        d="M44 118
           C 44 104, 54 98, 70 96
           L 104 92
           C 118 76, 140 68, 168 68
           C 196 68, 218 74, 232 90
           L 276 96
           C 298 100, 312 108, 314 122
           L 314 126
           C 314 131, 310 134, 304 134
           L 60 134
           C 50 134, 44 130, 44 122
           Z"
        fill="none"
        stroke="currentColor"
        className="text-(--text)"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />

      {/* glasshouse */}
      <path
        d="M116 90 C 128 78, 146 73, 167 73 C 190 73, 208 78, 220 89 Z"
        fill="currentColor"
        className="text-(--brand-soft)"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line
        x1="168"
        y1="72"
        x2="168"
        y2="90"
        stroke="currentColor"
        className="text-(--text)"
        strokeWidth="1.5"
      />

      {/* front wheel, still round */}
      <circle
        cx="104"
        cy="134"
        r="17"
        fill="var(--surface)"
        stroke="currentColor"
        className="text-(--text)"
        strokeWidth="2.25"
      />
      <circle cx="104" cy="134" r="6" fill="currentColor" className="text-(--border-strong)" />

      {/* rear wheel, flat: squashed and sitting lower */}
      <ellipse
        cx="266"
        cy="138"
        rx="18"
        ry="12"
        fill="var(--surface)"
        stroke="currentColor"
        className="text-(--danger)"
        strokeWidth="2.25"
      />
      <ellipse
        cx="266"
        cy="138"
        rx="6"
        ry="4"
        fill="currentColor"
        className="text-(--border-strong)"
      />

      {/* the deflating puff */}
      <path
        d="M288 130 q 10 -5 16 -14 M296 136 q 13 -3 22 -10"
        fill="none"
        stroke="currentColor"
        className="text-(--text-faint)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      {/* headlamp, dimmed */}
      <path
        d="M50 112 h 10"
        stroke="currentColor"
        className="text-(--text-faint)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* resting marks over the roof */}
      <g className="text-(--text-faint)" fill="currentColor" fontFamily="var(--font-mono)">
        <text x="228" y="46" fontSize="11">
          z
        </text>
        <text x="243" y="34" fontSize="14">
          z
        </text>
        <text x="262" y="20" fontSize="17">
          z
        </text>
      </g>
    </svg>
  );
}
