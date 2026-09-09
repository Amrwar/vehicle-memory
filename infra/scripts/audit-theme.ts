/**
 * Contrast audit.
 *
 *   npx tsx infra/scripts/audit-theme.ts
 *
 * Parses the design tokens out of the stylesheet, resolves them through their
 * var() chains, and measures every pair a component actually puts together, in
 * both themes. "It looks fine on my screen" is not a check: the failure this
 * catches is text that is legible on the author's monitor and gone on a tablet
 * in a bright workshop.
 *
 * Also asserts that the two dark blocks carry identical values, because a
 * person on a dark OS and a person who pressed the dark button must get the
 * same product.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = join(process.cwd(), 'packages/ui/src/styles.css');

/** WCAG AA: 4.5 for body text, 3.0 for large text, UI borders and icons. */
const BODY = 4.5;
const LARGE = 3;

type Pair = {
  label: string;
  fg: string;
  bg: string;
  min: number;
  /** Decoration rather than information; measured but not enforced. */
  advisory?: boolean;
};

const PAIRS: Pair[] = [
  { label: 'body text on the page ground', fg: '--text', bg: '--ground', min: BODY },
  { label: 'body text on a card', fg: '--text', bg: '--surface', min: BODY },
  { label: 'body text on a sunk panel', fg: '--text', bg: '--surface-sunk', min: BODY },
  { label: 'secondary text on a card', fg: '--text-soft', bg: '--surface', min: BODY },
  { label: 'secondary text on the ground', fg: '--text-soft', bg: '--ground', min: BODY },
  { label: 'faint text on a card', fg: '--text-faint', bg: '--surface', min: BODY },
  { label: 'faint text on a sunk panel', fg: '--text-faint', bg: '--surface-sunk', min: BODY },
  { label: 'eyebrow labels on the ground', fg: '--text-faint', bg: '--ground', min: LARGE },

  { label: 'primary button label', fg: '--on-brand-solid', bg: '--brand-solid', min: BODY },
  {
    label: 'primary button, hovered',
    fg: '--on-brand-solid',
    bg: '--brand-solid-hover',
    min: BODY,
  },
  { label: 'accent button label', fg: '--on-accent-solid', bg: '--accent-solid', min: BODY },
  {
    label: 'accent button, hovered',
    fg: '--on-accent-solid',
    bg: '--accent-solid-hover',
    min: BODY,
  },

  { label: 'brand text on a card', fg: '--brand-text', bg: '--surface', min: BODY },
  { label: 'brand text on its own tint', fg: '--brand-text', bg: '--brand-soft', min: BODY },
  { label: 'active nav item', fg: '--brand-text', bg: '--brand-soft', min: BODY },
  { label: 'accent text on its own tint', fg: '--accent-text', bg: '--accent-soft', min: BODY },

  { label: 'success badge', fg: '--success', bg: '--success-soft', min: BODY },
  { label: 'warning badge', fg: '--warning', bg: '--warning-soft', min: BODY },
  { label: 'danger badge', fg: '--danger', bg: '--danger-soft', min: BODY },
  { label: 'info badge', fg: '--info', bg: '--info-soft', min: BODY },

  { label: 'success text on a card', fg: '--success', bg: '--surface', min: BODY },
  { label: 'warning text on a card', fg: '--warning', bg: '--surface', min: BODY },
  { label: 'danger text on a card', fg: '--danger', bg: '--surface', min: BODY },
  { label: 'info text on a card', fg: '--info', bg: '--surface', min: BODY },

  { label: 'danger button label', fg: '--on-danger-solid', bg: '--danger-solid', min: BODY },
  { label: 'chain badge tick', fg: '--on-success-solid', bg: '--success-solid', min: LARGE },
  // Both chips sit on their own soft tint, not on the bare card.
  { label: 'danger chip against its panel', fg: '--danger-solid', bg: '--danger-soft', min: LARGE },
  {
    label: 'success chip against its panel',
    fg: '--success-solid',
    bg: '--success-soft',
    min: LARGE,
  },

  {
    label: 'card border against the ground',
    fg: '--border',
    bg: '--ground',
    min: 1.2,
    advisory: true,
  },
  {
    label: 'strong border on a card',
    fg: '--border-strong',
    bg: '--surface',
    min: 1.5,
    advisory: true,
  },
  { label: 'focus ring on a card', fg: '--border-focus', bg: '--surface', min: LARGE },
  { label: 'focus ring on the ground', fg: '--border-focus', bg: '--ground', min: LARGE },
  { label: 'brand hairline on a card', fg: '--brand', bg: '--surface', min: LARGE },
];

/* --- colour ---------------------------------------------------------------- */

function channel(hex: string): [number, number, number] {
  let value = hex.trim().replace('#', '');
  if (value.length === 3)
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channel(hex).map((raw) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/* --- token parsing --------------------------------------------------------- */

/** Every `--name: value;` inside one brace-delimited block. */
function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

function blockAfter(css: string, marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Could not find "${marker}" in the stylesheet`);

  let depth = 0;
  let index = css.indexOf('{', start);
  const from = index;

  for (; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(from + 1, index);
    }
  }

  throw new Error(`Unclosed block after "${marker}"`);
}

function resolve(token: string, scope: Map<string, string>): string | null {
  if (token.startsWith('#')) return token;

  let value = scope.get(token);
  for (let hop = 0; hop < 8 && value; hop += 1) {
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    if (!reference) return value.startsWith('#') ? value : null;
    value = scope.get(reference[1]!);
  }
  return null;
}

/* --- run ------------------------------------------------------------------- */

const css = readFileSync(CSS, 'utf8');

const palette = declarations(blockAfter(css, '@theme'));
const light = new Map([...palette, ...declarations(blockAfter(css, ':root {'))]);

const mediaDark = declarations(blockAfter(css, ":root:not([data-theme='light']) {"));
const stampedDark = declarations(blockAfter(css, ":root[data-theme='dark'],"));

const dark = new Map([...light, ...stampedDark]);

let failures = 0;

console.info('\n  Theme audit\n');

// The two dark declarations must agree, or the app is two products.
const drift = [...new Set([...mediaDark.keys(), ...stampedDark.keys()])].filter(
  (token) => mediaDark.get(token) !== stampedDark.get(token),
);

if (drift.length > 0) {
  failures += 1;
  console.info('  FAIL  the two dark blocks disagree');
  for (const token of drift) {
    console.info(
      `        ${token}: system-dark "${mediaDark.get(token) ?? 'absent'}" vs chosen-dark "${stampedDark.get(token) ?? 'absent'}"`,
    );
  }
} else {
  console.info(`  ok    both dark blocks carry the same ${stampedDark.size} tokens`);
}

console.info('');
console.info('  pair                                        light      dark');
console.info('  ' + '-'.repeat(62));

for (const pair of PAIRS) {
  const row: string[] = [];
  let worst = Infinity;

  for (const scope of [light, dark]) {
    const fg = resolve(pair.fg, scope);
    const bg = resolve(pair.bg, scope);

    if (!fg || !bg) {
      row.push('  n/a ');
      continue;
    }

    const ratio = contrast(fg, bg);
    worst = Math.min(worst, ratio);
    const ok = ratio >= pair.min;
    row.push(`${ratio.toFixed(2).padStart(5)}${ok ? '  ' : ' !'}`);
  }

  const passed = worst >= pair.min;
  if (!passed && !pair.advisory) failures += 1;

  console.info(
    `  ${passed ? ' ' : '!'} ${pair.label.padEnd(41)} ${row[0]}   ${row[1]}` +
      (passed ? '' : `   needs ${pair.min}`),
  );
}

console.info('  ' + '-'.repeat(62));
console.info(
  `\n  ${failures === 0 ? 'Everything is legible on both themes.' : `${failures} problem(s). Fix the tokens, not the components.`}\n`,
);

if (failures > 0) process.exitCode = 1;
