'use client';

import * as React from 'react';

import { Field, Select } from '@carnet/ui';

import { useT } from '@/components/language-provider';

/**
 * The part of the sign-up form where the country decides the currency and
 * the currency decides the price. Phase 32.7.
 *
 * Three things move together: the country, the plan's price in that
 * country's currency, and the sentence beside the terms box that says what
 * the card will be charged. They are one component so they can never
 * disagree, and so a workshop in Canada never reads a price in pounds.
 */
export type SignupCountry = { code: string; name: string; currency: string; locale: string };
export type SignupPlan = { id: string; name: string };
/** currency → plan id → per bay per month, paid monthly, in minor units. */
export type SignupPriceBook = Record<string, Record<string, number>>;

function format(minor: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function SignupPricing({
  countries,
  plans,
  book,
  fallbackCurrency,
  defaultCountry,
  defaultPlan,
  trialDays,
  countryError,
  termsHref,
}: {
  countries: SignupCountry[];
  plans: SignupPlan[];
  book: SignupPriceBook;
  fallbackCurrency: string;
  defaultCountry: string;
  defaultPlan: string;
  trialDays: number;
  countryError?: string;
  termsHref: string;
}) {
  const t = useT();
  const [countryCode, setCountryCode] = React.useState(defaultCountry);
  const [planId, setPlanId] = React.useState(defaultPlan);
  const country = countries.find((c) => c.code === countryCode) ?? countries[0]!;
  const currency = book[country.currency] ? country.currency : fallbackCurrency;
  const locale = country.locale;
  const price = (id: string) => format(book[currency]![id] ?? 0, currency, locale);
  const plan = plans.find((p) => p.id === planId) ?? plans[0]!;

  return (
    <>
      <Field
        label={t('Country')}
        hint={t(
          'Sets the currency you are billed in and keep your books in ({currency}), the language and the clock. Changeable in settings.',
          { currency },
        )}
        error={countryError}
      >
        <Select
          name="country"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {t(c.name)} · {c.currency}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('Plan')} hint={t('Changeable at any point during the trial')}>
        <Select name="plan" value={planId} onChange={(event) => setPlanId(event.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {t('{plan} — {price} per bay, per month, paid monthly', {
                plan: p.name,
                price: price(p.id),
              })}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex items-start gap-2.5 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) px-3 py-2.5 text-[13px] leading-relaxed">
        <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-(--brand)" />
        <span>
          {t('I have read the {terms}.')
            .split('{terms}')
            .map((part, index) =>
              index === 0 ? (
                part
              ) : (
                <React.Fragment key={index}>
                  <a
                    href={termsHref}
                    className="text-(--brand-text) underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('terms')}
                  </a>
                  {part}
                </React.Fragment>
              ),
            )}{' '}
          {t(
            'The trial is free for {days} days. On the day it ends, the card I add next is charged {price} per bay per month for the {plan} plan, in {currency}, and monthly after that, unless I cancel before then. I can cancel at any time from Settings.',
            { days: trialDays, price: price(plan.id), plan: plan.name, currency },
          )}
        </span>
      </label>
    </>
  );
}
