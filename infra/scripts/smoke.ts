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
  /**
   * The status the page should answer with, when it is not 200.
   *
   * Used for the routes whose correct answer is "there is no such thing here":
   * a customer reaching another customer's vehicle must meet a page that does
   * not exist, rather than one that confirms somebody else's does.
   */
  status?: number;
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
  const estimate = await prisma.estimate.findFirstOrThrow({ where: { status: 'SENT' } });
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
    // Phase 4.8: expenses, banking and close.
    {
      path: '/expenses',
      as: 'owner',
      expect: ['Expenses', 'Tax to reclaim', 'Owed to staff', 'Record an expense'],
    },
    {
      path: '/banking',
      as: 'bookkeeper',
      expect: ['Banking and close', 'Where this stands', 'Suggested matches', 'Closing the period'],
    },
    // A workshop on Core has no ledger, so no banking either.
    { path: '/expenses', as: 'advisor', expect: [], redirectsTo: '/dashboard?denied=' },

    // Phase 4.7: counter sales, reporting and the gaps.
    {
      path: '/counter',
      as: 'owner',
      expect: ['Over the counter', 'New sale', 'Taken today', 'Recent sales'],
    },
    {
      path: '/reports/business',
      as: 'owner',
      expect: [
        'Business reports',
        'Revenue by service type',
        'Parts profitability',
        'Where the work comes from',
      ],
    },
    {
      path: '/estimates',
      as: 'advisor',
      expect: ['Estimates', 'Waiting on a customer', 'Value waiting'],
    },

    // Phase 4.6: administration and the customer's journey.
    {
      path: '/settings/team',
      as: 'owner',
      expect: ['Team', 'In the workshop', 'Invite somebody', 'How roles work'],
    },
    {
      path: '/reminders',
      as: 'advisor',
      expect: ['Service reminders', 'Due', 'How this works'],
    },
    {
      path: '/crm',
      as: 'advisor',
      expect: ['Relationships', 'Segments', 'Retention by cohort', 'Campaigns'],
    },
    // The held-back run is the row this page exists for, so the smoke test
    // asserts the column that shows it rather than only the page title.
    {
      path: '/automation',
      as: 'owner',
      expect: ['Automation', 'About to happen', 'Rules', 'What happened', 'held back'],
    },
    // The failed row is the one this page exists for. A message nobody
    // received, with the reason it will not be retried, has to be visible
    // without anybody going looking for it.
    {
      path: '/messages',
      as: 'owner',
      expect: ['Messages', 'Outbound', 'failed', 'will never arrive'],
    },
    {
      path: '/portal/book',
      as: 'customer',
      expect: ['When suits you?', 'What needs doing?', 'Which vehicle?'],
    },
    // The customer's own view of a vehicle they own, which is the same record
    // a stranger reads through a share link plus the two things a stranger is
    // not entitled to: what each visit cost, and the ability to share it.
    {
      path: `/portal/vehicles/${vehicle.id}`,
      as: 'customer',
      expect: ['Every visit', 'Show this history to somebody', 'Create a link'],
    },
    {
      path: `/portal/estimates/${estimate.id}`,
      as: 'customer',
      expect: ['A quote for your', 'What we recommend', 'Send my answer'],
    },
    // A vehicle this customer does not own is not theirs to read.
    {
      path: '/portal/vehicles/not-a-real-vehicle',
      as: 'customer',
      expect: [],
      status: 404,
    },
    {
      path: '/portal/updates',
      as: 'customer',
      expect: ['Updates', 'Waiting on you', 'Review and decide'],
    },
    {
      path: '/portal/invoices',
      as: 'customer',
      expect: ['Invoices'],
    },
    // The quote link a workshop would text, opened by somebody with no
    // account at all. Most people will meet Carnet here and nowhere else.
    {
      path: '/e/demo-estimate-token',
      as: 'anon',
      expect: ['A quote for your', 'What we recommend', 'Send my answer', 'Your name'],
    },
    // A link that was never issued says the link is dead, rather than 404ing,
    // which reads as a broken system, or erroring, which reads as the
    // customer's fault.
    {
      path: '/e/not-a-real-token',
      as: 'anon',
      expect: ['This link is no longer live'],
    },
    // The scheduled jobs send messages to customers and close people's
    // timesheets. An open URL would hand both to anybody on the internet, so
    // the check that matters is the refusal.
    {
      path: '/api/cron/dispatch',
      as: 'anon',
      expect: ['Not authorised'],
      status: 401,
    },
    // Signed in is not the same as being the scheduler. A workshop owner has
    // no more right to trigger these than a stranger does.
    {
      path: '/api/cron/dispatch',
      as: 'owner',
      expect: ['Not authorised'],
      status: 401,
    },
    // An invitation link nobody issued says so, rather than "invalid link".
    {
      path: '/invite/not-a-real-token',
      as: 'anon',
      expect: ['We did not issue this link'],
    },

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

  // The plan gate. Demoted to Core, the ledger must show the wall rather than
  // the ledger; restored afterwards so the rest of the run is unaffected. A
  // published price with nothing behind it is a promise the system cannot keep,
  // so this is checked against a real organisation rather than in a unit test.
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  await prisma.organization.update({ where: { id: org.id }, data: { plan: 'CORE' } });

  let planWallHtml = '';
  try {
    const response = await fetch(`${BASE}/ledger`, {
      headers: { cookie: `carnet_session=${tokens.bookkeeper}` },
    });
    planWallHtml = await response.text();
  } finally {
    await prisma.organization.update({ where: { id: org.id }, data: { plan: org.plan } });
  }

  // CSV export. FR-1406, promised since Phase 1. Checked for the escaping
  // that keeps a spreadsheet from eating the data: a byte order mark, a part
  // number that keeps its leading zero, and CRLF endings.
  const csvResponse = await fetch(`${BASE}/api/reports/parts?range=year`, {
    headers: { cookie: `carnet_session=${tokens.owner}` },
  });
  // Read as bytes. text() decodes UTF-8 and strips a leading byte order mark,
  // so decoding first would hide the very thing being asserted.
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  const csvBody = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csvBytes);

  let failures = 0;

  for (const [label, passed] of [
    [
      'downloads as an attachment',
      (csvResponse.headers.get('content-disposition') ?? '').includes('attachment'),
    ],
    ['is not cached', csvResponse.headers.get('cache-control') === 'no-store'],
    ['opens as UTF-8', csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf],
    ['uses CRLF endings', csvBody.includes(String.fromCharCode(13, 10))],
    ['keeps a part number literal', csvBody.includes('="')],
  ] as const) {
    console.info(`  ${passed ? 'ok  ' : 'FAIL'}  csv export: ${label}`);
    if (!passed) failures += 1;
  }

  for (const [label, present] of [
    ['names what was hit', 'general ledger'],
    ['names the plan that clears it', 'Complete'],
    ['names the price', 'per bay per month'],
    ['does not leak the ledger', null],
  ] as const) {
    const ok =
      present === null ? !planWallHtml.includes('Trial balance') : planWallHtml.includes(present);

    console.info(`  ${ok ? 'ok  ' : 'FAIL'}  plan wall on Core: ${label}`);
    if (!ok) failures += 1;
  }

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

    if (check.status && response.status === check.status) {
      console.info(
        `  ok    ${check.as.padEnd(11)} ${check.path} -> ${response.status}, as it should`,
      );
      continue;
    }

    if (response.status !== (check.status ?? 200)) {
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
