/**
 * Every word a person reads goes through the translator. Phase 40.5.
 *
 *   npx tsx infra/scripts/i18n-scan.ts [paths...]        text on the pages
 *   npx tsx infra/scripts/i18n-scan.ts --messages        sentences the libraries throw
 *
 * Reads the source with the TypeScript parser, not with patterns, and names
 * every piece of English that reaches a page without passing through t():
 *
 * - text between tags;
 * - a text attribute written as a plain string (title, description, label,
 *   placeholder, hint, note, aria-label, alt, eyebrow and the like);
 * - a string or template shown directly in braces, including both sides of
 *   a condition;
 * - a text property in an object on a page (label, title, description, ...);
 * - the sentence handed to encodeURIComponent for a ?problem= redirect;
 * - a page's metadata title.
 *
 * A line carrying the comment i18n-ignore, or the line after one, is skipped:
 * for a brand, a code or a unit that reads the same in every language.
 *
 * With --messages it lists every sentence thrown by an error in the web
 * libraries and in core, with ${...} slots numbered {v1}, {v2}, and names
 * those with no French or Arabic translation. The translator matches a
 * thrown sentence against these keys, so a refusal reaches the page in the
 * person's language.
 *
 * Exits 1 when anything is found, so it can gate a phase.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

const ROOT = join(__dirname, '..', '..');

const TEXT_ATTRS = new Set([
  'title',
  'description',
  'label',
  'placeholder',
  'hint',
  'note',
  'aria-label',
  'alt',
  'eyebrow',
  'summary',
  'heading',
  'subtitle',
  'caption',
  'legend',
  'message',
  'confirm',
  'tooltip',
  'emptyText',
  'empty',
  'text',
  'prompt',
  'why',
  'detail',
  'value-label',
]);

const TEXT_PROPS = new Set([
  'label',
  'title',
  'description',
  'note',
  'hint',
  'placeholder',
  'summary',
  'heading',
  'eyebrow',
  'empty',
  'caption',
  'subtitle',
  'help',
  'explanation',
  'sentence',
]);

/** Reads the same in every language. */
const SAME_EVERYWHERE =
  /^(Carnet|CSV|PDF|VIN|MOT|VAT|OK|ID|API|URL|QR|SKU|OEM|UTC|GBP|EUR|USD|AED|SAR|EGP|km|mi|kg|h|d|x|am|pm|WhatsApp|Stripe|Twilio|Google|Resend|Neon|Vercel|DVLA|iOS|Android|HTTP|HTTPS|JSON|SMS|Email)$/;

function hasWords(text: string): boolean {
  const trimmed = text.replace(/&[a-z]+;|&#\d+;/g, ' ').trim();
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(trimmed)) return false;
  const words = trimmed.split(/[^A-Za-zÀ-ÿ]+/).filter((w) => w.length >= 2);
  return words.some((word) => !SAME_EVERYWHERE.test(word));
}

/** A string that reads as words rather than as a code, a path or an enum value. */
function looksLikeWords(text: string): boolean {
  if (!hasWords(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false; // AWAITING_APPROVAL
  if (/^[a-z0-9]+([.:_/-][a-z0-9]+)+$/i.test(text)) return false; // job.created, /jobs, a-b
  if (/^[/#?]/.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return false; // secondary, sm, camelCase
  if (/^--|^\(|^var\(|^bg-|^text-|^[\w-]+:[\w-]/.test(text)) return false;
  return /\s/.test(text) || /^[A-Z][a-z]/.test(text);
}

/** A component's own text prop: emptyTitle, actionLabel, confirmText. */
const TEXTISH_ATTR =
  /(title|label|description|text|placeholder|hint|note|message|caption|heading|summary|empty|confirm|alt|prompt|children)$/i;

const NON_TEXT_ATTRS = new Set([
  'className',
  'href',
  'src',
  'id',
  'name',
  'type',
  'key',
  'variant',
  'tone',
  'size',
  'method',
  'action',
  'rel',
  'target',
  'inputMode',
  'autoComplete',
  'pattern',
  'step',
  'min',
  'max',
  'htmlFor',
  'role',
  'form',
  'encType',
  'accept',
  'dateTime',
  'value',
  'defaultValue',
  'as',
  'dir',
  'lang',
  'style',
  'fill',
  'stroke',
  'viewBox',
  'd',
  'xmlns',
  'width',
  'height',
  'capture',
  'formAction',
  'download',
  'icon',
  'currency',
  'locale',
]);

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

function walkFiles(path: string, out: string[] = []): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !/\.d\.ts$/.test(path))
      out.push(path);
    return out;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === 'generated' || entry.startsWith('.')) continue;
    walkFiles(join(path, entry), out);
  }
  return out;
}

function ignored(source: ts.SourceFile, node: ts.Node, lines: string[]): boolean {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
  return Boolean(lines[line]?.includes('i18n-ignore') || lines[line - 1]?.includes('i18n-ignore'));
}

function insideTranslation(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      if (ts.isIdentifier(callee) && ['t', 'translate', 'tr', 'msg'].includes(callee.text))
        return true;
      if (ts.isPropertyAccessExpression(callee) && ['t', 'translate'].includes(callee.name.text)) {
        return true;
      }
    }
    if (
      ts.isJsxElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isSourceFile(current)
    ) {
      return false;
    }
  }
  return false;
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('{}');
  }
  return null;
}

/** A literal whose value is what the braces show: directly, or as a side of a condition. */
function shownDirectly(node: ts.Node): boolean {
  let current: ts.Node = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return false;
    if (ts.isJsxExpression(parent)) {
      const holder = parent.parent;
      if (ts.isJsxAttribute(holder)) {
        const name = holder.name.getText();
        if (NON_TEXT_ATTRS.has(name)) return false;
        return TEXT_ATTRS.has(name) || TEXTISH_ATTR.test(name);
      }
      return true;
    }
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent) && parent.condition !== current) {
      current = parent;
      continue;
    }
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.PlusToken,
      ].includes(parent.operatorToken.kind)
    ) {
      current = parent;
      continue;
    }
    if (ts.isTemplateSpan(parent) || ts.isTemplateExpression(parent)) {
      current = parent;
      continue;
    }
    return false;
  }
}

function scanPage(file: string, findings: Finding[]): void {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const isTsx = file.endsWith('.tsx');

  const add = (node: ts.Node, kind: string, value: string) => {
    if (ignored(source, node, lines)) return;
    findings.push({
      file: rel,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      kind,
      text: value.replace(/\s+/g, ' ').trim().slice(0, 90),
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (hasWords(node.text)) add(node, 'text', node.text);
    } else if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const name = node.name.getText();
      if (
        (TEXT_ATTRS.has(name) || TEXTISH_ATTR.test(name)) &&
        !NON_TEXT_ATTRS.has(name) &&
        hasWords(node.initializer.text)
      ) {
        add(node, `attribute ${name}`, node.initializer.text);
      }
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      const value = literalText(node)!;
      if (!insideTranslation(node)) {
        const parent = node.parent;
        if (isTsx && shownDirectly(node) && hasWords(value) && !ts.isJsxAttribute(parent)) {
          add(node, 'shown', value);
        } else if (
          isTsx &&
          ts.isPropertyAssignment(parent) &&
          parent.initializer === node &&
          TEXT_PROPS.has(parent.name.getText().replace(/['"]/g, '')) &&
          looksLikeWords(value)
        ) {
          add(node, `property ${parent.name.getText()}`, value);
        } else if (
          ts.isCallExpression(parent) &&
          ts.isIdentifier(parent.expression) &&
          parent.expression.text === 'encodeURIComponent' &&
          looksLikeWords(value)
        ) {
          add(node, 'problem', value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
}

/* ------------------------------------------------------------------------- */
/* Thrown sentences                                                           */
/* ------------------------------------------------------------------------- */

/** The key a thrown sentence is translated under: ${...} slots numbered in order. */
export function messageKey(node: ts.Node): string | null {
  return messageKeys(node)[0] ?? null;
}

/**
 * Every key a message expression can produce: a literal, a template, each side
 * of a condition, and pieces joined with +, with slots numbered across the
 * whole sentence. Anything else inside is a slot.
 */
export function messageKeys(node: ts.Node): string[] {
  if (ts.isParenthesizedExpression(node)) return messageKeys(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [...messageKeys(node.whenTrue), ...messageKeys(node.whenFalse)];
  }
  const pieces: (string | null)[] = [];
  const flatten = (part: ts.Node): boolean => {
    if (ts.isParenthesizedExpression(part)) return flatten(part.expression);
    if (ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)) {
      pieces.push(part.text);
      return true;
    }
    if (ts.isTemplateExpression(part)) {
      pieces.push(part.head.text);
      for (const span of part.templateSpans) {
        pieces.push(null, span.literal.text);
      }
      return true;
    }
    if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return flatten(part.left) && flatten(part.right);
    }
    pieces.push(null);
    return false;
  };
  const literalAtAll = flatten(node);
  if (!literalAtAll && pieces.every((piece) => piece === null)) return [];
  let slot = 0;
  const key = pieces.map((piece) => (piece === null ? `{v${++slot}}` : piece)).join('');
  return /[A-Za-z]{2}/.test(key.replace(/\{v\d+\}/g, '')) ? [key] : [];
}

export function thrownSentences(): Map<string, string> {
  const out = new Map<string, string>();
  const files = [
    ...walkFiles(join(ROOT, 'apps', 'web', 'src', 'lib')),
    ...walkFiles(join(ROOT, 'packages', 'core', 'src')),
  ]
    .filter((file) => !file.includes(`${join('core', 'src', 'i18n')}`))
    // Read only by whoever deploys the product, never by a person using it.
    .filter((file) => !/[\\/]lib[\\/]env\.ts$/.test(file))
    // The same, for the rule that holds the build to declaring what a repeat
    // does to a write: its refusals are addressed to whoever is adding the
    // write, and are read by running the check rather than by using the
    // product. Phase 46.
    .filter((file) => !/[\\/]reliability[\\/]repeat\.ts$/.test(file));

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /Error$/.test(node.expression.text)
      ) {
        for (const arg of node.arguments ?? []) {
          for (const key of messageKeys(arg)) {
            if (/\s/.test(key) && hasWords(key)) {
              out.set(key, relative(ROOT, file).replace(/\\/g, '/'));
            }
          }
        }
      }
      // A refusal returned rather than thrown: { ok: false, message: `...` }.
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === 'message' &&
        !ts.isIdentifier(node.initializer)
      ) {
        for (const key of messageKeys(node.initializer)) {
          if (/\s/.test(key) && hasWords(key)) {
            out.set(key, relative(ROOT, file).replace(/\\/g, '/'));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--messages')) {
    const { hasTranslation } = await import('@carnet/core');
    // --in=apps/web/src/lib or --in=packages/core keeps to one part of the product.
    const within = args.find((arg) => arg.startsWith('--in='))?.slice(5);
    const sentences = new Map(
      [...thrownSentences()].filter(([, file]) => !within || file.startsWith(within)),
    );
    let missing = 0;
    for (const [key, file] of sentences) {
      for (const language of ['fr', 'ar'] as const) {
        if (!hasTranslation(language, key)) {
          missing += 1;
          if (!args.includes('--quiet'))
            console.info(`  ${language}  ${file}  ${JSON.stringify(key)}`);
        }
      }
    }
    console.info(`\n  ${sentences.size} thrown sentences, ${missing} translations missing.\n`);
    process.exit(missing === 0 ? 0 : 1);
  }

  const targets = args.filter((arg) => !arg.startsWith('--'));
  const roots =
    targets.length > 0
      ? targets.map((target) => join(ROOT, target))
      : [
          join(ROOT, 'apps', 'web', 'src', 'app'),
          join(ROOT, 'apps', 'web', 'src', 'components'),
          join(ROOT, 'packages', 'ui', 'src'),
        ];

  const findings: Finding[] = [];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!file.endsWith('.tsx') && !/[\\/]app[\\/]/.test(file)) continue;
      scanPage(file, findings);
    }
  }

  // Page titles in the browser tab.
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      const text = readFileSync(file, 'utf8');
      const match = /export const metadata[^=]*=\s*\{\s*title:\s*'([^']+)'/.exec(text);
      if (match && !text.includes('i18n-ignore metadata')) {
        findings.push({
          file: relative(ROOT, file).replace(/\\/g, '/'),
          line: text.slice(0, match.index).split('\n').length,
          kind: 'metadata title',
          text: match[1]!,
        });
      }
    }
  }

  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = byFile.get(finding.file) ?? [];
    list.push(finding);
    byFile.set(finding.file, list);
  }

  if (args.includes('--summary')) {
    for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.info(`  ${String(list.length).padStart(4)}  ${file}`);
    }
  } else {
    for (const [file, list] of byFile) {
      console.info(`\n  ${file}`);
      for (const finding of list) {
        console.info(
          `    ${String(finding.line).padStart(4)}  ${finding.kind.padEnd(20)} ${JSON.stringify(finding.text)}`,
        );
      }
    }
  }
  console.info(
    `\n  ${findings.length} pieces of text not passed through the translator, in ${byFile.size} files.\n`,
  );
  process.exit(findings.length === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
