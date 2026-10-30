/**
 * DemoQuin: a fictional manufacturer that shares its issued-serial list, so the
 * demo can show the whole chain — issue → label → dispatch → receive → sell —
 * and the container-fake catch ("serial never issued").
 *
 * The GTIN uses GS1 prefix 20 (restricted circulation: never a real retail
 * product), so it can't collide with a real brand.
 */
import { withCheckDigit } from '../lib/gs1.js';
import { IssuedSerial, Pack, Shop, Product, ScanEvent, Notification, CaseFile } from '../db/models/index.js';
import { makeDemoLabel } from '../services/barcode.js';

export const DEMO_GTIN = withCheckDigit('0200000000001');
export const DEMO_BATCH = 'DQ2610';
export const DEMO_EXPIRY = '2028-05';

const serialOf = (n) => `DQ${String(n).padStart(6, '0')}`;
const yymmdd = (ym) => `${ym.slice(2, 4)}${ym.slice(5, 7)}00`;

export async function issue({ count = 10, batch = DEMO_BATCH, expiry = DEMO_EXPIRY } = {}) {
  const last = await IssuedSerial.findOne({ gtin: DEMO_GTIN }).sort({ serial: -1 }).lean();
  const start = last ? Number(last.serial.slice(2)) + 1 : 1;
  const docs = Array.from({ length: Math.min(count, 200) }, (_, i) => ({ gtin: DEMO_GTIN, serial: serialOf(start + i), batch, expiry }));
  await IssuedSerial.insertMany(docs);
  return docs;
}

export async function dispatch({ serials }) {
  const r = await IssuedSerial.updateMany({ gtin: DEMO_GTIN, serial: { $in: serials }, dispatchedAt: null }, { $set: { dispatchedAt: new Date() } });
  return { dispatched: r.modifiedCount };
}

export function label({ serial, batch = DEMO_BATCH, expiry = DEMO_EXPIRY }) {
  return makeDemoLabel({ gtin: DEMO_GTIN, expiryYYMMDD: yymmdd(expiry), batch, serial });
}

/**
 * Reset the demo world to a known state (idempotent):
 *  DQ000001–05  issued, dispatched, received by Ikeja Care (authorized supplier)
 *  DQ000006–08  issued, dispatched, received by Ojo Licensed Chemist (open market)
 *  DQ000009     issued, dispatched, received by Sabon Gari, Kano  → scanning it at Ikeja = clone
 *  DQ000010–15  issued, dispatched, not yet received             → clean receiving demo
 *  DQ000016–20  issued, NOT dispatched                           → "never dispatched"
 *  DQ999999     never issued                                     → container fake
 */
export async function resetDemo() {
  const shops = Object.fromEntries((await Shop.find({ demo: true }).lean()).map((s) => [s.name, s]));
  const ikeja = shops['Ikeja Care Pharmacy (demo)'];
  const ojo = shops['Ojo Licensed Chemist (demo)'];
  const kano = shops['Sabon Gari Pharmacy (demo)'];
  if (!ikeja || !ojo || !kano) throw new Error('Seed shops first');
  const product = await Product.findOne({ demo: true, brandName: 'DemoQuin' }).lean();

  const demoSerials = /^DQ\d{6}$/;
  await Promise.all([
    IssuedSerial.deleteMany({ gtin: DEMO_GTIN }),
    Pack.deleteMany({ serial: demoSerials }),
    // scanEvents are append-only: the demo reset uses the raw collection on demo serials only.
    ScanEvent.collection.deleteMany({ serial: demoSerials }),
    Notification.deleteMany({ 'refs.serial': demoSerials }),
    CaseFile.deleteMany({ serials: demoSerials }),
  ]);

  await IssuedSerial.insertMany(Array.from({ length: 20 }, (_, i) => ({ gtin: DEMO_GTIN, serial: serialOf(i + 1), batch: DEMO_BATCH, expiry: DEMO_EXPIRY, issuedAt: new Date(), dispatchedAt: i < 15 ? new Date() : null })));

  const pack = (n, shop, source, supplierName) => ({
    serial: serialOf(n), gtin: DEMO_GTIN, batch: DEMO_BATCH, expiry: DEMO_EXPIRY, regNo: 'DEMO-0001', productId: product?._id,
    status: 'in_stock', shopId: shop._id, source, supplierName, receivedAt: new Date(Date.now() - 3 * 864e5),
  });
  await Pack.insertMany([
    ...[1, 2, 3, 4, 5].map((n) => pack(n, ikeja, 'authorized', 'DemoQuin Distributors Ltd (demo)')),
    ...[6, 7, 8].map((n) => pack(n, ojo, 'open_market', null)),
    pack(9, kano, 'authorized', 'DemoQuin Distributors Ltd (demo)'),
  ]);
  // Receiving events so batch-level checks see the shops as active.
  await ScanEvent.insertMany([1, 6, 9].map((n) => ({ type: 'receiving', shopId: n === 1 ? ikeja._id : n === 6 ? ojo._id : kano._id, serial: serialOf(n), batch: DEMO_BATCH, verdict: { code: 'accepted' }, deviceId: 'demo-seed' })));
  return { gtin: DEMO_GTIN, batch: DEMO_BATCH, expiry: DEMO_EXPIRY, scenarios: SCENARIOS };
}

export const SCENARIOS = [
  { id: 'genuine', serial: 'DQ000001', title: 'Genuine, authorized chain', how: 'Home scan, answer "Ikeja Care Pharmacy"' },
  { id: 'open-market', serial: 'DQ000006', title: 'Open-market source, checked on receipt', how: 'Home scan, answer "Ojo chemist"' },
  { id: 'clone', serial: 'DQ000009', title: 'Clone caught at receiving', how: 'Receive stock as Ikeja Care' },
  { id: 'wrong-shop', serial: 'DQ000002', title: 'Wrong shop', how: 'Home scan, answer "Yaba Family Pharmacy"' },
  { id: 'never-issued', serial: 'DQ999999', title: 'Container fake: serial never issued', how: 'Any scan' },
  { id: 'never-dispatched', serial: 'DQ000016', title: 'Serial never left the factory', how: 'Any scan' },
  { id: 'clean-receive', serial: 'DQ000010', title: 'Clean receiving', how: 'Receive stock as any shop' },
];
