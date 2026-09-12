/**
 * Sending a quote to the customer.
 *
 * The estimate has existed since Phase 1 and the customer's decision screen
 * since Phase 4. What never existed was the step between them: nothing in the
 * product issued the link or wrote the message, so the only quote a customer
 * could ever open was the one the seed created. The job page had a button
 * that said "Send estimate" with nothing behind it.
 *
 * The rules are small and all about not sending the wrong thing.
 */

export class QuoteError extends Error {
  constructor(
    readonly code: 'NOT_DRAFT' | 'EMPTY' | 'NO_ADDRESS' | 'ZERO',
    message: string,
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}

/**
 * How long a quote link stays open.
 *
 * Long enough that a customer who reads it on Friday can decide on Monday;
 * short enough that a link forwarded around does not open a price list for a
 * month. The workshop can withdraw one earlier at any point.
 */
export const QUOTE_LINK_DAYS = 14;

export type QuoteStatus =
  'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DECLINED' | 'EXPIRED' | 'SUPERSEDED';

export interface QuoteReadiness {
  status: QuoteStatus;
  lineCount: number;
  total: number;
  /** Whether the customer has an address on the chosen channel. */
  reachable: boolean;
}

/** Whether a quote may go out. */
export function assertQuoteSendable(quote: QuoteReadiness): void {
  if (quote.status !== 'DRAFT') {
    throw new QuoteError(
      'NOT_DRAFT',
      quote.status === 'SENT'
        ? 'This quote has already been sent. If the price has changed, raise a new version rather than sending the old one twice.'
        : `This quote is ${quote.status.toLowerCase().replace('_', ' ')} and cannot be sent again.`,
    );
  }

  if (quote.lineCount === 0) {
    throw new QuoteError(
      'EMPTY',
      'There is nothing on this quote yet. Add the work before sending it.',
    );
  }

  // A zero total is nearly always an unpriced line, and a customer approving
  // nought pounds of work is a conversation nobody wants afterwards.
  if (quote.total <= 0) {
    throw new QuoteError(
      'ZERO',
      'The total is zero. Price the lines first, or the customer will approve free work.',
    );
  }

  if (!quote.reachable) {
    throw new QuoteError(
      'NO_ADDRESS',
      'The customer has no email address or mobile number on file, so there is nowhere to send it. Add one on their record first.',
    );
  }
}

/** Which channel a quote goes by, given what the customer has. */
export function quoteChannelFor(customer: {
  email?: string | null;
  mobile?: string | null;
}): 'EMAIL' | 'SMS' | null {
  // Email first. A quote is a document with line items, and a text message
  // carrying a link is the fallback rather than the preference.
  if (customer.email?.trim()) return 'EMAIL';
  if (customer.mobile?.trim()) return 'SMS';
  return null;
}

/** The words the customer reads. Short, and it says what to do. */
export function quoteMessage(input: {
  customerName: string;
  workshopName: string;
  vehicle: string;
  jobNumber: number;
  total: string;
  link: string;
  channel: 'EMAIL' | 'SMS';
}): { subject: string; body: string } {
  const subject = `Your quote from ${input.workshopName} for the ${input.vehicle}`;

  if (input.channel === 'SMS') {
    return {
      subject,
      body: `${input.workshopName}: your quote for the ${input.vehicle} is ready (${input.total}). Approve or decline each item here: ${input.link}`,
    };
  }

  return {
    subject,
    body: [
      `Hello ${input.customerName.split(' ')[0]}.`,
      '',
      `We have looked at the ${input.vehicle} (job ${input.jobNumber}) and put together a quote. The total is ${input.total}.`,
      '',
      'You can approve or decline each item separately, and nothing is done until you have:',
      '',
      input.link,
      '',
      `The link lasts ${QUOTE_LINK_DAYS} days. If anything is unclear, reply to this email or ring us and ask for whoever is looking after the car.`,
      '',
      input.workshopName,
    ].join('\n'),
  };
}
