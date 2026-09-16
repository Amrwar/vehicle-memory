/**
 * Authorisation, tried rather than trusted. Phase 31.
 *
 *   npx tsx infra/scripts/verify-authz.ts [baseUrl]
 *
 * The role table in core says who may do what, and every page asks it. This
 * script does not read the table; it knocks on every door as every role and
 * checks the answer matches. Then it asks for another workshop's records by
 * id, as an owner, and expects to be told they do not exist. Then it calls
 * the machine routes with no credentials. Then it turns the workshop
 * read-only and tries to write. Then it reads every server action on every
 * page and refuses any that writes behind a reading permission, because
 * that is the mistake this probe was written after finding twice.
 *
 * Everything it makes, it removes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { can, isWritePermission, type Permission, PlanLimitError, type Role } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createApiKey } from '../../apps/web/src/lib/api-keys';
import { saveBay } from '../../apps/web/src/lib/settings';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const APP = join(process.cwd(), 'apps', 'web', 'src', 'app');

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: string) {
  checked += 1;
  if (!ok) {
    failures += 1;
    console.info(`  FAIL  ${what}${detail ? `  (${detail})` : ''}`);
  }
}

async function mint(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      orgId,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return token;
}

async function get(path: string, token?: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: { ...(token ? { cookie: `carnet_session=${token}` } : {}), ...headers },
  });
  const body = response.status === 200 ? await response.text() : '';
  // A refusal after the loading boundary has flushed is a 200 with the
  // redirect in the stream. It counts as a redirect, because to a browser it
  // is one; the probe reads what a browser would.
  const streamed = body.match(
    /<meta id="__next-page-redirect" http-equiv="refresh" content="\d+;url=([^"]+)"/,
  );
  const location =
    response.headers.get('location') ??
    (streamed ? decodeURIComponent(streamed[1]!.replace(/&amp;/g, '&')) : '');
  const notFound = response.status === 404 || /HTTP_ERROR_FALLBACK;404/.test(body);
  return { status: streamed ? 307 : response.status, location, notFound };
}

/** Every workshop page on disk, with the permission its page function asks for. */
function pagesOnDisk(): { route: string; permission: Permission | null; source: string }[] {
  const root = join(APP, '(workshop)');
  const out: { route: string; permission: Permission | null; source: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'page.tsx') {
        const source = readFileSync(full, 'utf8');
        const body = source.slice(source.indexOf('export default'));
        const m = body.match(/requireSession\('([^']+)'\)/);
        const route = '/' + relative(root, dir).split(sep).join('/');
        out.push({ route, permission: (m?.[1] as Permission) ?? null, source });
      }
    }
  };
  walk(root);
  return out;
}

async function main() {
  console.info('verify-authz');

  const hillside = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    include: { locations: { where: { isActive: true }, take: 1 } },
  });
  const kirkstall = await prisma.organization.findFirstOrThrow({
    where: { slug: 'kirkstall-autocentre' },
  });

  const who = async (email: string) =>
    prisma.user.findUniqueOrThrow({
      where: { email },
      include: { memberships: { where: { orgId: hillside.id } } },
    });
  const ahmed = await who('ahmed@hillsidemotors.test');
  const sara = await who('sara@hillsidemotors.test');
  const john = await who('john@hillsidemotors.test');
  const fatima = await who('fatima@hillsidemotors.test');
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });

  // A manager, because the seed has none and the role is the widest after owner.
  const manager = await prisma.user.create({
    data: {
      email: `authz-manager-${Date.now()}@hillsidemotors.test`,
      passwordHash: 'x',
      name: 'Probe Manager',
      emailVerifiedAt: new Date(),
      memberships: { create: { orgId: hillside.id, role: 'MANAGER' } },
    },
  });

  const sessions: { role: Role; token: string; name: string }[] = [
    { role: 'OWNER', token: await mint(ahmed.id, hillside.id), name: 'owner' },
    { role: 'MANAGER', token: await mint(manager.id, hillside.id), name: 'manager' },
    { role: 'SERVICE_ADVISOR', token: await mint(sara.id, hillside.id), name: 'advisor' },
    { role: 'TECHNICIAN', token: await mint(john.id, hillside.id), name: 'technician' },
    { role: 'BOOKKEEPER', token: await mint(fatima.id, hillside.id), name: 'bookkeeper' },
  ];
  const portal = await mint(maria.id, null);

  // Records the probe can ask for by id, so dynamic pages are tried too.
  const [customer, job, invoice, vehicle, supplier, part, person, payment] = await Promise.all([
    prisma.customer.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.job.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.invoice.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.vehicle.findFirst({
      where: { jobs: { some: { orgId: hillside.id } } },
      select: { id: true },
    }),
    prisma.supplier.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.product.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.employee.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
    prisma.payment.findFirst({ where: { orgId: hillside.id }, select: { id: true } }),
  ]);
  const ids: Record<string, string | undefined> = {
    '/customers/[id]': customer?.id,
    '/customers/[id]/edit': customer?.id,
    '/jobs/[id]': job?.id,
    '/invoices/[id]': invoice?.id,
    '/vehicles/[id]': vehicle?.id,
    '/vehicles/[id]/passport': vehicle?.id,
    '/vehicles/[id]/report': vehicle?.id,
    '/vehicles/[id]/condition': vehicle?.id,
    '/vehicles/[id]/transfer': vehicle?.id,
    '/suppliers/[id]': supplier?.id,
    '/parts/[id]': part?.id,
    '/people/[id]': person?.id,
    '/payments/[id]/receipt': payment?.id,
  };

  const pages = pagesOnDisk();
  const tried: { route: string; permission: Permission }[] = [];
  for (const page of pages) {
    if (!page.permission) continue;
    let route = page.route;
    if (route.includes('[')) {
      const id = ids[route];
      if (!id) continue;
      route = route.replace('[id]', id);
    }
    tried.push({ route, permission: page.permission });
  }

  // 1. Every page as every role: the answer must match the table.
  console.info(`  ${tried.length} pages x ${sessions.length} roles`);
  for (const { route, permission } of tried) {
    for (const session of sessions) {
      const r = await get(route, session.token);
      // A technician has a surface of their own (ADR-0009): the workshop
      // shell turns them back to it before any page runs, whatever the table
      // says about the page. That is the check for them.
      if (session.role === 'TECHNICIAN') {
        check(
          r.status >= 300 && r.status < 400 && r.location === '/shop',
          `technician is turned back to the shop floor from ${route}`,
          `${r.status} ${r.location}`,
        );
        continue;
      }
      const allowed = can(session.role, permission);
      const denied = r.status >= 300 && r.status < 400 && r.location.includes('denied=');
      const login = r.status >= 300 && r.status < 400 && r.location.includes('/login');
      if (allowed) {
        check(
          !denied && !login && r.status < 500,
          `${session.name} may open ${route} (${permission})`,
          `${r.status} ${r.location}`,
        );
      } else {
        check(
          denied,
          `${session.name} must be refused ${route} (${permission})`,
          `${r.status} ${r.location}`,
        );
      }
    }
  }

  // 2. Nobody, and a portal-only customer, on a workshop page.
  for (const route of ['/dashboard', '/jobs', '/settings', '/ledger']) {
    const anon = await get(route);
    check(
      anon.status >= 300 && anon.location.includes('/login'),
      `nobody is sent to sign in from ${route}`,
      `${anon.status} ${anon.location}`,
    );
    const driver = await get(route, portal);
    check(
      driver.status >= 300 && driver.status < 400 && driver.location.includes('/portal'),
      `a portal customer is sent to the portal from ${route}`,
      `${driver.status} ${driver.location}`,
    );
  }

  // 3. Another workshop's records, by id, as an owner: they do not exist.
  const foreignCustomer = await prisma.customer.create({
    data: { orgId: kirkstall.id, displayName: 'Authz Probe Customer', kind: 'INDIVIDUAL' },
  });
  const foreignSupplier = await prisma.supplier.create({
    data: { orgId: kirkstall.id, name: `Authz Probe Supplier ${Date.now()}` },
  });
  const owner = sessions[0]!.token;
  for (const route of [`/customers/${foreignCustomer.id}`, `/suppliers/${foreignSupplier.id}`]) {
    const r = await get(route, owner);
    check(r.notFound, `another workshop's record is not found at ${route}`, String(r.status));
  }
  const foreignReceipt = await get(`/payments/${foreignCustomer.id}/receipt`, owner);
  check(
    foreignReceipt.notFound,
    'a receipt that is not ours is not found',
    String(foreignReceipt.status),
  );

  // 4. Machine routes with nothing in hand.
  const sync = await get('/api/sync');
  check(sync.status === 401, '/api/sync with no session is 401', String(sync.status));
  const cron = await get('/api/cron/reminders');
  check(cron.status === 401, '/api/cron with no secret is 401', String(cron.status));
  const v1 = await get('/api/v1/jobs');
  check(v1.status === 401, '/api/v1/jobs with no key is 401', String(v1.status));
  const v1Bad = await get('/api/v1/jobs', undefined, { authorization: 'Bearer crn_not_a_key' });
  check(v1Bad.status === 401, '/api/v1/jobs with a made-up key is 401', String(v1Bad.status));
  const technicianReport = await get('/api/reports/parts', sessions[3]!.token);
  check(
    technicianReport.status >= 300 && technicianReport.location.includes('denied='),
    'a technician cannot pull a report file',
    `${technicianReport.status} ${technicianReport.location}`,
  );
  const bookkeeperPayroll = await get('/api/reports/payroll', sessions[2]!.token);
  check(
    bookkeeperPayroll.status >= 300 && bookkeeperPayroll.location.includes('denied='),
    'an advisor cannot pull the payroll file',
    `${bookkeeperPayroll.status} ${bookkeeperPayroll.location}`,
  );

  // 5. A cancelled workshop reads and does not write.
  await prisma.organization.update({
    where: { id: hillside.id },
    data: { cancelledAt: new Date() },
  });
  try {
    const read = await get('/jobs', owner);
    check(read.status === 200, 'a cancelled workshop still reads its jobs', String(read.status));
    const write = await get('/jobs/new', owner);
    check(
      write.status >= 300 && write.location.includes('/settings/subscription?blocked=1'),
      'a cancelled workshop is stopped from writing, and told why',
      `${write.status} ${write.location}`,
    );
    const page = await get('/settings/subscription?blocked=1', owner);
    check(
      page.status === 200,
      'the subscription page opens for a cancelled workshop',
      String(page.status),
    );
  } finally {
    await prisma.organization.update({ where: { id: hillside.id }, data: { cancelledAt: null } });
  }

  // 6. The plan, at the point a thing is made. Kirkstall is on Core.
  await prisma.organization.update({ where: { id: kirkstall.id }, data: { plan: 'CORE' } });
  // Whoever runs Kirkstall, or the probe manager if nobody does: the plan
  // check happens before anything is written under their name.
  const kirkstallOwner = (await prisma.membership.findFirst({
    where: { orgId: kirkstall.id, role: 'OWNER' },
  })) ?? { userId: manager.id };
  let apiRefused = false;
  try {
    await createApiKey({ orgId: kirkstall.id, userId: kirkstallOwner.userId, name: 'Probe' });
  } catch (error) {
    apiRefused = error instanceof PlanLimitError && /Complete/.test(error.message);
  }
  check(apiRefused, 'Core cannot make an API key, and is told which plan can');

  const site =
    (await prisma.location.findFirst({ where: { orgId: kirkstall.id } })) ??
    (await prisma.location.create({
      data: { orgId: kirkstall.id, name: 'Probe Site', code: 'PROBE', isActive: true },
    }));
  const madeBays: string[] = [];
  const have = await prisma.bay.count({ where: { locationId: site.id, isActive: true } });
  for (let i = have; i < 6; i += 1) {
    const bay = await prisma.bay.create({
      data: { locationId: site.id, name: `Probe bay ${i}`, code: `PB${i}`, sortOrder: 90 + i },
    });
    madeBays.push(bay.id);
  }
  let bayRefused = false;
  try {
    await saveBay({
      orgId: kirkstall.id,
      userId: kirkstallOwner.userId,
      locationId: site.id,
      name: 'One too many',
      code: 'PB99',
    });
  } catch (error) {
    bayRefused = error instanceof PlanLimitError && /6/.test(error.message);
  }
  check(bayRefused, 'a seventh bay on Core is refused with the number');

  // 7. Every server action, read from the page files: nothing writes behind a
  //    reading permission.
  const WRITE_CALL =
    /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|await (record|create|save|set|invite|revoke|deactivate|approve|send|issue|post|take|apply|return|mark|move|complete|cancel|adjust|sell|redeem|disable|award|run|dispatch|register|adopt|transfer|grant|assign|book|raise|void|refund|write|update|delete|remove|add|start|finish|reject|accept|confirm|decline|close|open|reopen|archive|restore|submit|schedule|reschedule|toggle|change|choose|keep|give|use|retire|enrol|dismiss|resolve|reverse|reconcile|pay|claim|note|log|file|order|receive|dispose|draft|preview|compose)[A-Z]\w*\(/;
  // Actions that write only the signed-in person's own rows, scoped by their
  // user id in the library, which no workshop permission describes. Each is
  // named here so a new one is a decision, not a gap. Opening somebody
  // else's notification is refused in verify-search.ts.
  const OWN_RECORD_ACTIONS = new Set(['/notifications readAll']);
  let actions = 0;
  for (const page of pages) {
    const parts = page.source.split(/(?=async function \w+\()/);
    for (const part of parts) {
      if (!/^async function \w+\([^)]*\)[^{]*\{\s*'use server'/.test(part)) continue;
      actions += 1;
      const name = part.match(/^async function (\w+)/)?.[1] ?? '?';
      const permission = part.match(/requireSession\('([^']+)'\)/)?.[1] as Permission | undefined;
      const body = part.split(/\n(?=export default|const |type |function )/)[0] ?? part;
      const writes = WRITE_CALL.test(body);
      if (!permission) {
        check(
          !writes || OWN_RECORD_ACTIONS.has(`${page.route} ${name}`),
          `${page.route} ${name}() writes with no permission asked`,
        );
        continue;
      }
      check(
        !writes || isWritePermission(permission),
        `${page.route} ${name}() writes behind '${permission}'`,
      );
    }
  }
  console.info(`  ${actions} server actions read`);

  // Clean up.
  await prisma.bay.deleteMany({ where: { id: { in: madeBays } } });
  await prisma.customer.delete({ where: { id: foreignCustomer.id } });
  await prisma.supplier.delete({ where: { id: foreignSupplier.id } });
  await prisma.session.deleteMany({ where: { userId: { in: [manager.id] } } });
  await prisma.membership.deleteMany({ where: { userId: manager.id } });
  await prisma.user.delete({ where: { id: manager.id } });
  await prisma.session.deleteMany({
    where: {
      tokenHash: {
        in: [...sessions.map((s) => s.token), portal].map((t) =>
          createHash('sha256').update(t).digest('hex'),
        ),
      },
    },
  });

  console.info(`  ${checked} checks, ${failures} failing`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
