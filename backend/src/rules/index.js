import regNotFound from './checks/regNotFound.js';
import regProductMismatch from './checks/regProductMismatch.js';
import alertMatch from './checks/alertMatch.js';
import expired from './checks/expired.js';
import shelfLifeImplausible from './checks/shelfLifeImplausible.js';
import gs1Invalid from './checks/gs1Invalid.js';
import barcodePrintMismatch from './checks/barcodePrintMismatch.js';
import serialClone from './checks/serialClone.js';
import wrongShop from './checks/wrongShop.js';
import alreadySoldElsewhere from './checks/alreadySoldElsewhere.js';
import serialNeverIssued from './checks/serialNeverIssued.js';
import artworkDifference from './checks/artworkDifference.js';
import tamperSigns from './checks/tamperSigns.js';
import lookalikeName from './checks/lookalikeName.js';
import batchShopMismatch from './checks/batchShopMismatch.js';
import repeatNearby from './checks/repeatNearby.js';
import expiringSoon from './checks/expiringSoon.js';
import { score } from './score.js';

export const CHECKS = [
  regNotFound, regProductMismatch, alertMatch, expired, shelfLifeImplausible, gs1Invalid,
  barcodePrintMismatch, serialClone, wrongShop, alreadySoldElsewhere, serialNeverIssued,
  artworkDifference, tamperSigns, lookalikeName, batchShopMismatch, repeatNearby, expiringSoon,
];

/** Run every check; a check that throws is reported as skipped, never as pass. */
export function evaluate(ctx) {
  const c = { today: new Date(), ...ctx };
  const checks = CHECKS.map((fn) => {
    try {
      return fn(c);
    } catch (err) {
      return { id: fn.name, type: 'hard', status: 'skipped', reason: 'This check could not run.', error: String(err?.message ?? err) };
    }
  });
  return { checks, verdict: score(checks, c) };
}

/** Strip gated detail for anonymous users (rule 6). */
export function publicView(checks) {
  return checks.map(({ detail, error, ...rest }) => rest);
}

/**
 * Merge AI-read text, barcode data and user corrections into ctx.fields.
 * Barcode beats text (machine-read); user-confirmed values beat both for text fields.
 */
export function resolveFields({ extracted = {}, barcode = null, userValues = {} }) {
  const fields = {};
  const conf = extracted.fieldConfidence ?? {};
  const fromText = { regNo: 'nafdacRegNo', batch: 'batchNo', expiry: 'expiryDate', manufactureDate: 'manufactureDate', brandName: 'brandName', genericName: 'genericName', strength: 'strength', serial: 'serial' };
  for (const [k, src] of Object.entries(fromText)) {
    if (extracted[src]) fields[k] = { value: extracted[src], source: 'text', confidence: conf[src] ?? null };
  }
  if (barcode?.found && barcode.ok) {
    if (barcode.batch) fields.batch = { value: barcode.batch, source: 'barcode' };
    if (barcode.expiry) fields.expiry = { value: barcode.expiry, source: 'barcode' };
    if (barcode.serial) fields.serial = { value: barcode.serial, source: 'barcode' };
    if (barcode.gtin) fields.gtin = { value: barcode.gtin, source: 'barcode' };
    if (barcode.productionDate && !fields.manufactureDate) fields.manufactureDate = { value: barcode.productionDate, source: 'barcode' };
  }
  for (const [k, v] of Object.entries(userValues)) {
    if (v == null || v === '') continue;
    // A user correction replaces AI-read text; it never overrides a machine-read barcode value.
    if (fields[k]?.source === 'barcode') continue;
    fields[k] = { value: v, source: 'user' };
  }
  const printed = { batch: extracted.batchNo ?? null, expiry: extracted.expiryDate ?? null };
  if (userValues.batch) printed.batch = userValues.batch;
  if (userValues.expiry) printed.expiry = userValues.expiry;
  return { fields, printed };
}
