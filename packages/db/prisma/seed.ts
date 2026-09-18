/**
 * Demo data.
 *
 * Not lorem ipsum. This seeds one workshop having a plausible Tuesday, with a
 * BMW whose history spans two garages and three owners, because the point of
 * the product only becomes visible when a vehicle arrives carrying a record
 * somebody else wrote.
 *
 *   npm run db:seed
 */

import 'dotenv/config';

import { createHash } from 'node:crypto';

import {
  ACCOUNT,
  chainEvent,
  type DraftEvent,
  eventsForCompletedJob,
  type JournalEntryDraft,
  money,
  postGoodsReceived,
  postInvoiceIssued,
  postPartsConsumed,
  postPaymentReceived,
  postStockAdjustment,
  STANDARD_CHART,
  toNumber,
} from '@carnet/core';
import bcrypt from 'bcryptjs';

import { prisma } from '../src/client';

const PASSWORD = 'carnet-demo-2026';
/** Opens the seeded public passport at /p/demo-share-token. */
const DEMO_SHARE_TOKEN = 'demo-share-token';

/** The quote link a workshop would text a customer. Opens /e/<token>. */
const DEMO_ESTIMATE_TOKEN = 'demo-estimate-token';
const SALT = process.env.LEDGER_CHAIN_SALT ?? 'dev-ledger-salt-change-me';

const day = (offset: number, hour = 9, minute = 0): Date => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const yearsAgo = (years: number, month = 5, dayOfMonth = 12): Date =>
  new Date(new Date().getFullYear() - years, month, dayOfMonth);

async function main() {
  console.info('Seeding Carnet demo data...');

  // TRUNCATE rather than deleteMany. The append-only trigger on
  // vehicle_events refuses DELETE, by design, so a second seed run would fail
  // against a populated database. TRUNCATE does not fire row-level triggers,
  // and CASCADE reaches every dependent table from these three roots.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "organizations", "vehicles", "users",
      "recalls", "login_attempts", "outbox_events"
    RESTART IDENTITY CASCADE
  `);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  /* --- organisation ------------------------------------------------------ */

  const org = await prisma.organization.create({
    data: {
      slug: 'hillside-motors',
      name: 'Hillside Motors',
      legalName: 'Hillside Motors Ltd',
      taxNumber: 'GB412987334',
      email: 'workshop@hillsidemotors.test',
      phone: '0161 496 0114',
      // Two sites, so Group. The plan gate is real: on Complete this
      // workshop would correctly be shown the wall on its own group pages.
      plan: 'GROUP',
      locations: {
        create: {
          name: 'Hillside Road',
          code: 'HR1',
          addressLine1: '42 Hillside Road',
          locality: 'Stockport',
          region: 'Greater Manchester',
          postcode: 'SK4 2NP',
          isDefault: true,
          dailyCapacityHours: 32,
          bays: {
            create: [
              { name: 'Bay 1 — Lift', code: 'B1', sortOrder: 1, capability: 'two-post lift' },
              { name: 'Bay 2 — Lift', code: 'B2', sortOrder: 2, capability: 'four-post lift' },
              { name: 'Bay 3 — Tyres', code: 'B3', sortOrder: 3, capability: 'tyre machine' },
              { name: 'Bay 4 — Diagnostics', code: 'B4', sortOrder: 4, capability: 'scan tool' },
            ],
          },
        },
      },
      taxRates: {
        create: [
          { name: 'VAT 20%', rate: 20, isDefault: true },
          { name: 'Zero rated', rate: 0 },
        ],
      },
      jobTypes: {
        create: [
          { name: 'Major Service', colour: '#1f6167', requiresQualityCheck: true, defaultHours: 3 },
          { name: 'Interim Service', colour: '#2f7a80', defaultHours: 1.5 },
          {
            name: 'Brake repair',
            colour: '#973030',
            requiresQualityCheck: true,
            defaultHours: 3.5,
          },
          { name: 'Diagnostics', colour: '#9a6d24', defaultHours: 1 },
          { name: 'Tyres', colour: '#1f5f8b', defaultHours: 1 },
          { name: 'MOT preparation', colour: '#2c6e4b', defaultHours: 1 },
        ],
      },
      sequences: {
        create: [
          { kind: 'JOB', next: 10_483 },
          { kind: 'INVOICE', prefix: 'INV-', next: 1043 },
          { kind: 'ESTIMATE', prefix: 'EST-', next: 512 },
        ],
      },
      serviceItems: {
        create: [
          { code: 'SVC-MAJ', name: 'Major service', defaultHours: 3, defaultPrice: 285 },
          { code: 'SVC-INT', name: 'Interim service', defaultHours: 1.5, defaultPrice: 145 },
          {
            code: 'BRK-FRT',
            name: 'Front brake pads and discs',
            defaultHours: 2.5,
            defaultPrice: 320,
          },
          { code: 'DIAG-1H', name: 'Diagnostic investigation', defaultHours: 1, defaultPrice: 95 },
        ],
      },
    },
    include: { locations: { include: { bays: true } }, taxRates: true, jobTypes: true },
  });

  const location = org.locations[0]!;
  const bays = location.bays;
  const vat = org.taxRates.find((rate) => rate.isDefault)!;
  const jobTypeByName = new Map(org.jobTypes.map((type) => [type.name, type]));

  /* --- people ------------------------------------------------------------ */

  const [ahmed, sara, john, mike, fatima, maria, david] = await Promise.all(
    [
      {
        email: 'ahmed@hillsidemotors.test',
        name: 'Ahmed Bakri',
        role: 'OWNER' as const,
        cost: null,
      },
      {
        email: 'sara@hillsidemotors.test',
        name: 'Sara Whitfield',
        role: 'SERVICE_ADVISOR' as const,
        cost: null,
      },
      {
        email: 'john@hillsidemotors.test',
        name: 'John Adeyemi',
        role: 'TECHNICIAN' as const,
        cost: 38,
      },
      {
        email: 'mike@hillsidemotors.test',
        name: 'Mike Sowande',
        role: 'TECHNICIAN' as const,
        cost: 34,
      },
      {
        email: 'fatima@hillsidemotors.test',
        name: 'Fatima Rahal',
        role: 'BOOKKEEPER' as const,
        cost: null,
      },
    ].map((person) =>
      prisma.user.create({
        data: {
          email: person.email,
          name: person.name,
          passwordHash,
          emailVerifiedAt: new Date(),
          memberships: {
            create: {
              orgId: org.id,
              role: person.role,
              locationId: location.id,
              costRate: person.cost,
            },
          },
        },
      }),
    ),
  ).then(async (staff) => {
    // Portal identities: customers, not staff. No organisation membership.
    const portalUsers = await Promise.all(
      [
        { email: 'maria@example.test', name: 'Maria Okonkwo' },
        { email: 'david@example.test', name: 'David Lindqvist' },
      ].map((person) =>
        prisma.user.create({
          data: { ...person, passwordHash, emailVerifiedAt: new Date() },
        }),
      ),
    );
    return [...staff, ...portalUsers] as const;
  });

  /* --- vehicles (global, not tenant-scoped) ------------------------------ */

  const bmw = await prisma.vehicle.create({
    data: {
      vin: 'WBAJA9C509G000000',
      registration: 'MK20 XRT',
      make: 'BMW',
      model: 'X5',
      variant: 'xDrive30d M Sport',
      year: 2020,
      engineCode: 'B57D30A',
      engineCapacityCc: 2993,
      fuelType: 'DIESEL',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      driveType: 'AWD',
      colour: 'Carbon Black',
      seats: 5,
      firstRegisteredAt: yearsAgo(6, 2, 3),
      registrationExpiresAt: day(120),
    },
  });

  const civic = await prisma.vehicle.create({
    data: {
      vin: '2HGFC2F59MH500000',
      registration: 'LR21 KJD',
      make: 'Honda',
      model: 'Civic',
      variant: '1.0 VTEC Turbo SR',
      year: 2021,
      engineCode: 'P10A2',
      engineCapacityCc: 988,
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      bodyType: 'Hatchback',
      colour: 'Rallye Red',
      firstRegisteredAt: yearsAgo(5, 8, 21),
    },
  });

  const corolla = await prisma.vehicle.create({
    data: {
      vin: 'SB1KW56E70E000000',
      registration: 'YB18 TVC',
      make: 'Toyota',
      model: 'Corolla',
      variant: '1.8 VVT-i Hybrid Design',
      year: 2018,
      engineCode: '2ZR-FXE',
      fuelType: 'HYBRID',
      transmission: 'CVT',
      bodyType: 'Estate',
      colour: 'Silver',
      firstRegisteredAt: yearsAgo(8, 3, 9),
    },
  });

  const transit = await prisma.vehicle.create({
    data: {
      vin: 'WF0XXXTTGXKA00000',
      registration: 'BV19 FLM',
      make: 'Ford',
      model: 'Transit Custom',
      variant: '2.0 EcoBlue 300 Limited',
      year: 2019,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
      bodyType: 'Panel van',
      colour: 'White',
      firstRegisteredAt: yearsAgo(7, 0, 15),
    },
  });

  /* --- ownership: the BMW has had three owners --------------------------- */

  await prisma.vehicleOwnership.createMany({
    data: [
      {
        vehicleId: bmw.id,
        ownerName: 'Northgate Leasing Ltd',
        ownerKind: 'FLEET',
        startedAt: yearsAgo(6, 2, 3),
        endedAt: yearsAgo(3, 4, 18),
      },
      {
        vehicleId: bmw.id,
        ownerName: 'Peter Vasquez',
        ownerKind: 'PRIVATE',
        startedAt: yearsAgo(3, 4, 18),
        endedAt: yearsAgo(1, 6, 2),
      },
      {
        vehicleId: bmw.id,
        ownerUserId: maria!.id,
        ownerName: 'Maria Okonkwo',
        ownerKind: 'PRIVATE',
        startedAt: yearsAgo(1, 6, 2),
      },
      {
        vehicleId: civic.id,
        ownerUserId: maria!.id,
        ownerName: 'Maria Okonkwo',
        ownerKind: 'PRIVATE',
        startedAt: yearsAgo(4, 1, 8),
      },
      {
        vehicleId: corolla.id,
        ownerName: 'Ahmed Hassan',
        ownerKind: 'PRIVATE',
        startedAt: yearsAgo(6, 7, 1),
      },
      {
        vehicleId: transit.id,
        ownerName: 'Pennine Plumbing Ltd',
        ownerKind: 'COMPANY',
        startedAt: yearsAgo(7, 0, 15),
      },
    ],
  });

  /* --- recall ------------------------------------------------------------ */

  const recall = await prisma.recall.create({
    data: {
      campaignRef: 'BMW-0072340100',
      manufacturer: 'BMW',
      title: 'EGR cooler coolant leak — fire risk',
      description:
        'A coolant leak in the exhaust gas recirculation cooler may, in rare cases, lead to smouldering of deposits in the intake manifold.',
      severity: 'SAFETY',
      issuedAt: yearsAgo(2, 9, 4),
    },
  });

  await prisma.vehicleRecall.create({
    data: { vehicleId: bmw.id, recallId: recall.id, status: 'OPEN' },
  });

  /* --- customers --------------------------------------------------------- */

  const mariaCustomer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: 'Maria Okonkwo',
      firstName: 'Maria',
      lastName: 'Okonkwo',
      email: 'maria@example.test',
      mobile: '07700 900318',
      addressLine1: '18 Ladybarn Lane',
      locality: 'Stockport',
      region: 'Greater Manchester',
      postcode: 'SK4 3BB',
      sourceOfBusiness: 'Recommendation',
      marketingEmailConsent: true,
      portalUserId: maria!.id,
    },
  });

  const ahmedCustomer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: 'Ahmed Hassan',
      firstName: 'Ahmed',
      lastName: 'Hassan',
      email: 'ahmed.hassan@example.test',
      mobile: '07700 900142',
      locality: 'Stockport',
      postcode: 'SK2 6PT',
      sourceOfBusiness: 'Google',
      marketingSmsConsent: true,
    },
  });

  const pennine = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'COMPANY',
      displayName: 'Pennine Plumbing Ltd',
      companyName: 'Pennine Plumbing Ltd',
      taxNumber: 'GB338201774',
      email: 'accounts@pennineplumbing.test',
      phone: '0161 496 5522',
      sourceOfBusiness: 'Fleet contract',
    },
  });

  /* --- inspection template ------------------------------------------------ */

  const template = await prisma.inspectionTemplate.create({
    data: {
      orgId: org.id,
      name: 'Standard 30-point inspection',
      description: 'Carried out on every vehicle received.',
      isDefault: true,
      sections: {
        create: [
          {
            name: 'Exterior',
            sortOrder: 1,
            items: {
              create: [
                { name: 'Bodywork condition', sortOrder: 1 },
                { name: 'Lights and indicators', sortOrder: 2 },
                { name: 'Windscreen and wipers', sortOrder: 3 },
                { name: 'Mirrors', sortOrder: 4 },
              ],
            },
          },
          {
            name: 'Tyres',
            sortOrder: 2,
            items: {
              create: [
                {
                  name: 'Front left tread',
                  measurementType: 'TREAD_DEPTH_MM',
                  position: 'FRONT_LEFT',
                  sortOrder: 1,
                },
                {
                  name: 'Front right tread',
                  measurementType: 'TREAD_DEPTH_MM',
                  position: 'FRONT_RIGHT',
                  sortOrder: 2,
                },
                {
                  name: 'Rear left tread',
                  measurementType: 'TREAD_DEPTH_MM',
                  position: 'REAR_LEFT',
                  sortOrder: 3,
                },
                {
                  name: 'Rear right tread',
                  measurementType: 'TREAD_DEPTH_MM',
                  position: 'REAR_RIGHT',
                  sortOrder: 4,
                },
              ],
            },
          },
          {
            name: 'Brakes',
            sortOrder: 3,
            items: {
              create: [
                { name: 'Front pads', measurementType: 'PAD_THICKNESS_MM', sortOrder: 1 },
                { name: 'Front discs', measurementType: 'DISC_THICKNESS_MM', sortOrder: 2 },
                { name: 'Rear pads', measurementType: 'PAD_THICKNESS_MM', sortOrder: 3 },
                { name: 'Handbrake operation', sortOrder: 4 },
                { name: 'Brake fluid condition', sortOrder: 5 },
              ],
            },
          },
          {
            name: 'Under bonnet',
            sortOrder: 4,
            items: {
              create: [
                { name: 'Engine oil level and condition', sortOrder: 1 },
                { name: 'Coolant level', sortOrder: 2 },
                { name: 'Battery condition', measurementType: 'VOLTAGE', sortOrder: 3 },
                { name: 'Auxiliary belt', sortOrder: 4 },
                { name: 'Visible leaks', sortOrder: 5 },
              ],
            },
          },
        ],
      },
    },
  });

  /* --- passport history written by a previous workshop ------------------- */

  // The BMW arrives with three years of history from a garage in Leeds. This
  // is the moment the product demonstrates itself.
  const priorWorkshop = await prisma.organization.create({
    data: {
      slug: 'kirkstall-autocentre',
      name: 'Kirkstall Autocentre',
      email: 'hello@kirkstall.test',
      plan: 'CORE',
    },
  });

  const priorEvents: Omit<DraftEvent, 'vehicleId'>[] = [
    {
      type: 'SERVICE',
      occurredAt: yearsAgo(4, 3, 14),
      title: 'Major service',
      summary: 'Oil, oil filter, air filter, cabin filter, fuel filter. Brake fluid renewed.',
      verification: 'WORKSHOP_VERIFIED',
      odometerKm: 41_220,
      recordedByOrgId: priorWorkshop.id,
      supersedesId: null,
      idempotencyKey: 'legacy:kirkstall:1',
      payload: { workshop: 'Kirkstall Autocentre', totalHours: 3.2 },
    },
    {
      type: 'PART_FITTED',
      occurredAt: yearsAgo(4, 3, 14),
      title: 'Timing chain tensioner replaced',
      summary: 'Part number 11318571022',
      verification: 'WORKSHOP_VERIFIED',
      odometerKm: 41_220,
      recordedByOrgId: priorWorkshop.id,
      supersedesId: null,
      idempotencyKey: 'legacy:kirkstall:2',
      payload: { partNumber: '11318571022', quantity: 1 },
    },
    {
      type: 'ACCIDENT',
      occurredAt: yearsAgo(3, 10, 2),
      title: 'Rear quarter panel damage repaired',
      summary: 'Low-speed impact. Panel replaced and repainted. Insurer assessed, not written off.',
      verification: 'WORKSHOP_VERIFIED',
      odometerKm: 58_940,
      recordedByOrgId: priorWorkshop.id,
      supersedesId: null,
      idempotencyKey: 'legacy:kirkstall:3',
      payload: { severity: 'minor', writeOff: false, insurerAssessed: true },
    },
    {
      type: 'SERVICE',
      occurredAt: yearsAgo(2, 4, 27),
      title: 'Interim service',
      summary: 'Oil and filter. Advisory noted on front discs.',
      verification: 'WORKSHOP_RECORDED',
      odometerKm: 67_410,
      recordedByOrgId: priorWorkshop.id,
      supersedesId: null,
      idempotencyKey: 'legacy:kirkstall:4',
      payload: { workshop: 'Kirkstall Autocentre', totalHours: 1.4 },
    },
    {
      type: 'RECALL_NOTICE',
      occurredAt: yearsAgo(2, 9, 4),
      title: 'Safety recall issued: EGR cooler',
      summary: 'Campaign BMW-0072340100. Not yet carried out.',
      verification: 'AUTHORITY',
      odometerKm: null,
      recordedByOrgId: null,
      supersedesId: null,
      idempotencyKey: 'legacy:recall:1',
      payload: { campaignRef: 'BMW-0072340100' },
    },
    {
      type: 'OWNERSHIP_TRANSFER',
      occurredAt: yearsAgo(1, 6, 2),
      title: 'Ownership transferred',
      summary: 'From Peter Vasquez to Maria Okonkwo',
      verification: 'SELF_REPORTED',
      odometerKm: 74_800,
      recordedByOrgId: null,
      supersedesId: null,
      idempotencyKey: 'legacy:transfer:1',
      payload: { from: 'Peter Vasquez', to: 'Maria Okonkwo' },
    },
    {
      type: 'TIRE',
      occurredAt: yearsAgo(1, 2, 19),
      title: 'Two front tyres replaced',
      summary: 'Michelin Pilot Sport 4 SUV 265/50 R19',
      verification: 'WORKSHOP_RECORDED',
      odometerKm: 78_150,
      recordedByOrgId: priorWorkshop.id,
      supersedesId: null,
      idempotencyKey: 'legacy:kirkstall:5',
      payload: { brand: 'Michelin', size: '265/50 R19', positions: ['FRONT_LEFT', 'FRONT_RIGHT'] },
    },
  ];

  await appendChain(bmw.id, priorEvents);

  // Odometer history, and the shape that makes the product's case.
  //
  // The readings go 67,410 then 62,000 then 74,800: up, down, up. Every
  // adjacent pair at the end of the history is consistent, so a single
  // workshop looking at its own last two readings sees nothing wrong. The
  // rollback is only visible to somebody holding the whole sequence, which is
  // the entire argument for the record belonging to the vehicle rather than
  // to a garage.
  //
  // Each reading is attributed to whoever took it, because "checked across
  // every workshop" is only true if the readings know where they came from.
  await prisma.odometerReading.createMany({
    data: [
      {
        vehicleId: bmw.id,
        km: 41_220,
        readAt: yearsAgo(4, 3, 14),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: priorWorkshop.id,
      },
      {
        vehicleId: bmw.id,
        km: 58_940,
        readAt: yearsAgo(3, 10, 2),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: priorWorkshop.id,
      },
      {
        vehicleId: bmw.id,
        km: 67_410,
        readAt: yearsAgo(2, 4, 27),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: priorWorkshop.id,
      },
      {
        vehicleId: bmw.id,
        km: 62_000,
        readAt: yearsAgo(2, 1, 9),
        source: 'OWNER',
        anomaly: 'DECREASE',
        recordedByOrgId: null,
      },
      {
        vehicleId: bmw.id,
        km: 74_800,
        readAt: yearsAgo(1, 6, 2),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: priorWorkshop.id,
      },
      {
        vehicleId: bmw.id,
        km: 78_150,
        readAt: yearsAgo(1, 2, 19),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: priorWorkshop.id,
      },
      {
        vehicleId: bmw.id,
        km: 82_430,
        readAt: day(-1),
        source: 'WORKSHOP',
        anomaly: 'NONE',
        recordedByOrgId: org.id,
      },
    ],
  });

  await prisma.vehicle.update({
    where: { id: bmw.id },
    data: { lastOdometerKm: 82_430, lastOdometerAt: day(-1) },
  });

  await prisma.serviceSchedule.create({
    data: {
      vehicleId: bmw.id,
      orgId: org.id,
      name: 'Manufacturer service interval',
      intervalMonths: 12,
      intervalKm: 16_000,
      lastPerformedAt: yearsAgo(1, 2, 19),
      lastPerformedKm: 78_150,
      dueKm: 94_150,
    },
  });

  /* --- access grants ------------------------------------------------------ */

  await prisma.vehicleAccessGrant.createMany({
    data: [
      { vehicleId: bmw.id, orgId: org.id, scope: 'WRITE', reason: 'SERVICED' },
      { vehicleId: bmw.id, orgId: priorWorkshop.id, scope: 'READ', reason: 'SERVICED' },
      { vehicleId: civic.id, orgId: org.id, scope: 'WRITE', reason: 'SERVICED' },
      { vehicleId: corolla.id, orgId: org.id, scope: 'WRITE', reason: 'SERVICED' },
      { vehicleId: transit.id, orgId: org.id, scope: 'WRITE', reason: 'SERVICED' },
    ],
  });

  /* --- the live job: brake repair awaiting approval ---------------------- */

  const brakeJob = await prisma.job.create({
    data: {
      orgId: org.id,
      locationId: location.id,
      number: 10_482,
      customerId: mariaCustomer.id,
      vehicleId: bmw.id,
      bayId: bays[0]!.id,
      status: 'AWAITING_APPROVAL',
      shortDescription: 'Brake system repair',
      details: 'Customer reports grinding under braking, worse when cold.',
      diagnosis:
        'Front brake pads worn beyond the wear indicator and discs below minimum thickness. Rear pads have life remaining.',
      odometerInKm: 82_430,
      estimatedHours: 4.5,
      receivedAt: day(0, 8, 10),
      promisedAt: day(0, 17, 0),
      createdByUserId: sara!.id,
      technicians: { create: [{ userId: john!.id, isPrimary: true }] },
      jobTypes: { create: [{ jobTypeId: jobTypeByName.get('Brake repair')!.id }] },
      statusEvents: {
        create: [
          { toStatus: 'RECEIVED', actorUserId: sara!.id, createdAt: day(0, 8, 10) },
          {
            fromStatus: 'RECEIVED',
            toStatus: 'INSPECTING',
            actorUserId: john!.id,
            createdAt: day(0, 8, 40),
          },
          {
            fromStatus: 'INSPECTING',
            toStatus: 'DIAGNOSED',
            actorUserId: john!.id,
            createdAt: day(0, 9, 25),
          },
          {
            fromStatus: 'DIAGNOSED',
            toStatus: 'ESTIMATED',
            actorUserId: sara!.id,
            createdAt: day(0, 9, 50),
          },
          {
            fromStatus: 'ESTIMATED',
            toStatus: 'AWAITING_APPROVAL',
            actorUserId: sara!.id,
            note: 'Estimate sent by SMS',
            createdAt: day(0, 10, 42),
          },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Remove front wheels',
            sortOrder: 1,
            isDone: true,
            doneByUserId: john!.id,
            doneAt: day(0, 8, 50),
          },
          {
            title: 'Inspect brakes',
            sortOrder: 2,
            isDone: true,
            doneByUserId: john!.id,
            doneAt: day(0, 9, 10),
          },
          { title: 'Replace front pads', sortOrder: 3 },
          { title: 'Replace front discs', sortOrder: 4 },
          { title: 'Bed in and road test', sortOrder: 5 },
          { title: 'Final inspection', sortOrder: 6 },
        ],
      },
      labourLines: {
        create: [
          {
            description: 'Brake inspection',
            hours: 1.0,
            rate: 95,
            taxRateId: vat.id,
            sortOrder: 1,
          },
          {
            description: 'Front brake pad and disc replacement',
            hours: 3.5,
            rate: 95,
            taxRateId: vat.id,
            sortOrder: 2,
          },
        ],
      },
      partLines: {
        create: [
          {
            description: 'BMW front brake pad set',
            partNumber: '34116794300',
            quantity: 1,
            unitCost: 252,
            unitPrice: 420,
            taxRateId: vat.id,
            status: 'REQUESTED',
            sortOrder: 1,
          },
          {
            description: 'BMW front brake discs (pair)',
            partNumber: '34116864059',
            quantity: 1,
            unitCost: 246,
            unitPrice: 410,
            taxRateId: vat.id,
            status: 'REQUESTED',
            sortOrder: 2,
          },
        ],
      },
      notes: {
        create: [
          {
            authorUserId: john!.id,
            body: 'Discs are heavily lipped and below 26mm. Pads are down to the backing on the outer side.',
            createdAt: day(0, 9, 20),
          },
          {
            authorUserId: sara!.id,
            body: 'Estimate sent by SMS at 10:42. Customer said she would look at lunchtime.',
            isCustomerVisible: false,
            createdAt: day(0, 10, 45),
          },
        ],
      },
      timeEntries: {
        create: [
          {
            userId: john!.id,
            startedAt: day(0, 8, 40),
            endedAt: day(0, 9, 25),
            minutes: 45,
            costRate: 38,
          },
        ],
      },
    },
  });

  const inspection = await prisma.inspection.create({
    data: {
      jobId: brakeJob.id,
      templateId: template.id,
      status: 'COMPLETED',
      performedByUserId: john!.id,
      startedAt: day(0, 8, 40),
      completedAt: day(0, 9, 22),
      passCount: 24,
      advisoryCount: 3,
      criticalCount: 2,
      results: {
        create: [
          {
            sectionName: 'Brakes',
            itemName: 'Front pads',
            severity: 'CRITICAL',
            measurementValue: 1.5,
            measurementType: 'PAD_THICKNESS_MM',
            note: 'Worn to the backing plate on the outer pad.',
            recommendedAction: 'Replace front brake pads',
            estimatedCost: 420,
            sortOrder: 1,
          },
          {
            sectionName: 'Brakes',
            itemName: 'Front discs',
            severity: 'CRITICAL',
            measurementValue: 25.4,
            measurementType: 'DISC_THICKNESS_MM',
            note: 'Below the 26mm minimum. Heavy lipping.',
            recommendedAction: 'Replace front brake discs',
            estimatedCost: 410,
            sortOrder: 2,
          },
          {
            sectionName: 'Tyres',
            itemName: 'Front left tread',
            severity: 'ADVISORY',
            measurementValue: 2.8,
            measurementType: 'TREAD_DEPTH_MM',
            position: 'FRONT_LEFT',
            note: 'Approaching the legal minimum of 1.6mm.',
            recommendedAction: 'Replace front left tyre',
            estimatedCost: 165,
            sortOrder: 3,
          },
          {
            sectionName: 'Under bonnet',
            itemName: 'Battery condition',
            severity: 'ADVISORY',
            measurementValue: 11.9,
            measurementType: 'VOLTAGE',
            note: 'Holds charge but weak under load test.',
            recommendedAction: 'Replace battery',
            estimatedCost: 240,
            sortOrder: 4,
          },
          {
            sectionName: 'Under bonnet',
            itemName: 'Auxiliary belt',
            severity: 'ADVISORY',
            note: 'Light surface cracking. Monitor at next service.',
            sortOrder: 5,
          },
          {
            sectionName: 'Brakes',
            itemName: 'Rear pads',
            severity: 'PASS',
            measurementValue: 7.2,
            measurementType: 'PAD_THICKNESS_MM',
            sortOrder: 6,
          },
          {
            sectionName: 'Tyres',
            itemName: 'Rear left tread',
            severity: 'PASS',
            measurementValue: 5.4,
            measurementType: 'TREAD_DEPTH_MM',
            position: 'REAR_LEFT',
            sortOrder: 7,
          },
          {
            sectionName: 'Tyres',
            itemName: 'Rear right tread',
            severity: 'PASS',
            measurementValue: 5.6,
            measurementType: 'TREAD_DEPTH_MM',
            position: 'REAR_RIGHT',
            sortOrder: 8,
          },
          {
            sectionName: 'Exterior',
            itemName: 'Lights and indicators',
            severity: 'PASS',
            sortOrder: 9,
          },
          {
            sectionName: 'Under bonnet',
            itemName: 'Engine oil level and condition',
            severity: 'PASS',
            sortOrder: 10,
          },
        ],
      },
    },
  });

  const estimate = await prisma.estimate.create({
    data: {
      orgId: org.id,
      jobId: brakeJob.id,
      version: 1,
      status: 'SENT',
      subtotal: 1257.5,
      taxTotal: 251.5,
      total: 1509.0,
      sentAt: day(0, 10, 42),
      validUntil: day(14),
      createdByUserId: sara!.id,
      notes: 'Front brakes only. Tyre and battery quoted separately as advisories.',
      lines: {
        create: [
          {
            kind: 'LABOUR',
            description: 'Brake inspection',
            quantity: 1,
            unitPrice: 95,
            lineTotal: 95,
            taxRateId: vat.id,
            sortOrder: 1,
          },
          {
            kind: 'LABOUR',
            description: 'Front brake pad and disc replacement',
            quantity: 3.5,
            unitPrice: 95,
            lineTotal: 332.5,
            taxRateId: vat.id,
            sortOrder: 2,
          },
          {
            kind: 'PART',
            description: 'BMW front brake pad set',
            quantity: 1,
            unitPrice: 420,
            unitCost: 252,
            lineTotal: 420,
            taxRateId: vat.id,
            sortOrder: 3,
          },
          {
            kind: 'PART',
            description: 'BMW front brake discs (pair)',
            quantity: 1,
            unitPrice: 410,
            unitCost: 246,
            lineTotal: 410,
            taxRateId: vat.id,
            sortOrder: 4,
          },
          {
            kind: 'PART',
            description: 'Front left tyre — Michelin 265/50 R19',
            quantity: 1,
            unitPrice: 165,
            unitCost: 104,
            lineTotal: 165,
            taxRateId: vat.id,
            isOptional: true,
            sortOrder: 5,
          },
          {
            kind: 'PART',
            description: 'Battery — 90Ah AGM',
            quantity: 1,
            unitPrice: 240,
            unitCost: 151,
            lineTotal: 240,
            taxRateId: vat.id,
            isOptional: true,
            sortOrder: 6,
          },
        ],
      },
      shares: {
        create: {
          // Demo share: the hash is of the literal token "demo-estimate-token".
          tokenHash: 'a2f8e0c0f3c1a1d1b9d5b8a1f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f708192a3b',
          channel: 'SMS',
          sentTo: '07700 900318',
          expiresAt: day(14),
        },
      },
    },
  });

  /* --- a completed job, which writes to the passport --------------------- */

  const serviceJob = await prisma.job.create({
    data: {
      orgId: org.id,
      locationId: location.id,
      number: 10_479,
      customerId: ahmedCustomer.id,
      vehicleId: corolla.id,
      bayId: bays[1]!.id,
      status: 'PAID',
      shortDescription: 'Interim service and MOT preparation',
      odometerInKm: 96_310,
      odometerOutKm: 96_318,
      estimatedHours: 2.5,
      receivedAt: day(-6, 8, 30),
      completedAt: day(-6, 15, 10),
      invoicedAt: day(-6, 15, 30),
      createdByUserId: sara!.id,
      technicians: { create: [{ userId: mike!.id, isPrimary: true }] },
      jobTypes: { create: [{ jobTypeId: jobTypeByName.get('Interim Service')!.id }] },
      statusEvents: {
        create: [
          { toStatus: 'RECEIVED', actorUserId: sara!.id, createdAt: day(-6, 8, 30) },
          {
            fromStatus: 'RECEIVED',
            toStatus: 'IN_PROGRESS',
            actorUserId: mike!.id,
            createdAt: day(-6, 9, 0),
          },
          {
            fromStatus: 'IN_PROGRESS',
            toStatus: 'COMPLETED',
            actorUserId: mike!.id,
            createdAt: day(-6, 15, 10),
          },
          {
            fromStatus: 'COMPLETED',
            toStatus: 'INVOICED',
            actorUserId: sara!.id,
            createdAt: day(-6, 15, 30),
          },
          {
            fromStatus: 'INVOICED',
            toStatus: 'PAID',
            actorUserId: sara!.id,
            createdAt: day(-6, 16, 5),
          },
        ],
      },
      labourLines: {
        create: [
          { description: 'Interim service', hours: 1.5, rate: 95, taxRateId: vat.id, sortOrder: 1 },
        ],
      },
      partLines: {
        create: [
          {
            description: 'Engine oil 0W-20, 4.2L',
            partNumber: 'TOY-0W20-5L',
            quantity: 1,
            unitCost: 28,
            unitPrice: 52,
            taxRateId: vat.id,
            status: 'FITTED',
            sortOrder: 1,
          },
          {
            description: 'Oil filter',
            partNumber: '04152-YZZA1',
            quantity: 1,
            unitCost: 8,
            unitPrice: 18,
            taxRateId: vat.id,
            status: 'FITTED',
            sortOrder: 2,
          },
          {
            description: 'Cabin filter',
            partNumber: '87139-0D070',
            quantity: 1,
            unitCost: 11,
            unitPrice: 24,
            taxRateId: vat.id,
            status: 'FITTED',
            sortOrder: 3,
          },
        ],
      },
      timeEntries: {
        create: [
          {
            userId: mike!.id,
            startedAt: day(-6, 9, 0),
            endedAt: day(-6, 11, 12),
            minutes: 132,
            costRate: 34,
          },
        ],
      },
      qualityChecks: {
        create: [{ checkedByUserId: ahmed!.id, passed: true, notes: 'Road tested, no faults.' }],
      },
      invoices: {
        create: {
          orgId: org.id,
          number: 'INV-1042',
          customerId: ahmedCustomer.id,
          status: 'PAID',
          subtotal: 236.5,
          taxTotal: 47.3,
          total: 283.8,
          amountPaid: 283.8,
          issuedAt: day(-6, 15, 30),
          dueAt: day(8),
          lines: {
            create: [
              {
                kind: 'LABOUR',
                description: 'Interim service, 1.5h',
                quantity: 1.5,
                unitPrice: 95,
                lineTotal: 171,
                taxAmount: 28.5,
                taxRateId: vat.id,
                sortOrder: 1,
              },
              {
                kind: 'PART',
                description: 'Engine oil 0W-20',
                quantity: 1,
                unitPrice: 52,
                lineTotal: 62.4,
                taxAmount: 10.4,
                taxRateId: vat.id,
                sortOrder: 2,
              },
              {
                kind: 'PART',
                description: 'Oil filter',
                quantity: 1,
                unitPrice: 18,
                lineTotal: 21.6,
                taxAmount: 3.6,
                taxRateId: vat.id,
                sortOrder: 3,
              },
              {
                kind: 'PART',
                description: 'Cabin filter',
                quantity: 1,
                unitPrice: 24,
                lineTotal: 28.8,
                taxAmount: 4.8,
                taxRateId: vat.id,
                sortOrder: 4,
              },
            ],
          },
        },
      },
    },
    include: { partLines: true, labourLines: true },
  });

  await prisma.payment.create({
    data: {
      orgId: org.id,
      customerId: ahmedCustomer.id,
      invoiceId: (await prisma.invoice.findFirst({ where: { number: 'INV-1042' } }))!.id,
      amount: 283.8,
      method: 'CARD',
      receivedAt: day(-6, 16, 5),
      recordedByUserId: sara!.id,
    },
  });

  // The completed job writes its events to the Corolla's passport.
  await appendChain(
    corolla.id,
    eventsForCompletedJob({
      jobId: serviceJob.id,
      jobNumber: serviceJob.number,
      vehicleId: corolla.id,
      orgId: org.id,
      orgName: org.name,
      completedAt: day(-6, 15, 10),
      shortDescription: serviceJob.shortDescription,
      diagnosis: null,
      odometerKm: 96_318,
      jobTypeNames: ['Interim Service'],
      labour: serviceJob.labourLines.map((line) => ({
        description: line.description,
        hours: Number(line.hours),
      })),
      parts: serviceJob.partLines.map((line) => ({
        id: line.id,
        description: line.description,
        partNumber: line.partNumber,
        quantity: Number(line.quantity),
      })),
      inspection: null,
      hasPhotoEvidence: false,
    }).map(({ vehicleId: _ignored, ...rest }) => rest),
  );

  /* --- bookings for the week --------------------------------------------- */

  await prisma.booking.createMany({
    data: [
      {
        orgId: org.id,
        locationId: location.id,
        customerId: mariaCustomer.id,
        vehicleId: bmw.id,
        bayId: bays[0]!.id,
        technicianId: john!.id,
        status: 'CONVERTED',
        startAt: day(0, 8, 0),
        endAt: day(0, 12, 30),
        estimatedHours: 4.5,
        description: 'Brake system repair',
        source: 'PHONE',
        jobId: brakeJob.id,
      },
      {
        orgId: org.id,
        locationId: location.id,
        customerId: mariaCustomer.id,
        vehicleId: civic.id,
        bayId: bays[1]!.id,
        technicianId: mike!.id,
        status: 'SCHEDULED',
        startAt: day(0, 9, 0),
        endAt: day(0, 10, 30),
        estimatedHours: 1.5,
        description: 'Interim service',
        source: 'PORTAL',
      },
      {
        orgId: org.id,
        locationId: location.id,
        customerId: pennine.id,
        vehicleId: transit.id,
        bayId: bays[3]!.id,
        technicianId: john!.id,
        status: 'SCHEDULED',
        startAt: day(0, 13, 0),
        endAt: day(0, 15, 0),
        estimatedHours: 2,
        description: 'Diagnostics — intermittent EML',
        source: 'PHONE',
      },
      {
        orgId: org.id,
        locationId: location.id,
        customerId: ahmedCustomer.id,
        vehicleId: corolla.id,
        bayId: bays[2]!.id,
        technicianId: mike!.id,
        status: 'SCHEDULED',
        startAt: day(1, 8, 30),
        endAt: day(1, 10, 0),
        estimatedHours: 1.5,
        description: 'Four wheel alignment',
        source: 'WALK_IN',
      },
      {
        orgId: org.id,
        locationId: location.id,
        customerId: pennine.id,
        vehicleId: transit.id,
        bayId: bays[0]!.id,
        technicianId: john!.id,
        status: 'SCHEDULED',
        startAt: day(2, 9, 0),
        endAt: day(2, 12, 0),
        estimatedHours: 3,
        description: 'Cambelt and water pump',
        source: 'PHONE',
      },
      {
        orgId: org.id,
        locationId: location.id,
        customerId: mariaCustomer.id,
        vehicleId: bmw.id,
        bayId: bays[1]!.id,
        technicianId: mike!.id,
        status: 'SCHEDULED',
        startAt: day(3, 10, 0),
        endAt: day(3, 11, 0),
        estimatedHours: 1,
        description: 'Recall — EGR cooler',
        source: 'RECALL',
      },
    ],
  });

  /* --- inventory and procurement (Phase 2) -------------------------------- */

  const warehouse = await prisma.warehouse.create({
    data: {
      orgId: org.id,
      locationId: location.id,
      name: 'Main store',
      code: 'MAIN',
      isDefault: true,
    },
  });

  // A second site. The group is deliberately lopsided: Bradford is a third of
  // the size, runs at half the productivity, and is the site an owner would
  // actually be worried about. A demo where both branches look the same hides
  // the reason the consolidated view exists.
  const bradford = await prisma.location.create({
    data: {
      orgId: org.id,
      name: 'Bradford Lane',
      code: 'BL2',
      addressLine1: '8 Bradford Lane',
      locality: 'Stockport',
      region: 'Greater Manchester',
      postcode: 'SK1 4AA',
      dailyCapacityHours: 16,
      bays: {
        create: [
          { name: 'Bay 1 — Lift', code: 'BL-B1', sortOrder: 1, capability: 'two-post lift' },
          { name: 'Bay 2 — General', code: 'BL-B2', sortOrder: 2 },
        ],
      },
    },
  });

  const bradfordStore = await prisma.warehouse.create({
    data: {
      orgId: org.id,
      locationId: bradford.id,
      name: 'Bradford store',
      code: 'BRAD',
    },
  });

  const [brakeCategory, serviceCategory, consumables] = await Promise.all(
    ['Braking', 'Service parts', 'Consumables'].map((name) =>
      prisma.productCategory.create({ data: { orgId: org.id, name } }),
    ),
  );

  // Deliberately mixed: one part comfortably in stock, one below its reorder
  // point with nothing on order, one short with a delivery already inbound,
  // and one that has been over-issued. The parts screen should make the
  // difference between those obvious at a glance.
  const productSpecs = [
    {
      partNumber: '34116794300',
      name: 'BMW front brake pad set',
      brand: 'BMW',
      categoryId: brakeCategory!.id,
      costPrice: 63.0,
      sellPrice: 105.0,
      reorderPoint: 4,
      reorderQty: 8,
      onHand: 6,
      reserved: 1,
      avgCost: 63.0,
    },
    {
      partNumber: '34116864059',
      name: 'BMW front brake discs (pair)',
      brand: 'BMW',
      categoryId: brakeCategory!.id,
      costPrice: 61.5,
      sellPrice: 102.5,
      reorderPoint: 4,
      reorderQty: 8,
      onHand: 1,
      reserved: 1,
      avgCost: 61.5,
    },
    {
      partNumber: 'TOY-0W20-5L',
      name: 'Engine oil 0W-20, 5L',
      brand: 'Toyota',
      categoryId: serviceCategory!.id,
      costPrice: 28.0,
      sellPrice: 52.0,
      reorderPoint: 10,
      reorderQty: 20,
      onHand: 24,
      reserved: 0,
      avgCost: 27.4,
    },
    {
      partNumber: '04152-YZZA1',
      name: 'Oil filter',
      brand: 'Toyota',
      categoryId: serviceCategory!.id,
      costPrice: 8.0,
      sellPrice: 18.0,
      reorderPoint: 12,
      reorderQty: 30,
      onHand: 5,
      reserved: 0,
      avgCost: 8.1,
    },
    {
      partNumber: '87139-0D070',
      name: 'Cabin filter',
      brand: 'Toyota',
      categoryId: serviceCategory!.id,
      costPrice: 11.0,
      sellPrice: 24.0,
      reorderPoint: 8,
      reorderQty: 20,
      onHand: 14,
      reserved: 0,
      avgCost: 10.8,
    },
    {
      partNumber: 'BAT-090-AGM',
      name: 'Battery 90Ah AGM',
      brand: 'Varta',
      categoryId: consumables!.id,
      costPrice: 151.0,
      sellPrice: 240.0,
      reorderPoint: 2,
      reorderQty: 4,
      onHand: 3,
      reserved: 0,
      avgCost: 149.5,
    },
    {
      partNumber: 'BRK-FLUID-1L',
      name: 'Brake fluid DOT 4, 1L',
      brand: 'Comma',
      categoryId: consumables!.id,
      costPrice: 6.2,
      sellPrice: 14.0,
      reorderPoint: 10,
      reorderQty: 24,
      onHand: -2,
      reserved: 0,
      avgCost: 6.2,
    },
  ];

  const products = [];
  for (const spec of productSpecs) {
    const { onHand, reserved, avgCost, ...productData } = spec;
    const product = await prisma.product.create({ data: { orgId: org.id, ...productData } });

    await prisma.stockLevel.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        onHand,
        reserved,
        avgCost,
        binLocation: `A${products.length + 1}`,
      },
    });

    // A receipt in the past, so weighted average cost has a provenance.
    await prisma.stockMovement.create({
      data: {
        orgId: org.id,
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'RECEIPT',
        quantity: Math.max(1, onHand + reserved),
        unitCost: avgCost,
        balanceAfter: onHand,
        reason: 'Opening balance',
        createdAt: day(-120),
      },
    });

    products.push(product);
  }

  // Issue history, so the reorder suggestion has a usage rate to work from
  // rather than guessing.
  const oilFilter = products.find((product) => product.partNumber === '04152-YZZA1')!;
  const brakeFluid = products.find((product) => product.partNumber === 'BRK-FLUID-1L')!;

  for (let week = 16; week >= 1; week -= 1) {
    await prisma.stockMovement.create({
      data: {
        orgId: org.id,
        productId: oilFilter.id,
        warehouseId: warehouse.id,
        type: 'ISSUE',
        quantity: -2,
        unitCost: 8.1,
        balanceAfter: 5,
        referenceType: 'Job',
        reason: 'Fitted on job',
        createdAt: day(-week * 7),
      },
    });
  }

  for (let week = 12; week >= 1; week -= 2) {
    await prisma.stockMovement.create({
      data: {
        orgId: org.id,
        productId: brakeFluid.id,
        warehouseId: warehouse.id,
        type: 'ISSUE',
        quantity: -1,
        unitCost: 6.2,
        balanceAfter: -2,
        referenceType: 'Job',
        reason: 'Fitted on job',
        createdAt: day(-week * 7),
      },
    });
  }

  const [euroCarParts, toyotaFactors] = await Promise.all([
    prisma.supplier.create({
      data: {
        orgId: org.id,
        name: 'Pennine Motor Factors',
        accountRef: 'HIL-4471',
        email: 'trade@penninefactors.test',
        phone: '0161 480 2211',
        addressLine1: 'Unit 7, Broadstone Mill',
        locality: 'Stockport',
        postcode: 'SK5 7DL',
        paymentTermsDays: 30,
      },
    }),
    prisma.supplier.create({
      data: {
        orgId: org.id,
        name: 'Northern OE Supply',
        accountRef: 'NOE-1180',
        email: 'orders@northernoe.test',
        paymentTermsDays: 14,
      },
    }),
  ]);

  // A part-received order: two lines ordered, one delivered. The receiving
  // screen has something real to book in.
  const brakePads = products.find((product) => product.partNumber === '34116794300')!;
  const brakeDiscs = products.find((product) => product.partNumber === '34116864059')!;

  const openOrder = await prisma.purchaseOrder.create({
    data: {
      orgId: org.id,
      number: 'PO-2041',
      supplierId: euroCarParts.id,
      status: 'PART_RECEIVED',
      expectedAt: day(2),
      subtotal: 498.0,
      taxTotal: 99.6,
      total: 597.6,
      notes: 'For job 10482. Discs still outstanding.',
      lines: {
        create: [
          {
            productId: brakePads.id,
            description: 'BMW front brake pad set',
            quantity: 4,
            received: 4,
            unitCost: 63.0,
            sortOrder: 1,
          },
          {
            productId: brakeDiscs.id,
            description: 'BMW front brake discs (pair)',
            quantity: 4,
            received: 0,
            unitCost: 61.5,
            sortOrder: 2,
          },
        ],
      },
    },
    include: { lines: true },
  });

  await prisma.goodsReceipt.create({
    data: {
      orderId: openOrder.id,
      reference: 'DN-88210',
      receivedAt: day(-1),
      lines: {
        create: [{ orderLineId: openOrder.lines[0]!.id, quantity: 4, unitCost: 63.0 }],
      },
    },
  });

  // A pending request above the approval threshold, so the purchasing screen
  // shows the separation of duty working.
  await prisma.purchaseRequest.create({
    data: {
      orgId: org.id,
      jobId: brakeJob.id,
      requestedByUserId: john!.id,
      status: 'PENDING',
      notes: '2 x Brake fluid DOT 4, 1L (BRK-FLUID-1L) short for a job.',
    },
  });

  await prisma.purchaseRequest.create({
    data: {
      orgId: org.id,
      requestedByUserId: sara!.id,
      approvedByUserId: ahmed!.id,
      approvedAt: day(-3),
      status: 'ORDERED',
      notes: 'Routine restock of service filters.',
    },
  });

  // A fully received order that has been billed, and one bill that does not
  // reconcile, so the three-way match has something to flag.
  const closedOrder = await prisma.purchaseOrder.create({
    data: {
      orgId: org.id,
      number: 'PO-2038',
      supplierId: toyotaFactors.id,
      status: 'BILLED',
      expectedAt: day(-10),
      subtotal: 268.0,
      taxTotal: 53.6,
      total: 321.6,
      lines: {
        create: [
          {
            productId: oilFilter.id,
            description: 'Oil filter',
            quantity: 20,
            received: 20,
            unitCost: 8.0,
            sortOrder: 1,
          },
          {
            productId: products.find((p) => p.partNumber === 'TOY-0W20-5L')!.id,
            description: 'Engine oil 0W-20, 5L',
            quantity: 4,
            received: 4,
            unitCost: 27.0,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.supplierBill.createMany({
    data: [
      {
        orgId: org.id,
        supplierId: toyotaFactors.id,
        orderId: closedOrder.id,
        reference: 'NOE-99321',
        status: 'APPROVED',
        subtotal: 268.0,
        taxTotal: 53.6,
        total: 321.6,
        billedAt: day(-9),
        dueAt: day(5),
      },
      {
        orgId: org.id,
        supplierId: euroCarParts.id,
        orderId: openOrder.id,
        reference: 'PMF-40128',
        status: 'DISPUTED',
        subtotal: 498.0,
        taxTotal: 99.6,
        total: 597.6,
        billedAt: day(-1),
        dueAt: day(29),
      },
    ],
  });

  // Link the live job's part lines to real products, so reservation and
  // consumption have something to act on.
  const jobPartLines = await prisma.jobPartLine.findMany({ where: { jobId: brakeJob.id } });
  for (const line of jobPartLines) {
    const match = products.find((product) => product.partNumber === line.partNumber);
    if (match) {
      await prisma.jobPartLine.update({
        where: { id: line.id },
        data: { productId: match.id, status: 'RESERVED' },
      });
      await prisma.stockReservation.create({
        data: {
          productId: match.id,
          warehouseId: warehouse.id,
          jobPartLineId: line.id,
          quantity: 1,
        },
      });
    }
  }

  /* --- money still out there ---------------------------------------------- */

  // Three unpaid invoices, deliberately spread across the ageing buckets. A
  // demo where every invoice is settled hides the one report an owner opens
  // every Monday morning.
  const openInvoices = [
    {
      number: 'INV-1036',
      customerId: pennine.id,
      issued: day(-110, 16, 0),
      due: day(-95, 16, 0),
      labour: 720.0,
      parts: 350.0,
      status: 'OVERDUE' as const,
      note: 'Fleet van, chased twice.',
    },
    {
      number: 'INV-1039',
      customerId: mariaCustomer.id,
      issued: day(-52, 11, 0),
      due: day(-22, 11, 0),
      labour: 380.0,
      parts: 245.0,
      status: 'OVERDUE' as const,
      note: null,
    },
    {
      number: 'INV-1041',
      customerId: ahmedCustomer.id,
      issued: day(-8, 14, 0),
      due: day(22, 14, 0),
      labour: 210.0,
      parts: 96.0,
      status: 'ISSUED' as const,
      note: null,
    },
  ];

  for (const invoice of openInvoices) {
    const net = invoice.labour + invoice.parts;
    const tax = Math.round(net * 0.2 * 100) / 100;

    await prisma.invoice.create({
      data: {
        orgId: org.id,
        number: invoice.number,
        customerId: invoice.customerId,
        status: invoice.status,
        subtotal: net,
        taxTotal: tax,
        total: net + tax,
        amountPaid: 0,
        issuedAt: invoice.issued,
        dueAt: invoice.due,
        notes: invoice.note,
        lines: {
          create: [
            {
              kind: 'LABOUR',
              description: 'Labour',
              quantity: 1,
              unitPrice: invoice.labour,
              // Tax-inclusive, like every line the application writes:
              // issueInvoice stores the line’s total after tax, and the
              // revenue split reads lineTotal less taxAmount to get the net.
              lineTotal: Math.round(invoice.labour * 1.2 * 100) / 100,
              taxAmount: Math.round(invoice.labour * 0.2 * 100) / 100,
              taxRateId: vat.id,
              sortOrder: 1,
            },
            {
              kind: 'PART',
              description: 'Parts supplied',
              quantity: 1,
              unitPrice: invoice.parts,
              // Tax-inclusive, like every line the application writes:
              // issueInvoice stores the line’s total after tax, and the
              // revenue split reads lineTotal less taxAmount to get the net.
              lineTotal: Math.round(invoice.parts * 1.2 * 100) / 100,
              taxAmount: Math.round(invoice.parts * 0.2 * 100) / 100,
              taxRateId: vat.id,
              sortOrder: 2,
            },
          ],
        },
      },
    });
  }

  /* --- the ledger --------------------------------------------------------- */

  await seedLedger(org.id, {
    invoiceId: (await prisma.invoice.findFirst({ where: { number: 'INV-1042' } }))!.id,
    paymentId: (await prisma.payment.findFirst({ where: { orgId: org.id } }))!.id,
    jobId: serviceJob.id,
    jobNumber: serviceJob.number,
    orderId: closedOrder.id,
    openInvoices: await prisma.invoice.findMany({
      where: { orgId: org.id, number: { in: ['INV-1036', 'INV-1039', 'INV-1041'] } },
      include: {
        customer: { select: { displayName: true } },
        lines: { select: { kind: true, lineTotal: true, taxAmount: true } },
      },
    }),
  });

  /* --- people ------------------------------------------------------------- */

  const employeeRefs = await seedPeople(org.id, {
    locationId: location.id,
    bradfordId: bradford.id,
    ahmedId: ahmed!.id,
    saraId: sara!.id,
    johnId: john!.id,
    mikeId: mike!.id,
    fatimaId: fatima!.id,
  });

  /* --- stock on the road --------------------------------------------------- */

  await seedTransfers(org.id, {
    fromWarehouseId: warehouse.id,
    toWarehouseId: bradfordStore.id,
    products,
    dispatchedByUserId: ahmed!.id,
  });

  /* --- the bank, and what it disagrees with -------------------------------- */

  await seedBanking(org.id, ahmed!.id);

  /* --- rules that run on their own, and the people they reach ------------- */

  await seedAutomation(org.id);

  /* --- what has actually been sent ---------------------------------------- */

  await seedMessages(org.id);

  /* --- what the parts fit (Phase 13) -------------------------------------- */

  await seedFitment(org.id, products);

  /* --- who can do what, and when they are here (Phase 12) ----------------- */

  await seedSkillsAndPatterns(org.id, { employees: employeeRefs, jobTypeByName });

  /* --- a fleet, and the cover the workshop stands behind (Phase 9) -------- */

  await seedFleetAndWarranty(org.id, {
    locationId: location.id,
    bayIds: bays.map((bay) => bay.id),
    customerId: pennine.id,
    transitId: transit.id,
    supplierId: euroCarParts.id,
    ownerUserId: ahmed!.id,
    technicianUserId: john!.id,
    advisorUserId: sara!.id,
    firstJobNumber: 10_483,
  });

  /* --- the quote link the customer was sent ------------------------------- */

  // The estimate is the one thing a customer has to answer, and most of them
  // will answer it from a text message rather than by signing in. Seeding the
  // link means the flow can be walked end to end without one being generated
  // by hand first.
  await prisma.estimateShare.create({
    data: {
      estimateId: estimate.id,
      tokenHash: createHash('sha256').update(DEMO_ESTIMATE_TOKEN).digest('hex'),
      channel: 'SMS',
      sentTo: maria!.email,
      expiresAt: day(14),
    },
  });

  /* --- a shared passport link -------------------------------------------- */

  await prisma.passportShare.create({
    data: {
      vehicleId: bmw.id,
      // The real SHA-256 of DEMO_SHARE_TOKEN, so /p/demo-share-token actually
      // opens. A hand-written placeholder hash is unopenable: no token
      // produces it, and the demo link silently 404s.
      tokenHash: createHash('sha256').update(DEMO_SHARE_TOKEN).digest('hex'),
      label: 'Shared with a prospective buyer',
      createdByUserId: maria!.id,
      expiresAt: day(30),
    },
  });

  /* --- the clock the workshop would have kept ------------------------------ */

  // Every job above says when the car arrived, and until Phase 52 none of them
  // said when the job was written: `createdAt` defaults to now, so a car that
  // arrived last Tuesday looked like a job somebody took four days to open.
  // Nothing on any screen showed it, because nothing subtracted those two
  // columns until there was a page that did.
  //
  // So the moments are settled here rather than one at a time above: the job
  // was written a few minutes after the car came in, work started when the
  // first technician had a bay, and a car that was finished went home the same
  // afternoon. A demonstration workshop with an implausible clock is worse
  // than one with no clock at all, because somebody will read it.
  const settling = await prisma.job.findMany({
    where: { orgId: org.id },
    select: {
      id: true,
      status: true,
      receivedAt: true,
      startedAt: true,
      completedAt: true,
      collectedAt: true,
      invoicedAt: true,
    },
  });

  const minutes = (from: Date, count: number) => new Date(from.getTime() + count * 60_000);

  for (const job of settling) {
    const arrived = job.receivedAt ?? day(-1, 8, 30);

    // Written up at the desk while the customer is still there.
    const written = minutes(arrived, 6 + (settling.indexOf(job) % 4) * 3);

    // On a ramp once somebody is free, and finished when it is finished.
    const started = job.startedAt ?? (job.completedAt ? minutes(arrived, 55) : null);
    const finished = job.completedAt;

    // A finished car goes home the same afternoon, unless it is still here.
    const collected =
      job.collectedAt ??
      (finished && ['INVOICED', 'PAID'].includes(job.status) ? minutes(finished, 95) : null);

    const invoiced = job.invoicedAt ?? (finished ? minutes(finished, 25) : null);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        createdAt: written,
        ...(started ? { startedAt: started } : {}),
        ...(collected ? { collectedAt: collected } : {}),
        ...(invoiced && ['INVOICED', 'PAID'].includes(job.status) ? { invoicedAt: invoiced } : {}),
      },
    });
  }

  console.info(`
  Seeded.

    Organisation   ${org.name}
    Prior workshop ${priorWorkshop.name} (wrote 7 entries to the BMW's passport)
    Users          ${[ahmed, sara, john, mike, fatima, maria, david].length}
    Vehicles       6 (three of them one company's fleet)
    Jobs           6 (two awaiting approval, one in progress, three closed)
    Warranty       4 covers, one claim open and one goodwill claim settled
    Parts          ${productSpecs.length} across 3 categories, 2 below reorder point
    Suppliers      2, with one part-received order and one disputed bill

  Public vehicle passport, no account needed:
    /p/${DEMO_SHARE_TOKEN}

  The quote Maria was sent, no account needed:
    /e/${DEMO_ESTIMATE_TOKEN}

  Sign in at http://localhost:3000/login

    ahmed@hillsidemotors.test    owner
    sara@hillsidemotors.test     service advisor
    john@hillsidemotors.test     technician
    fatima@hillsidemotors.test   bookkeeper
    maria@example.test           customer portal

    password: ${PASSWORD}

  Estimate ${estimate.id} is waiting on Maria's decision.
  Inspection ${inspection.id} found 2 critical and 3 advisory items.
`);
}

/**
 * Appends events to a vehicle's chain, computing hashes exactly as the
 * application does. Seeded history must verify, or the demo shows a broken
 * chain on its first screen.
 */
/**
 * The books.
 *
 * A workshop adopting Carnet mid-year brings balances and a trading history
 * with it, so the demo does the same: an opening position on migration, three
 * months of summarised trading, then this fortnight's real documents posted
 * individually. Without the migrated history the statements would show one
 * invoice against a full month of wages, which reads as a failing business
 * rather than a partial month.
 */
async function seedLedger(
  orgId: string,
  refs: {
    invoiceId: string;
    paymentId: string;
    jobId: string;
    jobNumber: number;
    orderId: string;
    openInvoices: {
      id: string;
      number: string;
      taxTotal: unknown;
      issuedAt: Date | null;
      customer: { displayName: string };
      lines: { kind: string; lineTotal: unknown; taxAmount: unknown }[];
    }[];
  },
) {
  await prisma.account.createMany({
    data: STANDARD_CHART.map((account) => ({
      orgId,
      code: account.code,
      name: account.name,
      type: account.type,
    })),
  });

  const accounts = await prisma.account.findMany({
    where: { orgId },
    select: { id: true, code: true },
  });
  const accountId = new Map(accounts.map((account) => [account.code, account.id]));

  // Quarters, with anything that closed more than 60 days ago locked. An entry
  // seeded into the last fortnight always lands in an open period.
  const year = new Date().getFullYear();
  const quarters = [0, 1, 2, 3].map((index) => ({
    name: `${year} Q${index + 1}`,
    startsAt: new Date(year, index * 3, 1),
    endsAt: new Date(year, index * 3 + 3, 0, 23, 59, 59),
  }));

  // Created open, every one of them. A quarter is closed at the end of this
  // function, once its entries exist, because that is the order it happens in
  // a real workshop: the books are written and then they are signed off. Doing
  // it the other way round dates the close before rows that were seeded after
  // it, and the audit rightly reads that as somebody posting into a period
  // that had already been reported on.
  const cutoff = day(-60);
  await prisma.fiscalPeriod.createMany({
    data: quarters.map((quarter) => ({
      orgId,
      name: quarter.name,
      startsAt: quarter.startsAt,
      endsAt: quarter.endsAt,
    })),
  });

  const periods = await prisma.fiscalPeriod.findMany({ where: { orgId } });
  const periodFor = (at: Date) =>
    periods.find((period) => at >= period.startsAt && at <= period.endsAt)?.id ?? null;

  const gbp = (major: number) => money(Math.round(major * 100), 'GBP');

  const post = async (draft: JournalEntryDraft) => {
    await prisma.journalEntry.create({
      data: {
        orgId,
        periodId: periodFor(draft.postedAt),
        reference: draft.reference,
        description: draft.description,
        postedAt: draft.postedAt,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        lines: {
          create: draft.lines.map((line, index) => ({
            accountId: accountId.get(line.accountCode)!,
            debit: toNumber(line.debit),
            credit: toNumber(line.credit),
            memo: line.memo ?? null,
            sortOrder: index,
          })),
        },
      },
    });
  };

  /* Opening position carried over on migration. */
  await post({
    reference: `OB-${year}`,
    description: 'Opening balances brought forward on migration',
    sourceType: 'Migration',
    sourceId: 'opening-balance',
    postedAt: new Date(year, 0, 1, 9, 0, 0),
    lines: [
      { accountCode: ACCOUNT.BANK, debit: gbp(18400), credit: gbp(0), memo: 'Cleared funds' },
      {
        accountCode: ACCOUNT.STOCK,
        debit: gbp(6250),
        credit: gbp(0),
        memo: 'Stocktake at migration',
      },
      { accountCode: ACCOUNT.PAYABLE, debit: gbp(0), credit: gbp(3110) },
      { accountCode: ACCOUNT.TAX_PAYABLE, debit: gbp(0), credit: gbp(1940) },
      { accountCode: ACCOUNT.RETAINED, debit: gbp(0), credit: gbp(19600) },
    ],
  });

  /* Three months of trading, summarised as they were migrated. */
  for (const monthsBack of [3, 2, 1]) {
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 18, 0, 0);
    const label = at.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const stamp = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;

    await post({
      reference: `TS-${stamp}`,
      description: `Trading summary, ${label} (migrated)`,
      sourceType: 'Migration',
      sourceId: `trading-${stamp}`,
      postedAt: at,
      lines: [
        { accountCode: ACCOUNT.BANK, debit: gbp(26544), credit: gbp(0), memo: 'Takings banked' },
        { accountCode: ACCOUNT.COGS_PARTS, debit: gbp(6400), credit: gbp(0) },
        { accountCode: ACCOUNT.WAGES, debit: gbp(7800), credit: gbp(0) },
        {
          accountCode: ACCOUNT.PREMISES,
          debit: gbp(1450),
          credit: gbp(0),
          memo: 'Rent and utilities',
        },
        {
          accountCode: ACCOUNT.STOCK,
          debit: gbp(6600),
          credit: gbp(0),
          memo: 'Parts purchased',
        },
        { accountCode: ACCOUNT.TAX_RECEIVABLE, debit: gbp(1320), credit: gbp(0) },
        { accountCode: ACCOUNT.LABOUR_REVENUE, debit: gbp(0), credit: gbp(12600) },
        { accountCode: ACCOUNT.PARTS_REVENUE, debit: gbp(0), credit: gbp(8900) },
        { accountCode: ACCOUNT.FEE_REVENUE, debit: gbp(0), credit: gbp(620) },
        { accountCode: ACCOUNT.TAX_PAYABLE, debit: gbp(0), credit: gbp(4424) },
        {
          accountCode: ACCOUNT.STOCK,
          debit: gbp(0),
          credit: gbp(6400),
          memo: 'Parts consumed',
        },
        {
          accountCode: ACCOUNT.BANK,
          debit: gbp(0),
          credit: gbp(17170),
          memo: 'Wages, rent, suppliers',
        },
      ],
    });
  }

  /* This fortnight, posted from the documents themselves. */
  await post(
    postGoodsReceived({
      receiptId: refs.orderId,
      reference: 'GRN-2038',
      orderNumber: 'PO-2038',
      goodsValue: gbp(268),
      taxValue: gbp(53.6),
      receivedAt: day(-10, 11, 0),
    }),
  );

  await post({
    reference: 'RENT-CURRENT',
    description: 'Rent and utilities',
    sourceType: 'Expense',
    sourceId: 'premises-current',
    postedAt: day(-8, 9, 0),
    lines: [
      { accountCode: ACCOUNT.PREMISES, debit: gbp(1450), credit: gbp(0) },
      { accountCode: ACCOUNT.BANK, debit: gbp(0), credit: gbp(1450) },
    ],
  });

  await post(
    postInvoiceIssued({
      invoiceId: refs.invoiceId,
      invoiceNumber: 'INV-1042',
      customerName: 'Ahmed Hassan',
      issuedAt: day(-6, 15, 30),
      labourNet: gbp(142.5),
      partsNet: gbp(94),
      feeNet: gbp(0),
      taxTotal: gbp(47.3),
    }),
  );

  await post(
    postPartsConsumed({
      jobId: refs.jobId,
      jobNumber: refs.jobNumber,
      cost: gbp(47),
      at: day(-6, 15, 30),
    }),
  );

  await post(
    postPaymentReceived({
      paymentId: refs.paymentId,
      reference: 'PAY-1042',
      amount: gbp(283.8),
      method: 'CARD',
      receivedAt: day(-6, 16, 5),
    }),
  );

  await post({
    reference: 'WAGE-CURRENT',
    description: 'Payroll',
    sourceType: 'Expense',
    sourceId: 'wages-current',
    postedAt: day(-5, 9, 0),
    lines: [
      { accountCode: ACCOUNT.WAGES, debit: gbp(7800), credit: gbp(0) },
      { accountCode: ACCOUNT.BANK, debit: gbp(0), credit: gbp(7800) },
    ],
  });

  for (const invoice of refs.openInvoices) {
    // A line's total carries its own tax, so the net has to be recovered by
    // taking the tax back off. Passing the gross figure in as the net puts the
    // tax on the invoice twice: once in the revenue accounts and once in the
    // tax liability, and the receivable ends up larger than the bill itself.
    const netFor = (kind: string) =>
      invoice.lines
        .filter((line) => line.kind === kind)
        .reduce((total, line) => total + Number(line.lineTotal) - Number(line.taxAmount), 0);

    await post(
      postInvoiceIssued({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerName: invoice.customer.displayName,
        issuedAt: invoice.issuedAt ?? new Date(),
        labourNet: gbp(netFor('LABOUR')),
        partsNet: gbp(netFor('PART')),
        feeNet: gbp(netFor('FEE')),
        taxTotal: gbp(Number(invoice.taxTotal)),
      }),
    );
  }

  await post(
    postStockAdjustment({
      movementId: 'stocktake-current',
      reference: 'ADJ-0091',
      value: gbp(-24),
      reason: 'Stocktake variance, brake cleaner',
      at: day(-3, 16, 0),
    }),
  );

  // And now the quarters that are long past are signed off, after everything
  // that belongs in them has been written.
  await prisma.fiscalPeriod.updateMany({
    where: { orgId, endsAt: { lt: cutoff } },
    data: { isClosed: true, closedAt: new Date() },
  });
}

/**
 * Employees, their pay history, and a fortnight of attendance.
 *
 * Pay rates are seeded with real history rather than a single current figure,
 * because the whole point of dating them is that last year's jobs keep last
 * year's cost. A demo with one open-ended rate per person would demonstrate
 * nothing.
 *
 * Attendance is deliberately imperfect: one technician has a shift left open
 * overnight, which is the most common real data problem in a workshop and the
 * one the productivity page has to survive.
 */
async function seedPeople(
  orgId: string,
  refs: {
    locationId: string;
    bradfordId: string;
    ahmedId: string;
    saraId: string;
    johnId: string;
    mikeId: string;
    fatimaId: string;
  },
) {
  const year = new Date().getFullYear();

  const people = [
    {
      userId: refs.johnId,
      reference: 'EMP-001',
      displayName: 'John Adeyemi',
      jobTitle: 'Senior technician',
      locationId: refs.locationId,
      startedOn: new Date(year - 6, 2, 1),
      weeklyMinutes: 2400,
      rates: [
        { from: new Date(year - 6, 2, 1), to: new Date(year - 1, 3, 1), cost: 31, charge: 85 },
        { from: new Date(year - 1, 3, 1), to: new Date(year, 3, 1), cost: 35, charge: 92 },
        { from: new Date(year, 3, 1), to: null, cost: 38, charge: 95 },
      ],
      certifications: [
        {
          name: 'MOT tester, class 4',
          authority: 'DVSA',
          reference: 'MT-338217',
          issuedOn: new Date(year - 3, 5, 14),
          // Expires inside the warning window, which is the point.
          expiresOn: day(41),
        },
        {
          name: 'Air conditioning, F-Gas category 1',
          authority: 'City & Guilds',
          issuedOn: new Date(year - 4, 8, 2),
          expiresOn: new Date(year + 3, 8, 2),
        },
      ],
    },
    {
      userId: refs.mikeId,
      reference: 'EMP-002',
      displayName: 'Mike Sowande',
      jobTitle: 'Technician',
      locationId: refs.locationId,
      startedOn: new Date(year - 2, 8, 15),
      weeklyMinutes: 2400,
      rates: [
        { from: new Date(year - 2, 8, 15), to: new Date(year, 3, 1), cost: 30, charge: 85 },
        { from: new Date(year, 3, 1), to: null, cost: 34, charge: 92 },
      ],
      certifications: [
        {
          name: 'Hybrid and electric vehicle, level 3',
          authority: 'IMI',
          issuedOn: new Date(year - 1, 1, 20),
          expiresOn: new Date(year + 2, 1, 20),
        },
      ],
    },
    {
      userId: refs.saraId,
      reference: 'EMP-003',
      displayName: 'Sara Whitfield',
      jobTitle: 'Service advisor',
      locationId: refs.locationId,
      startedOn: new Date(year - 4, 0, 8),
      weeklyMinutes: 2250,
      rates: [{ from: new Date(year - 4, 0, 8), to: null, cost: 24, charge: 0 }],
      certifications: [],
    },
    {
      userId: null,
      reference: 'EMP-004',
      displayName: 'Priya Raman',
      jobTitle: 'Technician, Bradford',
      locationId: refs.bradfordId,
      startedOn: new Date(year - 1, 5, 3),
      weeklyMinutes: 2400,
      rates: [{ from: new Date(year - 1, 5, 3), to: null, cost: 29, charge: 85 }],
      certifications: [
        {
          name: 'MOT tester, class 4',
          authority: 'DVSA',
          reference: 'MT-401993',
          issuedOn: new Date(year - 1, 6, 1),
          // Already lapsed. Work is being signed off that legally cannot be.
          expiresOn: day(-12),
        },
      ],
    },
    {
      userId: refs.fatimaId,
      reference: 'EMP-005',
      displayName: 'Fatima Rahal',
      jobTitle: 'Bookkeeper',
      locationId: refs.locationId,
      startedOn: new Date(year - 3, 10, 1),
      weeklyMinutes: 1500,
      rates: [{ from: new Date(year - 3, 10, 1), to: null, cost: 27, charge: 0 }],
      certifications: [],
    },
  ];

  const employees = new Map<string, string>();

  for (const person of people) {
    const employee = await prisma.employee.create({
      data: {
        orgId,
        userId: person.userId,
        locationId: person.locationId,
        reference: person.reference,
        displayName: person.displayName,
        jobTitle: person.jobTitle,
        startedOn: person.startedOn,
        weeklyMinutes: person.weeklyMinutes,
        payRates: {
          create: person.rates.map((rate) => ({
            orgId,
            costPerHour: rate.cost,
            chargePerHour: rate.charge,
            effectiveFrom: rate.from,
            effectiveTo: rate.to,
          })),
        },
        certifications: {
          create: person.certifications.map((certification) => ({
            orgId,
            name: certification.name,
            authority: certification.authority,
            reference: 'reference' in certification ? certification.reference : null,
            issuedOn: certification.issuedOn,
            expiresOn: certification.expiresOn,
          })),
        },
      },
    });

    employees.set(person.reference, employee.id);
  }

  // Two working weeks of attendance for the technicians. Weekends skipped.
  const shifts: {
    employeeId: string;
    locationId: string;
    startedAt: Date;
    endedAt: Date | null;
    breakMinutes: number;
  }[] = [];

  for (let offset = -13; offset <= -1; offset += 1) {
    const date = day(offset, 8, 0);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    shifts.push(
      {
        employeeId: employees.get('EMP-001')!,
        locationId: refs.locationId,
        startedAt: day(offset, 8, 0),
        endedAt: day(offset, 17, 0),
        breakMinutes: 45,
      },
      {
        employeeId: employees.get('EMP-002')!,
        locationId: refs.locationId,
        startedAt: day(offset, 8, 30),
        endedAt: day(offset, 17, 0),
        breakMinutes: 45,
      },
      {
        employeeId: employees.get('EMP-004')!,
        locationId: refs.bradfordId,
        startedAt: day(offset, 9, 0),
        endedAt: day(offset, 17, 0),
        breakMinutes: 30,
      },
    );
  }

  await prisma.attendanceRecord.createMany({
    data: shifts.map((shift) => ({ orgId, ...shift })),
  });

  // One shift left open. The single most common real attendance problem, and
  // the productivity page has to survive it rather than report a 19-hour day
  // as a triumph.
  await prisma.attendanceRecord.create({
    data: {
      orgId,
      employeeId: employees.get('EMP-002')!,
      locationId: refs.locationId,
      startedAt: day(0, 8, 15),
      endedAt: null,
      breakMinutes: 0,
      note: 'Clocked in this morning.',
    },
  });

  await prisma.absence.createMany({
    data: [
      {
        orgId,
        employeeId: employees.get('EMP-001')!,
        type: 'HOLIDAY',
        startsOn: day(21),
        endsOn: day(28),
        days: 5,
        approved: true,
        note: 'Booked in January.',
      },
      {
        orgId,
        employeeId: employees.get('EMP-004')!,
        type: 'SICK',
        startsOn: day(-4),
        endsOn: day(-3),
        days: 2,
        approved: true,
      },
    ],
  });

  // Two schemes, on deliberately different bases, so the page can show that
  // the basis is the decision and the rate is the detail.
  const labourScheme = await prisma.commissionScheme.create({
    data: {
      orgId,
      name: 'Technician, labour profit',
      basis: 'LABOUR_PROFIT',
      threshold: 500,
      guarantee: 0,
      paidOnSettlement: true,
      bands: {
        create: [
          { fromAmount: 0, rate: 8, sortOrder: 1 },
          { fromAmount: 2000, rate: 12, sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.commissionScheme.create({
    data: {
      orgId,
      name: 'Advisor, parts margin',
      basis: 'PARTS_PROFIT',
      threshold: 0,
      guarantee: 150,
      paidOnSettlement: false,
      bands: { create: [{ fromAmount: 0, rate: 5, sortOrder: 1 }] },
    },
  });

  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

  await prisma.commissionAward.createMany({
    data: [
      {
        orgId,
        employeeId: employees.get('EMP-001')!,
        schemeId: labourScheme.id,
        periodStart: lastMonthStart,
        periodEnd: lastMonthEnd,
        basisTotal: 3140,
        earned: 289.2,
        jobCount: 22,
        withheldCount: 3,
      },
      {
        orgId,
        employeeId: employees.get('EMP-002')!,
        schemeId: labourScheme.id,
        periodStart: lastMonthStart,
        periodEnd: lastMonthEnd,
        basisTotal: 1820,
        earned: 105.6,
        jobCount: 17,
        withheldCount: 1,
      },
    ],
  });

  // Timesheets for the fortnight just gone. One already paid, so the
  // immutability trigger has something real to protect.
  await prisma.timesheet.createMany({
    data: [
      {
        orgId,
        employeeId: employees.get('EMP-001')!,
        periodStart: day(-13, 0, 0),
        periodEnd: day(-7, 23, 59),
        status: 'PAID',
        ordinaryMinutes: 2400,
        overtimeMinutes: 75,
        ordinaryPay: 1520,
        overtimePay: 71.25,
        gross: 1591.25,
        paidAt: day(-6),
      },
      {
        orgId,
        employeeId: employees.get('EMP-002')!,
        periodStart: day(-13, 0, 0),
        periodEnd: day(-7, 23, 59),
        status: 'APPROVED',
        ordinaryMinutes: 2325,
        overtimeMinutes: 0,
        ordinaryPay: 1317.5,
        overtimePay: 0,
        gross: 1317.5,
        approvedAt: day(-6),
      },
    ],
  });

  // Returned so later seeding can find somebody by reference rather than by
  // display name, which is the thing most likely to be edited.
  return employees;
}

/**
 * A transfer that has left Hillside and not reached Bradford.
 *
 * Seeded mid-flight on purpose: the in-transit state is the one that is easy
 * to get wrong and impossible to notice, because both sites' figures look
 * plausible while the stock is nowhere.
 */
async function seedTransfers(
  orgId: string,
  refs: {
    fromWarehouseId: string;
    toWarehouseId: string;
    products: { id: string; partNumber: string }[];
    dispatchedByUserId: string;
  },
) {
  // Sent from genuine surplus. Sending a part the origin is already short of
  // would solve one site's problem by creating another's, which the suggestion
  // engine refuses to propose and the demo should not depict.
  const oil = refs.products.find((product) => product.partNumber === 'TOY-0W20-5L');
  const cabin = refs.products.find((product) => product.partNumber === '87139-0D070');
  if (!oil || !cabin) return;

  const transfer = await prisma.stockTransfer.create({
    data: {
      orgId,
      reference: 'TRF-0007',
      fromWarehouseId: refs.fromWarehouseId,
      toWarehouseId: refs.toWarehouseId,
      status: 'IN_TRANSIT',
      dispatchedAt: day(-2, 14, 30),
      dispatchedByUserId: refs.dispatchedByUserId,
      note: 'Bradford ran short before the weekend.',
      lines: {
        create: [
          { productId: oil.id, quantity: 6, received: 0, unitCost: 27.4, sortOrder: 1 },
          { productId: cabin.id, quantity: 4, received: 0, unitCost: 10.8, sortOrder: 2 },
        ],
      },
    },
  });

  // The stock genuinely left. Without these movements the origin's balance
  // would still show parts that are sitting in a van.
  for (const line of [
    { productId: oil.id, quantity: 6, unitCost: 27.4 },
    { productId: cabin.id, quantity: 4, unitCost: 10.8 },
  ]) {
    const level = await prisma.stockLevel.findFirst({
      where: { productId: line.productId, warehouseId: refs.fromWarehouseId },
    });
    if (!level) continue;

    const balanceAfter = Number(level.onHand) - line.quantity;

    await prisma.stockLevel.update({
      where: { id: level.id },
      data: { onHand: balanceAfter },
    });

    await prisma.stockMovement.create({
      data: {
        orgId,
        productId: line.productId,
        warehouseId: refs.fromWarehouseId,
        type: 'TRANSFER_OUT',
        quantity: -line.quantity,
        unitCost: line.unitCost,
        balanceAfter,
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        reason: 'Sent on TRF-0007',
      },
    });
  }

  // One that arrived last week, so the page shows a finished journey too.
  await prisma.stockTransfer.create({
    data: {
      orgId,
      reference: 'TRF-0006',
      fromWarehouseId: refs.fromWarehouseId,
      toWarehouseId: refs.toWarehouseId,
      status: 'RECEIVED',
      dispatchedAt: day(-9, 11, 0),
      receivedAt: day(-9, 16, 20),
      dispatchedByUserId: refs.dispatchedByUserId,
      lines: {
        create: [{ productId: cabin.id, quantity: 10, received: 10, unitCost: 10.8, sortOrder: 1 }],
      },
    },
  });
}

/**
 * A bank account and a statement that does not quite agree with the ledger.
 *
 * Deliberately not reconciled. An account that already balances demonstrates
 * nothing: the whole point of the page is the three cases a real statement
 * always has, which are a payment the bank has seen, a payment it has not seen
 * yet, and a charge nobody recorded.
 */
async function seedBanking(orgId: string, ownerUserId: string) {
  const account = await prisma.bankAccount.create({
    data: {
      orgId,
      name: 'Business current account',
      last4: '4417',
      sortCode: '20-45-63',
      accountCode: '1000',
    },
  });

  const statement = await prisma.bankStatement.create({
    data: {
      bankAccountId: account.id,
      startsOn: day(-30, 0, 0),
      endsOn: day(-1, 23, 59),
      openingBalance: 41_200.0,
      closingBalance: 44_318.4,
    },
  });

  await prisma.bankStatementLine.createMany({
    data: [
      // Matches a real payment on reference and amount, so it should be
      // suggested as exact.
      {
        statementId: statement.id,
        postedOn: day(-6, 16, 30),
        description: 'BACS CREDIT PAY-1042',
        reference: 'PAY-1042',
        amount: 283.8,
      },
      // Matches on amount and date but carries no reference, so it can only
      // ever be a likely match and needs somebody to look.
      {
        statementId: statement.id,
        postedOn: day(-8, 9, 15),
        description: 'DD HILLSIDE ESTATES',
        reference: null,
        amount: -1450.0,
      },
      // Nothing in the ledger corresponds to these. They are the reason a
      // reconciliation exists: a charge and a direct debit nobody recorded.
      {
        statementId: statement.id,
        postedOn: day(-4, 6, 0),
        description: 'ACCOUNT FEE',
        reference: null,
        amount: -14.5,
      },
      {
        statementId: statement.id,
        postedOn: day(-3, 6, 0),
        description: 'DD TRADE INSURANCE',
        reference: null,
        amount: -186.25,
      },
    ],
  });

  // Expenses, including one somebody paid for themselves and is owed back,
  // and one over the receipt threshold with nothing attached.
  const employee = await prisma.employee.findFirst({ where: { orgId, reference: 'EMP-002' } });

  await prisma.expense.createMany({
    data: [
      {
        orgId,
        reference: 'EXP-0001',
        category: 'INSURANCE',
        status: 'APPROVED',
        supplier: 'Trade Insurance Services',
        description: 'Annual combined policy',
        net: 2_240.0,
        tax: 0,
        incurredAt: day(-3, 6, 0),
        paidFrom: 'BANK',
        receiptUrl: 'receipt-on-file',
        approvedByUserId: ownerUserId,
        approvedAt: day(-3, 9, 0),
      },
      {
        orgId,
        reference: 'EXP-0002',
        category: 'SUBSCRIPTIONS',
        status: 'SUBMITTED',
        supplier: 'Technical data provider',
        description: 'Monthly subscription',
        net: 89.0,
        tax: 17.8,
        incurredAt: day(-5, 10, 0),
        paidFrom: 'CARD',
        receiptUrl: 'receipt-on-file',
      },
      {
        orgId,
        reference: 'EXP-0003',
        category: 'EQUIPMENT',
        status: 'SUBMITTED',
        supplier: 'Local factor',
        description: 'Torque wrench, bought on the way in',
        net: 74.0,
        tax: 14.8,
        incurredAt: day(-2, 8, 30),
        paidFrom: 'PERSONAL',
        claimedByEmployeeId: employee?.id ?? null,
        // No receipt, deliberately: over the threshold, so the page has
        // something real to complain about.
        receiptUrl: null,
      },
    ],
  });
}

async function appendChain(
  vehicleId: string,
  drafts: readonly Omit<DraftEvent, 'vehicleId'>[],
): Promise<void> {
  let prevHash: string | null = null;
  let sequence = 0;
  let lastOdometer: number | null = null;

  for (const draft of drafts) {
    sequence += 1;

    const chained = chainEvent(
      {
        vehicleId,
        sequence,
        type: draft.type,
        occurredAt: draft.occurredAt,
        payload: draft.payload,
        odometerKm: draft.odometerKm ?? null,
        recordedByOrgId: draft.recordedByOrgId ?? null,
        supersedesId: null,
      },
      prevHash,
      SALT,
    );

    await prisma.vehicleEvent.create({
      data: {
        vehicleId,
        sequence,
        type: draft.type as never,
        occurredAt: new Date(draft.occurredAt as string | number | Date),
        verification: draft.verification as never,
        title: draft.title,
        summary: draft.summary,
        payload: draft.payload as never,
        odometerKm: draft.odometerKm ?? null,
        recordedByOrgId: draft.recordedByOrgId ?? null,
        jobRef: draft.idempotencyKey,
        hash: chained.hash,
        prevHash: chained.prevHash,
      },
    });

    prevHash = chained.hash;
    if (draft.odometerKm != null) lastOdometer = draft.odometerKm;
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      chainHead: prevHash,
      eventCount: sequence,
      ...(lastOdometer != null ? { lastOdometerKm: lastOdometer } : {}),
    },
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Automation, consent and one campaign that has already gone out.
 *
 * The interesting rows here are the ones that did not work. A rule that has
 * been held back for a fortnight, and a campaign where a third of the segment
 * was suppressed, are what the pages exist to show; a demo where everything
 * fired cleanly teaches nobody how to read them.
 */
async function seedAutomation(orgId: string) {
  const thankYou = await prisma.automationRule.create({
    data: {
      orgId,
      name: 'Thank the customer',
      trigger: 'job.completed',
      conditions: [{ field: 'job.total', is: 'gte', value: 10_000 }],
      actions: [{ kind: 'send.email', target: 'Thanks for your visit', delayHours: 24 }],
      cooldownHours: 24 * 30,
    },
  });

  const chase = await prisma.automationRule.create({
    data: {
      orgId,
      name: 'Chase an overdue invoice',
      trigger: 'invoice.overdue',
      conditions: [{ field: 'invoice.daysOverdue', is: 'gte', value: 14 }],
      actions: [
        { kind: 'task.create', target: 'Ring about the overdue invoice', delayHours: 0 },
        { kind: 'send.email', target: 'Your invoice is overdue', delayHours: 2 },
      ],
      cooldownHours: 24 * 7,
    },
  });

  // Written, considered, and switched off. Somebody decided a text about a
  // missed appointment reads as a telling-off, and the record of that decision
  // is more useful than a deleted rule.
  await prisma.automationRule.create({
    data: {
      orgId,
      name: 'Follow up a missed appointment',
      trigger: 'booking.missed',
      conditions: [],
      actions: [{ kind: 'send.sms', target: 'Sorry we missed you', delayHours: 3 }],
      isActive: false,
      cooldownHours: 24 * 14,
    },
  });

  const paidJob = await prisma.job.findFirst({
    where: { orgId, status: 'PAID' },
    select: { id: true, customerId: true },
  });

  if (paidJob) {
    const fired = await prisma.automationRun.create({
      data: {
        ruleId: thankYou.id,
        subjectType: 'Job',
        subjectId: paidJob.id,
        customerId: paidJob.customerId,
        firedAt: day(-2, 17, 5),
      },
    });

    await prisma.automationAction.create({
      data: {
        runId: fired.id,
        kind: 'send.email',
        target: 'Thanks for your visit',
        dueAt: day(-1, 17, 5),
        status: 'DONE',
        doneAt: day(-1, 17, 6),
      },
    });
  }

  const openInvoice = await prisma.invoice.findFirst({
    where: { orgId, number: 'INV-1036' },
    select: { id: true, customerId: true },
  });

  if (openInvoice) {
    // Fired, then stopped by its own condition. This is the row that answers
    // "why has this rule sent nothing", and without it the rule is
    // indistinguishable from one nobody has triggered.
    await prisma.automationRun.create({
      data: {
        ruleId: chase.id,
        subjectType: 'Invoice',
        subjectId: openInvoice.id,
        customerId: openInvoice.customerId,
        firedAt: day(-1, 8, 0),
        blockedBy: 'invoice.daysOverdue',
        reason: 'Days overdue is 9, and the rule needs it is at least 14.',
      },
    });

    const chasing = await prisma.automationRun.create({
      data: {
        ruleId: chase.id,
        subjectType: 'Invoice',
        subjectId: openInvoice.id,
        customerId: openInvoice.customerId,
        firedAt: day(0, 7, 30),
      },
    });

    await prisma.automationAction.createMany({
      data: [
        {
          runId: chasing.id,
          kind: 'task.create',
          target: 'Ring about the overdue invoice',
          dueAt: day(0, 7, 30),
        },
        {
          runId: chasing.id,
          kind: 'send.email',
          target: 'Your invoice is overdue',
          dueAt: day(0, 9, 30),
        },
      ],
    });
  }

  /* --- consent, and the campaign it gates --------------------------------- */

  const customers = await prisma.customer.findMany({
    where: { orgId },
    select: { id: true, email: true },
    orderBy: { displayName: 'asc' },
  });

  // Not everybody agreed, and that is the point. The consent trail is written
  // by a database trigger, so these updates leave a record without the seed
  // writing one.
  for (const [index, customer] of customers.entries()) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        marketingEmailConsent: index % 3 !== 0 && Boolean(customer.email),
        marketingSmsConsent: index % 4 === 1,
      },
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      orgId,
      name: 'Winter check offer',
      channel: 'EMAIL',
      segment: [{ kind: 'lapsed', days: 180 }],
      subject: 'A free winter check while the weather turns',
      body: 'It has been a while. Bring the car in before the cold sets in and we will check the battery, the tyres and the antifreeze at no charge.',
      status: 'SENT',
      sentAt: day(-9, 10, 0),
      plannedRecipients: 0,
      plannedSuppressed: 0,
    },
  });

  const reachable = await prisma.customer.findMany({
    where: { orgId, marketingEmailConsent: true, email: { not: null } },
    select: { id: true },
  });

  const held = await prisma.customer.findMany({
    where: { orgId, OR: [{ marketingEmailConsent: false }, { email: null }] },
    select: { id: true, email: true, marketingEmailConsent: true },
  });

  await prisma.campaignRecipient.createMany({
    data: [
      ...reachable.map((customer) => ({
        campaignId: campaign.id,
        customerId: customer.id,
        status: 'SENT',
        sentAt: day(-9, 10, 0),
      })),
      ...held.map((customer) => ({
        campaignId: campaign.id,
        customerId: customer.id,
        status: 'SUPPRESSED',
        reason: customer.email
          ? 'They have not agreed to marketing by email.'
          : 'No email address on this customer.',
      })),
    ],
    skipDuplicates: true,
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { plannedRecipients: reachable.length, plannedSuppressed: held.length },
  });

  await prisma.customer.updateMany({
    where: { id: { in: reachable.map((customer) => customer.id) } },
    data: { lastMarketedAt: day(-9, 10, 0) },
  });
}

/**
 * The outbound log, including the parts nobody wants to look at.
 *
 * A demo where every message succeeded teaches nothing. The three rows that
 * matter here are the failure nobody will retry, the one still being retried,
 * and the text held overnight, because those are the three states a workshop
 * has to be able to tell apart on a Monday morning.
 */
async function seedMessages(orgId: string) {
  await prisma.messageLog.createMany({
    data: [
      {
        orgId,
        channel: 'EMAIL',
        toAddress: 'maria@example.test',
        subject: 'Your BMW 320d is ready to collect',
        body: 'Your car is ready. We are open until 6pm today and from 8am tomorrow.',
        status: 'SENT',
        provider: 'smtp',
        providerRef: '<a1b2c3@carnet.local>',
        sentAt: day(-1, 16, 40),
        attempts: 1,
        relatedType: 'Job',
        relatedId: null,
      },
      {
        orgId,
        channel: 'SMS',
        toAddress: '+447700900123',
        body: 'Your MOT is due next month. Book at /portal/book and we will have a slot ready.',
        status: 'SENT',
        provider: 'twilio',
        providerRef: 'SM9f8e7d6c',
        sentAt: day(-3, 9, 15),
        attempts: 1,
        relatedType: 'ServiceSchedule',
        relatedId: null,
      },
      // The one worth seeing. A wrong address will not start working on the
      // fourth attempt, so it was not tried a fourth time.
      {
        orgId,
        channel: 'EMAIL',
        toAddress: 'j.okafor@invalid',
        subject: 'Your invoice INV-1039 is overdue',
        body: 'Invoice INV-1039 is now 21 days overdue. Please get in touch.',
        status: 'FAILED',
        provider: 'smtp',
        error: 'Will not be retried: 550 No such mailbox',
        attempts: 1,
        relatedType: 'Invoice',
        relatedId: null,
      },
      // Still being retried. The provider was down, not the address wrong.
      {
        orgId,
        channel: 'EMAIL',
        toAddress: 'fleet@northgatelogistics.test',
        subject: 'Your estimate is ready',
        body: 'There is a quote waiting for your answer.',
        status: 'QUEUED',
        attempts: 2,
        error: 'Connection reset by peer',
        availableAt: day(0, 12, 0),
        relatedType: 'Estimate',
        relatedId: null,
      },
      // Held rather than failed: written at night, and a garage that wakes
      // somebody at three in the morning does not get a third message read.
      {
        orgId,
        channel: 'SMS',
        toAddress: '+447700900456',
        body: 'Your car passed its MOT. Ready whenever suits you.',
        status: 'QUEUED',
        attempts: 0,
        error: 'Texts are held between 20:00 and 8:00 so nobody is woken by their garage.',
        availableAt: day(1, 8, 0),
        relatedType: 'Job',
        relatedId: null,
      },
    ],
  });
}

/**
 * A fleet, and the cover the workshop is standing behind. Phase 9.
 *
 * Two screens in this phase are empty on a seeded database without this, and
 * an empty screen teaches nobody anything about what it is for. The fleet
 * pages only earn their place once one company has several vehicles, and the
 * warranty book only shows its point once one claim is recoverable from a
 * supplier and another is not.
 *
 * So the shapes here are the four a workshop actually meets: cover that is
 * live, cover running out this month, cover whose supplier still covers the
 * part, and cover that expired before the customer came back. The last is the
 * expensive one, and it is the one nothing else in the system would show.
 */
async function seedFleetAndWarranty(
  orgId: string,
  refs: {
    locationId: string;
    bayIds: string[];
    customerId: string;
    transitId: string;
    supplierId: string;
    ownerUserId: string;
    technicianUserId: string;
    advisorUserId: string;
    firstJobNumber: number;
  },
) {
  /* --- two more vans, so the company is a fleet --------------------------- */

  const vivaro = await prisma.vehicle.create({
    data: {
      vin: 'W0LF7ACB8K8600001',
      registration: 'BX70 KHT',
      make: 'Vauxhall',
      model: 'Vivaro',
      variant: '2.0 Turbo D 2900 Sportive',
      year: 2020,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
      bodyType: 'Panel van',
      colour: 'White',
      lastOdometerKm: 118_240,
      firstRegisteredAt: day(-1_820),
    },
  });

  const combo = await prisma.vehicle.create({
    data: {
      vin: 'W0VF7ACB2M8600002',
      registration: 'BJ21 OYD',
      make: 'Vauxhall',
      model: 'Combo Cargo',
      variant: '1.5 Turbo D 2300 Sportive',
      year: 2021,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
      bodyType: 'Panel van',
      colour: 'White',
      lastOdometerKm: 74_900,
      firstRegisteredAt: day(-1_500),
    },
  });

  await prisma.vehicleOwnership.createMany({
    data: [
      {
        vehicleId: vivaro.id,
        ownerName: 'Pennine Plumbing Ltd',
        ownerKind: 'COMPANY',
        startedAt: day(-1_820),
      },
      {
        vehicleId: combo.id,
        ownerName: 'Pennine Plumbing Ltd',
        ownerKind: 'COMPANY',
        startedAt: day(-1_500),
      },
    ],
  });

  // One van overdue, one due inside the month. A fleet manager is measured on
  // downtime, so an overdue van is their problem before it is the workshop's.
  await prisma.serviceSchedule.createMany({
    data: [
      {
        orgId,
        vehicleId: vivaro.id,
        name: 'Annual service',
        intervalMonths: 12,
        intervalKm: 25_000,
        lastPerformedAt: day(-400),
        lastPerformedKm: 92_000,
        dueAt: day(-35),
        dueKm: 117_000,
      },
      {
        orgId,
        vehicleId: combo.id,
        name: 'Annual service',
        intervalMonths: 12,
        intervalKm: 25_000,
        lastPerformedAt: day(-350),
        lastPerformedKm: 51_000,
        dueAt: day(18),
        dueKm: 76_000,
      },
    ],
  });

  /* --- the visits behind those vans --------------------------------------- */

  const vivaroJob = await prisma.job.create({
    data: {
      orgId,
      locationId: refs.locationId,
      number: refs.firstJobNumber,
      customerId: refs.customerId,
      vehicleId: vivaro.id,
      status: 'AWAITING_APPROVAL',
      shortDescription: 'Clutch judder under load',
      details: 'Driver reports judder pulling away with a full van.',
      diagnosis:
        'Clutch plate contaminated by a weeping crankshaft seal. Both need doing together.',
      odometerInKm: 118_240,
      estimatedHours: 6,
      receivedAt: day(-2, 8, 20),
      promisedAt: day(1, 17, 0),
      createdByUserId: refs.advisorUserId,
      technicians: { create: [{ userId: refs.technicianUserId, isPrimary: true }] },
    },
  });

  const comboJob = await prisma.job.create({
    data: {
      orgId,
      locationId: refs.locationId,
      number: refs.firstJobNumber + 1,
      customerId: refs.customerId,
      vehicleId: combo.id,
      bayId: refs.bayIds[2],
      status: 'IN_PROGRESS',
      shortDescription: 'Front discs and pads',
      details: 'Grinding at low speed, worse in the wet.',
      odometerInKm: 74_900,
      estimatedHours: 2.5,
      receivedAt: day(0, 8, 5),
      promisedAt: day(0, 16, 0),
      createdByUserId: refs.advisorUserId,
      technicians: { create: [{ userId: refs.technicianUserId, isPrimary: true }] },
    },
  });

  const transitJob = await prisma.job.create({
    data: {
      orgId,
      locationId: refs.locationId,
      number: refs.firstJobNumber + 2,
      customerId: refs.customerId,
      vehicleId: refs.transitId,
      status: 'PAID',
      shortDescription: 'Battery and alternator belt',
      details: 'Van would not start after standing over a weekend.',
      odometerInKm: 146_500,
      estimatedHours: 1.5,
      receivedAt: day(-210, 8, 30),
      completedAt: day(-210, 12, 10),
      createdByUserId: refs.advisorUserId,
      technicians: { create: [{ userId: refs.technicianUserId, isPrimary: true }] },
    },
  });

  // The visit the expired cover came from. Dated properly, because a warranty
  // that starts before the job that created it is the first thing anybody
  // reading the record would stop and query.
  const springsJob = await prisma.job.create({
    data: {
      orgId,
      locationId: refs.locationId,
      number: refs.firstJobNumber + 3,
      customerId: refs.customerId,
      vehicleId: vivaro.id,
      status: 'PAID',
      shortDescription: 'Rear coil springs',
      details: 'Sitting low at the back, laden and unladen.',
      odometerInKm: 96_800,
      estimatedHours: 2,
      receivedAt: day(-440, 8, 15),
      completedAt: day(-440, 11, 40),
      createdByUserId: refs.advisorUserId,
      technicians: { create: [{ userId: refs.technicianUserId, isPrimary: true }] },
    },
  });

  await prisma.documentSequence.update({
    where: { orgId_kind: { orgId, kind: 'JOB' } },
    data: { next: refs.firstJobNumber + 4 },
  });

  /* --- what the workshop is standing behind -------------------------------- */

  const covers = await Promise.all([
    // Live, and the supplier still covers the part. This is the row the whole
    // screen exists for: replace it under the workshop's own warranty without
    // looking, and the part is never claimed back from anybody.
    prisma.warranty.create({
      data: {
        orgId,
        jobId: transitJob.id,
        vehicleId: refs.transitId,
        kind: 'PART',
        description: 'Battery, 096 AGM',
        startedOn: day(-210),
        months: 24,
        km: 60_000,
        startedAtKm: 146_500,
        partsValue: 96,
        labourValue: 45,
        supplierId: refs.supplierId,
        supplierMonths: 36,
      },
    }),
    // Runs out inside the month. A reason to invite the van back in while the
    // workshop is still the one who would put it right.
    prisma.warranty.create({
      data: {
        orgId,
        jobId: comboJob.id,
        vehicleId: combo.id,
        kind: 'LABOUR',
        description: 'Front brake overhaul, labour',
        startedOn: day(-345),
        months: 12,
        partsValue: 0,
        labourValue: 180,
      },
    }),
    // Expired eleven weeks ago. The customer will still ask, and somebody has
    // to decide whether to do it anyway and say so where it can be counted.
    prisma.warranty.create({
      data: {
        orgId,
        jobId: springsJob.id,
        vehicleId: vivaro.id,
        kind: 'PART',
        description: 'Rear coil springs, pair',
        startedOn: day(-440),
        months: 12,
        partsValue: 148,
        labourValue: 120,
      },
    }),
    prisma.warranty.create({
      data: {
        orgId,
        jobId: vivaroJob.id,
        vehicleId: vivaro.id,
        kind: 'PART',
        description: 'Water pump and thermostat',
        startedOn: day(-95),
        months: 24,
        km: 40_000,
        startedAtKm: 111_000,
        partsValue: 132,
        labourValue: 210,
        supplierId: refs.supplierId,
        supplierMonths: 24,
      },
    }),
  ]);

  // One claim open against a supplier nobody has chased, and one goodwill
  // claim already settled. The first is money outstanding, the second money
  // spent on purpose, and a manager needs both to add up somewhere.
  await prisma.warrantyClaim.create({
    data: {
      warrantyId: covers[0]!.id,
      complaint: 'Will not hold charge overnight. Tested at 8.2V under load.',
      outsideCover: false,
      exposure: 45,
      recoverable: 96,
      raisedByUserId: refs.advisorUserId,
    },
  });

  await prisma.warrantyClaim.create({
    data: {
      warrantyId: covers[2]!.id,
      complaint: 'Nearside spring snapped. Eleven weeks outside the warranty.',
      outsideCover: true,
      goodwillReason: 'Six years a customer, and a spring should not fail in one.',
      exposure: 268,
      recoverable: 0,
      status: 'SETTLED',
      outcome: 'Replaced free of charge. Parts absorbed, labour absorbed.',
      settledAt: day(-20),
      raisedByUserId: refs.ownerUserId,
    },
  });
}

/**
 * Skills, and when people are actually here. Phase 12.
 *
 * Four screens are blank on a seeded database without this, and a blank
 * capacity page teaches nobody what capacity is for. The shape is chosen to
 * show the two things worth seeing on the first morning: a skill that rests
 * on one person, and a skill nobody has at all.
 */
async function seedSkillsAndPatterns(
  orgId: string,
  refs: {
    employees: Map<string, string>;
    jobTypeByName: Map<string, { id: string }>;
  },
) {
  const specs = [
    { name: 'Servicing', note: 'Oil, filters, fluids, the routine work.' },
    { name: 'Brakes', note: 'Pads, discs, fluid, ABS faults.' },
    { name: 'Diagnostics', note: 'Fault codes, live data, electrical tracing.' },
    { name: 'MOT testing', note: 'Class 4 and class 7.' },
    { name: 'Air conditioning', note: 'Regas and leak detection. Needs the certificate.' },
    { name: 'Electric vehicles', note: 'High voltage. Nobody touches one without this.' },
  ];

  const skills = new Map<string, string>();

  for (const [index, spec] of specs.entries()) {
    const skill = await prisma.skill.create({
      data: { orgId, name: spec.name, note: spec.note, sortOrder: index },
      select: { id: true },
    });
    skills.set(spec.name, skill.id);
  }

  // Deliberately uneven. Air conditioning rests on one person and nobody is
  // signed off on electric vehicles at all, which is precisely what the
  // matrix exists to show: the first is a problem the day he is ill, the
  // second is work that has to go out of the door today.
  const signOffs: Record<string, Record<string, 'LEARNING' | 'COMPETENT' | 'EXPERT'>> = {
    'EMP-001': {
      Servicing: 'EXPERT',
      Brakes: 'EXPERT',
      Diagnostics: 'COMPETENT',
      'MOT testing': 'EXPERT',
    },
    'EMP-002': {
      Servicing: 'COMPETENT',
      Brakes: 'COMPETENT',
      Diagnostics: 'EXPERT',
      'Air conditioning': 'COMPETENT',
    },
    'EMP-004': {
      Servicing: 'COMPETENT',
      Brakes: 'LEARNING',
    },
  };

  for (const [reference, held] of Object.entries(signOffs)) {
    const employeeId = refs.employees.get(reference);
    if (!employeeId) continue;

    for (const [skillName, level] of Object.entries(held)) {
      const skillId = skills.get(skillName);
      if (!skillId) continue;

      await prisma.employeeSkill.create({
        data: { employeeId, skillId, level, assessedOn: day(-120) },
      });
    }
  }

  const requirements: { jobType: string; skill: string; level: 'COMPETENT' | 'EXPERT' }[] = [
    { jobType: 'Brake repair', skill: 'Brakes', level: 'COMPETENT' },
    { jobType: 'Major Service', skill: 'Servicing', level: 'COMPETENT' },
    { jobType: 'Interim Service', skill: 'Servicing', level: 'COMPETENT' },
    { jobType: 'Diagnostics', skill: 'Diagnostics', level: 'COMPETENT' },
    { jobType: 'MOT preparation', skill: 'MOT testing', level: 'EXPERT' },
  ];

  for (const requirement of requirements) {
    const jobType = refs.jobTypeByName.get(requirement.jobType);
    const skillId = skills.get(requirement.skill);
    if (!jobType || !skillId) continue;

    await prisma.jobTypeSkill.create({
      data: { jobTypeId: jobType.id, skillId, minimumLevel: requirement.level },
    });
  }

  // A full-timer, one who finishes at one on Friday, and one who is not in on
  // Wednesdays. Capacity that could not tell those three apart is capacity
  // nobody should promise a customer against.
  const patterns: Record<string, { weekday: number; start: number; end: number }[]> = {
    'EMP-001': [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: 8 * 60, end: 17 * 60 })),
    'EMP-002': [
      ...[1, 2, 3, 4].map((weekday) => ({ weekday, start: 8 * 60, end: 17 * 60 })),
      { weekday: 5, start: 8 * 60, end: 13 * 60 },
    ],
    'EMP-004': [1, 2, 4, 5].map((weekday) => ({ weekday, start: 9 * 60, end: 17 * 60 })),
  };

  for (const [reference, week] of Object.entries(patterns)) {
    const employeeId = refs.employees.get(reference);
    if (!employeeId) continue;

    for (const pattern of week) {
      await prisma.workingPattern.create({
        data: {
          orgId,
          employeeId,
          weekday: pattern.weekday,
          startMinute: pattern.start,
          endMinute: pattern.end,
          breakMinutes: 30,
        },
      });
    }
  }
}

/**
 * What the parts fit. Phase 13.
 *
 * Only some of them, deliberately. A seeded database where every part has
 * fitment data would show the feature working and hide the state a real
 * workshop is in on its first day, which is that most parts have none. The
 * screens have to read well in both, and the BMW pads carry a claim that
 * excludes the Toyota so the warning itself can be seen doing something.
 */
async function seedFitment(orgId: string, products: { id: string; partNumber: string }[]) {
  const claims: {
    partNumber: string;
    make: string;
    model?: string;
    yearFrom?: number;
    yearTo?: number;
    source: 'MANUFACTURER' | 'SUPPLIER' | 'WORKSHOP' | 'OBSERVED';
  }[] = [
    // A real catalogue claim, narrow enough to exclude the wrong car.
    {
      partNumber: '34116794300',
      make: 'BMW',
      model: 'X5',
      yearFrom: 2018,
      yearTo: 2023,
      source: 'MANUFACTURER',
    },
    {
      partNumber: '34116864059',
      make: 'BMW',
      model: '320d',
      yearFrom: 2015,
      yearTo: 2021,
      source: 'MANUFACTURER',
    },
    { partNumber: 'TOY-0W20-5L', make: 'Toyota', source: 'SUPPLIER' },
    {
      partNumber: '04152-YZZA1',
      make: 'Toyota',
      model: 'Corolla',
      yearFrom: 2018,
      source: 'SUPPLIER',
    },
    // Recorded by somebody here rather than a catalogue, which is worth less
    // and is shown as worth less.
    { partNumber: '87139-0D070', make: 'Toyota', model: 'Corolla', source: 'WORKSHOP' },
  ];

  for (const claim of claims) {
    const product = products.find((entry) => entry.partNumber === claim.partNumber);
    if (!product) continue;

    await prisma.partFitment.create({
      data: {
        orgId,
        productId: product.id,
        make: claim.make,
        model: claim.model ?? null,
        yearFrom: claim.yearFrom ?? null,
        yearTo: claim.yearTo ?? null,
        source: claim.source,
      },
    });
  }
}
