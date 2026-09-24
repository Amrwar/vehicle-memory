import { eventsForCompletedJob, money, uniqueSlug } from '@carnet/core';

import { slugsLike } from './onboarding';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts } from './accounting';
import { audit } from './guard';
import { createJob } from './jobs';
import { issueInvoice, recordPayment } from './money';
import { appendEvents } from './passport';

/**
 * A workshop to look around. Phase 45.
 *
 * Reading about a product is not the same as seeing a year of work in it. A
 * new workshop's own screens are empty — correctly, because they have not done
 * anything yet — and empty screens teach nobody what a busy diary, a month of
 * invoices or a vehicle with a history actually look like.
 *
 * So the product can build a second workshop, full of made-up work, that the
 * same person can move into and out of. It is marked as a demonstration
 * everywhere it appears, its vehicles are kept off the network, and it can be
 * removed whole — which is why its vehicles are the one exception to the
 * append-only rule, in the database rather than in this file.
 *
 * The data is generated through the same functions the product uses for real
 * work: real job numbers, real invoices, real ledger entries, real passport
 * entries. A demonstration built out of rows written straight to the database
 * would show a product that behaves differently from the real one, which is
 * the one thing a demonstration must not do.
 */

const DEMONSTRATION_NAME = 'Ashford Vale Motors (demonstration)';

/** Fixed, so two demonstrations look the same and neither looks random. */
function picker(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
}

const CUSTOMERS = [
  { name: 'Hannah Prescott', email: 'hannah@example.test', mobile: '07700 900301' },
  { name: 'Okonkwo Haulage', email: 'fleet@okonkwo.example', mobile: '07700 900302' },
  { name: 'Ruth Ellery', email: 'ruth@example.test', mobile: '07700 900303' },
  { name: 'Sam Whitlock', email: 'sam@example.test', mobile: '07700 900304' },
  { name: 'Aisha Rahman', email: 'aisha@example.test', mobile: '07700 900305' },
  { name: 'Bramley Joinery', email: 'office@bramley.example', mobile: '07700 900306' },
];

const VEHICLES = [
  {
    vin: 'DEMOVALE000000001',
    registration: 'AV19 HPR',
    make: 'Toyota',
    model: 'Corolla',
    year: 2019,
    km: 68_000,
    customer: 0,
  },
  {
    vin: 'DEMOVALE000000002',
    registration: 'AV18 OKH',
    make: 'Ford',
    model: 'Transit',
    year: 2018,
    km: 141_000,
    customer: 1,
  },
  {
    vin: 'DEMOVALE000000003',
    registration: 'AV20 OKT',
    make: 'Ford',
    model: 'Transit Custom',
    year: 2020,
    km: 96_000,
    customer: 1,
  },
  {
    vin: 'DEMOVALE000000004',
    registration: 'AV17 REL',
    make: 'Volkswagen',
    model: 'Golf',
    year: 2017,
    km: 87_000,
    customer: 2,
  },
  {
    vin: 'DEMOVALE000000005',
    registration: 'AV21 SWH',
    make: 'BMW',
    model: '320d',
    year: 2021,
    km: 44_000,
    customer: 3,
  },
  {
    vin: 'DEMOVALE000000006',
    registration: 'AV16 ARH',
    make: 'Nissan',
    model: 'Qashqai',
    year: 2016,
    km: 112_000,
    customer: 4,
  },
  {
    vin: 'DEMOVALE000000007',
    registration: 'AV22 BRJ',
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    year: 2022,
    km: 58_000,
    customer: 5,
  },
  {
    vin: 'DEMOVALE000000008',
    registration: 'AV15 HPS',
    make: 'Honda',
    model: 'Jazz',
    year: 2015,
    km: 74_000,
    customer: 0,
  },
];

const PRODUCTS = [
  {
    partNumber: 'DV-OIL-5W30',
    name: 'Engine oil, 5W-30, 5 litres',
    brand: 'Comma',
    cost: 21.4,
    sell: 44,
  },
  { partNumber: 'DV-OF-1042', name: 'Oil filter', brand: 'Mann', cost: 4.8, sell: 12.5 },
  { partNumber: 'DV-AF-2210', name: 'Air filter', brand: 'Mann', cost: 7.2, sell: 18 },
  { partNumber: 'DV-CF-3310', name: 'Cabin filter', brand: 'Bosch', cost: 8.9, sell: 22 },
  { partNumber: 'DV-BP-4401', name: 'Brake pads, front', brand: 'Brembo', cost: 32.5, sell: 78 },
  {
    partNumber: 'DV-BD-4402',
    name: 'Brake discs, front, pair',
    brand: 'Brembo',
    cost: 58,
    sell: 132,
  },
  { partNumber: 'DV-BAT-090', name: 'Battery, 090 AGM', brand: 'Varta', cost: 84, sell: 165 },
  { partNumber: 'DV-WIP-24', name: 'Wiper blades, pair', brand: 'Bosch', cost: 11.2, sell: 28 },
  {
    partNumber: 'DV-CLT-G12',
    name: 'Coolant, G12, 5 litres',
    brand: 'Comma',
    cost: 13.6,
    sell: 32,
  },
  { partNumber: 'DV-SP-4x', name: 'Spark plugs, set of four', brand: 'NGK', cost: 18.4, sell: 46 },
];

const WORK = [
  { description: 'Interim service', hours: 1.5, parts: ['DV-OIL-5W30', 'DV-OF-1042'] },
  {
    description: 'Major service',
    hours: 3,
    parts: ['DV-OIL-5W30', 'DV-OF-1042', 'DV-AF-2210', 'DV-CF-3310'],
  },
  { description: 'Front brakes, pads and discs', hours: 2.5, parts: ['DV-BP-4401', 'DV-BD-4402'] },
  { description: 'Battery replaced', hours: 0.5, parts: ['DV-BAT-090'] },
  { description: 'MOT preparation', hours: 1, parts: ['DV-WIP-24'] },
  { description: 'Cooling system flush', hours: 2, parts: ['DV-CLT-G12'] },
  { description: 'Misfire diagnosed, plugs replaced', hours: 1.5, parts: ['DV-SP-4x'] },
];

/** The demonstration this person can look around, if they have one. */
export async function demonstrationFor(userId: string) {
  return prisma.organization.findFirst({
    where: { isDemonstration: true, memberships: { some: { userId, isActive: true } } },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
}

/**
 * Builds the demonstration workshop, or hands back the one already built.
 *
 * Everything is written through the product's own functions, so the numbering,
 * the ledger and the vehicle histories are the real ones. It takes a few
 * seconds, which is the honest cost of a year of work.
 */
export async function createDemonstration(input: {
  userId: string;
  now?: Date;
}): Promise<{ orgId: string; created: boolean }> {
  const existing = await demonstrationFor(input.userId);
  if (existing) return { orgId: existing.id, created: false };

  const now = input.now ?? new Date();
  const slug = uniqueSlug(
    'ashford-vale-demonstration',
    await slugsLike('ashford-vale-demonstration'),
  );
  const random = picker(20_260_915);

  const org = await prisma.organization.create({
    data: {
      slug,
      name: DEMONSTRATION_NAME,
      legalName: 'Ashford Vale Motors Limited',
      taxNumber: 'GB000000000',
      email: 'workshop@ashfordvale.example',
      phone: '01274 000000',
      isDemonstration: true,
      plan: 'COMPLETE',
      trialEndsAt: new Date(now.getTime() + 30 * 86_400_000),
      locations: {
        create: {
          name: 'Ashford Vale',
          code: 'MAIN',
          addressLine1: '12 Ashford Vale Industrial Estate',
          locality: 'Bradford',
          postcode: 'BD4 0AA',
          isDefault: true,
          dailyCapacityHours: 32,
          bays: {
            create: [
              { name: 'Ramp 1', code: 'B1', sortOrder: 1 },
              { name: 'Ramp 2', code: 'B2', sortOrder: 2 },
              { name: 'MOT bay', code: 'B3', sortOrder: 3 },
            ],
          },
        },
      },
      taxRates: {
        create: [
          {
            name: 'Standard',
            rate: 20,
            isDefault: true,
            components: { create: [{ name: 'VAT', rate: 20, sortOrder: 0 }] },
          },
        ],
      },
      jobTypes: {
        create: [
          { name: 'Service', colour: '#1f6167', defaultHours: 2, requiresQualityCheck: true },
          { name: 'Repair', colour: '#973030', defaultHours: 2.5, requiresQualityCheck: true },
          { name: 'MOT preparation', colour: '#2c6e4b', defaultHours: 1 },
        ],
      },
      sequences: {
        create: [
          { kind: 'JOB', prefix: '', next: 1 },
          { kind: 'INVOICE', prefix: 'INV-', next: 1 },
          { kind: 'ESTIMATE', prefix: 'EST-', next: 1 },
        ],
      },
      warehouses: { create: { name: 'Main store', code: 'MAIN', isDefault: true } },
      memberships: { create: { userId: input.userId, role: 'OWNER', isActive: true } },
      labourRates: {
        create: [
          { name: 'Standard', perHour: 92, isDefault: true },
          { name: 'MOT', perHour: 60 },
        ],
      },
    },
    select: {
      id: true,
      name: true,
      locations: { select: { id: true } },
      warehouses: { select: { id: true } },
      taxRates: { select: { id: true } },
      jobTypes: { select: { id: true, name: true } },
    },
  });

  await ensureChartOfAccounts(org.id);

  const locationId = org.locations[0]!.id;
  const warehouseId = org.warehouses[0]!.id;
  const taxRateId = org.taxRates[0]!.id;

  // A supplier to buy from, so purchasing has somebody in it.
  await prisma.supplier.create({
    data: {
      orgId: org.id,
      name: 'Pennine Motor Factors (demonstration)',
      email: 'trade@pennine.example',
      accountRef: 'AV-4410',
      phone: '01274 000001',
    },
  });

  const products = new Map<string, { id: string; cost: number; sell: number; name: string }>();
  for (const product of PRODUCTS) {
    const row = await prisma.product.create({
      data: {
        orgId: org.id,
        partNumber: product.partNumber,
        name: product.name,
        brand: product.brand,
        costPrice: product.cost,
        sellPrice: product.sell,
        reorderPoint: 2,
        reorderQty: 6,
        stockLevels: {
          create: {
            warehouseId,
            onHand: 4 + Math.floor(random() * 12),
            avgCost: product.cost,
          },
        },
      },
      select: { id: true },
    });
    products.set(product.partNumber, {
      id: row.id,
      cost: product.cost,
      sell: product.sell,
      name: product.name,
    });
  }

  const customers: string[] = [];
  for (const customer of CUSTOMERS) {
    const row = await prisma.customer.create({
      data: {
        orgId: org.id,
        displayName: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        marketingEmailConsent: true,
      },
      select: { id: true },
    });
    customers.push(row.id);
  }

  // Each car starts the year lower than it ends it, because a reading that
  // goes backwards is refused, as it should be.
  const KILOMETRES_A_YEAR = 14_000;
  const vehicles: { id: string; km: number; customerId: string; label: string }[] = [];
  for (const vehicle of VEHICLES) {
    const row = await prisma.vehicle.create({
      data: {
        vin: vehicle.vin,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        lastOdometerKm: vehicle.km - KILOMETRES_A_YEAR,
        isDemonstration: true,
        ownerships: {
          create: {
            ownerName: CUSTOMERS[vehicle.customer]!.name,
            ownerKind: vehicle.customer === 1 || vehicle.customer === 5 ? 'COMPANY' : 'PRIVATE',
            startedAt: new Date(now.getTime() - 1_100 * 86_400_000),
          },
        },
      },
      select: { id: true },
    });

    vehicles.push({
      id: row.id,
      km: vehicle.km - KILOMETRES_A_YEAR,
      customerId: customers[vehicle.customer]!,
      label: `${vehicle.make} ${vehicle.model}`,
    });
  }

  /* A year of work, four jobs a month, oldest first so the numbers run in
     order and each vehicle's history reads forwards. */
  const serviceType = org.jobTypes.find((type) => type.name === 'Service')?.id ?? null;

  for (let monthsAgo = 12; monthsAgo >= 1; monthsAgo -= 1) {
    for (let index = 0; index < 4; index += 1) {
      const vehicle = vehicles[Math.floor(random() * vehicles.length)]!;
      const work = WORK[Math.floor(random() * WORK.length)]!;
      const when = new Date(now.getTime() - (monthsAgo * 30 - index * 6) * 86_400_000);
      // The car has been driven since it was last in, so the reading rises.
      vehicle.km += 300 + Math.round(random() * 900);
      const odometer = vehicle.km;

      const job = await createJob({
        orgId: org.id,
        userId: input.userId,
        locationId,
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        shortDescription: work.description,
        odometerInKm: odometer,
        jobTypeId: serviceType,
      });

      const labourRate = 92;
      await prisma.jobLabourLine.create({
        data: {
          jobId: job.id,
          description: work.description,
          hours: work.hours,
          rate: labourRate,
          taxRateId,
        },
      });

      const parts = work.parts.map((partNumber) => products.get(partNumber)!);
      for (const part of parts) {
        await prisma.jobPartLine.create({
          data: {
            jobId: job.id,
            productId: part.id,
            partNumber: PRODUCTS.find((entry) => entry.name === part.name)?.partNumber ?? null,
            description: part.name,
            quantity: 1,
            unitPrice: part.sell,
            unitCost: part.cost,
            status: 'FITTED',
            taxRateId,
          },
        });
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', startedAt: when, completedAt: when, createdAt: when },
      });

      const invoiceId = await issueInvoice({
        orgId: org.id,
        userId: input.userId,
        jobId: job.id,
      });

      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { issuedAt: when, dueAt: new Date(when.getTime() + 14 * 86_400_000) },
        select: { id: true, total: true, currency: true, number: true },
      });

      // Most are paid; a few of the recent ones are still out, because a
      // workshop with nothing outstanding is not a workshop.
      if (monthsAgo > 1 || index < 2) {
        await recordPayment({
          orgId: org.id,
          userId: input.userId,
          invoiceId: invoice.id,
          amount: money(Math.round(Number(invoice.total) * 100), invoice.currency),
          method: random() > 0.5 ? 'CARD' : 'BANK_TRANSFER',
          receivedAt: new Date(when.getTime() + 2 * 86_400_000),
        });
      }

      await appendEvents(
        eventsForCompletedJob({
          jobId: job.id,
          jobNumber: job.number,
          vehicleId: vehicle.id,
          orgId: org.id,
          orgName: org.name,
          completedAt: when,
          shortDescription: work.description,
          odometerKm: odometer,
          labour: [{ description: work.description, hours: work.hours }],
          parts: parts.map((part) => ({
            id: part.id,
            description: part.name,
            quantity: 1,
          })),
        }),
      );
    }
  }

  /* This week, so the diary and the shop floor have something in them. */
  const soon = [
    { days: 0, status: 'IN_PROGRESS' as const, description: 'Brake judder investigated' },
    { days: 0, status: 'AWAITING_APPROVAL' as const, description: 'Rear springs, quoted' },
    { days: 1, status: 'BOOKED' as const, description: 'Interim service' },
    { days: 2, status: 'BOOKED' as const, description: 'MOT preparation' },
  ];

  for (const [index, entry] of soon.entries()) {
    const vehicle = vehicles[index % vehicles.length]!;
    const job = await createJob({
      orgId: org.id,
      userId: input.userId,
      locationId,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      shortDescription: entry.description,
      odometerInKm: vehicle.km,
      jobTypeId: serviceType,
      promisedAt: new Date(now.getTime() + entry.days * 86_400_000 + 16 * 3_600_000),
    });

    await prisma.jobLabourLine.create({
      data: { jobId: job.id, description: entry.description, hours: 1.5, rate: 92, taxRateId },
    });

    if (entry.status !== 'BOOKED') {
      await prisma.job.update({ where: { id: job.id }, data: { status: entry.status } });
    }
  }

  /* A service due on every vehicle, so the reminders have work to do. */
  for (const [index, vehicle] of vehicles.entries()) {
    await prisma.serviceSchedule.create({
      data: {
        orgId: org.id,
        vehicleId: vehicle.id,
        name: 'Annual service',
        dueAt: new Date(now.getTime() + (index * 9 - 10) * 86_400_000),
        dueKm: vehicle.km + 8_000,
        intervalMonths: 12,
        intervalKm: 16_000,
        lastPerformedAt: new Date(now.getTime() - (355 - index * 9) * 86_400_000),
        lastPerformedKm: vehicle.km - 8_000,
      },
    });
  }

  // The invoices and receipts the generator sent queued real messages to
  // made-up addresses. They are marked here rather than left for the sweep,
  // so nothing is ever in flight to a domain somebody else owns.
  await prisma.messageLog.updateMany({
    where: { orgId: org.id, status: 'QUEUED' },
    data: { status: 'SUPPRESSED', error: 'Demonstration workshop: nothing is sent.' },
  });

  await audit({
    orgId: org.id,
    actorUserId: input.userId,
    action: 'demonstration.created',
    entityType: 'Organization',
    entityId: org.id,
    after: { vehicles: vehicles.length, customers: customers.length },
  });

  return { orgId: org.id, created: true };
}

/**
 * Takes the demonstration away again, in full.
 *
 * The organisation cascades to everything inside it; the vehicles are global,
 * so they are deleted by hand, which the database permits only because they
 * are marked as demonstration data.
 */
export async function removeDemonstration(input: { userId: string; orgId: string }): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: {
      id: input.orgId,
      isDemonstration: true,
      memberships: { some: { userId: input.userId, isActive: true } },
    },
    select: { id: true, name: true },
  });

  if (!org) throw new Error('That demonstration workshop is not one of yours.');

  const vehicles = await prisma.vehicle.findMany({
    where: { isDemonstration: true, jobs: { every: { orgId: org.id } } },
    select: { id: true },
  });

  // Anybody looking at the demonstration is sent back to their own workshop.
  // Null, and then the chooser: until Phase 63 a null organisation meant
  // `memberships[0]`, so "their own workshop" was whichever row came back
  // first. Somebody on one team lands straight back in it; somebody on two is
  // asked, which is the point of the phase.
  await prisma.session.updateMany({ where: { orgId: org.id }, data: { orgId: null } });

  // Consent rows go first, while the workshop is still there to be recognised
  // as a demonstration: once the organisation is gone the database has no way
  // to tell these rows from somebody's real permission, and refuses them.
  await prisma.consentChange.deleteMany({ where: { customer: { orgId: org.id } } });

  // The ledger holds its accounts against deletion while any line points at
  // them, which is right everywhere else. Here the whole set goes together,
  // entries first, so the cascade is not asked to guess the order.
  await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });

  // The events go before the vehicles, not with them: the database decides
  // whether an event may be deleted by reading its vehicle, and a vehicle
  // deleted in the same statement is one it can no longer read.
  //
  // And both go before the workshop, not after it. A passport entry's hash
  // covers the id of the workshop that wrote it, so a workshop with entries
  // still pointing at it cannot be deleted -- the database refuses, since
  // Phase 72. Made-up history is the one exception, and this is it.
  const ids = vehicles.map((row) => row.id);
  await prisma.vehicleEvent.deleteMany({ where: { vehicleId: { in: ids } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: ids } } });

  // Unless the demonstration workshop wrote to a real car. Somebody who books
  // their own vehicle into the demonstration to see how it feels leaves an
  // entry in a passport that is evidence, and that entry stays. The workshop
  // is then retired rather than deleted, exactly as a closing workshop is.
  const written = await prisma.vehicleEvent.count({ where: { recordedByOrgId: org.id } });

  if (written > 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { name: `${org.name} (closed)`, isActive: false, isDemonstration: false },
    });
  } else {
    await prisma.organization.delete({ where: { id: org.id } });
  }

  await audit({
    actorUserId: input.userId,
    action: 'demonstration.removed',
    entityType: 'Organization',
    entityId: org.id,
    after: { vehicles: vehicles.length, retained: written },
  });
}

/*
 * Moving between workshops used to live here, because the demonstration is a
 * second organisation and entering it is the same movement. It is now in
 * `belonging.ts` with the rest of FR-108: a tenant boundary crossing is not a
 * detail of the demonstration feature, and it needed an audit record and a
 * refusal somebody could read. `switchWorkshop` and `workshopsFor` are
 * `enterWorkshop` and `workshopsFor` there.
 */
