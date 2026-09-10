import type { ConsentState } from '@carnet/core';

/**
 * A customer row as the consent rules want to see it.
 *
 * Shared between the reminder path and the automation queue so the two cannot
 * drift into disagreeing about whether somebody may be written to.
 */
export function consentOf(customer: {
  email: string | null;
  mobile: string | null;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
}): ConsentState {
  return {
    email: customer.marketingEmailConsent,
    sms: customer.marketingSmsConsent,
    hasEmail: Boolean(customer.email),
    hasMobile: Boolean(customer.mobile),
  };
}
