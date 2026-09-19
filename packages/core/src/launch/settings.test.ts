import { describe, expect, it } from 'vitest';

import {
  describeReadiness,
  handover,
  readSettings,
  SETTINGS,
  SEVERITY,
  type Setting,
} from './settings';

const only = (name: string): Setting[] => SETTINGS.filter((one) => one.name === name);

describe('the register', () => {
  it('names each setting once', () => {
    expect(new Set(SETTINGS.map((one) => one.name)).size).toBe(SETTINGS.length);
  });

  it('says what a workshop would feel, and what to do', () => {
    for (const setting of SETTINGS) {
      expect(setting.felt.length).toBeGreaterThan(20);
      expect(setting.set.length).toBeGreaterThan(5);
    }
  });

  it('ranks a silent failure as worse than one that stops the product', () => {
    expect(SEVERITY.silent).toBeLessThan(SEVERITY.stops);
  });
});

describe('reading an environment', () => {
  it('calls a set value ready', () => {
    expect(readSettings({ MAIL_TRANSPORT: 'smtp' }, only('MAIL_TRANSPORT'))[0]!.verdict).toBe(
      'ready',
    );
  });

  it('calls an absent one missing', () => {
    expect(readSettings({}, only('CRON_SECRET'))[0]!.verdict).toBe('missing');
  });

  it('calls an empty one missing rather than set', () => {
    expect(readSettings({ CRON_SECRET: '   ' }, only('CRON_SECRET'))[0]!.verdict).toBe('missing');
  });

  it('sees through a value that is present and means nothing is configured', () => {
    expect(readSettings({ MAIL_TRANSPORT: 'console' }, only('MAIL_TRANSPORT'))[0]!.verdict).toBe(
      'pretending',
    );
    expect(readSettings({ PAYMENT_PROVIDER: 'stub' }, only('PAYMENT_PROVIDER'))[0]!.verdict).toBe(
      'pretending',
    );
    expect(readSettings({ APP_URL: 'http://localhost:3000' }, only('APP_URL'))[0]!.verdict).toBe(
      'pretending',
    );
  });

  it('leaves the optional ones alone whether set or not', () => {
    expect(readSettings({}, only('LOG_LEVEL'))[0]!.verdict).toBe('not needed');
    expect(readSettings({ LOG_LEVEL: 'debug' }, only('LOG_LEVEL'))[0]!.verdict).toBe('not needed');
  });
});

describe('whether a workshop could be put on it', () => {
  it('refuses while anything needed is missing or pretending', () => {
    const { ready, stopping } = handover(readSettings({}, SETTINGS));

    expect(ready).toBe(false);
    expect(stopping.length).toBeGreaterThan(0);
  });

  it('puts the silent failures first, because those are the ones nobody sees', () => {
    const { stopping } = handover(readSettings({}, SETTINGS));

    expect(stopping[0]!.setting.consequence).toBe('silent');
  });

  it('is content once everything needed is genuinely set', () => {
    const values: Record<string, string> = {};

    for (const setting of SETTINGS) {
      if (setting.needed === 'never') continue;
      const pretend = setting.pretendingIfEqual?.[0];
      values[setting.name] = pretend === 'production' ? 'production' : 'a real value';
    }
    values.NODE_ENV = 'production';
    values.PASSWORD_BREACH_CHECK = 'on';

    const { ready, stopping } = handover(readSettings(values, SETTINGS));

    expect(stopping.map((one) => one.setting.name)).toEqual([]);
    expect(ready).toBe(true);
  });

  it('says the whole picture in one line', () => {
    const said = describeReadiness(readSettings({ MAIL_TRANSPORT: 'console' }, SETTINGS));

    expect(said).toContain('settings:');
    expect(said).toContain('pretend');
  });
});
