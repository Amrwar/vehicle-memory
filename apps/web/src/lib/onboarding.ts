import {
  describeSetup,
  type PlanId,
  planFor,
  type SignupInput,
  type SignupProblem,
  trialEndsOn,
  uniqueSlug,
  validateSignup,
  countryFor,
  regionForCountry,
  type SetupFacts,
  setupProgress,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts } from './accounting';
import { hashPassword } from './auth';
import { audit } from './guard';
import { breachedPasswordProblem } from './breach';
import { tellOperatorAboutSignup } from './operator';

/**
 * Opening a workshop.
 *
 * The first object created is the organisation, not the person. Everything in
 * this system hangs off an organisation, so an account that exists without one
 * is a row with nowhere to live, and every query that assumes tenancy has to
 * learn about the exception.
 *
 * Everything below happens in one transaction. A half-created workshop, with a
 * user but no membership or a location but no tax rate, is worse than a failed
 * sign-up: the person can sign in, sees a broken shell, and cannot try again
 * because their email is taken.
 */

export interface SignupOutcome {
  ok: boolean;
  problems: SignupProblem[];
  orgSlug?: string;
  /** Present on success. The caller starts the session, so this function can
   *  be exercised outside a request. Anything that needs `cookies()` cannot be
   *  tested against a real database, and this is the one path where a
   *  half-created workshop is unrecoverable for the person it happens to. */
  userId?: string;
}

/**
 * A new workshop needs enough furniture to take a booking on day one.
 *
 * Not a blank slate. A workshop that signs up and finds no tax rate, no job
 * types and no bays has to do configuration before it can do work, and most
 * people abandon at exactly that point. These are defaults to edit, not
 * decisions made for them.
 */
const DEFAULT_JOB_TYPES = [
  { name: 'Major service', colour: '#1f6167', defaultHours: 3, requiresQualityCheck: true },
  { name: 'Interim service', colour: '#2f7a80', defaultHours: 1.5, requiresQualityCheck: false },
  { name: 'Brake repair', colour: '#973030', defaultHours: 3, requiresQualityCheck: true },
  { name: 'Diagnostics', colour: '#9a6d24', defaultHours: 1, requiresQualityCheck: false },
  { name: 'Tyres', colour: '#1f5f8b', defaultHours: 1, requiresQualityCheck: false },
  { name: 'MOT preparation', colour: '#2c6e4b', defaultHours: 1, requiresQualityCheck: false },
];

export async function createWorkshop(
  input: SignupInput,
  options: { plan?: PlanId; acceptConsumerEmail?: boolean; termsVersion?: string | null } = {},
): Promise<SignupOutcome> {
  const problems = validateSignup(input);

  // The consumer-email complaint is advice, not a refusal. Plenty of small
  // garages genuinely run on a free address, and blocking them would be
  // choosing a tidy database over a real customer.
  const blocking = options.acceptConsumerEmail
    ? problems.filter((problem) => !problem.message.includes('personal address'))
    : problems;

  if (blocking.length > 0) return { ok: false, problems: blocking };

  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return {
      ok: false,
      problems: [
        {
          field: 'email',
          message: 'There is already an account on that address. Sign in instead.',
        },
      ],
    };
  }

  const taken = new Set(
    (await prisma.organization.findMany({ select: { slug: true } })).map((org) => org.slug),
  );

  const slug = uniqueSlug(input.workshopName, taken);
  const plan = planFor(options.plan ?? 'CORE').id;
  const country = countryFor(input.country);
  const region = regionForCountry(country.code);

  // A password that has already leaked is refused the way a short one is:
  // as a problem on the field, so the form says why.
  const breached = await breachedPasswordProblem(input.password);
  if (breached) return { ok: false, problems: [{ field: 'password', message: breached }] };

  const passwordHash = await hashPassword(input.password);

  const userId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        slug,
        name: input.workshopName.trim(),
        email,
        phone: input.phone?.trim() || null,
        plan,
        country: region.country,
        trialEndsAt: trialEndsOn(),
        termsAcceptedAt: options.termsVersion ? new Date() : null,
        termsVersion: options.termsVersion ?? null,
        baseCurrency: region.currency,
        locale: region.locale,
        timezone: region.timezone,
        locations: {
          create: {
            name: `${input.workshopName.trim()} — main`,
            code: 'MAIN',
            country: region.country,
            timezone: region.timezone,
            isDefault: true,
            dailyCapacityHours: 32,
            bays: {
              create: Array.from({ length: 2 }, (_, index) => ({
                name: `Bay ${index + 1}`,
                code: `B${index + 1}`,
                sortOrder: index + 1,
              })),
            },
          },
        },
        taxRates: {
          create: [
            {
              name: country.tax.name,
              rate: country.tax.rate,
              isDefault: true,
              components: { create: [{ name: country.tax.name, rate: country.tax.rate }] },
            },
            {
              name: 'Zero rated',
              rate: 0,
              components: { create: [{ name: 'Zero rated', rate: 0 }] },
            },
          ],
        },
        jobTypes: { create: DEFAULT_JOB_TYPES },
        sequences: {
          create: [
            { kind: 'JOB', next: 1 },
            { kind: 'INVOICE', prefix: 'INV-', next: 1 },
            { kind: 'ESTIMATE', prefix: 'EST-', next: 1 },
          ],
        },
      },
      include: { locations: true },
    });

    const location = org.locations[0]!;

    // A store, so parts have somewhere to be from the first receipt.
    await tx.warehouse.create({
      data: {
        orgId: org.id,
        locationId: location.id,
        name: 'Main store',
        code: 'MAIN',
        isDefault: true,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name: input.contactName.trim(),
        passwordHash,
        // Proven by the link sent a moment after this commits. Until it is,
        // the workshop layout shows the confirmation page and nothing else:
        // an unproven address is how a stranger opens a workshop in somebody
        // else's name, and the product sends invoices from it.
        emailVerifiedAt: null,
        memberships: {
          create: { orgId: org.id, role: 'OWNER', locationId: location.id },
        },
      },
    });

    // The person signing up is also an employee, so their own time costs
    // something from day one rather than being invisible until somebody
    // notices the labour figures are too good.
    await tx.employee.create({
      data: {
        orgId: org.id,
        userId: user.id,
        locationId: location.id,
        reference: 'EMP-001',
        displayName: input.contactName.trim(),
        jobTitle: 'Owner',
        startedOn: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        orgId: org.id,
        actorUserId: user.id,
        action: 'org.created',
        entityType: 'Organization',
        entityId: org.id,
        after: {
          slug,
          plan,
          sites: input.sites,
          trialEndsOn: trialEndsOn().toISOString(),
        } as never,
      },
    });

    return user.id;
  });

  // The books. Every workshop starts with the standard chart, so its first
  // invoice can post; before this the chart came only from the seed.
  const created = await prisma.organization.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  await ensureChartOfAccounts(created.id);

  // And whoever runs Carnet is told there is a new workshop, before the
  // address is verified: a signup that never verifies is itself worth
  // knowing. Never allowed to fail the signup.
  await tellOperatorAboutSignup({
    workshop: input.workshopName.trim(),
    slug,
    contactName: input.contactName.trim(),
    email,
    country: country.code,
    plan,
    sites: input.sites,
  });

  return { ok: true, problems: [], orgSlug: slug, userId };
}

/* ---------------------------------------------------------------------------
   The setup list. Phase 45.
   --------------------------------------------------------------------------- */

/**
 * What the workshop has, as the checklist reads it.
 *
 * Counts rather than rows: nine questions, one query each, and none of them
 * loads anything it is only going to count. Everything is read from the
 * workshop's own data, so a step cannot be ticked off without the thing
 * being true.
 */
export async function setupFactsFor(orgId: string): Promise<SetupFacts> {
  const [org, labourRates, taxRates, members, products, customers, jobs, invoices, reminders] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: {
          legalName: true,
          taxNumber: true,
          setupHiddenAt: true,
          locations: {
            where: { isDefault: true },
            take: 1,
            select: { addressLine1: true, postcode: true },
          },
        },
      }),
      prisma.labourRate.count({ where: { orgId, isActive: true } }),
      prisma.taxRate.count({ where: { orgId, isActive: true } }),
      prisma.membership.count({ where: { orgId, isActive: true } }),
      prisma.product.count({ where: { orgId } }),
      prisma.customer.count({ where: { orgId } }),
      prisma.job.count({ where: { orgId } }),
      prisma.invoice.count({ where: { orgId, status: { not: 'DRAFT' } } }),
      prisma.serviceSchedule.count({ where: { orgId } }),
    ]);

  const site = org.locations[0];

  return {
    hasLetterhead: Boolean(
      org.legalName?.trim() && org.taxNumber?.trim() && site?.addressLine1?.trim(),
    ),
    labourRates,
    taxRates,
    members,
    products,
    customers,
    jobs,
    invoicesIssued: invoices,
    reminders,
  };
}

/** The list, with whether the workshop has put it away. */
export async function setupFor(orgId: string) {
  const [facts, org] = await Promise.all([
    setupFactsFor(orgId),
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { setupHiddenAt: true, isDemonstration: true, name: true },
    }),
  ]);

  const progress = setupProgress(facts);

  return {
    ...progress,
    hidden: org.setupHiddenAt !== null,
    // A list that has nothing left on it stops asking for attention by itself.
    showOnDashboard: org.setupHiddenAt === null && !progress.complete && !org.isDemonstration,
    summary: describeSetup(progress),
    workshop: org.name,
  };
}

/** Puts the list away, or brings it back. */
export async function setSetupHidden(input: {
  orgId: string;
  userId: string;
  hidden: boolean;
}): Promise<void> {
  await prisma.organization.update({
    where: { id: input.orgId },
    data: { setupHiddenAt: input.hidden ? new Date() : null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.hidden ? 'setup.hidden' : 'setup.shown',
    entityType: 'Organization',
    entityId: input.orgId,
  });
}
