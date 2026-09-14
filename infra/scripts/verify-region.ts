/**
 * Country and currency, against a real database. Phase 29.
 *
 *   npx tsx infra/scripts/verify-region.ts
 *
 * A workshop signed up in Canada must see dollars everywhere and keep its
 * books in dollars; one signed up in Britain must be exactly as it was. The
 * checks here are the ones a unit test cannot make: that sign-up writes the
 * region and the first tax rate from the country, that the session carries
 * it, that money made by the libraries is in the workshop's currency, and
 * that a bill raised in the new workshop is in dollars from the first line.
 *
 * The workshop it creates is removed at the end.
 */

import 'dotenv/config';

import { countryFor, formatMinor, regionForCountry } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';
import { createWorkshop } from '../../apps/web/src/lib/onboarding';
import { regionFor } from '../../apps/web/src/lib/region';
import { updateOrganisation } from '../../apps/web/src/lib/settings';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const EMAIL = 'verify-region@maplemotors.test';
const NAME = 'Verify Region Motors';

async function main() {
  await forget();

  console.info('\nThe workshop that was there');

  const hillside = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });
  const british = await regionFor(hillside.id);
  check('is British', british.country, 'GB');
  check('in pounds', british.currency, 'GBP');
  check('reads as before', formatMinor(140800, british), '£1,408.00');

  console.info('\nA workshop in Canada');

  const outcome = await createWorkshop(
    {
      workshopName: NAME,
      contactName: 'Marie Tremblay',
      email: EMAIL,
      password: 'a-long-enough-password-9',
      sites: 1,
      country: 'ca',
    },
    { plan: 'CORE', acceptConsumerEmail: true },
  );
  check('signed up', outcome.ok, true);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problems));

  const org = await prisma.organization.findFirstOrThrow({
    where: { name: NAME },
    select: {
      id: true,
      country: true,
      baseCurrency: true,
      locale: true,
      timezone: true,
      taxRates: { where: { isDefault: true }, select: { name: true, rate: true } },
      locations: { select: { country: true, timezone: true } },
    },
  });
  const expected = regionForCountry('CA');
  check('country written from the picker', org.country, expected.country);
  check('dollars', org.baseCurrency, expected.currency);
  check('Canadian English', org.locale, expected.locale);
  check('Toronto time', org.timezone, expected.timezone);
  check('the first tax rate is the country’s', org.taxRates[0]?.name, countryFor('CA').tax.name);
  check('and its rate', Number(org.taxRates[0]?.rate), countryFor('CA').tax.rate);
  check('the site follows', org.locations[0]?.country, 'CA');

  const region = await regionFor(org.id);
  check('the region reads back', region, expected);
  check('money reads as dollars', formatMinor(140800, region), '$1,408.00');

  console.info('\nA bill in the new workshop');

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: EMAIL },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: 'Probe Customer',
      email: 'probe@example.test',
    },
    select: { id: true },
  });
  const vehicle =
    (await prisma.vehicle.findUnique({
      where: { vin: 'VRGN00000000001' },
      select: { id: true },
    })) ??
    (await prisma.vehicle.create({
      data: {
        vin: 'VRGN00000000001',
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        registration: 'ABCD 123',
      },
      select: { id: true },
    }));
  const job = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: vehicle.id,
    shortDescription: 'Verify region probe',
  });
  await prisma.jobLabourLine.create({
    data: { jobId: job.id, description: 'Probe labour', hours: 1, rate: 100 },
  });
  await moveJob({ orgId: org.id, userId: owner.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: owner.id, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({ orgId: org.id, userId: owner.id, jobId: job.id });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { currency: true, total: true },
  });
  check('the invoice is in dollars', invoice.currency, 'CAD');

  const told = await prisma.messageLog.findFirst({
    where: { orgId: org.id, relatedId: invoiceId },
    select: { body: true },
  });
  check('and the customer was told in dollars', told?.body.includes('$100.00') ?? false, true);

  console.info('\nChanged in settings');

  await updateOrganisation({
    orgId: org.id,
    userId: owner.id,
    name: NAME,
    reapprovalThresholdPct: 10,
    country: 'FR',
    currency: 'EUR',
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
  });
  const moved = await regionFor(org.id);
  check('now French', moved.country, 'FR');
  check('in euros', moved.currency, 'EUR');
  check(
    'reading as French',
    formatMinor(140800, moved).replace(/[\u00a0\u202f]/g, ' '),
    '1 408,00 €',
  );

  await forget();
  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function forget() {
  // A workshop that has written to a passport cannot be deleted, because the
  // passport is append-only. It is retired instead: renamed, deactivated,
  // its owner's address freed, so the next run signs up afresh.
  const orgs = await prisma.organization.findMany({
    where: { name: { startsWith: NAME } },
    select: { id: true },
  });
  for (const org of orgs) {
    await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });
    try {
      await prisma.organization.delete({ where: { id: org.id } });
    } catch {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          name: `${NAME} (retired ${org.id.slice(-6)})`,
          slug: `verify-region-retired-${org.id.slice(-8)}`,
          isActive: false,
        },
      });
    }
  }
  const users = await prisma.user.findMany({ where: { email: EMAIL }, select: { id: true } });
  for (const user of users) {
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: `retired-${user.id.slice(-8)}-${EMAIL}`, isActive: false },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
