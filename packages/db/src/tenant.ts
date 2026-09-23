import { prisma } from './client';
import type { PrismaClient } from './generated/client/index';
import { CHILD_OF, GLOBAL_MODELS, TENANT_SCOPED_MODELS } from './tenant-models';

/**
 * Tenant isolation.
 *
 * FR-102 requires that scoping is enforced at the data-access layer rather
 * than by every caller remembering to add `where: { orgId }`. One forgotten
 * filter is a cross-tenant data leak, and code review is not a reliable
 * defence against an omission that looks like nothing.
 *
 * `forOrg(orgId)` returns a client where every tenant-scoped model is
 * automatically filtered on reads and stamped on writes. Passport models are
 * deliberately absent from that list: a vehicle is global (ADR-0004), and
 * access to it is mediated by VehicleAccessGrant instead.
 *
 * That list was twenty-six model names typed into this file by hand, and the
 * schema had eighty-three models carrying an `orgId`. Fifty-eight of them went
 * through this extension untouched: reads unfiltered, writes unstamped, in the
 * one mechanism the product's isolation rests on. `/reports` was reading
 * `db.membership.findMany({ where: { role: 'TECHNICIAN' } })` and rendering
 * every technician at every workshop on Carnet, by name, with their cost rate.
 *
 * The list is now generated from `schema.prisma` (`tenant-models.ts`), and CI
 * fails when the two disagree. A model added without a decision about its
 * tenancy cannot reach production quietly. Phase 64.
 */

/** Operations whose arguments carry a `where` we must narrow. */
const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/** Operations that create rows and therefore need `orgId` stamped on. */
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

/**
 * `findUnique` cannot take a non-unique filter, so a scoped `findUnique` is
 * rewritten to `findFirst` with the tenant predicate added. The result is the
 * same row or null, and a caller asking for another tenant's record by id gets
 * null rather than data — which is what FR-102 and story A2 require.
 */
const UNIQUE_TO_FIRST: Record<string, string> = {
  findUnique: 'findFirst',
  findUniqueOrThrow: 'findFirstOrThrow',
};

type AnyArgs = Record<string, unknown> & { where?: Record<string, unknown> };

export type ScopedPrismaClient = ReturnType<typeof forOrg>;

export function forOrg(orgId: string, client: PrismaClient = prisma) {
  if (!orgId) {
    throw new Error('forOrg() requires an organisation id');
  }

  return client.$extends({
    name: 'carnet-tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const typedArgs = (args ?? {}) as AnyArgs;

          // findUnique -> findFirst, so the tenant predicate can be applied.
          const rewritten = UNIQUE_TO_FIRST[operation];
          if (rewritten) {
            const where = { ...(typedArgs.where ?? {}), orgId };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const delegate = (client as any)[lowerFirst(model)];
            return delegate[rewritten]({ ...typedArgs, where });
          }

          if (READ_OPERATIONS.has(operation)) {
            return query({ ...typedArgs, where: { ...(typedArgs.where ?? {}), orgId } });
          }

          if (CREATE_OPERATIONS.has(operation)) {
            return query(stampOrgId(operation, typedArgs, orgId));
          }

          // update / delete address a single row by unique id. Narrowing their
          // `where` is not possible, so they are checked by the caller loading
          // the row through this same scoped client first. Repository helpers
          // in packages/core follow that rule.
          return query(args);
        },
      },
    },
  });
}

function stampOrgId(operation: string, args: AnyArgs, orgId: string): AnyArgs {
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = args.data;
    const rows = Array.isArray(data) ? data : [data];
    return {
      ...args,
      data: rows.map((row) => ({ ...(row as object), orgId })),
    };
  }

  if (operation === 'upsert') {
    return {
      ...args,
      where: { ...(args.where ?? {}), orgId },
      create: { ...(args.create as object), orgId },
    };
  }

  return { ...args, data: { ...(args.data as object), orgId } };
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export { CHILD_OF, GLOBAL_MODELS, TENANT_SCOPED_MODELS };
