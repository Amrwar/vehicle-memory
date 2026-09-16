import { Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '@carnet/ui';

import { tFor } from '@/lib/i18n';

/**
 * The fields a customer is made of.
 *
 * One definition, used by the page that takes a customer down and the page
 * that corrects them. They were nearly written twice, and a customer form
 * written twice is one where the second copy quietly loses the VAT number, or
 * asks for a consent the other one does not record.
 *
 * Everything is a plain field with a name, so both pages read the same
 * FormData and neither needs JavaScript to work. The referral code is the one
 * thing only a new customer is asked for: a code is something they arrived
 * with, and offering it again on an edit invites paying a referral twice.
 *
 * Whatever belongs at the end of the second column — a duplicate warning, the
 * submit button, and on an edit the consent trail — is passed as children,
 * because it is the part that differs and the rest is the part that must not.
 */
export async function CustomerFields({
  values,
  consent,
  showReferral = false,
  showConsent = true,
  children,
}: {
  /** What each field starts as: their record, or whatever survived a refusal. */
  values: Record<string, string | undefined>;
  consent: { email: boolean; sms: boolean };
  showReferral?: boolean;
  /**
   * Off when correcting a customer. Consent is the customer's to give and is
   * changed where a reason is recorded against it; a tick box on an edit form
   * that quietly does nothing is worse than no tick box, because somebody
   * ticks it and believes they have asked.
   */
  showConsent?: boolean;
  children?: React.ReactNode;
}) {
  const t = await tFor();
  const kind = values.kind === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL';

  return (
    <>
      <div className="grid gap-5">
        <Card>
          <CardHeader title={t('Who they are')} description={t('What goes on the invoice')} />
          <CardBody className="grid gap-4">
            <Field label={t('Kind')} hint={t('Changes which name is asked for')}>
              <Select name="kind" defaultValue={kind}>
                <option value="INDIVIDUAL">{t('A person')}</option>
                <option value="COMPANY">{t('A company')}</option>
              </Select>
            </Field>

            {/* Both sets are rendered and the unused one is ignored on save.
            A form that needed JavaScript to show the right fields would
            be a form that does nothing on the counter tablet when the
            connection drops, which is when it is most needed. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('First name')} hint={t('For a person')}>
                <Input
                  name="firstName"
                  defaultValue={values.firstName ?? ''}
                  autoComplete="given-name"
                  // i18n-ignore
                  placeholder="Maria"
                />
              </Field>
              <Field label={t('Last name')} hint={t('For a person')}>
                <Input
                  name="lastName"
                  defaultValue={values.lastName ?? ''}
                  autoComplete="family-name"
                  // i18n-ignore
                  placeholder="Okafor"
                />
              </Field>
            </div>

            <Field label={t('Company name')} hint={t('For a company or a fleet')}>
              <Input
                name="companyName"
                defaultValue={values.companyName ?? ''}
                autoComplete="organization"
                // i18n-ignore
                placeholder="Northgate Logistics Ltd"
              />
            </Field>

            <Field label={t('VAT number')} hint={t('Optional. Goes on their invoices.')}>
              <Input
                name="taxNumber"
                defaultValue={values.taxNumber ?? ''}
                // i18n-ignore
                placeholder="GB123456789"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('Where they are')}
            description={t('Optional, and worth having before the first invoice')}
          />
          <CardBody className="grid gap-4">
            <Field label={t('Address')}>
              <Input
                name="addressLine1"
                defaultValue={values.addressLine1 ?? ''}
                autoComplete="address-line1"
                // i18n-ignore
                placeholder="14 Hillside Road"
              />
            </Field>
            <Field label={t('Address, continued')}>
              <Input
                name="addressLine2"
                defaultValue={values.addressLine2 ?? ''}
                autoComplete="address-line2"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('Town')}>
                <Input
                  name="locality"
                  defaultValue={values.locality ?? ''}
                  autoComplete="address-level2"
                  // i18n-ignore
                  placeholder="Stockport"
                />
              </Field>
              <Field label={t('County')}>
                <Input
                  name="region"
                  defaultValue={values.region ?? ''}
                  autoComplete="address-level1"
                />
              </Field>
              <Field label={t('Postcode')}>
                <Input
                  name="postcode"
                  defaultValue={values.postcode ?? ''}
                  autoComplete="postal-code"
                  className="uppercase"
                  // i18n-ignore
                  placeholder="SK4 2HL"
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid content-start gap-5">
        <Card>
          <CardHeader
            title={t('How to reach them')}
            description={t('At least one. Everything the workshop sends goes here.')}
          />
          <CardBody className="grid gap-4">
            <Field label={t('Email')} hint={t('Quotes, invoices and the portal link')}>
              <Input
                name="email"
                type="email"
                inputMode="email"
                defaultValue={values.email ?? ''}
                autoComplete="email"
                // i18n-ignore
                placeholder="maria@example.com"
              />
            </Field>

            <Field label={t('Mobile')} hint={t('Texts about the car')}>
              <Input
                name="mobile"
                type="tel"
                inputMode="tel"
                defaultValue={values.mobile ?? ''}
                autoComplete="tel"
                placeholder="07700 900123"
              />
            </Field>

            <Field label={t('Other telephone')} hint={t('Landline or work number')}>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={values.phone ?? ''}
                placeholder="0161 496 0114"
              />
            </Field>
          </CardBody>
        </Card>

        {showConsent ? (
          <Card>
            <CardHeader
              title={t('Marketing')}
              description={t('Separate from anything about their own car')}
            />
            <CardBody className="grid gap-3 text-[13px] leading-relaxed">
              {/* Off unless somebody ticks it, and never inferred from the fact
              that an address was typed in. Reminders about their own
              vehicle are not marketing and are never gated on this. */}
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="marketingEmailConsent"
                  defaultChecked={consent.email}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>{t('They agreed to marketing emails')}</span>
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="marketingSmsConsent"
                  defaultChecked={consent.sms}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>{t('They agreed to marketing texts')}</span>
              </label>
              <p className="text-(--text-faint)">
                {t(
                  'Service reminders and messages about a job in progress are not marketing and go out either way.',
                )}
              </p>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title={t('Anything else')} />
          <CardBody className="grid gap-4">
            <Field label={t('How they found you')} hint={t('Optional')}>
              <Input
                name="sourceOfBusiness"
                defaultValue={values.sourceOfBusiness ?? ''}
                placeholder={t('Recommended by a neighbour')}
              />
            </Field>
            {showReferral ? (
              <Field
                label={t('Arrived with a code')}
                hint={t(
                  'Optional. Another customer’s referral code; both sides are paid once this one has had work done',
                )}
              >
                <Input
                  name="referralCode"
                  defaultValue={values.referralCode ?? ''}
                  maxLength={8}
                  autoCapitalize="characters"
                  className="datum uppercase tracking-[0.15em]"
                  // i18n-ignore
                  placeholder="XXXXXX"
                />
              </Field>
            ) : null}
            <Field label={t('Notes')} hint={t('Anything whoever serves them next should know')}>
              <Textarea name="notes" rows={3} defaultValue={values.notes ?? ''} />
            </Field>
          </CardBody>
        </Card>

        {children}
      </div>
    </>
  );
}
