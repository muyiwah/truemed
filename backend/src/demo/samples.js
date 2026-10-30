/**
 * Judge sample packs: DemoQuin carton faces rendered on the server, so anyone can
 * try TrueMed in 20 seconds without a pack in hand.
 *
 * Each is a fictional product marked "DEMO — NOT A REAL PRODUCT" (rule 10).
 * The tampered sample prints EXP 05/2028 on a sticker while its 2D code still
 * encodes 2025-05 — the "barcode says 2025, the box says 2028" moment.
 *
 * Sample scans never write to the ledger (see scan.js), so one judge's test
 * can't change the next judge's result.
 */
import sharp from 'sharp';
import bwipjs from 'bwip-js';
import { DEMO_GTIN, DEMO_BATCH } from './demoquin.js';

export const SAMPLES = [
  { id: 'genuine', title: 'Genuine pack', subtitle: 'Bought at Ikeja Care Pharmacy (demo)', serial: 'DQ000001', codeExpiry: '280500', printedExpiry: '05/2028', mfg: '05/2026', tone: 'ok', suggest: { shop: 'Ikeja Care Pharmacy (demo)' } },
  { id: 'tampered', title: 'Relabeled expiry', subtitle: 'Date sticker over the original print', serial: 'DQ000003', codeExpiry: '250500', printedExpiry: '05/2028', mfg: '05/2026', tampered: true, tone: 'bad' },
  { id: 'never-issued', title: 'Container fake', subtitle: 'Serial the maker never issued', serial: 'DQ999999', codeExpiry: '280500', printedExpiry: '05/2028', mfg: '05/2026', tone: 'bad' },
  { id: 'wrong-shop', title: 'Diverted pack', subtitle: 'Registered to a different shop', serial: 'DQ000002', codeExpiry: '280500', printedExpiry: '05/2028', mfg: '05/2026', tone: 'warn', suggest: { shop: 'Yaba Family Pharmacy (demo)' } },
];

const W = 1400;
const H = 1000;

export async function renderSample(sample) {
  const code = await bwipjs.toBuffer({ bcid: 'gs1datamatrix', text: `(01)${DEMO_GTIN}(17)${sample.codeExpiry}(10)${DEMO_BATCH}(21)${sample.serial}`, scale: 4, padding: 3, backgroundcolor: 'FFFFFF' });
  const tilted = await sharp(code).rotate(-2, { background: '#ffffff' }).toBuffer();

  const sticker = sample.tampered
    ? `<g transform="rotate(-1.6 1010 640)">
         <rect x="842" y="585" width="330" height="96" rx="6" fill="#FBFAF4" stroke="#d8d2c2" stroke-width="2"/>
         <rect x="842" y="585" width="330" height="96" rx="6" fill="url(#gloss)"/>
         <text x="862" y="627" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">MFG: ${sample.mfg}</text>
         <text x="862" y="665" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">EXP: ${sample.printedExpiry}</text>
       </g>
       <text x="1180" y="676" font-family="Courier New, monospace" font-size="22" fill="#1b1b1b" opacity=".45">5</text>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfc7b6"/><stop offset="1" stop-color="#b9b09d"/></linearGradient>
    <linearGradient id="box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef0ee"/></linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d5c8c"/><stop offset="1" stop-color="#1690a8"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".28"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g transform="rotate(-2 700 500)" filter="url(#sh)">
    <rect x="140" y="150" width="1120" height="700" rx="14" fill="url(#box)"/>
    <rect x="140" y="150" width="1120" height="150" rx="14" fill="url(#band)"/>
    <rect x="140" y="270" width="1120" height="30" fill="url(#band)"/>
    <text x="190" y="248" font-family="Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="#fff" letter-spacing="-2">DemoQuin</text>
    <text x="760" y="215" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#d8f1f7">Artemether / Lumefantrine</text>
    <text x="760" y="258" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">20/120mg · 24 tablets</text>
    <text x="190" y="370" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#24323a">Manufactured by DemoQuin Pharma (fictional)</text>
    <text x="190" y="418" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#24323a">NAFDAC Reg. No: DEMO-0001</text>
    <rect x="190" y="460" width="560" height="64" rx="10" fill="#B00020"/>
    <text x="470" y="503" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="800" fill="#fff" text-anchor="middle">DEMO — NOT A REAL PRODUCT</text>
    <text x="842" y="410" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">BATCH: ${DEMO_BATCH}</text>
    <text x="842" y="452" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">SN: ${sample.serial}</text>
    <text x="842" y="627" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">MFG: ${sample.tampered ? '05/2023' : sample.mfg}</text>
    <text x="842" y="665" font-family="Courier New, monospace" font-size="30" font-weight="700" fill="#1b1b1b">EXP: ${sample.tampered ? '05/2025' : sample.printedExpiry}</text>
    ${sticker}
    <text x="470" y="790" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#5b6870">Store below 30°C. Fictional product for a hackathon demo.</text>
  </g>
</svg>`;
  return sharp(Buffer.from(svg))
    .composite([{ input: tilted, top: 560, left: 232 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
