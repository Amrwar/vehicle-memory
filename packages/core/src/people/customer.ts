/**
 * Taking down a customer's details.
 *
 * The least glamorous form in the product and the one most of the value hangs
 * off. A customer record with no way to reach them cannot be sent a quote, a
 * reminder or an invoice, and a duplicate of somebody already on file splits
 * their history in half so neither record shows what actually happened to the
 * car.
 *
 * So the rules here are about those two failures and nothing else. Everything
 * optional stays optional: somebody taking a booking over the telephone has
 * about twenty seconds before the caller gets impatient, and a form that
 * demands a postcode in that moment gets a fake postcode.
 */

export class CustomerError extends Error {
  constructor(
    readonly code: 'NO_NAME' | 'NO_CONTACT' | 'BAD_EMAIL' | 'BAD_MOBILE' | 'DUPLICATE',
    message: string,
  ) {
    super(message);
    this.name = 'CustomerError';
  }
}

export type CustomerKind = 'INDIVIDUAL' | 'COMPANY';

export interface CustomerDetails {
  kind: CustomerKind;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
}

/**
 * The name that goes on the invoice.
 *
 * A company is its company name; a person is their two names. Keeping one
 * display name alongside the parts means every list, invoice and message can
 * say who somebody is without reassembling it and getting the spacing wrong.
 */
export function displayNameFor(details: CustomerDetails): string {
  if (details.kind === 'COMPANY') return (details.companyName ?? '').trim();

  return [details.firstName, details.lastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Whether a number could be dialled. Deliberately generous about format. */
export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Whether these details can be saved.
 *
 * Every refusal names the field and says what would fix it, because this form
 * is filled in with somebody on the telephone and "invalid input" costs the
 * person at the counter the call.
 */
export function assertCustomerSaveable(details: CustomerDetails): void {
  const name = displayNameFor(details);

  if (!name) {
    throw new CustomerError(
      'NO_NAME',
      details.kind === 'COMPANY'
        ? 'The company needs a name.'
        : 'A first or last name, at least. It goes on the invoice.',
    );
  }

  const email = details.email?.trim();
  const mobile = details.mobile?.trim();
  const phone = details.phone?.trim();

  // A record with no way to reach somebody cannot be sent a quote, a reminder
  // or an invoice. It is not a customer record, it is a note.
  if (!email && !mobile && !phone) {
    throw new CustomerError(
      'NO_CONTACT',
      'An email address or a telephone number. Without one there is no way to send them a quote or tell them the car is ready.',
    );
  }

  if (email && !EMAIL.test(email)) {
    throw new CustomerError('BAD_EMAIL', 'That email address has something wrong with it.');
  }

  if (mobile && !looksLikePhone(mobile)) {
    throw new CustomerError('BAD_MOBILE', 'That mobile number is too short or too long to dial.');
  }

  if (phone && !looksLikePhone(phone)) {
    throw new CustomerError(
      'BAD_MOBILE',
      'That telephone number is too short or too long to dial.',
    );
  }
}

/**
 * How a possible duplicate is described before anything is saved.
 *
 * Not a refusal. Two people at one address genuinely share a telephone number,
 * and a garage that services a family's three cars has every right to one
 * record or three. What matters is that whoever is typing is shown the match
 * and decides, rather than finding out six months later when half a history is
 * missing from each.
 */
export function describePossibleDuplicate(existing: {
  displayName: string;
  email?: string | null;
  mobile?: string | null;
}): string {
  const how = existing.email ? `the same email address` : `the same mobile number`;

  return `${existing.displayName} is already on file with ${how}. Open them instead of creating a second record, unless this really is a different person.`;
}
