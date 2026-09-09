/**
 * Proves that signing up creates a workshop.
 *
 *   npx tsx infra/scripts/verify-signup.ts
 *
 * The failure this guards against is a half-created organisation: a user with
 * no membership, a location with no tax rate, a workshop with no store. That
 * state is unrecoverable for the person it happens to, because they can sign
 * in, see a broken shell, and cannot try again with the same email.
 *
 * Creates a workshop, asserts every piece exists, then removes it.
 */

import 'dotenv/config';

import { PLANS, validateSignup } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createWorkshop } from '../../apps/web/src/lib/onboarding';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

const stamp = Date.now().toString(36);
const NAME = `Probe Motors ${stamp}`;
const EMAIL = `probe-${stamp}@probeworkshop.test`;

async function main() {
  console.info('\n  Sign-up creates a workshop\n');

  /* --- refusals ---------------------------------------------------------- */

  const bad = await createWorkshop({
    workshopName: '',
    contactName: '',
    email: 'not-an-email',
    password: 'short',
    sites: 0,
  });

  check('a broken submission is refused', !bad.ok, `${bad.problems.length} problems reported`);
  check(
    'nothing was written for it',
    (await prisma.user.count({ where: { email: 'not-an-email' } })) === 0,
  );

  check(
    'every problem is reported at once',
    validateSignup({
      workshopName: '',
      contactName: '',
      email: 'x',
      password: 'x',
      sites: 0,
    }).length === 5,
  );

  /* --- the real thing ---------------------------------------------------- */

  const outcome = await createWorkshop(
    {
      workshopName: NAME,
      contactName: 'Probe Owner',
      email: EMAIL,
      password: 'a-sufficiently-long-one',
      phone: '0161 000 0000',
      sites: 1,
    },
    { plan: 'COMPLETE' },
  );

  check('the workshop was created', outcome.ok, outcome.problems.map((p) => p.message).join('; '));
  if (!outcome.ok) {
    finish();
    return;
  }

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: outcome.orgSlug! },
    include: {
      locations: { include: { bays: true } },
      taxRates: true,
      jobTypes: true,
      sequences: true,
      warehouses: true,
      memberships: { include: { user: true } },
      employees: true,
    },
  });

  check('it is an organisation, not a loose account', Boolean(org.id), org.slug);
  check('on the plan that was chosen', org.plan === 'COMPLETE', org.plan);
  check('with one location', org.locations.length === 1);
  check('and bays in it', (org.locations[0]?.bays.length ?? 0) >= 2);
  check(
    'a default tax rate exists',
    org.taxRates.some((rate) => rate.isDefault),
  );
  check('job types exist', org.jobTypes.length >= 6, `${org.jobTypes.length}`);
  check('document sequences exist', org.sequences.length === 3);
  check('a store exists for parts', org.warehouses.length === 1);

  const membership = org.memberships[0];
  check('the person is a member', Boolean(membership), membership?.role);
  check('and they are the owner', membership?.role === 'OWNER');
  check('the membership names a location', Boolean(membership?.locationId));

  check('an employee record exists for them', org.employees.length === 1);
  check(
    'so their own time costs something from day one',
    org.employees[0]?.userId === membership?.userId,
  );

  const audit = await prisma.auditLog.findFirst({
    where: { orgId: org.id, action: 'org.created' },
  });
  check('the creation is in the audit log', Boolean(audit));

  /* --- the email is now taken -------------------------------------------- */

  const again = await createWorkshop({
    workshopName: `${NAME} Two`,
    contactName: 'Probe Owner',
    email: EMAIL,
    password: 'a-sufficiently-long-one',
    sites: 1,
  });

  check('a second sign-up on the same email is refused', !again.ok);
  check(
    'and says to sign in instead',
    again.problems[0]?.message.includes('Sign in') ?? false,
    again.problems[0]?.message,
  );

  /* --- a colliding name gets a numbered slug ------------------------------ */

  const sibling = await createWorkshop({
    workshopName: NAME,
    contactName: 'Second Owner',
    email: `probe2-${stamp}@probeworkshop.test`,
    password: 'a-sufficiently-long-one',
    sites: 1,
  });

  check('a workshop of the same name gets its own slug', sibling.ok, sibling.orgSlug);
  check(
    'numbered rather than randomised',
    sibling.orgSlug?.endsWith('-2') ?? false,
    sibling.orgSlug,
  );

  /* --- the plan the demo org is on --------------------------------------- */

  const demo = await prisma.organization.findFirst({ where: { slug: 'hillside-motors' } });
  if (demo) {
    check('the demo workshop is on a plan the code knows', demo.plan in PLANS, `${demo.plan}`);
  }

  /* --- clean up ---------------------------------------------------------- */

  // Deleting exercises the erasure path: the audit trigger must let a
  // cascade clear its foreign keys while still refusing to rewrite what
  // happened. Before that was fixed, nothing audited could ever be deleted,
  // which meant nothing at all.
  for (const slug of [outcome.orgSlug!, sibling.orgSlug!].filter(Boolean)) {
    const target = await prisma.organization.findFirst({ where: { slug } });
    if (!target) continue;
    await prisma.organization.delete({ where: { id: target.id } });
  }

  await prisma.user.deleteMany({
    where: { email: { in: [EMAIL, `probe2-${stamp}@probeworkshop.test`] } },
  });

  check(
    'an audited organisation can still be deleted',
    (await prisma.organization.count({ where: { slug: outcome.orgSlug! } })) === 0,
  );
  check(
    'an audited user can still be deleted',
    (await prisma.user.count({ where: { email: EMAIL } })) === 0,
  );

  const survivor = await prisma.auditLog.findFirst({
    where: { entityId: org.id, action: 'org.created' },
  });

  check('and the record of what happened survives them', Boolean(survivor));
  check(
    'detached rather than rewritten',
    survivor?.orgId === null && survivor?.actorUserId === null,
  );

  let rewriteRefused = false;
  if (survivor) {
    try {
      await prisma.auditLog.update({
        where: { id: survivor.id },
        data: { action: 'org.definitely.not.created' },
      });
    } catch {
      rewriteRefused = true;
    }
  }

  check('rewriting an entry is still refused', rewriteRefused);

  finish();
}

function finish() {
  console.info(
    `\n  ${failures === 0 ? 'Sign-up creates a complete workshop.' : `${failures} check(s) failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
