import 'dotenv/config';
import { prisma } from '@carnet/db';

async function main() {
  const events = await prisma.deliveryEvent.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 6,
    select: { event: true, occurredAt: true, messageLog: { select: { toAddress: true } } },
  });

  const sent = await prisma.messageLog.findFirst({
    where: { relatedType: 'Probe', relatedId: 'reply-test' },
    select: { status: true, providerRef: true, sentAt: true },
  });

  console.info(JSON.stringify({ events, sent }, null, 1));
}

main().finally(() => prisma.$disconnect());
