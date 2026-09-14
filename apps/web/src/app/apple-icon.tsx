import { ImageResponse } from 'next/og';

/**
 * The home-screen icon, rendered to PNG at request time because iOS will
 * not take an SVG. The drawing is /icon.svg, shape for shape, on the same
 * petrol ground; iOS rounds the corners itself, so the square is left square.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1f6167',
      }}
    >
      <svg width="180" height="180" viewBox="0 0 64 64">
        <rect x="13" y="7" width="38" height="50" rx="6" fill="#0f1f22" />
        <rect x="13" y="7" width="7" height="50" rx="3.5" fill="#06110f" />
        <path
          d="M20 7h31a6 6 0 0 1 6 6v38a6 6 0 0 1-6 6H20"
          fill="none"
          stroke="#f0c86a"
          strokeWidth="1.5"
        />
        <circle cx="35" cy="28" r="11" fill="none" stroke="#f0c86a" strokeWidth="5" />
        <circle cx="35" cy="28" r="3.6" fill="#fff1c4" />
        <path
          d="M35 17v-3M35 42v-3M24 28h-3M49 28h-3"
          stroke="#f0c86a"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path d="M26 47h18M26 52h11" stroke="#f0c86a" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </div>,
    size,
  );
}
