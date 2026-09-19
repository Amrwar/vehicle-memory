import {
  assertPackageSound,
  jobLinesFromPackage,
  nextServiceFrom,
  PackageError,
  packageHours,
  type PackageLine,
  packageTotal,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { defaultTaxRateId } from './tax';

/**
 * Service packages, against the database. Phase 37.
 *
 * A package is saved whole: its lines and its checklist are replaced
 * together, so a half-edited package is never what a job is made from.
 * Applying one to a job appends its lines and its checks, sets the kind of
 * work and the time to allow, and records which package the job came from,
 * so completing the job can say when the next one is due.
 */

export { PackageError };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface PackageInput {
  orgId: string;
  userId: string;
  packageId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  jobTypeId?: string | null;
  durationMinutes: number;
  price: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  bookable: boolean;
  lines: PackageLine[];
  checks: { title: string; detail?: string | null }[];
}

export async function savePackage(input: PackageInput): Promise<string> {
  const lines = input.lines.filter((l) => l.description.trim() || l.quantity || l.unitPrice);
  const checks = input.checks.filter((c) => c.title.trim());
  assertPackageSound({
    code: input.code,
    name: input.name,
    durationMinutes: input.durationMinutes,
    price: input.price,
    intervalMonths: input.intervalMonths,
    intervalKm: input.intervalKm,
    lines,
    checks,
  });

  // A part named by product must be this workshop's product.
  const productIds = lines.map((l) => l.productId).filter((id): id is string => Boolean(id));
  if (productIds.length > 0) {
    const owned = await prisma.product.count({
      where: { orgId: input.orgId, id: { in: productIds } },
    });
    if (owned !== new Set(productIds).size) {
      throw new PackageError('BAD_LINE', 'A part on this package is not one of your products.');
    }
  }
  if (input.jobTypeId) {
    const type = await prisma.jobType.findFirst({
      where: { id: input.jobTypeId, orgId: input.orgId },
      select: { id: true },
    });
    if (!type) throw new PackageError('BAD_LINE', 'That kind of work is not this workshop’s.');
  }

  const data = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    jobTypeId: input.jobTypeId || null,
    durationMinutes: input.durationMinutes,
    price: input.price,
    intervalMonths: input.intervalMonths,
    intervalKm: input.intervalKm,
    bookable: input.bookable,
  };

  const id = await prisma
    .$transaction(async (tx) => {
      let packageId = input.packageId ?? null;
      if (packageId) {
        const existing = await tx.servicePackage.findFirst({
          where: { id: packageId, orgId: input.orgId },
          select: { id: true },
        });
        if (!existing) throw new PackageError('NO_NAME', 'That package is not this workshop’s.');
        await tx.servicePackage.update({ where: { id: packageId }, data });
        await tx.servicePackageLine.deleteMany({ where: { packageId } });
        await tx.servicePackageCheck.deleteMany({ where: { packageId } });
      } else {
        const count = await tx.servicePackage.count({ where: { orgId: input.orgId } });
        const made = await tx.servicePackage.create({
          data: { ...data, orgId: input.orgId, sortOrder: count + 1 },
          select: { id: true },
        });
        packageId = made.id;
      }
      await tx.servicePackageLine.createMany({
        data: lines.map((line, index) => ({
          packageId: packageId!,
          kind: line.kind,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          productId: line.productId ?? null,
          sortOrder: index,
        })),
      });
      if (checks.length > 0) {
        await tx.servicePackageCheck.createMany({
          data: checks.map((check, index) => ({
            packageId: packageId!,
            title: check.title.trim(),
            detail: check.detail?.trim() || null,
            sortOrder: index,
          })),
        });
      }
      return packageId!;
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === 'P2002') {
        throw new PackageError('NO_CODE', `There is already a package with the code ${data.code}.`);
      }
      throw error;
    });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.packageId ? 'package.updated' : 'package.created',
    entityType: 'ServicePackage',
    entityId: id,
    after: { ...data, lines: lines.length, checks: checks.length },
  });
  return id;
}

export async function setPackageActive(input: {
  orgId: string;
  userId: string;
  packageId: string;
  isActive: boolean;
}) {
  await prisma.servicePackage.updateMany({
    where: { id: input.packageId, orgId: input.orgId },
    data: { isActive: input.isActive },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.isActive ? 'package.reactivated' : 'package.retired',
    entityType: 'ServicePackage',
    entityId: input.packageId,
  });
}

const PACKAGE_INCLUDE = {
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    include: { product: { select: { partNumber: true, name: true } } },
  },
  checks: { orderBy: { sortOrder: 'asc' as const } },
  jobType: { select: { id: true, name: true, requiresQualityCheck: true } },
} as const;

export async function packagesFor(orgId: string, options: { activeOnly?: boolean } = {}) {
  // bounded: packages a workshop writes by hand.
  const rows = await prisma.servicePackage.findMany({
    where: { orgId, ...(options.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    include: PACKAGE_INCLUDE,
  });
  return rows.map(view);
}

export async function packageDetail(orgId: string, packageId: string) {
  const row = await prisma.servicePackage.findFirst({
    where: { id: packageId, orgId },
    include: PACKAGE_INCLUDE,
  });
  return row ? view(row) : null;
}

type Row = NonNullable<
  Awaited<ReturnType<typeof prisma.servicePackage.findFirst<{ include: typeof PACKAGE_INCLUDE }>>>
>;

function view(row: Row) {
  const lines: (PackageLine & { id: string; partNumber: string | null })[] = row.lines.map((l) => ({
    id: l.id,
    kind: l.kind as PackageLine['kind'],
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    productId: l.productId,
    partNumber: l.product?.partNumber ?? null,
  }));
  const price = row.price === null ? null : Number(row.price);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    jobType: row.jobType,
    durationMinutes: row.durationMinutes,
    hours: packageHours(row),
    price,
    intervalMonths: row.intervalMonths,
    intervalKm: row.intervalKm,
    bookable: row.bookable,
    isActive: row.isActive,
    lines,
    checks: row.checks.map((c) => ({ id: c.id, title: c.title, detail: c.detail })),
    total: packageTotal({ lines, price }),
  };
}

/**
 * Puts a package on a job: its lines after whatever is there, its checks
 * as tasks, its kind of work if the job has none, the time to allow, and
 * the package itself on the job so completion can set the next one.
 * Inside a transaction when called from job creation; on its own otherwise.
 */
export async function applyPackage(
  input: { orgId: string; userId: string; jobId: string; packageId: string },
  tx: Tx = prisma,
): Promise<{ lines: number; tasks: number }> {
  const pkg = await tx.servicePackage.findFirst({
    where: { id: input.packageId, orgId: input.orgId, isActive: true },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      checks: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!pkg) throw new PackageError('NO_NAME', 'That package is not one of yours, or is retired.');

  const job = await tx.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      locationId: true,
      packageId: true,
      estimatedHours: true,
      _count: {
        select: { labourLines: true, partLines: true, feeLines: true, tasks: true, jobTypes: true },
      },
    },
  });
  if (!job) throw new PackageError('NO_NAME', 'That job is not here.');
  if (['INVOICED', 'PAID', 'CANCELLED'].includes(job.status)) {
    throw new PackageError('BAD_LINE', 'This job is closed; a package goes on a new job.');
  }

  const taxRateId = await defaultTaxRateId(input.orgId, job.locationId, tx);
  const mapped = jobLinesFromPackage(
    pkg.lines.map((l) => ({
      kind: l.kind as PackageLine['kind'],
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      productId: l.productId,
    })),
  );
  const offset = job._count.labourLines + job._count.partLines + job._count.feeLines;

  const productIds = mapped.parts.map((p) => p.productId).filter((id): id is string => Boolean(id));
  const products = productIds.length
    ? await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, partNumber: true, costPrice: true },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  let index = offset;
  for (const line of mapped.labour) {
    await tx.jobLabourLine.create({
      data: {
        jobId: job.id,
        description: line.description,
        hours: line.hours,
        rate: line.rate,
        taxRateId,
        sortOrder: index++,
      },
    });
  }
  for (const line of mapped.parts) {
    const product = line.productId ? byId.get(line.productId) : undefined;
    await tx.jobPartLine.create({
      data: {
        jobId: job.id,
        productId: line.productId,
        partNumber: product?.partNumber ?? null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: product?.costPrice ?? 0,
        taxRateId,
        status: 'REQUESTED',
        sortOrder: index++,
      },
    });
  }
  for (const line of mapped.fees) {
    await tx.jobFeeLine.create({
      data: {
        jobId: job.id,
        description: line.description,
        amount: line.amount,
        taxRateId,
        sortOrder: index++,
      },
    });
  }
  if (pkg.checks.length > 0) {
    await tx.jobTask.createMany({
      data: pkg.checks.map((c, i) => ({
        jobId: job.id,
        title: c.title,
        detail: c.detail,
        sortOrder: job._count.tasks + i,
      })),
    });
  }
  if (pkg.jobTypeId && job._count.jobTypes === 0) {
    await tx.jobJobType.create({ data: { jobId: job.id, jobTypeId: pkg.jobTypeId } });
  }
  await tx.job.update({
    where: { id: job.id },
    data: {
      packageId: job.packageId ?? pkg.id,
      estimatedHours: Number(job.estimatedHours ?? 0) + packageHours(pkg),
    },
  });

  return { lines: pkg.lines.length, tasks: pkg.checks.length };
}

/**
 * When a job made from a recurring package completes, the vehicle's
 * schedule for that package is set to the next one. One schedule per
 * package per vehicle, refreshed rather than duplicated.
 */
export async function refreshScheduleFor(
  jobId: string,
): Promise<{ dueAt: Date | null; dueKm: number | null } | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      orgId: true,
      vehicleId: true,
      completedAt: true,
      odometerOutKm: true,
      odometerInKm: true,
      package: { select: { name: true, intervalMonths: true, intervalKm: true } },
    },
  });
  if (!job?.package) return null;
  const next = nextServiceFrom({
    completedAt: job.completedAt ?? new Date(),
    odometerKm: job.odometerOutKm ?? job.odometerInKm,
    intervalMonths: job.package.intervalMonths,
    intervalKm: job.package.intervalKm,
  });
  if (!next) return null;

  const existing = await prisma.serviceSchedule.findFirst({
    where: { vehicleId: job.vehicleId, orgId: job.orgId, name: job.package.name },
    select: { id: true },
  });
  const data = {
    intervalMonths: job.package.intervalMonths,
    intervalKm: job.package.intervalKm,
    lastPerformedAt: job.completedAt ?? new Date(),
    lastPerformedKm: job.odometerOutKm ?? job.odometerInKm,
    dueAt: next.dueAt,
    dueKm: next.dueKm,
    reminderSentAt: null,
    isActive: true,
  };
  if (existing) {
    await prisma.serviceSchedule.update({ where: { id: existing.id }, data });
  } else {
    await prisma.serviceSchedule.create({
      data: { ...data, orgId: job.orgId, vehicleId: job.vehicleId, name: job.package.name },
    });
  }
  return next;
}
