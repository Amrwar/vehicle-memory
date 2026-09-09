import { describe, expect, it } from 'vitest';

import {
  availableSlots,
  customerMessageFor,
  DEFAULT_OPENING,
  isSlotStillFree,
  offerSlots,
  shouldNotify,
  type SlotRequest,
} from './booking';
import {
  assertAcceptable,
  assertEmailMatches,
  assertMayChangeRole,
  assertMayInvite,
  assertNotLastOwner,
  canInvite,
  INVITATION_DAYS,
  invitableRoles,
  invitationExpiry,
  InvitationError,
  statusOf,
  type Invitation,
} from './invitations';

/* ===========================================================================
   Invitations
   =========================================================================== */

const OPEN: Invitation = {
  email: 'new@hillsidemotors.test',
  role: 'TECHNICIAN',
  locationId: null,
  expiresAt: new Date('2026-09-20T12:00:00'),
  acceptedAt: null,
  revokedAt: null,
};

const BEFORE = new Date('2026-09-15T12:00:00');
const AFTER = new Date('2026-09-25T12:00:00');

describe('who may invite', () => {
  it('lets an owner and a manager invite', () => {
    expect(canInvite('OWNER')).toBe(true);
    expect(canInvite('MANAGER')).toBe(true);
  });

  it('does not let anybody else', () => {
    for (const role of ['SERVICE_ADVISOR', 'TECHNICIAN', 'BOOKKEEPER', 'CUSTOMER'] as const) {
      expect(canInvite(role)).toBe(false);
      expect(invitableRoles(role)).toEqual([]);
    }
  });

  it('lets an owner create another owner, because a partnership needs it', () => {
    expect(() => assertMayInvite('OWNER', 'OWNER')).not.toThrow();
    expect(invitableRoles('OWNER')).toContain('OWNER');
  });

  it('does not let a manager create an owner', () => {
    // Otherwise the weakest role that can invite promotes itself in two steps.
    expect(() => assertMayInvite('MANAGER', 'OWNER')).toThrow(InvitationError);
    expect(invitableRoles('MANAGER')).not.toContain('OWNER');
  });

  it('lets a manager invite everybody below them', () => {
    for (const role of ['MANAGER', 'BOOKKEEPER', 'SERVICE_ADVISOR', 'TECHNICIAN'] as const) {
      expect(() => assertMayInvite('MANAGER', role)).not.toThrow();
    }
  });

  it('refuses to invite somebody as a customer', () => {
    expect(() => assertMayInvite('OWNER', 'CUSTOMER')).toThrow(/not staff/);
    expect(invitableRoles('OWNER')).not.toContain('CUSTOMER');
  });

  it('refuses when the inviter cannot invite at all', () => {
    expect(() => assertMayInvite('TECHNICIAN', 'TECHNICIAN')).toThrow(/owner or a manager/);
  });
});

describe('invitation lifecycle', () => {
  it('is pending while it is open', () => {
    expect(statusOf(OPEN, BEFORE)).toBe('PENDING');
    expect(() => assertAcceptable(OPEN, BEFORE)).not.toThrow();
  });

  it('expires after a week', () => {
    const expires = invitationExpiry(new Date('2026-09-01T09:00:00'));
    expect(Math.round((expires.getTime() - Date.parse('2026-09-01T09:00:00')) / 86_400_000)).toBe(
      INVITATION_DAYS,
    );
  });

  it('says it ran out rather than that the link is invalid', () => {
    // "Invalid link" describes the system's opinion, not their situation.
    expect(statusOf(OPEN, AFTER)).toBe('EXPIRED');
    expect(() => assertAcceptable(OPEN, AFTER)).toThrow(/run out/);
  });

  it('refuses a second use and points at signing in', () => {
    const used = { ...OPEN, acceptedAt: new Date('2026-09-16T09:00:00') };

    expect(statusOf(used, BEFORE)).toBe('ACCEPTED');
    expect(() => assertAcceptable(used, BEFORE)).toThrow(/Sign in instead/);
  });

  it('refuses a withdrawn invitation', () => {
    const revoked = { ...OPEN, revokedAt: new Date('2026-09-16T09:00:00') };

    expect(statusOf(revoked, BEFORE)).toBe('REVOKED');
    expect(() => assertAcceptable(revoked, BEFORE)).toThrow(/withdrawn/);
  });

  it('treats acceptance as final even after expiry', () => {
    const used = { ...OPEN, acceptedAt: new Date('2026-09-16T09:00:00') };
    expect(statusOf(used, AFTER)).toBe('ACCEPTED');
  });

  it('only lets the addressed person accept', () => {
    // A forwarded email must not let somebody join under a name nobody chose.
    expect(() => assertEmailMatches(OPEN, 'someone.else@example.test')).toThrow(InvitationError);
    expect(() => assertEmailMatches(OPEN, 'NEW@HillsideMotors.test')).not.toThrow();
  });
});

describe('changing a role', () => {
  const base = {
    actorRole: 'OWNER' as const,
    actorUserId: 'owner-1',
    targetUserId: 'tech-1',
    targetCurrentRole: 'TECHNICIAN' as const,
    targetNewRole: 'SERVICE_ADVISOR' as const,
  };

  it('allows an owner to change somebody else', () => {
    expect(() => assertMayChangeRole(base)).not.toThrow();
  });

  it('refuses changing your own role', () => {
    // A manager quietly promoting themselves is the exact thing roles exist
    // to prevent, and the form looks identical to changing anybody else.
    expect(() => assertMayChangeRole({ ...base, targetUserId: 'owner-1' })).toThrow(
      /cannot change your own role/,
    );
  });

  it('refuses a manager changing an owner', () => {
    expect(() =>
      assertMayChangeRole({
        ...base,
        actorRole: 'MANAGER',
        actorUserId: 'manager-1',
        targetCurrentRole: 'OWNER',
        targetNewRole: 'MANAGER',
      }),
    ).toThrow(InvitationError);
  });

  it('refuses a manager promoting somebody to owner', () => {
    expect(() =>
      assertMayChangeRole({
        ...base,
        actorRole: 'MANAGER',
        actorUserId: 'manager-1',
        targetNewRole: 'OWNER',
      }),
    ).toThrow(/A manager cannot make somebody an owner/);
  });

  it('refuses somebody with no administrative role', () => {
    expect(() =>
      assertMayChangeRole({ ...base, actorRole: 'SERVICE_ADVISOR', actorUserId: 'advisor-1' }),
    ).toThrow(/owner or a manager/);
  });
});

describe('the last owner', () => {
  it('refuses to deactivate the only one', () => {
    expect(() =>
      assertNotLastOwner({ targetRole: 'OWNER', activeOwners: 1, action: 'deactivate' }),
    ).toThrow(/only owner/);
  });

  it('refuses to demote the only one', () => {
    expect(() =>
      assertNotLastOwner({ targetRole: 'OWNER', activeOwners: 1, action: 'demote' }),
    ).toThrow(/Promote somebody else first/);
  });

  it('allows it when there is another', () => {
    expect(() =>
      assertNotLastOwner({ targetRole: 'OWNER', activeOwners: 2, action: 'deactivate' }),
    ).not.toThrow();
  });

  it('does not apply to anybody else', () => {
    expect(() =>
      assertNotLastOwner({ targetRole: 'TECHNICIAN', activeOwners: 1, action: 'deactivate' }),
    ).not.toThrow();
  });
});

/* ===========================================================================
   Booking slots
   =========================================================================== */

// A Tuesday.
const MONDAY = new Date('2026-09-07T00:00:00');

const REQUEST: SlotRequest = {
  from: MONDAY,
  daysAhead: 5,
  hours: 2,
  dailyCapacityHours: 32,
  opening: DEFAULT_OPENING,
  booked: [],
  notBefore: new Date('2026-09-07T00:00:00'),
  bays: 4,
};

describe('available slots', () => {
  it('offers nothing on a day the workshop is shut', () => {
    const sunday = new Date('2026-09-06T00:00:00');
    const slots = availableSlots({ ...REQUEST, from: sunday, daysAhead: 1 });

    expect(slots).toHaveLength(0);
  });

  it('never offers a slot that runs past closing', () => {
    const slots = availableSlots({ ...REQUEST, daysAhead: 1, hours: 3 });
    const last = slots[slots.length - 1]!;

    // Closes at 17:30, so a three-hour job cannot start after 14:30.
    expect(last.startAt.getHours()).toBeLessThanOrEqual(14);
    expect(last.endAt.getHours()).toBeLessThanOrEqual(17);
  });

  it('offers nothing for work longer than the day', () => {
    expect(availableSlots({ ...REQUEST, hours: 12 })).toHaveLength(0);
  });

  it('offers nothing for work of no length', () => {
    expect(availableSlots({ ...REQUEST, hours: 0 })).toHaveLength(0);
  });

  it('does not offer times that have already passed', () => {
    const slots = availableSlots({
      ...REQUEST,
      daysAhead: 1,
      notBefore: new Date('2026-09-07T13:00:00'),
    });

    expect(slots.every((slot) => slot.startAt >= new Date('2026-09-07T13:00:00'))).toBe(true);
  });

  it('refuses a day that is already at capacity', () => {
    // The calendar has gaps, but the technicians do not.
    const booked = Array.from({ length: 8 }, (_, index) => ({
      startAt: new Date(`2026-09-07T08:00:00`),
      endAt: new Date(`2026-09-07T12:00:00`),
      id: `job-${index}`,
    }));

    const slots = availableSlots({
      ...REQUEST,
      daysAhead: 1,
      dailyCapacityHours: 32,
      booked,
    });

    expect(slots).toHaveLength(0);
  });

  it('will not put more work in a bay than there are bays', () => {
    const booked = Array.from({ length: 4 }, (_, index) => ({
      startAt: new Date('2026-09-07T09:00:00'),
      endAt: new Date('2026-09-07T11:00:00'),
      id: `job-${index}`,
    }));

    const slots = availableSlots({ ...REQUEST, daysAhead: 1, booked, bays: 4 });
    const nineToEleven = slots.filter(
      (slot) => slot.startAt.getHours() === 9 && slot.startAt.getMinutes() === 0,
    );

    expect(nineToEleven).toHaveLength(0);
  });

  it('marks a slot that would nearly fill the day', () => {
    const booked = [
      { startAt: new Date('2026-09-07T08:00:00'), endAt: new Date('2026-09-07T16:00:00'), id: 'a' },
      { startAt: new Date('2026-09-07T08:00:00'), endAt: new Date('2026-09-07T16:00:00'), id: 'b' },
      { startAt: new Date('2026-09-07T08:00:00'), endAt: new Date('2026-09-07T15:00:00'), id: 'c' },
    ];

    const slots = availableSlots({ ...REQUEST, daysAhead: 1, booked, dailyCapacityHours: 26 });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.tight)).toBe(true);
  });

  it('reports what the day has left after taking the slot', () => {
    const slots = availableSlots({ ...REQUEST, daysAhead: 1, dailyCapacityHours: 10 });
    expect(slots[0]?.remainingHours).toBe(8);
  });

  it('confirms whether a specific time is still free', () => {
    const at = new Date('2026-09-07T09:00:00');

    expect(isSlotStillFree({ ...REQUEST, daysAhead: 1 }, at)).toBe(true);
    expect(isSlotStillFree({ ...REQUEST, daysAhead: 1, dailyCapacityHours: 1 }, at)).toBe(false);
  });
});

describe('offering slots', () => {
  it('spreads a few across days rather than filling one morning', () => {
    // Twenty options on the same morning is the same choice, harder to make.
    const offered = offerSlots(REQUEST, 3, 4);
    const days = new Set(offered.map((slot) => slot.startAt.toDateString()));

    expect(offered.length).toBeLessThanOrEqual(12);
    expect(days.size).toBeGreaterThan(1);
  });

  it('offers at most the requested number per day', () => {
    const offered = offerSlots(REQUEST, 2, 3);
    const byDay = new Map<string, number>();

    for (const slot of offered) {
      const key = slot.startAt.toDateString();
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    expect([...byDay.values()].every((count) => count <= 2)).toBe(true);
  });
});

describe('what the customer is told', () => {
  it('sends the four messages that change something for them', () => {
    expect(shouldNotify('CONFIRMED')).toBe(true);
    expect(shouldNotify('AWAITING_APPROVAL')).toBe(true);
    expect(shouldNotify('READY')).toBe(true);
  });

  it('stays quiet about the ones that do not', () => {
    // Sending everything trains people to ignore all of it, which costs the
    // one message that mattered.
    expect(shouldNotify('ARRIVED')).toBe(false);
    expect(shouldNotify('COLLECTED')).toBe(false);
    expect(customerMessageFor('COLLECTED', 'Corolla')).toBeNull();
  });

  it('writes messages about the car, not about the job number', () => {
    expect(customerMessageFor('READY', 'Toyota Corolla')).toMatch(/Toyota Corolla is ready/);
    expect(customerMessageFor('AWAITING_APPROVAL', 'BMW X5')).toMatch(/needs a decision/);
  });
});
