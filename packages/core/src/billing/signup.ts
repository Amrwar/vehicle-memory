/**
 * Opening an account.
 *
 * The important decision is what gets created. Signing up here means creating
 * a workshop and becoming its owner, not creating a person who might later
 * join something. The alternative leaves accounts belonging to nobody and a
 * tenancy model with a hole in it, and every record in this system hangs off
 * the organisation, so the hole gets more expensive every day it exists.
 *
 * The rules below are the ones that must hold before anything is written.
 * They are here, framework-free, so the same checks run on the form, on the
 * server action, and in tests, rather than being reimplemented three times
 * with three slightly different opinions.
 */

export interface SignupInput {
  workshopName: string;
  contactName: string;
  email: string;
  password: string;
  phone?: string;
  sites: number;
}

export type SignupField = keyof SignupInput;

export interface SignupProblem {
  field: SignupField;
  message: string;
}

/** Free and disposable domains, refused with a reason rather than silently. */
const CONSUMER_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'live.co.uk',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
]);

export const MIN_PASSWORD_LENGTH = 10;

/** Trivially guessable regardless of length. */
const WEAK_PASSWORDS = new Set([
  'password12',
  'password123',
  '1234567890',
  'qwertyuiop',
  'letmein123',
  'workshop123',
  'garage1234',
]);

export function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email
    .slice(at + 1)
    .toLowerCase()
    .trim();
}

export function isConsumerEmail(email: string): boolean {
  const domain = domainOf(email);
  return domain !== null && CONSUMER_DOMAINS.has(domain);
}

export function isDisposableEmail(email: string): boolean {
  const domain = domainOf(email);
  return domain !== null && DISPOSABLE_DOMAINS.has(domain);
}

/**
 * A slug from a workshop name.
 *
 * Deterministic and reversible enough to recognise, because it ends up in
 * URLs a customer sees. Collisions are resolved by the caller against the
 * database, not here: this module knows nothing about what already exists.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

/** Reserved because they are routes, or because they would read as official. */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'billing',
  'carnet',
  'dashboard',
  'help',
  'login',
  'logout',
  'p',
  'portal',
  'pricing',
  'settings',
  'shop',
  'signup',
  'support',
  'system',
  'www',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Every problem with a submission, not just the first.
 *
 * Returning one error at a time turns a form into a guessing game: fix the
 * name, learn the email is wrong, fix that, learn the password is too short.
 */
export function validateSignup(input: SignupInput): SignupProblem[] {
  const problems: SignupProblem[] = [];

  const name = input.workshopName.trim();
  if (name.length < 2) {
    problems.push({ field: 'workshopName', message: 'Enter the name of the workshop.' });
  } else if (name.length > 80) {
    problems.push({ field: 'workshopName', message: 'That name is too long for an invoice.' });
  } else if (isReservedSlug(slugify(name))) {
    problems.push({
      field: 'workshopName',
      message: 'That name is reserved. Try the trading name you put on invoices.',
    });
  } else if (slugify(name).length === 0) {
    problems.push({
      field: 'workshopName',
      message: 'That name needs at least one letter or number.',
    });
  }

  if (input.contactName.trim().length < 2) {
    problems.push({ field: 'contactName', message: 'Enter your name.' });
  }

  const email = input.email.trim().toLowerCase();
  const domain = domainOf(email);

  if (!domain || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    problems.push({ field: 'email', message: 'Enter a valid email address.' });
  } else if (isDisposableEmail(email)) {
    problems.push({
      field: 'email',
      message: 'That is a disposable address. Use one you will still have next month.',
    });
  } else if (isConsumerEmail(email)) {
    // Refused rather than blocked outright would be the wrong call: plenty of
    // small garages genuinely run on a free address. This is a warning the
    // caller decides about, so it is reported as a problem the person can
    // read and override rather than a hard stop.
    problems.push({
      field: 'email',
      message:
        'This looks like a personal address. Use your workshop address if you have one, so the account is not tied to one person.',
    });
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    problems.push({
      field: 'password',
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  } else if (WEAK_PASSWORDS.has(input.password.toLowerCase())) {
    problems.push({ field: 'password', message: 'That password is one of the first ones tried.' });
  } else if (input.password.toLowerCase().includes(name.toLowerCase()) && name.length >= 4) {
    problems.push({
      field: 'password',
      message: 'Do not put the workshop name in the password.',
    });
  }

  if (!Number.isInteger(input.sites) || input.sites < 1 || input.sites > 200) {
    problems.push({ field: 'sites', message: 'Enter how many sites you run, at least one.' });
  }

  return problems;
}

/** True when the only complaint is the consumer-email warning. */
export function onlySoftProblems(problems: readonly SignupProblem[]): boolean {
  return (
    problems.length > 0 &&
    problems.every((problem) => problem.field === 'email' && problem.message.includes('personal'))
  );
}

/**
 * Next free slug, given what the database already holds.
 *
 * Numbers rather than random suffixes: two workshops with the same name in
 * different towns should get `hillside-motors` and `hillside-motors-2`, which
 * both read as deliberate.
 */
export function uniqueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'workshop';
  if (!taken.has(base) && !isReservedSlug(base)) return base;

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * How long a new workshop gets before it has to decide.
 *
 * Thirty days on full Complete functionality, per the business model. Long
 * enough to run a real month-end, which is the point at which a workshop can
 * actually tell whether the accounting is worth paying for.
 */
export const TRIAL_DAYS = 30;

export function trialEndsOn(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function trialDaysRemaining(endsOn: Date, asOf: Date = new Date()): number {
  return Math.max(0, Math.ceil((endsOn.getTime() - asOf.getTime()) / 86_400_000));
}
