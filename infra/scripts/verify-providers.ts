/**
 * Providers, against a real database and a running server. Phase 43.
 *
 *   npx tsx infra/scripts/verify-providers.ts [baseUrl]
 *
 * The VIN decoder built in names the maker from a VIN and leaves a European
 * year blank, and the vehicle form is filled from it. The sample fitment feed
 * adds what a part fits, leaves a workshop's own row alone, does not write a
 * claim twice, and takes back a row it wrote before and no longer sends.
 * A timesheet carries a bonus and a deduction, the run posts gross with the
 * bonus in, the file comes in three named shapes and refuses a fourth, and
 * once handed over the sheet refuses another adjustment, in the product and
 * in the database. Overtime is paid at the workshop's own multiplier. A
 * five-star answer is offered the Google link once the workshop names its
 * listing, the visit is counted, and a three-star answer is never sent there.
 *
 * Runs against the seeded organisations and puts back everything it changes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import { draftTimesheet } from '../../apps/web/src/lib/people';
import {
  addPayAdjustment,
  approveTimesheet,
  payrollSettings,
  runPayroll,
  savePayrollSettings,
} from '../../apps/web/src/lib/payroll';
import { decodeVin, fetchFeedFitments, setGooglePlaceId } from '../../apps/web/src/lib/providers';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const FEED = 'Sample catalogue';

let failures = 0;
const tokens: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refused(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'allowed';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function sessionFor(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokens.push(tokenHash);
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function get(path: string, cookie = '') {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return {
    status: response.status,
    body: await response.text(),
    location: response.headers.get('location') ?? '',
    disposition: response.headers.get('content-disposition') ?? '',
  };
}

async function main() {
  console.info(`\n  Providers\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
  });
  const technician = await prisma.user.findUniqueOrThrow({
    where: { email: 'john@hillsidemotors.test' },
  });
  const ownerCookie = await sessionFor(owner.id, org.id);
  const techCookie = await sessionFor(technician.id, org.id);

  /* --- VIN decoding --------------------------------------------------------- */

  console.info('\n  VIN decoding\n');

  const bmw = await decodeVin('wbaja9c509g000000');
  check(
    'the built-in decoder names the maker',
    [bmw.make, bmw.decoder],
    ['BMW', 'the built-in reader'],
  );
  const golf = await decodeVin('WVWZZZ1JZ3W386752');
  check(
    'and leaves a European year and the model blank',
    [golf.make, golf.year, golf.model],
    ['Volkswagen', null, null],
  );
  const tesla = await decodeVin('5YJ3E1EA7KF317000');
  check('and reads a North American year', [tesla.make, tesla.year], ['Tesla', 2019]);
  check(
    'and refuses what is not a VIN',
    (await refused(() => decodeVin('WVWZZZ1JZ3W38675O'))).includes('no I, O or Q'),
    true,
  );

  const unseen = 'WVWZZZ1JZ3W386752';
  const decodedPage = await get(`/vehicles/find?q=${unseen}&vin=${unseen}&decode=1`, ownerCookie);
  check(
    'the vehicle form is filled from the VIN and offers to read it',
    [
      decodedPage.status,
      decodedPage.body.includes('value="Volkswagen"'),
      decodedPage.body.includes('Read from the VIN by'),
      decodedPage.body.includes('Read the VIN'),
    ],
    [200, true, true, true],
  );
  const decodedFr = await get(
    `/vehicles/find?q=${unseen}&vin=${unseen}&decode=1`,
    `${ownerCookie}; carnet_lang=fr`,
  );
  check('in French', decodedFr.body.includes('Lu dans le VIN par'), true);

  /* --- Fitment feed ---------------------------------------------------------- */

  console.info('\n  Fitment feed\n');

  const filter = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '04152-YZZA1' },
    select: { id: true },
  });
  const cabin = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '87139-0D070' },
    select: { id: true },
  });
  const own = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: 'BAT-090-AGM' },
    select: { id: true },
  });
  await prisma.partFitment.deleteMany({
    where: { orgId: org.id, feedName: FEED },
  });
  const workshopRow = await prisma.partFitment.findFirstOrThrow({
    where: { productId: cabin.id, source: 'WORKSHOP' },
    select: { id: true, updatedAt: true },
  });

  const first = await fetchFeedFitments({ orgId: org.id, userId: owner.id, productId: filter.id });
  check(
    'the feed adds what is new and does not write a held claim twice',
    [first.added, first.unchanged, first.removed],
    [2, 1, 0],
  );
  const again = await fetchFeedFitments({ orgId: org.id, userId: owner.id, productId: filter.id });
  check('a second fetch changes nothing', [again.added, again.unchanged, again.removed], [0, 3, 0]);

  const cabinFetch = await fetchFeedFitments({
    orgId: org.id,
    userId: owner.id,
    productId: cabin.id,
  });
  check(
    'a row somebody here recorded is left as it is',
    [cabinFetch.added, cabinFetch.keptWorkshop],
    [1, 1],
  );
  const afterRow = await prisma.partFitment.findUnique({
    where: { id: workshopRow.id },
    select: { source: true, feedName: true, updatedAt: true },
  });
  check(
    'untouched',
    [afterRow?.source, afterRow?.feedName, afterRow?.updatedAt.getTime()],
    ['WORKSHOP', null, workshopRow.updatedAt.getTime()],
  );

  await prisma.partFitment.create({
    data: {
      orgId: org.id,
      productId: filter.id,
      make: 'Toyota',
      model: 'Auris',
      source: 'SUPPLIER',
      feedName: FEED,
      fetchedAt: new Date('2026-01-01'),
    },
  });
  const withdrawn = await fetchFeedFitments({
    orgId: org.id,
    userId: owner.id,
    productId: filter.id,
  });
  check('a row the feed no longer sends is taken back', withdrawn.removed, 1);
  check(
    'a part the sample feed does not know gets nothing invented',
    (await fetchFeedFitments({ orgId: org.id, userId: owner.id, productId: own.id })).added,
    0,
  );
  check(
    'the database refuses a feed row with no fetch date',
    (
      await refused(() =>
        prisma.partFitment.create({
          data: { orgId: org.id, productId: own.id, make: 'Ford', feedName: FEED },
        }),
      )
    ).includes('part_fitments_feed_check'),
    true,
  );

  const partPage = await get(`/parts/${filter.id}`, ownerCookie);
  check(
    'the part page offers the fetch and says where each row came from',
    [
      partPage.body.includes('Fetch from Sample catalogue'),
      partPage.body.includes('Sample catalogue, fetched'),
    ],
    [true, true],
  );
  const partAr = await get(`/parts/${filter.id}`, `${ownerCookie}; carnet_lang=ar`);
  check('in Arabic', partAr.body.includes('جلب من الكتالوج التجريبي'), true);

  await prisma.partFitment.deleteMany({ where: { orgId: org.id, feedName: FEED } });

  /* --- Payroll ----------------------------------------------------------------- */

  console.info('\n  Payroll\n');

  const employee = await prisma.employee.findFirstOrThrow({
    where: { orgId: org.id, isActive: true, payRates: { some: {} } },
    orderBy: { reference: 'asc' },
    select: { id: true, reference: true, displayName: true },
  });
  const periodStart = new Date('2031-03-03T00:00:00.000Z');
  const periodEnd = new Date('2031-03-09T23:59:59.999Z');
  await prisma.payrollRun.deleteMany({ where: { orgId: org.id, periodStart } });
  await prisma.timesheet.deleteMany({ where: { employeeId: employee.id, periodStart } });

  const before = await payrollSettings(org.id);
  const range = { from: new Date('2026-09-01'), to: new Date('2026-09-14T23:59:59Z') };
  await savePayrollSettings({
    orgId: org.id,
    userId: owner.id,
    overtimeMultiplier: 2,
    exportFormat: 'elements',
  });
  const atTwo = await draftTimesheet(org.id, employee.id, range);
  const atTwoExplicit = await draftTimesheet(org.id, employee.id, range, 2);
  check(
    'overtime is paid at the workshop’s own multiplier',
    atTwo.totals.overtimePay.minor,
    atTwoExplicit.totals.overtimePay.minor,
  );
  check(
    'and a multiplier outside plain to triple time is refused',
    (
      await refused(() =>
        savePayrollSettings({
          orgId: org.id,
          userId: owner.id,
          overtimeMultiplier: 5,
          exportFormat: 'standard',
        }),
      )
    ).includes('between 1 and 3'),
    true,
  );

  const sheet = await prisma.timesheet.create({
    data: {
      orgId: org.id,
      employeeId: employee.id,
      periodStart,
      periodEnd,
      status: 'SUBMITTED',
      ordinaryMinutes: 2400,
      overtimeMinutes: 90,
      ordinaryPay: 800,
      overtimePay: 60,
      gross: 860,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  check(
    'an adjustment with no reason is refused',
    (
      await refused(() =>
        addPayAdjustment({
          orgId: org.id,
          userId: owner.id,
          timesheetId: sheet.id,
          kind: 'BONUS',
          label: ' ',
          amount: 50,
        }),
      )
    ).includes('what it is for'),
    true,
  );
  await addPayAdjustment({
    orgId: org.id,
    userId: owner.id,
    timesheetId: sheet.id,
    kind: 'BONUS',
    label: 'Quarter target met',
    amount: 150,
  });
  await addPayAdjustment({
    orgId: org.id,
    userId: owner.id,
    timesheetId: sheet.id,
    kind: 'DEDUCTION',
    label: 'Advance repaid',
    amount: 40,
  });

  const payrollPage = await get('/payroll', ownerCookie);
  check(
    'the payroll page lists the sheet’s bonus and deduction and the settings',
    [
      payrollPage.body.includes('Bonuses and deductions'),
      payrollPage.body.includes('Quarter target met'),
      payrollPage.body.includes('Overtime multiplier'),
    ],
    [true, true, true],
  );

  await approveTimesheet({ orgId: org.id, userId: owner.id, timesheetId: sheet.id });
  const runId = await runPayroll({ orgId: org.id, userId: owner.id, periodStart, periodEnd });
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
  const others = await prisma.timesheet.aggregate({
    where: { payrollRunId: runId, id: { not: sheet.id } },
    _sum: { gross: true },
  });
  check(
    'the run posts gross with the bonus in and the deduction out of it',
    Number(run.gross) - Number(others._sum.gross ?? 0),
    1010,
  );

  const summary = await get(`/api/reports/payroll?run=${runId}&format=standard`, ownerCookie);
  check(
    'the pay summary carries gross and pay after deductions',
    [
      summary.status,
      summary.body.includes('Pay after deductions, before tax'),
      summary.body.includes('1010.00'),
      summary.body.includes('970.00'),
    ],
    [200, true, true, true],
  );
  const hours = await get(`/api/reports/payroll?run=${runId}&format=hours`, ownerCookie);
  check(
    'hours only has no rates and says so in its name',
    [hours.status, hours.body.includes('800.00'), hours.disposition.includes('hours')],
    [200, false, true],
  );
  const elements = await get(`/api/reports/payroll?run=${runId}`, ownerCookie);
  check(
    'the workshop’s own format is the default: one line per element, deductions negative',
    [
      elements.status,
      elements.body.includes('Element code'),
      elements.body.includes('BONUS'),
      elements.body.includes(',-40'),
    ],
    [200, true, true, true],
  );
  check(
    'a format nobody named is refused',
    (await get(`/api/reports/payroll?run=${runId}&format=sage`, ownerCookie)).status,
    400,
  );
  check(
    'and a technician cannot download the file',
    (await get(`/api/reports/payroll?run=${runId}&format=standard`, techCookie)).status === 200,
    false,
  );

  check(
    'once handed over the sheet refuses another adjustment',
    (
      await refused(() =>
        addPayAdjustment({
          orgId: org.id,
          userId: owner.id,
          timesheetId: sheet.id,
          kind: 'BONUS',
          label: 'Late bonus',
          amount: 10,
        }),
      )
    ).includes('next period'),
    true,
  );
  check(
    'and so does the database',
    (
      await refused(() =>
        prisma.payAdjustment.create({
          data: {
            orgId: org.id,
            timesheetId: sheet.id,
            kind: 'BONUS',
            label: 'Around the product',
            amount: 10,
          },
        }),
      )
    ).includes('handed to payroll'),
    true,
  );

  await prisma.payrollRun.delete({ where: { id: runId } });
  await prisma.timesheet.delete({ where: { id: sheet.id } });
  await savePayrollSettings({
    orgId: org.id,
    userId: owner.id,
    overtimeMultiplier: before.overtimeMultiplier,
    exportFormat: before.exportFormat,
  });

  /* --- Public reviews ---------------------------------------------------------- */

  console.info('\n  Public reviews\n');

  const originalPlace = org.googlePlaceId;
  await prisma.organization.update({ where: { id: org.id }, data: { googlePlaceId: null } });

  const jobs = await prisma.job.findMany({
    where: { orgId: org.id, reviewRequest: null },
    take: 2,
    select: { id: true, customerId: true },
  });
  const [pleased, unhappy] = jobs;
  if (!pleased || !unhappy) throw new Error('Two jobs without a review request are needed.');

  const pleasedToken = randomBytes(24).toString('base64url');
  const unhappyToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  const pleasedRequest = await prisma.reviewRequest.create({
    data: {
      orgId: org.id,
      jobId: pleased.id,
      customerId: pleased.customerId,
      tokenHash: createHash('sha256').update(pleasedToken).digest('hex'),
      expiresAt,
      rating: 5,
      respondedAt: new Date(),
      routing: 'PUBLIC_INVITE',
    },
  });
  const unhappyRequest = await prisma.reviewRequest.create({
    data: {
      orgId: org.id,
      jobId: unhappy.id,
      customerId: unhappy.customerId,
      tokenHash: createHash('sha256').update(unhappyToken).digest('hex'),
      expiresAt,
      rating: 3,
      respondedAt: new Date(),
      routing: 'PRIVATE_CONVERSATION',
    },
  });

  const notSetUp = await get(`/r/${pleasedToken}`);
  check(
    'before a listing is named a five is thanked and nothing more',
    [notSetUp.status, notSetUp.body.includes('/public"')],
    [200, false],
  );
  check(
    'and the redirect goes back to the page',
    (await get(`/r/${pleasedToken}/public`)).location.endsWith(`/r/${pleasedToken}`),
    true,
  );

  check(
    'a listing that is not a place ID is refused',
    (
      await refused(() =>
        setGooglePlaceId({ orgId: org.id, userId: owner.id, value: 'Hillside Motors, Leeds' }),
      )
    ).includes('not a Google place ID'),
    true,
  );
  check(
    'and the database refuses one too',
    (
      await refused(() =>
        prisma.organization.update({
          where: { id: org.id },
          data: { googlePlaceId: 'not a place id' },
        }),
      )
    ).includes('organizations_google_place_id_check'),
    true,
  );
  check(
    'a write-review link is read for its place ID',
    await setGooglePlaceId({
      orgId: org.id,
      userId: owner.id,
      value: `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    }),
    PLACE_ID,
  );

  const invited = await get(`/r/${pleasedToken}`);
  check(
    'a five is offered the button',
    [
      invited.body.includes(`/r/${pleasedToken}/public`),
      invited.body.includes('Write a review on Google'),
    ],
    [true, true],
  );
  const invitedAr = await get(`/r/${pleasedToken}`, 'carnet_lang=ar');
  check('in Arabic', invitedAr.body.includes('اكتب تقييمًا على Google'), true);

  const went = await get(`/r/${pleasedToken}/public`);
  check(
    'following it lands on Google’s write-review box',
    [went.status, went.location],
    [303, `https://search.google.com/local/writereview?placeid=${PLACE_ID}`],
  );
  check(
    'and the visit is counted',
    (await prisma.reviewRequest.findUniqueOrThrow({ where: { id: pleasedRequest.id } }))
      .publicOpenedAt !== null,
    true,
  );

  const sentBack = await get(`/r/${unhappyToken}/public`);
  check(
    'a three is never sent to the public site',
    [
      sentBack.location.endsWith(`/r/${unhappyToken}`),
      (await get(`/r/${unhappyToken}`)).body.includes('/public"'),
    ],
    [true, false],
  );
  check(
    'nor counted',
    (await prisma.reviewRequest.findUniqueOrThrow({ where: { id: unhappyRequest.id } }))
      .publicOpenedAt,
    null,
  );

  const reputationPage = await get('/reputation', ownerCookie);
  check(
    'the reputation page names the listing and counts who went',
    [
      reputationPage.body.includes('Public reviews'),
      reputationPage.body.includes(PLACE_ID),
      reputationPage.body.includes('invited went to write one'),
    ],
    [true, true, true],
  );

  await prisma.reviewRequest.deleteMany({
    where: { id: { in: [pleasedRequest.id, unhappyRequest.id] } },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { googlePlaceId: originalPlace },
  });

  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
