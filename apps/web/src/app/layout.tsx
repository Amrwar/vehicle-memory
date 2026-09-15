import { headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import {
  Archivo,
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Public_Sans,
} from 'next/font/google';

import { LanguageProvider } from '@/components/language-provider';
import { THEME_SCRIPT } from '@/components/theme-toggle';
import { htmlAttributes, tFor } from '@/lib/i18n';

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

// The passport's own face: an engraved, document serif for the cover and the
// identity page, used nowhere else. Loaded here so it is self-hosted and the
// content security policy needs no font host.
const document = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Arabic. The Latin faces carry no Arabic glyphs, so without this the browser
// chose one. Not preloaded: the unicode range means only a page with Arabic
// on it downloads the files.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: {
      default: 'Carnet',
      template: '%s · Carnet',
    },
    description: t(
      'Workshop management with a portable vehicle history that follows the car, not the owner or the garage.',
    ),
    applicationName: 'Carnet',
    // The manifest is scoped to the shop floor, so installing puts the
    // technician's own screens on a home screen and nothing else. Nobody wants
    // an icon that opens a ledger.
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Carnet', statusBarStyle: 'black-translucent' },
    robots: { index: false, follow: false },
  };
}

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The per-request nonce the proxy set, so the one inline script the product
  // writes itself is allowed by the policy the proxy sent.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const html = await htmlAttributes();
  const t = await tFor();

  return (
    <html
      lang={html.lang}
      dir={html.dir}
      className={`${display.variable} ${sans.variable} ${mono.variable} ${document.variable} ${arabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Stamps the stored theme on <html> before anything is drawn. Without
            it, a dark-mode user gets a white flash on every cold load. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded focus:bg-(--surface) focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-lg"
        >
          {t('Skip to content')}
        </a>
        <LanguageProvider language={html.language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
