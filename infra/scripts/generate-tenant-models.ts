/**
 * The tenant list, read off the schema. Phase 64. FR-102, NFR-401.
 *
 *   npx tsx infra/scripts/generate-tenant-models.ts          writes the file
 *   npx tsx infra/scripts/generate-tenant-models.ts --check  fails if stale
 *
 * `forOrg()` filters reads and stamps writes for every model in a set, and
 * that set was twenty-six names typed into `tenant.ts` by hand. The schema has
 * eighty-three models carrying a required `orgId`. The other fifty-eight were
 * passing through the extension untouched — every read unfiltered, in the one
 * mechanism the whole product's isolation rests on.
 *
 * It was not theoretical. `/reports` read `db.membership.findMany({ where:
 * { role: 'TECHNICIAN' } })` through the scoped client and rendered the
 * result: every technician at every workshop on Carnet, by name, with their
 * cost rate, on any workshop's own report.
 *
 * A hand-written list of "every X" falls behind the day somebody adds an X.
 * This repository has learned that twice already — the screens probe now reads
 * its routes off the app directory, and the traceability matrix is recounted
 * from its own table rather than remembered. Here it is the same lesson with
 * the highest stakes in the product, so the list is generated from
 * `schema.prisma` and a check fails when the file and the schema disagree.
 *
 * Three kinds, and every model must be exactly one of them:
 *
 *   scoped    Carries an `orgId`. Filtered on read, stamped on write.
 *   global    Deliberately not a tenant's: a vehicle, a user, a recall
 *             (ADR-0004). Declared by hand, because "no orgId column" is not
 *             the same statement as "may be read by anybody", and the second
 *             one is a decision somebody has to make.
 *   child     No `orgId`, reached through a parent that has one. Named with
 *             its parent, so that a query going straight at one can be
 *             recognised for what it is.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCHEMA = join(ROOT, 'packages', 'db', 'prisma', 'schema.prisma');
const OUT = join(ROOT, 'packages', 'db', 'src', 'tenant-models.ts');

/**
 * Not a tenant's records. Each one is a decision, so each one says why.
 *
 * This is the only hand-written list left, and it is hand-written on purpose:
 * a model with no `orgId` column might be global, or might be a child of
 * something that has one, and only a person can say which. What is no longer
 * hand-written is the consequence — anything in neither this list nor the
 * schema's own answer fails the check below rather than passing quietly.
 */
const GLOBAL: Record<string, string> = {
  User: 'a person, who may be on two workshops’ teams (FR-108)',
  Session: 'a person’s session; it names the organisation rather than belonging to one',
  LoginAttempt: 'rate-limiting evidence against an email address, before anybody is known',
  OutboxEvent: 'the delivery queue itself, which carries events for every tenant by design',
  Organization: 'the tenant itself, which cannot be scoped to one of its own kind',
  Vehicle: 'the vehicle is global, not a tenant’s (ADR-0004)',
  VehicleEvent: 'the passport: the vehicle’s record, not the workshop’s',
  VehicleEventAttachment: 'part of a passport event',
  VehicleOwnership: 'who has held the vehicle, which belongs to the vehicle',
  OdometerReading: 'a reading about the vehicle',
  VehicleAccessGrant: 'what mediates a workshop’s access to a global vehicle',
  PassportShare: 'a link the owner made, for anybody they choose',
  PassportShareAccess: 'who opened one of those links',
  Recall: 'a manufacturer’s campaign, true of a model rather than a workshop',
  VehicleRecall: 'whether a campaign applies to one vehicle',
  VehicleDocument: 'a document about the vehicle, which travels with it',
  AuthToken: 'a reset or verification token for a person, issued before any workshop is known',
  VinDecode: 'what a VIN means, which is the same answer for everybody who asks',
  OperatorAlert:
    'the operator’s own alerts about the product (Phase 61); no workshop should ever read them',
};

interface Model {
  name: string;
  body: string;
}

function models(schema: string): Model[] {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    name: m[1]!,
    body: m[2]!,
  }));
}

/** The kind of `orgId` a model carries: required, optional, or none at all. */
function orgIdOf(body: string): 'required' | 'optional' | null {
  const found = /^\s*orgId\s+String(\?)?/m.exec(body);
  if (!found) return null;
  return found[1] ? 'optional' : 'required';
}

/** The tenant-carrying models this one points at, for a child. */
function parentsOf(body: string, scoped: Set<string>): string[] {
  return [...body.matchAll(/^\s*\w+\s+(\w+)\??\s+@relation/gm)]
    .map((m) => m[1]!)
    .filter((name) => scoped.has(name));
}

function build(): { source: string; problems: string[] } {
  const schema = readFileSync(SCHEMA, 'utf8');
  const all = models(schema);

  // Any `orgId` at all makes a model a tenant's, unless it is declared global.
  // Nullable is not a lesser kind of ownership: `AuditLog.orgId` is nullable
  // only so a deleted organisation's rows can be detached rather than deleted,
  // and a row whose organisation is gone belonging to nobody is exactly right.
  // Declared-global wins, because a `Session` names an organisation without
  // being one of its records.
  const scoped = all.filter((m) => orgIdOf(m.body) !== null && !GLOBAL[m.name]).map((m) => m.name);
  const scopedSet = new Set(scoped);

  const problems: string[] = [];

  // A model declared global must not carry a required orgId: that would be a
  // tenant's record declared as everybody's.
  for (const name of Object.keys(GLOBAL)) {
    const model = all.find((m) => m.name === name);
    if (!model) {
      problems.push(`${name} is declared global and is not in the schema`);
    } else if (orgIdOf(model.body) === 'required') {
      problems.push(`${name} is declared global but carries a required orgId`);
    }
  }

  const children: Record<string, string> = {};
  const undecided: string[] = [];

  for (const model of all) {
    if (scopedSet.has(model.name) || GLOBAL[model.name]) continue;

    const parents = parentsOf(model.body, scopedSet);
    if (parents.length > 0) {
      children[model.name] = parents[0]!;
      continue;
    }

    // Reached through another child: follow one more link rather than calling
    // it undecided, because `InspectionResult -> Inspection -> Job` is as
    // scoped as `Inspection -> Job` is.
    const indirect = [...model.body.matchAll(/^\s*\w+\s+(\w+)\??\s+@relation/gm)]
      .map((m) => m[1]!)
      .find((name) => children[name]);

    if (indirect) {
      children[model.name] = indirect;
      continue;
    }

    undecided.push(model.name);
  }

  // Two passes, because a child of a child may have been seen first.
  for (const name of [...undecided]) {
    const model = all.find((m) => m.name === name)!;
    const indirect = [...model.body.matchAll(/^\s*\w+\s+(\w+)\??\s+@relation/gm)]
      .map((m) => m[1]!)
      .find((other) => children[other]);
    if (indirect) {
      children[name] = indirect;
      undecided.splice(undecided.indexOf(name), 1);
    }
  }

  for (const name of undecided) {
    problems.push(
      `${name} has no orgId, no tenant-carrying parent, and is not declared global — decide what it is`,
    );
  }

  const source = `// Generated by infra/scripts/generate-tenant-models.ts. Do not edit.
//
// Every model in the schema, sorted into what \`forOrg()\` must do with it.
// Regenerate with \`npm run db:tenant-models\`; CI fails if this file and
// schema.prisma disagree, so a model added without a decision about its
// tenancy cannot reach production quietly.

/** Models carrying an \`orgId\`: filtered on read, stamped on write. */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
${scoped.map((n) => `  '${n}',`).join('\n')}
]);

/** Deliberately not a tenant's records, and why. */
export const GLOBAL_MODELS: Readonly<Record<string, string>> = {
${Object.entries(GLOBAL)
  .map(([name, why]) => `  ${name}: ${JSON.stringify(why)},`)
  .join('\n')}
};

/**
 * Models with no \`orgId\` of their own, and the tenant-carrying model they
 * hang off. A query that goes straight at one of these through the scoped
 * client is not narrowed by anything — the extension has nothing to narrow it
 * by — so it must carry its parent in the \`where\` itself.
 */
export const CHILD_OF: Readonly<Record<string, string>> = {
${Object.entries(children)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, parent]) => `  ${name}: '${parent}',`)
  .join('\n')}
};
`;

  return { source, problems };
}

function main() {
  const { source, problems } = build();
  const checking = process.argv.includes('--check');

  if (problems.length > 0) {
    console.error('\n  The schema and the tenancy rules disagree:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('');
    process.exitCode = 1;
    return;
  }

  const existing = (() => {
    try {
      return readFileSync(OUT, 'utf8');
    } catch {
      return null;
    }
  })();

  if (checking) {
    if (existing === source) {
      const scoped = source.match(/'[A-Za-z]+',/g)?.length ?? 0;
      console.info(`\n  The tenant list matches the schema. ${scoped} entries.\n`);
      return;
    }
    console.error(
      '\n  packages/db/src/tenant-models.ts is not what the schema says.\n' +
        '  Run `npm run db:tenant-models` and read the diff: a model has been\n' +
        '  added, or its orgId has changed, and the isolation mechanism does not\n' +
        '  know about it yet.\n',
    );
    process.exitCode = 1;
    return;
  }

  writeFileSync(OUT, source, 'utf8');
  console.info(`\n  Wrote ${OUT}\n`);
}

main();
