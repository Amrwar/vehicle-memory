import { describe, expect, it } from 'vitest';

import { describeSetup, setupProgress, type SetupFacts } from './checklist';

const fresh: SetupFacts = {
  hasLetterhead: false,
  labourRates: 0,
  taxRates: 1,
  members: 1,
  products: 0,
  customers: 0,
  jobs: 0,
  invoicesIssued: 0,
  reminders: 0,
};

describe('the setup list', () => {
  it('reads the workshop’s own data rather than a tick somebody pressed', () => {
    const progress = setupProgress(fresh);
    expect(progress.steps.find((step) => step.id === 'tax')?.done).toBe(true);
    expect(progress.next?.id).toBe('details');
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(9);
    expect(progress.percent).toBe(11);
  });

  it('is ready once nothing essential is left, complete only when all of it is', () => {
    const essentials = setupProgress({ ...fresh, hasLetterhead: true, labourRates: 1 });
    expect([essentials.ready, essentials.complete]).toEqual([true, false]);

    const all = setupProgress({
      hasLetterhead: true,
      labourRates: 2,
      taxRates: 1,
      members: 3,
      products: 40,
      customers: 12,
      jobs: 9,
      invoicesIssued: 7,
      reminders: 5,
    });
    expect([all.ready, all.complete, all.percent, all.next]).toEqual([true, true, 100, null]);
  });

  it('says what is left, and whether any of it is urgent', () => {
    expect(describeSetup(setupProgress(fresh))).toContain('before you invoice anybody');
    expect(
      describeSetup(setupProgress({ ...fresh, hasLetterhead: true, labourRates: 1 })),
    ).toContain('none of them urgent');
    expect(
      describeSetup(
        setupProgress({
          hasLetterhead: true,
          labourRates: 1,
          taxRates: 1,
          members: 2,
          products: 1,
          customers: 1,
          jobs: 1,
          invoicesIssued: 1,
          reminders: 1,
        }),
      ),
    ).toBe('Everything on the setup list is done.');
  });
});
