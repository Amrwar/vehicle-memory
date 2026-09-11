import { describe, expect, it } from 'vitest';

import {
  clock,
  meets,
  planDay,
  skillMatrix,
  type SkillLevel,
  type Technician,
  type WorkItem,
} from './plan';
import { absentOn, capacityFor, daysWithRoom, netMinutes, weekdayOf } from './workload';

/** Anchored at nine, so a bare date does not shift a day west of London. */
const at = (iso: string) => new Date(`${iso}T09:00:00`);

/** Tuesday. */
const TUESDAY = at('2026-09-15');

function tech(
  employeeId: string,
  name: string,
  skills: Record<string, SkillLevel>,
  overrides: Partial<Technician> = {},
): Technician {
  return {
    employeeId,
    name,
    startMinute: 8 * 60,
    endMinute: 17 * 60,
    skills: new Map(Object.entries(skills)),
    committed: [],
    ...overrides,
  };
}

function item(id: string, minutes: number, overrides: Partial<WorkItem> = {}): WorkItem {
  return { id, label: id, minutes, requirements: [], ...overrides };
}

const BAYS = [
  { bayId: 'b1', name: 'Bay 1', capability: null, committed: [] },
  { bayId: 'b2', name: 'Bay 2', capability: null, committed: [] },
];

const HOURS = { openMinute: 8 * 60, closeMinute: 17 * 60 };

describe('weekdayOf', () => {
  it('numbers Monday as one and Sunday as seven', () => {
    // ISO, not the Javascript default where Sunday is zero. Every pattern row
    // in the database is stored this way and an off-by-one here would put
    // everybody on the wrong day.
    expect(weekdayOf(at('2026-09-14'))).toBe(1);
    expect(weekdayOf(at('2026-09-20'))).toBe(7);
  });
});

describe('absentOn', () => {
  const absences = [{ employeeId: 'e1', startsOn: at('2026-09-14'), endsOn: at('2026-09-18') }];

  it('includes both ends of the leave', () => {
    // An exclusive end is how somebody gets booked in on the last day of
    // their own holiday.
    expect(absentOn(absences, 'e1', at('2026-09-14'))).toBe(true);
    expect(absentOn(absences, 'e1', at('2026-09-18'))).toBe(true);
  });

  it('includes the days between', () => {
    expect(absentOn(absences, 'e1', at('2026-09-16'))).toBe(true);
  });

  it('excludes the days either side, and other people', () => {
    expect(absentOn(absences, 'e1', at('2026-09-13'))).toBe(false);
    expect(absentOn(absences, 'e1', at('2026-09-19'))).toBe(false);
    expect(absentOn(absences, 'e2', at('2026-09-16'))).toBe(false);
  });
});

describe('netMinutes', () => {
  it('takes the break off', () => {
    expect(
      netMinutes({
        employeeId: 'e1',
        weekday: 2,
        startMinute: 480,
        endMinute: 1020,
        breakMinutes: 60,
      }),
    ).toBe(480);
  });

  it('never goes negative on a nonsense row', () => {
    expect(
      netMinutes({
        employeeId: 'e1',
        weekday: 2,
        startMinute: 480,
        endMinute: 500,
        breakMinutes: 60,
      }),
    ).toBe(0);
  });
});

describe('capacityFor', () => {
  const people = [
    { employeeId: 'e1', name: 'John' },
    { employeeId: 'e2', name: 'Mike' },
  ];

  const patterns = people.map((person) => ({
    employeeId: person.employeeId,
    weekday: 2 as const,
    startMinute: 8 * 60,
    endMinute: 17 * 60,
    breakMinutes: 60,
  }));

  it('adds up the people who are actually in', () => {
    const day = capacityFor({
      date: TUESDAY,
      people,
      patterns,
      absences: [],
      bays: 3,
      openMinutes: 9 * 60,
      booked: [{ employeeId: 'e1', minutes: 240 }],
    });

    expect(day.peopleMinutes).toBe(960);
    expect(day.bookedMinutes).toBe(240);
    expect(day.overbookedMinutes).toBe(0);
  });

  it('takes an absent person out entirely rather than counting them idle', () => {
    const day = capacityFor({
      date: TUESDAY,
      people,
      patterns,
      absences: [{ employeeId: 'e2', startsOn: TUESDAY, endsOn: TUESDAY }],
      bays: 3,
      openMinutes: 9 * 60,
      booked: [],
    });

    expect(day.peopleMinutes).toBe(480);
    expect(day.absent).toBe(1);
    // Null, not zero. A person who is not in has no utilisation, and 0% would
    // read on the page as somebody standing about.
    expect(day.people.find((person) => person.employeeId === 'e2')!.utilisation).toBeNull();
  });

  it('says the bays are the limit when they are', () => {
    // Six technicians and one ramp is a one-ramp workshop, and the answer to
    // it is not another technician.
    const day = capacityFor({
      date: TUESDAY,
      people,
      patterns,
      absences: [],
      bays: 1,
      openMinutes: 9 * 60,
      booked: [{ employeeId: null, minutes: 900 }],
    });

    expect(day.bayMinutes).toBe(540);
    expect(day.effectiveMinutes).toBe(540);
    expect(day.constrainedBy).toBe('BAYS');
    expect(day.summary).toContain('more hands will not help');
  });

  it('says the people are the limit when they are', () => {
    const day = capacityFor({
      date: TUESDAY,
      people,
      patterns,
      absences: [{ employeeId: 'e2', startsOn: TUESDAY, endsOn: TUESDAY }],
      bays: 6,
      openMinutes: 9 * 60,
      booked: [{ employeeId: 'e1', minutes: 600 }],
    });

    expect(day.constrainedBy).toBe('PEOPLE');
    expect(day.overbookedMinutes).toBe(120);
  });

  it('names neither when nothing is overbooked', () => {
    const day = capacityFor({
      date: TUESDAY,
      people,
      patterns,
      absences: [],
      bays: 2,
      openMinutes: 9 * 60,
      booked: [{ employeeId: 'e1', minutes: 60 }],
    });

    expect(day.constrainedBy).toBeNull();
  });

  it('says plainly when nobody is working', () => {
    const day = capacityFor({
      date: at('2026-09-20'),
      people,
      patterns,
      absences: [],
      bays: 3,
      openMinutes: 9 * 60,
      booked: [],
    });

    expect(day.peopleMinutes).toBe(0);
    expect(day.summary).toBe('Nobody is working that day.');
  });
});

describe('daysWithRoom', () => {
  it('offers the soonest day that could actually take it', () => {
    const days = [
      { date: at('2026-09-15'), effectiveMinutes: 480, bookedMinutes: 460 },
      { date: at('2026-09-17'), effectiveMinutes: 480, bookedMinutes: 120 },
      { date: at('2026-09-16'), effectiveMinutes: 480, bookedMinutes: 60 },
    ].map((day) => ({ ...day, weekday: 2 as const })) as never as Parameters<
      typeof daysWithRoom
    >[0];

    const room = daysWithRoom(days, 240);

    expect(room).toHaveLength(2);
    expect(room[0]!.date).toEqual(at('2026-09-16'));
  });
});

describe('meets', () => {
  it('treats the levels as ordered', () => {
    expect(meets('EXPERT', 'COMPETENT')).toBe(true);
    expect(meets('COMPETENT', 'COMPETENT')).toBe(true);
    expect(meets('LEARNING', 'COMPETENT')).toBe(false);
  });

  it('treats a missing skill as cannot, never as can', () => {
    expect(meets(undefined, 'LEARNING')).toBe(false);
  });
});

describe('planDay', () => {
  it('never gives work to somebody who cannot do it', () => {
    // The failure this whole module exists to prevent. It is discovered at
    // half past eight by a person holding a set of keys.
    const plan = planDay({
      items: [
        item('ac', 120, {
          requirements: [
            { skillId: 'ac', skillName: 'Air conditioning', minimumLevel: 'COMPETENT' },
          ],
        }),
      ],
      technicians: [tech('e1', 'John', { brakes: 'EXPERT' })],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments).toHaveLength(0);
    expect(plan.unplaced[0]!.reason).toBe('NOBODY_QUALIFIED');
    expect(plan.unplaced[0]!.why).toContain('air conditioning');
  });

  it('places work on somebody who can', () => {
    const plan = planDay({
      items: [
        item('ac', 120, {
          requirements: [
            { skillId: 'ac', skillName: 'Air conditioning', minimumLevel: 'COMPETENT' },
          ],
        }),
      ],
      technicians: [tech('e1', 'John', { brakes: 'EXPERT' }), tech('e2', 'Mike', { ac: 'EXPERT' })],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments).toHaveLength(1);
    expect(plan.assignments[0]!.technicianName).toBe('Mike');
    expect(plan.unplaced).toHaveLength(0);
  });

  it('gives every line a reason somebody can argue with', () => {
    const plan = planDay({
      items: [
        item('mot', 60, {
          requirements: [{ skillId: 'mot', skillName: 'MOT testing', minimumLevel: 'EXPERT' }],
        }),
      ],
      technicians: [tech('e1', 'John', { mot: 'EXPERT' })],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments[0]!.why).toContain('John is signed off on mot testing');
    expect(plan.assignments[0]!.why).toContain('Bay 1 is free from 08:00');
  });

  it('keeps the expert free when somebody less qualified will do', () => {
    // How a workshop actually runs. An expert held back is an expert
    // available for whatever comes through the door at eleven.
    const plan = planDay({
      items: [
        item('service', 60, {
          requirements: [{ skillId: 'svc', skillName: 'Servicing', minimumLevel: 'COMPETENT' }],
        }),
      ],
      technicians: [
        tech('e1', 'Expert', { svc: 'EXPERT' }),
        tech('e2', 'Competent', { svc: 'COMPETENT' }),
      ],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments[0]!.technicianName).toBe('Competent');
  });

  it('spreads work rather than filling one person', () => {
    const plan = planDay({
      items: [item('a', 120), item('b', 120)],
      technicians: [tech('e1', 'John', {}), tech('e2', 'Mike', {})],
      bays: BAYS,
      ...HOURS,
    });

    expect(new Set(plan.assignments.map((a) => a.employeeId)).size).toBe(2);
  });

  it('honours a promise before a longer job', () => {
    const plan = planDay({
      items: [item('long', 300), item('promised', 60, { promisedAt: at('2026-09-15') })],
      technicians: [tech('e1', 'John', {})],
      bays: [BAYS[0]!],
      ...HOURS,
    });

    expect(plan.assignments[0]!.itemId).toBe('promised');
    expect(plan.assignments[0]!.startMinute).toBe(8 * 60);
  });

  it('puts the longest first when nothing is promised', () => {
    // The decision that most affects how much of the day gets used: pack the
    // six-hour clutch first, or it is what is left at four o'clock.
    const plan = planDay({
      items: [item('short', 60), item('long', 300)],
      technicians: [tech('e1', 'John', {})],
      bays: [BAYS[0]!],
      ...HOURS,
    });

    expect(plan.assignments[0]!.itemId).toBe('long');
  });

  it('does not run anybody past the end of their own day', () => {
    const plan = planDay({
      items: [item('a', 300)],
      technicians: [tech('e1', 'Mornings', {}, { endMinute: 12 * 60 })],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments).toHaveLength(0);
    expect(plan.unplaced[0]!.reason).toBe('NO_ROOM');
  });

  it('works around what is already committed', () => {
    const plan = planDay({
      items: [item('a', 120)],
      technicians: [
        tech('e1', 'John', {}, { committed: [{ startMinute: 8 * 60, endMinute: 10 * 60 }] }),
      ],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.assignments[0]!.startMinute).toBe(10 * 60);
  });

  it('refuses to schedule work whose parts are not here', () => {
    const plan = planDay({
      items: [item('a', 60, { waitingOnParts: true })],
      technicians: [tech('e1', 'John', {})],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.unplaced[0]!.reason).toBe('WAITING_ON_PARTS');
  });

  it('says when a job simply does not fit in a day', () => {
    const plan = planDay({
      items: [item('a', 700)],
      technicians: [tech('e1', 'John', {})],
      bays: BAYS,
      ...HOURS,
    });

    expect(plan.unplaced[0]!.reason).toBe('TOO_LONG');
    expect(plan.unplaced[0]!.why).toContain('two days');
  });

  it('respects what a bay can take', () => {
    const plan = planDay({
      items: [item('a', 60, { needsCapability: 'LIFT' })],
      technicians: [tech('e1', 'John', {})],
      bays: [{ bayId: 'b1', name: 'Bay 1', capability: null, committed: [] }],
      ...HOURS,
    });

    expect(plan.unplaced[0]!.reason).toBe('NO_BAY');
    expect(plan.unplaced[0]!.why).toContain('LIFT');
  });

  it('never double-books a bay', () => {
    const plan = planDay({
      items: [item('a', 120), item('b', 120), item('c', 120)],
      technicians: [tech('e1', 'A', {}), tech('e2', 'B', {}), tech('e3', 'C', {})],
      bays: [BAYS[0]!],
      ...HOURS,
    });

    const spans = plan.assignments.map((a) => [a.startMinute, a.endMinute] as const);
    for (const [index, span] of spans.entries()) {
      for (const other of spans.slice(index + 1)) {
        expect(span[0] < other[1] && span[1] > other[0]).toBe(false);
      }
    }
  });

  it('does not mutate what it was given', () => {
    // The plan is run repeatedly as somebody adjusts it. Mutating the input
    // would make the second run disagree with the first for no visible reason.
    const technicians = [tech('e1', 'John', {})];
    const bays = [{ bayId: 'b1', name: 'Bay 1', capability: null, committed: [] }];

    planDay({ items: [item('a', 60)], technicians, bays, ...HOURS });

    expect(technicians[0]!.committed).toHaveLength(0);
    expect(bays[0]!.committed).toHaveLength(0);
  });

  it('gives the same answer twice', () => {
    const build = () =>
      planDay({
        items: [item('a', 120), item('b', 90), item('c', 60)],
        technicians: [tech('e1', 'John', {}), tech('e2', 'Mike', {})],
        bays: BAYS,
        ...HOURS,
      });

    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});

describe('clock', () => {
  it('reads as a time', () => {
    expect(clock(8 * 60)).toBe('08:00');
    expect(clock(13 * 60 + 30)).toBe('13:30');
  });
});

describe('skillMatrix', () => {
  const people = [
    { employeeId: 'e1', name: 'John' },
    { employeeId: 'e2', name: 'Mike' },
  ];
  const skills = [
    { skillId: 'brakes', name: 'Brakes' },
    { skillId: 'ev', name: 'Electric vehicles' },
    { skillId: 'ac', name: 'Air conditioning' },
  ];

  it('keeps a column for a skill nobody has, because the gap is the point', () => {
    const matrix = skillMatrix({
      people,
      skills,
      held: [{ employeeId: 'e1', skillId: 'brakes', level: 'EXPERT' }],
    });

    expect(matrix.skills).toHaveLength(3);
    expect(matrix.skills.find((skill) => skill.skillId === 'ev')!.cover).toBe(0);
    expect(matrix.rows[1]!.levels).toEqual([null, null, null]);
  });

  it('names the person a skill depends on entirely', () => {
    // The number that matters on this screen is one. A skill only one person
    // has is a skill the workshop loses the day they are ill.
    const matrix = skillMatrix({
      people,
      skills,
      held: [
        { employeeId: 'e1', skillId: 'brakes', level: 'EXPERT' },
        { employeeId: 'e2', skillId: 'brakes', level: 'COMPETENT' },
        { employeeId: 'e2', skillId: 'ac', level: 'COMPETENT' },
      ],
    });

    expect(matrix.skills.find((skill) => skill.skillId === 'ac')!.only).toBe('Mike');
    expect(matrix.skills.find((skill) => skill.skillId === 'brakes')!.only).toBeNull();
  });
});
