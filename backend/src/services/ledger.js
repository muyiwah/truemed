/**
 * The ledger: what we know about where a pack should be.
 * Reads build the rule-engine context; writes happen only on a final result.
 */
import { Product, Alert, Pack, Shop, IssuedSerial, ScanEvent, Notification } from '../db/models/index.js';
import { normRegNo, normBatch } from '../rules/util.js';
import { lookupRegNo } from './greenbook.js';
import { viewUrl } from './storage.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Find the registry product for what was read: reg no. first, then GTIN. */
export async function findProduct({ regNo, gtin }) {
  const r = normRegNo(regNo);
  let p = null;
  if (r) p = await Product.findOne({ nafdacRegNo: new RegExp(`^${escapeRe(r)}$`, 'i') }).lean();
  if (!p && gtin) p = await Product.findOne({ gtins: gtin }).lean();
  if (p) p.referenceUrls = (p.referenceImages ?? []).map((m) => viewUrl(m)).filter(Boolean);
  return p;
}

/** Product lookup for the Inspector (needs reference images before artwork comparison). */
export const lookupForInspector = (extracted, barcode) =>
  findProduct({ regNo: extracted?.nafdacRegNo, gtin: barcode?.gtin });

/**
 * Everything the checks need, from the ledger.
 * @param {{ gate:string, fields:object, printed:object, confirmed:boolean, barcode:object, visual:object, answer?:object, deviceId?:string, city?:string, receivingShopId?:string }} s
 */
export async function buildContext(s) {
  const f = s.fields;
  const regNo = f.regNo?.value ?? null;
  const gtin = f.gtin?.value ?? s.barcode?.gtin ?? null;
  const serial = f.serial?.value ?? null;
  const batch = f.batch?.value ?? null;

  const [product, alerts, pack] = await Promise.all([
    findProduct({ regNo, gtin }),
    Alert.find({ status: 'approved' }).lean(),
    serial ? Pack.findOne({ serial }).lean() : null,
  ]);

  const regLookup = !product && regNo ? await lookupRegNo(regNo) : { status: 'not_attempted' };
  const packShop = pack?.shopId ? await Shop.findById(pack.shopId).lean() : null;

  // Issuer participation: DemoQuin (and later, any brand sharing its serial list).
  let issuer = { participates: false };
  if (gtin && product?.demo && product.gtins?.includes(gtin)) {
    issuer = { participates: true, record: serial ? await IssuedSerial.findOne({ gtin, serial }).lean() : null };
  }

  let priorVerifications = [];
  if (serial && s.gate === 'home') {
    const prior = await ScanEvent.find({ type: 'home', serial, 'verdict.code': { $ne: 'needs_confirmation' } }).select('deviceId city').lean();
    priorVerifications = prior.map((p) => ({ deviceId: p.deviceId, city: p.city }));
  }

  let batchAtShop = null;
  if (s.gate === 'home' && !serial && batch && s.answer?.shopId) {
    const shopEvents = await ScanEvent.countDocuments({ type: { $in: ['receiving', 'carton'] }, shopId: s.answer.shopId });
    const received = await ScanEvent.exists({ type: { $in: ['receiving', 'carton'] }, shopId: s.answer.shopId, batch: new RegExp(`^${escapeRe(normBatch(batch))}$`, 'i') });
    batchAtShop = { shopInNetwork: shopEvents > 0, received: Boolean(received) };
  }

  return {
    gate: s.gate,
    fields: f,
    printed: s.printed,
    confirmed: s.confirmed,
    barcode: s.barcode,
    visual: s.visual,
    product,
    regLookup,
    alerts,
    pack,
    packShop,
    issuer,
    answer: s.answer ?? null,
    device: { deviceId: s.deviceId, city: s.city },
    priorVerifications,
    batchAtShop,
    receivingShopId: s.receivingShopId,
  };
}

/** Gate 1 accepted: log the pack to this shop. */
export async function logReceived({ serial, gtin, batch, expiry, regNo, productId, shopId, source }) {
  if (!serial) return null;
  return Pack.findOneAndUpdate(
    { serial },
    { $setOnInsert: { serial, gtin, batch, expiry, regNo, productId, shopId, status: 'in_stock', source: source.source, supplierName: source.supplierName, marketStall: source.marketStall, receivedAt: new Date() } },
    { upsert: true, new: true },
  ).lean();
}

/** Gate 2 final: the first verifier claims the pack. */
export async function claimPack({ serial, deviceId }) {
  if (!serial) return;
  await Pack.updateOne({ serial, status: 'in_stock' }, { $set: { status: 'sold', soldAt: new Date(), firstVerifierDeviceId: deviceId } });
}

/** A clone at receiving: warn both shops. */
export async function notifyClone({ serial, receivingShop, otherShopId }) {
  const docs = [
    { shopId: receivingShop._id, type: 'clone', title: 'Copied serial rejected', message: `A pack with serial ${serial} was rejected at receiving: the serial is already logged by another shop.`, refs: { serial } },
  ];
  if (otherShopId) docs.push({ shopId: otherShopId, type: 'clone', title: 'Your serial was copied', message: `Another shop tried to receive a pack with serial ${serial}, which you logged. Check this pack on your shelf.`, refs: { serial } });
  await Notification.insertMany(docs);
}

/**
 * Reconciliation for one shop: serials checked by more than one buyer device,
 * and more home verifications than packs received.
 */
export async function reconcileShop(shopId) {
  const packs = await Pack.find({ shopId }).select('serial status').lean();
  const serials = packs.map((p) => p.serial);
  const multi = await ScanEvent.aggregate([
    { $match: { type: 'home', serial: { $in: serials } } },
    { $group: { _id: '$serial', devices: { $addToSet: '$deviceId' } } },
    { $match: { 'devices.1': { $exists: true } } },
  ]);
  return {
    received: packs.length,
    sold: packs.filter((p) => p.status === 'sold').length,
    serialsVerifiedByManyDevices: multi.map((m) => ({ serial: m._id, devices: m.devices.length })),
    flagged: multi.length > 0,
  };
}
