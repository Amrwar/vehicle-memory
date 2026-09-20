import { describe, expect, it } from 'vitest';

import { chainEvent, verifyChain, type ChainedEvent } from './chain';
import {
  type CompletedJobInput,
  describeVerification,
  eventsForCompletedJob,
  humaniseEventType,
  mileageEvent,
  ownershipTransferEvent,
} from './events';

const SALT = 'test-salt';

const JOB: CompletedJobInput = {
  jobId: 'job_1',
  jobNumber: 10482,
  vehicleId: 'veh_1',
  orgId: 'org_1',
  orgName: 'Hillside Motors',
  completedAt: new Date(Date.UTC(2026, 8, 9, 15, 30)),
  shortDescription: 'Brake system repair',
  diagnosis: 'Front brake pads and discs required replacement.',
  odometerKm: 82_430,
  jobTypeNames: ['Brake repair'],
  labour: [
    { description: 'Brake inspection', hours: 1.0 },
    { description: 'Brake replacement', hours: 3.5 },
  ],
  parts: [
    { id: 'p1', description: 'BMW brake pads', partNumber: '34116794300', quantity: 1 },
    { id: 'p2', description: 'BMW brake discs', partNumber: '34116864059', quantity: 2 },
  ],
  inspection: { id: 'insp_1', passCount: 24, advisoryCount: 3, criticalCount: 1 },
  hasPhotoEvidence: true,
};

describe('events from a completed job', () => {
  it('writes the work, each part, the inspection and the odometer', () => {
    const events = eventsForCompletedJob(JOB);
    const types = events.map((e) => e.type);

    expect(types).toContain('REPAIR');
    expect(types.filter((t) => t === 'PART_FITTED')).toHaveLength(2);
    expect(types).toContain('INSPECTION');
    expect(types).toContain('MILEAGE_READING');
    expect(events).toHaveLength(5);
  });

  it('classifies a service separately from a repair', () => {
    const service = eventsForCompletedJob({ ...JOB, jobTypeNames: ['Major Service'] });
    expect(service[0]!.type).toBe('SERVICE');
    expect(eventsForCompletedJob(JOB)[0]!.type).toBe('REPAIR');
  });

  // Granularity is the point: "which pads went in, and when" is the question a
  // future mechanic needs answered, and prose cannot answer it.
  it('records each part as its own event with its part number', () => {
    const parts = eventsForCompletedJob(JOB).filter((e) => e.type === 'PART_FITTED');
    expect(parts[0]!.title).toBe('BMW brake pads fitted');
    expect(parts[0]!.summary).toContain('34116794300');
    expect((parts[1]!.payload as { quantity: number }).quantity).toBe(2);
  });

  it('marks events verified only when photographs back them', () => {
    expect(eventsForCompletedJob(JOB)[0]!.verification).toBe('WORKSHOP_VERIFIED');
    expect(eventsForCompletedJob({ ...JOB, hasPhotoEvidence: false })[0]!.verification).toBe(
      'WORKSHOP_RECORDED',
    );
  });

  it('writes a summary a non-expert can read', () => {
    const summary = eventsForCompletedJob(JOB)[0]!.summary!;
    expect(summary).toContain('Front brake pads and discs required replacement');
    expect(summary).toContain('BMW brake pads');
    expect(summary).toContain('4.5 hours');
  });

  it('attributes every event to the recording workshop', () => {
    for (const event of eventsForCompletedJob(JOB)) {
      expect(event.recordedByOrgId).toBe('org_1');
    }
  });

  // Story C3: retrying a failed completion must not duplicate history.
  it('gives every event a stable idempotency key derived from its cause', () => {
    const first = eventsForCompletedJob(JOB).map((e) => e.idempotencyKey);
    const second = eventsForCompletedJob(JOB).map((e) => e.idempotencyKey);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first).toContain('job:job_1:part:p1');
  });

  it('omits the odometer event when no reading was taken', () => {
    const events = eventsForCompletedJob({ ...JOB, odometerKm: null });
    expect(events.some((e) => e.type === 'MILEAGE_READING')).toBe(false);
  });

  it('omits the inspection event when none was carried out', () => {
    const events = eventsForCompletedJob({ ...JOB, inspection: null });
    expect(events.some((e) => e.type === 'INSPECTION')).toBe(false);
  });

  it('handles a job with no parts', () => {
    const events = eventsForCompletedJob({ ...JOB, parts: [] });
    expect(events.some((e) => e.type === 'PART_FITTED')).toBe(false);
  });

  it('produces events that chain and verify', () => {
    // The events this module builds must be valid input to the ledger.
    const drafts = eventsForCompletedJob(JOB);
    const chained: ChainedEvent[] = [];
    let prevHash: string | null = null;

    drafts.forEach((draft, index) => {
      const event = chainEvent({ ...draft, sequence: index + 1 }, prevHash, SALT);
      chained.push(event);
      prevHash = event.hash;
    });

    expect(verifyChain(chained, SALT).valid).toBe(true);
  });
});

describe('ownership transfer', () => {
  it('records that the car changed hands, and stays self-reported', () => {
    const event = ownershipTransferEvent({
      vehicleId: 'veh_1',
      occurredAt: new Date(Date.UTC(2026, 8, 9)),
      keeperNumber: 3,
      transferId: 'tr_1',
      odometerKm: 82_430,
    });

    expect(event.type).toBe('OWNERSHIP_TRANSFER');
    expect(event.summary).toBe('Changed hands. The 3rd keeper on record.');
    expect(event.verification).toBe('SELF_REPORTED');
    expect(event.idempotencyKey).toBe('transfer:tr_1');
  });

  it('handles a first registration with nobody before', () => {
    const event = ownershipTransferEvent({
      vehicleId: 'veh_1',
      occurredAt: new Date(),
      transferId: 'tr_0',
    });

    expect(event.summary).toBe('Changed hands.');
  });

  /**
   * The point of the change made in Phase 62, and the reason it is a test
   * rather than a comment: a name written into a hashed chain can never be
   * taken out again, and somebody will one day ask for theirs to be.
   */
  it('carries no name anywhere, because a hashed chain cannot be edited', () => {
    const event = ownershipTransferEvent({
      vehicleId: 'veh_1',
      occurredAt: new Date(),
      keeperNumber: 2,
      transferId: 'tr_2',
    });

    const everything = JSON.stringify(event);

    expect(everything).not.toContain('Ahmed');
    expect(everything).not.toContain('ownerName');
    expect(Object.keys(event.payload as object)).toEqual(['keeperNumber', 'transferId']);
  });

  it('counts the keeper the way a person would say it', () => {
    const say = (n: number) =>
      ownershipTransferEvent({
        vehicleId: 'v',
        occurredAt: new Date(),
        keeperNumber: n,
        transferId: 't',
      }).summary;

    expect(say(1)).toContain('1st');
    expect(say(2)).toContain('2nd');
    expect(say(11)).toContain('11th');
    expect(say(21)).toContain('21st');
  });
});

describe('standalone mileage events', () => {
  it('flags an anomalous reading in the summary the reader sees', () => {
    const event = mileageEvent({
      vehicleId: 'veh_1',
      km: 71_000,
      readAt: new Date(),
      source: 'WORKSHOP',
      readingId: 'od_1',
      recordedByOrgId: 'org_1',
      anomaly: 'DECREASE',
    });

    expect(event.summary).toContain('lower than a previous reading');
    expect((event.payload as { anomaly: string }).anomaly).toBe('DECREASE');
  });

  it('treats an owner-supplied reading as self-reported', () => {
    const event = mileageEvent({
      vehicleId: 'veh_1',
      km: 90_000,
      readAt: new Date(),
      source: 'OWNER',
      readingId: 'od_2',
    });
    expect(event.verification).toBe('SELF_REPORTED');
  });

  it('leaves the summary empty for an unremarkable reading', () => {
    const event = mileageEvent({
      vehicleId: 'veh_1',
      km: 90_000,
      readAt: new Date(),
      source: 'WORKSHOP',
      readingId: 'od_3',
      recordedByOrgId: 'org_1',
      anomaly: 'NONE',
    });
    expect(event.summary).toBeNull();
  });
});

describe('labels', () => {
  it('gives every event type a human label', () => {
    expect(humaniseEventType('PART_FITTED')).toBe('Part');
    expect(humaniseEventType('RECALL_PERFORMED')).toBe('Recall done');
  });

  it('explains each verification level in plain language', () => {
    expect(describeVerification('WORKSHOP_VERIFIED')).toContain('photographic evidence');
    expect(describeVerification('SELF_REPORTED')).toContain('owner');
  });
});
