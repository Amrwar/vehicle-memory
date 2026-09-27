/**
 * Everything built, and a way to it. Phase 80.
 *
 *   npx tsx infra/scripts/verify-navigation.ts
 *
 * The sidebar was one list of fifty-two entries in seven groups named after the
 * parts of the system they came from, filtered by permission. The feature map
 * had called it **Partial** since Phase 45, and the reason it stayed partial is
 * that nothing could say what "finished" meant. Filtering a list is not
 * organising one.
 *
 * Phase 80 writes the navigation per role, in the order that role works in.
 * That is a judgement and this file does not check judgement. It checks the two
 * things that stop the judgement from quietly rotting:
 *
 *   1. **Every page has a way in.** Every static page in the workshop is in the
 *      owner's navigation, or named in `REACHED_ANOTHER_WAY` with the sentence
 *      that says how it is arrived at instead. A page nobody can find is worse
 *      than one nobody built, because the map says it is there and the tests
 *      say it works. This repository has found that state three times.
 *   2. **Nobody is shown a door they cannot open.** Every entry in a role's
 *      navigation is one that role's permissions allow. Items are absent rather
 *      than greyed out, so an entry that a role cannot use is not a disabled
 *      control -- it is a link to a refusal.
 *
 * And the excuses are checked in both directions: an entry in
 * `REACHED_ANOTHER_WAY` for a page that no longer exists is a sentence that has
 * stopped being true, which is how a list somebody types falls behind.
 *
 * Reads the route tree and the navigation. No database, no browser.
 */

import { can, hasTranslation, type Role, ROLES } from '@carnet/core';

import {
  everyNavHref,
  navigationFor,
  REACHED_ANOTHER_WAY,
} from '../../apps/web/src/lib/navigation';

import { everyRoute, isDynamic, visible } from './lib/routes';

let failures = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.info(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

/** Every page inside the workshop shell that a person could be sent to by name. */
function workshopPages(): string[] {
  return everyRoute()
    .filter((route) => route.startsWith('/(workshop)'))
    .filter((route) => !isDynamic(route))
    .map(visible)
    .sort();
}

function main() {
  console.info('\n  Everything built, and a way to it\n');

  const pages = workshopPages();
  const inNav = new Set(everyNavHref());
  const excused = new Set(Object.keys(REACHED_ANOTHER_WAY));

  /* --- one. every page has a way in ---------------------------------------- */

  const unreachable = pages.filter((page) => !inNav.has(page) && !excused.has(page));

  check(
    `all ${pages.length} pages in the workshop have a way in`,
    unreachable.length === 0,
    unreachable.length > 0
      ? `${unreachable.length} reachable from nowhere:\n        ` +
          unreachable.join('\n        ') +
          '\n        Put each in a section of apps/web/src/lib/navigation.ts, or say in\n' +
          '        REACHED_ANOTHER_WAY how somebody arrives at it.'
      : undefined,
  );

  /* --- and no excuse outlives the page it excuses -------------------------- */

  const stale = [...excused].filter((page) => !pages.includes(page));

  check(
    'and every page said to be reached another way still exists',
    stale.length === 0,
    stale.length > 0 ? `no such page: ${stale.join(', ')}` : undefined,
  );

  /* --- nor any entry pointing at nothing ----------------------------------- */

  const dangling = [...inNav].filter((href) => !pages.includes(href));

  check(
    'and every entry in the navigation is a page',
    dangling.length === 0,
    dangling.length > 0 ? `points at nothing: ${dangling.join(', ')}` : undefined,
  );

  /* --- two. nobody is shown a door they cannot open ------------------------ */

  const refused: string[] = [];

  for (const role of ROLES) {
    for (const section of navigationFor(role)) {
      for (const item of section.items) {
        if (!can(role, item.permission)) {
          refused.push(`${role} · ${section.label} · ${item.href} needs ${item.permission}`);
        }
      }
    }
  }

  check(
    'and no role is shown an entry their role would refuse',
    refused.length === 0,
    refused.join('\n        '),
  );

  /* --- and the shape of each one ------------------------------------------- */

  // The two who are never in this shell: a customer is in the portal, a
  // technician in /shop, and every workshop page sends a technician there.
  const ELSEWHERE: Role[] = ['CUSTOMER', 'TECHNICIAN'];
  const working = ROLES.filter((role) => !ELSEWHERE.includes(role));

  const empty = working.filter((role) => navigationFor(role).length === 0);
  check(
    `all ${working.length} roles inside the workshop have a navigation`,
    empty.length === 0,
    empty.join(', '),
  );

  check(
    'and the two who are never in this shell have none',
    ELSEWHERE.every((role) => navigationFor(role).length === 0),
    ELSEWHERE.filter((role) => navigationFor(role).length > 0).join(', '),
  );

  const hollow: string[] = [];
  const repeated: string[] = [];

  for (const role of working) {
    for (const section of navigationFor(role)) {
      if (section.items.length === 0) hollow.push(`${role} · ${section.label}`);

      const seen = new Set<string>();
      for (const item of section.items) {
        if (seen.has(item.href)) repeated.push(`${role} · ${section.label} · ${item.href}`);
        seen.add(item.href);
      }
    }
  }

  check('and no section is empty', hollow.length === 0, hollow.join(', '));
  check('and nothing is listed twice in one section', repeated.length === 0, repeated.join(', '));

  /* --- three. in all three languages --------------------------------------- */

  // Section labels are data, not literals in a page, so neither i18n-scan nor
  // verify-languages can see them: one collects `t('...')` out of source, the
  // other reads what a rendered page says, and a section heading is neither
  // until it is drawn. The same blind spot has cost this repository six
  // phases in other places. "Calendar" was added here as a heading and had no
  // French or Arabic; nothing else in the product would have said so.
  const words = new Set<string>();
  for (const role of ROLES) {
    for (const section of navigationFor(role)) {
      words.add(section.label);
      for (const item of section.items) words.add(item.label);
    }
  }

  const unanswered = [...words].flatMap((word) => [
    ...(hasTranslation('fr', word) ? [] : [`fr: ${word}`]),
    ...(hasTranslation('ar', word) ? [] : [`ar: ${word}`]),
  ]);

  check(
    `and all ${words.size} words in it are answered in French and Arabic`,
    unanswered.length === 0,
    unanswered.join(', '),
  );

  /* --- what each person is shown, for reading ------------------------------ */

  console.info('');
  for (const role of working) {
    const sections = navigationFor(role);
    const items = sections.reduce((n, section) => n + section.items.length, 0);
    console.info(
      `  ${role.toLowerCase().padEnd(16)} ${String(sections.length).padStart(2)} sections, ${String(items).padStart(2)} entries: ` +
        sections.map((section) => section.label).join(' · '),
    );
  }

  console.info(
    failures === 0
      ? '\n  Everything built has a way in, and nobody is shown a door they cannot open.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main();
