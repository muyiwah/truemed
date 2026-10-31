import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/** A file in ImageKit. `isPrivate` files are served via short-lived signed URLs. */
/** Scan sessions (photos ↔ what the AI read ↔ the user's corrections) are kept two weeks for the eval set. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const media = new Schema({ fileId: String, filePath: String, url: String, isPrivate: Boolean, kind: String }, { _id: false });

const productSchema = new Schema({
  brandName: { type: String, required: true },
  genericName: String,
  strength: String,
  dosageForm: String,
  manufacturer: String,
  nafdacRegNo: { type: String, index: true },
  gtins: { type: [String], index: true },
  category: { type: String, enum: ['medicine', 'food', 'cosmetic'], default: 'medicine' },
  normalShelfLifeMonths: Number,
  referenceImages: [media],
  sourceUrl: { type: String, required: true }, // rule 8: every seed record cites its source
  verifiedAt: Date,
  demo: { type: Boolean, default: false },
}, { timestamps: true });

const alertSchema = new Schema({
  alertNo: String,
  title: { type: String, required: true },
  productName: String,
  issuedAt: Date,
  type: { type: String, enum: ['falsified', 'recall', 'unregistered', 'revalidated'] },
  regNoOnFake: String,
  genuineRegNo: String,
  batches: [{ batchNo: String, expiry: String, _id: false }],
  telltaleSigns: [String],
  sourceUrl: { type: String, required: true },
  rawText: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  approvedAt: Date,
  notifiedShops: Number,
}, { timestamps: true });
alertSchema.index({ 'batches.batchNo': 1 });

const shopSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['pharmacy', 'licensed_chemist'], required: true },
  licenceNo: String,
  verified: { type: Boolean, default: true },
  area: String,
  city: String,
  approxLocation: { lat: Number, lng: Number },
  aliases: [String], // what people actually call it: "the chemist by Ojo junction"
  demo: { type: Boolean, default: true },
}, { timestamps: true });

const issuedSerialSchema = new Schema({
  gtin: { type: String, required: true },
  serial: { type: String, required: true },
  batch: String,
  expiry: String,
  issuedAt: { type: Date, default: Date.now },
  dispatchedAt: { type: Date, default: null },
});
issuedSerialSchema.index({ gtin: 1, serial: 1 }, { unique: true });

const packSchema = new Schema({
  serial: { type: String, required: true, unique: true },
  gtin: String,
  batch: String,
  expiry: String,
  regNo: String,
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  status: { type: String, enum: ['in_stock', 'sold'], default: 'in_stock' },
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
  source: { type: String, enum: ['authorized', 'open_market'] },
  supplierName: String,
  marketStall: String,
  receivedAt: Date,
  soldAt: Date,
  firstVerifierDeviceId: String,
}, { timestamps: true });
packSchema.index({ batch: 1, shopId: 1 });

/** Append-only by convention: never updated or deleted (CLAUDE.md §5). */
const scanEventSchema = new Schema({
  type: { type: String, enum: ['receiving', 'home', 'carton'], required: true },
  deviceId: String,
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
  serial: { type: String, index: true },
  batch: String,
  extracted: Schema.Types.Mixed,
  barcode: Schema.Types.Mixed,
  checks: Schema.Types.Mixed,
  verdict: Schema.Types.Mixed,
  answerShop: Schema.Types.Mixed,
  city: String,
  images: [media],
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne']) {
  scanEventSchema.pre(op, function block() { throw new Error('scanEvents is append-only'); });
}

/** A scan in progress: photo analysed, waiting for confirmation and/or the shop answer. */
const scanSessionSchema = new Schema({
  gate: { type: String, enum: ['home', 'receiving', 'carton'], required: true },
  deviceId: String,
  role: String,
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
  source: Schema.Types.Mixed, // receiving: { source, supplierName, marketStall }
  images: [media],
  imageSizes: Schema.Types.Mixed,
  extracted: Schema.Types.Mixed,
  barcode: Schema.Types.Mixed,
  regions: Schema.Types.Mixed,
  visual: Schema.Types.Mixed,
  quality: Schema.Types.Mixed,
  userValues: Schema.Types.Mixed,
  confirmed: { type: Boolean, default: false },
  answer: Schema.Types.Mixed,
  city: String,
  language: { type: String, default: 'en' },
  result: Schema.Types.Mixed,
  timings: Schema.Types.Mixed,
  sampleId: String,
  finalizedAt: Date,
  createdAt: { type: Date, default: Date.now, expires: SESSION_TTL_SECONDS },
}, { versionKey: false });

const caseFileSchema = new Schema({
  trigger: Schema.Types.Mixed,
  serials: [String],
  shops: [{ type: Schema.Types.ObjectId, ref: 'Shop' }],
  alerts: [{ type: Schema.Types.ObjectId, ref: 'Alert' }],
  steps: [Schema.Types.Mixed],
  summary: String,
  caseFile: Schema.Types.Mixed,
  draftReport: String,
  status: { type: String, enum: ['running', 'done', 'failed'], default: 'running' },
}, { timestamps: true });

const notificationSchema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
  type: { type: String, enum: ['recall', 'clone', 'reconciliation'] },
  title: String,
  message: String,
  refs: Schema.Types.Mixed,
  readAt: Date,
}, { timestamps: true });

const deviceSchema = new Schema({
  deviceId: { type: String, unique: true },
  role: { type: String, enum: ['public', 'pharmacist', 'chemist', 'admin'], default: 'public' },
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
  language: { type: String, default: 'en' },
  failingScans: { type: Number, default: 0 },
}, { timestamps: true });

/** Daily Meta spend ledger for the cap (CLAUDE.md §13). */
const usageSchema = new Schema({
  day: { type: String, unique: true },
  calls: { type: Number, default: 0 },
  costUsd: { type: Number, default: 0 },
  byModel: { type: Schema.Types.Mixed, default: {} },
});

/** Cached Greenbook single lookups (24 h). */
const regLookupSchema = new Schema({
  regNo: { type: String, unique: true },
  status: { type: String, enum: ['found', 'not_found'] },
  data: Schema.Types.Mixed,
  sourceUrl: String,
  checkedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

/**
 * Custody events recorded by the simulated NAFDAC sandbox (DemoQuin only).
 * Shaped like a traceability event: what happened, to which unit, by whom, when.
 */
const sandboxEventSchema = new Schema({
  eventType: { type: String, enum: ['receive', 'dispense', 'return', 'destroy'], required: true },
  gtin: { type: String, required: true },
  serial: { type: String, required: true },
  batch: String,
  expiry: String,
  actor: { name: String, licenceNo: String, city: String },
  source: String,
  eventTime: { type: Date, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });
sandboxEventSchema.index({ gtin: 1, serial: 1, eventTime: -1 });

export const Product = model('Product', productSchema);
export const Alert = model('Alert', alertSchema);
export const Shop = model('Shop', shopSchema);
export const IssuedSerial = model('IssuedSerial', issuedSerialSchema);
export const Pack = model('Pack', packSchema);
export const ScanEvent = model('ScanEvent', scanEventSchema);
export const ScanSession = model('ScanSession', scanSessionSchema);
export const CaseFile = model('CaseFile', caseFileSchema);
export const Notification = model('Notification', notificationSchema);
export const Device = model('Device', deviceSchema);
export const Usage = model('Usage', usageSchema);
export const RegLookup = model('RegLookup', regLookupSchema);
export const SandboxEvent = model('SandboxEvent', sandboxEventSchema);
