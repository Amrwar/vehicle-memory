import { describe, expect, it } from 'vitest';

import {
  assertCustomerSaveable,
  describePossibleDuplicate,
  displayNameFor,
  looksLikePhone,
} from './customer';

describe('displayNameFor', () => {
  it('assembles a person from their two names', () => {
    expect(displayNameFor({ kind: 'INDIVIDUAL', firstName: ' Maria ', lastName: 'Okafor' })).toBe(
      'Maria Okafor',
    );
  });

  it('copes with one name only', () => {
    expect(displayNameFor({ kind: 'INDIVIDUAL', firstName: 'Cher' })).toBe('Cher');
  });

  it('uses the company name for a company', () => {
    expect(
      displayNameFor({
        kind: 'COMPANY',
        companyName: ' Northgate Logistics Ltd ',
        firstName: 'Ignored',
      }),
    ).toBe('Northgate Logistics Ltd');
  });
});

describe('assertCustomerSaveable', () => {
  it('needs a name', () => {
    expect(() => assertCustomerSaveable({ kind: 'INDIVIDUAL', email: 'a@b.co' })).toThrow(
      /first or last name/,
    );
    expect(() => assertCustomerSaveable({ kind: 'COMPANY', email: 'a@b.co' })).toThrow(
      /company needs a name/,
    );
  });

  it('needs one way to reach them', () => {
    // A record with no address and no number cannot be sent a quote or told
    // the car is ready. It is a note, not a customer.
    expect(() => assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'Maria' })).toThrow(
      /no way to send them a quote/,
    );
  });

  it('accepts any one of the three ways', () => {
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', email: 'm@example.test' }),
    ).not.toThrow();
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', mobile: '07700 900123' }),
    ).not.toThrow();
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', phone: '0161 496 0114' }),
    ).not.toThrow();
  });

  it('refuses an address with something wrong with it', () => {
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', email: 'maria@' }),
    ).toThrow(/email address/);
  });

  it('refuses a number that cannot be dialled', () => {
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', mobile: '077' }),
    ).toThrow(/too short or too long/);
  });

  it('does not demand a postcode', () => {
    // Somebody taking a booking over the telephone has about twenty seconds.
    expect(() =>
      assertCustomerSaveable({ kind: 'INDIVIDUAL', firstName: 'M', mobile: '07700900123' }),
    ).not.toThrow();
  });
});

describe('looksLikePhone', () => {
  it('is generous about how people write numbers', () => {
    expect(looksLikePhone('07700 900 123')).toBe(true);
    expect(looksLikePhone('+44 (0)161 496 0114')).toBe(true);
  });

  it('draws the line at digits, not punctuation', () => {
    expect(looksLikePhone('123')).toBe(false);
    expect(looksLikePhone('1234567890123456')).toBe(false);
  });
});

describe('describePossibleDuplicate', () => {
  it('names who they already are and how it matched', () => {
    const line = describePossibleDuplicate({
      displayName: 'Maria Okafor',
      email: 'maria@example.test',
    });

    expect(line).toContain('Maria Okafor');
    expect(line).toContain('same email address');
  });

  it('says mobile when that is what matched', () => {
    expect(describePossibleDuplicate({ displayName: 'M', mobile: '07700900123' })).toContain(
      'same mobile number',
    );
  });

  it('offers the way out rather than only the obstacle', () => {
    expect(describePossibleDuplicate({ displayName: 'M', mobile: '1' })).toContain('Open them');
  });
});
