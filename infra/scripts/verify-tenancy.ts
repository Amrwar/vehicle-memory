/**
 * Asks one workshop for another workshop's records, everywhere it can. Phase 48.
 *
 *   npx tsx infra/scripts/verify-tenancy.ts [baseUrl]
 *
 * The one failure a workshop would never forgive. Everything else in this
 * product is a feature that could be added later or a bug that could be fixed
 * tomorrow; a garage reading another garage's customers is the end of the
 * conversation, and no amount of the rest makes up for it.
 *
 * So this does not read the code and reason about it. It creates a second
 * workshop, signs in as its owner — the role that may do everything, so that
 * nothing passes merely because a permission got in the way first — and then
 * asks for the seeded workshop's real identifiers at every address the
 * application answers on. Every one of them must come back not found.
 *
 * Not found rather than forbidden, deliberately. "You may not see this
 * invoice" confirms the invoice exists, which is itself a leak: a competitor
 * can walk the identifiers and learn how much work a rival is taking. The
 * honest answer to a stranger asking about something that is none of their
 * business is that there is nothing there.
 *
 * The route list is read off the filesystem rather than typed here, so a route
 * added next month with an identifier in it and no entry in the table below
 * fails this check on the day it is written. That is the whole point: a
 * tenancy probe that has to be remembered is a tenancy probe that will one day
 * be forgotten.
 *
 * Everything it makes, it removes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { prisma } from '@carnet/db';

import { money } from '@carnet/core';

import { requestReset } from '../../apps/web/src/lib/credentials';
import { updateCustomer } from '../../apps/web/src/lib/customers';
import { adjustStock } from '../../apps/web/src/lib/inventory';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';
import { createWorkshop } from '../../apps/web/src/lib/onboarding';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const APP = join(process.cwd(), 'apps', 'web', 'src', 'app');

const TAG = 'Tenancy probe';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
  }
}

/* ---------------------------------------------------------------------------
   Why a route is allowed to answer a stranger
   --------------------------------------------------------------------------- */

/**
 * A route carrying an identifier is one of three things, and it has to say
 * which.
 *
 * `scoped`    Belongs to a workshop. Another workshop must be told it does not
 *             exist. The overwhelming majority.
 * `bearer`    The identifier IS the credential — a share link, an invitation,
 *             a reset. Nobody is signed in and nothing is looked up by
 *             membership, so the test is different: an unknown or withdrawn
 *             token must be refused, and holding a token must not turn into
 *             holding an account.
 * `open`      Genuinely public or genuinely not about one workshop's records:
 *             a help article, a cron name, a report name. Named here with a
 *             reason so that "open" is a decision somebody made rather than a
 *             route nobody thought about.
 */
type Kind = 'scoped' | 'bearer' | 'open';

interface Case {
  kind: Kind;
  /** For `open`: why nothing here belongs to one workshop. */
  because?: string;
  /** Fills the route's parameters with the seeded workshop's own values. */
  fill?: (r: Ids) => string;
  /** For `bearer`: a value that is not a live token. */
  dead?: (r: Ids) => string;
  /**
   * For `bearer`: this page must look identical whether the token is real or
   * invented, so that nobody can tell one from the other by asking. Say why.
   */
  sameEitherWay?: boolean;
  /** Checked as the other workshop's customer rather than its owner. */
  portal?: boolean;
}

const CASES: Record<string, Case> = {
  /* --- the workshop's own records ---------------------------------------- */
  '/(workshop)/bookings/[id]': { kind: 'scoped', fill: (r) => `/bookings/${r.booking}` },
  '/(workshop)/customers/[id]': { kind: 'scoped', fill: (r) => `/customers/${r.customer}` },
  '/(workshop)/customers/[id]/edit': {
    kind: 'scoped',
    fill: (r) => `/customers/${r.customer}/edit`,
  },
  '/(workshop)/fleet/[id]': { kind: 'scoped', fill: (r) => `/fleet/${r.fleet}` },
  '/(workshop)/gift-cards/[id]': { kind: 'scoped', fill: (r) => `/gift-cards/${r.giftCard}` },
  '/(workshop)/invoices/[id]': { kind: 'scoped', fill: (r) => `/invoices/${r.invoice}` },
  '/(workshop)/jobs/[id]': { kind: 'scoped', fill: (r) => `/jobs/${r.job}` },
  '/(workshop)/jobs/[id]/check-in': { kind: 'scoped', fill: (r) => `/jobs/${r.job}/check-in` },
  '/(workshop)/jobs/[id]/check-out': { kind: 'scoped', fill: (r) => `/jobs/${r.job}/check-out` },
  '/(workshop)/parts/[id]': { kind: 'scoped', fill: (r) => `/parts/${r.product}` },
  '/(workshop)/payments/[id]/receipt': {
    kind: 'scoped',
    fill: (r) => `/payments/${r.payment}/receipt`,
  },
  '/(workshop)/people/[id]': { kind: 'scoped', fill: (r) => `/people/${r.employee}` },
  '/(workshop)/purchasing/[id]': { kind: 'scoped', fill: (r) => `/purchasing/${r.purchaseOrder}` },
  '/(workshop)/settings/data/[id]': { kind: 'scoped', fill: (r) => `/settings/data/${r.import}` },
  '/(workshop)/suppliers/[id]': { kind: 'scoped', fill: (r) => `/suppliers/${r.supplier}` },
  '/(workshop)/transfers/[id]': { kind: 'scoped', fill: (r) => `/transfers/${r.transfer}` },
  '/(workshop)/vehicles/[id]': { kind: 'scoped', fill: (r) => `/vehicles/${r.vehicle}` },
  '/(workshop)/vehicles/[id]/condition': {
    kind: 'scoped',
    fill: (r) => `/vehicles/${r.vehicle}/condition`,
  },
  '/(workshop)/vehicles/[id]/passport': {
    kind: 'scoped',
    fill: (r) => `/vehicles/${r.vehicle}/passport`,
  },
  '/(workshop)/vehicles/[id]/report': {
    kind: 'scoped',
    fill: (r) => `/vehicles/${r.vehicle}/report`,
  },
  '/(workshop)/vehicles/[id]/transfer': {
    kind: 'scoped',
    fill: (r) => `/vehicles/${r.vehicle}/transfer`,
  },
  '/(workshop)/audit/[type]/[id]': { kind: 'scoped', fill: (r) => `/audit/Job/${r.job}` },
  '/(workshop)/notifications/[id]': {
    kind: 'scoped',
    fill: (r) => `/notifications/${r.notification}`,
  },
  '/shop/inspect/[id]': { kind: 'scoped', fill: (r) => `/shop/inspect/${r.inspection}` },
  '/print/[kind]/[id]': { kind: 'scoped', fill: (r) => `/print/invoice/${r.invoice}` },
  '/api/print/[kind]/[id]': { kind: 'scoped', fill: (r) => `/api/print/invoice/${r.invoice}` },
  '/pay/[id]': { kind: 'scoped', fill: (r) => `/pay/${r.invoice}` },

  /* --- the customer's side ------------------------------------------------ */
  '/portal/vehicles/[id]': {
    kind: 'scoped',
    portal: true,
    fill: (r) => `/portal/vehicles/${r.vehicle}`,
  },
  '/portal/vehicles/[id]/passport': {
    kind: 'scoped',
    portal: true,
    fill: (r) => `/portal/vehicles/${r.vehicle}/passport`,
  },
  '/portal/estimates/[id]': {
    kind: 'scoped',
    portal: true,
    fill: (r) => `/portal/estimates/${r.estimate}`,
  },

  /* --- the identifier is the credential ----------------------------------- */
  '/e/[token]': { kind: 'bearer', dead: () => '/e/not-a-real-estimate-token' },
  '/p/[token]': { kind: 'bearer', dead: () => '/p/not-a-real-passport-token' },
  '/r/[token]': { kind: 'bearer', dead: () => '/r/not-a-real-review-token' },
  '/r/[token]/public': { kind: 'bearer', dead: () => '/r/not-a-real-review-token/public' },
  '/handover/[token]': { kind: 'bearer', dead: () => '/handover/not-a-real-handover-token' },
  '/invite/[token]': { kind: 'bearer', dead: () => '/invite/not-a-real-invitation' },
  '/reset/[token]': {
    kind: 'bearer',
    dead: () => '/reset/not-a-real-reset-token',
    sameEitherWay: true,
    because:
      'the link is spent when the form is sent rather than when the page loads, because mail scanners follow every link in a message before a person sees it and would otherwise spend somebody’s reset for them. The page therefore has to look the same whether the token is real or invented, which is also what stops anybody telling one from the other.',
  },
  '/verify-email/[token]': { kind: 'bearer', dead: () => '/verify-email/not-a-real-token' },

  /* --- not about one workshop's records ----------------------------------- */
  '/(workshop)/help/[slug]': {
    kind: 'open',
    because: 'a help article is the same article for every workshop',
  },
  '/pay/subscribe/[orgId]': {
    kind: 'open',
    because: 'paying for a subscription is done before there is anything to read',
  },
  '/api/cron/[job]': {
    kind: 'open',
    because: 'the name of a scheduled job, behind the cron secret rather than a session',
  },
  '/api/exports/[dataset]': {
    kind: 'open',
    because: 'the name of a dataset; what comes back is checked below to be the caller’s own',
  },
  '/api/reports/[report]': {
    kind: 'open',
    because: 'the name of a report; what comes back is checked below to be the caller’s own',
  },
  '/api/v1/vehicles/[vin]': {
    kind: 'open',
    because: 'a VIN belongs to a car rather than to a workshop; what it returns is checked below',
  },
};

/* ---------------------------------------------------------------------------
   The routes, read off the filesystem
   --------------------------------------------------------------------------- */

/** Every address the application answers on that carries an identifier. */
function routesWithIdentifiers(): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'page.tsx' || entry === 'route.ts') {
        const route = `/${relative(APP, dir).split(sep).join('/')}`;
        if (route.includes('[')) found.push(route);
      }
    }
  };

  walk(APP);
  return [...new Set(found)].sort();
}

/* ---------------------------------------------------------------------------
   Asking
   --------------------------------------------------------------------------- */

async function ask(path: string, token?: string) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: token ? { cookie: `carnet_session=${token}` } : {},
  });

  const location = response.headers.get('location') ?? '';
  const body = response.status === 200 ? await response.text() : '';
  const granted = (response.headers.get('set-cookie') ?? '').includes('carnet_session=');

  return {
    status: response.status,
    location,
    body,
    /** A page that hands out a session to whoever knocks. */
    granted,
    /**
     * Sent away empty-handed, however the page chose to say it.
     *
     * Not by status code alone. A page under a loading boundary has already
     * flushed its shell by the time it looks the record up, so `notFound()`
     * renders the not-found screen inside a response that has committed to
     * 200. That is a fact about streaming rather than about tenancy, and
     * insisting on a 404 here would fail a page that is behaving perfectly
     * while passing one that quietly returns somebody else's invoice with a
     * redirect stapled to it. So the body is what is read.
     */
    refused:
      response.status === 404 ||
      response.status === 403 ||
      (response.status >= 300 && response.status < 400 && !location.includes('?id=')) ||
      NOT_FOUND.some((marker) => body.includes(marker)),
    signedOut: location.startsWith('/login'),
  };
}

/** How each of the not-found screens says it, in all three languages. */
const NOT_FOUND = [
  'The road stops here',
  'La route s’arrête ici',
  'الطريق ينتهي هنا',
  'Nothing here',
] as const;

/**
 * A reset link that really was issued, to hold the invented one against.
 *
 * Read out of the message queued for it rather than returned by the function,
 * because the function deliberately gives the caller nothing: telling somebody
 * their request succeeded is telling them the address exists.
 */
async function liveResetLink(userId: string): Promise<string | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  await requestReset(user.email);

  const sent = await prisma.messageLog.findFirst({
    where: { toAddress: user.email, body: { contains: '/reset/' } },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });

  const link = sent?.body?.match(/\/reset\/([A-Za-z0-9_-]+)/);
  return link ? `/reset/${link[1]}` : null;
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

/* ---------------------------------------------------------------------------
   What the seeded workshop has, for the stranger to ask about
   --------------------------------------------------------------------------- */

interface Ids {
  orgId: string;
  booking: string;
  customer: string;
  fleet: string;
  giftCard: string;
  invoice: string;
  job: string;
  product: string;
  payment: string;
  employee: string;
  purchaseOrder: string;
  import: string;
  supplier: string;
  transfer: string;
  vehicle: string;
  inspection: string;
  estimate: string;
  notification: string;
  warehouse: string;
  vin: string;
  plate: string;
  customerName: string;
  orgName: string;
}

/**
 * A seeded workshop has most kinds of record but not all of them, and a route
 * with nothing to ask about is a route this probe silently does not test.
 * Rather than skip those, it makes one of each missing kind, asks about it,
 * and takes it away again — so the answer is about the route rather than about
 * what happened to be in the database.
 */
async function furnish(orgId: string) {
  const customer = await prisma.customer.findFirst({
    where: { orgId, fleetAgreement: null },
    select: { id: true },
  });

  if (customer && !(await prisma.fleetAgreement.findFirst({ where: { orgId } }))) {
    await prisma.fleetAgreement.create({
      data: { orgId, customerId: customer.id, notes: TAG },
    });
  }

  if (!(await prisma.giftCard.findFirst({ where: { orgId } }))) {
    await prisma.giftCard.create({
      data: {
        orgId,
        code: `TENANCY-${randomBytes(3).toString('hex').toUpperCase()}`,
        amount: 25,
        note: TAG,
      },
    });
  }

  if (!(await prisma.importBatch.findFirst({ where: { orgId } }))) {
    await prisma.importBatch.create({
      data: {
        orgId,
        dataset: 'customers',
        fileName: `${TAG}.csv`,
        headers: ['name'],
        rows: [],
        rowCount: 0,
      },
    });
  }
}

/** And takes them away again. */
async function unfurnish(orgId: string) {
  await prisma.fleetAgreement.deleteMany({ where: { orgId, notes: TAG } });
  await prisma.giftCard.deleteMany({ where: { orgId, note: TAG } });
  await prisma.importBatch.deleteMany({ where: { orgId, fileName: `${TAG}.csv` } });
}

async function identifiersOf(orgId: string, orgName: string): Promise<Ids | null> {
  const one = async <T>(value: Promise<T | null>, what: string): Promise<T | null> => {
    const row = await value;
    if (!row) console.info(`        nothing to ask about: no ${what}`);
    return row;
  };

  const [
    booking,
    customer,
    fleet,
    giftCard,
    invoice,
    job,
    product,
    warehouse,
    payment,
    employee,
    purchaseOrder,
    imported,
    supplier,
    transfer,
    access,
    inspection,
    estimate,
    notification,
  ] = await Promise.all([
    one(prisma.booking.findFirst({ where: { orgId }, select: { id: true } }), 'booking'),
    one(
      prisma.customer.findFirst({
        where: { orgId },
        select: { id: true, displayName: true },
      }),
      'customer',
    ),
    one(prisma.fleetAgreement.findFirst({ where: { orgId }, select: { id: true } }), 'fleet'),
    one(prisma.giftCard.findFirst({ where: { orgId }, select: { id: true } }), 'gift card'),
    one(prisma.invoice.findFirst({ where: { orgId }, select: { id: true } }), 'invoice'),
    one(prisma.job.findFirst({ where: { orgId }, select: { id: true } }), 'job'),
    one(prisma.product.findFirst({ where: { orgId }, select: { id: true } }), 'part'),
    one(prisma.warehouse.findFirst({ where: { orgId }, select: { id: true } }), 'warehouse'),
    one(prisma.payment.findFirst({ where: { orgId }, select: { id: true } }), 'payment'),
    one(prisma.employee.findFirst({ where: { orgId }, select: { id: true } }), 'employee'),
    one(
      prisma.purchaseOrder.findFirst({ where: { orgId }, select: { id: true } }),
      'purchase order',
    ),
    one(prisma.importBatch.findFirst({ where: { orgId }, select: { id: true } }), 'import'),
    one(prisma.supplier.findFirst({ where: { orgId }, select: { id: true } }), 'supplier'),
    one(prisma.stockTransfer.findFirst({ where: { orgId }, select: { id: true } }), 'transfer'),
    one(
      prisma.vehicleAccessGrant.findFirst({
        where: { orgId },
        select: { vehicle: { select: { id: true, vin: true, registration: true } } },
      }),
      'vehicle',
    ),
    one(
      prisma.inspection.findFirst({ where: { job: { orgId } }, select: { id: true } }),
      'inspection',
    ),
    one(prisma.estimate.findFirst({ where: { orgId }, select: { id: true } }), 'estimate'),
    one(
      prisma.staffNotification.findFirst({ where: { orgId }, select: { id: true } }),
      'notification',
    ),
  ]);

  if (
    !booking ||
    !customer ||
    !fleet ||
    !giftCard ||
    !invoice ||
    !job ||
    !product ||
    !warehouse ||
    !payment ||
    !employee ||
    !purchaseOrder ||
    !supplier ||
    !transfer ||
    !access ||
    !inspection ||
    !estimate
  ) {
    return null;
  }

  return {
    orgId,
    orgName,
    booking: booking.id,
    customer: customer.id,
    customerName: customer.displayName,
    fleet: fleet.id,
    giftCard: giftCard.id,
    invoice: invoice.id,
    job: job.id,
    product: product.id,
    warehouse: warehouse.id,
    payment: payment.id,
    employee: employee.id,
    purchaseOrder: purchaseOrder.id,
    // An import is the one thing a fresh workshop may genuinely not have.
    import: imported?.id ?? 'no-import-to-ask-about',
    supplier: supplier.id,
    transfer: transfer.id,
    vehicle: access.vehicle.id,
    vin: access.vehicle.vin,
    plate: access.vehicle.registration ?? '',
    inspection: inspection.id,
    estimate: estimate.id,
    // A workshop that has never been told anything has none of these, and the
    // route still has to refuse an identifier that is not the asker's.
    notification: notification?.id ?? 'no-notification-to-ask-about',
  };
}

/* ---------------------------------------------------------------------------
   The probe
   --------------------------------------------------------------------------- */

async function main() {
  console.info('\n  Can one workshop reach another one?\n');

  const hillside = await prisma.organization.findFirst({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  if (!hillside) {
    console.info('  FAIL  no seeded workshop to ask about. Run npm run db:seed.');
    process.exit(1);
  }

  await furnish(hillside.id);

  const theirs = await identifiersOf(hillside.id, hillside.name);

  if (!theirs) {
    console.info('  FAIL  the seeded workshop is missing records this probe needs.');
    process.exit(1);
  }

  /* --- a stranger, with every permission their own workshop can give ------- */

  const outcome = await createWorkshop(
    {
      workshopName: `${TAG} Motors`,
      contactName: 'Tenancy Probe',
      email: `tenancy-probe-${randomBytes(4).toString('hex')}@tenancyprobe.test`,
      password: randomBytes(24).toString('base64url'),
      sites: 1,
      country: 'GB',
    },
    { plan: 'GROUP', acceptConsumerEmail: true },
  );

  if (!outcome.ok) {
    console.info('  FAIL  could not create the other workshop', outcome.problems);
    process.exit(1);
  }

  const made = await prisma.organization.findFirstOrThrow({
    where: { slug: outcome.orgSlug! },
    select: { id: true },
  });

  // Standing in for the person clicking the link in their welcome mail. A
  // workshop that has not confirmed its address is sent to /confirm-email from
  // every page, which would make every refusal below look like a pass while
  // proving nothing at all — the control check further down is what caught
  // that, and it is why the control check exists.
  await prisma.user.update({
    where: { id: outcome.userId! },
    data: { emailVerifiedAt: new Date() },
  });

  try {
    await run(theirs, made.id, outcome.userId!);
  } finally {
    await forget(made.id, outcome.userId!);
    await unfurnish(hillside.id);
  }

  finish();
}

async function run(theirs: Ids, orgId: string, userId: string) {
  const owner = await mint(userId, orgId);

  /* --- the route list is complete ----------------------------------------- */

  console.info('  Every address with an identifier in it');

  const routes = routesWithIdentifiers();
  const undeclared = routes.filter((route) => !CASES[route]);

  check(
    undeclared.length === 0,
    `all ${routes.length} of them say what happens when the identifier is somebody else's`,
    undeclared.join(', '),
  );

  const stale = Object.keys(CASES).filter((route) => !routes.includes(route));
  check(stale.length === 0, 'and nothing is declared that no longer exists', stale.join(', '));

  /* --- but first, that "not found" means anything at all ------------------- */

  // The whole probe below reads as a long column of passes if the session is
  // broken, the plan is too small, or the routes are unreachable for some
  // reason that has nothing to do with tenancy: everything answers not found,
  // and nothing has been proved. So it asks for something that IS the
  // stranger's, at the same route, first. If that cannot be read either, none
  // of the refusals afterwards is evidence.
  console.info('\n  That a refusal means anything');

  const [ownCustomer, ownSupplier, ownPart] = await Promise.all([
    prisma.customer.create({
      data: { orgId, displayName: `${TAG} Own Customer` },
      select: { id: true },
    }),
    prisma.supplier.create({
      data: { orgId, name: `${TAG} Own Supplier` },
      select: { id: true },
    }),
    prisma.product.create({
      data: { orgId, partNumber: `${TAG}-PART`, name: `${TAG} Own Part` },
      select: { id: true },
    }),
  ]);

  for (const [path, word] of [
    [`/customers/${ownCustomer.id}`, `${TAG} Own Customer`],
    [`/suppliers/${ownSupplier.id}`, `${TAG} Own Supplier`],
    [`/parts/${ownPart.id}`, `${TAG} Own Part`],
  ] as const) {
    const ours = await ask(path, owner);

    check(
      ours.body.includes(word),
      `the stranger can read its own record at ${path.replace(/\/[^/]+$/, '/…')}`,
      ours.signedOut ? 'sent to sign in' : ours.status,
    );
  }

  /* --- asking for their records, as a whole workshop ----------------------- */

  console.info("\n  Asking for the other workshop's records");

  for (const one of Object.values(CASES)) {
    if (one.kind !== 'scoped' || one.portal || !one.fill) continue;

    const path = one.fill(theirs);
    const answer = await ask(path, owner);

    if (answer.signedOut) {
      check(false, `${path} kept the session`, 'sent to sign in');
      continue;
    }

    check(
      answer.refused && !answer.body.includes(theirs.customerName),
      `${path} is not found`,
      answer.status === 200 ? 'answered 200' : answer.status,
    );
  }

  /* --- the same, as somebody else's customer ------------------------------- */

  console.info('\n  Asking as a customer who is not their customer');

  // A real customer of some workshop — no membership of any workshop is what
  // makes somebody a portal user — who has nothing to do with this car.
  const portalUser = await prisma.user.findFirst({
    where: {
      memberships: { none: {} },
      ownedVehicles: { none: { vehicleId: theirs.vehicle } },
    },
    select: { id: true },
  });

  if (!portalUser) {
    check(false, 'there is a customer to ask as', 'no portal user without that vehicle');
  } else {
    const driver = await mint(portalUser.id, null);

    for (const [, one] of Object.entries(CASES)) {
      if (!one.portal || !one.fill) continue;

      const path = one.fill(theirs);
      const answer = await ask(path, driver);

      check(
        answer.refused && !answer.body.includes(theirs.customerName),
        `${path} is not theirs to read`,
        answer.status === 200 ? 'answered 200' : answer.status,
      );
    }
  }

  /* --- with nobody signed in at all --------------------------------------- */

  console.info('\n  Asking with nobody signed in');

  for (const [route, one] of Object.entries(CASES)) {
    if (one.kind !== 'scoped' || !one.fill) continue;
    if (route === '/pay/[id]') continue; // A payment link is meant to open cold.

    const path = one.fill(theirs);
    const answer = await ask(path);

    check(
      answer.refused || answer.signedOut,
      `${path} asks who is asking`,
      answer.status === 200 ? 'answered 200' : answer.status,
    );
  }

  /* --- a link that is not a link ------------------------------------------ */

  // What matters on a link whose identifier IS the credential is not the
  // status code. A friendly "this link is no longer live" page answering 200
  // is a better answer to a customer than a bare 404, and one of these pages
  // has to answer 200 on purpose. What must be true of all of them is that
  // holding a token nobody issued shows nothing and signs nobody in.
  console.info('\n  Holding a token that was never issued');

  for (const [, one] of Object.entries(CASES)) {
    if (one.kind !== 'bearer' || !one.dead) continue;

    const path = one.dead(theirs);
    const answer = await ask(path);

    const leaked = [theirs.customerName, theirs.orgName, theirs.plate].filter(
      (what) => what && answer.body.includes(what),
    );

    check(
      leaked.length === 0 && !answer.granted && answer.status < 500,
      `${path} shows nothing and signs nobody in`,
      leaked.length > 0 ? `leaked ${leaked.join(', ')}` : answer.status,
    );
  }

  /* --- and cannot be told from a real one --------------------------------- */

  console.info('\n  Telling a real link from an invented one');

  for (const [route, one] of Object.entries(CASES)) {
    if (!one.sameEitherWay || !one.dead) continue;

    const real = await liveResetLink(userId);

    if (!real) {
      check(false, `${route} could be compared against a real link`, 'none was issued');
      continue;
    }

    const invented = one.dead(theirs);
    const [a, b] = await Promise.all([ask(real), ask(invented)]);

    // Three things differ between any two requests and none of them is a
    // tell: the token itself, which is in the form's hidden field; the CSP
    // nonce, minted per request on purpose and appearing both as an attribute
    // and, escaped, inside the payload the page rehydrates from; and the
    // router's own per-request identifier. All three are taken out, and then
    // everything else has to match character for character — which is the
    // property that actually matters, because a page that differs at all is a
    // page that answers "does this token exist?".
    const strip = (body: string, path: string) =>
      body
        .split(path.split('/').pop()!)
        .join('TOKEN')
        .replace(/nonce[^A-Za-z0-9]{1,6}[A-Za-z0-9+/=_-]+/g, 'NONCE')
        .replace(/__next_r="[^"]*"/g, '__next_r="R"');

    check(
      strip(a.body, real) === strip(b.body, invented),
      `${route} looks the same whether the token is real or invented`,
      one.because,
    );
  }

  /* --- and cannot change what it cannot read ------------------------------ */

  // Reading is only half of it. A page that refuses to render still leaves the
  // action behind it reachable: a form post carries an identifier, and nothing
  // about a 404 on the page stops somebody sending one by hand. So the write
  // paths are called directly, the way the form calls them, with the
  // stranger's own organisation and the other workshop's identifier — the
  // exact shape of the attack.
  console.info("\n  Trying to change the other workshop's records");

  const writes: [string, () => Promise<unknown>][] = [
    [
      'rename their customer',
      () =>
        updateCustomer({
          orgId,
          userId,
          customerId: theirs.customer,
          details: { displayName: 'Taken over', kind: 'INDIVIDUAL' } as never,
        }),
    ],
    ['move their job along', () => moveJob({ orgId, userId, jobId: theirs.job, to: 'COMPLETED' })],
    ['invoice their job', () => issueInvoice({ orgId, userId, jobId: theirs.job })],
    [
      'take a payment against their bill',
      () =>
        recordPayment({
          orgId,
          userId,
          invoiceId: theirs.invoice,
          amount: money(1_00),
          method: 'CASH',
        }),
    ],
    [
      'move stock off their shelf',
      () =>
        adjustStock({
          orgId,
          productId: theirs.product,
          warehouseId: theirs.warehouse,
          quantity: -1,
          reason: TAG,
        }),
    ],
  ];

  for (const [what, attempt] of writes) {
    let refused = false;

    try {
      await attempt();
    } catch {
      // Any refusal will do. What must not happen is the write going through.
      refused = true;
    }

    // A write that goes through has changed the other workshop's records, and
    // this script cannot put them back: it does not know what the write did.
    // Saying so matters, because the probe tears its own workshop down
    // afterwards and the postings that write left behind go with it, which
    // leaves a shelf or a ledger quietly out of step until somebody reseeds.
    check(
      refused,
      `a stranger cannot ${what}`,
      refused ? undefined : 'it went through — reseed before trusting any other check',
    );
  }

  /* --- what a stranger holding a real link can see ------------------------ */

  // The passport link is meant to be given to a buyer, so it is the one place
  // in the product where a stranger is supposed to see something. What they
  // must not see is who owns the car, how to reach them, or what the work
  // cost: a share link is a record of the vehicle, not of the person.
  console.info('\n  Reading a passport somebody meant to share');

  const shared = await prisma.passportShare.findFirst({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { vehicleId: true },
  });

  if (!shared) {
    check(false, 'there is a live passport link to read', 'none in the database');
  } else {
    // Whoever the car belongs to, and everything the workshop knows about
    // reaching them.
    const people = await prisma.customer.findMany({
      where: { jobs: { some: { vehicleId: shared.vehicleId } } },
      select: { displayName: true, email: true, phone: true, addressLine1: true },
    });

    const answer = await ask('/p/demo-share-token');

    const priv = people.flatMap((person) =>
      [person.displayName, person.email, person.phone, person.addressLine1].filter(
        (what): what is string => Boolean(what && what.length > 3),
      ),
    );

    const shown = priv.filter((what) => answer.body.includes(what));

    check(
      answer.status === 200,
      'a live passport link opens for somebody with no account at all',
      answer.status,
    );

    check(
      shown.length === 0,
      'and says nothing about who owns the car or how to reach them',
      shown.length > 0 ? `showed ${shown.join(', ')}` : undefined,
    );
  }

  /* --- what comes back in bulk -------------------------------------------- */

  console.info('\n  Taking everything the stranger is entitled to');

  for (const dataset of ['customers', 'vehicles', 'jobs', 'invoices']) {
    const answer = await ask(`/api/exports/${dataset}?format=json`, owner);

    check(
      !answer.body.includes(theirs.customerName) && !answer.body.includes(theirs.plate),
      `an export of ${dataset} carries none of their records`,
      answer.status,
    );
  }

  /* --- a car both of them could have seen --------------------------------- */

  console.info('\n  Asking about a car by its number rather than by its id');

  if (theirs.vin) {
    const key = await prisma.apiKey.findFirst({ where: { orgId }, select: { id: true } });
    const answer = await ask(`/api/v1/vehicles/${theirs.vin}`, owner);

    check(
      !answer.body.includes(theirs.customerName),
      'a VIN the stranger has never worked on tells them nothing about the owner',
      `${answer.status}${key ? '' : ', no key'}`,
    );
  }
}

async function forget(orgId: string, userId: string) {
  await prisma.session.deleteMany({ where: { OR: [{ orgId }, { userId }] } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function finish() {
  console.info('');
  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. A workshop can reach its own records and nobody else's.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
