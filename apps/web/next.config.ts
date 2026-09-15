import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Workspace packages ship TypeScript source rather than a build step.
  transpilePackages: ['@carnet/ui', '@carnet/core', '@carnet/db'],

  // Prisma and the pg driver must not be bundled; they load native and
  // wasm assets at runtime.
  // The headless browser that renders PDFs ships its own binary. Phase 42.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
    'bcryptjs',
    'playwright-core',
    '@sparticuz/chromium',
  ],

  // The packaged browser is read from disk at run time, which file tracing
  // cannot see, so the PDF route is told to carry it. The workspace installs
  // it at the repository root. Phase 42.
  outputFileTracingIncludes: {
    '/api/print/[kind]/[id]': [
      '../../node_modules/@sparticuz/chromium/bin/**',
      './node_modules/@sparticuz/chromium/bin/**',
    ],
  },

  typedRoutes: false,

  /**
   * One address for every page.
   *
   * Both names serve the site, which is two addresses for every page: search
   * engines read them as duplicates and links get shared inconsistently. The
   * bare domain wins because it is what SITE_URL and every link inside an
   * email already use.
   *
   * Done here rather than in a hosting panel so it is reviewable, travels with
   * the code, and survives a move to somewhere else.
   */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.carnetpassport.com' }],
        destination: 'https://carnetpassport.com/:path*',
        // Permanent, so browsers and search engines stop asking. Worth being
        // sure before shipping: a 308 is cached for a long time and is
        // awkward to take back.
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default config;
