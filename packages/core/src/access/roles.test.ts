import { describe, expect, it } from 'vitest';

import {
  assertCan,
  can,
  canAll,
  canAny,
  ForbiddenError,
  landingPathFor,
  PERMISSIONS,
  permissionsFor,
  ROLES,
  surfaceFor,
} from './roles';

describe('deny by default', () => {
  it('refuses when there is no role', () => {
    expect(can(null, 'job:read')).toBe(false);
    expect(can(undefined, 'passport:read')).toBe(false);
  });

  it('grants a role only what its list contains', () => {
    for (const role of ROLES) {
      const granted = new Set(permissionsFor(role));
      for (const permission of PERMISSIONS) {
        expect(can(role, permission)).toBe(granted.has(permission));
      }
    }
  });
});

describe('role boundaries that matter commercially', () => {
  it('gives the owner everything', () => {
    for (const permission of PERMISSIONS) {
      expect(can('OWNER', permission), permission).toBe(true);
    }
  });

  // Story A3. A technician must not reach financial reporting, and the check
  // has to hold when the URL is requested directly, not only in navigation.
  it('keeps a technician out of financial reporting', () => {
    expect(can('TECHNICIAN', 'report:financial')).toBe(false);
    expect(can('TECHNICIAN', 'invoice:read')).toBe(false);
    expect(can('TECHNICIAN', 'ledger:read')).toBe(false);
  });

  it('gives a technician their own work and nothing wider', () => {
    expect(can('TECHNICIAN', 'job:read:assigned')).toBe(true);
    expect(can('TECHNICIAN', 'job:read')).toBe(false);
    expect(can('TECHNICIAN', 'job:write')).toBe(false);
  });

  it('lets a technician record what only they can record', () => {
    expect(can('TECHNICIAN', 'inspection:write')).toBe(true);
    expect(can('TECHNICIAN', 'timeentry:write')).toBe(true);
    expect(can('TECHNICIAN', 'purchase:request')).toBe(true);
    // Requesting a part is not approving the spend.
    expect(can('TECHNICIAN', 'purchase:approve')).toBe(false);
  });

  it('separates requesting a purchase from approving one', () => {
    expect(can('SERVICE_ADVISOR', 'purchase:request')).toBe(true);
    expect(can('SERVICE_ADVISOR', 'purchase:approve')).toBe(false);
    expect(can('MANAGER', 'purchase:approve')).toBe(true);
  });

  it('keeps a service advisor out of margin data', () => {
    expect(can('SERVICE_ADVISOR', 'report:operational')).toBe(true);
    expect(can('SERVICE_ADVISOR', 'report:financial')).toBe(false);
  });

  it('gives a bookkeeper the ledger but not the diary', () => {
    expect(can('BOOKKEEPER', 'ledger:write')).toBe(true);
    expect(can('BOOKKEEPER', 'report:financial')).toBe(true);
    expect(can('BOOKKEEPER', 'diary:write')).toBe(false);
    expect(can('BOOKKEEPER', 'inspection:write')).toBe(false);
  });

  it('restricts a customer to their own vehicle history', () => {
    expect(can('CUSTOMER', 'passport:read')).toBe(true);
    expect(can('CUSTOMER', 'passport:share')).toBe(true);
    expect(can('CUSTOMER', 'passport:transfer')).toBe(true);

    expect(can('CUSTOMER', 'job:read')).toBe(false);
    expect(can('CUSTOMER', 'customer:read')).toBe(false);
    expect(can('CUSTOMER', 'invoice:read')).toBe(false);
  });

  it('reserves user management and settings changes for the owner', () => {
    expect(can('MANAGER', 'settings:write')).toBe(false);
    expect(can('MANAGER', 'user:manage')).toBe(false);
    expect(can('OWNER', 'user:manage')).toBe(true);
  });

  it('lets only the owner transfer vehicle ownership from inside a workshop', () => {
    expect(can('SERVICE_ADVISOR', 'passport:transfer')).toBe(false);
    expect(can('MANAGER', 'passport:transfer')).toBe(false);
  });
});

describe('combinators', () => {
  it('canAny passes when one permission is held', () => {
    expect(canAny('TECHNICIAN', ['report:financial', 'inspection:write'])).toBe(true);
  });

  it('canAny fails when none are held', () => {
    expect(canAny('TECHNICIAN', ['report:financial', 'ledger:write'])).toBe(false);
  });

  it('canAll requires every permission', () => {
    expect(canAll('OWNER', ['job:read', 'ledger:write'])).toBe(true);
    expect(canAll('TECHNICIAN', ['inspection:write', 'ledger:write'])).toBe(false);
  });
});

describe('assertCan', () => {
  it('throws a ForbiddenError naming the permission and the role', () => {
    try {
      assertCan('TECHNICIAN', 'report:financial');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      const typed = error as ForbiddenError;
      expect(typed.permission).toBe('report:financial');
      expect(typed.role).toBe('TECHNICIAN');
      expect(typed.message).toContain('Technician');
    }
  });

  it('tells an anonymous caller to sign in', () => {
    try {
      assertCan(null, 'job:read');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ForbiddenError).message).toContain('Sign in');
    }
  });

  it('does not throw when permitted', () => {
    expect(() => assertCan('OWNER', 'ledger:write')).not.toThrow();
  });
});

describe('interface segregation', () => {
  it('sends each role to the surface built for it', () => {
    expect(surfaceFor('TECHNICIAN')).toBe('shopfloor');
    expect(surfaceFor('CUSTOMER')).toBe('portal');
    expect(surfaceFor('OWNER')).toBe('workshop');
    expect(surfaceFor('BOOKKEEPER')).toBe('workshop');
  });

  it('gives every role a landing path', () => {
    for (const role of ROLES) {
      expect(landingPathFor(role)).toMatch(/^\//);
    }
  });

  it('never lands a technician on the management dashboard', () => {
    expect(landingPathFor('TECHNICIAN')).toBe('/shop');
    expect(landingPathFor('CUSTOMER')).toBe('/portal');
  });
});
