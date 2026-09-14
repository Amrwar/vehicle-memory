import { prisma } from '@carnet/db';

/**
 * The workshops on Carnet, as a customer sees them. Phase 32.5.
 *
 * A customer's portal used to know one garage: whichever had a customer
 * record for them. Carnet is a network, and the point of a network is that
 * a car can go to any workshop on it and the history follows. So there is a
 * directory: every active workshop with somewhere to bring a car, findable
 * by name or place, and booking at one the customer has never used makes
 * them a customer there on the spot.
 */

export type DirectoryWorkshop = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  country: string;
  sites: {
    name: string;
    address: string;
    phone: string | null;
  }[];
};

function addressOf(site: {
  addressLine1: string | null;
  locality: string | null;
  region: string | null;
  postcode: string | null;
}): string {
  return [site.addressLine1, site.locality, site.region, site.postcode].filter(Boolean).join(', ');
}

/** Every workshop a customer could bring a car to, optionally narrowed by a word. */
export async function workshopDirectory(query?: string | null): Promise<DirectoryWorkshop[]> {
  const q = query?.trim();
  const orgs = await prisma.organization.findMany({
    where: {
      isActive: true,
      cancelledAt: null,
      locations: { some: { isActive: true } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { locations: { some: { locality: { contains: q, mode: 'insensitive' } } } },
              { locations: { some: { postcode: { contains: q, mode: 'insensitive' } } } },
              { locations: { some: { region: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      phone: true,
      email: true,
      website: true,
      country: true,
      locations: {
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: {
          name: true,
          addressLine1: true,
          locality: true,
          region: true,
          postcode: true,
          phone: true,
        },
      },
    },
  });
  return orgs.map((org) => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
    phone: org.phone,
    email: org.email,
    website: org.website,
    country: org.country,
    sites: org.locations.map((site) => ({
      name: site.name,
      address: addressOf(site),
      phone: site.phone,
    })),
  }));
}

/** The workshops this customer already has a record at. */
export async function workshopsUsedBy(userId: string): Promise<Set<string>> {
  const rows = await prisma.customer.findMany({
    where: { portalUserId: userId, isActive: true },
    select: { orgId: true },
  });
  return new Set(rows.map((r) => r.orgId));
}

/** One workshop the customer can book at, with the site a booking goes to. */
export async function bookableWorkshop(orgId: string) {
  return prisma.organization.findFirst({
    where: { id: orgId, isActive: true, cancelledAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      locations: {
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: 1,
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * The customer's record at a workshop, made on the spot if there is none.
 * Booking at a workshop for the first time is how somebody becomes its
 * customer; the workshop sees a new name in its diary with a phone number
 * and an email, which is exactly what a walk-in gives it.
 */
export async function customerAt(input: {
  userId: string;
  orgId: string;
}): Promise<{ id: string }> {
  const existing = await prisma.customer.findFirst({
    where: { portalUserId: input.userId, orgId: input.orgId, isActive: true },
    select: { id: true },
  });
  if (existing) return existing;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { name: true, email: true, phone: true },
  });
  const [firstName, ...rest] = user.name.trim().split(/\s+/);
  return prisma.customer.create({
    data: {
      orgId: input.orgId,
      kind: 'INDIVIDUAL',
      displayName: user.name,
      firstName: firstName ?? null,
      lastName: rest.join(' ') || null,
      email: user.email,
      mobile: user.phone,
      portalUserId: input.userId,
    },
    select: { id: true },
  });
}
