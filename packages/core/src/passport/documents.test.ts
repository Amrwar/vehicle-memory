import { describe, expect, it } from 'vitest';

import {
  assertDocumentAcceptable,
  assertRemovable,
  describeExpiry,
  DocumentError,
  documentKindLabel,
  expiryState,
  mayRemoveDocument,
  paperworkSummary,
} from './documents';

const now = new Date(2026, 8, 13, 12);
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentError) return error.code;
    throw error;
  }
  return 'ALLOWED';
}

describe('assertDocumentAcceptable', () => {
  const pdf = {
    kind: 'MOT_CERTIFICATE' as const,
    title: 'MOT 2026',
    mimeType: 'application/pdf',
    sizeBytes: 120_000,
  };

  it('takes a titled PDF or picture of the paper', () => {
    expect(codeOf(() => assertDocumentAcceptable(pdf))).toBe('ALLOWED');
    expect(codeOf(() => assertDocumentAcceptable({ ...pdf, mimeType: 'image/jpeg' }))).toBe(
      'ALLOWED',
    );
  });

  it('insists on a title', () => {
    expect(codeOf(() => assertDocumentAcceptable({ ...pdf, title: '  ' }))).toBe('NO_TITLE');
  });

  it('refuses a spreadsheet, and a PDF where a photograph was asked for', () => {
    expect(
      codeOf(() => assertDocumentAcceptable({ ...pdf, mimeType: 'application/vnd.ms-excel' })),
    ).toBe('BAD_TYPE');
    expect(codeOf(() => assertDocumentAcceptable({ ...pdf, kind: 'PHOTO' }))).toBe('BAD_TYPE');
    expect(
      codeOf(() => assertDocumentAcceptable({ ...pdf, kind: 'PHOTO', mimeType: 'image/png' })),
    ).toBe('ALLOWED');
  });

  it('refuses an empty or oversized file', () => {
    expect(codeOf(() => assertDocumentAcceptable({ ...pdf, sizeBytes: 0 }))).toBe('TOO_LARGE');
    expect(codeOf(() => assertDocumentAcceptable({ ...pdf, sizeBytes: 13 * 1024 * 1024 }))).toBe(
      'TOO_LARGE',
    );
  });

  it('refuses an expiry before the issue', () => {
    expect(
      codeOf(() => assertDocumentAcceptable({ ...pdf, issuedAt: days(0), expiresAt: days(-1) })),
    ).toBe('BAD_DATES');
    expect(
      codeOf(() => assertDocumentAcceptable({ ...pdf, issuedAt: days(0), expiresAt: days(365) })),
    ).toBe('ALLOWED');
  });
});

describe('expiry', () => {
  it('names the state', () => {
    expect(expiryState(null, now)).toBe('NONE');
    expect(expiryState(days(-1), now)).toBe('EXPIRED');
    expect(expiryState(days(10), now)).toBe('SOON');
    expect(expiryState(days(30), now)).toBe('SOON');
    expect(expiryState(days(31), now)).toBe('OK');
  });

  it('says it in words', () => {
    expect(describeExpiry(null, now)).toBe('No expiry');
    expect(describeExpiry(days(-1), now)).toMatch(/^Expired 12 Sept 2026/);
    expect(describeExpiry(days(10), now)).toMatch(/^Runs out/);
    expect(describeExpiry(days(200), now)).toMatch(/^Valid until/);
  });
});

describe('paperworkSummary', () => {
  it('says there is nothing when there is nothing', () => {
    const summary = paperworkSummary([], now);
    expect(summary.statement).toBe('No paperwork on this vehicle yet.');
    expect(summary.mot).toBe('NONE');
  });

  it('takes the latest live certificate of each kind and ignores removed ones', () => {
    const summary = paperworkSummary(
      [
        { kind: 'MOT_CERTIFICATE', expiresAt: days(-200), removedAt: null },
        { kind: 'MOT_CERTIFICATE', expiresAt: days(20), removedAt: null },
        { kind: 'INSURANCE', expiresAt: days(300), removedAt: new Date() },
        { kind: 'INSURANCE', expiresAt: days(-3), removedAt: null },
        { kind: 'PHOTO', expiresAt: null, removedAt: null },
      ],
      now,
    );

    expect(summary.counts).toEqual({ MOT_CERTIFICATE: 2, INSURANCE: 1, PHOTO: 1 });
    expect(summary.motExpiresAt).toEqual(days(20));
    expect(summary.mot).toBe('SOON');
    expect(summary.insurance).toBe('EXPIRED');
    expect(summary.statement).toBe(
      '4 documents on file. The MOT runs out on 3 October. The insurance has expired.',
    );
  });
});

describe('removal', () => {
  const doc = { uploadedByOrgId: 'org_a', uploadedByUserId: 'user_a', removedAt: null };

  it('is for the uploading workshop, the uploader, or the owner', () => {
    expect(mayRemoveDocument(doc, { orgId: 'org_a', userId: 'user_b', ownsVehicle: false })).toBe(
      true,
    );
    expect(mayRemoveDocument(doc, { orgId: 'org_b', userId: 'user_a', ownsVehicle: false })).toBe(
      true,
    );
    expect(mayRemoveDocument(doc, { orgId: null, userId: 'user_z', ownsVehicle: true })).toBe(true);
    expect(mayRemoveDocument(doc, { orgId: 'org_b', userId: 'user_b', ownsVehicle: false })).toBe(
      false,
    );
  });

  it('needs a reason and cannot happen twice', () => {
    const actor = { orgId: 'org_a', userId: 'user_a', ownsVehicle: false };
    expect(codeOf(() => assertRemovable(doc, actor, ' '))).toBe('NO_REASON');
    expect(
      codeOf(() => assertRemovable({ ...doc, removedAt: new Date() }, actor, 'wrong car')),
    ).toBe('GONE');
    expect(
      codeOf(() => assertRemovable(doc, { ...actor, orgId: 'org_b', userId: 'x' }, 'wrong car')),
    ).toBe('NOT_ALLOWED');
    expect(codeOf(() => assertRemovable(doc, actor, 'wrong car'))).toBe('ALLOWED');
  });
});

describe('documentKindLabel', () => {
  it('has a word for everything', () => {
    expect(documentKindLabel('REGISTRATION_CERTIFICATE')).toBe('Registration certificate');
    expect(documentKindLabel('OTHER')).toBe('Other');
  });
});
