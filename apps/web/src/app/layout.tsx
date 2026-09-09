import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Public_Sans } from 'next/font/google';

import { THEME_SCRIPT } from '@/components/theme-toggle';

import './globals.css';

/**
 * Fonts are self-hosted at build time rather than fetched from Google.
 *
 * The stylesheet link this replaces was render-blocking and third-party: two
 * preconnects, a CSS round trip, then the font files, all before the first
 * paint of every page. Self-hosting removes the round trips and the tracking,
 * and `display: swap` means text is readable before the faces arrive.
 */
const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
});

const sans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-public-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Carnet',
    template: '%s · Carnet',
  },
  description:
    'Workshop management with a portable vehicle history that follows the car, not the owner or the garage.',
  applicationName: 'Carnet',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zooming is never disabled: a technician with the tablet at arm's length
  // and a customer reading an estimate both need it.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1012' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Stamps the stored theme on <html> before anything is drawn. Without
            it, a dark-mode user gets a white flash on every cold load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-(--surface) focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
