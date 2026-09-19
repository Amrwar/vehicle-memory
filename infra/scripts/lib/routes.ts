/**
 * Every address the application answers on, read off the filesystem.
 *
 * Three separate probes had each grown their own hand-written list of screens,
 * and a hand-written list is a list that falls behind: a page built in
 * September is measured by whichever probe somebody remembered. Read from the
 * app directory instead, a screen that nobody has decided about fails the
 * check the day it is added, which is the only moment at which deciding is
 * cheap.
 *
 * Patterns keep their route-group folders — `/(workshop)/jobs/[id]` rather
 * than `/jobs/[id]` — because that is how the probes already key their tables
 * and because the group says who the page is for. `visible()` takes them off
 * to give the address a browser actually asks for.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The app directory, from anywhere under the repository root. */
export const APP = join(process.cwd(), 'apps', 'web', 'src', 'app');

export type Leaf = 'page' | 'route';

/** Every route pattern, with its route-group folders left on. */
export function everyRoute(leaf: Leaf = 'page'): string[] {
  const file = leaf === 'page' ? 'page.tsx' : 'route.ts';
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === file) {
        const route = `/${relative(APP, dir).split(sep).join('/')}`;
        found.push(route === '/.' ? '/' : route);
      }
    }
  };

  walk(APP);
  return [...new Set(found)].sort();
}

/** The address a browser asks for: the same pattern without its groups. */
export function visible(pattern: string): string {
  const path = pattern.replace(/\/\([^)]*\)/g, '');
  return path === '' ? '/' : path;
}

/** Whether the pattern has anything in brackets to fill in. */
export function isDynamic(pattern: string): boolean {
  return pattern.includes('[');
}

/** Every directory between the app root and this route, innermost last. */
export function segmentsOf(pattern: string): string[] {
  const parts = pattern.split('/').filter(Boolean);
  return parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
}
