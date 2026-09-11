/**
 * The health score, drawn.
 *
 * An arc rather than a ring, because a ring reads as a progress indicator and
 * this is not progress towards anything. The gap at the bottom is where the
 * number sits, which is the only part most people read.
 *
 * Server-rendered SVG with no script. A gauge that arrives after hydration is
 * a gauge that is blank in a screenshot, blank in a printed report and blank
 * for the two seconds somebody actually looks at the page.
 *
 * The colour is semantic and is never the only carrier: the band is written
 * underneath in words, because a red arc and an amber arc are the same arc to
 * a good few of the people reading it.
 */
export function HealthDial({
  score,
  band,
  size = 132,
}: {
  score: number | null;
  band: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';
  size?: number;
}) {
  // A 240-degree sweep from south-west round to south-east.
  const start = 150;
  const sweep = 240;
  const radius = size / 2 - 12;
  const centre = size / 2;

  const point = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return [centre + radius * Math.cos(radians), centre + radius * Math.sin(radians)] as const;
  };

  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const filled = score == null ? 0 : (score / 100) * sweep;

  const tone =
    band === 'EXCELLENT'
      ? 'var(--success)'
      : band === 'GOOD'
        ? 'var(--brand)'
        : band === 'FAIR'
          ? 'var(--warning)'
          : band === 'POOR'
            ? 'var(--danger)'
            : 'var(--text-faint)';

  const words =
    band === 'UNKNOWN'
      ? 'Not enough on record to score this vehicle.'
      : `Health ${score} out of 100, which is ${band.toLowerCase()}.`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`} role="img">
        <title>{words}</title>
        <path
          d={arc(start, start + sweep)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {score != null && score > 0 ? (
          <path
            d={arc(start, start + filled)}
            fill="none"
            stroke={tone}
            strokeWidth={10}
            strokeLinecap="round"
          />
        ) : null}
        <text
          x={centre}
          y={centre + 4}
          textAnchor="middle"
          className="font-display"
          fontSize={size * 0.3}
          fontWeight={600}
          fill="var(--text)"
        >
          {score ?? '—'}
        </text>
      </svg>
      <span className="mt-1 text-[11px] font-medium tracking-wide text-(--text-faint) uppercase">
        {band === 'UNKNOWN' ? 'not scored' : band.toLowerCase()}
      </span>
    </div>
  );
}
