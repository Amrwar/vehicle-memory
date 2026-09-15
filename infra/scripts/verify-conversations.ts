/**
 * Conversations, against a real database. Phase 36.
 *
 *   npx tsx infra/scripts/verify-conversations.ts [baseUrl]
 *
 * A quote sent to a customer is filed onto the job's thread; a reply comes
 * in on WhatsApp and lands on the same thread, unread; the desk answers
 * from the job on the channel the customer wrote on, with a file, and the
 * reply is queued, sent through the WhatsApp seam and filed; a template is
 * filled from the job and refused when a fact is missing; a payment link
 * is a sentence with the amount owed; a thread is assigned, read, closed,
 * and reopened by the next reply; a message from a stranger stays in the
 * inbox for a person. With a server on the base URL the conversations
 * page is read for the composer.
 *
 * Runs against the seeded hillside-motors organisation. Cleans up after
 * itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { DEFAULT_TEMPLATES, fillTemplate } from '@carnet/core';
import { prisma } from '@carnet/db';
import { TRANSPORTS } from '@carnet/jobs';

import {
  assignConversation,
  ConversationError,
  conversationDetail,
  conversationsFor,
  fileOutbound,
  markRead,
  paymentLinkFor,
  saveTemplate,
  sendReply,
  setConversationStatus,
  templatesFor,
  templateValues,
  threadFor,
  unreadCount,
} from '../../apps/web/src/lib/conversations';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';
import { receiveInbound } from '../../apps/web/src/lib/retention';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify conversations probe';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof ConversationError && actual === code)
      console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

async function main() {
  console.info(`\n  Conversations\n  ${BASE}\n  WhatsApp via ${TRANSPORTS.WHATSAPP.name}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true, name: true },
  });
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, portalUserId: maria.id },
    select: { id: true, displayName: true, email: true, mobile: true },
  });
  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id);

  // The customer needs a mobile for the text and WhatsApp channels. Set one
  // for the probe and put back whatever was there.
  const mobileBefore = customer.mobile;
  await prisma.customer.update({
    where: { id: customer.id },
    data: { mobile: mobileBefore ?? '+447700900123' },
  });
  const mobile = mobileBefore ?? '+447700900123';

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });

  /* ------------------------------------------------------------------
     Filing
     ------------------------------------------------------------------ */

  console.info('\n  Filing\n');

  const sent = await prisma.messageLog.create({
    data: {
      orgId: org.id,
      channel: 'SMS',
      toAddress: mobile,
      body: `${TAG}: your quote is ready`,
      status: 'SENT',
      sentAt: new Date(Date.now() - 60_000),
      relatedType: 'Job',
      relatedId: job.id,
    },
    select: { id: true },
  });
  const threadId = await fileOutbound(sent.id);
  check('a message about a job is filed onto the job thread', typeof threadId, 'string');
  check('and filing it twice is the same thread', await fileOutbound(sent.id), threadId);
  check('the job has one thread', await threadFor({ orgId: org.id, jobId: job.id }), threadId);

  const before = await unreadCount(org.id);
  const inbound = await receiveInbound({
    orgId: org.id,
    channel: 'WHATSAPP',
    fromAddress: mobile,
    body: `Yes please go ahead, job ${job.number}`,
    providerRef: `${TAG}-1`,
  });
  const filedIn = await prisma.inboundMessage.findUniqueOrThrow({
    where: { id: inbound!.id },
    select: { conversationId: true, channel: true },
  });
  check(
    'a WhatsApp reply quoting the job lands on the same thread',
    filedIn.conversationId,
    threadId,
  );
  check('and the thread is now unread', (await unreadCount(org.id)) - before, 1);

  const list = await conversationsFor(org.id);
  const mine = list.find((t) => t.id === threadId);
  check(
    'the list puts it first, unread, with the reply as the preview',
    {
      first: list[0]?.id === threadId,
      unread: mine?.unread,
      preview: mine?.preview?.direction,
    },
    { first: true, unread: true, preview: 'in' },
  );

  /* ------------------------------------------------------------------
     Replying
     ------------------------------------------------------------------ */

  console.info('\n  Replying\n');

  const detail = await conversationDetail(org.id, threadId!);
  check(
    'the thread reads oldest first, both directions',
    detail?.entries.map((e) => e.direction),
    ['out', 'in'],
  );
  check(
    'the composer offers the channels on file, WhatsApp first as they wrote on it',
    {
      channels: detail?.channels,
      preferred: detail?.preferred,
    },
    { channels: ['SMS', 'WHATSAPP', 'EMAIL'], preferred: 'WHATSAPP' },
  );

  await refuses('an empty reply is refused', 'EMPTY', () =>
    sendReply({
      orgId: org.id,
      userId: staff.id,
      conversationId: threadId!,
      channel: 'SMS',
      body: '  ',
    }),
  );

  const { messageId } = await sendReply({
    orgId: org.id,
    userId: staff.id,
    conversationId: threadId!,
    channel: 'WHATSAPP',
    body: `${TAG}: thank you, we will start this morning.`,
    files: [{ name: 'quote.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.4 probe') }],
  });
  const replyRow = await prisma.messageLog.findUniqueOrThrow({
    where: { id: messageId },
    select: {
      channel: true,
      status: true,
      provider: true,
      conversationId: true,
      sentByUserId: true,
      body: true,
      attachments: { select: { filename: true } },
    },
  });
  check(
    'the reply went by WhatsApp through the seam',
    [replyRow.channel, replyRow.status, replyRow.provider],
    ['WHATSAPP', 'SENT', TRANSPORTS.WHATSAPP.name],
  );
  check(
    'filed on the thread, by the person who wrote it',
    [replyRow.conversationId === threadId, replyRow.sentByUserId],
    [true, staff.id],
  );
  check(
    'the file is on the message and named in the body',
    [replyRow.attachments.map((a) => a.filename), replyRow.body.includes('quote.pdf')],
    [['quote.pdf'], true],
  );
  check(
    'replying marks the thread read',
    (await conversationDetail(org.id, threadId!))?.unread,
    false,
  );

  const noMobile = await prisma.customer.create({
    data: {
      orgId: org.id,
      displayName: `${TAG} email only`,
      email: `probe-${Date.now()}@example.test`,
    },
    select: { id: true },
  });
  const emailThread = await threadFor({ orgId: org.id, customerId: noMobile.id });
  await refuses('a text to a customer with no mobile is refused', 'BAD_CHANNEL', () =>
    sendReply({
      orgId: org.id,
      userId: staff.id,
      conversationId: emailThread!,
      channel: 'SMS',
      body: 'hello',
    }),
  );

  /* ------------------------------------------------------------------
     Templates and the payment link
     ------------------------------------------------------------------ */

  console.info('\n  Templates\n');

  const values = await templateValues(org.id, threadId!);
  const ready = DEFAULT_TEMPLATES.find((t) => t.key === 'ready')!;
  const filled = fillTemplate(ready.body, values);
  check(
    'a template is filled from the job',
    filled.text?.startsWith(`Hello ${values.firstName}, your`),
    true,
  );
  check(
    'and says what is missing rather than sending a blank',
    fillTemplate('Pay {{amount}} please', values).problem?.includes('{{amount}}'),
    true,
  );
  check('no payment link when nothing is owed', await paymentLinkFor(org.id, threadId!), null);

  await prisma.jobLabourLine.create({
    data: {
      jobId: job.id,
      description: 'Probe labour',
      hours: 1,
      rate: 80,
      taxRateId: vat?.id ?? null,
    },
  });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
  await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });
  const link = await paymentLinkFor(org.id, threadId!);
  check(
    'a payment link is a sentence with the amount and the link',
    {
      hasAmount: Boolean(link && /\d/.test(link)),
      hasLink: Boolean(link?.includes('/portal/invoices')),
    },
    { hasAmount: true, hasLink: true },
  );

  await refuses('a template that cannot be filled is refused', 'BAD_TEMPLATE', () =>
    saveTemplate({ orgId: org.id, userId: staff.id, name: TAG, body: 'Hello {{nothing}}' }),
  );
  const templateId = await saveTemplate({
    orgId: org.id,
    userId: staff.id,
    name: TAG,
    body: 'Hello {{firstName}}, your {{vehicle}} is booked. {{workshopName}}',
  });
  const templates = await templatesFor(org.id);
  check(
    'a saved template sits above the built-in ones',
    [templates[0]?.own, templates.some((t) => t.key === 'ready')],
    [true, true],
  );
  await prisma.messageTemplate.delete({ where: { id: templateId } });

  /* ------------------------------------------------------------------
     Assignment, closing, reopening
     ------------------------------------------------------------------ */

  console.info('\n  Assignment and state\n');

  await assignConversation({
    orgId: org.id,
    userId: staff.id,
    conversationId: threadId!,
    assigneeUserId: staff.id,
  });
  check(
    'assigned to a team member',
    (await conversationsFor(org.id, { mine: staff.id })).some((t) => t.id === threadId),
    true,
  );
  await refuses('not to a stranger', 'NOT_FOUND', () =>
    assignConversation({
      orgId: org.id,
      userId: staff.id,
      conversationId: threadId!,
      assigneeUserId: maria.id,
    }),
  );
  await setConversationStatus({
    orgId: org.id,
    userId: staff.id,
    conversationId: threadId!,
    status: 'CLOSED',
  });
  check(
    'a closed thread leaves the open list',
    (await conversationsFor(org.id)).some((t) => t.id === threadId),
    false,
  );
  await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: mobile,
    body: `One more thing about job ${job.number}`,
    providerRef: `${TAG}-2`,
  });
  const reopened = await prisma.conversation.findUniqueOrThrow({
    where: { id: threadId! },
    select: { status: true },
  });
  check('a reply reopens it', reopened.status, 'OPEN');
  await markRead({ orgId: org.id, userId: staff.id, conversationId: threadId! });

  const stranger = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: '+447700900999',
    body: `${TAG} from nobody we know`,
    providerRef: `${TAG}-3`,
  });
  const strangerRow = await prisma.inboundMessage.findUniqueOrThrow({
    where: { id: stranger!.id },
    select: { conversationId: true },
  });
  check(
    'a message from a stranger has no thread and waits for a person',
    strangerRow.conversationId,
    null,
  );

  /* ------------------------------------------------------------------
     The screen
     ------------------------------------------------------------------ */

  console.info('\n  The screen\n');
  const cookie = await sessionFor(staff.id, org.id);
  await screenHas(
    'the conversations page shows the thread and a composer',
    `/inbox?c=${threadId}`,
    cookie,
    'Payment link',
  );
  await screenHas(
    'the job page carries the conversation',
    `/jobs/${job.id}`,
    cookie,
    'Whole thread',
  );

  await prisma.customer.update({ where: { id: customer.id }, data: { mobile: mobileBefore } });
  await prisma.customer.delete({ where: { id: noMobile.id } });
  await forget(org.id);
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function screenHas(label: string, path: string, cookie: string, text: string) {
  try {
    const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    const body = await response.text();
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${label}: ${path} answered ${response.status}`);
      return;
    }
    check(label, body.includes(text), true);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${label}: no server at ${BASE} (${String(error)})`);
  }
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  for (const source of [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
  ])
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  await prisma.messageLog.deleteMany({ where: { orgId, body: { contains: TAG } } });
  await prisma.messageLog.deleteMany({ where: { orgId, relatedId: { in: invoiceIds } } });
  await prisma.inboundMessage.deleteMany({ where: { orgId, providerRef: { startsWith: TAG } } });
  await prisma.messageTemplate.deleteMany({ where: { orgId, name: TAG } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId, type: { in: ['job.completed', 'invoice.issued'] }, processedAt: null },
  });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.customer.deleteMany({ where: { orgId, displayName: { startsWith: TAG } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
