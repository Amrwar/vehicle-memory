/**
 * Working at two workshops. Phase 63. FR-108.
 *
 *   npx tsx infra/scripts/verify-belonging.ts
 *
 * FR-108 is one sentence and the second half is the hard half: a person MAY
 * belong to more than one organisation and MUST switch between them
 * **explicitly**. The schema has allowed the first half since the first month
 * — `acceptInvitation` attaches an existing account to a second workshop
 * without complaint — so this is not a new capability. It is a capability
 * nobody could steer, decided by `memberships[0]` in whatever order the
 * database returned rows.
 *
 * What is checked here is not "the switcher works". It is the set of things
 * that must stay true once a person can be in two tenants:
 *
 *   Nobody is placed in a workshop without saying so.
 *   Nothing the browser sends decides which tenant anybody is in.
 *   A refusal says the same sentence whether the workshop is somebody else's
 *     or does not exist.
 *   The role, the region and the data all follow the workshop, together.
 *   One workshop's decisions stop at its own boundary.
 *
 * That last one is why this script exists rather than a unit test. Removing
 * somebody from a workshop revoked every session they had anywhere — one
 * tenant reaching into another and signing a person out of a team they are
 * still on. With one membership each it is indistinguishable from correct, so
 * no test written before this phase could have failed.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { actingAs, mustChoose, orgOnSignIn, sessionsEndedByLeaving } from '@carnet/core';
import { prisma } from '@carnet/db';

import { enterWorkshop, NotYoursError, workshopsFor } from '../../apps/web/src/lib/belonging';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

const tag = randomBytes(5).toString('hex').toUpperCase();

/** A session row, the way the application makes one, and its cookie. */
async function mint(userId: string, orgId: string | null) {
  const token = randomBytes(32).toString('base64url');
  const row = await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      orgId,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    select: { id: true, orgId: true },
  });
  return { ...row, token };
}

async function orgFor(name: string) {
  return prisma.organization.create({
    data: {
      slug: `belonging-${name.toLowerCase()}-${tag.toLowerCase()}`,
      name: `${name} ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
    },
    select: { id: true, name: true },
  });
}

async function main() {
  console.info('\n  Working at two workshops\n');

  /* --- one person, two teams ------------------------------------------------ */

  const [hillside, kirkstall, elsewhere] = await Promise.all([
    orgFor('Hillside'),
    orgFor('Kirkstall'),
    orgFor('Elsewhere'),
  ]);

  const person = await prisma.user.create({
    data: {
      email: `rosalind.everhart-${tag.toLowerCase()}@example.com`,
      name: `Rosalind Everhart-${tag}`,
      passwordHash: 'not-a-real-hash',
      emailVerifiedAt: new Date(),
    },
    select: { id: true, name: true },
  });

  // A contractor: a manager at one, a technician at the other. The roles are
  // deliberately different, because a role that does not follow the workshop
  // is a permission granted in a tenant that never granted it.
  await prisma.membership.create({
    data: { userId: person.id, orgId: hillside.id, role: 'MANAGER' },
  });
  await prisma.membership.create({
    data: { userId: person.id, orgId: kirkstall.id, role: 'TECHNICIAN' },
  });

  // Somebody else entirely, on one team, for the comparisons below.
  const other = await prisma.user.create({
    data: {
      email: `nobody-${tag.toLowerCase()}@example.com`,
      name: `Someone Else ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });
  await prisma.membership.create({
    data: { userId: other.id, orgId: elsewhere.id, role: 'OWNER' },
  });

  const theirs = await workshopsFor(person.id);

  check(theirs.length === 2, 'a person can be on two workshops’ teams', theirs.length);

  check(
    theirs[0]!.orgId === hillside.id && theirs[1]!.orgId === kirkstall.id,
    'and the list is ordered, so the second one does not move about between page loads',
  );

  /* --- nobody is placed anywhere silently ----------------------------------- */

  check(
    orgOnSignIn(theirs) === null && mustChoose(theirs),
    'signing in puts them in neither: they are asked which (FR-9801)',
  );

  check(
    orgOnSignIn([theirs[0]!]) === hillside.id,
    'and somebody on one team is not asked, because that is not a choice',
  );

  check(
    actingAs(theirs, null) === null,
    'a session naming no workshop acts in none — no falling back to the first row',
  );

  /* --- and what a switch actually moves ------------------------------------- */

  const session = await mint(person.id, null);

  await enterWorkshop({ userId: person.id, sessionId: session.id, orgId: hillside.id });
  const atHillside = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });

  check(atHillside.orgId === hillside.id, 'entering a workshop writes it on the session');

  check(
    actingAs(theirs, atHillside.orgId)?.role === 'MANAGER',
    'and the role is the one they hold there',
  );

  await enterWorkshop({ userId: person.id, sessionId: session.id, orgId: kirkstall.id });
  const atKirkstall = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });

  check(
    actingAs(theirs, atKirkstall.orgId)?.role === 'TECHNICIAN',
    'switching moves the role with it, rather than keeping the higher one',
  );

  /* --- and what the person can actually see -------------------------------- */

  // The role following the switch is the visible half. This is the half that
  // matters: `forOrg` takes the organisation from the session, so what a page
  // reads has to change with it — and has to change completely, rather than
  // leaving one query pointed at the workshop they came from.

  const [atHillsideCustomer, atKirkstallCustomer] = await Promise.all([
    prisma.customer.create({
      data: { orgId: hillside.id, kind: 'INDIVIDUAL', displayName: `Hillside customer ${tag}` },
      select: { id: true },
    }),
    prisma.customer.create({
      data: { orgId: kirkstall.id, kind: 'INDIVIDUAL', displayName: `Kirkstall customer ${tag}` },
      select: { id: true },
    }),
  ]);

  const { forOrg } = await import('@carnet/db');

  // Exactly what `requireSession` hands a page: a client scoped to whatever
  // the session says, and nothing else.
  const asKirkstall = forOrg(atKirkstall.orgId!);

  const seen = await asKirkstall.customer.findMany({
    where: { displayName: { contains: tag } },
    select: { id: true },
  });

  check(
    seen.length === 1 && seen[0]!.id === atKirkstallCustomer.id,
    'the records follow the switch: in one workshop they see that workshop’s customers',
    seen.length,
  );

  const byId = await asKirkstall.customer.findUnique({
    where: { id: atHillsideCustomer.id },
    select: { id: true },
  });

  check(
    byId === null,
    'and the other workshop’s customer is not found by id, even though they work there too',
  );

  /* --- the boundary --------------------------------------------------------- */

  const refused = await enterWorkshop({
    userId: person.id,
    sessionId: session.id,
    orgId: elsewhere.id,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof NotYoursError ? error.message : `wrong error: ${error}`),
  );

  check(
    refused === 'That is not a workshop you work at.',
    'a workshop they are not on the team of is refused',
    refused,
  );

  const invented = await enterWorkshop({
    userId: person.id,
    sessionId: session.id,
    orgId: 'no-such-organisation-at-all',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof NotYoursError ? error.message : `wrong error: ${error}`),
  );

  check(
    invented === refused,
    'and one that does not exist is refused in the same words, confirming nothing',
    `${invented} / ${refused}`,
  );

  const afterRefusal = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });

  check(
    afterRefusal.orgId === kirkstall.id,
    'a refused switch leaves them where they were, rather than nowhere',
  );

  /* --- two devices ---------------------------------------------------------- */

  const phone = await mint(person.id, hillside.id);

  check(
    phone.orgId === hillside.id && afterRefusal.orgId === kirkstall.id,
    'two sessions of the same person can be in different workshops at once (FR-9808)',
  );

  /* --- leaving one of them -------------------------------------------------- */

  // What `deactivateMember` does, as data: which sessions end when somebody is
  // taken off Hillside's team.
  const sessions = await prisma.session.findMany({
    where: { userId: person.id, revokedAt: null },
    select: { id: true, orgId: true },
  });

  const ending = sessionsEndedByLeaving(sessions, hillside.id);

  check(
    ending.includes(phone.id) && !ending.includes(session.id),
    'being taken off one workshop ends the sessions in it, and only those (FR-9805)',
    ending.join(', '),
  );

  // And the same thing through the code the team page actually calls.
  const owner = await prisma.user.create({
    data: {
      email: `owner-${tag.toLowerCase()}@example.com`,
      name: `Owner ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });
  await prisma.membership.create({
    data: { userId: owner.id, orgId: hillside.id, role: 'OWNER' },
  });

  const { deactivateMember } = await import('../../apps/web/src/lib/team');

  const removed = await deactivateMember({
    orgId: hillside.id,
    actorUserId: owner.id,
    actorRole: 'OWNER',
    targetUserId: person.id,
  });

  check(removed.ok, 'a workshop can take somebody off its team', removed.error);

  const [phoneAfter, deskAfter] = await Promise.all([
    prisma.session.findUniqueOrThrow({ where: { id: phone.id } }),
    prisma.session.findUniqueOrThrow({ where: { id: session.id } }),
  ]);

  check(
    phoneAfter.revokedAt !== null,
    'their session in that workshop ends at once, not when it expires (FR-1906)',
  );

  check(
    deskAfter.revokedAt === null,
    'and their session in the other workshop is untouched: one tenant’s decision stops at its own boundary',
  );

  /* --- and the membership is gone from the moment it is gone ---------------- */

  const nowTheirs = await workshopsFor(person.id);

  check(
    nowTheirs.length === 1 && nowTheirs[0]!.orgId === kirkstall.id,
    'the workshop they left is no longer one of theirs',
  );

  check(
    actingAs(nowTheirs, hillside.id) === null,
    'and a session still naming it acts in nothing, at the next request rather than the next sign-in (FR-9806)',
  );

  /* --- and how the second membership is made in the first place ------------ */

  // The way a person ends up on two teams is an invitation to an address that
  // already has an account. `acceptInvitation` attaches the workshop to it —
  // and a session follows, so until Phase 63 the link alone signed whoever
  // opened it in as that person. A forwarded email, a shared inbox, or an
  // address typed slightly wrong by whoever sent the invitation was enough,
  // and what it reached was every workshop that account was already on.

  const { hashPassword } = await import('../../apps/web/src/lib/auth');
  const { acceptInvitation, inviteColleague } = await import('../../apps/web/src/lib/team');

  const knownPassword = `correct-horse-${tag}`;

  const settled = await prisma.user.create({
    data: {
      email: `theo.ravensworth-${tag.toLowerCase()}@example.com`,
      name: `Theo Ravensworth ${tag}`,
      passwordHash: await hashPassword(knownPassword),
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  });

  await prisma.membership.create({
    data: { userId: settled.id, orgId: kirkstall.id, role: 'SERVICE_ADVISOR' },
  });

  const elsewhereOwner = await prisma.user.create({
    data: {
      email: `boss-${tag.toLowerCase()}@example.com`,
      name: `Boss ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });
  await prisma.membership.create({
    data: { userId: elsewhereOwner.id, orgId: elsewhere.id, role: 'OWNER' },
  });

  const invited = await inviteColleague({
    orgId: elsewhere.id,
    actorUserId: elsewhereOwner.id,
    actorRole: 'OWNER',
    email: settled.email,
    role: 'TECHNICIAN',
  });

  check(invited.ok, 'a workshop can invite an address that already has an account', invited.error);

  const withoutPassword = await acceptInvitation({
    token: invited.token!,
    name: 'Whoever Opened The Link',
    password: 'not-their-password',
  });

  check(
    !withoutPassword.ok,
    'holding the link is not enough to accept as an account that already exists',
    withoutPassword.error,
  );

  const stillOnlyOne = await prisma.membership.count({
    where: { userId: settled.id, isActive: true },
  });

  check(
    stillOnlyOne === 1,
    'and the refused acceptance attached no workshop to their account',
    stillOnlyOne,
  );

  const withPassword = await acceptInvitation({
    token: invited.token!,
    name: 'Theo',
    password: knownPassword,
  });

  check(
    withPassword.ok && withPassword.orgId === elsewhere.id,
    'the account’s own password accepts it, and says which workshop to start in',
    withPassword.error,
  );

  const nowTwo = await workshopsFor(settled.id);

  check(nowTwo.length === 2, 'which is how somebody comes to work at two workshops', nowTwo.length);

  /* --- it is written down --------------------------------------------------- */

  const entries = await prisma.auditLog.findMany({
    where: { orgId: kirkstall.id, action: 'session.entered', actorUserId: person.id },
    select: { entityId: true },
  });

  check(
    entries.length === 1 && entries[0]!.entityId === kirkstall.id,
    'entering a workshop is recorded in that workshop’s log (FR-9807)',
    entries.length,
  );

  const elsewhereEntries = await prisma.auditLog.count({
    where: { orgId: elsewhere.id, actorUserId: person.id },
  });

  check(
    elsewhereEntries === 0,
    'and a refused entry writes nothing in the log of the workshop that refused it',
  );

  /* --- and readable in three languages -------------------------------------- */

  // The chooser's own sentence is built in core and handed to `t()` as a
  // variable, so no scanner that collects literals can see it — the fourth
  // time that gap has appeared, after Phases 57, 59 and 62. What is different
  // here is that three of the four sentences carry a name in the middle, so
  // the check has to ask the translator the question the page will ask it:
  // give me this finished English sentence in French, and expect something
  // that is not the English back.

  const { hasTranslation, translate, describeChoice } = await import('@carnet/core');

  const one = [{ orgId: 'a', orgName: 'Hillside', role: 'OWNER' as const, isActive: true }];
  const two = [
    ...one,
    { orgId: 'b', orgName: 'Kirkstall', role: 'OWNER' as const, isActive: true },
  ];
  const many = [
    ...two,
    { orgId: 'c', orgName: 'Calverley', role: 'OWNER' as const, isActive: true },
  ];

  const everySentence = [
    describeChoice([]),
    describeChoice(one),
    describeChoice(two),
    describeChoice(many),
  ];

  const unanswered: string[] = [];

  for (const sentence of everySentence) {
    for (const language of ['fr', 'ar'] as const) {
      // Either a key of its own, or a pattern that reads it back into slots —
      // which is what the two- and three-workshop sentences need.
      if (!hasTranslation(language, sentence) && translate(language, sentence) === sentence) {
        unanswered.push(`${language}: ${sentence}`);
      }
    }
  }

  check(
    unanswered.length === 0,
    `each of the ${everySentence.length} things the chooser can say is answered in French and Arabic`,
    unanswered.join(' | '),
  );

  check(
    translate('fr', describeChoice(two)).includes('Hillside') &&
      translate('fr', describeChoice(two)).includes('Kirkstall'),
    'and the workshops’ own names come through it unchanged',
    translate('fr', describeChoice(two)),
  );

  /* --- and the page a person actually sees ---------------------------------- */

  // Only when a server is offered. `verify-screens` measures every address in
  // the application and cannot measure this one: its people are on one team,
  // so the chooser correctly enters it and redirects, and what would be
  // measured is the dashboard wearing another address's name. Here there is
  // somebody on two.

  const base = process.argv[2];

  if (base) {
    // `settled` is the one who is on two teams by this point: Kirkstall, and
    // Elsewhere, which they joined by accepting the invitation above. The
    // contractor has since been taken off Hillside and is down to one.
    const chooser = await mint(settled.id, null);

    const page = await fetch(`${base}/choose`, {
      headers: { cookie: `carnet_session=${chooser.token}` },
      redirect: 'manual',
    });

    const body = page.status === 200 ? await page.text() : '';

    check(
      page.status === 200,
      'the chooser is a page, for somebody with a choice to make',
      page.status,
    );

    check(
      body.includes(kirkstall.name) && body.includes(elsewhere.name),
      'and it names the workshops they are on the team of',
    );

    check(!body.includes(hillside.name), 'and none that they are not');

    // A chooser that quietly put them somewhere would pass every check above.
    const after = await prisma.session.findUniqueOrThrow({ where: { id: chooser.id } });

    check(
      after.orgId === null,
      'and reading it places them nowhere: asking is not answering (FR-9801)',
      after.orgId,
    );
  } else {
    console.info('\n  (no address given, so the chooser itself was not rendered)\n');
  }

  /* --- clearing up ---------------------------------------------------------- */

  await prisma.customer.deleteMany({
    where: { orgId: { in: [hillside.id, kirkstall.id, elsewhere.id] } },
  });
  const everybody = [person.id, other.id, owner.id, settled.id, elsewhereOwner.id];

  await prisma.invitation.deleteMany({ where: { orgId: elsewhere.id } });
  await prisma.session.deleteMany({ where: { userId: { in: everybody } } });
  await prisma.membership.deleteMany({ where: { userId: { in: everybody } } });
  await prisma.employee.deleteMany({ where: { userId: { in: everybody } } });
  await prisma.auditLog.updateMany({
    where: { actorUserId: { in: everybody } },
    data: { actorUserId: null },
  });
  await prisma.user.deleteMany({ where: { id: { in: everybody } } });
  await prisma.organization.deleteMany({
    where: { id: { in: [hillside.id, kirkstall.id, elsewhere.id] } },
  });

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(
      `\n  ${checked} checks. Two workshops, one person, and no confusion between them.\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
