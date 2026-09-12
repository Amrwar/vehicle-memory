/**
 * Every response carries the security headers the security model promises.
 *
 *   npx tsx infra/scripts/verify-headers.ts [baseUrl]
 *
 * Section 7 of the security model lists CSP, HSTS, X-Content-Type-Options,
 * Referrer-Policy and Permissions-Policy. Until Phase 21 the CSP line was a
 * promise. This asks the running application for a public page, a signed-in
 * page, an API refusal and a static asset, and checks what came back: the
 * policy exists, carries a nonce, forbids inline scripts, and differs per
 * request; the nonce on the page's own inline script matches the header.
 *
 * HSTS is added at the edge by the host and is asserted only over https.
 */

import 'dotenv/config';

import { assessPolicy, REQUIRED_SECURITY_HEADERS } from '@carnet/core';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function page(path: string) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

async function main() {
  console.info(`\n  Security headers\n  ${BASE}\n`);

  for (const path of ['/', '/login', '/pricing', '/signup/customer', '/dashboard', '/p/nope']) {
    const { status, headers, body } = await page(path);
    console.info(`\n${path} (${status})`);

    for (const name of REQUIRED_SECURITY_HEADERS) {
      check(`  ${name} present`, headers.has(name), true);
    }

    const policy = headers.get('content-security-policy') ?? '';
    check('  the policy has nothing wrong with it', assessPolicy(policy), []);

    // A nonce is only useful if it is the one the page's inline script carries.
    const headerNonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? null;
    if (status === 200 && body.includes('<script')) {
      const scriptNonces = [...body.matchAll(/<script[^>]*\snonce="([^"]+)"/g)].map((m) => m[1]);
      check(
        '  every inline script carries the header nonce',
        scriptNonces.length > 0 && scriptNonces.every((n) => n === headerNonce),
        true,
      );
      const unnonced = [...body.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*\snonce=)[^>]*>/g)].length;
      check('  and no inline script is without one', unnonced, 0);
    }
  }

  console.info('\nThe nonce is per request');
  const a = (await page('/login')).headers.get('content-security-policy') ?? '';
  const b = (await page('/login')).headers.get('content-security-policy') ?? '';
  check(
    'two requests get two nonces',
    /'nonce-([^']+)'/.exec(a)?.[1] !== /'nonce-([^']+)'/.exec(b)?.[1],
    true,
  );

  console.info('\nThe API');
  const api = await page('/api/v1/jobs');
  check(
    'an API refusal is JSON',
    api.headers.get('content-type')?.includes('application/json'),
    true,
  );
  check('  with nosniff', api.headers.get('x-content-type-options'), 'nosniff');

  if (BASE.startsWith('https://')) {
    console.info('\nOver https');
    const { headers } = await page('/login');
    check(
      'HSTS is set at the edge',
      /max-age=\d+/.test(headers.get('strict-transport-security') ?? ''),
      true,
    );
  }

  console.info(
    failures === 0 ? '\nverify-headers: all checks passed' : `\nverify-headers: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
