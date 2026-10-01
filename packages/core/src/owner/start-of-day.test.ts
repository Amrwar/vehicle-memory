import { describe, expect, it } from 'vitest';

import type { CloseReadingKind } from './close-of-day';
import {
  type HandoverLine,
  howItMoved,
  howTheNightWent,
  type SinceWhen,
  survivesTheNight,
  theHandover,
  whoIsIn,
  worstMoveFirst,
} from './start-of-day';

const lastNight: SinceWhen = {
  kind: 'close',
  at: new Date('2026-10-01T18:04:00Z'),
  by: 'Ahmed Hassan',
};

function line(kind: CloseReadingKind, was: number, is: number): HandoverLine {
  return {
    kind,
    was,
    is,
    move: howItMoved(was, is),
    what: { key: `${kind} says something` },
    href: `/${kind}`,
  };
}

describe('what became of what the close left', () => {
  it('calls nothing-then-nothing settled', () => {
    expect(howItMoved(0, 0)).toBe('SETTLED');
  });

  it('calls something-then-nothing settled', () => {
    // The keys came back. The one piece of good news a morning ever gets.
    expect(howItMoved(3, 0)).toBe('SETTLED');
  });

  it('calls nothing-then-something new, because nobody chose it', () => {
    // Locked up with every key on its hook, two missing by morning.
    expect(howItMoved(0, 2)).toBe('NEW');
  });

  it('calls more-than-before worse', () => {
    expect(howItMoved(1, 4)).toBe('WORSE');
  });

  it('calls fewer-than-before better, and does not call it settled', () => {
    // Two of three keys found is progress and is not done, and a screen that
    // said "settled" would be the screen lying to look calm.
    expect(howItMoved(3, 1)).toBe('BETTER');
  });

  it('calls the same number still there', () => {
    expect(howItMoved(2, 2)).toBe('STILL_THERE');
  });
});

describe('which readings survive the night', () => {
  it('compares the eight that mean the same thing at both ends of the day', () => {
    for (const kind of [
      'keys',
      'cars-on-site',
      'open-jobs',
      'unpaid-invoices',
      'estimates-waiting',
      'parts-late',
      'bank-unmatched',
      'follow-ups-due',
    ] as const) {
      expect(survivesTheNight(kind)).toBe(true);
    }
  });

  it('refuses to compare who is clocked on, because it inverts', () => {
    // At the close it means somebody is still here who should have gone home.
    // In the morning it means people have arrived. A straight diff reports
    // every ordinary morning as something that happened in the dark.
    expect(survivesTheNight('clocked-on')).toBe(false);
  });

  it('refuses to compare the till, because a till belongs to one day', () => {
    expect(survivesTheNight('till')).toBe(false);
  });

  it('drops them from the handover rather than trusting the caller', () => {
    const handover = theHandover(lastNight, [line('clocked-on', 0, 3), line('keys', 1, 1)]);
    expect(handover.lines.map((one) => one.kind)).toEqual(['keys']);
    expect(handover.happenedInTheDark).toEqual([]);
  });
});

describe('the order the night is read in', () => {
  it('puts what nobody chose above what somebody left', () => {
    const ordered = worstMoveFirst([
      line('open-jobs', 4, 4),
      line('keys', 0, 2),
      line('parts-late', 1, 3),
      line('cars-on-site', 3, 0),
    ]);

    expect(ordered.map((one) => one.move)).toEqual(['NEW', 'WORSE', 'STILL_THERE', 'SETTLED']);
  });

  it('puts the bigger number first among equals', () => {
    const ordered = worstMoveFirst([line('open-jobs', 1, 2), line('keys', 1, 9)]);
    expect(ordered.map((one) => one.kind)).toEqual(['keys', 'open-jobs']);
  });

  it('keeps settled lines rather than dropping them', () => {
    // "The keys are back" is worth saying. A screen that only ever listed
    // complaints would be read as one.
    const handover = theHandover(lastNight, [line('keys', 3, 0)]);
    expect(handover.lines).toHaveLength(1);
    expect(handover.quiet).toBe(true);
  });
});

describe('how the night went', () => {
  it('says so plainly when it was quiet', () => {
    const handover = theHandover(lastNight, [line('keys', 2, 0), line('parts-late', 1, 0)]);
    expect(howTheNightWent(handover)).toEqual({
      key: 'A quiet night. Everything the close left is settled.',
    });
  });

  it('counts what nobody chose', () => {
    const handover = theHandover(lastNight, [line('keys', 0, 1), line('parts-late', 1, 2)]);
    expect(handover.happenedInTheDark).toHaveLength(2);
    expect(howTheNightWent(handover)).toEqual({
      key: '{count} things changed overnight that nobody chose.',
      vars: { count: 2 },
    });
  });

  it('counts one of them as one', () => {
    const handover = theHandover(lastNight, [line('keys', 0, 1)]);
    expect(howTheNightWent(handover)).toEqual({
      key: '1 thing changed overnight that nobody chose.',
    });
  });

  it('separates "somebody left this" from "this happened in the dark"', () => {
    const handover = theHandover(lastNight, [line('open-jobs', 4, 4), line('cars-on-site', 3, 3)]);
    expect(handover.happenedInTheDark).toEqual([]);
    expect(howTheNightWent(handover)).toEqual({
      key: 'Nothing happened overnight that nobody chose.',
    });
  });

  it('says plainly when there was no close to compare against', () => {
    // Not papered over with "since this time yesterday": a screen that worked
    // without the close would teach people the close is optional.
    const handover = theHandover({ kind: 'nobody-closed', at: new Date() }, []);
    expect(howTheNightWent(handover)).toEqual({
      key: 'Nobody closed the day yesterday, so there is nothing to compare this against.',
    });
  });
});

describe('who is expected and who is here', () => {
  const sara = { employeeId: 'e1', name: 'Sara' };
  const john = { employeeId: 'e2', name: 'John' };
  const mike = { employeeId: 'e3', name: 'Mike' };

  it('names who is expected and not yet clocked on', () => {
    expect(whoIsIn([sara, john], [sara]).notYet).toEqual([john]);
  });

  it('names somebody here who was not expected', () => {
    // A swap nobody recorded, or a rota that is wrong. Both worth knowing.
    expect(whoIsIn([sara], [sara, mike]).unexpected).toEqual([mike]);
  });

  it('is empty on both counts when the rota and the clock agree', () => {
    const answer = whoIsIn([sara, john], [john, sara]);
    expect(answer.notYet).toEqual([]);
    expect(answer.unexpected).toEqual([]);
  });

  it('says nobody is expected rather than guessing, when there is no rota', () => {
    const answer = whoIsIn([], [sara]);
    expect(answer.notYet).toEqual([]);
    expect(answer.unexpected).toEqual([sara]);
  });
});
