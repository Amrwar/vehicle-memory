import {
  type Action,
  type Comparison,
  type ConditionField,
  describeComparison,
  describeField,
  describeTrigger,
  fieldsFor,
  RuleError,
  type TriggerEvent,
} from '@carnet/core';
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
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  cancelAction,
  listRules,
  pendingActions,
  recentRuns,
  saveRule,
  setRuleActive,
} from '@/lib/automation';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Automation' };
export const dynamic = 'force-dynamic';

/** Every trigger, with the sentence the page shows for it. */
const TRIGGERS: TriggerEvent[] = [
  'job.completed',
  'job.awaiting_approval',
  'invoice.issued',
  'invoice.overdue',
  'booking.created',
  'booking.missed',
  'service.due',
  'vehicle.mot_due',
  'estimate.declined',
  'customer.lapsing',
];

const ACTION_KINDS: { kind: Action['kind']; label: string }[] = [
  { kind: 'send.email', label: 'Email them' },
  { kind: 'send.sms', label: 'Text them' },
  { kind: 'task.create', label: 'Create a task' },
  { kind: 'tag.add', label: 'Tag the customer' },
  { kind: 'booking.suggest', label: 'Offer a booking' },
];

const COMPARISONS: Comparison[] = ['gte', 'gt', 'eq', 'ne', 'lt', 'lte'];

/**
 * Writes a rule.
 *
 * The domain layer refuses anything that could never fire, and its complaint
 * is shown as it was written rather than translated into "invalid input". The
 * refusals are the useful part: they say which condition the trigger cannot
 * see, and why.
 */
async function create(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:read');

  const field = String(formData.get('field') ?? '');
  const value = Number(formData.get('value') ?? 0);

  const conditions =
    field && Number.isFinite(value)
      ? [
          {
            field: field as ConditionField,
            is: String(formData.get('is') ?? 'gte') as Comparison,
            value,
          },
        ]
      : [];

  try {
    await saveRule({
      orgId,
      userId: user.userId,
      name: String(formData.get('name') ?? '').trim(),
      trigger: String(formData.get('trigger') ?? 'job.completed') as TriggerEvent,
      conditions,
      actions: [
        {
          kind: String(formData.get('kind') ?? 'send.email') as Action['kind'],
          target: String(formData.get('target') ?? '').trim(),
          delayHours: Math.max(0, Number(formData.get('delayHours') ?? 0) || 0),
        },
      ],
      cooldownHours: Math.max(1, Number(formData.get('cooldownHours') ?? 24) || 24),
      isActive: formData.get('isActive') === 'on',
    });
  } catch (error) {
    const message = error instanceof RuleError ? error.message : 'That rule could not be saved.';

    redirect(`/automation?error=${encodeURIComponent(message)}`);
  }

  redirect('/automation?saved=1');
}

async function toggle(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:read');

  await setRuleActive({
    orgId,
    userId: user.userId,
    ruleId: String(formData.get('ruleId') ?? ''),
    isActive: formData.get('to') === 'on',
  });

  redirect('/automation');
}

async function stop(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:read');

  await cancelAction({
    orgId,
    userId: user.userId,
    actionId: String(formData.get('actionId') ?? ''),
  });

  redirect('/automation?stopped=1');
}

function when(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The rules, what they are about to do, and what they last did. FR-2200.
 *
 * A page for watching a machine rather than for driving one. Automation that
 * cannot be watched is automation nobody trusts, and an automation nobody
 * trusts gets switched off within the month — usually right after it does
 * something surprising that nobody could explain.
 *
 * So the three things on this page are, in order: what is queued, because that
 * is the only chance to stop it; what fired recently and what did not, because
 * "why did this rule send nothing" is the question people actually ask; and
 * the rules themselves, written as sentences rather than as a grid of fields.
 */
export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; stopped?: string }>;
}) {
  const { orgId, region } = await requireSession('settings:read');
  const { error, saved, stopped } = await searchParams;

  const [rules, queued, runs] = await Promise.all([
    listRules(orgId),
    pendingActions(orgId),
    recentRuns(orgId),
  ]);

  const active = rules.filter((rule) => rule.isActive);
  const overdue = queued.filter((action) => action.overdue);
  const blocked = runs.filter((run) => !run.fired);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Automation"
        description="Rules that act on their own, and the record of what they did"
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title="That rule was refused">
          {error}
        </Alert>
      ) : null}

      {saved ? (
        <Alert tone="success" className="mb-5" title="Saved">
          It will act the next time something sets it off.
        </Alert>
      ) : null}

      {stopped ? (
        <Alert tone="success" className="mb-5" title="Stopped">
          That action will not go out.
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile label="Rules on" value={active.length} note={`${rules.length} written`} />
        <StatTile
          label="Queued"
          value={queued.length}
          note="Waiting for a delay to pass"
          tone={queued.length > 0 ? 'brand' : 'neutral'}
        />
        <StatTile
          label="Past due"
          value={overdue.length}
          tone={overdue.length > 0 ? 'warning' : 'neutral'}
          note="Should already have gone"
        />
        <StatTile
          label="Held back"
          value={blocked.length}
          note="Fired, then a condition stopped it"
        />
      </StatRow>

      {active.length === 0 && rules.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">Every rule is switched off.</strong> Nothing on this
            page will happen. A rule that is written but inactive looks identical, from the
            dashboard, to one that is quietly working.
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="About to happen"
          description="Soonest first. Until it goes out it can still be stopped."
        />
        {queued.length === 0 ? (
          <EmptyState
            title="Nothing queued"
            description="No rule is holding an action waiting for its delay to pass."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Due</Th>
                  <Th>Rule</Th>
                  <Th>Action</Th>
                  <Th>About</Th>
                  <Th>&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {queued.map((action) => (
                  <Tr key={action.id}>
                    <Td>
                      <span className={action.overdue ? 'font-medium text-(--warning)' : ''}>
                        {when(action.dueAt, region.locale)}
                      </span>
                    </Td>
                    <Td className="font-medium">{action.ruleName}</Td>
                    <Td className="text-(--text-soft)">
                      {action.kind.replace('.', ' ')} &mdash; {action.target}
                    </Td>
                    <Td className="text-(--text-faint)">{action.subjectType}</Td>
                    <Td>
                      <form action={stop}>
                        <input type="hidden" name="actionId" value={action.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Stop it
                        </Button>
                      </form>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="Rules"
          description="Each one written as a sentence, because that is what it is."
        />
        {rules.length === 0 ? (
          <EmptyState
            title="No rules yet"
            description="A rule is a trigger, a condition and an action: when a job is completed and the total is over £100, email a thank-you the next day."
          />
        ) : (
          <ul className="divide-y divide-(--border-soft)">
            {rules.map((rule) => (
              <li key={rule.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rule.name}</span>
                  <Badge tone={rule.isActive ? 'success' : 'neutral'} size="sm">
                    {rule.isActive ? 'on' : 'off'}
                  </Badge>
                  <form action={toggle} className="contents">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="to" value={rule.isActive ? 'off' : 'on'} />
                    <Button type="submit" size="sm" variant="ghost">
                      {rule.isActive ? 'Switch off' : 'Switch on'}
                    </Button>
                  </form>
                  <span className="text-[11px] text-(--text-faint)">
                    on {describeTrigger(rule.trigger)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-(--text-soft)">
                  {rule.sentence}
                </p>
                <p className="mt-1 text-[11px] text-(--text-faint)">
                  {rule.runCount === 0
                    ? 'Never triggered.'
                    : `Triggered ${rule.runCount} time${rule.runCount === 1 ? '' : 's'}, last on ${
                        rule.lastRunAt ? when(rule.lastRunAt, region.locale) : 'an unknown date'
                      }${rule.lastRunBlocked ? ', and held back' : ''}.`}{' '}
                  Will not act on the same subject twice within {rule.cooldownHours} hours.
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Write a rule"
          description="One trigger, one condition if you want one, one action. Anything that could never fire is refused here rather than going quiet later."
        />
        <CardBody>
          <form action={create} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Call it" htmlFor="name" required>
                <Input id="name" name="name" required placeholder="Thank the customer" />
              </Field>

              <Field label="When" htmlFor="trigger" hint="What sets it off.">
                <Select id="trigger" name="trigger" defaultValue="job.completed">
                  {TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {describeTrigger(trigger)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Only if" htmlFor="field" hint="Leave blank to act every time.">
                <Select id="field" name="field" defaultValue="">
                  <option value="">No condition</option>
                  {/* Every field any trigger can see. The domain layer refuses
                      a pairing the chosen trigger cannot know about, and says
                      which one, rather than this list guessing. */}
                  {[...new Set(TRIGGERS.flatMap((trigger) => fieldsFor(trigger)))].map((field) => (
                    <option key={field} value={field}>
                      {describeField(field)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Is" htmlFor="is">
                <Select id="is" name="is" defaultValue="gte">
                  {COMPARISONS.map((comparison) => (
                    <option key={comparison} value={comparison}>
                      {describeComparison(comparison)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="This much" htmlFor="value" hint="Money in pence.">
                <Input id="value" name="value" type="number" inputMode="numeric" defaultValue={0} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Then" htmlFor="kind">
                <Select id="kind" name="kind" defaultValue="send.email">
                  {ACTION_KINDS.map((action) => (
                    <option key={action.kind} value={action.kind}>
                      {action.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Saying" htmlFor="target" required>
                <Input id="target" name="target" required placeholder="Thanks for your visit" />
              </Field>

              <Field
                label="After how many hours"
                htmlFor="delayHours"
                hint="0 sends it straight away."
              >
                <Input
                  id="delayHours"
                  name="delayHours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={24}
                />
              </Field>
            </div>

            <div className="grid items-end gap-4 sm:grid-cols-2">
              <Field
                label="Leave the same person alone for"
                htmlFor="cooldownHours"
                hint="Hours. The floor is one, and it is the database that holds it."
              >
                <Input
                  id="cooldownHours"
                  name="cooldownHours"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={720}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="isActive" defaultChecked />
                  Switch it on now
                </label>
                <Button type="submit">Save the rule</Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="What happened"
          description="Including the times a rule decided not to act, which is the half nobody records."
        />
        {runs.length === 0 ? (
          <EmptyState
            title="Nothing has triggered yet"
            description="Runs appear here as soon as a job, an invoice or a booking sets one off."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Rule</Th>
                  <Th>Outcome</Th>
                  <Th>Why</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <Tr key={run.id}>
                    <Td className="text-(--text-soft)">{when(run.firedAt, region.locale)}</Td>
                    <Td className="font-medium">{run.ruleName}</Td>
                    <Td>
                      {run.fired ? (
                        <Badge tone="success" size="sm">
                          {run.actionCount} queued
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          held back
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-(--text-soft)">{run.reason ?? 'Everything held.'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
