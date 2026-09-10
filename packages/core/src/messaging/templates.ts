/**
 * Turning a template into the words a customer reads.
 *
 * The failure this exists to prevent is small and extremely visible: a message
 * that goes out saying "Hi {{firstName}}, your Vauxhall is ready". Every
 * template system produces one eventually, because the substitution silently
 * does nothing when the value is missing and nothing downstream checks.
 *
 * So rendering is strict. An unknown placeholder is refused when the template
 * is saved, and a missing value is refused when the message is built. Both
 * refusals happen before anything is queued, because once a row is in the
 * outbound table the next thing that touches it is a provider.
 */

export class TemplateError extends Error {
  readonly code: 'UNKNOWN_FIELD' | 'MISSING_VALUE' | 'MALFORMED' | 'TOO_LONG';

  constructor(code: TemplateError['code'], message: string) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
  }
}

/**
 * What a template is allowed to mention.
 *
 * A fixed list rather than "whatever the caller passes", so a template written
 * today cannot start rendering blank when the shape of the data changes
 * underneath it. Adding a field here is a deliberate act.
 */
export const FIELDS = [
  'firstName',
  'lastName',
  'customerName',
  'workshopName',
  'workshopPhone',
  'vehicle',
  'registration',
  'jobNumber',
  'invoiceNumber',
  'amount',
  'dueDate',
  'bookingDate',
  'bookingTime',
  'serviceName',
  'link',
] as const;

export type Field = (typeof FIELDS)[number];

export type Values = Partial<Record<Field, string>>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]*)\s*\}\}/g;

/** Every placeholder a template uses, in the order it uses them. */
export function placeholdersIn(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '');
}

/**
 * Checks a template before it is ever used.
 *
 * Called when somebody writes a rule or a campaign, so the complaint arrives
 * while they are looking at the thing they typed rather than in a log three
 * days later next to a message that has already been sent.
 */
export function assertTemplateSound(template: string): void {
  // A single brace is almost always a typo for a placeholder, and it renders
  // as itself, which nobody notices until a customer quotes it back.
  const stray = template.replace(PLACEHOLDER, '').match(/\{\{|\}\}/);

  if (stray) {
    throw new TemplateError(
      'MALFORMED',
      'There is an unclosed {{ or }} in this message. Placeholders look like {{firstName}}.',
    );
  }

  for (const name of placeholdersIn(template)) {
    if (!FIELDS.includes(name as Field)) {
      throw new TemplateError(
        'UNKNOWN_FIELD',
        `There is nothing called {{${name}}}. You can use: ${FIELDS.join(', ')}.`,
      );
    }
  }
}

/**
 * Fills a template in, or refuses.
 *
 * A blank value counts as missing. Rendering "Hi , your car is ready" is worse
 * than not sending, because it is the workshop's name at the bottom of it.
 */
export function render(template: string, values: Values): string {
  assertTemplateSound(template);

  return template.replace(PLACEHOLDER, (_match, rawName: string) => {
    const value = values[rawName as Field];

    if (value === undefined || value.trim() === '') {
      throw new TemplateError(
        'MISSING_VALUE',
        `This message needs {{${rawName}}} and there is nothing to put there.`,
      );
    }

    return value;
  });
}

/**
 * Whether a template can be filled from these values, without throwing.
 *
 * Used to show a workshop which of their customers a campaign can actually
 * reach, before they send it. The reason is the same sentence they would have
 * seen as an error, so the two never drift apart.
 */
export function canRender(
  template: string,
  values: Values,
): { ok: boolean; reason: string | null } {
  try {
    render(template, values);
    return { ok: true, reason: null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Cannot be filled in.' };
  }
}

/** One text segment. Past this a message is billed, and arrives, as several. */
export const SMS_SEGMENT = 160;

/** With any non-GSM character anywhere, the whole message uses this instead. */
export const SMS_UNICODE_SEGMENT = 70;

// The GSM 03.38 basic set, which is what a provider can send at 160 characters
// a segment. A curly apostrophe from a word processor is not in it, and one of
// them more than halves the length of every message it appears in.
const GSM = /^[A-Za-z0-9@£$¥èéùìòÇØøÅåÆæßÉÄÖÑÜäöñüà\r\n\s!"#¤%&'()*+,\-./:;<=>?_¡¿§^{}\\[~\]|€]*$/;

export interface Segmentation {
  segments: number;
  characters: number;
  unicode: boolean;
  /** The characters that forced the message out of the basic alphabet. */
  offenders: string[];
}

/**
 * How many texts this actually is.
 *
 * Shown before sending because the cost is per segment, and a curly
 * apostrophe pasted from a word processor turns a one-segment message into
 * three: it drops the whole text out of the basic alphabet, which cuts the
 * segment size from 160 characters to 70.
 */
export function segmentsFor(body: string): Segmentation {
  const unicode = !GSM.test(body);

  const offenders = unicode
    ? [...new Set([...body].filter((character) => !GSM.test(character)))]
    : [];

  const size = unicode ? SMS_UNICODE_SEGMENT : SMS_SEGMENT;

  return {
    segments: Math.max(1, Math.ceil(body.length / size)),
    characters: body.length,
    unicode,
    offenders,
  };
}

/**
 * Swaps the usual word-processor characters for ones a phone can send cheaply.
 *
 * Only the substitutions that lose nothing: a curly quote becomes a straight
 * one, an ellipsis becomes three stops, a dash becomes a hyphen. Anything with
 * actual meaning, an accent in somebody's name, is left alone, because a
 * cheaper message spelling a customer's name wrong is not a saving.
 */
export function toGsm(body: string): string {
  return (
    body
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, '...')
      .replace(/[–—]/g, '-')
      // A non-breaking space, written as an escape: the literal character is
      // invisible in a diff and trips the irregular-whitespace lint rule.
      .replace(/\u00a0/g, ' ')
  );
}
