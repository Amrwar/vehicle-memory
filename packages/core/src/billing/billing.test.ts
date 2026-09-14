import { describe, expect, it } from 'vitest';

import { toDecimalString } from '../shared/money';
import {
  annualSaving,
  assertFeature,
  assertUsage,
  checkUsage,
  cheapestWith,
  hasFeature,
  monthlyCost,
  NO_LIMIT,
  PLAN_ORDER,
  PLANS,
  PlanLimitError,
  planFor,
  savingPercent,
  suggestPlan,
} from './plans';
import {
  domainOf,
  isConsumerEmail,
  isDisposableEmail,
  MIN_PASSWORD_LENGTH,
  onlySoftProblems,
  slugify,
  trialDaysRemaining,
  trialEndsOn,
  uniqueSlug,
  validateSignup,
  type SignupInput,
} from './signup';

/* ===========================================================================
   Plans
   =========================================================================== */

describe('plans', () => {
  it('puts the passport in every tier', () => {
    // The one deliberate exception to tiering. It is the part of the product
    // that compounds, and hiding it behind the top plan would strangle it.
    for (const id of PLAN_ORDER) {
      expect(hasFeature(id, 'passport')).toBe(true);
    }
  });

  it('never removes a feature as the tier goes up', () => {
    const keys = Object.keys(PLANS.CORE.features) as (keyof typeof PLANS.CORE.features)[];

    for (const [index, id] of PLAN_ORDER.entries()) {
      const previous = PLAN_ORDER[index - 1];
      if (!previous) continue;

      for (const key of keys) {
        if (PLANS[previous].features[key]) {
          expect(PLANS[id].features[key]).toBe(true);
        }
      }
    }
  });

  it('never lowers a limit as the tier goes up', () => {
    for (const [index, id] of PLAN_ORDER.entries()) {
      const previous = PLAN_ORDER[index - 1];
      if (!previous) continue;

      for (const key of ['users', 'locations', 'bays', 'vehicles'] as const) {
        expect(PLANS[id].limits[key]).toBeGreaterThanOrEqual(PLANS[previous].limits[key]);
      }
    }
  });

  it('always prices annual below monthly', () => {
    for (const id of PLAN_ORDER) {
      expect(PLANS[id].price.minor).toBeLessThan(PLANS[id].priceMonthly.minor);
    }
  });

  it('falls back to the entry tier for an unknown plan', () => {
    expect(planFor('NONSENSE').id).toBe('CORE');
    expect(planFor('GROUP').id).toBe('GROUP');
  });

  it('names the cheapest plan that includes a feature', () => {
    expect(cheapestWith('ledger')).toBe('COMPLETE');
    expect(cheapestWith('multiSite')).toBe('GROUP');
    expect(cheapestWith('inspections')).toBe('CORE');
  });

  it('refuses a feature the plan lacks, and says which plan has it', () => {
    expect(() => assertFeature('CORE', 'ledger')).toThrow(PlanLimitError);

    try {
      assertFeature('CORE', 'ledger');
    } catch (error) {
      const problem = error as PlanLimitError;
      expect(problem.code).toBe('FEATURE');
      expect(problem.suggestion).toBe('COMPLETE');
      // The message has to name the destination. "Upgrade to continue" with
      // nowhere to go is the worst version of this.
      expect(problem.message).toMatch(/Complete/);
      expect(problem.message).toMatch(/general ledger/);
    }
  });

  it('allows a feature the plan includes', () => {
    expect(() => assertFeature('COMPLETE', 'ledger')).not.toThrow();
    expect(() => assertFeature('GROUP', 'transfers')).not.toThrow();
  });
});

describe('usage limits', () => {
  it('allows one more while below the limit', () => {
    const check = checkUsage('CORE', 'bays', 3);

    expect(check.within).toBe(true);
    expect(check.approaching).toBe(false);
    expect(check.message).toBeNull();
  });

  it('never limits staff accounts on any tier', () => {
    // Deliberate, and load-bearing. Capping users bills a workshop for giving
    // its staff access, which is the opposite of what this product wants. The
    // business model argues it explicitly.
    for (const id of PLAN_ORDER) {
      expect(PLANS[id].limits.users).toBe(NO_LIMIT);
      expect(checkUsage(id, 'users', 500).within).toBe(true);
    }
  });

  it('warns before it stops, and says what the next plan allows', () => {
    // A hard stop at four on a Friday with a car on the ramp is not a moment
    // to be learning about a limit.
    const check = checkUsage('CORE', 'bays', 5);

    expect(check.within).toBe(true);
    expect(check.approaching).toBe(true);
    expect(check.message).toMatch(/5 of 6 bays/);
    expect(check.message).toMatch(/Complete raises this to 24/);
  });

  it('refuses at the limit rather than above it', () => {
    // Six used means the seventh is the one being created.
    expect(checkUsage('CORE', 'bays', 6).within).toBe(false);
    expect(() => assertUsage('CORE', 'bays', 6)).toThrow(PlanLimitError);
  });

  it('explains a refusal with both numbers', () => {
    try {
      assertUsage('CORE', 'locations', 1);
    } catch (error) {
      expect((error as PlanLimitError).message).toMatch(/covers 1 sites and you have 1/);
      expect((error as PlanLimitError).suggestion).toBe('GROUP');
    }
  });

  it('never reports approaching on an unlimited plan', () => {
    const check = checkUsage('GROUP', 'bays', NO_LIMIT - 1);
    expect(check.approaching).toBe(false);
  });
});

describe('pricing arithmetic', () => {
  it('charges per bay', () => {
    // The figures the business model's unit economics are built on: a six-bay
    // workshop pays 234 a month on Core and 414 on Complete.
    expect(toDecimalString(monthlyCost('CORE', 6, true))).toBe('234.00');
    expect(toDecimalString(monthlyCost('COMPLETE', 6, true))).toBe('414.00');
  });

  it('treats zero bays as one rather than as free', () => {
    expect(monthlyCost('CORE', 0, true).minor).toBe(PLANS.CORE.price.minor);
  });

  it('computes the annual saving over a year, not a month', () => {
    // Complete is 83 monthly against 69 annual, so 14 a month, 168 a year.
    expect(toDecimalString(annualSaving('COMPLETE', 1))).toBe('168.00');
    expect(savingPercent('COMPLETE')).toBe(17);
  });
});

describe('plan suggestion', () => {
  it('sends anybody with more than one site to Group', () => {
    expect(suggestPlan({ sites: 2, bays: 2, wantsAccounts: false })).toBe('GROUP');
  });

  it('sends a workshop that wants its books kept to Complete', () => {
    expect(suggestPlan({ sites: 1, bays: 3, wantsAccounts: true })).toBe('COMPLETE');
  });

  it('sends a workshop that outgrows Core on bays to Complete', () => {
    expect(suggestPlan({ sites: 1, bays: 9, wantsAccounts: false })).toBe('COMPLETE');
  });

  it('leaves a small single site on Core', () => {
    expect(suggestPlan({ sites: 1, bays: 3, wantsAccounts: false })).toBe('CORE');
  });
});

/* ===========================================================================
   Signing up
   =========================================================================== */

const VALID: SignupInput = {
  workshopName: 'Hillside Motors',
  contactName: 'Ahmed Bakri',
  email: 'ahmed@hillsidemotors.co.uk',
  password: 'a-long-enough-one',
  sites: 1,
};

describe('signup validation', () => {
  it('accepts a complete submission', () => {
    expect(validateSignup(VALID)).toEqual([]);
  });

  it('reports every problem at once, not the first', () => {
    // One error at a time turns a form into a guessing game.
    const problems = validateSignup({
      workshopName: '',
      contactName: '',
      email: 'nope',
      password: 'short',
      sites: 0,
    });

    expect(problems.map((problem) => problem.field).sort()).toEqual([
      'contactName',
      'email',
      'password',
      'sites',
      'workshopName',
    ]);
  });

  it('refuses a disposable address', () => {
    const problems = validateSignup({ ...VALID, email: 'someone@mailinator.com' });
    expect(problems[0]?.message).toMatch(/disposable/);
  });

  it('warns about a personal address without treating it as fatal', () => {
    // Plenty of small garages genuinely run on a free address.
    const problems = validateSignup({ ...VALID, email: 'ahmed@gmail.com' });

    expect(problems).toHaveLength(1);
    expect(onlySoftProblems(problems)).toBe(true);
  });

  it('does not treat a real failure as soft', () => {
    expect(onlySoftProblems(validateSignup({ ...VALID, password: 'x' }))).toBe(false);
  });

  it('refuses a password shorter than the minimum', () => {
    const problems = validateSignup({ ...VALID, password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) });
    expect(problems[0]?.field).toBe('password');
  });

  it('refuses the workshop name inside the password', () => {
    const problems = validateSignup({ ...VALID, password: 'hillside motors 2026' });
    expect(problems[0]?.message).toMatch(/workshop name/);
  });

  it('refuses a name that would collide with a route', () => {
    const problems = validateSignup({ ...VALID, workshopName: 'Settings' });
    expect(problems[0]?.message).toMatch(/reserved/);
  });

  it('refuses a name with no letters or numbers in it', () => {
    const problems = validateSignup({ ...VALID, workshopName: '!!!' });
    expect(problems[0]?.field).toBe('workshopName');
  });

  it('refuses an absurd number of sites', () => {
    expect(validateSignup({ ...VALID, sites: 5000 })[0]?.field).toBe('sites');
  });
});

describe('email domains', () => {
  it('reads the domain', () => {
    expect(domainOf('a@b.co.uk')).toBe('b.co.uk');
    expect(domainOf('no-at-sign')).toBeNull();
    expect(domainOf('trailing@')).toBeNull();
  });

  it('recognises consumer and disposable domains regardless of case', () => {
    expect(isConsumerEmail('Someone@GMAIL.com')).toBe(true);
    expect(isDisposableEmail('a@YOPMAIL.com')).toBe(true);
    expect(isConsumerEmail('a@hillsidemotors.co.uk')).toBe(false);
  });
});

describe('slugs', () => {
  it('makes a readable slug from a trading name', () => {
    expect(slugify('Hillside Motors Ltd')).toBe('hillside-motors-ltd');
    expect(slugify('  A & B  Garage ')).toBe('a-and-b-garage');
  });

  it('strips accents rather than dropping the letters', () => {
    expect(slugify('Garage Citroën')).toBe('garage-citroen');
  });

  it('never ends on a separator', () => {
    expect(slugify('Motors!!!')).toBe('motors');
    expect(slugify('x'.repeat(60)).endsWith('-')).toBe(false);
  });

  it('numbers a collision rather than randomising it', () => {
    // Two garages of the same name in different towns should both read as
    // deliberate, not as a hash.
    const taken = new Set(['hillside-motors']);
    expect(uniqueSlug('Hillside Motors', taken)).toBe('hillside-motors-2');

    taken.add('hillside-motors-2');
    expect(uniqueSlug('Hillside Motors', taken)).toBe('hillside-motors-3');
  });

  it('avoids a reserved slug even when it is free', () => {
    expect(uniqueSlug('Portal', new Set())).toBe('portal-2');
  });

  it('falls back rather than producing an empty slug', () => {
    expect(uniqueSlug('###', new Set())).toBe('workshop');
  });
});

describe('trial', () => {
  it('ends at the close of the fourteenth day', () => {
    // Two weeks: long enough to run a real week of jobs and see the
    // passport fill, short enough that a card taken up front is not
    // forgotten by the time it is charged.
    const end = trialEndsOn(new Date('2026-09-01T09:00:00'));

    expect(end.getDate()).toBe(15);
    expect(end.getMonth()).toBe(8);
    expect(end.getHours()).toBe(23);
  });

  it('counts remaining days without going negative', () => {
    const end = new Date('2026-09-15T23:59:59');

    expect(trialDaysRemaining(end, new Date('2026-09-08T09:00:00'))).toBe(8);
    expect(trialDaysRemaining(end, new Date('2026-10-01T09:00:00'))).toBe(0);
  });
});
