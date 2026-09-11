import { describe, expect, it } from 'vitest';

import { describeAuditAction, diffOf, humaniseField, lifeOf, type AuditEntry } from './life';

const at = (iso: string) => new Date(`${iso}T09:00:00`);

function entry(overrides: Partial<AuditEntry> & Pick<AuditEntry, 'action'>): AuditEntry {
  return {
    id: `a-${Math.random()}`,
    entityType: 'Estimate',
    entityId: 'est-1',
    actorName: 'Sara Whitfield',
    at: at('2026-09-01'),
    before: null,
    after: null,
    ip: null,
    userAgent: null,
    ...overrides,
  };
}

describe('humaniseField', () => {
  it('reads a column as a phrase', () => {
    expect(humaniseField('shortDescription')).toBe('Short description');
    expect(humaniseField('estimate.total')).toBe('Estimate total');
    expect(humaniseField('amount_paid')).toBe('Amount paid');
  });
});

describe('diffOf', () => {
  it('shows only what actually moved', () => {
    // Forty unchanged fields bury the one that moved, which is the whole
    // reason somebody opened the entry.
    const changes = diffOf(
      { total: 100, status: 'DRAFT', currency: 'GBP' },
      { total: 250, status: 'SENT', currency: 'GBP' },
    );

    expect(changes).toHaveLength(2);
    expect(changes.map((change) => change.field)).toEqual(['Status', 'Total']);
  });

  it('marks a field that appeared and one that went', () => {
    const changes = diffOf({ note: 'x' }, { reason: 'y' });

    expect(changes.find((change) => change.field === 'Reason')!.added).toBe(true);
    expect(changes.find((change) => change.field === 'Note')!.removed).toBe(true);
  });

  it('reads into nested objects', () => {
    const changes = diffOf({ customer: { name: 'A' } }, { customer: { name: 'B' } });

    expect(changes).toHaveLength(1);
    expect(changes[0]!.field).toBe('Customer name');
  });

  it('never puts a secret on the screen', () => {
    // Audit payloads are written by many callers over years. The day one
    // includes a token is the day this page would publish it.
    const changes = diffOf(
      { passwordHash: 'old', tokenHash: 'aaa', apiKey: 'k1' },
      { passwordHash: 'new', tokenHash: 'bbb', apiKey: 'k2' },
    );

    expect(changes).toHaveLength(0);
  });

  it('redacts a secret however it is spelled', () => {
    const changes = diffOf({ access_key_id: 'a' }, { access_key_id: 'b' });
    expect(changes).toHaveLength(0);
  });

  it('redacts a secret nested deep inside', () => {
    const changes = diffOf(
      { config: { smtp: { secret: 'a' }, host: 'x' } },
      { config: { smtp: { secret: 'b' }, host: 'y' } },
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]!.field).toBe('Config host');
  });

  it('says how many rather than dumping an array', () => {
    const changes = diffOf({ lines: [1, 2] }, { lines: [1, 2, 3] });

    expect(changes[0]!.from).toBe('2 items');
    expect(changes[0]!.to).toBe('3 items');
  });

  it('cuts a long string rather than flooding the page', () => {
    const changes = diffOf({ note: 'a' }, { note: 'b'.repeat(400) });
    expect(changes[0]!.to!.length).toBeLessThanOrEqual(160);
  });

  it('has nothing to say when there is nothing to compare', () => {
    expect(diffOf(null, null)).toHaveLength(0);
  });
});

describe('describeAuditAction', () => {
  it('reads a code as a sentence', () => {
    expect(describeAuditAction('estimate.sent').title).toBe('Sent estimate');
    expect(describeAuditAction('warranty.claim.raised').title).toBe('Raised warranty claim');
  });

  it('copes with a verb nobody has translated', () => {
    // The alternative is a lookup table that goes stale the first time
    // somebody adds an action, and shows a raw code on a page meant to be
    // read by a person.
    expect(describeAuditAction('thing.frobnicated').title).toBe('Frobnicated thing');
  });

  it('separates what a record became from what it merely says', () => {
    expect(describeAuditAction('invoice.issued').milestone).toBe(true);
    expect(describeAuditAction('invoice.note.updated').milestone).toBe(false);
  });
});

describe('lifeOf', () => {
  it('reads from the beginning, not the end', () => {
    // A thread is caught up with, newest first. A life is read from the
    // start, because the question is how it got to where it is.
    const life = lifeOf([
      entry({ action: 'estimate.sent', at: at('2026-09-03') }),
      entry({ action: 'estimate.created', at: at('2026-09-01') }),
    ]);

    expect(life.events[0]!.title).toBe('Created estimate');
    expect(life.createdAt).toEqual(at('2026-09-01'));
    expect(life.lastTouchedAt).toEqual(at('2026-09-03'));
  });

  it('names everybody who touched it, once each', () => {
    const life = lifeOf([
      entry({ action: 'estimate.created', actorName: 'Sara Whitfield' }),
      entry({ action: 'estimate.updated', actorName: 'Sara Whitfield' }),
      entry({ action: 'estimate.approved', actorName: 'Maria Okonkwo' }),
    ]);

    expect(life.hands).toHaveLength(2);
  });

  it('says the system did it when nobody did', () => {
    // Automation acts with no person behind it, and a blank there reads as a
    // missing name rather than as what actually happened.
    const life = lifeOf([entry({ action: 'reminder.sent', actorName: null })]);
    expect(life.events[0]!.actorName).toBe('The system');
  });

  it('tells the story in the summary', () => {
    const life = lifeOf([
      entry({ action: 'estimate.created', at: at('2026-09-01') }),
      entry({ action: 'estimate.note.updated', at: at('2026-09-02') }),
      entry({ action: 'estimate.sent', at: at('2026-09-03') }),
      entry({ action: 'estimate.approved', at: at('2026-09-04') }),
    ]);

    expect(life.summary).toContain('created estimate, then sent estimate, then approved estimate');
    // The note change is real and is not a milestone, so it stays off the
    // one-line story and remains in the events.
    expect(life.events).toHaveLength(4);
  });

  it('says plainly when nothing has happened', () => {
    const life = lifeOf([]);
    expect(life.summary).toContain('Nothing has been recorded');
    expect(life.createdAt).toBeNull();
  });

  it('describes the device without inventing a place', () => {
    // Printing a guessed town beside somebody's name is a claim the data does
    // not support.
    const life = lifeOf([
      entry({
        action: 'job.updated',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      }),
    ]);

    expect(life.events[0]!.origin).toContain('phone or tablet');
    expect(life.events[0]!.origin).toContain('203.0.113.9');
  });

  it('says nothing about origin when nothing was recorded', () => {
    expect(lifeOf([entry({ action: 'job.updated' })])[0]).toBeUndefined();
    expect(lifeOf([entry({ action: 'job.updated' })]).events[0]!.origin).toBeNull();
  });
});
