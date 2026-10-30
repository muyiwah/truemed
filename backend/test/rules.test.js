import { describe, it, expect } from 'vitest';
import { evaluate, resolveFields, publicView } from '../src/rules/index.js';

const today = new Date('2026-10-30T12:00:00Z');
const product = { _id: 'p1', brandName: 'DemoQuin', genericName: 'Artemether Lumefantrine', strength: '20/120mg', nafdacRegNo: 'A4-0000', normalShelfLifeMonths: 36, sourceUrl: 'demo' };
const shopA = { _id: 'shopA', name: 'Ikeja Care Pharmacy (demo)', city: 'Lagos' };
const shopKano = { _id: 'shopK', name: 'Sabon Gari Pharmacy (demo)', city: 'Kano' };

const goodBarcode = { found: true, isGs1: true, ok: true, errors: [], gtin: '09506000134352', batch: 'DQ2601', expiry: '2028-05', serial: 'SN0001' };
const goodText = { brandName: 'DemoQuin', genericName: 'Artemether Lumefantrine', strength: '20/120mg', nafdacRegNo: 'A4-0000', batchNo: 'DQ2601', expiryDate: '2028-05', manufactureDate: '2026-05' };

function ctx(over = {}) {
  const { fields, printed } = resolveFields({ extracted: over.extracted ?? goodText, barcode: over.barcode === undefined ? goodBarcode : over.barcode, userValues: over.userValues });
  return { today, gate: 'home', fields, printed, product, alerts: [], confirmed: false, issuer: { participates: false }, ...over, extracted: undefined };
}
const ids = (r) => r.checks.filter((c) => c.status === 'fail').map((c) => c.id);

describe('verdicts', () => {
  it('genuine authorized chain when the confirmed shop matches custody', () => {
    const r = evaluate(ctx({ pack: { shopId: 'shopA', source: 'authorized', supplierName: 'Demo Distributors Ltd' }, packShop: shopA, answer: { sourceType: 'shop', shopId: 'shopA', confirmed: true } }));
    expect(r.verdict.code).toBe('genuine_authorized');
    expect(r.verdict.line).toMatch(/^No problems found in \d+ checks\.$/);
    expect(r.verdict.provenance).toContain('Ikeja Care Pharmacy (demo)');
    expect(r.verdict.disclaimer).toMatch(/not a lab test/);
  });

  it('open-market custody gets its own tier', () => {
    const r = evaluate(ctx({ pack: { shopId: 'shopA', source: 'open_market' }, packShop: shopA, answer: { sourceType: 'shop', shopId: 'shopA', confirmed: true } }));
    expect(r.verdict.code).toBe('checked_open_market');
    expect(r.verdict.provenance).toMatch(/from the open market/);
  });

  it('does not reveal provenance before the buyer answers (ask first)', () => {
    const r = evaluate(ctx({ pack: { shopId: 'shopA', source: 'authorized' }, packShop: shopA }));
    expect(r.verdict.provenance).toBeNull();
    expect(r.verdict.code).toBe('no_red_flags');
  });

  it('AI-read expiry in the past asks for confirmation first, then High risk', () => {
    const extracted = { ...goodText, manufactureDate: '2023-01', expiryDate: '2025-01' };
    const first = evaluate(ctx({ extracted, barcode: null }));
    expect(first.verdict.code).toBe('needs_confirmation');
    expect(first.verdict.confirmFields).toContain('expiry');
    const after = evaluate(ctx({ extracted, barcode: null, confirmed: true }));
    expect(after.verdict.code).toBe('high_risk');
    expect(after.verdict.title).toBe('Expired');
  });

  it('a user correction clears a misread', () => {
    const extracted = { ...goodText, manufactureDate: '2023-01', expiryDate: '2025-01' };
    const r = evaluate(ctx({ extracted, barcode: null, confirmed: true, userValues: { expiry: '2028-05' } }));
    expect(ids(r)).not.toContain('EXPIRED');
  });

  it('barcode vs print mismatch: "barcode says 2025, box says 2028"', () => {
    const r = evaluate(ctx({ barcode: { ...goodBarcode, expiry: '2025-05' }, confirmed: true }));
    expect(ids(r)).toContain('BARCODE_PRINT_MISMATCH');
    expect(r.checks.find((c) => c.id === 'BARCODE_PRINT_MISMATCH').reason).toBe('The barcode says expiry 2025-05, but the box says 2028-05.');
    expect(r.verdict.code).toBe('high_risk');
  });

  it('headline leads with the barcode/print mismatch, not plain expiry', () => {
    const r = evaluate(ctx({ barcode: { ...goodBarcode, expiry: '2025-05' }, confirmed: true }));
    expect(r.verdict.line).toMatch(/^The barcode says expiry 2025-05, but the box says 2028-05\./);
    expect(r.checks.find((c) => c.id === 'SHELF_LIFE_IMPLAUSIBLE').status).toBe('pass');
  });

  it('shelf-life implausible catches relabeled dates', () => {
    const r = evaluate(ctx({ barcode: null, extracted: { ...goodText, manufactureDate: '2022-01', expiryDate: '2029-01' }, confirmed: true }));
    expect(ids(r)).toContain('SHELF_LIFE_IMPLAUSIBLE');
  });

  it('clone at receiving names the other shop', () => {
    const r = evaluate(ctx({ gate: 'receiving', receivingShopId: 'shopA', pack: { shopId: 'shopK' }, packShop: shopKano }));
    expect(ids(r)).toContain('SERIAL_CLONE');
    expect(r.checks.find((c) => c.id === 'SERIAL_CLONE').reason).toMatch(/Kano/);
    expect(r.verdict.code).toBe('high_risk');
  });

  it('serial never issued (container fake)', () => {
    const r = evaluate(ctx({ issuer: { participates: true, record: null } }));
    expect(ids(r)).toContain('SERIAL_NEVER_ISSUED');
    expect(r.verdict.code).toBe('high_risk');
  });

  it('issued but never dispatched also fails', () => {
    const r = evaluate(ctx({ issuer: { participates: true, record: { dispatchedAt: null } } }));
    expect(r.verdict.code).toBe('high_risk');
  });

  it('wrong shop: AI-matched is Caution, confirmed is High (D28)', () => {
    const base = { pack: { shopId: 'shopA', source: 'authorized' }, packShop: shopA };
    expect(evaluate(ctx({ ...base, answer: { sourceType: 'shop', shopId: 'shopK', confirmed: false } })).verdict.code).toBe('caution');
    expect(evaluate(ctx({ ...base, answer: { sourceType: 'shop', shopId: 'shopK', confirmed: true } })).verdict.code).toBe('high_risk');
  });

  it('already sold elsewhere is skipped without location (D29) and Caution via repeat', () => {
    const r = evaluate(ctx({ device: { deviceId: 'me' }, priorVerifications: [{ deviceId: 'other', city: 'Kano' }] }));
    expect(r.checks.find((c) => c.id === 'ALREADY_SOLD_ELSEWHERE').status).toBe('skipped');
    expect(r.verdict.code).toBe('caution');
  });

  it('already sold elsewhere is High when both cities are known and differ', () => {
    const r = evaluate(ctx({ device: { deviceId: 'me', city: 'Lagos' }, priorVerifications: [{ deviceId: 'other', city: 'Kano' }] }));
    expect(r.verdict.code).toBe('high_risk');
  });
});

describe('registry and alerts', () => {
  it('unknown reg no. with lookup unavailable is No record, not High (D27)', () => {
    const r = evaluate(ctx({ product: null, barcode: null, regLookup: { status: 'unavailable' } }));
    expect(r.verdict.code).toBe('no_record');
    expect(r.verdict.line).toContain("This does not mean it's fake.");
  });

  it('positive NAFDAC "not found" is High after confirmation', () => {
    const r = evaluate(ctx({ product: null, barcode: null, regLookup: { status: 'not_found' }, confirmed: true }));
    expect(ids(r)).toContain('REG_NOT_FOUND');
    expect(r.verdict.code).toBe('high_risk');
  });

  it('reg number belonging to another product fails', () => {
    const r = evaluate(ctx({ confirmed: true, extracted: { ...goodText, brandName: 'Paracetamol Plus', genericName: 'Paracetamol' } }));
    expect(ids(r)).toContain('REG_PRODUCT_MISMATCH');
  });

  const smaAlert = { _id: 'a1', status: 'approved', alertNo: '06/2026', title: 'Revalidated SMA Gold', productName: 'SMA Gold', regNoOnFake: 'B1-2783', genuineRegNo: 'B1-2783', batches: [{ batchNo: '22939510A1206' }], sourceUrl: 'https://allafrica.com/stories/202602230576.html' };
  const sma = { _id: 'p2', brandName: 'SMA Gold', genericName: 'Infant formula', nafdacRegNo: 'B1-2783', sourceUrl: 'x' };
  const smaText = { brandName: 'SMA Gold', genericName: 'Infant formula', nafdacRegNo: 'B1-2783', batchNo: '22939510A1206', expiryDate: '2027-02' };

  it('alert batch match is High', () => {
    const r = evaluate(ctx({ product: sma, barcode: null, extracted: smaText, alerts: [smaAlert], confirmed: true }));
    expect(ids(r)).toContain('ALERT_MATCH');
  });

  it('a genuine reg no. copied onto fakes does NOT flag every genuine pack', () => {
    const r = evaluate(ctx({ product: sma, barcode: null, extracted: { ...smaText, batchNo: 'OTHER123' }, alerts: [smaAlert], confirmed: true }));
    expect(ids(r)).not.toContain('ALERT_MATCH');
  });

  it('pending alerts are ignored until approved', () => {
    const r = evaluate(ctx({ product: sma, barcode: null, extracted: smaText, alerts: [{ ...smaAlert, status: 'pending' }], confirmed: true }));
    expect(ids(r)).not.toContain('ALERT_MATCH');
  });
});

describe('AI-only findings cap at Caution', () => {
  it('tamper + artwork + lookalike alone → Caution', () => {
    const visual = {
      tamper: { signs: [{ kind: 'overprinted date', confidence: 0.9 }] },
      artwork: { differences: [{ what: 'logo colour', confidence: 0.8 }] },
      lookalike: { isLookalike: true, readName: 'Coglaet', resembles: 'Colgate', confidence: 0.95 },
    };
    const r = evaluate(ctx({ visual }));
    expect(r.verdict.code).toBe('caution');
  });

  it('low-confidence AI findings are ignored', () => {
    const r = evaluate(ctx({ visual: { tamper: { signs: [{ kind: 'smudge', confidence: 0.4 }] } } }));
    expect(ids(r)).not.toContain('TAMPER_SIGNS');
  });
});

describe('safety', () => {
  it("can't verify when nothing identifying is readable", () => {
    const r = evaluate(ctx({ barcode: null, extracted: { brandName: 'Something' }, product: null }));
    expect(r.verdict.code).toBe('cant_verify');
  });

  it('unreadable inputs are skipped, never passed', () => {
    const r = evaluate(ctx({ barcode: null, extracted: {}, product: null }));
    for (const id of ['EXPIRED', 'ALERT_MATCH', 'GS1_INVALID', 'REG_NOT_FOUND']) {
      expect(r.checks.find((c) => c.id === id).status).toBe('skipped');
    }
  });

  it('public view strips gated detail', () => {
    const r = evaluate(ctx({ visual: { artwork: { differences: [{ what: 'font', confidence: 0.9, box: [1, 2, 3, 4] }] } } }));
    expect(publicView(r.checks).some((c) => 'detail' in c)).toBe(false);
  });

  it('a malformed GS1 code is High', () => {
    const r = evaluate(ctx({ barcode: { found: true, isGs1: true, ok: false, errors: ['bad_gtin_check_digit'] } }));
    expect(ids(r)).toContain('GS1_INVALID');
    expect(r.verdict.code).toBe('high_risk');
  });
});
