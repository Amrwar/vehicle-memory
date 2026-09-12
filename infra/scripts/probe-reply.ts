import 'dotenv/config';
import { prisma } from '@carnet/db';

/**
 * A real message with a real reply address on it.
 *
 * Sent to an address the account holder controls, so replying to it exercises
 * the whole chain at once: the Reply-To the sender puts on, the MX on the
 * reply subdomain, the provider's inbound handling, the webhook signature, the
 * matching logic and the inbox.
 */
async function main() {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, slug: true },
  });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { number: true, shortDescription: true },
  });

  const message = await prisma.messageLog.create({
    data: {
      orgId: org.id,
      channel: 'EMAIL',
      toAddress: 'hefnyamr@rocketmail.com',
      subject: `About job ${job.number}`,
      body: [
        'This is a real message from Carnet, sent the way a customer would receive one.',
        '',
        `It refers to job ${job.number}, ${job.shortDescription}.`,
        '',
        'Reply to it. The reply should land in the workshop inbox, filed against that job, without anybody touching a mailbox.',
      ].join('\n'),
      status: 'QUEUED',
      relatedType: 'Probe',
      relatedId: 'reply-test',
    },
    select: { id: true },
  });

  console.info(`queued ${message.id}, reply-to ${org.slug}@reply.carnetpassport.com`);
}

main().finally(() => prisma.$disconnect());
