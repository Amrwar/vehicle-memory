import { describe, expect, it } from 'vitest';

import {
  assertCompletable,
  assertResultSound,
  bySection,
  describeCompletion,
  type InspectionError,
  nextUnchecked,
  progressOf,
  type RecordedResult,
  suggestSeverity,
  type TemplateItem,
} from './carry-out';

const ITEMS: TemplateItem[] = [
  { id: 'i1', sectionName: 'Tyres', name: 'Nearside front', measurementType: 'TREAD_DEPTH_MM' },
  { id: 'i2', sectionName: 'Tyres', name: 'Offside front', measurementType: 'TREAD_DEPTH_MM' },
  { id: 'i3', sectionName: 'Brakes', name: 'Front pads', measurementType: 'PAD_THICKNESS_MM' },
  { id: 'i4', sectionName: 'Brakes', name: 'Rear pads', measurementType: 'PAD_THICKNESS_MM' },
  { id: 'i5', sectionName: 'Lights', name: 'Headlights', measurementType: 'NONE' },
];

function result(id: string, overrides: Partial<RecordedResult> = {}): RecordedResult {
  return { templateItemId: id, severity: 'PASS', ...overrides };
}

describe('progress through an inspection', () => {
  it('counts what has actually been looked at', () => {
    const progress = progressOf(ITEMS, [
      result('i1'),
      result('i2', { severity: 'ADVISORY', measurementValue: 2.4 }),
      result('i3', { severity: 'CRITICAL', measurementValue: 2 }),
    ]);

    expect(progress).toMatchObject({
      total: 5,
      checked: 3,
      remaining: 2,
      critical: 1,
      advisory: 1,
    });
  });

  it('does not count an item recorded as not checked', () => {
    // Otherwise a technician opening every item and closing it again reads as
    // a completed inspection.
    const progress = progressOf(ITEMS, [result('i1', { severity: 'NOT_CHECKED' })]);

    expect(progress.checked).toBe(0);
  });

  it('reports a percentage without pretending it is a health score', () => {
    // Nine greens and one red is not ninety per cent healthy.
    expect(progressOf(ITEMS, [result('i1')]).percent).toBe(20);
  });
});

describe('what a measurement suggests', () => {
  it('reads a tyre at the legal limit as critical, and says why', () => {
    const suggestion = suggestSeverity('TREAD_DEPTH_MM', 1.5);

    expect(suggestion?.severity).toBe('CRITICAL');
    expect(suggestion?.because).toMatch(/legal limit/);
  });

  it('reads a worn but legal tyre as advisory', () => {
    expect(suggestSeverity('TREAD_DEPTH_MM', 2.5)?.severity).toBe('ADVISORY');
  });

  it('says nothing where there is no published threshold', () => {
    // A voltage means different things on different vehicles, and guessing is
    // worse than staying quiet.
    expect(suggestSeverity('VOLTAGE', 12.1)).toBeNull();
    expect(suggestSeverity('NONE', 5)).toBeNull();
  });

  it('says nothing when there is no measurement', () => {
    expect(suggestSeverity('TREAD_DEPTH_MM', null)).toBeNull();
    expect(suggestSeverity('TREAD_DEPTH_MM', undefined)).toBeNull();
  });
});

describe('an item recorded on its own', () => {
  it('accepts a pass with nothing else', () => {
    expect(() => assertResultSound({ severity: 'PASS' })).not.toThrow();
  });

  it('refuses a red with nothing behind it', () => {
    // It reaches the customer as an alarming colour the workshop cannot
    // explain when they ring about it.
    expect(() => assertResultSound({ severity: 'CRITICAL' })).toThrow(/has to be told why/);
  });

  it('accepts a red backed by a measurement', () => {
    expect(() => assertResultSound({ severity: 'CRITICAL', measurementValue: 1.4 })).not.toThrow();
  });

  it('accepts an amber backed by a note', () => {
    expect(() =>
      assertResultSound({ severity: 'ADVISORY', note: 'Slight weep from the hose' }),
    ).not.toThrow();
  });

  it('does not accept whitespace as a reason', () => {
    expect(() => assertResultSound({ severity: 'ADVISORY', note: '   ' })).toThrow();
  });

  it('carries a code', () => {
    try {
      assertResultSound({ severity: 'CRITICAL' });
    } catch (error) {
      expect((error as InspectionError).code).toBe('MISSING_REASON');
    }
  });
});

describe('finishing an inspection', () => {
  const partial = progressOf(ITEMS, [result('i1'), result('i2')]);

  it('allows gaps on purpose', () => {
    // Refusing would make a technician tick boxes to escape the screen, and a
    // green tick meaning "I wanted to leave" is worse than an honest blank.
    expect(() => assertCompletable({ status: 'DRAFT', progress: partial })).not.toThrow();
  });

  it('refuses when nothing at all was checked', () => {
    const nothing = progressOf(ITEMS, []);

    expect(() => assertCompletable({ status: 'DRAFT', progress: nothing })).toThrow(
      /nothing to send/,
    );
  });

  it('refuses to complete one twice', () => {
    expect(() => assertCompletable({ status: 'COMPLETED', progress: partial })).toThrow(
      /already been completed/,
    );
  });

  it('tells the technician what the customer will be told', () => {
    const message = describeCompletion(partial);

    expect(message).toMatch(/checked 2 of 5/);
    // The sentence that protects the workshop when something fails later on a
    // part nobody examined.
    expect(message).toMatch(/3 of 5 items were not checked/);
  });

  it('leads with what needs doing now', () => {
    const found = progressOf(ITEMS, [
      result('i1'),
      result('i2'),
      result('i3', { severity: 'CRITICAL', measurementValue: 2 }),
      result('i4'),
      result('i5'),
    ]);

    expect(describeCompletion(found)).toMatch(/1 item needs attention now/);
    expect(describeCompletion(found)).not.toMatch(/were not checked/);
  });
});

describe('working around the car', () => {
  it('goes to the next item in the order the template is written', () => {
    // A technician walks a car in a physical order, and a screen that jumps
    // about makes them walk back and forth.
    expect(nextUnchecked(ITEMS, [result('i1'), result('i2')])?.id).toBe('i3');
  });

  it('returns nothing when everything has been looked at', () => {
    expect(
      nextUnchecked(
        ITEMS,
        ITEMS.map((item) => result(item.id)),
      ),
    ).toBeNull();
  });

  it('skips past items opened and left unchecked', () => {
    expect(nextUnchecked(ITEMS, [result('i1', { severity: 'NOT_CHECKED' })])?.id).toBe('i1');
  });

  it('groups items into the sections they belong to, in order', () => {
    expect(bySection(ITEMS).map((section) => section.name)).toEqual(['Tyres', 'Brakes', 'Lights']);
    expect(bySection(ITEMS)[0]?.items).toHaveLength(2);
  });
});
