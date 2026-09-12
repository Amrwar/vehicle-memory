import { describe, expect, it } from 'vitest';

import { customerSummary, type SummaryFacts, verifyAgainstFacts } from './summary';

const facts: SummaryFacts = {
  customerFirstName: 'Maria',
  vehicle: '2019 Volkswagen Golf',
  registration: 'AB12 CDE',
  odometerKm: 48210,
  labour: [{ description: 'Replace front brake pads and discs', hours: 1.5 }],
  parts: [
    { description: 'Front brake pads', partNumber: 'BP-1042', quantity: 1 },
    { description: 'Front brake discs', partNumber: 'BD-2210', quantity: 2 },
  ],
  findings: [
    { item: 'Rear tyres', severity: 'ADVISORY', note: '3.5 mm left' },
    { item: 'Battery', severity: 'CRITICAL', note: null },
  ],
  declined: ['Cabin filter'],
  total: '£412.80',
  workshopName: 'Hillside Motors',
};

describe('customerSummary', () => {
  const text = customerSummary(facts);

  it('restates the work and nothing else', () => {
    expect(text).toContain('Hello Maria.');
    expect(text).toContain('2019 Volkswagen Golf (AB12 CDE) at 48,210 km');
    expect(text).toContain('Replace front brake pads and discs (1.5 hours)');
    expect(text).toContain('Front brake discs x2 [BD-2210]');
  });

  it('tells the customer what was noticed, with the finding as recorded', () => {
    expect(text).toContain('Battery: needs attention soon');
    expect(text).toContain('Rear tyres: worth keeping an eye on. 3.5 mm left');
  });

  it('records what they declined so nobody asks twice', () => {
    expect(text).toContain('You chose not to go ahead with: Cabin filter.');
  });

  it('ends with the total and the workshop', () => {
    expect(text).toContain('The total is £412.80.');
    expect(text.trim().endsWith('Hillside Motors')).toBe(true);
  });

  it('says nothing reassuring that is not a finding', () => {
    // "Great shape" tells the customer nothing they can act on.
    expect(text.toLowerCase()).not.toContain('great');
    expect(text.toLowerCase()).not.toContain('excellent');
  });

  it('is its own witness', () => {
    expect(verifyAgainstFacts(text, facts).ok).toBe(true);
  });
});

describe('verifyAgainstFacts', () => {
  it('passes a rewording that keeps every figure', () => {
    const reworded =
      'Hello Maria. We fitted new front brake pads [BP-1042] and two discs [BD-2210] to your Golf at 48,210 km, taking 1.5 hours. The rear tyres have 3.5 mm left. The total is £412.80. Hillside Motors';
    expect(verifyAgainstFacts(reworded, facts)).toEqual({ ok: true, unsupported: [] });
  });

  it('catches an invented part number', () => {
    const invented = 'We also fitted a pollen filter, part CF-9981, while we were in there.';
    const check = verifyAgainstFacts(invented, facts);
    expect(check.ok).toBe(false);
    expect(check.unsupported).toContain('CF-9981');
  });

  it('catches an invented price or measurement', () => {
    expect(
      verifyAgainstFacts('The pads were torqued to 110 Nm and the total is £398.00.', facts)
        .unsupported,
    ).toEqual(['110', '398.00']);
  });

  it('lets small counts in prose through', () => {
    // "two discs" as "2 discs" is not an invented fact.
    expect(verifyAgainstFacts('We fitted 2 discs and checked 4 tyres.', facts).ok).toBe(true);
  });
});
