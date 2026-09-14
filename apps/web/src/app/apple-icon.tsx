import { ImageResponse } from 'next/og';

/**
 * The home-screen icon, rendered to PNG at request time because iOS will
 * not take an SVG. The same booklet and foil wheel as the favicon, on a
 * ground the platform will not mask into a corner.
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
        background: '#0f1f22',
      }}
    >
      <svg width="150" height="150" viewBox="0 0 64 64">
        <rect x="9" y="4" width="46" height="56" rx="7" fill="#15292d" />
        <rect x="9" y="4" width="6" height="56" rx="3" fill="#0b1719" />
        <path
          d="M20.5 41.5c-3.5-5.5-3-13.5 1-18.5"
          fill="none"
          stroke="#d9b36c"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M45.5 41.5c3.5-5.5 3-13.5-1-18.5"
          fill="none"
          stroke="#d9b36c"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="33" cy="30" r="10.5" fill="none" stroke="#d9b36c" strokeWidth="3" />
        <circle cx="33" cy="30" r="3.2" fill="#f2dfae" />
        <path
          d="M33 22.5v-3M33 40.5v-3M25.5 30h-3M43.5 30h-3"
          stroke="#d9b36c"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M22 49h22M22 54h14" stroke="#d9b36c" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>,
    size,
  );
}
