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
import { handleInbound, inbox } from '@/lib/retention';
import { teamFor } from '@/lib/team';

export const metadata: Metadata = { title: 'Conversations' };
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
    const chosen = templates.find((t) => t.key === params.t);
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
      : 'Nothing is owed on this job, so there is no payment link to send.';
  }

  const unread = threads.filter((t) => t.unread).length;
  const members = team.members ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Conversations"
        description="Every customer, every message, whatever carried it; unread first"
        actions={
          <>
            <Link href={params.mine ? '/inbox' : '/inbox?mine=1'}>
              <Button variant={params.mine ? 'primary' : 'secondary'} size="sm">
                {params.mine ? 'Everyone’s' : 'Mine'}
              </Button>
            </Link>
            <Link href={params.closed === '1' ? '/inbox' : '/inbox?closed=1'}>
              <Button variant="secondary" size="sm">
                {params.closed === '1' ? 'Only open' : 'Closed too'}
              </Button>
            </Link>
            <Link href={params.templates ? '/inbox' : '/inbox?templates=1'}>
              <Button variant="secondary" size="sm">
                Templates
              </Button>
            </Link>
          </>
        }
      />

      {params.problem ? (
        <Alert tone="danger" className="mb-5">
          {params.problem}
        </Alert>
      ) : null}
      {params.sent ? (
        <Alert tone="success" className="mb-5">
          Sent. It is on the thread with what became of it.
        </Alert>
      ) : null}

      {params.templates ? (
        <Card className="mb-5">
          <CardHeader
            title="Templates that are messages"
            description="Written as the message a good service advisor would send, with the few facts that change filled from the job. Placeholders: {{firstName}}, {{vehicle}}, {{registration}}, {{jobNumber}}, {{amount}}, {{link}}, {{workshopName}}, {{workshopPhone}}."
          />
          <CardBody className="grid gap-4 lg:grid-cols-2">
            <ul className="grid gap-2">
              {templates.map((t) => (
                <li
                  key={t.key}
                  className="rounded-(--radius-md) border border-(--border) px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {t.name}
                      {!t.own ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">built in</span>
                      ) : null}
                    </span>
                    {t.own && t.id ? (
                      <form action={removeTemplate}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-[12px] underline">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-(--text-soft)">{t.body}</p>
                </li>
              ))}
            </ul>
            <form action={addTemplate} className="grid content-start gap-3">
              <Field label="Name">
                <Input name="name" placeholder="MOT reminder" required />
              </Field>
              <Field label="Channel">
                <Select name="channel" defaultValue="">
                  <option value="">Any</option>
                  <option value="SMS">Text</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </Select>
              </Field>
              <Field label="The message" hint="A sentence you would send as it is.">
                <Textarea
                  name="body"
                  rows={4}
                  required
                  placeholder="Hello {{firstName}}, the MOT on your {{vehicle}} is due next month. Reply here or ring {{workshopPhone}} to book it in. {{workshopName}}"
                />
              </Field>
              <div>
                <Button type="submit" variant="primary">
                  Save the template
                </Button>
              </div>
              {params.saved ? <p className="text-[12px] text-(--success)">Saved.</p> : null}
            </form>
          </CardBody>
        </Card>
      ) : null}

      {stray.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardHeader
            title={`${stray.length} message${stray.length === 1 ? '' : 's'} nobody could file`}
            description="No customer has that address. File each onto a job, or mark it dealt with."
          />
          <ul className="divide-y divide-(--border)">
            {stray.map((message) => (
              <li key={message.id} className="grid gap-2 px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="datum font-medium">{message.fromAddress}</span>
                  <span className="text-[11px] text-(--text-faint)">
                    {channelLabel(message.channel)} · {when(message.receivedAt, region.locale)}
                  </span>
                  {message.priority.label ? (
                    <Badge tone={message.priority.rank === 0 ? 'danger' : 'warning'} size="sm">
                      {message.priority.label}
                    </Badge>
                  ) : null}
                </div>
                <p className="leading-relaxed">{message.body}</p>
                <form action={file} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="messageId" value={message.id} />
                  <Input name="jobId" placeholder="Job id to file it on" className="max-w-xs" />
                  <Button type="submit" size="sm" variant="secondary">
                    File it
                  </Button>
                  <Button type="submit" name="done" value="1" size="sm">
                    Dealt with
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
            title={params.mine ? 'Assigned to me' : 'Every thread'}
            description={unread > 0 ? `${unread} unread` : 'Nothing unread'}
          />
          {threads.length === 0 ? (
            <EmptyState
              title="No conversations yet"
              description="A thread appears the first time a customer is written to, or writes in."
            />
          ) : (
            <ul className="max-h-[70vh] divide-y divide-(--border) overflow-y-auto">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/inbox?c=${t.id}${params.mine ? '&mine=1' : ''}${params.closed === '1' ? '&closed=1' : ''}`}
                    className={[
                      'block px-4 py-3 hover:bg-(--surface-sunk)',
                      t.id === selectedId ? 'bg-(--surface-sunk)' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[13px] ${t.unread ? 'font-semibold' : 'font-medium'}`}
                      >
                        {t.unread ? (
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-(--brand)" />
                        ) : null}
                        {t.customer?.displayName ?? 'Unknown'}
                      </span>
                      <span className="shrink-0 text-[11px] text-(--text-faint)">
                        {when(t.lastMessageAt, region.locale)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-(--text-soft)">
                      {t.job
                        ? `#${t.job.number} ${t.job.vehicle.make} ${t.job.vehicle.model}`
                        : 'General'}
                      {t.assignedTo ? ` · ${t.assignedTo.name}` : ''}
                      {t.status === 'CLOSED' ? ' · closed' : ''}
                    </p>
                    {t.preview ? (
                      <p className="mt-0.5 truncate text-[12px] text-(--text-faint)">
                        {t.preview.direction === 'in' ? '← ' : '→ '}
                        {t.preview.body}
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
              title={thread.customer?.displayName ?? 'Unknown customer'}
              description={
                thread.job
                  ? `Job #${thread.job.number} · ${thread.job.vehicle.make} ${thread.job.vehicle.model}${thread.job.vehicle.registration ? ` · ${thread.job.vehicle.registration}` : ''}`
                  : 'General, not about one job'
              }
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {thread.job ? (
                    <Link href={`/jobs/${thread.job.id}`}>
                      <Button size="sm" variant="secondary">
                        Open the job
                      </Button>
                    </Link>
                  ) : null}
                  {thread.customer ? (
                    <Link href={`/customers/${thread.customer.id}`}>
                      <Button size="sm" variant="secondary">
                        The customer
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
                      {thread.status === 'OPEN' ? 'Close' : 'Reopen'}
                    </Button>
                  </form>
                </div>
              }
            />
            <CardBody className="flex flex-wrap items-center gap-2 border-b border-(--border) text-[12px] text-(--text-soft)">
              <form action={assign} className="flex items-center gap-2">
                <input type="hidden" name="conversationId" value={thread.id} />
                <span>Assigned to</span>
                <Select
                  name="assigneeUserId"
                  defaultValue={thread.assignedTo?.id ?? ''}
                  className="h-8 w-44 text-[12px]"
                >
                  <option value="">nobody</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" variant="secondary">
                  Set
                </Button>
              </form>
            </CardBody>

            <CardBody className="grid max-h-[50vh] gap-3 overflow-y-auto">
              {thread.entries.length === 0 ? (
                <p className="text-[13px] text-(--text-faint)">Nothing on this thread yet.</p>
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
                        {entry.state}
                      </Badge>
                      {channelLabel(entry.channel)} · {when(entry.at, region.locale)}
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
                  {thread.customer?.displayName ?? 'This customer'} has no email address or mobile
                  number on file, so there is nowhere to write to.
                </p>
              ) : (
                <form action={reply} className="grid gap-3">
                  <input type="hidden" name="conversationId" value={thread.id} />
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="By">
                      <Select
                        name="channel"
                        defaultValue={thread.preferred ?? thread.channels[0]}
                        className="w-36"
                      >
                        {thread.channels.map((c) => (
                          <option key={c} value={c}>
                            {channelLabel(c)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Start from" className="min-w-[14rem]">
                      <div className="flex flex-wrap gap-1.5">
                        {templates.slice(0, 6).map((t) => (
                          <Link
                            key={t.key}
                            href={`/inbox?c=${thread.id}&t=${encodeURIComponent(t.key)}`}
                            className="rounded-(--radius-sm) border border-(--border) px-2 py-1 text-[12px] hover:bg-(--surface-sunk)"
                          >
                            {t.name}
                          </Link>
                        ))}
                        <Link
                          href={`/inbox?c=${thread.id}&pay=1`}
                          className="rounded-(--radius-sm) border border-(--brand) px-2 py-1 text-[12px] text-(--brand-text) hover:bg-(--brand-soft)"
                        >
                          Payment link
                        </Link>
                      </div>
                    </Field>
                  </div>
                  {draftProblem ? <Alert tone="warning">{draftProblem}</Alert> : null}
                  {thread.channels.includes('EMAIL') ? (
                    <Input
                      name="subject"
                      placeholder="Subject, for an email"
                      defaultValue={thread.subject ?? ''}
                    />
                  ) : null}
                  <Textarea
                    name="body"
                    rows={4}
                    required
                    defaultValue={draft}
                    placeholder={`Write to ${thread.customer?.displayName ?? 'the customer'}…`}
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
                      Send
                    </Button>
                  </div>
                  <p className="text-[11px] text-(--text-faint)">
                    Files are kept on the thread and named in the message; the email and text
                    providers do not carry them yet.
                  </p>
                </form>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <EmptyState title="Pick a conversation" description="Choose one on the left." />
          </Card>
        )}
      </div>
    </>
  );
}
