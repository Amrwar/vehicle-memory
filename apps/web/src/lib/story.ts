import {
  howTheStoryReads,
  type JobStatus,
  type StoryEntry,
  tellTheStory,
  type TheStory,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { conversationForJob } from './conversations';

/**
 * The story of one job, from the records it already carries. Phase 99.
 *
 * "A unified communication timeline per job, so every job is reconstructable
 * minute by minute." The job page shows each of these in its own card: the
 * status moves in one, the conversation in another, the estimate and its
 * approval in a third, the clock, the parts, the checks, the notes, the
 * photos, the bill, the money, the keys, the follow-ups. Somebody answering
 * "why did this take nine days" or "who told the customer what, and when"
 * has to hold eleven cards' dates in their head. This is the same records in
 * one order.
 *
 * **Nothing is stored and nothing is inferred.** Every entry is a row with a
 * timestamp. Where a record carries its actor — a status move, a note, a
 * clock, a check — the actor is named. Where it does not — an estimate's
 * `sentAt`, an invoice's `issuedAt`, the check-in — the audit log's row for
 * that act supplies the name, and where the audit log has no row either, the
 * entry says what happened and not who. A story that guessed who sent the
 * estimate would be worth less than one that said it was sent.
 *
 * **Sides.** The workshop, the customer, or the product on nobody's behalf.
 * A message the product sent on a schedule is `system`, because a reader
 * asking "did anybody actually speak to this customer" needs the reminder
 * the sweeper sent counted apart from the call a person made.
 *
 * Every sentence travels as a key and its values (ADR-0019). `verify-story`
 * reads the keys out of this file and core's, and looks each up in French
 * and Arabic.
 */

/** Audit actions that are the only record of their act. */
const AUDIT_ONLY = new Set([
  'job.checked_in',
  'job.checked_out',
  'job.summary_sent',
  'job.comeback_marked',
  'estimate.link_withdrawn',
  'estimate.extra_work',
]);

/** Audit actions that name the actor for a record that does not. */
const AUDIT_NAMES = new Set(['estimate.sent', 'invoice.issued', 'job.created']);

const EXCERPT = 160;

function excerpt(text: string | null | undefined): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT - 1)}…` : flat;
}

export interface Story {
  job: {
    id: string;
    number: number;
    what: string;
    status: JobStatus;
    customer: string;
    vehicle: string;
    registration: string | null;
  };
  story: TheStory;
  headline: ReturnType<typeof howTheStoryReads>;
}

export async function storyOf(
  orgId: string,
  jobId: string,
  timezone: string,
): Promise<Story | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      id: true,
      number: true,
      shortDescription: true,
      status: true,
      createdAt: true,
      completedAt: true,
      collectedAt: true,
      customer: { select: { displayName: true } },
      vehicle: { select: { make: true, model: true, registration: true } },
      statusEvents: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          toStatus: true,
          note: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
      notes: {
        select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
      },
      attachments: { select: { id: true, kind: true, createdAt: true } },
      timeEntries: {
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          autoClosed: true,
          user: { select: { name: true } },
        },
      },
      qualityChecks: {
        select: {
          id: true,
          passed: true,
          createdAt: true,
          checkedBy: { select: { name: true } },
        },
      },
      inspections: {
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          performedBy: { select: { name: true } },
        },
      },
      estimates: {
        select: {
          id: true,
          version: true,
          total: true,
          currency: true,
          sentAt: true,
          approvals: {
            select: {
              id: true,
              decision: true,
              approvedTotal: true,
              declinedTotal: true,
              approvedByName: true,
              ip: true,
              createdAt: true,
            },
          },
        },
      },
      invoices: {
        select: {
          id: true,
          number: true,
          total: true,
          issuedAt: true,
          status: true,
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              receivedAt: true,
              recordedBy: { select: { name: true } },
            },
          },
        },
      },
      partLines: {
        select: {
          id: true,
          description: true,
          createdAt: true,
          substitutedFor: { select: { name: true } },
          substitutionConfirmedAt: true,
          substitutionConfirmedBy: { select: { name: true } },
        },
      },
      sublets: {
        select: {
          id: true,
          description: true,
          createdAt: true,
          doneAt: true,
          supplier: { select: { name: true } },
        },
      },
      followUps: {
        select: {
          id: true,
          note: true,
          dueAt: true,
          createdAt: true,
          completedAt: true,
          completedBy: { select: { name: true } },
        },
      },
      keyEvents: {
        select: { id: true, action: true, hook: true, at: true, by: { select: { name: true } } },
      },
    },
  });
  if (!job) return null;

  const entityIds = [
    job.id,
    ...job.estimates.map((one) => one.id),
    ...job.invoices.map((one) => one.id),
  ];

  const [conversation, audit] = await Promise.all([
    conversationForJob(orgId, job.id),
    // bounded: the audit rows about one job and its documents.
    prisma.auditLog.findMany({
      where: { orgId, entityId: { in: entityIds } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        action: true,
        entityId: true,
        createdAt: true,
        after: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  const namedBy = new Map<string, string>();
  for (const row of audit) {
    if (AUDIT_NAMES.has(row.action) && row.actor?.name) {
      namedBy.set(`${row.action}:${row.entityId}`, row.actor.name);
    }
  }

  const entries: StoryEntry[] = [];
  const href = `/jobs/${job.id}`;

  entries.push({
    id: `opened:${job.id}`,
    at: job.createdAt,
    kind: 'opened',
    side: 'us',
    who: namedBy.get(`job.created:${job.id}`) ?? null,
    what: { key: 'Job opened' },
    href,
  });

  for (const event of job.statusEvents) {
    entries.push({
      id: `status:${event.id}`,
      at: event.createdAt,
      kind: 'status',
      side: 'us',
      who: event.actor?.name ?? null,
      what: null,
      status: event.toStatus as JobStatus,
      detail: excerpt(event.note),
      href,
    });
  }

  for (const key of job.keyEvents) {
    entries.push({
      id: `key:${key.id}`,
      at: key.at,
      kind: 'key',
      side: 'us',
      who: key.by?.name ?? null,
      what:
        key.action === 'HUNG'
          ? { key: 'Keys hung on hook {hook}', vars: { hook: key.hook ?? '?' } }
          : key.action === 'TAKEN'
            ? { key: 'Keys taken off the hook' }
            : key.action === 'RETURNED'
              ? { key: 'Keys returned to the hook' }
              : { key: 'Keys handed to the customer' },
      href: `${href}#keys`,
    });
  }

  for (const row of audit) {
    if (!AUDIT_ONLY.has(row.action)) continue;
    const common = {
      id: `audit:${row.id}`,
      at: row.createdAt,
      side: 'us' as const,
      who: row.actor?.name ?? null,
      href,
    };
    switch (row.action) {
      case 'job.checked_in':
        entries.push({ ...common, kind: 'checked-in', what: { key: 'Car checked in' } });
        break;
      case 'job.checked_out':
        entries.push({ ...common, kind: 'checked-out', what: { key: 'Car checked out' } });
        break;
      case 'job.summary_sent':
        entries.push({
          ...common,
          kind: 'summary-sent',
          what: { key: 'Summary of the work sent to the customer' },
        });
        break;
      case 'job.comeback_marked':
        entries.push({
          ...common,
          kind: 'comeback',
          what: { key: 'Marked as a comeback of an earlier job' },
        });
        break;
      case 'estimate.link_withdrawn':
        entries.push({
          ...common,
          kind: 'estimate-withdrawn',
          what: { key: 'The estimate’s link was withdrawn' },
        });
        break;
      case 'estimate.extra_work':
        entries.push({
          ...common,
          kind: 'extra-work',
          what: { key: 'Extra work found and put to the customer' },
        });
        break;
      default:
        break;
    }
  }

  for (const inspection of job.inspections) {
    entries.push({
      id: `inspection-started:${inspection.id}`,
      at: inspection.startedAt,
      kind: 'inspection-started',
      side: 'us',
      who: inspection.performedBy?.name ?? null,
      what: { key: 'Inspection started' },
      href: `/inspections/${inspection.id}`,
    });
    if (inspection.completedAt) {
      entries.push({
        id: `inspection-completed:${inspection.id}`,
        at: inspection.completedAt,
        kind: 'inspection-completed',
        side: 'us',
        who: inspection.performedBy?.name ?? null,
        what: { key: 'Inspection completed' },
        href: `/inspections/${inspection.id}`,
      });
    }
  }

  for (const estimate of job.estimates) {
    if (estimate.sentAt) {
      entries.push({
        id: `estimate-sent:${estimate.id}`,
        at: estimate.sentAt,
        kind: 'estimate-sent',
        side: 'us',
        who: namedBy.get(`estimate.sent:${estimate.id}`) ?? null,
        what: { key: 'Estimate v{version} sent', vars: { version: estimate.version } },
        amount: Number(estimate.total),
        href: `/estimates/${estimate.id}`,
      });
    }
    for (const approval of estimate.approvals) {
      // A decision with a source address was made on the link, by the
      // customer; one without was taken in person and keyed in by us, but it
      // is still the customer's decision and is counted as theirs.
      entries.push({
        id: `estimate-decided:${approval.id}`,
        at: approval.createdAt,
        kind: 'estimate-decided',
        side: 'customer',
        who: approval.approvedByName,
        what: {
          key: approval.ip
            ? approval.decision === 'APPROVED'
              ? 'Estimate v{version} approved'
              : approval.decision === 'DECLINED'
                ? 'Estimate v{version} declined'
                : 'Estimate v{version} approved in part'
            : approval.decision === 'APPROVED'
              ? 'Estimate v{version} approved in person'
              : approval.decision === 'DECLINED'
                ? 'Estimate v{version} declined in person'
                : 'Estimate v{version} approved in part, in person',
          vars: { version: estimate.version },
        },
        amount: Number(approval.approvedTotal),
        href: `/estimates/${estimate.id}`,
      });
    }
  }

  if (conversation) {
    for (const message of conversation.entries) {
      if (message.direction === 'out') {
        const automated = !message.by;
        entries.push({
          id: `message-out:${message.id}`,
          at: message.at,
          kind: 'message-out',
          side: automated ? 'system' : 'us',
          who: message.by,
          what:
            message.state === 'failed'
              ? { key: '{channel} failed to send', vars: { channel: message.channel } }
              : automated
                ? {
                    key: 'The product sent {channel}',
                    vars: { channel: message.channel },
                  }
                : { key: 'Sent {channel}', vars: { channel: message.channel } },
          detail: excerpt(message.subject ? `${message.subject} — ${message.body}` : message.body),
          href: `${href}#conversation`,
        });
      } else {
        entries.push({
          id: `message-in:${message.id}`,
          at: message.at,
          kind: 'message-in',
          side: 'customer',
          who: conversation.customer?.displayName ?? null,
          what: { key: 'The customer sent {channel}', vars: { channel: message.channel } },
          detail: excerpt(message.body),
          href: `${href}#conversation`,
        });
      }
    }
  }

  for (const clock of job.timeEntries) {
    entries.push({
      id: `clock-on:${clock.id}`,
      at: clock.startedAt,
      kind: 'clock-on',
      side: 'us',
      who: clock.user.name,
      what: { key: 'Clocked on' },
      href: `${href}#clock`,
    });
    if (clock.endedAt) {
      const minutes = Math.round((clock.endedAt.getTime() - clock.startedAt.getTime()) / 60_000);
      entries.push({
        id: `clock-off:${clock.id}`,
        at: clock.endedAt,
        kind: 'clock-off',
        side: clock.autoClosed ? 'system' : 'us',
        who: clock.user.name,
        what: clock.autoClosed
          ? {
              key: 'Clock closed by the overnight sweeper after {minutes} minutes',
              vars: { minutes },
            }
          : { key: 'Clocked off after {minutes} minutes', vars: { minutes } },
        href: `${href}#clock`,
      });
    }
  }

  for (const line of job.partLines) {
    entries.push({
      id: `part-requested:${line.id}`,
      at: line.createdAt,
      kind: 'part-requested',
      side: 'us',
      who: null,
      what: { key: 'Part added: {part}', vars: { part: line.description } },
      href: `${href}#parts`,
    });
    if (line.substitutionConfirmedAt && line.substitutedFor) {
      entries.push({
        id: `part-substituted:${line.id}`,
        at: line.substitutionConfirmedAt,
        kind: 'part-substituted',
        side: 'us',
        who: line.substitutionConfirmedBy?.name ?? null,
        what: {
          key: '{part} fitted instead of {original}',
          vars: { part: line.description, original: line.substitutedFor.name },
        },
        href: `${href}#parts`,
      });
    }
  }

  for (const sublet of job.sublets) {
    entries.push({
      id: `sublet-ordered:${sublet.id}`,
      at: sublet.createdAt,
      kind: 'sublet-ordered',
      side: 'us',
      who: null,
      what: {
        key: '{work} sent out to {supplier}',
        vars: { work: sublet.description, supplier: sublet.supplier.name },
      },
      href: `${href}#sublets`,
    });
    if (sublet.doneAt) {
      entries.push({
        id: `sublet-done:${sublet.id}`,
        at: sublet.doneAt,
        kind: 'sublet-done',
        side: 'us',
        who: null,
        what: {
          key: '{work} back from {supplier}',
          vars: { work: sublet.description, supplier: sublet.supplier.name },
        },
        href: `${href}#sublets`,
      });
    }
  }

  for (const check of job.qualityChecks) {
    entries.push({
      id: `quality:${check.id}`,
      at: check.createdAt,
      kind: 'quality',
      side: 'us',
      who: check.checkedBy.name,
      what: check.passed ? { key: 'Quality check passed' } : { key: 'Quality check failed' },
      href: `${href}#quality`,
    });
  }

  for (const note of job.notes) {
    entries.push({
      id: `note:${note.id}`,
      at: note.createdAt,
      kind: 'note',
      side: 'us',
      who: note.author?.name ?? null,
      what: { key: 'Note' },
      detail: excerpt(note.body),
      href: `${href}#notes`,
    });
  }

  for (const attachment of job.attachments) {
    entries.push({
      id: `photo:${attachment.id}`,
      at: attachment.createdAt,
      kind: 'photo',
      side: 'us',
      who: null,
      what:
        attachment.kind === 'PHOTO'
          ? { key: 'Photo added' }
          : attachment.kind === 'VIDEO'
            ? { key: 'Video added' }
            : { key: 'Document added' },
      href: `${href}#attachments`,
    });
  }

  if (job.completedAt) {
    entries.push({
      id: `completed:${job.id}`,
      at: job.completedAt,
      kind: 'completed',
      side: 'us',
      who: null,
      what: { key: 'Work completed' },
      href,
    });
  }

  for (const invoice of job.invoices) {
    if (invoice.issuedAt && invoice.status !== 'VOID') {
      entries.push({
        id: `invoice-issued:${invoice.id}`,
        at: invoice.issuedAt,
        kind: 'invoice-issued',
        side: 'us',
        who: namedBy.get(`invoice.issued:${invoice.id}`) ?? null,
        what: { key: 'Invoice {number} issued', vars: { number: invoice.number } },
        amount: Number(invoice.total),
        href: `/invoices/${invoice.id}`,
      });
    }
    for (const payment of invoice.payments) {
      const online = payment.method === 'ONLINE';
      entries.push({
        id: `payment:${payment.id}`,
        at: payment.receivedAt,
        kind: 'payment',
        side: online ? 'customer' : 'us',
        who: payment.recordedBy?.name ?? null,
        what: online
          ? { key: 'Paid online' }
          : {
              key: 'Payment taken by {method}',
              vars: { method: payment.method },
            },
        amount: Number(payment.amount),
        href: `/invoices/${invoice.id}`,
      });
    }
  }

  if (job.collectedAt) {
    entries.push({
      id: `collected:${job.id}`,
      at: job.collectedAt,
      kind: 'collected',
      side: 'customer',
      who: job.customer.displayName,
      what: { key: 'Car collected' },
      href,
    });
  }

  for (const followUp of job.followUps) {
    entries.push({
      id: `followup-set:${followUp.id}`,
      at: followUp.createdAt,
      kind: 'followup-set',
      side: 'us',
      who: null,
      what: { key: 'Follow-up set' },
      detail: excerpt(followUp.note),
      href: `${href}#followup`,
    });
    if (followUp.completedAt) {
      entries.push({
        id: `followup-done:${followUp.id}`,
        at: followUp.completedAt,
        kind: 'followup-done',
        side: 'us',
        who: followUp.completedBy?.name ?? null,
        what: { key: 'Follow-up done' },
        href: `${href}#followup`,
      });
    }
  }

  const story = tellTheStory(entries, timezone);

  return {
    job: {
      id: job.id,
      number: job.number,
      what: job.shortDescription,
      status: job.status as JobStatus,
      customer: job.customer.displayName,
      vehicle: `${job.vehicle.make} ${job.vehicle.model}`.trim(),
      registration: job.vehicle.registration,
    },
    story,
    headline: howTheStoryReads(story.summary),
  };
}
