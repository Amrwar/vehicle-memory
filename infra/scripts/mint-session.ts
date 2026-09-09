import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@carnet/db';
async function main() {
  const email = process.argv[2] ?? 'ahmed@hillsidemotors.test';
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: {
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId: user.id, orgId: user.memberships[0]?.orgId ?? null,
    expiresAt: new Date(Date.now() + 7200_000) } });
  console.log(token);
}
main().finally(() => prisma.$disconnect());
