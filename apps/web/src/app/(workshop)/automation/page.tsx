import { describeTrigger } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';

import { listRules, pendingActions, recentRuns } from '@/lib/automation';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Automation' };
export const dynamic = 'force-dynamic';

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
function when(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AutomationPage() {
  const { orgId } = await requireSession('settings:read');

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
                </tr>
              </thead>
              <tbody>
                {queued.map((action) => (
                  <Tr key={action.id}>
                    <Td>
                      <span className={action.overdue ? 'font-medium text-(--warning)' : ''}>
                        {when(action.dueAt)}
                      </span>
                    </Td>
                    <Td className="font-medium">{action.ruleName}</Td>
                    <Td className="text-(--text-soft)">
                      {action.kind.replace('.', ' ')} &mdash; {action.target}
                    </Td>
                    <Td className="text-(--text-faint)">{action.subjectType}</Td>
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
                        rule.lastRunAt ? when(rule.lastRunAt) : 'an unknown date'
                      }${rule.lastRunBlocked ? ', and held back' : ''}.`}{' '}
                  Will not act on the same subject twice within {rule.cooldownHours} hours.
                </p>
              </li>
            ))}
          </ul>
        )}
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
                    <Td className="text-(--text-soft)">{when(run.firedAt)}</Td>
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
