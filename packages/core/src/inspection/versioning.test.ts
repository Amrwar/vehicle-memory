import { describe, expect, it } from 'vitest';

import {
  didNotAsk,
  fingerprintOf,
  questionOf,
  type ShapeItem,
  versionSentence,
  whatChanged,
  worthSaying,
} from './versioning';

function item(over: Partial<ShapeItem> & { itemName: string }): ShapeItem {
  return { sectionName: 'Brakes', guidance: null, measurementType: 'NONE', ...over };
}

const sheet: ShapeItem[] = [
  item({ itemName: 'Front pads', measurementType: 'PAD_THICKNESS_MM' }),
  item({ itemName: 'Rear pads', measurementType: 'PAD_THICKNESS_MM' }),
  item({ sectionName: 'Tyres', itemName: 'Front tread', measurementType: 'TREAD_DEPTH_MM' }),
];

describe('what makes one sheet a different sheet', () => {
  it('is the same sheet when nothing about the questions changed', () => {
    expect(fingerprintOf(sheet)).toBe(fingerprintOf([...sheet]));
  });

  it('is not changed by reordering', () => {
    // Reordering changes the order a technician walks the car in. It does not
    // change a single question asked, and a reader comparing two inspections
    // cares about the questions.
    expect(fingerprintOf([...sheet].reverse())).toBe(fingerprintOf(sheet));
  });

  it('is not changed by retyping an item identically', () => {
    // A workshop that deletes an item and types it back has not changed what
    // it asks. A fingerprint over ids would have said it had.
    const retyped = sheet.map((one) => ({ ...one }));
    expect(fingerprintOf(retyped)).toBe(fingerprintOf(sheet));
  });

  it('changes when an item is added', () => {
    expect(fingerprintOf([...sheet, item({ itemName: 'Brake fluid' })])).not.toBe(
      fingerprintOf(sheet),
    );
  });

  it('changes when an item is removed', () => {
    expect(fingerprintOf(sheet.slice(1))).not.toBe(fingerprintOf(sheet));
  });

  it('changes when the guidance changes', () => {
    const advised = [
      { ...sheet[0]!, guidance: 'Measure at the thinnest point.' },
      ...sheet.slice(1),
    ];
    expect(fingerprintOf(advised)).not.toBe(fingerprintOf(sheet));
  });

  it('changes when what is measured changes', () => {
    const different = [{ ...sheet[0]!, measurementType: 'PERCENT' }, ...sheet.slice(1)];
    expect(fingerprintOf(different)).not.toBe(fingerprintOf(sheet));
  });

  it('tells apart two items of the same name in different sections', () => {
    const one = [item({ sectionName: 'Front', itemName: 'Discs' })];
    const other = [item({ sectionName: 'Rear', itemName: 'Discs' })];
    expect(fingerprintOf(one)).not.toBe(fingerprintOf(other));
  });

  it('is the same again when a sheet is changed back', () => {
    // A workshop that removes an item and puts it back is once more asking
    // what it asked, which is true and which a counter would have got wrong.
    const without = sheet.slice(1);
    const restored = [...without, sheet[0]!];
    expect(fingerprintOf(restored)).toBe(fingerprintOf(sheet));
  });

  it('is the same for two empty sheets', () => {
    expect(fingerprintOf([])).toBe(fingerprintOf([]));
  });
});

describe('what changed between two sheets', () => {
  it('says nothing changed when nothing did', () => {
    expect(whatChanged(sheet, sheet).same).toBe(true);
  });

  it('names what was added, in a reader’s words', () => {
    const now = [...sheet, item({ itemName: 'Brake fluid' })];
    expect(whatChanged(sheet, now).added).toEqual(['Brakes · Brake fluid']);
  });

  it('names what was removed', () => {
    expect(whatChanged(sheet, sheet.slice(1)).removed).toEqual(['Brakes · Front pads']);
  });

  it('counts a changed guidance as reworded, not as added and removed', () => {
    const advised = [
      { ...sheet[0]!, guidance: 'Measure at the thinnest point.' },
      ...sheet.slice(1),
    ];
    const changed = whatChanged(sheet, advised);

    expect(changed.reworded).toEqual(['Brakes · Front pads']);
    expect(changed.added).toEqual([]);
    expect(changed.removed).toEqual([]);
    expect(changed.same).toBe(false);
  });

  it('names a question the way a reader would', () => {
    expect(questionOf(item({ sectionName: 'Tyres', itemName: 'Front tread' }))).toBe(
      'Tyres · Front tread',
    );
  });
});

describe('what the old sheet did not ask', () => {
  // The sentence the whole phase exists for. A March inspection with no brake
  // fluid line must be able to say it was not on the sheet in March, rather
  // than leaving a silence that reads as an omission or as a pass.

  it('names what has been added since', () => {
    const now = [...sheet, item({ itemName: 'Brake fluid' }), item({ itemName: 'Handbrake' })];
    expect(didNotAsk(sheet, now)).toEqual(['Brakes · Brake fluid', 'Brakes · Handbrake']);
  });

  it('says nothing when the sheet has not grown', () => {
    expect(didNotAsk(sheet, sheet)).toEqual([]);
    expect(worthSaying(didNotAsk(sheet, sheet))).toBe(false);
  });

  it('does not count a question the sheet has since dropped', () => {
    // The old check did ask it. That it is gone now is not something the old
    // report failed to do.
    expect(didNotAsk(sheet, sheet.slice(1))).toEqual([]);
  });

  it('is worth saying as soon as there is one', () => {
    expect(worthSaying(didNotAsk(sheet, [...sheet, item({ itemName: 'Brake fluid' })]))).toBe(true);
  });
});

describe('how a version is described', () => {
  it('names the sheet, the version and how much it asked', () => {
    expect(versionSentence({ version: 3, templateName: 'Standard check', itemCount: 24 })).toBe(
      'Standard check, version 3 — 24 checks',
    );
  });
});

describe('two sheets that are not the same sheet', () => {
  it('does not confuse a section named into an item name', () => {
    // "Brake" + "s" against "Brakes" + "". Joining the fields with nothing
    // between them gives both the same fingerprint, and a workshop editing
    // one into the other would have gone on using a version that no longer
    // described it.
    const one = [item({ sectionName: 'Brake', itemName: 's' })];
    const other = [item({ sectionName: 'Brakes', itemName: '' })];

    expect(fingerprintOf(one)).not.toBe(fingerprintOf(other));
  });

  it('does not confuse two lines run together with one long one', () => {
    const two = [item({ itemName: 'Front' }), item({ itemName: 'Rear' })];
    const one = [item({ itemName: 'FrontRear' })];

    expect(fingerprintOf(two)).not.toBe(fingerprintOf(one));
  });
});
