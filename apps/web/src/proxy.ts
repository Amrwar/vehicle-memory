import { contentSecurityPolicy } from '@carnet/core';
import { type NextRequest, NextResponse } from 'next/server';

import { looksLikeTrace, mintTrace, TRACE_HEADER } from '@/lib/trace';

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

  // One identifier per request, carried into everything the request causes:
  // the audit record, the outbox event, the message, the staff notification.
  // Phase 59, NFR-803.
  //
  // An identifier already on the way in is kept rather than replaced, so a
  // provider's webhook that arrives carrying its own can be followed from
  // their side to ours. Anything that is not the right shape is ignored: this
  // goes into a search box and a log line, and a header a stranger controls is
  // not a thing to put in either without looking at it.
  const offered = request.headers.get(TRACE_HEADER);
  const trace = offered && looksLikeTrace(offered) ? offered.trim() : mintTrace();
  requestHeaders.set(TRACE_HEADER, trace);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  // Sent back as well, so somebody watching the network tab or reading a
  // response header can quote it down the telephone.
  response.headers.set(TRACE_HEADER, trace);
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
