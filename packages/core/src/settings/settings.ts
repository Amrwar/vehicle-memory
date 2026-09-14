import { isCountry, isCurrency, safeLocale } from '../region/countries';
/**
 * The workshop configures itself.
 *
 * Until Phase 19 the settings page showed the configuration and said editing
 * was not built. A workshop being handed the product has to be able to change
 * its own name, its site, its bays, its tax rates and its job types without
 * anybody at Carnet touching a database. These are the rules those changes
 * keep to. Each is small; what matters is that a bad value is refused with
 * the reason, at the form, before anything is written.
 */

export class SettingsError extends Error {
  constructor(
    readonly code:
      | 'NO_NAME'
      | 'BAD_REGION'
      | 'BAD_EMAIL'
      | 'BAD_THRESHOLD'
      | 'BAD_CODE'
      | 'BAD_HOURS'
      | 'BAD_RATE'
      | 'BAD_COLOUR'
      | 'BAD_PREFIX'
      | 'BAD_CAPACITY'
      | 'DUPLICATE'
      | 'LAST_ONE'
      | 'NOT_YOURS',
    message: string,
  ) {
    super(message);
    this.name = 'SettingsError';
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OrganisationProfile {
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  reapprovalThresholdPct: number;
  /** The region the books are kept in. Optional so older callers still pass. */
  country?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
}

/** Trimmed, with empty strings become null, so a cleared field clears. */
export function tidy(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

export function assertOrganisationSaveable(profile: OrganisationProfile): void {
  if (!profile.name.trim()) {
    throw new SettingsError(
      'NO_NAME',
      'The workshop needs a trading name. It goes on every invoice.',
    );
  }

  const email = tidy(profile.email);
  if (email && !EMAIL.test(email)) {
    throw new SettingsError('BAD_EMAIL', `"${email}" is not an email address.`);
  }

  if (profile.country !== undefined && !isCountry(profile.country)) {
    throw new SettingsError('BAD_REGION', 'Choose the country the workshop trades in.');
  }
  if (profile.currency !== undefined && !isCurrency(profile.currency)) {
    throw new SettingsError('BAD_REGION', 'That is not a currency the books can be kept in.');
  }
  if (profile.locale !== undefined && safeLocale(profile.locale, '') === '') {
    throw new SettingsError('BAD_REGION', 'That is not a language and region the product knows.');
  }
  if (profile.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: profile.timezone });
    } catch {
      throw new SettingsError('BAD_REGION', 'That is not a timezone.');
    }
  }

  if (
    !Number.isFinite(profile.reapprovalThresholdPct) ||
    profile.reapprovalThresholdPct < 0 ||
    profile.reapprovalThresholdPct > 100
  ) {
    throw new SettingsError(
      'BAD_THRESHOLD',
      'The re-approval threshold is a percentage between 0 and 100. Zero means every increase goes back to the customer.',
    );
  }
}

/** Codes are what the diary and the floor abbreviate to: upper case, letters and digits, short. */
export function normaliseCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

export function assertCodeUsable(code: string, what: string): void {
  if (code.length === 0 || code.length > 12) {
    throw new SettingsError(
      'BAD_CODE',
      `A ${what} code is one to twelve letters or digits, and it is what the diary shows when there is no room for the name.`,
    );
  }
}

/** "08:00" to minutes from midnight, or null for something that is not a time. */
export function parseClock(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > 1440 ? null : total;
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export interface SiteSettings {
  name: string;
  code: string;
  dailyCapacityHours: number;
  opensAtMinute: number;
  closesAtMinute: number;
}

export function assertSiteSaveable(site: SiteSettings): void {
  if (!site.name.trim()) {
    throw new SettingsError('NO_NAME', 'The site needs a name, even if there is only one.');
  }

  assertCodeUsable(site.code, 'site');

  if (
    !Number.isFinite(site.dailyCapacityHours) ||
    site.dailyCapacityHours < 0 ||
    site.dailyCapacityHours > 1000
  ) {
    throw new SettingsError(
      'BAD_CAPACITY',
      'Daily capacity is the technician hours the site can absorb in a day: a number from 0 to 1000.',
    );
  }

  if (
    !Number.isInteger(site.opensAtMinute) ||
    !Number.isInteger(site.closesAtMinute) ||
    site.opensAtMinute < 0 ||
    site.closesAtMinute > 1440 ||
    site.opensAtMinute >= site.closesAtMinute
  ) {
    throw new SettingsError(
      'BAD_HOURS',
      'Opening hours are two times in the day, and the site opens before it closes.',
    );
  }
}

export function assertBaySaveable(bay: { name: string; code: string }): void {
  if (!bay.name.trim()) {
    throw new SettingsError('NO_NAME', 'Name the bay the way the floor already calls it.');
  }
  assertCodeUsable(bay.code, 'bay');
}

export function assertTaxRateSaveable(rate: { name: string; rate: number }): void {
  if (!rate.name.trim()) {
    throw new SettingsError(
      'NO_NAME',
      'Name the rate the way it appears on an invoice: "VAT 20%", "Zero rated".',
    );
  }
  if (!Number.isFinite(rate.rate) || rate.rate < 0 || rate.rate > 100) {
    throw new SettingsError('BAD_RATE', 'A tax rate is a percentage from 0 to 100.');
  }
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export function assertJobTypeSaveable(type: {
  name: string;
  colour: string;
  defaultHours: number | null;
}): void {
  if (!type.name.trim()) {
    throw new SettingsError('NO_NAME', 'A kind of work needs a name the diary can show.');
  }
  if (!HEX_COLOUR.test(type.colour)) {
    throw new SettingsError(
      'BAD_COLOUR',
      'The colour is six hex digits, like #2a41d8. It is how the diary tells kinds of work apart.',
    );
  }
  if (
    type.defaultHours !== null &&
    (!Number.isFinite(type.defaultHours) || type.defaultHours < 0 || type.defaultHours > 100)
  ) {
    throw new SettingsError(
      'BAD_HOURS',
      'Default hours are how long this kind of work usually takes: a number from 0 to 100, or blank.',
    );
  }
}

/**
 * A document prefix. Short, and only characters that survive being typed
 * into accounting software and read over the phone.
 */
export function normalisePrefix(value: string): string {
  return value.trim().toUpperCase();
}

export function assertPrefixSaveable(prefix: string): void {
  if (prefix.length > 8 || !/^[A-Z0-9-]*$/.test(prefix)) {
    throw new SettingsError(
      'BAD_PREFIX',
      'A prefix is up to eight letters, digits or hyphens, like "INV-". It goes in front of every number in that sequence from now on; numbers already issued keep theirs.',
    );
  }
}

/**
 * Retiring the only one of something. There must always be a default tax
 * rate for a new line to take and an active site for a job to be opened at.
 */
export function assertNotTheLast(remainingActive: number, what: string): void {
  if (remainingActive < 1) {
    throw new SettingsError(
      'LAST_ONE',
      `That is the only ${what}. Add another before retiring it.`,
    );
  }
}

/** One line for the audit trail: what changed, field by field. */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const lines: string[] = [];
  for (const key of Object.keys(after)) {
    const was = before[key] ?? null;
    const now = after[key] ?? null;
    if (String(was) === String(now)) continue;
    lines.push(
      `${key}: ${was === null ? 'blank' : String(was)} → ${now === null ? 'blank' : String(now)}`,
    );
  }
  return lines;
}
