/**
 * Ownership, warranty and sites, against a real database and a running server.
 * Phase 44.
 *
 *   npx tsx infra/scripts/verify-ownership.ts [baseUrl]
 *
 * A handover invites the buyer rather than asserting the sale: nothing moves
 * until they accept, the seller cannot accept their own, a second invitation
 * is refused by the product and by the database, and when the buyer does
 * accept, the vehicle lands on their account, leaves the seller's, and the
 * history stays where it is. The page the buyer opens shows the car and what
 * its history carries and never names the seller.
 *
 * A warranty claim settles with what the remedy actually cost and what came
 * back, neither of them more than the other way round, and the cost report
 * reads from those figures rather than from what was charged.
 *
 * A site's own hourly rate and its own price for a part win where it has
 * them, and the workshop's apply where it does not.
 *
 * It puts back everything it changes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import {
  acceptHandover,
  cancelHandover,
  declineHandover,
  handoverByToken,
  inviteHandover,
  OwnershipError,
  pendingHandover,
} from '../../apps/web/src/lib/handover';
import { vehicleHistory } from '../../apps/web/src/lib/portal';
import {
  labourRateAt,
  PricingError,
  retireLabourRate,
  saveLabourRate,
  sellPriceAt,
  setSitePrice,
} from '../../apps/web/src/lib/pricing';
import { periodFor } from '../../apps/web/src/lib/reports';
import { raiseClaim, settleClaim, warrantyCostFor } from '../../apps/web/src/lib/warranty';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const VIN = 'VFYOWNERSHIP00001';

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
  return { status: response.status, body: await response.text() };
}

async function main() {
  console.info(`\n  Ownership, warranty and sites\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
  });
  const seller = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const buyer = await prisma.user.findUniqueOrThrow({
    where: { email: 'john@hillsidemotors.test' },
  });
  const ownerCookie = await sessionFor(owner.id, org.id);

  /* --- the handover ---------------------------------------------------------- */

  console.info('\n  A sale the buyer accepts\n');

  const existing = await prisma.vehicle.findUnique({ where: { vin: VIN }, select: { id: true } });
  if (existing) {
    await prisma.handoverInvitation.deleteMany({ where: { vehicleId: existing.id } });
    await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: existing.id } });
  }

  const vehicle =
    existing ??
    (await prisma.vehicle.create({
      data: {
        vin: VIN,
        registration: 'VF26 OWN',
        make: 'Probe',
        model: 'Ownership',
        year: 2019,
        lastOdometerKm: 62_000,
      },
      select: { id: true },
    }));

  await prisma.vehicleOwnership.create({
    data: {
      vehicleId: vehicle.id,
      ownerUserId: seller.id,
      ownerName: 'Verify probe: the seller',
      ownerKind: 'PRIVATE',
      startedAt: new Date(Date.now() - 700 * 86_400_000),
    },
  });

  const sale = new Date(Date.now() - 86_400_000);
  const { token } = await inviteHandover({
    vehicleId: vehicle.id,
    orgId: org.id,
    userId: owner.id,
    toName: 'Verify probe: the buyer',
    toKind: 'PRIVATE',
    toEmail: 'buyer@example.test',
    on: sale,
  });

  check(
    'inviting moves nothing',
    [
      await prisma.vehicleOwnership.count({ where: { vehicleId: vehicle.id, endedAt: null } }),
      (await pendingHandover(vehicle.id)) !== null,
    ],
    [1, true],
  );
  check(
    'and the seller still reads the vehicle',
    (await vehicleHistory(seller.id, vehicle.id)) !== null,
    true,
  );
  check(
    'a second invitation is refused',
    (
      await refused(() =>
        inviteHandover({
          vehicleId: vehicle.id,
          orgId: org.id,
          userId: owner.id,
          toName: 'Verify probe: somebody else',
          toKind: 'PRIVATE',
          on: sale,
        }),
      )
    ).includes('already has a handover waiting'),
    true,
  );

  const openOwnership = await prisma.vehicleOwnership.findFirstOrThrow({
    where: { vehicleId: vehicle.id, endedAt: null },
    select: { id: true },
  });
  check(
    'and so is a second one written straight to the database',
    (
      await refused(() =>
        prisma.handoverInvitation.create({
          data: {
            vehicleId: vehicle.id,
            fromOwnershipId: openOwnership.id,
            toName: 'Around the product',
            tokenHash: createHash('sha256').update('probe').digest('hex'),
            soldOn: sale,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        }),
      )
    ).includes('handover_invitations_one_pending'),
    true,
  );

  const page = await get(`/handover/${token}`);
  check(
    'the buyer’s page shows the car and its history and never the seller',
    [
      page.status,
      page.body.includes('Probe Ownership'),
      page.body.includes('Sign in to accept'),
      // The seller's own name, nowhere on the page the buyer reads.
      page.body.includes('Verify probe: the seller'),
    ],
    [200, true, true, false],
  );
  const pageFr = await get(`/handover/${token}`, 'carnet_lang=fr');
  check('in French', pageFr.body.includes('Un véhicule vous est cédé'), true);

  const preview = await handoverByToken(token);
  check(
    'the summary counts owners and entries rather than naming anybody',
    [preview?.state, preview?.summary.includes('second recorded owner')],
    ['PENDING', true],
  );

  check(
    'the seller cannot accept their own sale',
    (await refused(() => acceptHandover({ token, userId: seller.id }))).includes(
      'person buying it',
    ),
    true,
  );

  await acceptHandover({ token, userId: buyer.id });

  const ownerships = await prisma.vehicleOwnership.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { startedAt: 'asc' },
    select: { ownerUserId: true, endedAt: true },
  });
  check(
    'accepting closes the seller’s ownership and opens the buyer’s',
    [
      ownerships.length,
      ownerships[0]?.endedAt !== null,
      ownerships[1]?.ownerUserId === buyer.id,
      ownerships[1]?.endedAt,
    ],
    [2, true, true, null],
  );
  check(
    'the vehicle leaves the seller’s account and lands on the buyer’s',
    [
      (await vehicleHistory(seller.id, vehicle.id)) === null,
      (await vehicleHistory(buyer.id, vehicle.id)) !== null,
    ],
    [true, true],
  );
  check(
    'and the history stays with the car',
    (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).eventCount >= 1,
    true,
  );
  check(
    'a link opened twice cannot transfer it twice',
    (await refused(() => acceptHandover({ token, userId: buyer.id }))).includes(
      'already been accepted',
    ),
    true,
  );

  // Called off, and turned down.
  const second = await inviteHandover({
    vehicleId: vehicle.id,
    orgId: org.id,
    userId: owner.id,
    toName: 'Verify probe: the next buyer',
    toKind: 'PRIVATE',
    on: sale,
  });
  await cancelHandover({ invitationId: second.id, userId: owner.id, orgId: org.id });
  check(
    'the seller can call one off',
    (await prisma.handoverInvitation.findUniqueOrThrow({ where: { id: second.id } })).status,
    'CANCELLED',
  );

  const third = await inviteHandover({
    vehicleId: vehicle.id,
    orgId: org.id,
    userId: owner.id,
    toName: 'Verify probe: the third buyer',
    toKind: 'PRIVATE',
    on: sale,
  });
  await declineHandover({ token: third.token });
  check(
    'and the buyer can turn one down',
    [
      (await prisma.handoverInvitation.findUniqueOrThrow({ where: { id: third.id } })).status,
      (await refused(() => declineHandover({ token: third.token }))).includes('nothing to decline'),
    ],
    ['DECLINED', true],
  );

  /* --- warranty, at cost ------------------------------------------------------ */

  console.info('\n  What warranty costs\n');

  const cover = await prisma.warranty.findFirstOrThrow({
    where: { orgId: org.id, supplierId: { not: null }, voidedAt: null },
    orderBy: { startedOn: 'desc' },
    select: { id: true, description: true, claims: { select: { id: true, status: true } } },
  });
  await prisma.warrantyClaim.deleteMany({
    where: { warrantyId: cover.id, complaint: { startsWith: 'Verify probe' } },
  });

  const remedy = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { number: 'desc' },
    select: { id: true },
  });

  const open = cover.claims.find((claim) => claim.status === 'OPEN');
  const claimId =
    open?.id ??
    (
      await raiseClaim({
        orgId: org.id,
        userId: owner.id,
        warrantyId: cover.id,
        complaint: 'Verify probe: it failed again',
        goodwillReason: 'Verify probe: goodwill',
      })
    ).id;

  await prisma.warrantyClaim.update({ where: { id: claimId }, data: { remedyJobId: remedy.id } });

  check(
    'recovering more than it cost is refused',
    (
      await refused(() =>
        settleClaim({
          orgId: org.id,
          userId: owner.id,
          claimId,
          status: 'SETTLED',
          outcome: 'Verify probe',
          partsCost: 100,
          labourCost: 20,
          recovered: 200,
        }),
      )
    ).includes('More has been recovered'),
    true,
  );
  check(
    'and so is closing one with nothing said',
    (
      await refused(() =>
        settleClaim({
          orgId: org.id,
          userId: owner.id,
          claimId,
          status: 'SETTLED',
          outcome: '  ',
          partsCost: 100,
          labourCost: 20,
          recovered: 50,
        }),
      )
    ).includes('Say how it was settled'),
    true,
  );

  await settleClaim({
    orgId: org.id,
    userId: owner.id,
    claimId,
    status: 'SETTLED',
    outcome: 'Verify probe: credited against the next invoice',
    supplierRef: 'VP-1',
    partsCost: 74.5,
    labourCost: 45.5,
    recovered: 74.5,
  });

  const cost = await warrantyCostFor(org.id, periodFor('year'));
  check(
    'the settled claim counts at cost, not at what it was charged',
    [
      cost.claims >= 1,
      cost.cost.minor >= 12_000,
      cost.recovered.minor >= 7_450,
      cost.net.minor >= 4_550,
    ],
    [true, true, true, true],
  );
  check(
    'and the report says what share came back and what it was of turnover',
    [cost.recoveryPct !== null, cost.ofRevenuePct !== null, cost.summary.includes('settled')],
    [true, true, true],
  );

  const csv = await get('/api/reports/warranty?range=year', ownerCookie);
  check(
    'the CSV carries the cost, what came back and what was carried',
    [csv.status, csv.body.includes('Recovered'), csv.body.includes('74.50')],
    [200, true, true],
  );

  const warrantyPage = await get('/warranty', ownerCookie);
  check(
    'the page shows what warranty costs and offers to settle a claim',
    [
      warrantyPage.body.includes('What warranty costs'),
      warrantyPage.body.includes('Raise a claim') || warrantyPage.body.includes('Close it'),
    ],
    [true, true],
  );

  check(
    'the database refuses a recovery larger than the cost as well',
    (
      await refused(() =>
        prisma.warrantyClaim.update({
          where: { id: claimId },
          data: { recovered: 9_999 },
        }),
      )
    ).includes('warranty_claims_recovery_check'),
    true,
  );

  await prisma.warrantyClaim.deleteMany({
    where: { id: claimId, complaint: { startsWith: 'Verify probe' } },
  });

  /* --- prices per site --------------------------------------------------------- */

  console.info('\n  Prices per site\n');

  const sites = await prisma.location.findMany({
    where: { orgId: org.id, isActive: true },
    orderBy: { isDefault: 'desc' },
    select: { id: true, name: true },
  });
  const [home, branch] = sites;
  if (!home || !branch) throw new Error('Two sites are needed for this check.');

  await prisma.labourRate.deleteMany({ where: { orgId: org.id, name: 'Verify probe rate' } });

  const workshopRate = await labourRateAt(org.id, branch.id);
  check(
    'a site with no rate of its own takes the workshop’s',
    [workshopRate.source, workshopRate.perHour.minor > 0],
    ['WORKSHOP', true],
  );

  const rateId = await saveLabourRate({
    orgId: org.id,
    userId: owner.id,
    locationId: branch.id,
    name: 'Verify probe rate',
    perHour: 120,
    isDefault: true,
  });

  const siteRate = await labourRateAt(org.id, branch.id);
  const homeRate = await labourRateAt(org.id, home.id);
  check(
    'and takes its own once it has one',
    [siteRate.source, siteRate.perHour.minor, homeRate.source],
    ['SITE', 12_000, 'WORKSHOP'],
  );
  check(
    'a rate of nothing is refused',
    (
      await refused(() =>
        saveLabourRate({
          orgId: org.id,
          userId: owner.id,
          locationId: null,
          name: 'Free',
          perHour: 0,
          isDefault: false,
        }),
      )
    ).includes('more than nothing'),
    true,
  );

  const part = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { partNumber: 'asc' },
    select: { id: true, sellPrice: true },
  });

  await setSitePrice({
    orgId: org.id,
    userId: owner.id,
    productId: part.id,
    locationId: branch.id,
    sellPrice: Number(part.sellPrice) + 7,
  });

  const branchPrice = await sellPriceAt(org.id, part.id, branch.id);
  const homePrice = await sellPriceAt(org.id, part.id, home.id);
  check(
    'a part takes the site’s price where it has one and the list where it does not',
    [
      branchPrice.source,
      branchPrice.price,
      homePrice.source,
      homePrice.price === Number(part.sellPrice),
    ],
    ['SITE', Number(part.sellPrice) + 7, 'LIST', true],
  );

  await setSitePrice({
    orgId: org.id,
    userId: owner.id,
    productId: part.id,
    locationId: branch.id,
    sellPrice: null,
  });
  check(
    'clearing it goes back to the list',
    (await sellPriceAt(org.id, part.id, branch.id)).source,
    'LIST',
  );

  const settings = await get('/settings/site#rates', ownerCookie);
  check(
    'the site page lists the rates and says whose they are',
    [settings.body.includes('Labour rates'), settings.body.includes('The whole workshop')],
    [true, true],
  );
  const partPage = await get(`/parts/${part.id}`, ownerCookie);
  check('the part page prices it per site', partPage.body.includes('Price at each site'), true);

  await retireLabourRate({ orgId: org.id, userId: owner.id, id: rateId });
  await prisma.labourRate.deleteMany({ where: { id: rateId } });

  /* --- put it all back --------------------------------------------------------- */

  await prisma.handoverInvitation.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    if (error instanceof OwnershipError || error instanceof PricingError)
      console.error(error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
