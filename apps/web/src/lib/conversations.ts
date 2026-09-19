import {
  addressFor,
  type Channel,
  DEFAULT_TEMPLATES,
  fillTemplate,
  formatMinor,
  isUnread,
  mergeThread,
  orderThreads,
  paymentSentence,
  preferredChannel,
  reachableChannels,
  type Values,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { siteUrl } from './credentials';
import { audit } from './guard';
import { pushNow } from './outbound';
import { regionFor } from './region';
import { driver, readUrlFor, StorageError, ticketFor, writeLocal } from './storage';

/**
 * Conversations, against the database. Phase 36.
 *
 * A thread is a row that outbound and inbound messages point at. Nothing
 * about how a message is sent or received changed: the queue is still the
 * record, the inbox still matches on confidence. What changed is that every
 * message is filed onto one thread, and the thread is what a person reads
 * and replies on, from the job it is about, without leaving it.
 */

export class ConversationError extends Error {
  readonly code: 'NOT_FOUND' | 'NO_ADDRESS' | 'EMPTY' | 'BAD_CHANNEL' | 'BAD_TEMPLATE' | 'BAD_FILE';

  constructor(code: ConversationError['code'], message: string) {
    super(message);
    this.name = 'ConversationError';
    this.code = code;
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/* ---------------------------------------------------------------------------
   Filing
   --------------------------------------------------------------------------- */

/**
 * The thread a message belongs on: the job's, if it is about a job, else
 * the customer's. Found or made. A job thread carries its customer so the
 * customer's list shows it too.
 */
export async function threadFor(
  input: { orgId: string; customerId?: string | null; jobId?: string | null },
  tx: Tx = prisma,
): Promise<string | null> {
  if (input.jobId) {
    const existing = await tx.conversation.findUnique({
      where: { jobId: input.jobId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const job = await tx.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId },
      select: { id: true, customerId: true, number: true, shortDescription: true },
    });
    if (!job) return null;
    const made = await tx.conversation.create({
      data: {
        orgId: input.orgId,
        customerId: job.customerId,
        jobId: job.id,
        subject: `Job #${job.number}: ${job.shortDescription}`,
      },
      select: { id: true },
    });
    return made.id;
  }

  if (input.customerId) {
    const existing = await tx.conversation.findFirst({
      where: { orgId: input.orgId, customerId: input.customerId, jobId: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, orgId: input.orgId },
      select: { id: true },
    });
    if (!customer) return null;
    const made = await tx.conversation.create({
      data: { orgId: input.orgId, customerId: customer.id },
      select: { id: true },
    });
    return made.id;
  }

  return null;
}

/** The job and customer a sent message was about, from what it says it relates to. */
async function relatedJobFor(
  orgId: string,
  relatedType: string | null,
  relatedId: string | null,
): Promise<{ jobId: string | null; customerId: string | null }> {
  if (!relatedType || !relatedId) return { jobId: null, customerId: null };
  switch (relatedType) {
    case 'Job': {
      const job = await prisma.job.findFirst({
        where: { id: relatedId, orgId },
        select: { id: true, customerId: true },
      });
      return { jobId: job?.id ?? null, customerId: job?.customerId ?? null };
    }
    case 'Estimate': {
      const row = await prisma.estimate.findFirst({
        where: { id: relatedId, orgId },
        select: { job: { select: { id: true, customerId: true } } },
      });
      return { jobId: row?.job.id ?? null, customerId: row?.job.customerId ?? null };
    }
    case 'Invoice': {
      const row = await prisma.invoice.findFirst({
        where: { id: relatedId, orgId },
        select: { jobId: true, customerId: true },
      });
      return { jobId: row?.jobId ?? null, customerId: row?.customerId ?? null };
    }
    case 'Payment': {
      const row = await prisma.payment.findFirst({
        where: { id: relatedId, orgId },
        select: { invoice: { select: { jobId: true, customerId: true } } },
      });
      return { jobId: row?.invoice?.jobId ?? null, customerId: row?.invoice?.customerId ?? null };
    }
    case 'Booking': {
      const row = await prisma.booking.findFirst({
        where: { id: relatedId, orgId },
        select: { jobId: true, customerId: true },
      });
      return { jobId: row?.jobId ?? null, customerId: row?.customerId ?? null };
    }
    case 'Customer': {
      return { jobId: null, customerId: relatedId };
    }
    default:
      return { jobId: null, customerId: null };
  }
}

/** The customer an address belongs to, if exactly one does. */
async function customerByAddress(orgId: string, address: string): Promise<string | null> {
  const value = address.trim();
  if (!value) return null;
  const rows = await prisma.customer.findMany({
    where: {
      orgId,
      OR: [{ email: { equals: value, mode: 'insensitive' } }, { mobile: value }, { phone: value }],
    },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0]!.id : null;
}

/**
 * Files one sent message onto its thread. Idempotent; a message with no
 * customer behind it (a sign-up email, a password reset) stays unfiled,
 * which is correct: it is not a conversation with a customer.
 */
export async function fileOutbound(messageLogId: string): Promise<string | null> {
  const message = await prisma.messageLog.findUnique({
    where: { id: messageLogId },
    select: {
      id: true,
      orgId: true,
      channel: true,
      toAddress: true,
      relatedType: true,
      relatedId: true,
      conversationId: true,
      createdAt: true,
      sentAt: true,
    },
  });
  if (!message || !message.orgId) return null;
  if (message.conversationId) return message.conversationId;
  if (message.channel === 'PORTAL') return null;

  const related = await relatedJobFor(message.orgId, message.relatedType, message.relatedId);
  const customerId =
    related.customerId ?? (await customerByAddress(message.orgId, message.toAddress));
  if (!customerId) return null;

  const conversationId = await threadFor({
    orgId: message.orgId,
    customerId,
    jobId: related.jobId,
  });
  if (!conversationId) return null;

  const at = message.sentAt ?? message.createdAt;
  await prisma.$transaction([
    prisma.messageLog.update({ where: { id: message.id }, data: { conversationId } }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastChannel: message.channel, lastMessageAt: { set: at } },
    }),
  ]);
  return conversationId;
}

/** Files one received message onto its thread, and marks the thread unread. */
export async function fileInbound(inboundId: string): Promise<string | null> {
  const message = await prisma.inboundMessage.findUnique({
    where: { id: inboundId },
    select: {
      id: true,
      orgId: true,
      channel: true,
      fromAddress: true,
      customerId: true,
      jobId: true,
      conversationId: true,
      receivedAt: true,
    },
  });
  if (!message) return null;
  if (message.conversationId) return message.conversationId;

  const customerId =
    message.customerId ?? (await customerByAddress(message.orgId, message.fromAddress));
  if (!customerId) return null;

  const conversationId = await threadFor({
    orgId: message.orgId,
    customerId,
    jobId: message.jobId,
  });
  if (!conversationId) return null;

  await prisma.$transaction([
    prisma.inboundMessage.update({ where: { id: message.id }, data: { conversationId } }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastChannel: message.channel,
        lastMessageAt: message.receivedAt,
        lastInboundAt: message.receivedAt,
        // A reply reopens a closed thread; a closed thread with a new
        // message in it is one nobody would find.
        status: 'OPEN',
      },
    }),
  ]);
  return conversationId;
}

/**
 * Everything sent or received before threads existed, filed a batch at a
 * time as the page is opened. Idempotent and bounded, so a workshop with
 * years of messages is never made to wait for all of them at once.
 */
export async function fileUnfiled(orgId: string, limit = 200): Promise<number> {
  const [outbound, inbound] = await Promise.all([
    prisma.messageLog.findMany({
      where: { orgId, conversationId: null, channel: { not: 'PORTAL' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true },
    }),
    prisma.inboundMessage.findMany({
      where: { orgId, conversationId: null },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: { id: true },
    }),
  ]);
  let filed = 0;
  for (const row of outbound) if (await fileOutbound(row.id)) filed += 1;
  for (const row of inbound) if (await fileInbound(row.id)) filed += 1;
  return filed;
}

/* ---------------------------------------------------------------------------
   Reading
   --------------------------------------------------------------------------- */

const LIST_SELECT = {
  id: true,
  subject: true,
  status: true,
  assignedToUserId: true,
  lastChannel: true,
  lastMessageAt: true,
  lastInboundAt: true,
  readAt: true,
  customer: { select: { id: true, displayName: true, email: true, mobile: true } },
  job: {
    select: {
      id: true,
      number: true,
      shortDescription: true,
      status: true,
      vehicle: { select: { make: true, model: true, registration: true } },
    },
  },
  assignedTo: { select: { id: true, name: true } },
  outbound: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { body: true, createdAt: true, status: true },
  },
  inbound: {
    orderBy: { receivedAt: 'desc' as const },
    take: 1,
    select: { body: true, receivedAt: true },
  },
} as const;

export async function conversationsFor(
  orgId: string,
  filter: { mine?: string | null; closed?: boolean } = {},
) {
  await fileUnfiled(orgId);
  const rows = await prisma.conversation.findMany({
    where: {
      orgId,
      ...(filter.mine ? { assignedToUserId: filter.mine } : {}),
      ...(filter.closed ? {} : { status: 'OPEN' }),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
    select: LIST_SELECT,
  });

  return orderThreads(
    rows.map((row) => {
      const lastOut = row.outbound[0];
      const lastIn = row.inbound[0];
      const latest =
        lastIn && (!lastOut || lastIn.receivedAt >= lastOut.createdAt)
          ? { body: lastIn.body, direction: 'in' as const }
          : lastOut
            ? { body: lastOut.body, direction: 'out' as const }
            : null;
      return {
        id: row.id,
        status: row.status,
        subject: row.subject,
        assignedToUserId: row.assignedToUserId,
        assignedTo: row.assignedTo,
        lastChannel: row.lastChannel,
        lastMessageAt: row.lastMessageAt,
        lastInboundAt: row.lastInboundAt,
        readAt: row.readAt,
        unread: isUnread(row),
        customer: row.customer,
        job: row.job,
        preview: latest ? { ...latest, body: latest.body.slice(0, 120) } : null,
      };
    }),
  );
}

/**
 * How many open threads have something in them nobody has read.
 *
 * Counted in the database rather than fetched and filtered. This is a badge
 * on the sidebar of every page a workshop opens, so it runs more often than
 * anything else in the product, and it used to read every open conversation
 * to produce one small number.
 *
 * The condition is the same one `isUnread` states, written twice — once in
 * core for a thread in hand and once here for a count — which is a duplication
 * worth naming: if either changes, the badge and the list disagree, and the
 * test below the fold in conversations.test.ts is what would notice.
 */
export async function unreadCount(orgId: string): Promise<number> {
  return prisma.conversation.count({
    where: {
      orgId,
      status: 'OPEN',
      lastInboundAt: { not: null },
      OR: [{ readAt: null }, { readAt: { lt: prisma.conversation.fields.lastInboundAt } }],
    },
  });
}

export async function conversationDetail(orgId: string, conversationId: string) {
  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    select: {
      ...LIST_SELECT,
      customer: {
        select: { id: true, displayName: true, firstName: true, email: true, mobile: true },
      },
      outbound: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          channel: true,
          subject: true,
          body: true,
          status: true,
          error: true,
          createdAt: true,
          sentAt: true,
          sentBy: { select: { name: true } },
          attachments: { select: { id: true, filename: true, url: true, mimeType: true } },
        },
      },
      inbound: {
        orderBy: { receivedAt: 'asc' as const },
        select: {
          id: true,
          channel: true,
          subject: true,
          body: true,
          receivedAt: true,
          confidence: true,
          attachments: { select: { id: true, filename: true, url: true, mimeType: true } },
        },
      },
    },
  });
  if (!row) return null;

  const entries = mergeThread(
    row.outbound.map((m) => ({
      id: m.id,
      channel: m.channel,
      subject: m.subject,
      body: m.body,
      status: m.status,
      error: m.error,
      at: m.createdAt,
      sentAt: m.sentAt,
    })),
    row.inbound.map((m) => ({
      id: m.id,
      channel: m.channel,
      subject: m.subject,
      body: m.body,
      at: m.receivedAt,
      confidence: m.confidence,
    })),
  );

  const attachmentsByMessage = new Map<
    string,
    { id: string; filename: string; src: string | null; mimeType: string }[]
  >();
  for (const m of [...row.outbound, ...row.inbound]) {
    if (m.attachments.length === 0) continue;
    attachmentsByMessage.set(
      m.id,
      await Promise.all(
        m.attachments.map(async (a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          src: await readUrlFor(a.url),
        })),
      ),
    );
  }
  const sentBy = new Map(row.outbound.map((m) => [m.id, m.sentBy?.name ?? null]));

  const customer = row.customer;
  const channels = customer ? reachableChannels(customer) : [];
  const lastIn = row.inbound[row.inbound.length - 1];

  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    assignedTo: row.assignedTo,
    customer,
    job: row.job,
    unread: isUnread(row),
    channels,
    preferred: customer
      ? preferredChannel({ customer, lastInboundChannel: lastIn?.channel ?? row.lastChannel })
      : null,
    entries: entries.map((e) => ({
      ...e,
      by: e.direction === 'out' ? (sentBy.get(e.id) ?? null) : null,
      attachments: attachmentsByMessage.get(e.id) ?? [],
    })),
  };
}

/** The thread for a job, for the card on the job page; made if it does not exist. */
export async function conversationForJob(orgId: string, jobId: string) {
  // Filing used to happen here, and it was four hundred milliseconds on the
  // most-opened screen in the product: up to a hundred unfiled messages, one
  // query each, in a loop, every time anybody opened any job. It is background
  // work and it now happens in the background — `sweepConversations` runs
  // hourly, and the inbox still files on sight so somebody looking at it never
  // waits for the hour. Phase 51.
  const id = await threadFor({ orgId, jobId });
  if (!id) return null;
  return conversationDetail(orgId, id);
}

/* ---------------------------------------------------------------------------
   Writing
   --------------------------------------------------------------------------- */

export interface ReplyFile {
  name: string;
  type: string;
  bytes: Buffer;
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/**
 * A person's reply, on the channel they chose, from wherever they are
 * looking at the thread. Queued like everything else the product sends and
 * pushed straight out, because somebody is waiting for it.
 *
 * Files travel with the record: they are stored, listed on the message and
 * shown on the thread. The providers behind email and text do not carry
 * them yet, so the body names what was attached; the adapters that carry
 * files are the next step for whichever provider a workshop chooses.
 */
export async function sendReply(input: {
  orgId: string;
  userId: string;
  conversationId: string;
  channel: Channel;
  body: string;
  subject?: string | null;
  files?: ReplyFile[];
}): Promise<{ messageId: string }> {
  const thread = await prisma.conversation.findFirst({
    where: { id: input.conversationId, orgId: input.orgId },
    select: {
      id: true,
      jobId: true,
      subject: true,
      customer: { select: { id: true, displayName: true, email: true, mobile: true } },
    },
  });
  if (!thread) throw new ConversationError('NOT_FOUND', 'That conversation is not here.');
  if (!thread.customer) {
    throw new ConversationError('NO_ADDRESS', 'This thread has no customer to write to.');
  }

  const body = input.body.trim();
  if (!body) throw new ConversationError('EMPTY', 'Write something first.');

  const channels = reachableChannels(thread.customer);
  if (!channels.includes(input.channel)) {
    throw new ConversationError(
      'BAD_CHANNEL',
      `${thread.customer.displayName} cannot be reached by ${input.channel === 'EMAIL' ? 'email' : input.channel === 'WHATSAPP' ? 'WhatsApp' : 'text'}: there is no ${input.channel === 'EMAIL' ? 'email address' : 'mobile number'} on file.`,
    );
  }
  const to = addressFor(input.channel, thread.customer)!;

  const files = input.files ?? [];
  for (const file of files) {
    if (file.bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new ConversationError(
        'BAD_FILE',
        `${file.name} is ${Math.round(file.bytes.length / 1024 / 1024)}MB; the limit is ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`,
      );
    }
  }

  const noted =
    files.length > 0
      ? `${body}\n\n(${files.length === 1 ? 'Attached' : 'Attached, ' + files.length + ' files'}: ${files.map((f) => f.name).join(', ')})`
      : body;

  const message = await prisma.$transaction(async (tx) => {
    const row = await tx.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: input.channel,
        toAddress: to,
        subject:
          input.channel === 'EMAIL'
            ? input.subject?.trim() || thread.subject || 'From your workshop'
            : null,
        body: noted,
        status: 'QUEUED',
        relatedType: thread.jobId ? 'Job' : 'Customer',
        relatedId: thread.jobId ?? thread.customer!.id,
        conversationId: thread.id,
        sentByUserId: input.userId,
      },
      select: { id: true },
    });
    await tx.conversation.update({
      where: { id: thread.id },
      data: {
        lastChannel: input.channel,
        lastMessageAt: new Date(),
        readAt: new Date(),
        status: 'OPEN',
      },
    });
    return row;
  });

  for (const file of files) {
    const key = await storeFile({
      orgId: input.orgId,
      scopeId: thread.id,
      file,
    });
    await prisma.messageAttachment.create({
      data: {
        orgId: input.orgId,
        conversationId: thread.id,
        messageLogId: message.id,
        url: key,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.bytes.length,
      },
    });
  }

  await pushNow(message.id);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'conversation.replied',
    entityType: 'Conversation',
    entityId: thread.id,
    after: { channel: input.channel, messageId: message.id, files: files.map((f) => f.name) },
  });

  return { messageId: message.id };
}

/** Puts a file in the store from the server, whichever store is configured. */
async function storeFile(input: { orgId: string; scopeId: string; file: ReplyFile }) {
  let ticket;
  try {
    ticket = await ticketFor({
      orgId: input.orgId,
      scope: 'conversations',
      scopeId: input.scopeId,
      filename: input.file.name,
      contentType: input.file.type,
      sizeBytes: input.file.bytes.length,
      accept: 'document',
    });
  } catch (error) {
    if (error instanceof StorageError) throw new ConversationError('BAD_FILE', error.message);
    throw error;
  }
  if (driver() === 'local') {
    await writeLocal(ticket.key, input.file.bytes);
  } else {
    const put = await fetch(ticket.url, {
      method: 'PUT',
      headers: ticket.headers,
      body: new Uint8Array(input.file.bytes),
    });
    if (!put.ok) {
      throw new ConversationError(
        'BAD_FILE',
        `The store refused ${input.file.name} (${put.status}).`,
      );
    }
  }
  return ticket.key;
}

export async function markRead(input: { orgId: string; userId: string; conversationId: string }) {
  await prisma.conversation.updateMany({
    where: { id: input.conversationId, orgId: input.orgId },
    data: { readAt: new Date() },
  });
}

export async function assignConversation(input: {
  orgId: string;
  userId: string;
  conversationId: string;
  assigneeUserId: string | null;
}) {
  if (input.assigneeUserId) {
    const member = await prisma.membership.findFirst({
      where: { orgId: input.orgId, userId: input.assigneeUserId },
      select: { id: true },
    });
    if (!member) throw new ConversationError('NOT_FOUND', 'That person is not on this team.');
  }
  await prisma.conversation.updateMany({
    where: { id: input.conversationId, orgId: input.orgId },
    data: { assignedToUserId: input.assigneeUserId },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'conversation.assigned',
    entityType: 'Conversation',
    entityId: input.conversationId,
    after: { assigneeUserId: input.assigneeUserId },
  });
}

export async function setConversationStatus(input: {
  orgId: string;
  userId: string;
  conversationId: string;
  status: 'OPEN' | 'CLOSED';
}) {
  await prisma.conversation.updateMany({
    where: { id: input.conversationId, orgId: input.orgId },
    data: { status: input.status, readAt: new Date() },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.status === 'CLOSED' ? 'conversation.closed' : 'conversation.reopened',
    entityType: 'Conversation',
    entityId: input.conversationId,
  });
}

/* ---------------------------------------------------------------------------
   Templates
   --------------------------------------------------------------------------- */

export async function templatesFor(orgId: string) {
  const own = await prisma.messageTemplate.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, channel: true, subject: true, body: true },
  });
  return [
    ...own.map((t) => ({ ...t, key: t.id, own: true })),
    ...DEFAULT_TEMPLATES.map((t) => ({
      id: null,
      key: t.key,
      name: t.name,
      channel: t.channel,
      subject: null,
      body: t.body,
      own: false,
    })),
  ];
}

export async function saveTemplate(input: {
  orgId: string;
  userId: string;
  name: string;
  body: string;
  channel?: Channel | null;
  subject?: string | null;
}) {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body)
    throw new ConversationError('BAD_TEMPLATE', 'A template needs a name and a message.');
  const probe = fillTemplate(body, SAMPLE_VALUES);
  if (probe.problem) throw new ConversationError('BAD_TEMPLATE', probe.problem);
  const row = await prisma.messageTemplate.create({
    data: {
      orgId: input.orgId,
      name,
      body,
      channel: input.channel ?? null,
      subject: input.subject?.trim() || null,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'template.saved',
    entityType: 'MessageTemplate',
    entityId: row.id,
    after: { name },
  });
  return row.id;
}

export async function deleteTemplate(input: { orgId: string; userId: string; templateId: string }) {
  await prisma.messageTemplate.deleteMany({ where: { id: input.templateId, orgId: input.orgId } });
}

const SAMPLE_VALUES: Values = {
  firstName: 'Maria',
  lastName: 'Okafor',
  customerName: 'Maria Okafor',
  workshopName: 'Your workshop',
  workshopPhone: '0161 000 0000',
  vehicle: 'BMW X5',
  registration: 'AB12 CDE',
  jobNumber: '1234',
  invoiceNumber: 'INV-1',
  amount: '£100.00',
  dueDate: '1 January',
  bookingDate: '1 January',
  bookingTime: '9:00',
  serviceName: 'Service',
  link: 'https://example.test',
};

/** The facts a template can be filled from, for this thread. */
export async function templateValues(orgId: string, conversationId: string): Promise<Values> {
  const [thread, org, region] = await Promise.all([
    prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      select: {
        customer: { select: { displayName: true, firstName: true, lastName: true } },
        job: {
          select: {
            number: true,
            vehicle: { select: { make: true, model: true, registration: true } },
            invoices: {
              where: { status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { number: true, total: true, amountPaid: true, currency: true, dueAt: true },
            },
            estimates: {
              where: { status: 'SENT' },
              orderBy: { version: 'desc' },
              take: 1,
              select: { shares: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
            },
          },
        },
      },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, phone: true } }),
    regionFor(orgId),
  ]);
  if (!thread) return {};
  const invoice = thread.job?.invoices[0];
  const owed = invoice ? Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100) : 0;
  const values: Values = {
    firstName: thread.customer?.firstName ?? thread.customer?.displayName?.split(' ')[0] ?? '',
    lastName: thread.customer?.lastName ?? '',
    customerName: thread.customer?.displayName ?? '',
    workshopName: org?.name ?? '',
    workshopPhone: org?.phone ?? '',
    vehicle: thread.job
      ? [thread.job.vehicle.make, thread.job.vehicle.model].filter(Boolean).join(' ')
      : '',
    registration: thread.job?.vehicle.registration ?? '',
    jobNumber: thread.job ? String(thread.job.number) : '',
    invoiceNumber: invoice?.number ?? '',
    amount:
      invoice && owed > 0
        ? formatMinor(owed, { currency: invoice.currency, locale: region.locale })
        : '',
    dueDate: invoice?.dueAt ? invoice.dueAt.toLocaleDateString(region.locale) : '',
    link: invoice && owed > 0 ? `${siteUrl()}/portal/invoices` : `${siteUrl()}/portal`,
  };
  return values;
}

/** The payment sentence for this thread's open bill, or null when nothing is owed. */
export async function paymentLinkFor(
  orgId: string,
  conversationId: string,
): Promise<string | null> {
  const values = await templateValues(orgId, conversationId);
  if (!values.amount) return null;
  return paymentSentence({
    amount: values.amount,
    link: `${siteUrl()}/portal/invoices`,
    vehicle: values.vehicle,
  });
}
