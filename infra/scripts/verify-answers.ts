/**
 * Questions in words, answered from the records, against a real database.
 *
 *   npx tsx infra/scripts/verify-answers.ts
 *
 * The command centre promises three things: every question it advertises gets
 * an answer with its working, every figure agrees with the page that computes
 * the same thing, and a question it cannot answer is refused rather than
 * guessed at. The customer summary promises one: it says nothing the job does
 * not. Each promise is checked here.
 *
 * Nothing is written; there is nothing to clean up.
 */

import 'dotenv/config';

import { COVERAGE, customerSummary, verifyAgainstFacts } from '@carnet/core';
import { prisma } from '@carnet/db';

import { openReceivables } from '../../apps/web/src/lib/accounting';
import { customerSummaryFor, summaryFactsFor } from '../../apps/web/src/lib/ai';
import { answer, revenueObservations } from '../../apps/web/src/lib/answers';

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

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  console.info('\nEvery question the page advertises');

  for (const entry of COVERAGE) {
    const asked = await answer(org.id, entry.example);
    check(`"${entry.example}" is recognised`, asked.intent !== null, true);
    check('  and answered with a headline', (asked.answer?.headline.length ?? 0) > 10, true);
    check('  showing its working', (asked.answer?.reasoning.length ?? 0) >= 1, true);
    check('  and pointing at a page', asked.answer?.source.href.startsWith('/'), true);
  }

  console.info('\nThe figures agree with the pages');

  // Money owed: the answer and the aged-debtors calculation are the same sum.
  const owed = await answer(org.id, 'Who owes us money?');
  const receivables = await openReceivables(org.id);
  const expectedOwed = receivables.reduce((sum, row) => sum + row.outstanding.minor, 0);
  check(
    'what is owed matches the receivables report to the penny',
    (owed.answer?.figure as { minor: number }).minor,
    expectedOwed,
  );

  // Cars in the shop: the answer and a direct count agree.
  const inShop = await answer(org.id, 'How many cars are in the shop?');
  const counted = await prisma.job.count({
    where: {
      orgId: org.id,
      status: {
        in: [
          'RECEIVED',
          'INSPECTING',
          'DIAGNOSED',
          'ESTIMATED',
          'AWAITING_APPROVAL',
          'APPROVED',
          'IN_PROGRESS',
          'QUALITY_CHECK',
        ],
      },
    },
  });
  check('cars in the shop matches the jobs list', inShop.answer?.figure, counted);

  // Cash today: the answer and the payments table agree.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const cash = await answer(org.id, 'How much cash came in today?');
  const payments = await prisma.payment.findMany({
    where: { orgId: org.id, receivedAt: { gte: startOfDay } },
    select: { amount: true },
  });
  check(
    'cash today matches the payments recorded today',
    (cash.answer?.figure as { minor: number }).minor,
    payments.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0),
  );

  console.info('\nWhat it will not do');

  const nonsense = await answer(org.id, 'Should we buy a second ramp?');
  check('a question the records cannot answer is refused', nonsense.answer, null);
  check('and the refusal says so plainly', nonsense.refusal?.includes('cannot answer'), true);
  check('without guessing', nonsense.refusal?.includes('does not guess'), true);

  console.info('\nThe month in sentences');

  const observations = await revenueObservations(org.id);
  check('there is at least one observation', observations.length >= 1, true);
  check(
    'every observation carries a figure',
    observations.every((line) => /\d/.test(line)),
    true,
  );
  check('and there are never more than four', observations.length <= 4, true);

  console.info('\nThe summary for the customer');

  const completed = await prisma.job.findFirst({
    where: {
      orgId: org.id,
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      labourLines: { some: {} },
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true, number: true },
  });

  if (!completed) {
    console.info('  skip   no completed job with lines in the seed');
  } else {
    const facts = await summaryFactsFor(org.id, completed.id);
    const composed = await customerSummaryFor(org.id, completed.id);

    check('a summary is composed for a completed job', Boolean(composed?.text), true);
    check(
      'it opens by name',
      composed?.text.startsWith(`Hello ${facts?.customerFirstName}.`),
      true,
    );
    check(
      'it restates the labour',
      facts!.labour.every((line) => composed!.text.includes(line.description)),
      true,
    );

    // The gate every model output has to pass, applied to the plain text: the
    // plain summary must be its own witness, or the check itself is wrong.
    const gate = verifyAgainstFacts(composed!.text, facts!);
    check('the summary says nothing the job does not', gate.ok, true);

    // No model is configured here, so the text is the plain one.
    check('without a model the plain summary is used', composed?.polished, false);
    check('and nothing was rejected', composed?.rejected, null);

    // An invented figure would be caught before a customer saw it.
    const tampered = `${customerSummary(facts!)}\nWe also torqued the wheels to 140 Nm and fitted part ZZ-9999.`;
    const caught = verifyAgainstFacts(tampered, facts!);
    check('an invented torque figure and part number are caught', caught.unsupported.sort(), [
      '140',
      'ZZ-9999',
    ]);
  }

  console.info(
    failures === 0
      ? '\nThe records answer, and refuse, honestly.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
