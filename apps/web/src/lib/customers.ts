import {
  assertCustomerSaveable,
  type CustomerDetails,
  CustomerError,
  type CustomerKind,
  describePossibleDuplicate,
  displayNameFor,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Creating and editing a customer, against the database.
 *
 * The rules are in `@carnet/core` and are pure. What is here is the part that
 * needs the database: whether somebody by that address or number is already on
 * file, which is the check that stops one person's service history being split
 * across two records that each look complete.
 */

export { CustomerError };

export interface CustomerInput extends CustomerDetails {
  taxNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
  sourceOfBusiness?: string | null;
  notes?: string | null;
  marketingEmailConsent?: boolean;
  marketingSmsConsent?: boolean;
}

const clean = (value: string | null | undefined) => value?.trim() || null;

/**
 * Somebody already on file who might be this person.
 *
 * Matched on an address or a number rather than on a name, because two
 * customers called J Smith are ordinary and two sharing a mobile number are
 * usually one person entered twice.
 */
export async function possibleDuplicate(
  orgId: string,
  details: { email?: string | null; mobile?: string | null },
  ignoreId?: string,
) {
  const email = clean(details.email)?.toLowerCase();
  const mobile = clean(details.mobile)?.replace(/[^\d]/g, '');

  if (!email && !mobile) return null;

  const candidates = await prisma.customer.findMany({
    where: {
      orgId,
      isActive: true,
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
      OR: [
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        // The stored number keeps whatever spacing somebody typed, so the
        // comparison is made on the digits alone.
        ...(mobile ? [{ mobile: { not: null } }] : []),
      ],
    },
    take: 200,
    select: { id: true, displayName: true, email: true, mobile: true },
  });

  const match = candidates.find(
    (row) =>
      (email && row.email?.toLowerCase() === email) ||
      (mobile && row.mobile?.replace(/[^\d]/g, '') === mobile),
  );

  return match ? { ...match, warning: describePossibleDuplicate(match) } : null;
}

/** Writes a new customer. Returns the id so the caller can go straight there. */
export async function createCustomer(input: {
  orgId: string;
  userId: string;
  details: CustomerInput;
  /** Set once somebody has seen the duplicate warning and meant it. */
  allowDuplicate?: boolean;
}): Promise<string> {
  const details = input.details;

  assertCustomerSaveable(details);

  if (!input.allowDuplicate) {
    const existing = await possibleDuplicate(input.orgId, details);
    if (existing) throw new CustomerError('DUPLICATE', existing.warning);
  }

  const customer = await prisma.customer.create({
    data: {
      orgId: input.orgId,
      kind: details.kind as CustomerKind,
      displayName: displayNameFor(details),
      firstName: details.kind === 'INDIVIDUAL' ? clean(details.firstName) : null,
      lastName: details.kind === 'INDIVIDUAL' ? clean(details.lastName) : null,
      companyName: details.kind === 'COMPANY' ? clean(details.companyName) : null,
      taxNumber: clean(details.taxNumber),
      email: clean(details.email)?.toLowerCase() ?? null,
      mobile: clean(details.mobile),
      phone: clean(details.phone),
      addressLine1: clean(details.addressLine1),
      addressLine2: clean(details.addressLine2),
      locality: clean(details.locality),
      region: clean(details.region),
      postcode: clean(details.postcode)?.toUpperCase() ?? null,
      country: clean(details.country) ?? 'GB',
      sourceOfBusiness: clean(details.sourceOfBusiness),
      notes: clean(details.notes),
      // Consent is off unless somebody actively said otherwise, and the change
      // itself is recorded by a database trigger rather than by this code.
      marketingEmailConsent: details.marketingEmailConsent ?? false,
      marketingSmsConsent: details.marketingSmsConsent ?? false,
    },
    select: { id: true, displayName: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'customer.created',
    entityType: 'Customer',
    entityId: customer.id,
    after: { displayName: customer.displayName, email: details.email ?? null },
  });

  return customer.id;
}

/** Changes the details on an existing customer. */
export async function updateCustomer(input: {
  orgId: string;
  userId: string;
  customerId: string;
  details: CustomerInput;
}): Promise<void> {
  const details = input.details;

  assertCustomerSaveable(details);

  const before = await prisma.customer.findFirstOrThrow({
    where: { id: input.customerId, orgId: input.orgId },
    select: {
      displayName: true,
      email: true,
      mobile: true,
      phone: true,
      marketingEmailConsent: true,
      marketingSmsConsent: true,
    },
  });

  await prisma.customer.update({
    where: { id: input.customerId },
    data: {
      kind: details.kind as CustomerKind,
      displayName: displayNameFor(details),
      firstName: details.kind === 'INDIVIDUAL' ? clean(details.firstName) : null,
      lastName: details.kind === 'INDIVIDUAL' ? clean(details.lastName) : null,
      companyName: details.kind === 'COMPANY' ? clean(details.companyName) : null,
      taxNumber: clean(details.taxNumber),
      email: clean(details.email)?.toLowerCase() ?? null,
      mobile: clean(details.mobile),
      phone: clean(details.phone),
      addressLine1: clean(details.addressLine1),
      addressLine2: clean(details.addressLine2),
      locality: clean(details.locality),
      region: clean(details.region),
      postcode: clean(details.postcode)?.toUpperCase() ?? null,
      country: clean(details.country) ?? 'GB',
      sourceOfBusiness: clean(details.sourceOfBusiness),
      notes: clean(details.notes),
      // Left exactly as it was. Consent is changed on the screen built for it,
      // where the reason is recorded; letting an edit form move it would put
      // somebody back on a mailing list they had asked to leave.
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'customer.updated',
    entityType: 'Customer',
    entityId: input.customerId,
    before,
    after: {
      displayName: displayNameFor(details),
      email: details.email ?? null,
      mobile: details.mobile ?? null,
      phone: details.phone ?? null,
    },
  });
}
