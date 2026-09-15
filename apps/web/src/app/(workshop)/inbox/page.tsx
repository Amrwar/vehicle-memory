import { type Channel, channelLabel, fillTemplate } from '@carnet/core';
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
  Textarea,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  assignConversation,
  ConversationError,
  conversationDetail,
  conversationsFor,
  deleteTemplate,
  markRead,
  paymentLinkFor,
  saveTemplate,
  sendReply,
  setConversationStatus,
  templatesFor,
  templateValues,
  threadFor,
} from '@/lib/conversations';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { handleInbound, inbox } from '@/lib/retention';
import { teamFor } from '@/lib/team';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Conversations') };
}
export const dynamic = 'force-dynamic';

/**
 * Conversations. Phase 36.
 *
 * One thread per customer, and one per job when it is about a job, with
 * everything that went out and everything that came back on it, whatever
 * carried it. The list on the left is unread first; the thread on the
 * right reads oldest to newest and ends in a composer that offers only the
 * channels this customer can actually be reached on.
 *
 * Nothing in a reply is acted on automatically. A message that looks like
 * "yes" is put at the top for a person to read, never treated as an
 * approval: work worth thousands does not rest on a pattern match.
 */
async function reply(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const conversationId = String(formData.get('conversationId') ?? '');
  const back = `/inbox?c=${conversationId}`;

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  try {
    await sendReply({
      orgId,
      userId: user.userId,
      conversationId,
      channel: String(formData.get('channel') ?? 'SMS') as Channel,
      body: String(formData.get('body') ?? ''),
      subject: String(formData.get('subject') ?? ''),
      files: await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          type: f.type || 'application/octet-stream',
          bytes: Buffer.from(await f.arrayBuffer()),
        })),
      ),
    });
  } catch (error) {
    if (error instanceof ConversationError) {
      redirect(`${back}&problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(`${back}&sent=1`);
}

async function assign(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const conversationId = String(formData.get('conversationId') ?? '');
  try {
    await assignConversation({
      orgId,
      userId: user.userId,
      conversationId,
      assigneeUserId: String(formData.get('assigneeUserId') ?? '') || null,
    });
  } catch (error) {
    if (error instanceof ConversationError) {
      redirect(`/inbox?c=${conversationId}&problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(`/inbox?c=${conversationId}`);
}

async function setStatus(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const conversationId = String(formData.get('conversationId') ?? '');
  await setConversationStatus({
    orgId,
    userId: user.userId,
    conversationId,
    status: formData.get('status') === 'CLOSED' ? 'CLOSED' : 'OPEN',
  });
  redirect(`/inbox?c=${conversationId}`);
}

/** A message nobody could match, filed by hand onto a job. */
async function file(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  await handleInbound({
    orgId,
    userId: user.userId,
    messageId: String(formData.get('messageId') ?? ''),
    jobId: String(formData.get('jobId') ?? '') || null,
    done: formData.get('done') === '1',
  });
  redirect('/inbox');
}

async function addTemplate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  try {
    await saveTemplate({
      orgId,
      userId: user.userId,
      name: String(formData.get('name') ?? ''),
      body: String(formData.get('body') ?? ''),
      channel: (String(formData.get('channel') ?? '') || null) as Channel | null,
    });
  } catch (error) {
    if (error instanceof ConversationError) {
      redirect(`/inbox?templates=1&problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect('/inbox?templates=1&saved=1');
}

async function removeTemplate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await deleteTemplate({
    orgId,
    userId: user.userId,
    templateId: String(formData.get('id') ?? ''),
  });
  redirect('/inbox?templates=1');
}

function when(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATE_TONE = {
  sent: 'success',
  delivered: 'success',
  queued: 'neutral',
  failed: 'danger',
  suppressed: 'danger',
  received: 'brand',
} as const;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    c?: string;
    customer?: string;
    mine?: string;
    closed?: string;
    t?: string;
    pay?: string;
    templates?: string;
    problem?: string;
    sent?: string;
    saved?: string;
  }>;
}) {
  const { orgId, user, region } = await requireSession('customer:read');
  const params = await searchParams;
  const t = await tFor();

  const [threads, unfiled, team, templates] = await Promise.all([
    conversationsFor(orgId, {
      mine: params.mine ? user.userId : null,
      closed: params.closed === '1',
    }),
    inbox(orgId),
    teamFor(orgId),
    templatesFor(orgId),
  ]);
  const stray = unfiled.filter((m) => !m.customer);

  // Arriving from a customer's page: their general thread, made if need be.
  const fromCustomer = params.customer
    ? await threadFor({ orgId, customerId: params.customer })
    : null;
  const selectedId = params.c ?? fromCustomer ?? threads[0]?.id ?? null;
  const thread = selectedId ? await conversationDetail(orgId, selectedId) : null;
  if (thread?.unread) await markRead({ orgId, userId: user.userId, conversationId: thread.id });

  // A template chosen in the composer is filled from the thread and offered
  // as text to edit; the payment link likewise. Both are one press.
  let draft = '';
  let draftProblem: string | null = null;
  if (thread && params.t) {
    const chosen = templates.find((tpl) => tpl.key === params.t);
    if (chosen) {
      const filled = fillTemplate(chosen.body, await templateValues(orgId, thread.id));
      draft = filled.text ?? '';
      draftProblem = filled.problem;
    }
  }
  if (thread && params.pay) {
    const sentence = await paymentLinkFor(orgId, thread.id);
    draft = sentence ?? '';
    draftProblem = sentence
      ? null
      : t('Nothing is owed on this job, so there is no payment link to send.');
  }

  const unread = threads.filter((th) => th.unread).length;
  const members = team.members ?? [];

  return (
    <>
      <PageHeader
        eyebrow={t('Communication')}
        title={t('Conversations')}
        description={t('Every customer, every message, whatever carried it; unread first')}
        actions={
          <>
            <Link href={params.mine ? '/inbox' : '/inbox?mine=1'}>
              <Button variant={params.mine ? 'primary' : 'secondary'} size="sm">
                {params.mine ? t('Everyone’s') : t('Mine')}
              </Button>
            </Link>
            <Link href={params.closed === '1' ? '/inbox' : '/inbox?closed=1'}>
              <Button variant="secondary" size="sm">
                {params.closed === '1' ? t('Only open') : t('Closed too')}
              </Button>
            </Link>
            <Link href={params.templates ? '/inbox' : '/inbox?templates=1'}>
              <Button variant="secondary" size="sm">
                {t('Templates')}
              </Button>
            </Link>
          </>
        }
      />

      {params.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(params.problem)}
        </Alert>
      ) : null}
      {params.sent ? (
        <Alert tone="success" className="mb-5">
          {t('Sent. It is on the thread with what became of it.')}
        </Alert>
      ) : null}

      {params.templates ? (
        <Card className="mb-5">
          <CardHeader
            title={t('Templates that are messages')}
            description={t(
              'Written as the message a good service advisor would send, with the few facts that change filled from the job. Placeholders: {placeholders}.',
              {
                placeholders:
                  '{{firstName}}, {{vehicle}}, {{registration}}, {{jobNumber}}, {{amount}}, {{link}}, {{workshopName}}, {{workshopPhone}}',
              },
            )}
          />
          <CardBody className="grid gap-4 lg:grid-cols-2">
            <ul className="grid gap-2">
              {templates.map((tpl) => (
                <li
                  key={tpl.key}
                  className="rounded-(--radius-md) border border-(--border) px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {tpl.own ? tpl.name : t(tpl.name)}
                      {!tpl.own ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">
                          {t('built in')}
                        </span>
                      ) : null}
                    </span>
                    {tpl.own && tpl.id ? (
                      <form action={removeTemplate}>
                        <input type="hidden" name="id" value={tpl.id} />
                        <button type="submit" className="text-[12px] underline">
                          {t('Remove')}
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-(--text-soft)">{tpl.body}</p>
                </li>
              ))}
            </ul>
            <form action={addTemplate} className="grid content-start gap-3">
              <Field label={t('Name')}>
                <Input name="name" placeholder={t('MOT reminder')} required />
              </Field>
              <Field label={t('Channel')}>
                <Select name="channel" defaultValue="">
                  <option value="">{t('Any')}</option>
                  <option value="SMS">{t('Text')}</option>
                  <option value="WHATSAPP">{t('WhatsApp')}</option>
                  <option value="EMAIL">{t('Email')}</option>
                </Select>
              </Field>
              <Field label={t('The message')} hint={t('A sentence you would send as it is.')}>
                <Textarea
                  name="body"
                  rows={4}
                  required
                  placeholder={t(
                    'Hello {name}, the MOT on your {vehicle} is due next month. Reply here or ring {phone} to book it in. {workshop}',
                    {
                      name: '{{firstName}}',
                      vehicle: '{{vehicle}}',
                      phone: '{{workshopPhone}}',
                      workshop: '{{workshopName}}',
                    },
                  )}
                />
              </Field>
              <div>
                <Button type="submit" variant="primary">
                  {t('Save the template')}
                </Button>
              </div>
              {params.saved ? <p className="text-[12px] text-(--success)">{t('Saved.')}</p> : null}
            </form>
          </CardBody>
        </Card>
      ) : null}

      {stray.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardHeader
            title={
              stray.length === 1
                ? t('1 message nobody could file')
                : t('{count} messages nobody could file', { count: stray.length })
            }
            description={t(
              'No customer has that address. File each onto a job, or mark it dealt with.',
            )}
          />
          <ul className="divide-y divide-(--border)">
            {stray.map((message) => (
              <li key={message.id} className="grid gap-2 px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="datum font-medium">{message.fromAddress}</span>
                  <span className="text-[11px] text-(--text-faint)">
                    {t(channelLabel(message.channel))} · {when(message.receivedAt, region.locale)}
                  </span>
                  {message.priority.label ? (
                    <Badge tone={message.priority.rank === 0 ? 'danger' : 'warning'} size="sm">
                      {t(message.priority.label)}
                    </Badge>
                  ) : null}
                </div>
                <p className="leading-relaxed">{message.body}</p>
                <form action={file} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="messageId" value={message.id} />
                  <Input
                    name="jobId"
                    placeholder={t('Job id to file it on')}
                    className="max-w-xs"
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    {t('File it')}
                  </Button>
                  <Button type="submit" name="done" value="1" size="sm">
                    {t('Dealt with')}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={params.mine ? t('Assigned to me') : t('Every thread')}
            description={unread > 0 ? t('{count} unread', { count: unread }) : t('Nothing unread')}
          />
          {threads.length === 0 ? (
            <EmptyState
              title={t('No conversations yet')}
              description={t(
                'A thread appears the first time a customer is written to, or writes in.',
              )}
            />
          ) : (
            <ul className="max-h-[70vh] divide-y divide-(--border) overflow-y-auto">
              {threads.map((th) => (
                <li key={th.id}>
                  <Link
                    href={`/inbox?c=${th.id}${params.mine ? '&mine=1' : ''}${params.closed === '1' ? '&closed=1' : ''}`}
                    className={[
                      'block px-4 py-3 hover:bg-(--surface-sunk)',
                      th.id === selectedId ? 'bg-(--surface-sunk)' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[13px] ${th.unread ? 'font-semibold' : 'font-medium'}`}
                      >
                        {th.unread ? (
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-(--brand)" />
                        ) : null}
                        {th.customer?.displayName ?? t('Unknown')}
                      </span>
                      <span className="shrink-0 text-[11px] text-(--text-faint)">
                        {when(th.lastMessageAt, region.locale)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-(--text-soft)">
                      {th.job
                        ? `#${th.job.number} ${th.job.vehicle.make} ${th.job.vehicle.model}`
                        : t('General')}
                      {th.assignedTo ? ` · ${th.assignedTo.name}` : ''}
                      {th.status === 'CLOSED' ? ` · ${t('closed')}` : ''}
                    </p>
                    {th.preview ? (
                      <p className="mt-0.5 truncate text-[12px] text-(--text-faint)">
                        {th.preview.direction === 'in' ? '← ' : '→ '}
                        {th.preview.body}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {thread ? (
          <Card className="overflow-hidden">
            <CardHeader
              title={thread.customer?.displayName ?? t('Unknown customer')}
              description={
                thread.job
                  ? `${t('Job #{number}', { number: thread.job.number })} · ${thread.job.vehicle.make} ${thread.job.vehicle.model}${thread.job.vehicle.registration ? ` · ${thread.job.vehicle.registration}` : ''}`
                  : t('General, not about one job')
              }
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {thread.job ? (
                    <Link href={`/jobs/${thread.job.id}`}>
                      <Button size="sm" variant="secondary">
                        {t('Open the job')}
                      </Button>
                    </Link>
                  ) : null}
                  {thread.customer ? (
                    <Link href={`/customers/${thread.customer.id}`}>
                      <Button size="sm" variant="secondary">
                        {t('The customer')}
                      </Button>
                    </Link>
                  ) : null}
                  <form action={setStatus}>
                    <input type="hidden" name="conversationId" value={thread.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={thread.status === 'OPEN' ? 'CLOSED' : 'OPEN'}
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      {thread.status === 'OPEN' ? t('Close') : t('Reopen')}
                    </Button>
                  </form>
                </div>
              }
            />
            <CardBody className="flex flex-wrap items-center gap-2 border-b border-(--border) text-[12px] text-(--text-soft)">
              <form action={assign} className="flex items-center gap-2">
                <input type="hidden" name="conversationId" value={thread.id} />
                <span>{t('Assigned to')}</span>
                <Select
                  name="assigneeUserId"
                  defaultValue={thread.assignedTo?.id ?? ''}
                  className="h-8 w-44 text-[12px]"
                >
                  <option value="">{t('nobody')}</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" variant="secondary">
                  {t('Set')}
                </Button>
              </form>
            </CardBody>

            <CardBody className="grid max-h-[50vh] gap-3 overflow-y-auto">
              {thread.entries.length === 0 ? (
                <p className="text-[13px] text-(--text-faint)">
                  {t('Nothing on this thread yet.')}
                </p>
              ) : (
                thread.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={[
                      'max-w-[85%] rounded-(--radius-lg) px-3.5 py-2.5 text-[13px]',
                      entry.direction === 'out'
                        ? 'ml-auto bg-(--brand-soft)'
                        : 'mr-auto border border-(--border) bg-(--surface)',
                    ].join(' ')}
                  >
                    {entry.subject ? <p className="mb-1 font-medium">{entry.subject}</p> : null}
                    <p className="whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                    {entry.attachments.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {entry.attachments.map((a) => (
                          <li key={a.id}>
                            {a.src ? (
                              <a
                                href={a.src}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] underline"
                              >
                                {a.filename}
                              </a>
                            ) : (
                              <span className="text-[12px]">{a.filename}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-(--text-faint)">
                      <Badge tone={STATE_TONE[entry.state]} size="sm">
                        {t(entry.state)}
                      </Badge>
                      {t(channelLabel(entry.channel))} · {when(entry.at, region.locale)}
                      {entry.by ? ` · ${entry.by}` : ''}
                      {entry.detail ? ` · ${entry.detail}` : ''}
                    </p>
                  </div>
                ))
              )}
            </CardBody>

            <CardBody className="border-t border-(--border)">
              {thread.channels.length === 0 ? (
                <p className="text-[13px] text-(--text-soft)">
                  {t(
                    '{name} has no email address or mobile number on file, so there is nowhere to write to.',
                    { name: thread.customer?.displayName ?? t('This customer') },
                  )}
                </p>
              ) : (
                <form action={reply} className="grid gap-3">
                  <input type="hidden" name="conversationId" value={thread.id} />
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label={t('By')}>
                      <Select
                        name="channel"
                        defaultValue={thread.preferred ?? thread.channels[0]}
                        className="w-36"
                      >
                        {thread.channels.map((c) => (
                          <option key={c} value={c}>
                            {t(channelLabel(c))}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('Start from')} className="min-w-[14rem]">
                      <div className="flex flex-wrap gap-1.5">
                        {templates.slice(0, 6).map((tpl) => (
                          <Link
                            key={tpl.key}
                            href={`/inbox?c=${thread.id}&t=${encodeURIComponent(tpl.key)}`}
                            className="rounded-(--radius-sm) border border-(--border) px-2 py-1 text-[12px] hover:bg-(--surface-sunk)"
                          >
                            {tpl.own ? tpl.name : t(tpl.name)}
                          </Link>
                        ))}
                        <Link
                          href={`/inbox?c=${thread.id}&pay=1`}
                          className="rounded-(--radius-sm) border border-(--brand) px-2 py-1 text-[12px] text-(--brand-text) hover:bg-(--brand-soft)"
                        >
                          {t('Payment link')}
                        </Link>
                      </div>
                    </Field>
                  </div>
                  {draftProblem ? <Alert tone="warning">{t(draftProblem)}</Alert> : null}
                  {thread.channels.includes('EMAIL') ? (
                    <Input
                      name="subject"
                      placeholder={t('Subject, for an email')}
                      defaultValue={thread.subject ?? ''}
                    />
                  ) : null}
                  <Textarea
                    name="body"
                    rows={4}
                    required
                    defaultValue={draft}
                    placeholder={t('Write to {name}…', {
                      name: thread.customer?.displayName ?? t('the customer'),
                    })}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-[12px] text-(--text-soft)">
                      <input
                        type="file"
                        name="files"
                        multiple
                        accept="image/*,application/pdf"
                        className="text-[12px]"
                      />
                    </label>
                    <Button type="submit" variant="primary">
                      {t('Send')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-(--text-faint)">
                    {t(
                      'Files are kept on the thread and named in the message; the email and text providers do not carry them yet.',
                    )}
                  </p>
                </form>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <EmptyState
              title={t('Pick a conversation')}
              description={t('Choose one on the left.')}
            />
          </Card>
        )}
      </div>
    </>
  );
}
