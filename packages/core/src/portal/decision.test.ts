import { describe, expect, it } from 'vitest';

import { toDecimalString } from '../shared/money';
import {
  assertDecidable,
  confirmationFor,
  decide,
  type DecidableLine,
  type DecisionError,
  customerProgressFor,
} from './decision';

const LINES: DecidableLine[] = [
  {
    id: 'l1',
    description: 'Front brake pads',
    totalMinor: 14_000,
    isOptional: false,
    isSafetyCritical: true,
    decision: 'PENDING',
  },
  {
    id: 'l2',
    description: 'Air filter',
    totalMinor: 2_400,
    isOptional: true,
    isSafetyCritical: false,
    decision: 'PENDING',
  },
  {
    id: 'l3',
    description: 'Wiper blades',
    totalMinor: 1_800,
    isOptional: true,
    isSafetyCritical: false,
    decision: 'PENDING',
  },
];

describe('whether a quote can still be answered', () => {
  const open = { status: 'SENT' as const, validUntil: new Date('2026-12-01') };

  it('accepts one that is open', () => {
    expect(() => assertDecidable({ ...open, now: new Date('2026-09-09') })).not.toThrow();
  });

  it('distinguishes replaced from expired', () => {
    // "This quote has expired" invites a phone call. "Your workshop has sent an
    // updated quote" tells somebody where to look.
    expect(() => assertDecidable({ ...open, status: 'SUPERSEDED' })).toThrow(/updated quote/);
    expect(() =>
      assertDecidable({
        status: 'SENT',
        validUntil: new Date('2026-01-01'),
        now: new Date('2026-09-09'),
      }),
    ).toThrow(/expired/);
  });

  it('refuses one already answered', () => {
    expect(() => assertDecidable({ ...open, status: 'APPROVED' })).toThrow(/already answered/);
    expect(() => assertDecidable({ ...open, status: 'PARTIALLY_APPROVED' })).toThrow(
      /already answered/,
    );
  });

  it('refuses one the workshop has not sent', () => {
    expect(() => assertDecidable({ ...open, status: 'DRAFT' })).toThrow(/not sent/);
  });

  it('carries a code', () => {
    try {
      assertDecidable({ ...open, status: 'DRAFT' });
    } catch (error) {
      expect((error as DecisionError).code).toBe('NOT_OPEN');
    }
  });
});

describe('deciding line by line', () => {
  it('approves everything when everything is ticked', () => {
    const outcome = decide(LINES, ['l1', 'l2', 'l3']);

    expect(outcome.status).toBe('APPROVED');
    expect(toDecimalString(outcome.approved)).toBe('182.00');
    expect(toDecimalString(outcome.declined)).toBe('0.00');
  });

  it('declines everything when nothing is ticked', () => {
    // Nothing is preselected, so an untouched form is a decline and has to
    // work as one rather than erroring.
    const outcome = decide(LINES, []);

    expect(outcome.status).toBe('DECLINED');
    expect(toDecimalString(outcome.declined)).toBe('182.00');
  });

  it('splits the quote rather than losing it whole', () => {
    // An estimate offered as one take-it-or-leave-it figure gets declined
    // whole, and the workshop loses the lines the customer would have taken.
    const outcome = decide(LINES, ['l1']);

    expect(outcome.status).toBe('PARTIALLY_APPROVED');
    expect(toDecimalString(outcome.approved)).toBe('140.00');
    expect(toDecimalString(outcome.declined)).toBe('42.00');
    expect(outcome.declinedIds).toEqual(['l2', 'l3']);
  });

  it('declines anything not ticked, explicitly', () => {
    // Leaving a line pending means the workshop has to ring to find out,
    // which is the call this screen exists to avoid.
    const outcome = decide(LINES, ['l2']);
    expect(outcome.declinedIds).toContain('l1');
    expect(outcome.declinedIds).toContain('l3');
  });

  it('lets a safety item be declined, and records that it was', () => {
    // It is the customer's car. The system's job is to make sure they were
    // told and that the telling was recorded, not to refuse them.
    const outcome = decide(LINES, ['l2', 'l3']);

    expect(outcome.status).toBe('PARTIALLY_APPROVED');
    expect(outcome.declinedSafetyCritical.map((line) => line.id)).toEqual(['l1']);
  });

  it('refuses a line it has never heard of', () => {
    expect(() => decide(LINES, ['l1', 'gone'])).toThrow(/changed/);
  });
});

describe('what the customer is told before committing', () => {
  it('states the consequence of declining everything', () => {
    expect(confirmationFor(decide(LINES, []))).toMatch(/nothing will be done/);
  });

  it('names the safety items being left, without scolding', () => {
    const message = confirmationFor(decide(LINES, ['l2', 'l3']));

    expect(message).toMatch(/One item you are leaving was/);
    expect(message).toMatch(/stay on the vehicle's record/);
  });

  it('says nothing about safety when nothing safety-related was left', () => {
    expect(confirmationFor(decide(LINES, ['l1', 'l2']))).not.toMatch(/safety/);
  });
});

describe('what a job looks like to the person waiting for the car', () => {
  it('translates workshop status into the answer they want', () => {
    // "Quality check" means something precise to a service manager and nothing
    // at all to somebody waiting for their car.
    expect(customerProgressFor('QUALITY_CHECK').label).toBe('Almost ready');
    expect(customerProgressFor('QUALITY_CHECK').detail).toMatch(/before you collect it/);
  });

  it('marks the states where nothing more is owed', () => {
    expect(customerProgressFor('PAID').done).toBe(true);
    expect(customerProgressFor('IN_PROGRESS').done).toBe(false);
  });

  it('points at the quote when the job is waiting on the customer', () => {
    expect(customerProgressFor('AWAITING_APPROVAL').label).toBe('Waiting on you');
  });

  it('falls back to something true rather than to a raw status', () => {
    expect(customerProgressFor('SOMETHING_NEW').label).toBe('Booked in');
  });
});
