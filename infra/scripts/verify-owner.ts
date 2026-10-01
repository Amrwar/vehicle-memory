/**
 * The owner's day, sharpened, against a real database. Phase 40.
 *
 *   npx tsx infra/scripts/verify-owner.ts [baseUrl]
 *
 * A job is recorded as earlier work on the same car coming back: offered
 * when the car is back within thirty days, refused without a reason, on
 * another car, or from another workshop, and refused by the database too.
 * The comeback rate counts it against the technician who did the work, and
 * taking it off takes it out. A rating moves the reputation trend for the
 * site and the person. Two suppliers of one part are laid side by side: the
 * cheaper marked cheapest, the quicker and more reliable marked so, and the
 * slower one's year reads as getting slower. With a server on the base URL
 * the job, part, supplier, report, reputation and dashboard pages are read,
 * the dashboard in French too, and an order opened from a part arrives with
 * the part, quantity and cost filled in.
 *
 * Runs against the seeded organisations. Cleans up after itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import {
  clearComeback,
  ComebackError,
  comebackFor,
  comebackPicture,
  markComeback,
  ownerDay,
  reputationTrend,
  supplierOptionsFor,
  supplierOverTime,
} from '../../apps/web/src/lib/owner';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify owner probe';
const DAY = 86_400_000;

let failures = 0;

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

async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof ComebackError ? error.code : `other: ${String(error).slice(0, 80)}`;
  }
}

async function main() {
  console.info(`\n  The owner's day\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const other = await prisma.organization.findFirstOrThrow({
    where: { slug: 'kirkstall-autocentre' },
  });
  await forget(org.id);

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    select: { id: true },
  });
  const technician = await prisma.user.findUniqueOrThrow({
    where: { email: 'john@hillsidemotors.test' },
    select: { id: true, name: true },
  });

  /* --- comebacks ------------------------------------------------------ */

  console.info('\n  Comebacks\n');

  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { number: 'asc' },
    select: { customerId: true, vehicleId: true },
  });

  const rateBefore = await comebackPicture(org.id);
  const johnBefore = rateBefore.byPerson.find((row) => row.id === technician.id)?.rate.part ?? 0;

  const original = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: null,
    customerId: seeded.customerId,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });
  await prisma.job.update({
    where: { id: original.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(Date.now() - 10 * DAY),
      createdAt: new Date(Date.now() - 12 * DAY),
    },
  });
  await prisma.jobTechnician.create({
    data: { jobId: original.id, userId: technician.id, isPrimary: true },
  });

  const back = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: null,
    customerId: seeded.customerId,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });
  const originalNumber = (
    await prisma.job.findUniqueOrThrow({ where: { id: original.id }, select: { number: true } })
  ).number;

  const offered = await comebackFor(org.id, back.id);
  check(
    'the car back within 30 days is offered as a comeback',
    offered?.eligible.find((entry) => entry.id === original.id)?.suggested,
    true,
  );

  check(
    'refused without a reason',
    await refusal(() =>
      markComeback({
        orgId: org.id,
        userId: owner.id,
        jobId: back.id,
        originalJobId: original.id,
        reason: ' ',
      }),
    ),
    'NO_REASON',
  );

  const otherCar = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, vehicleId: { not: seeded.vehicleId } },
    select: { id: true },
  });
  check(
    'refused on another car',
    await refusal(() =>
      markComeback({
        orgId: org.id,
        userId: owner.id,
        jobId: back.id,
        originalJobId: otherCar.id,
        reason: 'Same squeal',
      }),
    ),
    'OTHER_VEHICLE',
  );

  // Another workshop's job where it has one, else a job nobody has.
  const theirJob = (await prisma.job.findFirst({
    where: { orgId: other.id },
    select: { id: true },
  })) ?? { id: 'job-in-no-workshop' };
  check(
    "another workshop's job is not found",
    await refusal(() =>
      markComeback({
        orgId: org.id,
        userId: owner.id,
        jobId: back.id,
        originalJobId: theirJob.id,
        reason: 'Same squeal',
      }),
    ),
    'NOT_FINISHED',
  );

  let constraint = false;
  try {
    await prisma.job.update({ where: { id: back.id }, data: { comebackOfJobId: original.id } });
  } catch {
    constraint = true;
  }
  check('the database refuses a comeback with no reason', constraint, true);

  await markComeback({
    orgId: org.id,
    userId: owner.id,
    jobId: back.id,
    originalJobId: original.id,
    reason: 'Same squeal from the front brakes',
  });
  const marked = await comebackFor(org.id, back.id);
  check('recorded, naming the job', marked?.marked?.original.number, originalNumber);
  check(
    'the earlier job says it came back',
    (await comebackFor(org.id, original.id))?.cameBack.map((entry) => entry.id),
    [back.id],
  );

  const rateAfter = await comebackPicture(org.id);
  check('the workshop count went up by one', rateAfter.overall.part - rateBefore.overall.part, 1);
  check(
    'counted against the technician who did the work',
    (rateAfter.byPerson.find((row) => row.id === technician.id)?.rate.part ?? 0) - johnBefore,
    1,
  );
  check(
    'listed with its reason',
    rateAfter.recent.find((entry) => entry.id === back.id)?.comebackReason,
    'Same squeal from the front brakes',
  );
  check('the dashboard counts it', (await ownerDay(org.id)).comebacks.part, rateAfter.overall.part);

  /* --- reputation trend ----------------------------------------------- */

  console.info('\n  Reputation over time\n');

  const trendBefore = await reputationTrend(org.id);
  const johnTrendBefore =
    trendBefore.byPerson.find((row) => row.id === technician.id)?.trend.currentCount ?? 0;
  await prisma.reviewRequest.create({
    data: {
      orgId: org.id,
      jobId: original.id,
      customerId: seeded.customerId,
      tokenHash: createHash('sha256').update(randomBytes(16)).digest('hex'),
      expiresAt: new Date(Date.now() + 14 * DAY),
      rating: 2,
      comment: TAG,
      respondedAt: new Date(),
    },
  });
  const trendAfter = await reputationTrend(org.id);
  check(
    'the answer counts for the workshop this quarter',
    trendAfter.overall.currentCount - trendBefore.overall.currentCount,
    1,
  );
  check(
    'and for the technician on the job',
    (trendAfter.byPerson.find((row) => row.id === technician.id)?.trend.currentCount ?? 0) -
      johnTrendBefore,
    1,
  );
  check('six months are shown', trendAfter.months.length, 6);
  check('the site appears', trendAfter.bySite.length > 0, true);

  /* --- suppliers ------------------------------------------------------ */

  console.info('\n  Suppliers\n');

  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, isActive: true },
    select: { id: true },
  });
  const quick = await prisma.supplier.create({
    data: { orgId: org.id, name: `${TAG} quick` },
    select: { id: true },
  });
  const cheap = await prisma.supplier.create({
    data: { orgId: org.id, name: `${TAG} cheap` },
    select: { id: true },
  });

  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const recent = Math.max(quarterStart.getTime(), now.getTime() - 20 * DAY);
  const longAgo = new Date(now.getFullYear(), (Math.floor(now.getMonth() / 3) - 3) * 3, 10);

  let n = 0;
  async function order(supplierId: string, at: Date, wait: number, cost: number) {
    n += 1;
    const created = await prisma.purchaseOrder.create({
      data: {
        orgId: org.id,
        supplierId,
        number: `VO-${n}-${randomBytes(3).toString('hex')}`,
        status: 'RECEIVED',
        notes: TAG,
        createdAt: at,
        expectedAt: new Date(at.getTime() + 2 * DAY),
        lines: {
          create: [
            { productId: product.id, description: TAG, quantity: 5, received: 5, unitCost: cost },
          ],
        },
        receipts: { create: [{ receivedAt: new Date(at.getTime() + wait * DAY) }] },
      },
      select: { id: true },
    });
    return created.id;
  }

  for (let i = 0; i < 3; i += 1) {
    await order(quick.id, new Date(recent + i * 3_600_000), 1, 10);
    await order(cheap.id, new Date(longAgo.getTime() + i * DAY), 1, 7);
  }
  let cheapRecent = '';
  for (let i = 0; i < 3; i += 1) {
    cheapRecent = await order(cheap.id, new Date(recent + i * 3_600_000), 6, 8);
  }
  await prisma.supplierReturn.create({
    data: {
      orgId: org.id,
      supplierId: cheap.id,
      orderId: cheapRecent,
      number: `VO-R-${randomBytes(3).toString('hex')}`,
      reason: 'DEFECTIVE',
      notes: TAG,
      lines: { create: [{ productId: product.id, description: TAG, quantity: 1, unitCost: 8 }] },
    },
  });

  const options = await supplierOptionsFor(org.id, product.id);
  const quickRow = options.find((row) => row.id === quick.id)!;
  const cheapRow = options.find((row) => row.id === cheap.id)!;
  check('every active supplier is listed', options.length >= 2, true);
  check(
    'the cheaper last time comes first of the two',
    options.indexOf(cheapRow) < options.indexOf(quickRow),
    true,
  );
  check('last cost is the latest order', [cheapRow.lastCost, quickRow.lastCost], [8, 10]);
  check('the cheaper is marked cheapest', cheapRow.cheapest && !quickRow.cheapest, true);
  check('the quicker is marked quickest', quickRow.quickest && !cheapRow.quickest, true);
  check('and most reliable', quickRow.mostReliable && !cheapRow.mostReliable, true);
  check(
    'parts sent back as faulty are measured',
    cheapRow.measures.returnPct !== null && cheapRow.measures.returnPct > 0,
    true,
  );

  const year = await supplierOverTime(org.id, cheap.id);
  check('four quarters', year.periods.length, 4);
  check('the old quarter was quick', year.periods[0]!.measures.leadDays, 1);
  check('this quarter is slow', year.periods[3]!.measures.leadDays, 6);
  check(
    'and it says so',
    year.sentences.some((sentence) => sentence.startsWith('Slower:')),
    true,
  );

  /* --- the screens ---------------------------------------------------- */

  const cookie = await sessionFor(owner.id, org.id);
  try {
    const read = async (path: string, extra = '') =>
      (
        await fetch(`${BASE}${path}`, {
          headers: { cookie: [cookie, extra].filter(Boolean).join('; ') },
          redirect: 'manual',
        })
      ).text();

    const jobPage = await read(`/jobs/${back.id}`);
    check(
      'the job page says where it came back from',
      new RegExp(`job #(<!-- -->)?${originalNumber}<`).test(jobPage),
      true,
    );
    check('with a way to take it off', jobPage.includes('Not a comeback'), true);

    const partPage = await read(`/parts/${product.id}`);
    check(
      'the part page lays suppliers side by side',
      partPage.includes('Who to buy it from'),
      true,
    );
    check('marking the cheapest', partPage.includes('cheapest last time'), true);

    const supplierPage = await read(`/suppliers/${cheap.id}`);
    check('the supplier page shows the year', supplierPage.includes('Over the year'), true);
    check('and that they are slower', supplierPage.includes('Slower:'), true);

    const report = await read('/reports/business?range=quarter');
    check('the business report shows comebacks', report.includes('What came back'), true);

    const reputation = await read('/reputation');
    check('reputation shows how it is moving', reputation.includes('How it is moving'), true);

    const dashboard = await read('/dashboard');
    check(
      'the dashboard has its business and inventory blocks',
      ['The money', 'Owed to you', 'Comebacks', 'Stock value', 'Orders late'].every((s) =>
        dashboard.includes(s),
      ),
      true,
    );
    check('no tile shows a word instead of a figure', dashboard.includes('>Open<'), false);
    const french = await read('/dashboard', 'carnet_lang=fr');
    check('the dashboard in French', french.includes('Véhicules à l’atelier'), true);

    const prefilled = await read(
      `/purchasing/new?supplierId=${cheap.id}&product=${product.id}&qty=4&cost=8`,
    );
    check(
      'an order opened from a part arrives filled in',
      prefilled.includes('value="4"') && prefilled.includes('value="8"'),
      true,
    );
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   the screens: no server at ${BASE} (${String(error)})`);
  }

  /* --- taking it off -------------------------------------------------- */

  await clearComeback({ orgId: org.id, userId: owner.id, jobId: back.id });
  check('taken off', (await comebackFor(org.id, back.id))?.marked, null);
  check(
    'and out of the rate',
    (await comebackPicture(org.id)).overall.part,
    rateBefore.overall.part,
  );
  const trail = await prisma.auditLog.count({
    where: { entityId: back.id, action: { in: ['job.comeback_marked', 'job.comeback_cleared'] } },
  });
  check('both kept in the audit log', trail, 2);

  await forget(org.id);
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  await prisma.job.updateMany({
    where: { id: { in: jobIds } },
    data: { comebackOfJobId: null, comebackReason: null },
  });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  const suppliers = await prisma.supplier.findMany({
    where: { orgId, name: { startsWith: TAG } },
    select: { id: true },
  });
  const supplierIds = suppliers.map((s) => s.id);
  await prisma.supplierReturn.deleteMany({ where: { supplierId: { in: supplierIds } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplierId: { in: supplierIds } } });
  await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
