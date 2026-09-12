import 'dotenv/config';
import { prisma } from '@carnet/db';

async function main() {
  const events = await prisma.deliveryEvent.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 5,
    select: { event: true, occurredAt: true, messageLog: { select: { toAddress: true } } },
  });

  const inbound = await prisma.inboundMessage.count();

  console.info(JSON.stringify({ recentEvents: events, inboundRows: inbound }, null, 1));
}

main().finally(() => prisma.$disconnect());
