import { describe, expect, it } from 'vitest';

import { buildReport, type ReportInput } from './report';
import {
  assertTransferable,
  heldFor,
  OwnershipError,
  ownerHistory,
  transferEvent,
  type Ownership,
} from './transfer';

/** Anchored at nine, so a bare date does not shift a day west of London. */
const at = (iso: string) => new Date(`${iso}T09:00:00`);
const NOW = at('2026-09-11');

const current: Ownership = {
  id: 'own-1',
  ownerName: 'Maria Okonkwo',
  ownerKind: 'PRIVATE',
  startedAt: at('2022-04-01'),
  endedAt: null,
};

describe('assertTransferable', () => {
  it('allows an ordinary sale', () => {
    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it('refuses a transfer to nobody', () => {
    // Without this, "transfer" becomes a way to delete an owner and leave the
    // vehicle with no history of who had it.
    expect(() =>
      assertTransferable({
        current,
        toName: '   ',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).toThrow(OwnershipError);
  });

  it('refuses a transfer from nobody', () => {
    expect(() =>
      assertTransferable({
        current: null,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).toThrow(/no current owner/i);
  });

  it('refuses transferring to the same person, whatever the capitals', () => {
    expect(() =>
      assertTransferable({
        current,
        toName: 'maria okonkwo',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).toThrow(/same owner/i);
  });

  it('refuses a sale dated before the seller bought it', () => {
    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2021-01-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).toThrow(/before the current owner/i);
  });

  it('refuses a sale in the future but forgives a day', () => {
    // Somebody in Montreal recording yesterday evening's sale is not wrong.
    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-09-11'),
        openJobs: 0,
        now: at('2026-09-10'),
      }),
    ).not.toThrow();

    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-12-01'),
        openJobs: 0,
        now: NOW,
      }),
    ).toThrow(/future/i);
  });

  it('stops on open work, and says what confirming it would mean', () => {
    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 2,
        now: NOW,
      }),
    ).toThrow(/2 open jobs/);
  });

  it('goes ahead on open work when somebody says to', () => {
    expect(() =>
      assertTransferable({
        current,
        toName: 'David Chen',
        toKind: 'PRIVATE',
        on: at('2026-09-01'),
        openJobs: 2,
        force: true,
        now: NOW,
      }),
    ).not.toThrow();
  });
});

describe('transferEvent', () => {
  it('puts no name in the chain', () => {
    // The whole reason the passport can be permanent and erasable at once. A
    // hash over somebody's name cannot honour a deletion request.
    const event = transferEvent({ on: at('2026-09-01'), odometerKm: 82_400 });
    const serialised = JSON.stringify(event.payload).toLowerCase();

    expect(serialised).not.toContain('maria');
    expect(serialised).not.toContain('david');
    expect(event.payload.odometerKm).toBe(82_400);
  });

  it('says when no reading was taken rather than implying one', () => {
    const event = transferEvent({ on: at('2026-09-01'), odometerKm: null });
    expect(event.summary).toContain('No odometer reading');
  });
});

describe('ownerHistory', () => {
  it('counts owners and how long each kept it, naming none of them', () => {
    const history = ownerHistory(
      [
        { ...current, id: 'a', startedAt: at('2019-01-01'), endedAt: at('2022-04-01') },
        { ...current, id: 'b', startedAt: at('2022-04-01'), endedAt: null },
      ],
      NOW,
    );

    expect(history).toHaveLength(2);
    expect(history[0]!.position).toBe(1);
    expect(history[0]!.months).toBe(39);
    expect(history[1]!.current).toBe(true);
    expect(JSON.stringify(history)).not.toContain('Maria');
  });

  it('measures the current owner up to now', () => {
    expect(heldFor(current, NOW)).toBe(53);
  });

  it('does not go negative on a same-day sale', () => {
    expect(
      heldFor({ ...current, startedAt: at('2026-09-11'), endedAt: at('2026-09-11') }, NOW),
    ).toBe(0);
  });
});

describe('buildReport', () => {
  const base: ReportInput = {
    owners: 3,
    events: 27,
    serviceEvents: 12,
    inspections: 4,
    unresolvedCritical: 0,
    unresolvedAdvisory: 2,
    openRecalls: 0,
    odometerKm: 82_400,
    firstRecordAt: at('2019-06-01'),
    lastServiceAt: at('2026-06-01'),
    firstRegisteredAt: at('2019-03-01'),
    mileageAnomalies: 0,
    chain: 'INTACT',
    now: NOW,
  };

  it('leads with the figures a buyer asked for', () => {
    const report = buildReport(base);
    const owners = report.headline.find((line) => line.label === 'Owners on record');

    expect(owners!.value).toBe('3');
    expect(report.verdict).toContain('full record');
  });

  it('always says what the record does not cover', () => {
    // The part that earns the rest. A report that lists twelve services and
    // says nothing about the years before them is built to be misread.
    const report = buildReport(base);
    expect(report.gaps.some((gap) => gap.includes('elsewhere'))).toBe(true);
  });

  it('names the years before the record starts', () => {
    const report = buildReport({
      ...base,
      firstRegisteredAt: at('2014-03-01'),
      firstRecordAt: at('2021-06-01'),
    });

    expect(report.gaps[0]).toContain('7 years');
  });

  it('turns an unresolved critical item into a question with a demand in it', () => {
    const report = buildReport({ ...base, unresolvedCritical: 1 });

    expect(report.questions[0]).toContain('invoice');
    expect(
      report.headline.find((line) => line.label === 'Unresolved critical items')!.concern,
    ).toBe('STOP');
  });

  it('raises a mileage anomaly without accusing anybody', () => {
    const report = buildReport({ ...base, mileageAnomalies: 2 });
    const question = report.questions.find((entry) => entry.includes('odometer'))!;

    expect(question).toContain('innocent explanations');
  });

  it('refuses to stand behind a broken chain, whatever else is good', () => {
    const report = buildReport({ ...base, chain: 'BROKEN' });

    expect(report.verdict).toBe('Do not rely on this record.');
    expect(report.chainWords).toContain('altered or removed');
  });

  it('distinguishes unverified from broken', () => {
    // These are not the same claim, and collapsing them would either accuse a
    // clean record or excuse a tampered one.
    const report = buildReport({ ...base, chain: 'UNVERIFIED' });
    expect(report.verdict).not.toContain('Do not rely');
    expect(report.chainWords).toContain('unverified');
  });

  it('calls a thin record thin rather than clean', () => {
    const report = buildReport({
      ...base,
      events: 2,
      serviceEvents: 1,
      inspections: 0,
      lastServiceAt: at('2026-06-01'),
    });

    expect(report.verdict).toContain('thin');
  });

  it('says plainly when there is nothing at all', () => {
    const report = buildReport({
      ...base,
      owners: 0,
      events: 0,
      serviceEvents: 0,
      inspections: 0,
      firstRecordAt: null,
      lastServiceAt: null,
      odometerKm: null,
    });

    expect(report.verdict).toContain('nothing on record');
    expect(report.gaps[0]).toContain('Nothing is recorded');
  });

  it('warns on a service two years old', () => {
    const report = buildReport({ ...base, lastServiceAt: at('2023-01-01') });
    expect(report.headline.find((line) => line.label === 'Last service')!.concern).toBe('WARN');
  });
});
