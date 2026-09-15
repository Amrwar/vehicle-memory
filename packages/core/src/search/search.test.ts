import { describe, expect, it } from 'vitest';

import { isSearchable, rankHits, readQuery, recipients, type SearchHit, straightTo } from './index';

describe('reading what was typed', () => {
  it('reads a plate however it was typed', () => {
    const q = readQuery(' bj21 oyd ');
    expect(q.compact).toBe('BJ21OYD');
    expect(q.looksLikeRegistration).toBe(true);
    expect(q.looksLikeVin).toBe(false);
    expect(readQuery('bj21-oyd').compact).toBe('BJ21OYD');
  });

  it('reads a VIN, however it was spaced, and not sixteen characters', () => {
    expect(readQuery('WOV F7ACB2 M8600002').looksLikeVin).toBe(true);
    expect(readQuery('WOVF7ACB2M860000').looksLikeVin).toBe(false);
  });

  it('reads a telephone number as its digits', () => {
    expect(readQuery('0161 496 5522').phoneDigits).toBe('01614965522');
    expect(readQuery('+44 (161) 496-5522').phoneDigits).toBe('441614965522');
    expect(readQuery('Maria 0161').phoneDigits).toBeNull();
    expect(readQuery('12345').phoneDigits).toBeNull();
  });

  it('reads a job number', () => {
    expect(readQuery('10484').jobNumber).toBe(10484);
    expect(readQuery('#10484').jobNumber).toBe(10484);
    expect(readQuery('job 10484').jobNumber).toBe(10484);
    expect(readQuery('INV-1039').jobNumber).toBeNull();
  });

  it('needs two characters', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' ab ')).toBe(true);
    expect(readQuery('a@b').looksLikeEmail).toBe(true);
  });
});

describe('the result they meant', () => {
  const hit = (kind: SearchHit['kind'], title: string, exact = false): SearchHit => ({
    kind,
    id: title,
    title,
    subtitle: null,
    href: `/${title}`,
    exact,
  });

  it('puts exact identifiers first, then by kind', () => {
    expect(
      rankHits([hit('customer', 'Maria'), hit('job', '#10484', true), hit('vehicle', 'BMW')]).map(
        (h) => h.title,
      ),
    ).toEqual(['#10484', 'BMW', 'Maria']);
  });

  it('goes straight to a single exact match, and not to one of two', () => {
    expect(straightTo([hit('vehicle', 'BJ21 OYD', true), hit('customer', 'x')])?.title).toBe(
      'BJ21 OYD',
    );
    expect(straightTo([hit('job', '1', true), hit('invoice', '1', true)])).toBeNull();
    expect(straightTo([hit('customer', 'Maria')])).toBeNull();
  });
});

describe('who is told', () => {
  it('everyone who could act on it, once, except whoever caused it', () => {
    const members = [
      { userId: 'a', role: 'OWNER' },
      { userId: 'b', role: 'TECHNICIAN' },
      { userId: 'c', role: 'SERVICE_ADVISOR' },
      { userId: 'a', role: 'OWNER' },
    ];
    expect(
      recipients({
        members,
        can: (role) => role !== 'TECHNICIAN',
        exceptUserId: 'c',
      }).map((m) => m.userId),
    ).toEqual(['a']);
  });
});
