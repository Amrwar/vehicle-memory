/**
 * Writes the OpenAPI document to docs, or checks that the committed copy is
 * current.
 *
 *   npx tsx --tsconfig apps/web/tsconfig.json infra/scripts/build-openapi.ts          # write
 *   npx tsx --tsconfig apps/web/tsconfig.json infra/scripts/build-openapi.ts --check  # CI
 *
 * The document is generated from the registry beside the handlers (NFR-705),
 * so it cannot describe an endpoint that does not exist. The check also
 * walks the route files under api/v1 and fails if one has no entry, so an
 * endpoint cannot exist that the document does not describe.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { openApiDocument, routeFileFor } from '../../apps/web/src/lib/openapi';

const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'docs', '02-design', 'openapi.json');
const ROUTES = join(ROOT, 'apps', 'web', 'src', 'app', 'api', 'v1');

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === 'route.ts') found.push(relative(ROUTES, full).replace(/\\/g, '/'));
  }
  return found.sort();
}

const documented = Object.keys(openApiDocument.paths).map(routeFileFor).sort();
const present = routeFiles(ROUTES);

const undocumented = present.filter((file) => !documented.includes(file));
const phantom = documented.filter((file) => !present.includes(file));

if (undocumented.length > 0 || phantom.length > 0) {
  if (undocumented.length > 0)
    console.error('Route files with no entry in the document:', undocumented);
  if (phantom.length > 0) console.error('Document entries with no route file:', phantom);
  process.exit(1);
}

const json = JSON.stringify(openApiDocument, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    current = '';
  }
  if (current !== json) {
    console.error(`docs/02-design/openapi.json is behind the registry. Run: npm run docs:openapi`);
    process.exit(1);
  }
  console.info(`openapi: ${present.length} routes, all documented, committed copy current`);
} else {
  writeFileSync(OUT, json);
  console.info(`openapi: wrote ${relative(ROOT, OUT)} with ${present.length} routes`);
}
