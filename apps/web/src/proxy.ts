import { contentSecurityPolicy } from '@carnet/core';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * A Content Security Policy on every page. Phase 21, security model §7.
 *
 * A fresh nonce per request; scripts run only with it. Next stamps the nonce
 * onto its own inline scripts by reading the policy from the request header
 * set here, and the one inline script the product writes itself, the theme
 * stamp in the root layout, reads it from the same header. Anything else
 * inline is refused by the browser, which is the point.
 *
 * Static assets and prefetches are left out: they carry no HTML.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === 'development',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|sw.js).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
