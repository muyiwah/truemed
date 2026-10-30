import sharp from 'sharp';
import { readBarcodes } from 'zxing-wasm/reader';
import { makeDemoLabel } from '../src/services/barcode.js';
const png = await makeDemoLabel({ gtin: '00000000000178', expiryYYMMDD: '280531', batch: 'DQ2601', serial: 'DQ000123' });
await sharp(png).toFile('spikes/label.png');
const g = await sharp(png).greyscale().png().toBuffer();
const r = await readBarcodes(new Uint8Array(g), { formats: ['DataMatrix'], tryHarder: true });
console.log(r.map(x => ({ f: x.format, t: JSON.stringify(x.text), s: x.symbologyIdentifier, v: x.isValid, e: x.error })));
