/**
 * Role-based access control.
 *
 * Deny by default (FR-107). A permission that has not been explicitly granted
 * is refused, so adding a new capability cannot accidentally widen anyone's
 * access — the failure mode of an allow-list is a missing feature, and the
 * failure mode of a deny-list is a data breach.
 *
 * Roles also drive navigation. Personas P2 and P6 need genuinely different
 * applications, not the same one with items greyed out (ADR-0009).
 */

export const ROLES = [
  'OWNER',
  'MANAGER',
  'SERVICE_ADVISOR',
  'TECHNICIAN',
  'BOOKKEEPER',
  'CUSTOMER',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Workshop operations
  'diary:read',
  'diary:write',
  'customer:read',
  'customer:write',
  'vehicle:read',
  'vehicle:write',
  'job:read',
  'job:read:assigned',
  'job:write',
  'job:complete',
  'inspection:read',
  'inspection:write',
  'estimate:read',
  'estimate:write',
  'estimate:send',
  'timeentry:write',
  'qualitycheck:write',

  // Money
  'invoice:read',
  'invoice:write',
  'payment:read',
  'payment:write',
  'report:financial',
  'report:operational',
  'ledger:read',
  'ledger:write',

  // Inventory and purchasing
  'inventory:read',
  'inventory:write',
  'purchase:request',
  'purchase:approve',

  // Passport
  'passport:read',
  'passport:write',
  'passport:share',
  'passport:transfer',

  // Administration
  'settings:read',
  'settings:write',
  'user:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Grants per role.
 *
 * Two decisions worth defending:
 *
 * A technician gets `job:read:assigned`, not `job:read`. They see their own
 * work, not the whole shop. This is not distrust; it is the interface
 * segregation that keeps their screen usable on a tablet with gloves on.
 *
 * A service advisor cannot see financial reports. They price jobs and take
 * payments, but margin and profitability belong to the owner. Commercial
 * information is not withheld out of secrecy so much as relevance, and
 * widening it later is a settings change rather than a rebuild.
 */
const GRANTS: Readonly<Record<Role, readonly Permission[]>> = {
  OWNER: [...PERMISSIONS],

  MANAGER: [
    'diary:read', 'diary:write',
    'customer:read', 'customer:write',
    'vehicle:read', 'vehicle:write',
    'job:read', 'job:write', 'job:complete',
    'inspection:read', 'inspection:write',
    'estimate:read', 'estimate:write', 'estimate:send',
    'timeentry:write', 'qualitycheck:write',
    'invoice:read', 'invoice:write',
    'payment:read', 'payment:write',
    'report:financial', 'report:operational',
    'inventory:read', 'inventory:write',
    'purchase:request', 'purchase:approve',
    'passport:read', 'passport:write', 'passport:share',
    'settings:read',
    'audit:read',
  ],

  SERVICE_ADVISOR: [
    'diary:read', 'diary:write',
    'customer:read', 'customer:write',
    'vehicle:read', 'vehicle:write',
    'job:read', 'job:write',
    'inspection:read',
    'estimate:read', 'estimate:write', 'estimate:send',
    'invoice:read', 'invoice:write',
    'payment:read', 'payment:write',
    'report:operational',
    'inventory:read',
    'purchase:request',
    'passport:read', 'passport:write', 'passport:share',
  ],

  TECHNICIAN: [
    'job:read:assigned',
    'vehicle:read',
    'inspection:read', 'inspection:write',
    'timeentry:write',
    'qualitycheck:write',
    'purchase:request',
    'passport:read',
  ],

  BOOKKEEPER: [
    'customer:read',
    'job:read',
    'invoice:read', 'invoice:write',
    'payment:read', 'payment:write',
    'report:financial',
    'ledger:read', 'ledger:write',
    'inventory:read',
    'audit:read',
  ],

  // Portal identity. Scoped further at the query level to their own records:
  // holding a permission is necessary but never sufficient.
  CUSTOMER: [
    'passport:read', 'passport:share', 'passport:transfer',
  ],
};

const GRANT_SETS = new Map<Role, ReadonlySet<Permission>>(
  ROLES.map((role) => [role, new Set(GRANTS[role])]),
);

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return GRANT_SETS.get(role)?.has(permission) ?? false;
}

export function canAny(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function canAll(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

export function permissionsFor(role: Role): readonly Permission[] {
  return GRANTS[role];
}

export class ForbiddenError extends Error {
  readonly permission: Permission;
  readonly role: Role | null;

  constructor(permission: Permission, role: Role | null) {
    super(
      role
        ? `Your role (${humaniseRole(role)}) does not permit ${permission}.`
        : `Sign in to perform ${permission}.`,
    );
    this.name = 'ForbiddenError';
    this.permission = permission;
    this.role = role;
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(permission, role ?? null);
  }
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  SERVICE_ADVISOR: 'Service advisor',
  TECHNICIAN: 'Technician',
  BOOKKEEPER: 'Bookkeeper',
  CUSTOMER: 'Customer',
};

export function humaniseRole(role: Role): string {
  return ROLE_LABELS[role];
}

/**
 * Which application surface a role lands in. Persona P2 must never see the
 * ERP, and persona P6 must never be asked to navigate the shop floor.
 */
export type Surface = 'workshop' | 'shopfloor' | 'portal';

const SURFACES: Record<Role, Surface> = {
  OWNER: 'workshop',
  MANAGER: 'workshop',
  SERVICE_ADVISOR: 'workshop',
  BOOKKEEPER: 'workshop',
  TECHNICIAN: 'shopfloor',
  CUSTOMER: 'portal',
};

export function surfaceFor(role: Role): Surface {
  return SURFACES[role];
}

export function landingPathFor(role: Role): string {
  switch (surfaceFor(role)) {
    case 'shopfloor':
      return '/shop';
    case 'portal':
      return '/portal';
    case 'workshop':
      return '/dashboard';
  }
}
