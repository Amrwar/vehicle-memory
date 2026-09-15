import {
  can,
  isSearchable,
  NOTIFY_PERMISSION,
  type NotificationKind,
  type Permission,
  rankHits,
  readQuery,
  recipients,
  type Role,
  type SearchHit,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * Finding anything, and being told, against the database. Phase 39.
 *
 * One query per kind of record, run together, each scoped to the workshop:
 * a vehicle is found only if this workshop has worked on it or holds a
 * grant to it, so the search box is never a way to read the network.
 * Plates are compared with their spacing and punctuation removed, and
 * telephone numbers by their digits, so what is typed need not match how it
 * was written down.
 */

const LIMIT = 8;

export async function searchEverything(orgId: string, input: string): Promise<SearchHit[]> {
  if (!isSearchable(input)) return [];
  const q = readQuery(input);
  const like = `%${q.raw}%`;
  const compactLike = `%${q.compact}%`;

  const [customers, vehicles, jobs, invoices, parts, suppliers] = await Promise.all([
    prisma.$queryRaw<
      {
        id: string;
        displayName: string;
        email: string | null;
        mobile: string | null;
        phone: string | null;
        digits: string;
      }[]
    >`
      SELECT "id", "displayName", "email", "mobile", "phone",
             regexp_replace(coalesce("mobile", '') || ' ' || coalesce("phone", ''), '[^0-9 ]', '', 'g') AS "digits"
      FROM "customers"
      WHERE "orgId" = ${orgId}
        AND (
          "displayName" ILIKE ${like}
          OR coalesce("email", '') ILIKE ${like}
          OR (${q.phoneDigits}::text IS NOT NULL AND (
               regexp_replace(coalesce("mobile", ''), '\\D', '', 'g') LIKE ${`%${q.phoneDigits ?? ''}%`}
            OR regexp_replace(coalesce("phone", ''), '\\D', '', 'g') LIKE ${`%${q.phoneDigits ?? ''}%`}))
        )
      ORDER BY "displayName"
      LIMIT ${LIMIT}
    `,
    q.compact.length >= 2
      ? prisma.$queryRaw<
          {
            id: string;
            vin: string;
            registration: string | null;
            make: string | null;
            model: string | null;
            year: number | null;
          }[]
        >`
          SELECT v."id", v."vin", v."registration", v."make", v."model", v."year"
          FROM "vehicles" v
          WHERE (
              upper(regexp_replace(coalesce(v."registration", ''), '[^A-Za-z0-9]', '', 'g')) LIKE ${compactLike}
              OR upper(v."vin") LIKE ${compactLike}
            )
            AND (
              EXISTS (SELECT 1 FROM "jobs" j WHERE j."vehicleId" = v."id" AND j."orgId" = ${orgId})
              OR EXISTS (
                SELECT 1 FROM "vehicle_access_grants" g
                WHERE g."vehicleId" = v."id" AND g."orgId" = ${orgId} AND g."revokedAt" IS NULL
              )
            )
          ORDER BY v."registration" NULLS LAST
          LIMIT ${LIMIT}
        `
      : Promise.resolve([]),
    prisma.job.findMany({
      where: {
        orgId,
        OR: [
          ...(q.jobNumber !== null ? [{ number: q.jobNumber }] : []),
          { shortDescription: { contains: q.raw, mode: 'insensitive' as const } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        number: true,
        status: true,
        shortDescription: true,
        customer: { select: { displayName: true } },
        vehicle: { select: { registration: true, make: true, model: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { orgId, number: { contains: q.raw, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        customer: { select: { displayName: true } },
      },
    }),
    prisma.product.findMany({
      where: {
        orgId,
        OR: [
          { partNumber: { contains: q.raw, mode: 'insensitive' } },
          { name: { contains: q.raw, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, partNumber: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { orgId, name: { contains: q.raw, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const digitsOf = (value: string | null) => (value ?? '').replace(/\D/g, '');

  const hits: SearchHit[] = [
    ...vehicles.map((v) => ({
      kind: 'vehicle' as const,
      id: v.id,
      title: v.registration ?? v.vin,
      subtitle: [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin,
      href: `/vehicles/${v.id}`,
      exact:
        (v.registration ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() === q.compact ||
        v.vin.toUpperCase() === q.compact,
    })),
    ...jobs.map((j) => ({
      kind: 'job' as const,
      id: j.id,
      title: `#${j.number} ${j.shortDescription}`,
      subtitle: [
        j.customer.displayName,
        j.vehicle.registration,
        j.status.toLowerCase().replace('_', ' '),
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/jobs/${j.id}`,
      exact: q.jobNumber !== null && j.number === q.jobNumber,
    })),
    ...invoices.map((i) => ({
      kind: 'invoice' as const,
      id: i.id,
      title: i.number,
      subtitle: `${i.customer.displayName} · ${i.status.toLowerCase().replace('_', ' ')}`,
      href: `/invoices/${i.id}`,
      exact: i.number.toUpperCase() === q.raw.toUpperCase(),
    })),
    ...customers.map((c) => ({
      kind: 'customer' as const,
      id: c.id,
      title: c.displayName,
      subtitle: [c.mobile ?? c.phone, c.email].filter(Boolean).join(' · ') || null,
      href: `/customers/${c.id}`,
      exact:
        (q.phoneDigits !== null &&
          (digitsOf(c.mobile) === q.phoneDigits || digitsOf(c.phone) === q.phoneDigits)) ||
        (q.looksLikeEmail && (c.email ?? '').toLowerCase() === q.raw.toLowerCase()),
    })),
    ...parts.map((p) => ({
      kind: 'part' as const,
      id: p.id,
      title: p.name,
      subtitle: p.partNumber,
      href: `/parts/${p.id}`,
      exact: p.partNumber.toUpperCase() === q.raw.toUpperCase(),
    })),
    ...suppliers.map((s) => ({
      kind: 'supplier' as const,
      id: s.id,
      title: s.name,
      subtitle: s.phone,
      href: `/suppliers/${s.id}`,
      exact: false,
    })),
  ];

  return rankHits(hits);
}

/* ---------------------------------------------------------------------------
   Notifications
   --------------------------------------------------------------------------- */

/**
 * Tells everyone in the workshop who could act on something, except
 * whoever caused it. Never throws: whether somebody is told must not decide
 * whether the thing they are being told about happened.
 */
export async function notifyStaff(input: {
  orgId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href: string;
  entityType?: string | null;
  entityId?: string | null;
  exceptUserId?: string | null;
}): Promise<number> {
  try {
    const members = await prisma.membership.findMany({
      where: { orgId: input.orgId, isActive: true },
      select: { userId: true, role: true },
    });
    const permission = NOTIFY_PERMISSION[input.kind] as Permission;
    const to = recipients({
      members,
      can: (role) => can(role as Role, permission),
      exceptUserId: input.exceptUserId,
    });
    if (to.length === 0) return 0;
    await prisma.staffNotification.createMany({
      data: to.map((member) => ({
        orgId: input.orgId,
        userId: member.userId,
        kind: input.kind,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 500) ?? null,
        href: input.href,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
    return to.length;
  } catch {
    return 0;
  }
}

export async function notificationsFor(orgId: string, userId: string, limit = 60) {
  return prisma.staffNotification.findMany({
    where: { orgId, userId },
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function unreadNotifications(orgId: string, userId: string): Promise<number> {
  return prisma.staffNotification.count({ where: { orgId, userId, readAt: null } });
}

/** Opens one: marks it read and says where it goes. Only the person's own. */
export async function openNotification(
  orgId: string,
  userId: string,
  id: string,
): Promise<string | null> {
  const row = await prisma.staffNotification.findFirst({
    where: { id, orgId, userId },
    select: { id: true, href: true, readAt: true },
  });
  if (!row) return null;
  if (!row.readAt) {
    await prisma.staffNotification.update({ where: { id: row.id }, data: { readAt: new Date() } });
  }
  return row.href.startsWith('/') && !row.href.startsWith('//') ? row.href : '/dashboard';
}

export async function markAllRead(orgId: string, userId: string): Promise<number> {
  const result = await prisma.staffNotification.updateMany({
    where: { orgId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
