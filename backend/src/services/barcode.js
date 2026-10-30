/**
 * Read barcodes from a photo and make DemoQuin labels.
 *
 * zxing-wasm decodes DataMatrix/QR/linear codes from encoded image bytes. Phone
 * photos are large and often rotated, so we try the full image first and then
 * any crop SAM found for "barcode", upscaled — small DataMatrix codes decode
 * far better at 2–3× size.
 */
import sharp from 'sharp';
import bwipjs from 'bwip-js';
import { readBarcodes } from 'zxing-wasm/reader';
import { parseGs1 } from '../lib/gs1.js';

const FORMATS = ['DataMatrix', 'QRCode', 'EAN-13', 'EAN-8', 'UPC-A', 'Code128', 'DataBar'];

async function decodeOnce(buffer) {
  const png = await sharp(buffer).rotate().greyscale().png().toBuffer();
  const results = await readBarcodes(new Uint8Array(png), { formats: FORMATS, tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4 });
  return results.filter((r) => r.isValid);
}

/**
 * @param {Buffer} image full photo
 * @param {Buffer[]} crops optional SAM crops of the barcode region
 * @returns {Promise<{found:boolean, isGs1?:boolean, ok?:boolean, errors?:string[], raw?:string, format?:string, gtin?:string, batch?:string, expiry?:string, serial?:string, productionDate?:string, position?:object}>}
 */
export async function readPackBarcode(image, crops = []) {
  const attempts = [image];
  for (const c of crops) {
    attempts.push(c);
    const meta = await sharp(c).metadata();
    if (meta.width && meta.width < 600) attempts.push(await sharp(c).resize({ width: meta.width * 3, kernel: 'nearest' }).toBuffer());
  }
  let best = null;
  for (const buf of attempts) {
    let found;
    try { found = await decodeOnce(buf); } catch { continue; }
    // Prefer a GS1 symbol (carries batch/expiry/serial) over a plain retail EAN.
    const gs1 = found.find((r) => r.symbologyIdentifier?.startsWith(']d2') || r.symbologyIdentifier?.startsWith(']C1') || /^\(01\)|^01\d{14}/.test(r.text));
    if (gs1) { best = gs1; break; }
    if (!best && found[0]) best = found[0];
  }
  if (!best) return { found: false };

  const isGs1 = best.format === 'DataMatrix' || best.format === 'QRCode' || best.format === 'Code128' || best.format === 'DataBar'
    ? Boolean(best.symbologyIdentifier?.match(/^\](d2|C1|Q3|e0)/)) || /^\(01\)/.test(best.text)
    : false;
  if (!isGs1) {
    return { found: true, isGs1: false, raw: best.text, format: best.format, gtin: /^\d{8,14}$/.test(best.text) ? best.text.padStart(14, '0') : undefined };
  }
  const parsed = parseGs1(`${best.symbologyIdentifier ?? ''}${best.text}`);
  return { found: true, isGs1: true, raw: best.text, format: best.format, position: best.position, ...parsed };
}

/** A GS1 DataMatrix PNG for a DemoQuin pack, with the demo warning underneath. */
export async function makeDemoLabel({ gtin, expiryYYMMDD, batch, serial, scale = 6 }) {
  const code = await bwipjs.toBuffer({
    bcid: 'gs1datamatrix',
    text: `(01)${gtin}(17)${expiryYYMMDD}(10)${batch}(21)${serial}`,
    scale,
    padding: 4,
    backgroundcolor: 'FFFFFF',
  });
  const meta = await sharp(code).metadata();
  const width = Math.max(meta.width + 40, 420);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110">
    <style>.t{font-family:Helvetica,Arial,sans-serif;fill:#111}</style>
    <text class="t" x="${width / 2}" y="26" font-size="17" text-anchor="middle">GTIN ${gtin}  ·  SN ${serial}</text>
    <text class="t" x="${width / 2}" y="50" font-size="17" text-anchor="middle">BATCH ${batch}  ·  EXP 20${expiryYYMMDD.slice(0, 2)}-${expiryYYMMDD.slice(2, 4)}</text>
    <text x="${width / 2}" y="90" font-size="20" font-weight="700" fill="#B00020" font-family="Helvetica,Arial,sans-serif" text-anchor="middle">DEMO — NOT A REAL PRODUCT</text>
  </svg>`;
  return sharp({ create: { width, height: meta.height + 130, channels: 3, background: '#ffffff' } })
    .composite([
      { input: code, top: 10, left: Math.round((width - meta.width) / 2) },
      { input: Buffer.from(svg), top: meta.height + 18, left: 0 },
    ])
    .png()
    .toBuffer();
}
