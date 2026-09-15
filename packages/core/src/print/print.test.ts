import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_PRINT_KINDS,
  PrintError,
  PRINT_PERMISSION,
  fitText,
  isPrintKind,
  keyTagFor,
  labelSheets,
  pdfFilename,
  watermarkFor,
} from './index';

describe('documents', () => {
  it('knows its kinds and who reads them', () => {
    expect(isPrintKind('invoice')).toBe(true);
    expect(isPrintKind('payslip')).toBe(false);
    expect(PRINT_PERMISSION.labels).toBe('inventory:read');
    expect(CUSTOMER_PRINT_KINDS).not.toContain('work-order');
  });

  it('stamps what is not final', () => {
    expect(watermarkFor('estimate', 'DRAFT')).toBe('Draft');
    expect(watermarkFor('estimate', 'DECLINED')).toBe('Not approved');
    expect(watermarkFor('estimate', 'APPROVED')).toBeNull();
    expect(watermarkFor('invoice', 'VOID')).toBe('Void');
    expect(watermarkFor('invoice', 'PAID')).toBeNull();
    expect(watermarkFor('inspection', 'DRAFT')).toBe('Draft');
    expect(watermarkFor('work-order', 'CANCELLED')).toBe('Cancelled');
  });

  it('names a file plainly', () => {
    expect(pdfFilename({ kind: 'invoice', number: 'INV-1042', orgName: 'Hillside Motors' })).toBe(
      'Hillside-Motors-invoice-INV-1042.pdf',
    );
    expect(
      pdfFilename({ kind: 'estimate', number: '#10482 v2', orgName: 'Garage Élan & Fils' }),
    ).toBe('Garage-Elan-Fils-estimate-10482-v2.pdf');
    expect(pdfFilename({ kind: 'invoice', number: '1', orgName: 'ورشة' })).toBe(
      'Carnet-invoice-1.pdf',
    );
  });

  it('fills label sheets in order and refuses nonsense', () => {
    const sheets = labelSheets([
      { id: 'a', copies: 20 },
      { id: 'b', copies: 3 },
    ]);
    expect(sheets.map((sheet) => sheet.length)).toEqual([21, 2]);
    expect(sheets[1]).toEqual(['b', 'b']);
    expect(labelSheets([{ id: 'a', copies: 0 }])).toEqual([['a']]);
    expect(labelSheets([{ id: 'a', copies: 1000 }]).flat()).toHaveLength(100);
    expect(() => labelSheets([])).toThrow(PrintError);
    expect(() =>
      labelSheets(Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, copies: 100 }))),
    ).toThrow('Print at most 500');
  });

  it('fits text without cutting a word in half', () => {
    expect(fitText('Front brake pads and discs', 18)).toBe('Front brake pads…');
    expect(fitText('Short', 18)).toBe('Short');
  });

  it('puts the plate, the job, the surname and the hook on a key tag', () => {
    expect(
      keyTagFor({
        registration: 'BX70 KHT',
        jobNumber: 10483,
        customerName: 'Maria Okonkwo',
        make: 'Vauxhall',
        model: 'Vivaro',
        hook: '14',
      }),
    ).toEqual({
      headline: 'BX70 KHT',
      job: '#10483',
      customer: 'Okonkwo',
      vehicle: 'Vauxhall Vivaro',
      hook: '14',
    });
    expect(
      keyTagFor({
        registration: null,
        jobNumber: 7,
        customerName: 'Pennine',
        make: null,
        model: null,
        hook: ' ',
      }),
    ).toMatchObject({ headline: '#7', customer: 'Pennine', hook: null });
  });
});
