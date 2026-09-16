import { prisma } from '@carnet/db';

import { env } from './env';
import { pushNow } from './outbound';

/**
 * Telling whoever runs Carnet that something happened to Carnet itself.
 *
 * Distinct from every other message in the product, which is a workshop
 * speaking to its customer. This is the product speaking to its operator, so
 * it carries no organisation: there is nothing for a reply to reach, and it
 * must not appear in any workshop's own message list as though the workshop
 * had sent it.
 *
 * It is also the one message that must never stop anything. A signup that
 * failed because the operator's mailbox was unreachable would be a workshop
 * turned away for a reason that has nothing to do with them, so everything
 * here is caught and swallowed. What does not send stays queued and the sweep
 * collects it, like any other message.
 */

/** Where the operator reads their post. Unset means nobody is told. */
function operatorAddress(): string | null {
  const address = env().OPERATOR_EMAIL?.trim();
  return address && address.includes('@') ? address : null;
}

export async function tellOperator(input: { subject: string; body: string }): Promise<boolean> {
  const to = operatorAddress();
  if (!to) return false;

  try {
    const queued = await prisma.messageLog.create({
      data: {
        // No workshop behind it: this is the platform speaking for itself.
        orgId: null,
        channel: 'EMAIL',
        toAddress: to,
        subject: input.subject,
        body: input.body,
      },
      select: { id: true },
    });

    await pushNow(queued.id);
    return true;
  } catch {
    // Deliberately silent. Nothing a person is doing should fail because the
    // operator could not be told about it.
    return false;
  }
}

/**
 * A workshop has signed up.
 *
 * Sent the moment the account exists rather than when the address is
 * verified, because the thing worth knowing is that somebody tried: a signup
 * that never verifies is itself the interesting news.
 */
export async function tellOperatorAboutSignup(input: {
  workshop: string;
  slug: string;
  contactName: string;
  email: string;
  country: string;
  plan: string;
  sites: number;
}): Promise<void> {
  await tellOperator({
    subject: `New workshop: ${input.workshop}`,
    body: [
      `${input.contactName} has opened an account for ${input.workshop}.`,
      '',
      `Email:    ${input.email}`,
      `Country:  ${input.country}`,
      `Plan:     ${input.plan}`,
      `Sites:    ${input.sites}`,
      `Workshop: ${input.slug}`,
      '',
      'They have not verified the address yet; they will be asked to before',
      'they can do anything in the product.',
      '',
      'Carnet',
    ].join('\n'),
  });
}
