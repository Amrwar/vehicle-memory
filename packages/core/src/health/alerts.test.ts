import { describe, expect, it } from 'vitest';

import {
  alertBody,
  alertSubject,
  badEnough,
  decideAlerts,
  explained,
  QUIET_FOR_MS,
  type Remembered,
  RUNBOOK,
  runbookFor,
} from './alerts';
import { signal, type Signal, type Standing } from './signals';

const NOW = new Date('2026-09-19T04:00:00Z');

const said = (name: string, standing: Standing): Signal =>
  signal({
    area: 'Workers',
    name,
    standing,
    template: '{count} waiting.',
    values: { count: 40 },
  });

const was = (key: string, standing: Standing, sentAt: Date | null): Remembered => ({
  key,
  standing,
  sentAt,
});

describe('the runbook', () => {
  it('says what to do, not what the thing is', () => {
    for (const entry of RUNBOOK) {
      expect(entry.meaning.length).toBeGreaterThan(20);
      expect(entry.first.length).toBeGreaterThan(20);
      expect(entry.done.length).toBeGreaterThan(10);
    }
  });

  it('names each signal once', () => {
    expect(new Set(explained()).size).toBe(RUNBOOK.length);
  });

  it('finds an entry by the name the health page uses', () => {
    expect(runbookFor('Events waiting')?.wakeOn).toBe('degraded');
    expect(runbookFor('Something nobody has written about')).toBeNull();
  });
});

describe('how bad is bad enough', () => {
  it('wakes on degraded only where the entry says so', () => {
    expect(badEnough('degraded', 'degraded')).toBe(true);
    expect(badEnough('degraded', 'failed')).toBe(false);
    expect(badEnough('failed', 'failed')).toBe(true);
  });

  it('never wakes anybody for healthy, or for not knowing', () => {
    expect(badEnough('healthy', 'degraded')).toBe(false);
    expect(badEnough('unknown', 'degraded')).toBe(false);
  });
});

describe('what is worth sending', () => {
  it('raises the first time something goes wrong', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'failed')],
      remembered: [],
      now: NOW,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe('raised');
    expect(alerts[0]!.runbook.first).toContain('dispatch cron');
  });

  it('says nothing the second time, within the quiet period', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'failed')],
      remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - 60_000))],
      now: NOW,
    });

    expect(alerts).toHaveLength(0);
  });

  it('says it again once the quiet period is over', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'failed')],
      remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - QUIET_FOR_MS - 1))],
      now: NOW,
    });

    expect(alerts.map((one) => one.kind)).toEqual(['raised']);
  });

  it('speaks up immediately when the same thing gets worse', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'failed')],
      remembered: [was('Events waiting', 'degraded', new Date(NOW.getTime() - 60_000))],
      now: NOW,
    });

    expect(alerts.map((one) => one.kind)).toEqual(['worse']);
  });

  it('says so when it is over, once', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'healthy')],
      remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - 60_000))],
      now: NOW,
    });

    expect(alerts.map((one) => one.kind)).toEqual(['cleared']);
  });

  it('does not announce the end of something it never announced', () => {
    const { alerts } = decideAlerts({
      signals: [said('Events waiting', 'healthy')],
      remembered: [was('Events waiting', 'failed', null)],
      now: NOW,
    });

    expect(alerts).toHaveLength(0);
  });

  it('leaves alone a signal that is merely degraded where only failure matters', () => {
    const { alerts } = decideAlerts({
      signals: [said('Assistant', 'degraded')],
      remembered: [],
      now: NOW,
    });

    expect(alerts).toHaveLength(0);
  });

  it('refuses to send a signal nobody has written an action for, and names it', () => {
    const { alerts, unexplained } = decideAlerts({
      signals: [said('A signal invented next month', 'failed')],
      remembered: [],
      now: NOW,
    });

    expect(alerts).toHaveLength(0);
    expect(unexplained).toEqual(['A signal invented next month']);
  });

  it('does not report an unexplained signal that is perfectly well', () => {
    const { unexplained } = decideAlerts({
      signals: [said('A signal invented next month', 'healthy')],
      remembered: [],
      now: NOW,
    });

    expect(unexplained).toHaveLength(0);
  });
});

describe('what the message says', () => {
  const [alert] = decideAlerts({
    signals: [said('Passport chains', 'failed')],
    remembered: [],
    now: NOW,
  }).alerts;

  it('says which and how bad in the subject, because that is what is read first', () => {
    expect(alertSubject(alert!)).toBe('Carnet failed: Passport chains');
  });

  it('carries the one thing to do, and what done looks like', () => {
    const body = alertBody(alert!, 'https://carnet.test/admin/health');

    expect(body).toContain('What it means:');
    expect(body).toContain('First thing:');
    expect(body).toContain('Fixed when:');
    expect(body).toContain('https://carnet.test/admin/health');
  });

  it('asks for nothing when the thing has recovered', () => {
    const cleared = decideAlerts({
      signals: [said('Passport chains', 'healthy')],
      remembered: [was('Passport chains', 'failed', new Date(NOW.getTime() - 60_000))],
      now: NOW,
    }).alerts[0]!;

    expect(alertSubject(cleared)).toBe('Carnet recovered: Passport chains');
    expect(alertBody(cleared, 'x')).toContain('Nothing to do');
  });
});
