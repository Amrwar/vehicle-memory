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

import { chainEvent, eventsForCompletedJob, type DraftEvent } from '@carnet/core';
import bcrypt from 'bcryptjs';

import { prisma } from '../src/client';

const PASSWORD = 'carnet-demo-2026';
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

  // Order matters: children before parents.
  await prisma.$transaction([
    prisma.passportShareAccess.deleteMany(),
    prisma.passportShare.deleteMany(),
    prisma.vehicleEventAttachment.deleteMany(),
    prisma.vehicleEvent.deleteMany(),
    prisma.odometerReading.deleteMany(),
    prisma.vehicleAccessGrant.deleteMany(),
    prisma.vehicleRecall.deleteMany(),
    prisma.recall.deleteMany(),
    prisma.vehicleOwnership.deleteMany(),
    prisma.serviceSchedule.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.session.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.user.deleteMany(),
  ]);

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
      plan: 'COMPLETE',
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
          { name: 'Brake repair', colour: '#973030', requiresQualityCheck: true, defaultHours: 3.5 },
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
          { code: 'BRK-FRT', name: 'Front brake pads and discs', defaultHours: 2.5, defaultPrice: 320 },
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
      { email: 'ahmed@hillsidemotors.test', name: 'Ahmed Bakri', role: 'OWNER' as const, cost: null },
      { email: 'sara@hillsidemotors.test', name: 'Sara Whitfield', role: 'SERVICE_ADVISOR' as const, cost: null },
      { email: 'john@hillsidemotors.test', name: 'John Adeyemi', role: 'TECHNICIAN' as const, cost: 38 },
      { email: 'mike@hillsidemotors.test', name: 'Mike Sowande', role: 'TECHNICIAN' as const, cost: 34 },
      { email: 'fatima@hillsidemotors.test', name: 'Fatima Rahal', role: 'BOOKKEEPER' as const, cost: null },
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
                { name: 'Front left tread', measurementType: 'TREAD_DEPTH_MM', position: 'FRONT_LEFT', sortOrder: 1 },
                { name: 'Front right tread', measurementType: 'TREAD_DEPTH_MM', position: 'FRONT_RIGHT', sortOrder: 2 },
                { name: 'Rear left tread', measurementType: 'TREAD_DEPTH_MM', position: 'REAR_LEFT', sortOrder: 3 },
                { name: 'Rear right tread', measurementType: 'TREAD_DEPTH_MM', position: 'REAR_RIGHT', sortOrder: 4 },
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

  // Odometer history, including one deliberately impossible reading so the
  // fraud-detection path is visible in the demo.
  await prisma.odometerReading.createMany({
    data: [
      { vehicleId: bmw.id, km: 41_220, readAt: yearsAgo(4, 3, 14), source: 'WORKSHOP', anomaly: 'NONE' },
      { vehicleId: bmw.id, km: 58_940, readAt: yearsAgo(3, 10, 2), source: 'WORKSHOP', anomaly: 'NONE' },
      { vehicleId: bmw.id, km: 67_410, readAt: yearsAgo(2, 4, 27), source: 'WORKSHOP', anomaly: 'NONE' },
      { vehicleId: bmw.id, km: 62_000, readAt: yearsAgo(2, 1, 9), source: 'OWNER', anomaly: 'DECREASE' },
      { vehicleId: bmw.id, km: 74_800, readAt: yearsAgo(1, 6, 2), source: 'WORKSHOP', anomaly: 'NONE' },
      { vehicleId: bmw.id, km: 78_150, readAt: yearsAgo(1, 2, 19), source: 'WORKSHOP', anomaly: 'NONE' },
      { vehicleId: bmw.id, km: 82_430, readAt: day(-1), source: 'WORKSHOP', anomaly: 'NONE' },
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
          { fromStatus: 'RECEIVED', toStatus: 'INSPECTING', actorUserId: john!.id, createdAt: day(0, 8, 40) },
          { fromStatus: 'INSPECTING', toStatus: 'DIAGNOSED', actorUserId: john!.id, createdAt: day(0, 9, 25) },
          { fromStatus: 'DIAGNOSED', toStatus: 'ESTIMATED', actorUserId: sara!.id, createdAt: day(0, 9, 50) },
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
          { title: 'Remove front wheels', sortOrder: 1, isDone: true, doneByUserId: john!.id, doneAt: day(0, 8, 50) },
          { title: 'Inspect brakes', sortOrder: 2, isDone: true, doneByUserId: john!.id, doneAt: day(0, 9, 10) },
          { title: 'Replace front pads', sortOrder: 3 },
          { title: 'Replace front discs', sortOrder: 4 },
          { title: 'Bed in and road test', sortOrder: 5 },
          { title: 'Final inspection', sortOrder: 6 },
        ],
      },
      labourLines: {
        create: [
          { description: 'Brake inspection', hours: 1.0, rate: 95, taxRateId: vat.id, sortOrder: 1 },
          { description: 'Front brake pad and disc replacement', hours: 3.5, rate: 95, taxRateId: vat.id, sortOrder: 2 },
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
          { sectionName: 'Brakes', itemName: 'Front pads', severity: 'CRITICAL', measurementValue: 1.5, measurementType: 'PAD_THICKNESS_MM', note: 'Worn to the backing plate on the outer pad.', recommendedAction: 'Replace front brake pads', estimatedCost: 420, sortOrder: 1 },
          { sectionName: 'Brakes', itemName: 'Front discs', severity: 'CRITICAL', measurementValue: 25.4, measurementType: 'DISC_THICKNESS_MM', note: 'Below the 26mm minimum. Heavy lipping.', recommendedAction: 'Replace front brake discs', estimatedCost: 410, sortOrder: 2 },
          { sectionName: 'Tyres', itemName: 'Front left tread', severity: 'ADVISORY', measurementValue: 2.8, measurementType: 'TREAD_DEPTH_MM', position: 'FRONT_LEFT', note: 'Approaching the legal minimum of 1.6mm.', recommendedAction: 'Replace front left tyre', estimatedCost: 165, sortOrder: 3 },
          { sectionName: 'Under bonnet', itemName: 'Battery condition', severity: 'ADVISORY', measurementValue: 11.9, measurementType: 'VOLTAGE', note: 'Holds charge but weak under load test.', recommendedAction: 'Replace battery', estimatedCost: 240, sortOrder: 4 },
          { sectionName: 'Under bonnet', itemName: 'Auxiliary belt', severity: 'ADVISORY', note: 'Light surface cracking. Monitor at next service.', sortOrder: 5 },
          { sectionName: 'Brakes', itemName: 'Rear pads', severity: 'PASS', measurementValue: 7.2, measurementType: 'PAD_THICKNESS_MM', sortOrder: 6 },
          { sectionName: 'Tyres', itemName: 'Rear left tread', severity: 'PASS', measurementValue: 5.4, measurementType: 'TREAD_DEPTH_MM', position: 'REAR_LEFT', sortOrder: 7 },
          { sectionName: 'Tyres', itemName: 'Rear right tread', severity: 'PASS', measurementValue: 5.6, measurementType: 'TREAD_DEPTH_MM', position: 'REAR_RIGHT', sortOrder: 8 },
          { sectionName: 'Exterior', itemName: 'Lights and indicators', severity: 'PASS', sortOrder: 9 },
          { sectionName: 'Under bonnet', itemName: 'Engine oil level and condition', severity: 'PASS', sortOrder: 10 },
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
          { kind: 'LABOUR', description: 'Brake inspection', quantity: 1, unitPrice: 95, lineTotal: 95, taxRateId: vat.id, sortOrder: 1 },
          { kind: 'LABOUR', description: 'Front brake pad and disc replacement', quantity: 3.5, unitPrice: 95, lineTotal: 332.5, taxRateId: vat.id, sortOrder: 2 },
          { kind: 'PART', description: 'BMW front brake pad set', quantity: 1, unitPrice: 420, unitCost: 252, lineTotal: 420, taxRateId: vat.id, sortOrder: 3 },
          { kind: 'PART', description: 'BMW front brake discs (pair)', quantity: 1, unitPrice: 410, unitCost: 246, lineTotal: 410, taxRateId: vat.id, sortOrder: 4 },
          { kind: 'PART', description: 'Front left tyre — Michelin 265/50 R19', quantity: 1, unitPrice: 165, unitCost: 104, lineTotal: 165, taxRateId: vat.id, isOptional: true, sortOrder: 5 },
          { kind: 'PART', description: 'Battery — 90Ah AGM', quantity: 1, unitPrice: 240, unitCost: 151, lineTotal: 240, taxRateId: vat.id, isOptional: true, sortOrder: 6 },
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
          { fromStatus: 'RECEIVED', toStatus: 'IN_PROGRESS', actorUserId: mike!.id, createdAt: day(-6, 9, 0) },
          { fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', actorUserId: mike!.id, createdAt: day(-6, 15, 10) },
          { fromStatus: 'COMPLETED', toStatus: 'INVOICED', actorUserId: sara!.id, createdAt: day(-6, 15, 30) },
          { fromStatus: 'INVOICED', toStatus: 'PAID', actorUserId: sara!.id, createdAt: day(-6, 16, 5) },
        ],
      },
      labourLines: {
        create: [{ description: 'Interim service', hours: 1.5, rate: 95, taxRateId: vat.id, sortOrder: 1 }],
      },
      partLines: {
        create: [
          { description: 'Engine oil 0W-20, 4.2L', partNumber: 'TOY-0W20-5L', quantity: 1, unitCost: 28, unitPrice: 52, taxRateId: vat.id, status: 'FITTED', sortOrder: 1 },
          { description: 'Oil filter', partNumber: '04152-YZZA1', quantity: 1, unitCost: 8, unitPrice: 18, taxRateId: vat.id, status: 'FITTED', sortOrder: 2 },
          { description: 'Cabin filter', partNumber: '87139-0D070', quantity: 1, unitCost: 11, unitPrice: 24, taxRateId: vat.id, status: 'FITTED', sortOrder: 3 },
        ],
      },
      timeEntries: {
        create: [{ userId: mike!.id, startedAt: day(-6, 9, 0), endedAt: day(-6, 11, 12), minutes: 132, costRate: 34 }],
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
              { kind: 'LABOUR', description: 'Interim service, 1.5h', quantity: 1.5, unitPrice: 95, lineTotal: 142.5, taxAmount: 28.5, taxRateId: vat.id, sortOrder: 1 },
              { kind: 'PART', description: 'Engine oil 0W-20', quantity: 1, unitPrice: 52, lineTotal: 52, taxAmount: 10.4, taxRateId: vat.id, sortOrder: 2 },
              { kind: 'PART', description: 'Oil filter', quantity: 1, unitPrice: 18, lineTotal: 18, taxAmount: 3.6, taxRateId: vat.id, sortOrder: 3 },
              { kind: 'PART', description: 'Cabin filter', quantity: 1, unitPrice: 24, lineTotal: 24, taxAmount: 4.8, taxRateId: vat.id, sortOrder: 4 },
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
      { orgId: org.id, locationId: location.id, customerId: mariaCustomer.id, vehicleId: bmw.id, bayId: bays[0]!.id, technicianId: john!.id, status: 'CONVERTED', startAt: day(0, 8, 0), endAt: day(0, 12, 30), estimatedHours: 4.5, description: 'Brake system repair', source: 'PHONE', jobId: brakeJob.id },
      { orgId: org.id, locationId: location.id, customerId: mariaCustomer.id, vehicleId: civic.id, bayId: bays[1]!.id, technicianId: mike!.id, status: 'SCHEDULED', startAt: day(0, 9, 0), endAt: day(0, 10, 30), estimatedHours: 1.5, description: 'Interim service', source: 'PORTAL' },
      { orgId: org.id, locationId: location.id, customerId: pennine.id, vehicleId: transit.id, bayId: bays[3]!.id, technicianId: john!.id, status: 'SCHEDULED', startAt: day(0, 13, 0), endAt: day(0, 15, 0), estimatedHours: 2, description: 'Diagnostics — intermittent EML', source: 'PHONE' },
      { orgId: org.id, locationId: location.id, customerId: ahmedCustomer.id, vehicleId: corolla.id, bayId: bays[2]!.id, technicianId: mike!.id, status: 'SCHEDULED', startAt: day(1, 8, 30), endAt: day(1, 10, 0), estimatedHours: 1.5, description: 'Four wheel alignment', source: 'WALK_IN' },
      { orgId: org.id, locationId: location.id, customerId: pennine.id, vehicleId: transit.id, bayId: bays[0]!.id, technicianId: john!.id, status: 'SCHEDULED', startAt: day(2, 9, 0), endAt: day(2, 12, 0), estimatedHours: 3, description: 'Cambelt and water pump', source: 'PHONE' },
      { orgId: org.id, locationId: location.id, customerId: mariaCustomer.id, vehicleId: bmw.id, bayId: bays[1]!.id, technicianId: mike!.id, status: 'SCHEDULED', startAt: day(3, 10, 0), endAt: day(3, 11, 0), estimatedHours: 1, description: 'Recall — EGR cooler', source: 'RECALL' },
    ],
  });

  /* --- a shared passport link -------------------------------------------- */

  await prisma.passportShare.create({
    data: {
      vehicleId: bmw.id,
      // Demo link: /p/demo-share-token
      tokenHash: '3c9e2a4b6d8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c',
      label: 'Shared with a prospective buyer',
      createdByUserId: maria!.id,
      expiresAt: day(30),
    },
  });

  console.info(`
  Seeded.

    Organisation   ${org.name}
    Prior workshop ${priorWorkshop.name} (wrote 7 entries to the BMW's passport)
    Users          ${[ahmed, sara, john, mike, fatima, maria, david].length}
    Vehicles       4
    Jobs           2 (one awaiting approval, one paid)

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
