import { describe, expect, it } from 'vitest';

import {
  decideScan,
  parseScanCode,
  SCAN_KINDS,
  scanCode,
  scanDestination,
  passportUrl,
  whatItCouldBe,
} from './index';

describe('the code on a label', () => {
  it('round-trips every kind there is', () => {
    for (const kind of SCAN_KINDS) {
      expect(parseScanCode(scanCode(kind, 'cku9x2abc'))).toEqual({ kind, id: 'cku9x2abc' });
    }
  });

  it('stays readable, so somebody can type it when the scan fails', () => {
    // A crease, a thumbprint, a dead scanner. An opaque hash would have been
    // shorter and would have left that person with nothing.
    expect(scanCode('job', 'cku9x2abc')).toBe('CNT:job:cku9x2abc');
  });

  it('forgives a scanner set to upper case', () => {
    expect(parseScanCode('CNT:JOB:cku9x2abc')).toEqual({ kind: 'job', id: 'cku9x2abc' });
  });

  it('keeps the id exactly as it was, because a cuid is case-sensitive', () => {
    expect(parseScanCode('CNT:job:CKU9x2AbC')?.id).toBe('CKU9x2AbC');
  });

  it('forgives surrounding space, which scanners add', () => {
    expect(parseScanCode('  CNT:part:abc123  ')).toEqual({ kind: 'part', id: 'abc123' });
  });

  it('is nothing when it is not ours', () => {
    expect(parseScanCode('5012345678900')).toBeNull();
    expect(parseScanCode('CNT:nonsense:abc')).toBeNull();
    expect(parseScanCode('OTHER:job:abc')).toBeNull();
    expect(parseScanCode('CNT:job:')).toBeNull();
    expect(parseScanCode('')).toBeNull();
  });

  it('does not truncate an id that contains the separator', () => {
    // Nothing stops an id containing a colon later, and a code that silently
    // dropped the tail would resolve to the wrong record.
    expect(parseScanCode('CNT:bin:A2:SHELF:3')).toEqual({ kind: 'bin', id: 'A2:SHELF:3' });
  });
});

describe('what a bare scan could be', () => {
  it('is exactly one thing when it is one of ours', () => {
    expect(whatItCouldBe('CNT:job:abc')).toEqual([
      { kind: 'job', value: 'abc', because: 'a Carnet code' },
    ]);
  });

  it('offers both the job and the part for a number that could be either', () => {
    // The shape of a string is not evidence. Offering two and letting the
    // database narrow it is the honest move.
    const kinds = whatItCouldBe('10482').map((one) => one.kind);
    expect(kinds).toContain('job');
    expect(kinds).toContain('part');
  });

  it('recognises a VIN by its shape', () => {
    const kinds = whatItCouldBe('WBAJA71090G123456').map((one) => one.kind);
    expect(kinds).toContain('vehicle');
  });

  it('offers a registration and a part number for the same string', () => {
    const kinds = whatItCouldBe('LR21KJD').map((one) => one.kind);
    expect(kinds).toContain('vehicle');
    expect(kinds).toContain('part');
  });

  it('always considers a supplier barcode a possible part', () => {
    expect(whatItCouldBe('5012345678900').map((one) => one.kind)).toContain('part');
  });

  it('is nothing for nothing', () => {
    expect(whatItCouldBe('')).toEqual([]);
    expect(whatItCouldBe('   ')).toEqual([]);
  });

  it('says why each was considered, so a refusal can be explained', () => {
    for (const candidate of whatItCouldBe('10482')) {
      expect(candidate.because).toBeTruthy();
    }
  });
});

describe('what to do with what came back', () => {
  const job = { kind: 'job' as const, id: 'j1', label: 'Job #10482' };
  const part = { kind: 'part' as const, id: 'p1', label: 'Brake pads' };

  it('goes straight there when one thing matched', () => {
    expect(decideScan([job])).toEqual({ found: 'one', kind: 'job', id: 'j1', label: 'Job #10482' });
  });

  it('asks when two did, rather than taking the first', () => {
    // The one thing this must never do is open a job that is not the one whose
    // number was scanned.
    const outcome = decideScan([job, part]);
    expect(outcome.found).toBe('several');
    if (outcome.found === 'several') expect(outcome.matches).toHaveLength(2);
  });

  it('does not call one record found twice an ambiguity', () => {
    // A part matched by its own number and by its supplier's barcode is one
    // part, and a question about it would be a question about nothing.
    expect(decideScan([part, { ...part }]).found).toBe('one');
  });

  it('says none when nothing matched, rather than opening something', () => {
    expect(decideScan([])).toEqual({ found: 'none' });
  });
});

describe('where a scan takes somebody', () => {
  it('has a destination for every kind', () => {
    for (const kind of SCAN_KINDS) {
      expect(scanDestination(kind, 'abc')).toMatch(/^\//);
    }
  });

  it('takes a bin to the parts on it rather than to a record that does not exist', () => {
    expect(scanDestination('bin', 'A2/3')).toBe('/parts?bin=A2%2F3');
  });
});

describe('the one code a stranger may scan', () => {
  it('is the passport, and it is a public address', () => {
    expect(passportUrl('https://carnet.test/', 'tok123')).toBe('https://carnet.test/p/tok123');
  });

  it('does not double the slash', () => {
    expect(passportUrl('https://carnet.test', 'tok123')).toBe('https://carnet.test/p/tok123');
  });
});
