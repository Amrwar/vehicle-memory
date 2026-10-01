/**
 * Languages, against the source and a running server. Phase 37.5.
 *
 *   npx tsx infra/scripts/verify-languages.ts [baseUrl]
 *
 * Every sentence a page passes to t() must have a French and an Arabic
 * translation; the script names each one that does not, and fails. With
 * a server on the base URL it reads the public site, the sign-in page,
 * the customer's portal and the workshop dashboard in each language,
 * checks the root element carries the language and the direction (Arabic
 * right to left), checks a known sentence appears translated, and checks
 * the switcher sets the cookie and sends the person back where they were.
 */

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { hasTranslation, LANGUAGES, translate } from '@carnet/core';
import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const ROOT = join(__dirname, '..', '..', 'apps', 'web', 'src');
const UI = join(__dirname, '..', '..', 'packages', 'ui', 'src');

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Every sentence passed to t() in the app, with the file it is in. */
function sentencesInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of [...walk(ROOT), ...walk(UI)]) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\b(?:t|msg)\(\s*'((?:[^'\\]|\\.)*)'\s*[,)]/g)) {
      const text = m[1]!.replace(/\\'/g, "'");
      if (!found.has(text)) found.set(text, []);
      found.get(text)!.push(file.replace(ROOT, ''));
    }
    for (const m of src.matchAll(/\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"\s*[,)]/g)) {
      const text = m[1]!;
      if (!found.has(text)) found.set(text, []);
      found.get(text)!.push(file.replace(ROOT, ''));
    }
  }
  return found;
}

async function main() {
  console.info(`\n  Languages\n  ${BASE}\n`);

  /* --- the dictionaries cover the source ------------------------------ */

  console.info('  Coverage\n');
  const sentences = sentencesInSource();
  check('sentences passed to t() in the app', sentences.size > 200, true);
  for (const language of LANGUAGES) {
    if (language === 'en') continue;
    const missing = [...sentences.keys()].filter((text) => !hasTranslation(language, text));
    check(`${language}: every sentence has a translation`, missing.length, 0);
    for (const text of missing.slice(0, 20)) {
      console.error(`         missing in ${language}: "${text}" (${sentences.get(text)![0]})`);
    }
  }
  check(
    'a translation keeps its slots',
    translate('fr', 'Hello {name}', { name: 'Maria' }).includes('Maria'),
    true,
  );
  check(
    'a finished sentence is read back through its key',
    translate('fr', 'Hello Maria').includes('Maria') &&
      translate('fr', 'Hello Maria') !== 'Hello Maria',
    true,
  );

  /* --- nothing reaches a page without the translator (Phase 40.5) ----- */

  console.info('\n  Every word\n');

  const scan = (args: string[]) => {
    try {
      const out = execFileSync('npx', ['tsx', join(__dirname, 'i18n-scan.ts'), ...args], {
        encoding: 'utf8',
        shell: true,
      });
      return { ok: true, last: out.trim().split('\n').pop() ?? '' };
    } catch (error) {
      const out = String((error as { stdout?: string }).stdout ?? '');
      console.error(out.split('\n').slice(0, 40).join('\n'));
      return { ok: false, last: out.trim().split('\n').pop() ?? '' };
    }
  };
  const pages = scan([]);
  check(`the pages, the components and the UI package: ${pages.last.trim()}`, pages.ok, true);
  const thrown = scan(['--messages', '--quiet']);
  check(`sentences thrown when something is refused: ${thrown.last.trim()}`, thrown.ok, true);

  /* --- the pages, in each language ------------------------------------ */

  console.info('\n  The pages\n');

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    include: { memberships: true },
  });
  const driver = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const ownerCookie = await sessionFor(owner.id, owner.memberships[0]?.orgId ?? null);
  const driverCookie = await sessionFor(driver.id, null);

  const expectations: { path: string; cookie: string; sentence: string }[] = [
    { path: '/', cookie: '', sentence: 'Start your trial' },
    { path: '/login', cookie: '', sentence: 'Sign in' },
    { path: '/pricing', cookie: '', sentence: 'Per bay, per month, published in full' },
    { path: '/signup', cookie: '', sentence: 'Open your workshop' },
    { path: '/terms', cookie: '', sentence: 'Terms of service' },
    { path: '/portal', cookie: driverCookie, sentence: 'My cars' },
    { path: '/portal/settings', cookie: driverCookie, sentence: 'Your details' },
    { path: '/dashboard', cookie: ownerCookie, sentence: 'Diary' },
    // The workshop's own pages, translated in Phase 40.5.
    { path: '/dashboard', cookie: ownerCookie, sentence: 'Vehicles in shop' },
    { path: '/reputation', cookie: ownerCookie, sentence: 'How it is moving' },
    { path: '/people', cookie: ownerCookie, sentence: 'Productivity' },
    { path: '/settings', cookie: ownerCookie, sentence: 'Subscription' },
    { path: '/reports/business?range=quarter', cookie: ownerCookie, sentence: 'What came back' },
  ];

  for (const language of LANGUAGES) {
    for (const e of expectations) {
      const page = await fetchPage(
        e.path,
        [e.cookie, `carnet_lang=${language}`].filter(Boolean).join('; '),
      );
      if (!page) continue;
      const expectedLang = language === 'en' ? 'en' : language;
      check(
        `${e.path} in ${language}: the root element says so`,
        [
          page.includes(`lang="${expectedLang}`),
          page.includes(`dir="${language === 'ar' ? 'rtl' : 'ltr'}"`),
        ],
        [true, true],
      );
      const translated = translate(language, e.sentence);
      check(
        `${e.path} in ${language}: "${e.sentence}" reads as "${translated.slice(0, 30)}"`,
        page.includes(escapeHtml(translated)),
        true,
      );
      if (language !== 'en' && translated !== e.sentence && e.sentence.includes(' ')) {
        check(
          `${e.path} in ${language}: and the English "${e.sentence}" is not left on it`,
          page.includes(`>${escapeHtml(e.sentence)}<`),
          false,
        );
      }
    }
  }

  /* --- the switcher ---------------------------------------------------- */

  console.info('\n  The switcher\n');
  try {
    const form = new URLSearchParams({ language: 'fr', back: '/pricing' });
    const response = await fetch(`${BASE}/api/language`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'manual',
    });
    check(
      'the switcher sends the person back',
      [response.status, response.headers.get('location')?.endsWith('/pricing')],
      [303, true],
    );
    check(
      'and sets the cookie for a year',
      response.headers.get('set-cookie')?.includes('carnet_lang=fr'),
      true,
    );
    const away = await fetch(`${BASE}/api/language`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ language: 'fr', back: 'https://elsewhere.test/x' }),
      redirect: 'manual',
    });
    check('never off the site', new URL(away.headers.get('location') ?? '/', BASE).pathname, '/');
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   the switcher: no server at ${BASE} (${String(error)})`);
  }

  /* --- saved on the account ------------------------------------------- */

  const before = (
    await prisma.user.findUniqueOrThrow({ where: { id: driver.id }, select: { language: true } })
  ).language;
  const saved = await fetch(`${BASE}/api/language`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: driverCookie },
    body: new URLSearchParams({ language: 'ar', back: '/portal' }),
    redirect: 'manual',
  }).catch(() => null);
  if (saved) {
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: driver.id },
      select: { language: true },
    });
    check("a signed-in person's choice is saved on their account", after.language, 'ar');
    await prisma.user.update({ where: { id: driver.id }, data: { language: before } });
  }

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
}

async function fetchPage(path: string, cookie: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${path}: answered ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${path}: no server at ${BASE} (${String(error)})`);
    return null;
  }
}

async function sessionFor(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
