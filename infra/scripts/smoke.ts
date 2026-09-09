/**
 * Smoke test.
 *
 *   npx tsx infra/scripts/smoke.ts [baseUrl]
 *
 * Mints a session for each seeded role directly in the database, then fetches
 * every route that role should reach and asserts the page actually rendered
 * the thing it exists to show. A 200 that renders an empty shell is not a
 * passing test, so each route also asserts on content.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

interface Check {
  path: string;
  as: string;
  expect: string[];
  /** Expect a redirect away rather than a rendered page. */
  redirects?: boolean;
  /**
   * Expect the response to send the browser here, by whichever mechanism.
   *
   * A redirect decided before rendering arrives as a 3xx with a Location
   * header. One decided after the loading boundary has flushed cannot: the
   * status line is already sent, so Next carries it as a meta refresh in the
   * body instead. Both are redirects to the person using the app, so the
   * assertion is on the destination rather than on the status code.
   */
  redirectsTo?: string;
  /** Text that must NOT appear. Used for figures a role should never see. */
  absent?: string[];
}

async function sessionFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });

  const token = randomBytes(32).toString('base64url');

  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      orgId: user.memberships[0]?.orgId ?? null,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  return token;
}

async function main() {
  const tokens = {
    owner: await sessionFor('ahmed@hillsidemotors.test'),
    advisor: await sessionFor('sara@hillsidemotors.test'),
    technician: await sessionFor('john@hillsidemotors.test'),
    bookkeeper: await sessionFor('fatima@hillsidemotors.test'),
    customer: await sessionFor('maria@example.test'),
  };

  const job = await prisma.job.findFirstOrThrow({ where: { number: 10_482 } });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { make: 'BMW' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { displayName: 'Maria Okonkwo' },
  });
  const product = await prisma.product.findFirstOrThrow({ where: { partNumber: '04152-YZZA1' } });
  const order = await prisma.purchaseOrder.findFirstOrThrow({ where: { number: 'PO-2041' } });

  const checks: Check[] = [
    { path: '/login', as: 'anon', expect: ['Sign in', 'The history should belong to the car'] },

    // The front door. Public, indexed, and the only pages a stranger meets.
    {
      path: '/',
      as: 'anon',
      expect: [
        'The history should belong to the car',
        'A record the vehicle keeps',
        'Start a 30-day trial',
        'Priced per bay',
      ],
    },
    {
      path: '/pricing',
      as: 'anon',
      expect: ['Per bay, per month', 'Core', 'Complete', 'Group', 'Staff accounts', 'No limit'],
    },
    {
      path: '/pricing?billing=monthly',
      as: 'anon',
      expect: ['Billed monthly'],
    },
    {
      path: '/signup',
      as: 'anon',
      expect: ['Open your workshop', 'You are opening a workshop, not an account', 'Workshop name'],
    },
    // The plan carries through from the pricing page.
    { path: '/signup?plan=group', as: 'anon', expect: ['30 days on Group'] },
    // Signed in, the front door offers the workshop rather than a trial.
    { path: '/', as: 'owner', expect: ['Open workshop'] },
    {
      path: '/dashboard',
      as: 'owner',
      expect: ['Awaiting approval', 'Today in the workshop', 'Approvals needed'],
    },
    { path: '/diary', as: 'owner', expect: ['Diary', 'Brake system repair', 'Capacity'] },
    { path: '/jobs', as: 'owner', expect: ['Jobs', '10482', 'Brake system repair'] },
    {
      path: `/jobs/${job.id}`,
      as: 'owner',
      expect: [
        'Brake system repair',
        'Progress',
        'Front pads',
        'Estimate v1',
        'Waiting on the customer',
        'Profitability',
        'Labour at cost',
      ],
    },
    // The same job, seen from the counter: no margin on screen.
    {
      path: `/jobs/${job.id}`,
      as: 'advisor',
      expect: ['Brake system repair', 'Progress'],
      absent: ['Profitability', 'Gross profit'],
    },
    {
      path: '/customers',
      as: 'advisor',
      expect: ['Customers', 'Maria Okonkwo', 'Pennine Plumbing'],
    },
    {
      path: `/customers/${customer.id}`,
      as: 'advisor',
      expect: ['Maria Okonkwo', 'Vehicles', 'Recent jobs'],
    },
    { path: '/vehicles', as: 'advisor', expect: ['Vehicles', 'WBAJA9C509G000000', 'MK20 XRT'] },
    {
      path: `/vehicles/${vehicle.id}`,
      as: 'advisor',
      expect: [
        'History intact',
        'Kirkstall Autocentre',
        'Ownership transferred',
        'Open recalls',
        'Next service',
      ],
    },
    {
      path: '/shop',
      as: 'technician',
      expect: ['My jobs', 'Brake system repair', 'Inspect', 'Waiting for the customer'],
    },
    {
      path: '/portal',
      as: 'customer',
      expect: ['My vehicles', 'Needs your approval', 'Review and decide'],
    },
    // Phase 2: inventory and procurement.
    {
      path: '/parts',
      as: 'advisor',
      expect: ['Parts', 'Stock value', 'Below reorder point', 'Issued more than recorded'],
    },
    {
      path: `/parts/${product.id}`,
      as: 'owner',
      expect: ['Oil filter', 'Movements', 'Reorder', 'Weighted average cost'],
    },
    {
      path: '/purchasing',
      as: 'owner',
      expect: ['Purchasing', 'Purchase requests', 'PO-2041', 'Bills to query'],
    },
    {
      path: `/purchasing/${order.id}`,
      as: 'owner',
      expect: ['PO-2041', 'Book in delivery', 'Outstanding', 'Pennine Motor Factors'],
    },
    { path: '/suppliers', as: 'owner', expect: ['Suppliers', 'Pennine Motor Factors', 'disputed'] },
    // A technician may request a part but must not reach purchasing approval.
    { path: '/parts', as: 'technician', expect: [], redirects: true },

    // Money and admin.
    {
      path: '/invoices',
      as: 'owner',
      expect: ['Invoices', 'Outstanding', 'INV-1042', 'Ahmed Hassan'],
    },
    { path: '/payments', as: 'owner', expect: ['Payments', 'How you were paid', 'Taken today'] },
    {
      path: '/reports',
      as: 'owner',
      expect: ['Operational reports', 'Passport coverage', 'Technicians', 'Clocked time'],
    },
    {
      path: '/settings',
      as: 'owner',
      expect: ['Settings', 'Hillside Motors', 'Tax rates', 'Inspection templates'],
    },
    { path: '/audit', as: 'owner', expect: ['Audit log', 'immutable at the database level'] },
    // A bookkeeper reaches the money pages but not the diary.
    { path: '/invoices', as: 'bookkeeper', expect: ['Invoices'] },

    // Phase 3: the ledger. "Balanced" is the assertion that matters — every
    // other figure on these pages is derived from postings that balance.
    {
      path: '/ledger',
      as: 'bookkeeper',
      expect: [
        'General ledger',
        'Trial balance',
        'Balanced',
        'Accounts receivable',
        'Stock on hand',
      ],
    },
    {
      path: '/ledger?view=journal',
      as: 'bookkeeper',
      expect: ['Journal', 'INV-1042', 'Opening balances brought forward', 'from Invoice'],
    },
    {
      path: '/financials',
      as: 'owner',
      expect: [
        'Financial statements',
        'Profit and loss',
        'Balance sheet',
        'Gross profit',
        'Aged debtors',
        'INV-1036',
        'Balanced',
      ],
    },
    { path: '/financials?range=month', as: 'bookkeeper', expect: ['Financial statements'] },
    // Phase 4: people, payroll and multi-site.
    {
      path: '/people',
      as: 'owner',
      expect: [
        'Productivity',
        'Utilisation',
        'Efficiency',
        'John Adeyemi',
        'Pay, site and contracted hours',
        // The lapsed MOT licence is the finding the page exists to surface.
        'cannot',
        'legally sign off',
      ],
    },
    {
      path: '/transfers',
      as: 'owner',
      expect: ['Stock transfers', 'On the road', 'TRF-0007', 'Bradford', 'Value on the road'],
    },
    {
      path: '/group',
      as: 'owner',
      expect: ['Sites', 'By site', 'Bradford Lane', 'Hillside Road', 'Spread', 'Group'],
    },
    // A technician never reaches the productivity board or the group view.
    {
      path: '/people',
      as: 'technician',
      expect: [],
      redirects: true,
    },
    // An advisor may raise a transfer but has no business reading pay.
    { path: '/transfers', as: 'advisor', expect: ['Stock transfers'] },
    {
      path: '/people',
      as: 'advisor',
      expect: [],
      redirectsTo: '/dashboard?denied=people%3Aread',
      absent: ['Cost per hour', 'Pay history'],
    },

    // An advisor typing the ledger URL is sent back to their own surface with
    // a reason, rather than shown a stack trace behind a 200.
    {
      path: '/ledger',
      as: 'advisor',
      expect: [],
      redirectsTo: '/dashboard?denied=ledger%3Aread',
      absent: ['Trial balance', 'Accounts receivable'],
    },
    { path: '/dashboard?denied=ledger%3Aread', as: 'advisor', expect: ['general ledger'] },

    // Role segregation: a technician reaching a workshop URL is redirected.
    { path: '/dashboard', as: 'technician', expect: [], redirects: true },
    { path: '/dashboard', as: 'anon', expect: [], redirects: true },
  ];

  let failures = 0;

  for (const check of checks) {
    const token = tokens[check.as as keyof typeof tokens];
    const response = await fetch(`${BASE}${check.path}`, {
      redirect: 'manual',
      headers: token ? { cookie: `carnet_session=${token}` } : {},
    });

    if (check.redirectsTo) {
      const body = await response.text();
      const viaHeader = response.headers.get('location') ?? '';
      const viaRefresh = body.match(/http-equiv="refresh" content="[^"]*url=([^"]+)"/)?.[1] ?? '';
      const target = viaHeader || viaRefresh.replace(/&#x27;/g, "'");
      const leaked = (check.absent ?? []).filter((needle) => body.includes(needle));

      const sent = target.includes(check.redirectsTo);
      const clean = leaked.length === 0;

      console.info(
        sent && clean
          ? `  ok    ${check.as.padEnd(11)} ${check.path} -> sent to ${check.redirectsTo}, nothing leaked`
          : `  FAIL  ${check.as.padEnd(11)} ${check.path} ${sent ? `leaked: ${leaked.join(', ')}` : `went to "${target || 'nowhere'}"`}`,
      );
      if (!sent || !clean) failures += 1;
      continue;
    }

    if (check.redirects) {
      const redirected = response.status >= 300 && response.status < 400;
      console.info(
        redirected
          ? `  ok    ${check.as.padEnd(11)} ${check.path} -> ${response.status} ${response.headers.get('location') ?? ''}`
          : `  FAIL  ${check.as.padEnd(11)} ${check.path} expected a redirect, got ${response.status}`,
      );
      if (!redirected) failures += 1;
      continue;
    }

    if (response.status !== 200) {
      console.error(`  FAIL  ${check.as.padEnd(11)} ${check.path} -> ${response.status}`);
      failures += 1;
      continue;
    }

    const html = await response.text();
    const missing = check.expect.filter((needle) => !html.includes(needle));
    const leaked = (check.absent ?? []).filter((needle) => html.includes(needle));

    if (leaked.length > 0) {
      console.error(`  FAIL  ${check.as.padEnd(11)} ${check.path} leaked: ${leaked.join(', ')}`);
      failures += 1;
      continue;
    }

    if (missing.length === 0) {
      console.info(
        `  ok    ${check.as.padEnd(11)} ${check.path} -> 200, ${check.expect.length} assertions`,
      );
    } else {
      console.error(
        `  FAIL  ${check.as.padEnd(11)} ${check.path} -> 200 but missing: ${missing.join(', ')}`,
      );
      failures += 1;
    }
  }

  console.info(failures === 0 ? '\nAll routes rendered.' : `\n${failures} route check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
