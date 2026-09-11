import { describe, expect, it } from 'vitest';

import {
  assertCreditable,
  assertRedeemable,
  balanceOf,
  type Entry,
  LoyaltyError,
  looksLikeCode,
  pointsExpiringWithin,
  pointsFor,
  referralCode,
  valueOf,
} from './loyalty';
import {
  ASK_AFTER_HOURS,
  type Askable,
  MIN_RESPONSES,
  type Rated,
  routeRating,
  satisfactionOf,
  shouldAsk,
} from './reviews';

const at = (iso: string) => new Date(`${iso}T09:00:00`);
const NOW = at('2026-09-11');

describe('routeRating', () => {
  it('invites a five to say so publicly', () => {
    const routed = routeRating(5);

    expect(routed.routing).toBe('PUBLIC_INVITE');
    expect(routed.needsAttention).toBe(false);
  });

  it('thanks a four without inviting one', () => {
    // Four out of five means something was not quite right. An invitation to
    // post publicly reads as though nobody noticed the missing star.
    const routed = routeRating(4);

    expect(routed.routing).toBe('THANKS_ONLY');
    expect(routed.message).toContain('made it a five');
  });

  it('flags a four that came with something written', () => {
    expect(routeRating(4, 'Took two days longer than you said').needsAttention).toBe(true);
    expect(routeRating(4, '   ').needsAttention).toBe(false);
  });

  it('opens a conversation on anything lower, and says somebody will read it', () => {
    for (const rating of [1, 2, 3]) {
      const routed = routeRating(rating);

      expect(routed.routing).toBe('PRIVATE_CONVERSATION');
      expect(routed.needsAttention).toBe(true);
      expect(routed.message).toContain('put it right');
    }
  });
});

describe('shouldAsk', () => {
  const job: Askable = {
    jobId: 'job-1',
    customerId: 'cust-1',
    completedAt: at('2026-09-08'),
    status: 'PAID',
    alreadyAsked: false,
    lastAskedAt: null,
    hasEmail: true,
    hasMobile: false,
    marketingConsent: true,
    complaintOpen: false,
  };

  it('asks about a finished job', () => {
    expect(shouldAsk(job, NOW).ask).toBe(true);
  });

  it('does not ask about work still in the building', () => {
    expect(shouldAsk({ ...job, status: 'IN_PROGRESS' }, NOW).reason).toBe('NOT_FINISHED');
  });

  it('does not ask twice about one job', () => {
    expect(shouldAsk({ ...job, alreadyAsked: true }, NOW).reason).toBe('ALREADY_ASKED');
  });

  it('does not ask somebody who is waiting to hear back', () => {
    // Asking how it went while they are waiting on an unresolved complaint
    // reads as though nobody is listening.
    const decision = shouldAsk({ ...job, complaintOpen: true }, NOW);

    expect(decision.reason).toBe('COMPLAINT_OPEN');
    expect(decision.why).toContain('nobody is listening');
  });

  it('does not ask before they have driven it', () => {
    const decision = shouldAsk(
      { ...job, completedAt: new Date(NOW.getTime() - 2 * 3_600_000) },
      NOW,
    );

    expect(decision.reason).toBe('TOO_SOON');
    expect(decision.why).toContain(String(ASK_AFTER_HOURS));
  });

  it('leaves a regular customer alone between requests', () => {
    // Somebody who comes in monthly should not be asked monthly.
    expect(shouldAsk({ ...job, lastAskedAt: at('2026-08-20') }, NOW).reason).toBe('RECENTLY_ASKED');
  });

  it('does not ask somebody who never agreed to be contacted', () => {
    expect(shouldAsk({ ...job, marketingConsent: false }, NOW).reason).toBe('NO_CONSENT');
  });

  it('does not ask somebody it cannot reach', () => {
    expect(shouldAsk({ ...job, hasEmail: false, hasMobile: false }, NOW).reason).toBe(
      'UNREACHABLE',
    );
  });

  it('gives a reason for every refusal', () => {
    // The screen showing a workshop who was not asked is the screen telling
    // them why their review count is low.
    const refusals = [
      { ...job, status: 'IN_PROGRESS' },
      { ...job, alreadyAsked: true },
      { ...job, complaintOpen: true },
      { ...job, marketingConsent: false },
    ];

    for (const refused of refusals) {
      const decision = shouldAsk(refused, NOW);
      expect(decision.ask).toBe(false);
      expect(decision.why!.length).toBeGreaterThan(10);
    }
  });
});

describe('satisfactionOf', () => {
  const rated = (rating: number, overrides: Partial<Rated> = {}): Rated => ({
    rating,
    respondedAt: at('2026-09-01'),
    routing: rating >= 5 ? 'PUBLIC_INVITE' : rating === 4 ? 'THANKS_ONLY' : 'PRIVATE_CONVERSATION',
    resolvedAt: null,
    ...overrides,
  });

  it('refuses to average too few answers', () => {
    // One unhappy customer moves a figure built on three by a star and a half,
    // and a number that swings like that reads as a measurement.
    const few = satisfactionOf([rated(5), rated(4)], 10, NOW);

    expect(few.average).toBeNull();
    expect(few.summary).toContain('Too few to average');
  });

  it('averages once enough people have answered', () => {
    const enough = satisfactionOf(
      Array.from({ length: MIN_RESPONSES }, () => rated(4)),
      10,
      NOW,
    );

    expect(enough.average).toBe(4);
    expect(enough.responseRate).toBe(0.5);
  });

  it('counts conversations nobody has closed off', () => {
    const satisfaction = satisfactionOf(
      [rated(2), rated(2, { resolvedAt: at('2026-09-05') }), rated(5)],
      3,
      NOW,
    );

    expect(satisfaction.openConversations).toBe(1);
  });

  it('says plainly when nobody has been asked', () => {
    expect(satisfactionOf([], 0, NOW).summary).toBe('Nobody has been asked yet.');
  });

  it('distinguishes nobody asked from nobody answering', () => {
    expect(satisfactionOf([], 12, NOW).summary).toContain('12 asked');
  });
});

describe('balanceOf', () => {
  const entry = (points: number, overrides: Partial<Entry> = {}): Entry => ({
    points,
    reason: 'Work done',
    createdAt: at('2026-01-01'),
    expiresAt: null,
    ...overrides,
  });

  it('adds the entries rather than trusting a stored total', () => {
    expect(balanceOf([entry(120), entry(-50), entry(30)], NOW)).toBe(100);
  });

  it('leaves out points that have lapsed', () => {
    expect(balanceOf([entry(100, { expiresAt: at('2026-01-01') }), entry(40)], NOW)).toBe(40);
  });

  it('never lets an expiry date wipe out a redemption', () => {
    // A negative entry is money already given away. Expiring it would hand it
    // back, which is the kind of error that shows up as a reconciliation gap.
    expect(balanceOf([entry(100), entry(-40, { expiresAt: at('2026-01-01') })], NOW)).toBe(60);
  });
});

describe('pointsExpiringWithin', () => {
  it('names what is about to lapse, and when', () => {
    const lapsing = pointsExpiringWithin(
      [
        { points: 50, reason: '', createdAt: NOW, expiresAt: at('2026-10-01') },
        { points: 20, reason: '', createdAt: NOW, expiresAt: at('2026-09-20') },
        { points: 90, reason: '', createdAt: NOW, expiresAt: at('2027-06-01') },
      ],
      60,
      NOW,
    );

    expect(lapsing.points).toBe(70);
    expect(lapsing.on).toEqual(at('2026-09-20'));
  });

  it('says nothing when nothing is going', () => {
    expect(pointsExpiringWithin([], 60, NOW)).toEqual({ points: 0, on: null });
  });
});

describe('pointsFor and valueOf', () => {
  it('floors what is earned rather than rounding it up', () => {
    // Rounding up hands out points nobody spent, and the scheme quietly costs
    // more than the rate says it does.
    expect(pointsFor(9_999)).toBe(99);
    expect(pointsFor(10_000)).toBe(100);
    expect(pointsFor(0)).toBe(0);
    expect(pointsFor(-500)).toBe(0);
  });

  it('floors what is redeemed too', () => {
    expect(valueOf(150, 1)).toBe(150);
    expect(valueOf(0)).toBe(0);
    expect(valueOf(-10)).toBe(0);
  });
});

describe('assertRedeemable', () => {
  it('allows a redemption inside the balance and the bill', () => {
    expect(assertRedeemable({ balance: 500, points: 300, owedMinor: 5_000 })).toBe(300);
  });

  it('refuses rather than quietly using fewer', () => {
    // Redeeming fewer points than somebody asked for produces a bill they did
    // not expect, and they find out at the counter.
    expect(() => assertRedeemable({ balance: 100, points: 300, owedMinor: 5_000 })).toThrow(
      /200 points more/,
    );
  });

  it('refuses to pay out more than is owed', () => {
    expect(() => assertRedeemable({ balance: 9_000, points: 9_000, owedMinor: 1_000 })).toThrow(
      /do not pay out as money/,
    );
  });

  it('refuses nothing at all', () => {
    expect(() => assertRedeemable({ balance: 100, points: 0, owedMinor: 5_000 })).toThrow(
      LoyaltyError,
    );
  });
});

describe('assertCreditable', () => {
  const state = {
    referrerCustomerId: 'cust-1',
    referredCustomerId: 'cust-2',
    creditedAt: null,
    referredSpendMinor: 12_000,
  };

  it('pays a real referral', () => {
    expect(() => assertCreditable(state)).not.toThrow();
  });

  it('refuses before anybody has used the code', () => {
    expect(() => assertCreditable({ ...state, referredCustomerId: null })).toThrow(
      /nobody has used/i,
    );
  });

  it('refuses somebody referring themselves', () => {
    expect(() => assertCreditable({ ...state, referredCustomerId: 'cust-1' })).toThrow(
      /same customer/,
    );
  });

  it('refuses to pay twice', () => {
    expect(() => assertCreditable({ ...state, creditedAt: NOW })).toThrow(/already been paid/);
  });

  it('waits until they have actually had work done', () => {
    // A scheme that pays on sign-up pays for email addresses, and the workshop
    // finds that out one quarter later.
    expect(() => assertCreditable({ ...state, referredSpendMinor: 500 })).toThrow(
      /actually had work done/,
    );
  });
});

describe('referralCode', () => {
  it('avoids the characters that get misheard over a counter', () => {
    // No I against 1, no O against 0, no S against 5. A code read wrongly
    // credits the wrong customer.
    const code = referralCode(() => 0.5);

    expect(code).toHaveLength(6);
    expect(code).not.toMatch(/[IOSU015AEIOU]/);
  });

  it('recognises one of its own, however it is typed', () => {
    expect(looksLikeCode(' bc-df gh ')).toBe(true);
    expect(looksLikeCode('BCDFG')).toBe(false);
    expect(looksLikeCode('BCDFGI')).toBe(false);
  });
});
