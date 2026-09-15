import {
  type Action,
  type Comparison,
  type ConditionField,
  describeComparison,
  describeDelay,
  describeField,
  describeTrigger,
  fieldsFor,
  msg,
  type Rule,
  RuleError,
  type Translator,
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
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Automation') };
}
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
  { kind: 'send.email', label: msg('Email them') },
  { kind: 'send.sms', label: msg('Text them') },
  { kind: 'task.create', label: msg('Create a task') },
  { kind: 'tag.add', label: msg('Tag the customer') },
  { kind: 'booking.suggest', label: msg('Offer a booking') },
];

const COMPARISONS: Comparison[] = ['gte', 'gt', 'eq', 'ne', 'lt', 'lte'];

/**
 * A rule as a sentence in the reader's language, built from its parts, as
 * describeRule builds it in English. Phase 40.5.
 */
function ruleSentence(rule: Rule, t: Translator): string {
  const actions = rule.actions
    .map((action) => {
      const when = t(describeDelay(action.delayHours));
      switch (action.kind) {
        case 'send.email':
          return t('email them "{target}" {when}', { target: action.target, when });
        case 'send.sms':
          return t('text them "{target}" {when}', { target: action.target, when });
        case 'task.create':
          return t('create a task "{target}" {when}', { target: action.target, when });
        case 'tag.add':
          return t('tag them "{target}"', { target: action.target });
        case 'booking.suggest':
          return t('offer them a booking {when}', { when });
      }
    })
    .join(', ');
  const trigger = t(describeTrigger(rule.trigger));
  if (rule.conditions.length === 0) {
    return t('When {trigger}, {actions}.', { trigger, actions });
  }
  const conditions = rule.conditions
    .map((condition) =>
      t('{field} {comparison} {value}', {
        field: t(describeField(condition.field)),
        comparison: t(describeComparison(condition.is)),
        value: condition.value,
      }),
    )
    .join(', ');
  return t('When {trigger} and {conditions}, {actions}.', { trigger, conditions, actions });
}

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

  const { orgId, user } = await requireSession('settings:write');

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

  const { orgId, user } = await requireSession('settings:write');

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

  const { orgId, user } = await requireSession('settings:write');

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
  const t = await tFor();

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
        eyebrow={t('Customers')}
        title={t('Automation')}
        description={t('Rules that act on their own, and the record of what they did')}
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title={t('That rule was refused')}>
          {t(error)}
        </Alert>
      ) : null}

      {saved ? (
        <Alert tone="success" className="mb-5" title={t('Saved')}>
          {t('It will act the next time something sets it off.')}
        </Alert>
      ) : null}

      {stopped ? (
        <Alert tone="success" className="mb-5" title={t('Stopped')}>
          {t('That action will not go out.')}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Rules on')}
          value={active.length}
          note={t('{count} written', { count: rules.length })}
        />
        <StatTile
          label={t('Queued')}
          value={queued.length}
          note={t('Waiting for a delay to pass')}
          tone={queued.length > 0 ? 'brand' : 'neutral'}
        />
        <StatTile
          label={t('Past due')}
          value={overdue.length}
          tone={overdue.length > 0 ? 'warning' : 'neutral'}
          note={t('Should already have gone')}
        />
        <StatTile
          label={t('Held back')}
          value={blocked.length}
          note={t('Fired, then a condition stopped it')}
        />
      </StatRow>

      {active.length === 0 && rules.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">{t('Every rule is switched off.')}</strong>{' '}
            {t(
              'Nothing on this page will happen. A rule that is written but inactive looks identical, from the dashboard, to one that is quietly working.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('About to happen')}
          description={t('Soonest first. Until it goes out it can still be stopped.')}
        />
        {queued.length === 0 ? (
          <EmptyState
            title={t('Nothing queued')}
            description={t('No rule is holding an action waiting for its delay to pass.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Due')}</Th>
                  <Th>{t('Rule')}</Th>
                  <Th>{t('Action')}</Th>
                  <Th>{t('About')}</Th>
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
                      {t(
                        ACTION_KINDS.find((known) => known.kind === action.kind)?.label ??
                          action.kind.replace('.', ' '),
                      )}{' '}
                      &mdash; {action.target}
                    </Td>
                    <Td className="text-(--text-faint)">{t(action.subjectType)}</Td>
                    <Td>
                      <form action={stop}>
                        <input type="hidden" name="actionId" value={action.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {t('Stop it')}
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
          title={t('Rules')}
          description={t('Each one written as a sentence, because that is what it is.')}
        />
        {rules.length === 0 ? (
          <EmptyState
            title={t('No rules yet')}
            description={t(
              'A rule is a trigger, a condition and an action: when a job is completed and the total is over £100, email a thank-you the next day.',
            )}
          />
        ) : (
          <ul className="divide-y divide-(--border-soft)">
            {rules.map((rule) => (
              <li key={rule.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rule.name}</span>
                  <Badge tone={rule.isActive ? 'success' : 'neutral'} size="sm">
                    {rule.isActive ? t('on') : t('off')}
                  </Badge>
                  <form action={toggle} className="contents">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="to" value={rule.isActive ? 'off' : 'on'} />
                    <Button type="submit" size="sm" variant="ghost">
                      {rule.isActive ? t('Switch off') : t('Switch on')}
                    </Button>
                  </form>
                  <span className="text-[11px] text-(--text-faint)">
                    {t('on {trigger}', { trigger: t(describeTrigger(rule.trigger)) })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-(--text-soft)">
                  {ruleSentence(rule, t)}
                </p>
                <p className="mt-1 text-[11px] text-(--text-faint)">
                  {rule.runCount === 0
                    ? t('Never triggered.')
                    : t(
                        rule.runCount === 1
                          ? rule.lastRunBlocked
                            ? 'Triggered once, last on {date}, and held back.'
                            : 'Triggered once, last on {date}.'
                          : rule.lastRunBlocked
                            ? 'Triggered {count} times, last on {date}, and held back.'
                            : 'Triggered {count} times, last on {date}.',
                        {
                          count: rule.runCount,
                          date: rule.lastRunAt
                            ? when(rule.lastRunAt, region.locale)
                            : t('an unknown date'),
                        },
                      )}{' '}
                  {t('Will not act on the same subject twice within {hours} hours.', {
                    hours: rule.cooldownHours,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          title={t('Write a rule')}
          description={t(
            'One trigger, one condition if you want one, one action. Anything that could never fire is refused here rather than going quiet later.',
          )}
        />
        <CardBody>
          <form action={create} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('Call it')} htmlFor="name" required>
                <Input id="name" name="name" required placeholder={t('Thank the customer')} />
              </Field>

              <Field label={t('When')} htmlFor="trigger" hint={t('What sets it off.')}>
                <Select id="trigger" name="trigger" defaultValue="job.completed">
                  {TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {t(describeTrigger(trigger))}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label={t('Only if')}
                htmlFor="field"
                hint={t('Leave blank to act every time.')}
              >
                <Select id="field" name="field" defaultValue="">
                  <option value="">{t('No condition')}</option>
                  {/* Every field any trigger can see. The domain layer refuses
                      a pairing the chosen trigger cannot know about, and says
                      which one, rather than this list guessing. */}
                  {[...new Set(TRIGGERS.flatMap((trigger) => fieldsFor(trigger)))].map((field) => (
                    <option key={field} value={field}>
                      {t(describeField(field))}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('Is')} htmlFor="is">
                <Select id="is" name="is" defaultValue="gte">
                  {COMPARISONS.map((comparison) => (
                    <option key={comparison} value={comparison}>
                      {t(describeComparison(comparison))}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('This much')} htmlFor="value" hint={t('Money in pence.')}>
                <Input id="value" name="value" type="number" inputMode="numeric" defaultValue={0} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('Then')} htmlFor="kind">
                <Select id="kind" name="kind" defaultValue="send.email">
                  {ACTION_KINDS.map((action) => (
                    <option key={action.kind} value={action.kind}>
                      {t(action.label)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('Saying')} htmlFor="target" required>
                <Input
                  id="target"
                  name="target"
                  required
                  placeholder={t('Thanks for your visit')}
                />
              </Field>

              <Field
                label={t('After how many hours')}
                htmlFor="delayHours"
                hint={t('0 sends it straight away.')}
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
                label={t('Leave the same person alone for')}
                htmlFor="cooldownHours"
                hint={t('Hours. The floor is one, and it is the database that holds it.')}
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
                  {t('Switch it on now')}
                </label>
                <Button type="submit">{t('Save the rule')}</Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('What happened')}
          description={t(
            'Including the times a rule decided not to act, which is the half nobody records.',
          )}
        />
        {runs.length === 0 ? (
          <EmptyState
            title={t('Nothing has triggered yet')}
            description={t(
              'Runs appear here as soon as a job, an invoice or a booking sets one off.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('When')}</Th>
                  <Th>{t('Rule')}</Th>
                  <Th>{t('Outcome')}</Th>
                  <Th>{t('Why')}</Th>
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
                          {t('{count} queued', { count: run.actionCount })}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          {t('held back')}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {run.reason ? t(run.reason) : t('Everything held.')}
                    </Td>
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
