import 'dotenv/config';
import { prisma } from '@carnet/db';

async function main() {
  const rows = await prisma.inboundMessage.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 5,
    select: {
      fromAddress: true,
      subject: true,
      body: true,
      confidence: true,
      matchNote: true,
      receivedAt: true,
      customer: { select: { displayName: true } },
      job: { select: { number: true, shortDescription: true } },
    },
  });

  console.info(JSON.stringify(rows, null, 1));
}

main().finally(() => prisma.$disconnect());
