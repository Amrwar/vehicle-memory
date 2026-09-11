import { describe, expect, it } from 'vitest';

import {
  type Candidate,
  looksLikeApproval,
  looksLikeOptOut,
  matchInbound,
  priorityOf,
  quotedJobNumber,
} from './inbound';

const at = (iso: string) => new Date(`${iso}T09:00:00`);

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    customerId: 'cust-1',
    customerName: 'Maria Okonkwo',
    openJobs: [],
    lastMessagedJobId: null,
    ...overrides,
  };
}

describe('quotedJobNumber', () => {
  it('reads a number the customer copied from us', () => {
    expect(quotedJobNumber('Re: job 10482 — yes please')).toBe(10_482);
    expect(quotedJobNumber('about #10482')).toBe(10_482);
    expect(quotedJobNumber('your ref 10482')).toBe(10_482);
  });

  it('does not treat every number in a message as a job', () => {
    // A postcode, a price and a registration all contain digits. A rule loose
    // enough to catch them files replies against whichever job shares a number.
    expect(quotedJobNumber('I am at SK4 3BB, back at 2pm')).toBeNull();
    expect(quotedJobNumber('Can you do it for 250')).toBeNull();
    expect(quotedJobNumber('MK20 XRT is the reg')).toBeNull();
  });

  it('has nothing to say about an ordinary reply', () => {
    expect(quotedJobNumber('Thanks, see you then')).toBeNull();
  });
});

describe('looksLikeApproval', () => {
  it('recognises the short answers people actually send', () => {
    for (const reply of ['Yes', 'yes ', 'OK', 'go ahead', 'Approved', 'do it', 'Y']) {
      expect(looksLikeApproval(reply)).toBe(true);
    }
  });

  it('does not read a sentence containing yes as an approval', () => {
    // An approval worth thousands does not rest on a regular expression. This
    // only decides where the message sits in a list.
    expect(looksLikeApproval('Yes I got your message but I need to think about the price')).toBe(
      false,
    );
    expect(looksLikeApproval('yes, but only the brakes not the discs')).toBe(false);
  });
});

describe('looksLikeOptOut', () => {
  it('recognises somebody asking to be left alone', () => {
    for (const reply of ['STOP', 'stop', 'unsubscribe', 'opt out', 'remove me']) {
      expect(looksLikeOptOut(reply)).toBe(true);
    }
  });

  it('does not read a sentence about stopping as one', () => {
    expect(looksLikeOptOut('Can you stop the work until I call you back')).toBe(false);
  });
});

describe('matchInbound', () => {
  it('is certain when they quoted the job', () => {
    const match = matchInbound({
      body: 'job 10482 yes',
      candidates: [],
      quotedJob: { id: 'job-1', number: 10_482, customerId: 'cust-1' },
    });

    expect(match.confidence).toBe('CERTAIN');
    expect(match.jobId).toBe('job-1');
    expect(match.needsChoosing).toBe(false);
  });

  it('says so plainly when nobody uses that address', () => {
    const match = matchInbound({ body: 'hello', candidates: [], quotedJob: null });

    expect(match.confidence).toBe('NONE');
    expect(match.needsChoosing).toBe(true);
  });

  it('refuses to choose between two customers on one address', () => {
    // A couple, or a company address on several accounts. Picking one files a
    // reply about one car under another.
    const match = matchInbound({
      body: 'any news',
      candidates: [candidate(), candidate({ customerId: 'cust-2', customerName: 'David Chen' })],
      quotedJob: null,
    });

    expect(match.confidence).toBe('POSSIBLE');
    expect(match.customerId).toBeNull();
    expect(match.needsChoosing).toBe(true);
  });

  it('files it against the one job they have open', () => {
    const match = matchInbound({
      body: 'any news',
      candidates: [
        candidate({ openJobs: [{ id: 'job-9', number: 10_500, shortDescription: 'Brakes' }] }),
      ],
      quotedJob: null,
    });

    expect(match.confidence).toBe('PROBABLE');
    expect(match.jobId).toBe('job-9');
    expect(match.needsChoosing).toBe(false);
  });

  it('asks which when they have several open', () => {
    const match = matchInbound({
      body: 'any news',
      candidates: [
        candidate({
          openJobs: [
            { id: 'job-9', number: 10_500, shortDescription: 'Brakes' },
            { id: 'job-10', number: 10_501, shortDescription: 'Service' },
          ],
        }),
      ],
      quotedJob: null,
    });

    expect(match.confidence).toBe('POSSIBLE');
    expect(match.customerId).toBe('cust-1');
    expect(match.jobId).toBeNull();
    expect(match.needsChoosing).toBe(true);
  });

  it('falls back to the last job anybody messaged them about', () => {
    const match = matchInbound({
      body: 'thanks',
      candidates: [candidate({ lastMessagedJobId: 'job-old' })],
      quotedJob: null,
    });

    expect(match.jobId).toBe('job-old');
    expect(match.why).toContain('nothing open');
  });

  it('admits when there is nothing to attach it to', () => {
    const match = matchInbound({ body: 'thanks', candidates: [candidate()], quotedJob: null });

    expect(match.customerId).toBe('cust-1');
    expect(match.jobId).toBeNull();
  });
});

describe('priorityOf', () => {
  const received = at('2026-09-11');

  it('puts somebody asking to be left alone first', () => {
    // Acted on today or the workshop is breaking a promise.
    const top = priorityOf({ body: 'STOP', confidence: 'CERTAIN', receivedAt: received });

    expect(top.rank).toBe(0);
    expect(top.label).toContain('left alone');
  });

  it('then somebody apparently approving work', () => {
    expect(priorityOf({ body: 'yes', confidence: 'CERTAIN', receivedAt: received }).rank).toBe(1);
  });

  it('then anything nobody could file', () => {
    expect(priorityOf({ body: 'hello', confidence: 'NONE', receivedAt: received }).rank).toBe(2);
  });

  it('and an ordinary filed reply last, with nothing to label it', () => {
    const ordinary = priorityOf({
      body: 'See you Tuesday',
      confidence: 'PROBABLE',
      receivedAt: received,
    });

    expect(ordinary.rank).toBe(3);
    expect(ordinary.label).toBeNull();
  });
});
