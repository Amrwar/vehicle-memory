import { describe, expect, it } from 'vitest';

import {
  afterCheck,
  DEFAULT_QUALITY_SHEET,
  gapsIn,
  isAnswered,
  outcomeOf,
  type QualityAnswer,
  type QualityItem,
} from './quality';

const torque: QualityItem = {
  id: 'torque',
  label: 'Torque-critical fasteners checked',
  kind: 'CONFIRM',
  required: true,
};
const mileage: QualityItem = {
  id: 'mileage',
  label: 'Mileage on handing back',
  kind: 'VALUE',
  required: true,
};
const photos: QualityItem = {
  id: 'photos',
  label: 'Photographs attached',
  kind: 'CONFIRM',
  required: false,
};

const yes = (itemId: string): QualityAnswer => ({ itemId, confirmed: true });
const no = (itemId: string): QualityAnswer => ({ itemId, confirmed: false });
const said = (itemId: string, value: string): QualityAnswer => ({ itemId, value });

describe('a line is answered or it is not', () => {
  it('a tick is answered either way', () => {
    expect(isAnswered(torque, yes('torque'))).toBe(true);
    expect(isAnswered(torque, no('torque'))).toBe(true);
  });

  it('a missing answer is not an answer', () => {
    expect(isAnswered(torque, undefined)).toBe(false);
  });

  // The one that matters on a sheet somebody is rushing through.
  it('and neither is an empty figure, or a space', () => {
    expect(isAnswered(mileage, said('mileage', ''))).toBe(false);
    expect(isAnswered(mileage, said('mileage', '   '))).toBe(false);
    expect(isAnswered(mileage, said('mileage', '84,102'))).toBe(true);
  });
});

describe('when a sheet passes', () => {
  const sheet = [torque, mileage, photos];

  it('when every required line is answered and none says no', () => {
    expect(outcomeOf(sheet, [yes('torque'), said('mileage', '84,102')])).toBe('PASS');
  });

  it('an unanswered required line fails it, and is named', () => {
    const gaps = gapsIn(sheet, [yes('torque')]);
    expect(outcomeOf(sheet, [yes('torque')])).toBe('FAIL');
    expect(gaps).toEqual([
      { itemId: 'mileage', label: 'Mileage on handing back', why: 'unanswered' },
    ]);
  });

  // Answered no and not answered at all are different problems, and the
  // person reading the sheet needs to know which.
  it('a required line answered no fails it, for a different reason', () => {
    const gaps = gapsIn(sheet, [no('torque'), said('mileage', '84,102')]);
    expect(gaps).toEqual([
      { itemId: 'torque', label: 'Torque-critical fasteners checked', why: 'refused' },
    ]);
  });

  it('an optional line answered no does not fail it', () => {
    expect(outcomeOf(sheet, [yes('torque'), said('mileage', '84,102'), no('photos')])).toBe('PASS');
  });

  it('and an optional line left blank does not either', () => {
    expect(outcomeOf(sheet, [yes('torque'), said('mileage', '84,102')])).toBe('PASS');
  });

  it('an empty sheet with required lines cannot pass', () => {
    expect(outcomeOf(sheet, [])).toBe('FAIL');
    expect(gapsIn(sheet, [])).toHaveLength(2);
  });
});

describe('where the job goes', () => {
  it('a pass finishes it', () => {
    expect(afterCheck('PASS')).toBe('COMPLETED');
  });

  // Not back to QUALITY_CHECK: a job nobody is working on and nobody has
  // finished falls between two people.
  it('a fail goes back to the bench, not back to the queue', () => {
    expect(afterCheck('FAIL')).toBe('IN_PROGRESS');
  });
});

describe('the sheet a workshop starts with', () => {
  it('is the twelve from the plan', () => {
    expect(DEFAULT_QUALITY_SHEET).toHaveLength(12);
  });

  it('asks for figures where a tick would be a lie', () => {
    const values = DEFAULT_QUALITY_SHEET.filter((one) => one.kind === 'VALUE').map(
      (one) => one.label,
    );
    expect(values).toContain('Mileage on handing back');
    expect(values).toContain('What the road test showed');
  });

  it('and cannot pass with nothing filled in', () => {
    const items = DEFAULT_QUALITY_SHEET.map((one, index) => ({ ...one, id: String(index) }));
    expect(outcomeOf(items, [])).toBe('FAIL');
  });
});
