import { humaniseRole, invitableRoles, type Role } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import {
  changeRole,
  deactivateMember,
  inviteColleague,
  revokeInvitation,
  teamFor,
} from '@/lib/team';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Team') };
}
export const dynamic = 'force-dynamic';

/**
 * Who is in the workshop. FR-1901, FR-1902, FR-1903.
 *
 * Before this existed, adding a second person took a database write, so most
 * workshops could not add their second person. Everything else in the product
 * assumed somebody was already inside and knew what they were doing.
 *
 * The invitation link is shown once, on screen. Email delivery goes through
 * the outbox and can be delayed or filtered, and a workshop owner standing
 * next to the person they are inviting should not have to wait for a mail
 * server to agree.
 */

async function invite(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('user:manage');

  const result = await inviteColleague({
    orgId,
    actorUserId: user.userId,
    actorRole: user.role,
    email: String(formData.get('email') ?? ''),
    role: String(formData.get('role') ?? 'TECHNICIAN') as Role,
    locationId: String(formData.get('locationId') ?? '') || null,
    message: String(formData.get('message') ?? ''),
  });

  redirect(
    result.ok
      ? `/settings/team?invited=${encodeURIComponent(String(formData.get('email') ?? ''))}&token=${result.token}`
      : `/settings/team?error=${encodeURIComponent(result.error ?? 'That did not work.')}`,
  );
}

async function withdraw(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('user:manage');

  await revokeInvitation({
    orgId,
    actorUserId: user.userId,
    invitationId: String(formData.get('invitationId') ?? ''),
  });

  redirect('/settings/team?withdrawn=1');
}

async function setRole(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('user:manage');

  const result = await changeRole({
    orgId,
    actorUserId: user.userId,
    actorRole: user.role,
    targetUserId: String(formData.get('userId') ?? ''),
    role: String(formData.get('role') ?? '') as Role,
  });

  redirect(
    result.ok
      ? '/settings/team?changed=1'
      : `/settings/team?error=${encodeURIComponent(result.error ?? '')}`,
  );
}

async function remove(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('user:manage');

  const result = await deactivateMember({
    orgId,
    actorUserId: user.userId,
    actorRole: user.role,
    targetUserId: String(formData.get('userId') ?? ''),
  });

  redirect(
    result.ok
      ? '/settings/team?removed=1'
      : `/settings/team?error=${encodeURIComponent(result.error ?? '')}`,
  );
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, user, region } = await requireSession('settings:read');
  const params = await searchParams;
  const t = await tFor();

  const { members, invitations, locations } = await teamFor(orgId);
  const roles = invitableRoles(user.role);
  const mayAdminister = roles.length > 0;

  const active = members.filter((member) => member.isActive);
  const past = members.filter((member) => !member.isActive);

  return (
    <>
      <PageHeader
        eyebrow={t('Settings')}
        title={t('Team')}
        description={
          invitations.length === 1
            ? t('{active} active · 1 invitation open', { active: active.length })
            : t('{active} active · {count} invitations open', {
                active: active.length,
                count: invitations.length,
              })
        }
        actions={
          <Link href="/settings">
            <Button size="sm" variant="ghost">
              {t('All settings')}
            </Button>
          </Link>
        }
      />

      {params.error ? (
        <Alert tone="danger" className="mb-5">
          {t(params.error)}
        </Alert>
      ) : null}

      {params.token && params.invited ? (
        <Card className="mb-5 border-(--success)">
          <CardHeader
            title={t('Invitation ready for {email}', { email: params.invited })}
            description={t('Send them this link. It works once and lasts seven days.')}
          />
          <CardBody>
            <p className="scroll-x datum rounded-(--radius-sm) bg-(--surface-sunk) px-3 py-2.5 text-[12px]">
              {/* i18n-ignore */}
              {`/invite/${params.token}`}
            </p>
            <p className="mt-2.5 text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Shown here once and never recoverable, because only its fingerprint is stored. An email is on its way too, but a link you can read out over the counter does not depend on a mail server agreeing.',
              )}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('In the workshop')}
              description={t('Role decides which screens they see')}
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Name')}</Th>
                    <Th>{t('Role')}</Th>
                    <Th>{t('Site')}</Th>
                    <Th>{t('Last signed in')}</Th>
                    {mayAdminister ? <Th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {active.map((member) => {
                    const isSelf = member.userId === user.userId;

                    return (
                      <Tr key={member.id}>
                        <Td>
                          <span className="font-medium">{member.user.name}</span>
                          {isSelf ? (
                            <span className="ml-1.5 text-[11px] text-(--text-faint)">
                              {t('you')}
                            </span>
                          ) : null}
                          <span className="block text-[11px] text-(--text-faint)">
                            {member.user.email}
                          </span>
                        </Td>
                        <Td>
                          {mayAdminister && !isSelf ? (
                            <form action={setRole} className="flex items-center gap-1.5">
                              <input type="hidden" name="userId" value={member.userId} />
                              <Select
                                name="role"
                                defaultValue={member.role}
                                className="h-8 text-[12px]"
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>
                                    {t(humaniseRole(role))}
                                  </option>
                                ))}
                              </Select>
                              <Button type="submit" size="sm" variant="ghost">
                                {t('Save')}
                              </Button>
                            </form>
                          ) : (
                            <Badge tone={member.role === 'OWNER' ? 'brand' : 'neutral'} size="sm">
                              {t(humaniseRole(member.role as Role))}
                            </Badge>
                          )}
                        </Td>
                        <Td className="text-(--text-soft)">
                          {member.location?.name ?? t('All sites')}
                        </Td>
                        <Td className="text-(--text-faint)">
                          {member.user.lastLoginAt
                            ? member.user.lastLoginAt.toLocaleDateString(region.locale, {
                                day: 'numeric',
                                month: 'short',
                              })
                            : t('Never')}
                        </Td>
                        {mayAdminister ? (
                          <Td numeric>
                            {isSelf ? null : (
                              <form action={remove}>
                                <input type="hidden" name="userId" value={member.userId} />
                                <Button type="submit" size="sm" variant="ghost">
                                  {t('Remove')}
                                </Button>
                              </form>
                            )}
                          </Td>
                        ) : null}
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          {invitations.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader title={t('Waiting to be accepted')} description={t('Open invitations')} />
              <ul className="divide-y divide-(--border)">
                {invitations.map((invitation) => {
                  const days = Math.ceil(
                    (invitation.expiresAt.getTime() - Date.now()) / 86_400_000,
                  );

                  return (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{invitation.email}</p>
                        <p className="text-[11px] text-(--text-faint)">
                          {t(humaniseRole(invitation.role as Role))}
                          {invitation.invitedBy
                            ? ` · ${t('sent by {name}', { name: invitation.invitedBy.name })}`
                            : ''}
                          {` · ${days === 1 ? t('1 day left') : t('{count} days left', { count: days })}`}
                        </p>
                      </div>
                      {mayAdminister ? (
                        <form action={withdraw}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            {t('Withdraw')}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {past.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader
                title={t('No longer here')}
                description={t(
                  "Kept, not deleted. Their work is what last year's costs are built on.",
                )}
              />
              <ul className="divide-y divide-(--border)">
                {past.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="text-[13px] text-(--text-soft)">{member.user.name}</span>
                    <span className="text-[11px] text-(--text-faint)">
                      {t(humaniseRole(member.role as Role))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          {mayAdminister ? (
            <Card>
              <CardHeader
                title={t('Invite somebody')}
                description={t('They set their own password')}
              />
              <CardBody>
                <form action={invite} className="grid gap-3.5">
                  <Field label={t('Email')}>
                    <Input
                      name="email"
                      type="email"
                      inputMode="email"
                      required
                      placeholder={t('them@yourworkshop.co.uk')}
                    />
                  </Field>

                  <Field label={t('Role')} hint={t('Changeable later')}>
                    <Select name="role" defaultValue="TECHNICIAN">
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {t(humaniseRole(role))}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {locations.length > 1 ? (
                    <Field label={t('Site')} hint={t('Leave blank for all sites')}>
                      <Select name="locationId" defaultValue="">
                        <option value="">{t('All sites')}</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}

                  <Field label={t('Message')} hint={t('Optional, shown on the invitation')}>
                    <Input name="message" placeholder={t('Looking forward to having you.')} />
                  </Field>

                  <Button type="submit" variant="primary" block>
                    {t('Create invitation')}
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : (
            <EmptyState
              title={t('Read only')}
              description={t('Only an owner or a manager can change who is in the workshop.')}
            />
          )}

          <Card>
            <CardHeader title={t('How roles work')} />
            <CardBody className="grid gap-2 text-[12px] leading-relaxed text-(--text-soft)">
              <p>
                {t(
                  'A role decides which screens somebody reaches. Anything they cannot use is absent rather than greyed out, because a disabled control is an invitation to ask why.',
                )}
              </p>
              <p>
                {t(
                  'Nobody can hand out a role above their own, and nobody can change their own. A manager promoting themselves is the exact thing roles exist to prevent, and the form for it would look identical to changing anybody else.',
                )}
              </p>
              <p>
                {t(
                  'Removing somebody ends their sessions immediately and keeps every record they wrote.',
                )}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
