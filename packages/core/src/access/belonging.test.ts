import { describe, expect, it } from 'vitest';

import {
  actingAs,
  type Belonging,
  describeChoice,
  mayEnter,
  mustChoose,
  NOT_YOURS,
  orgOnSignIn,
  sessionsEndedByLeaving,
} from './belonging';

const at = (orgId: string, orgName: string, isActive = true): Belonging => ({
  orgId,
  orgName,
  role: 'TECHNICIAN',
  isActive,
});

describe('where somebody lands when they sign in', () => {
  it('puts them straight in when there is nothing to choose between', () => {
    expect(orgOnSignIn([at('a', 'Hillside Motors')])).toBe('a');
  });

  it('asks when there is more than one', () => {
    expect(orgOnSignIn([at('a', 'Hillside'), at('b', 'Kirkstall')])).toBeNull();
    expect(mustChoose([at('a', 'Hillside'), at('b', 'Kirkstall')])).toBe(true);
  });

  it('does not count a membership that has ended', () => {
    // Two rows, one workshop. Not a choice.
    expect(orgOnSignIn([at('a', 'Hillside'), at('b', 'Kirkstall', false)])).toBe('a');
    expect(mustChoose([at('a', 'Hillside'), at('b', 'Kirkstall', false)])).toBe(false);
  });

  it('leaves a portal customer with nothing, which is not the same as a choice', () => {
    expect(orgOnSignIn([])).toBeNull();
    expect(mustChoose([])).toBe(false);
  });
});

describe('acting in one of them', () => {
  const both = [at('a', 'Hillside'), at('b', 'Kirkstall')];

  it('acts in the one on the session', () => {
    expect(actingAs(both, 'b')?.orgName).toBe('Kirkstall');
  });

  it('acts in none when the session names none', () => {
    // The fallback this replaces returned memberships[0] here, which is how
    // somebody ended up in a workshop nobody chose.
    expect(actingAs(both, null)).toBeNull();
  });

  it('stops acting in one the person has been taken off, at once', () => {
    expect(actingAs([at('a', 'Hillside'), at('b', 'Kirkstall', false)], 'b')).toBeNull();
  });

  it('refuses one they have never belonged to, saying nothing about it', () => {
    expect(mayEnter(both, 'somebody-elses-workshop')).toBe(false);
    expect(NOT_YOURS).not.toMatch(/exist|found|unknown/i);
  });
});

describe('being taken off one workshop', () => {
  const sessions = [
    { id: 's1', orgId: 'a' },
    { id: 's2', orgId: 'b' },
    { id: 's3', orgId: 'a' },
    { id: 's4', orgId: null },
  ];

  it('ends only the sessions in that workshop', () => {
    expect(sessionsEndedByLeaving(sessions, 'a')).toEqual(['s1', 's3']);
  });

  it('leaves the other workshop alone, which is the whole point', () => {
    expect(sessionsEndedByLeaving(sessions, 'a')).not.toContain('s2');
  });

  it('leaves somebody sitting on the chooser alone', () => {
    expect(sessionsEndedByLeaving(sessions, 'a')).not.toContain('s4');
  });
});

describe('what the chooser says', () => {
  it('names both when there are two', () => {
    expect(describeChoice([at('a', 'Hillside'), at('b', 'Kirkstall')])).toBe(
      'You work at Hillside and Kirkstall. Choose which one you are in.',
    );
  });

  it('counts them when there are more', () => {
    expect(describeChoice([at('a', 'A'), at('b', 'B'), at('c', 'C')])).toContain('3 workshops');
  });

  it('never says "1 workshops"', () => {
    expect(describeChoice([at('a', 'Hillside')])).toBe('You work at Hillside.');
  });

  it('says so plainly when there are none', () => {
    expect(describeChoice([])).toContain('not on any');
  });
});
