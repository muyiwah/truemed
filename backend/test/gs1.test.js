import { describe, it, expect } from 'vitest';
import { parseGs1, gtinCheckDigitValid, withCheckDigit, gs1DateToMonth } from '../src/lib/gs1.js';

const GS = String.fromCharCode(29);

describe('GS1', () => {
  it('validates GTIN check digits', () => {
    expect(gtinCheckDigitValid('09506000134352')).toBe(true);
    expect(gtinCheckDigitValid('09506000134353')).toBe(false);
    expect(withCheckDigit('0950600013435')).toBe('09506000134352');
  });

  it('parses the bracketed form', () => {
    const r = parseGs1('(01)09506000134352(17)280531(10)AB123(21)SN0001');
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ gtin: '09506000134352', expiry: '2028-05', batch: 'AB123', serial: 'SN0001' });
  });

  it('parses the raw FNC1 form with variable fields in any order', () => {
    const r = parseGs1(`]d201095060001343521728053110AB123${GS}21SN0001`);
    expect(r.ok).toBe(true);
    expect(r.batch).toBe('AB123');
    expect(r.serial).toBe('SN0001');
  });

  it('flags a bad check digit', () => {
    const r = parseGs1('(01)09506000134353(17)280531(10)AB1(21)S1');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('bad_gtin_check_digit');
  });

  it('flags an impossible date and a missing GTIN', () => {
    expect(parseGs1('(01)09506000134352(17)281331(10)A(21)B').errors).toContain('bad_date_17');
    expect(parseGs1('(10)A(21)B').errors).toContain('missing_gtin');
  });

  it('treats DD=00 as a valid month-end date', () => {
    expect(gs1DateToMonth('280500')).toBe('2028-05');
  });
});
