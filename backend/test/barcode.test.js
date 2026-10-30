import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { makeDemoLabel, readPackBarcode } from '../src/services/barcode.js';
import { withCheckDigit } from '../src/lib/gs1.js';

describe('DemoQuin label round trip', () => {
  it('bwip-js label decodes back with zxing-wasm into GS1 fields', async () => {
    const gtin = withCheckDigit('0000000000017');
    const png = await makeDemoLabel({ gtin, expiryYYMMDD: '280531', batch: 'DQ2601', serial: 'DQ000123' });
    const r = await readPackBarcode(png);
    expect(r.found).toBe(true);
    expect(r.isGs1).toBe(true);
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ gtin, batch: 'DQ2601', serial: 'DQ000123', expiry: '2028-05' });
  }, 20000);

  it('still decodes when the label is small inside a larger photo-like canvas', async () => {
    const gtin = withCheckDigit('0000000000017');
    const label = await sharp(await makeDemoLabel({ gtin, expiryYYMMDD: '280531', batch: 'DQ2601', serial: 'DQ000124', scale: 3 })).toBuffer();
    const photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#d9d4c7' } })
      .composite([{ input: label, top: 700, left: 1000 }]).jpeg({ quality: 85 }).toBuffer();
    const r = await readPackBarcode(photo);
    expect(r.serial).toBe('DQ000124');
  }, 20000);
});
