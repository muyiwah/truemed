// End-to-end through the HTTP API using DemoQuin labels photographed onto a "carton".
// Works without Meta keys (barcode-only path). Usage: node spikes/e2eDemo.js [baseUrl]
import sharp from 'sharp';
import { makeDemoLabel } from '../src/services/barcode.js';
import { DEMO_GTIN } from '../src/demo/demoquin.js';

const BASE = process.argv[2] || 'http://localhost:4080/api';
const photo = async (serial) => {
  const label = await makeDemoLabel({ gtin: DEMO_GTIN, expiryYYMMDD: '280500', batch: 'DQ2610', serial, scale: 5 });
  return sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#e8e1d2' } }).composite([{ input: label, top: 250, left: 450 }]).jpeg({ quality: 88 }).toBuffer();
};
const call = async (path, { device, json, file, admin } = {}) => {
  const headers = { 'X-Device-Id': device };
  let body;
  if (file) { body = new FormData(); body.append('images', new Blob([file], { type: 'image/jpeg' }), 'p.jpg'); }
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (admin) headers['X-Admin-Pin'] = admin;
  const r = await fetch(BASE + path, { method: body || admin ? 'POST' : 'GET', headers, body });
  return r.json();
};
const shops = await call('/shops', { device: 'x-device-000' });
const shop = (n) => shops.find((s) => s.name.startsWith(n))._id;
const v = (r) => `${r.stage}${r.verdict ? ` → ${r.verdict.title}: ${r.verdict.line}` : ''}${r.decision ? ` [${r.decision}]` : ''}${r.verdict?.provenance ? `\n      ${r.verdict.provenance}` : ''}`;

await call('/demo/reset', { device: 'x', admin: process.env.ADMIN_PIN || 'dev-admin' });

async function home(serial, answer, device = `buyer-${serial}-${Math.random().toString(36).slice(2, 8)}`) {
  const s = await call('/scan/home', { device, file: await photo(serial) });
  if (s.stage !== 'ask_shop') return s;
  return call(`/scan/${s.sessionId}/answer`, { device, json: answer });
}

console.log('1 genuine (DQ000001, bought at Ikeja Care):\n   ', v(await home('DQ000001', { sourceType: 'shop', shopId: shop('Ikeja'), confirmed: true })));
console.log('2 open market (DQ000006, Ojo chemist):\n   ', v(await home('DQ000006', { sourceType: 'shop', shopId: shop('Ojo'), confirmed: true })));
console.log('3 wrong shop (DQ000002, says Yaba):\n   ', v(await home('DQ000002', { sourceType: 'shop', shopId: shop('Yaba'), confirmed: true })));
console.log('4 never issued (DQ999999):\n   ', v(await home('DQ999999', { sourceType: 'street' })));
console.log('5 never dispatched (DQ000016):\n   ', v(await home('DQ000016', { sourceType: 'market' })));
console.log('6 second phone re-checks DQ000001:\n   ', v(await home('DQ000001', { sourceType: 'shop', shopId: shop('Ikeja'), confirmed: true })));

const ph = 'pharmacist-ikeja-0001';
await call('/auth/pin', { device: ph, json: { pin: '2468', shopId: shop('Ikeja') } });
const rx = async (serial) => call('/scan/receiving', { device: ph, file: await photo(serial) });
console.log('7 receiving clean (DQ000010):\n   ', v(await rx('DQ000010')));
console.log('8 receiving clone (DQ000009, logged in Kano):\n   ', v(await rx('DQ000009')));
const notes = await call('/notifications', { device: ph });
console.log('9 Ikeja notifications:', notes.map((n) => n.title));
