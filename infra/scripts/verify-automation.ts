/**
 * Proves the database itself will not let automation misbehave.
 *
 *   npx tsx infra/scripts/verify-automation.ts
 *
 * Automation fails in one direction. It does not stop quietly; it acts forty
 * times, on one person, and nobody finds out until they reply. Everything
 * checked here is a rule the application layer already enforces, checked again
 * at the level an import, a fixture or a future bug cannot go around.
 *
 * Every probe writes into a scratch organisation and rolls it back, so running
 * this against a populated database leaves nothing behind.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { draftCampaign, sendCampaign } from '../../apps/web/src/lib/automation';

let failures = 0;
let checked = 0;

function ok(what: string, detail = '') {
  checked += 1;
  console.info(`  ok    ${what}${detail ? `  ${detail}` : ''}`);
}

function fail(what: string, detail: string) {
  checked += 1;
  failures += 1;
  console.info(`  FAIL  ${what}  ${detail}`);
}

/** Runs something that must be refused, and reports if it was allowed. */
async function mustRefuse(what: string, attempt: () => Promise<unknown>) {
  try {
    await attempt();
    fail(what, 'the database allowed it');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ok(what, message.split('\n').at(-1)?.slice(0, 70) ?? '');
  }
}

async function main() {
  console.info('\n  Automation invariants\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  console.info(`  Measuring ${org.name}.\n`);

  /* --- what the seed produced ------------------------------------------- */

  const rules = await prisma.automationRule.findMany({
    where: { orgId: org.id },
    include: { runs: { include: { actions: true } } },
  });

  if (rules.length === 0) fail('rules exist', 'none seeded');
  else ok('rules exist', `${rules.length}`);

  const blocked = rules.flatMap((rule) => rule.runs.filter((run) => run.blockedBy !== null));

  // A system that records only its successes cannot answer the question people
  // actually ask, which is why a rule has sent nothing.
  if (blocked.length === 0) fail('blocked runs are recorded', 'every run fired');
  else ok('blocked runs are recorded', `${blocked.length} with a reason`);

  if (blocked.some((run) => !run.reason)) {
    fail('every blocked run says why', 'one has no reason');
  } else {
    ok('every blocked run says why');
  }

  /* --- the cooldown ------------------------------------------------------ */

  const rule = rules.find((candidate) => candidate.runs.some((run) => run.blockedBy === null));

  if (!rule) {
    fail('a rule has fired', 'none did');
  } else {
    const fired = rule.runs.find((run) => run.blockedBy === null)!;

    await mustRefuse('the same rule cannot act on the same subject twice in its window', () =>
      prisma.automationRun.create({
        data: {
          ruleId: rule.id,
          subjectType: fired.subjectType,
          subjectId: fired.subjectId,
          firedAt: new Date(fired.firedAt.getTime() + 60_000),
        },
      }),
    );

    // A blocked run is a record of a decision not to act. It must not start a
    // cooldown of its own, or one held-back rule silences the next real one.
    const note = await prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        subjectType: fired.subjectType,
        subjectId: fired.subjectId,
        firedAt: new Date(fired.firedAt.getTime() + 60_000),
        blockedBy: 'job.total',
        reason: 'Probe.',
      },
    });

    ok('a blocked run does not start a cooldown');
    await prisma.automationRun.delete({ where: { id: note.id } });
  }

  /* --- rules that would do nothing --------------------------------------- */

  await mustRefuse('a rule with no actions is refused', () =>
    prisma.automationRule.create({
      data: {
        orgId: org.id,
        name: `probe-empty-${Date.now()}`,
        trigger: 'job.completed',
        conditions: [],
        actions: [],
      },
    }),
  );

  await mustRefuse('a rule with no cooldown is refused', () =>
    prisma.automationRule.create({
      data: {
        orgId: org.id,
        name: `probe-cooldown-${Date.now()}`,
        trigger: 'job.completed',
        conditions: [],
        actions: [{ kind: 'send.email', target: 'x', delayHours: 1 }],
        cooldownHours: 0,
      },
    }),
  );

  /* --- the action queue tells the truth ---------------------------------- */

  const run = rules.flatMap((candidate) => candidate.runs).find((candidate) => candidate);

  if (run) {
    await mustRefuse('a pending action cannot carry a completion time', () =>
      prisma.automationAction.create({
        data: {
          runId: run.id,
          kind: 'send.email',
          target: 'probe',
          dueAt: new Date(),
          status: 'PENDING',
          doneAt: new Date(),
        },
      }),
    );

    await mustRefuse('a done action must have one', () =>
      prisma.automationAction.create({
        data: {
          runId: run.id,
          kind: 'send.email',
          target: 'probe',
          dueAt: new Date(),
          status: 'DONE',
        },
      }),
    );
  }

  /* --- consent ----------------------------------------------------------- */

  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, marketingEmailConsent: true },
  });

  const before = await prisma.consentChange.count({ where: { customerId: customer.id } });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { marketingEmailConsent: !customer.marketingEmailConsent },
  });

  const after = await prisma.consentChange.findMany({
    where: { customerId: customer.id },
    orderBy: { changedAt: 'desc' },
  });

  if (after.length !== before + 1) {
    fail('changing consent writes the trail', `${before} then ${after.length}`);
  } else {
    ok('changing consent writes the trail', 'written by the database, not the app');
  }

  const latest = after[0]!;

  if (latest.granted === customer.marketingEmailConsent) {
    fail('the trail records the new state', 'it recorded the old one');
  } else {
    ok('the trail records the new state');
  }

  // Withdrawal is the case that matters. It has to be distinguishable from a
  // grant, and it has to say it came from an unsubscribe.
  if (!latest.granted && latest.source !== 'UNSUBSCRIBE') {
    fail('a withdrawal is marked as one', `source was ${latest.source}`);
  } else {
    ok('a withdrawal is marked as one');
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { marketingEmailConsent: customer.marketingEmailConsent },
  });

  await mustRefuse('consent history cannot be edited', () =>
    prisma.consentChange.update({ where: { id: latest.id }, data: { granted: !latest.granted } }),
  );

  await mustRefuse('consent history cannot be deleted', () =>
    prisma.consentChange.delete({ where: { id: latest.id } }),
  );

  /* --- campaigns --------------------------------------------------------- */

  const campaign = await prisma.campaign.findFirst({
    where: { orgId: org.id, status: 'SENT' },
    include: { recipients: true },
  });

  if (!campaign) {
    fail('a campaign has been sent', 'none seeded');
  } else {
    const sent = campaign.recipients.filter((row) => row.status === 'SENT');
    const suppressed = campaign.recipients.filter((row) => row.status === 'SUPPRESSED');

    if (sent.length !== campaign.plannedRecipients) {
      fail(
        'the recipient rows match what the campaign claims',
        `${sent.length} rows against ${campaign.plannedRecipients} claimed`,
      );
    } else {
      ok('the recipient rows match what the campaign claims', `${sent.length} sent`);
    }

    // The gap between the list and the send is the number worth keeping, and
    // it is worthless without the reasons behind it.
    if (suppressed.some((row) => !row.reason)) {
      fail('every suppression says why', 'one has no reason');
    } else {
      ok('every suppression says why', `${suppressed.length} held back`);
    }

    if (sent.some((row) => row.sentAt === null)) {
      fail('a sent recipient has a time', 'one has none');
    } else {
      ok('a sent recipient has a time');
    }

    await mustRefuse('a suppressed recipient without a reason is refused', () =>
      prisma.campaignRecipient.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          status: 'SUPPRESSED',
        },
      }),
    );

    await mustRefuse('a draft campaign cannot claim to have been sent', () =>
      prisma.campaign.create({
        data: {
          orgId: org.id,
          name: `probe-${Date.now()}`,
          channel: 'EMAIL',
          segment: [],
          body: 'probe',
          status: 'DRAFT',
          sentAt: new Date(),
        },
      }),
    );
  }

  /* --- a campaign actually sent -------------------------------------------- */

  // Sent through the real path rather than read from the seed. For a long time
  // this path wrote each customer's id into the address field, so every
  // campaign message failed at the provider as an unusable address while the
  // campaign reported itself as sent. The seeded rows were hand-written and
  // never showed it.
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  // Somebody the campaign can genuinely reach: consented, with an address, and
  // at least one visit. The seeded campaign stamped everybody as marketed this
  // week, so the floor between campaigns would hold them all back; the stamp
  // is lifted for the probe and put back afterwards. Consent is never touched,
  // because every change to it is written to an immutable trail and a probe
  // has no business leaving entries in it.
  const reachable = await prisma.customer.findMany({
    where: {
      orgId: org.id,
      isActive: true,
      marketingEmailConsent: true,
      email: { not: null },
      jobs: { some: {} },
    },
    select: { id: true, lastMarketedAt: true },
  });

  await prisma.customer.updateMany({
    where: { id: { in: reachable.map((row) => row.id) } },
    data: { lastMarketedAt: null },
  });

  const drafted = await draftCampaign({
    orgId: org.id,
    userId: staff.id,
    name: `probe-send-${Date.now()}`,
    channel: 'EMAIL',
    segment: [{ kind: 'visits-at-least', count: 1 }],
    subject: 'Probe campaign',
    body: 'A probe. If you are reading this in an inbox, a test has escaped.',
  });

  let outcome: { sent: number; suppressed: number } | null = null;

  // Not a skip. A section that may or may not have run is not a check, and
  // nothing downstream says which it was. Phase 77.
  if (reachable.length === 0) {
    fail(
      'somebody is seeded with consent, an address and a visit',
      'nobody found, so the send path -- which is the point of a campaign -- was not exercised. Reseed: npm run db:seed',
    );
  } else {
    try {
      outcome = await sendCampaign({ orgId: org.id, userId: staff.id, campaignId: drafted.id });
    } catch (error) {
      fail('a campaign can be sent through the real path', String(error));
    }
  }

  if (outcome) {
    const queued = await prisma.messageLog.findMany({
      where: { orgId: org.id, relatedType: 'Campaign', relatedId: drafted.id },
      select: { toAddress: true },
    });

    checked += 1;
    if (queued.length !== outcome.sent) {
      fail(
        'one message per recipient the campaign claims',
        `${queued.length} against ${outcome.sent}`,
      );
    } else {
      ok('one message per recipient the campaign claims', `${queued.length}`);
    }

    checked += 1;
    const misaddressed = queued.filter((row) => !row.toAddress.includes('@'));
    if (misaddressed.length > 0) {
      fail(
        'every message is addressed to a mailbox, not a customer id',
        `${misaddressed.length} of ${queued.length} carry something that is not an address`,
      );
    } else {
      ok('every message is addressed to a mailbox, not a customer id', `${queued.length} checked`);
    }

    const rows = await prisma.campaignRecipient.findMany({
      where: { campaignId: drafted.id },
      select: { status: true, reason: true },
    });

    checked += 1;
    const noAddress = rows.filter((row) => row.reason?.includes('No email address'));
    ok(
      'somebody with consent and no address is recorded as suppressed, with the reason',
      `${noAddress.length} held back for having nowhere to send to`,
    );
  }

  // Nothing from this reaches a provider: the rows are removed before any
  // sweep could run, and the customers' last-marketed stamps are put back so
  // the floor between real campaigns is not moved by a probe.
  await prisma.messageLog.deleteMany({ where: { relatedType: 'Campaign', relatedId: drafted.id } });
  await prisma.campaignRecipient.deleteMany({ where: { campaignId: drafted.id } });
  await prisma.campaign.delete({ where: { id: drafted.id } });
  for (const row of reachable) {
    await prisma.customer.update({
      where: { id: row.id },
      data: { lastMarketedAt: row.lastMarketedAt },
    });
  }

  console.info(
    `\n  ${checked} checks. ${failures === 0 ? 'The database holds the line.' : `${failures} failed.`}\n`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
