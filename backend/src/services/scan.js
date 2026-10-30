/**
 * A scan, start to finish.
 *
 * Home (Gate 2):      photo → inspect → [confirm] → ask "where did you buy it?" → [confirm shop] → result
 * Receiving (Gate 1): photo + source → inspect → [confirm] → result → accept / review / reject
 *
 * State lives in a ScanSession so each step is a small, retryable request.
 * Nothing about the pack's registered shop is revealed before the buyer
 * answers (rule 5); gated detail goes only to verified roles (rule 6).
 */
import { ScanSession, ScanEvent, Shop, Device } from '../db/models/index.js';
import { inspect } from '../agents/inspector/index.js';
import { explain } from '../agents/voice/index.js';
import { evaluate, publicView, resolveFields } from '../rules/index.js';
import { buildContext, lookupForInspector, logReceived, claimPack, notifyClone } from './ledger.js';
import { store } from './storage.js';
import { log } from '../lib/log.js';

const FIELD_LABELS = { regNo: 'NAFDAC number', batch: 'Batch', expiry: 'Expiry date', manufactureDate: 'Manufacture date', brandName: 'Product name', genericName: 'Active ingredient', strength: 'Strength', serial: 'Serial number' };

const isVerified = (role) => role === 'pharmacist' || role === 'chemist' || role === 'admin';

/** The values shown on the confirm screen. */
function readValues(fields, confirmFields) {
  const show = new Set([...(confirmFields ?? []), 'brandName', 'regNo', 'batch', 'expiry']);
  return [...show].filter((k) => FIELD_LABELS[k]).map((k) => ({
    key: k,
    label: FIELD_LABELS[k],
    value: fields[k]?.value ?? null,
    source: fields[k]?.source ?? null,
    confidence: fields[k]?.confidence ?? null,
    needsCheck: (confirmFields ?? []).includes(k),
    editable: fields[k]?.source !== 'barcode',
  }));
}

/** Regions to draw on the photo, toned by which checks failed. */
function evidenceRegions(regions, checks, images) {
  const failedRegion = new Set(checks.filter((c) => c.status === 'fail' && c.evidenceRegion).map((c) => c.evidenceRegion));
  const out = [];
  const add = (r, kind, label) => r && out.push({ kind, label, image: r.image, box: r.box, path: r.path, size: images[r.image] && { width: images[r.image].width, height: images[r.image].height }, tone: failedRegion.has(kind) ? 'red' : 'green' });
  add(regions?.date, 'date', 'Batch / expiry');
  (regions?.barcode ?? []).slice(0, 2).forEach((r) => add(r, 'barcode', 'Barcode'));
  (regions?.label ?? []).slice(0, 1).forEach((r) => add(r, 'label', 'Label'));
  return out;
}

const productName = (fields) => [fields.brandName?.value, fields.strength?.value].filter(Boolean).join(' ') || null;

/** Re-run the rules on the session's current state. */
async function rerun(session, extra = {}) {
  const { fields, printed } = resolveFields({ extracted: session.extracted ?? {}, barcode: session.barcode, userValues: session.userValues ?? {} });
  const ctx = await buildContext({
    gate: session.gate, fields, printed, confirmed: session.confirmed, barcode: session.barcode, visual: session.visual,
    answer: session.answer, deviceId: session.deviceId, city: session.city, receivingShopId: session.shopId, sample: Boolean(session.sampleId), ...extra,
  });
  return { ...evaluate(ctx), ctx, fields };
}

// Judge samples: the AI read of each sample is cached after its first run, so
// later runs are instant and identical. The rules and ledger still run live.
const sampleCache = new Map();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Start: photos in, inspection done. */
export async function startScan({ gate, files, deviceId, role, shopId, source, city, language = 'en', onStep = () => {}, sampleId }) {
  const session = await ScanSession.create({ gate, deviceId, role, shopId, source, city, language, sampleId });
  let insp;
  if (sampleId && sampleCache.has(sampleId)) {
    insp = sampleCache.get(sampleId);
    for (const step of ['quality', 'reading', 'read', 'regions', 'tamper']) {
      onStep(step, step === 'read' ? { fields: insp.extracted } : undefined);
      await pause(450);
    }
  } else {
    insp = await inspect(files.map((f) => f.buffer), { lookupProduct: lookupForInspector, onStep });
    if (sampleId && insp.aiAvailable) sampleCache.set(sampleId, insp);
  }

  // Store photos in the background; never block the scan on it.
  const stored = sampleId ? Promise.resolve() : Promise.all(insp.images.map((img, i) => store(img.buffer, { folder: `scans/${gate}`, name: `${session._id}-${i}.jpg`, kind: 'photo' })))
    .then((m) => ScanSession.updateOne({ _id: session._id }, { $set: { images: m.filter(Boolean) } }))
    .catch((err) => log.warn({ err: err.message }, 'photo store failed'));

  if (insp.retake) {
    session.quality = insp.quality;
    await session.save();
    return { sessionId: String(session._id), stage: 'retake', issues: insp.retake.issues };
  }
  // Without Meta AI we can still screen on a readable GS1 code (hard facts only).
  if (!insp.aiAvailable && !(insp.barcode?.found && insp.barcode.isGs1)) {
    await session.save();
    return { sessionId: String(session._id), stage: 'error', message: "We couldn't reach Meta AI just now. Please try again in a moment." };
  }

  Object.assign(session, {
    extracted: insp.extracted, barcode: insp.barcode, regions: insp.regions, visual: insp.visual, quality: insp.quality,
    timings: insp.timings, imageSizes: insp.images.map((i) => ({ width: i.width, height: i.height })),
  });
  await session.save();
  stored.catch(() => {});

  if (insp.extracted?.imageQuality && !insp.extracted.imageQuality.readable) {
    return { sessionId: String(session._id), stage: 'retake', issues: [insp.extracted.imageQuality.problem ?? 'unreadable'] };
  }
  return advance(session);
}

/** Decide the next stage after any change. */
async function advance(session) {
  const { checks, verdict, ctx, fields } = await rerun(session);
  const base = { sessionId: String(session._id), read: readValues(fields, verdict.confirmFields), timings: session.timings };

  if (verdict.code === 'needs_confirmation') {
    return { ...base, stage: 'confirm', confirmFields: verdict.confirmFields, message: verdict.line };
  }
  if (session.gate === 'home' && !session.answer) {
    return { ...base, stage: 'ask_shop' };
  }
  return finalize(session, { checks, verdict, ctx, fields });
}

/** User confirmed or corrected the read values. */
export async function confirmValues(sessionId, values = {}) {
  const session = await ScanSession.findById(sessionId);
  if (!session) throw Object.assign(new Error('Scan not found'), { status: 404 });
  const clean = Object.fromEntries(Object.entries(values).filter(([k, v]) => FIELD_LABELS[k] && typeof v === 'string').map(([k, v]) => [k, v.trim().slice(0, 60)]));
  session.userValues = { ...(session.userValues ?? {}), ...clean };
  session.confirmed = true;
  session.markModified('userValues');
  await session.save();
  return advance(session);
}

/** Buyer answered "where did you buy it?" (already interpreted / confirmed by the route). */
export async function setAnswer(sessionId, answer) {
  const session = await ScanSession.findById(sessionId);
  if (!session) throw Object.assign(new Error('Scan not found'), { status: 404 });
  session.answer = answer;
  session.markModified('answer');
  await session.save();
  return advance(session);
}

async function finalize(session, { checks, verdict, ctx, fields }) {
  const verified = isVerified(session.role);
  const serial = fields.serial?.value ?? null;
  const batch = fields.batch?.value ?? null;
  const live = !session.sampleId; // samples never touch the ledger
  let decision = null;

  if (session.gate === 'receiving') {
    decision = verdict.code === 'high_risk' ? 'rejected' : verdict.code === 'caution' || verdict.code === 'cant_verify' ? 'review' : 'accepted';
    if (decision === 'accepted' && live) {
      await logReceived({ serial, gtin: fields.gtin?.value, batch, expiry: fields.expiry?.value, regNo: fields.regNo?.value, productId: ctx.product?._id, shopId: session.shopId, source: session.source ?? {} });
    }
    const clone = checks.find((c) => c.id === 'SERIAL_CLONE' && c.status === 'fail');
    if (clone && live) {
      const shop = await Shop.findById(session.shopId).lean();
      await notifyClone({ serial, receivingShop: shop, otherShopId: ctx.pack?.shopId });
    }
  } else if (session.gate === 'home' && verdict.code !== 'high_risk' && live) {
    await claimPack({ serial, deviceId: session.deviceId });
  }

  const shownChecks = verified ? checks : publicView(checks);
  if (live) await ScanEvent.create({
    type: session.gate, deviceId: session.deviceId, shopId: session.gate === 'home' ? session.answer?.shopId : session.shopId,
    serial, batch: batch ? String(batch).toUpperCase() : null, extracted: session.extracted, barcode: session.barcode,
    checks, verdict, answerShop: session.answer ?? null, city: session.city, images: session.images,
  });

  if (live && (verdict.code === 'high_risk' || verdict.code === 'caution')) {
    await Device.updateOne({ deviceId: session.deviceId }, { $inc: { failingScans: 1 } }, { upsert: true });
  }

  const result = {
    verdict,
    checks: shownChecks,
    regions: evidenceRegions(session.regions, checks, session.imageSizes ?? []),
    product: ctx.product ? { brandName: ctx.product.brandName, genericName: ctx.product.genericName, strength: ctx.product.strength, manufacturer: ctx.product.manufacturer, category: ctx.product.category, demo: ctx.product.demo } : null,
    read: productName(fields),
    decision,
    canInvestigate: verdict.code === 'high_risk' || verdict.code === 'caution',
    gatedDetail: !verified,
    sample: session.sampleId ?? null,
  };
  session.result = result;
  session.finalizedAt = new Date();
  session.markModified('result');
  await session.save();

  // The explanation is written in the background so the verdict shows at once;
  // the UI fetches it from /explain, which reuses this promise.
  explainOnce(String(session._id), session.language, { verdict, checks, provenance: verdict.provenance, productName: result.read });
  return { sessionId: String(session._id), stage: 'result', ...result, explanation: null };
}

const explanations = new Map(); // `${sessionId}:${lang}` → Promise
export function explainOnce(sessionId, lang, evidence) {
  const key = `${sessionId}:${lang}`;
  if (!explanations.has(key)) {
    const p = explain(evidence, lang).catch((err) => { log.warn({ err: err.message }, 'explain failed'); explanations.delete(key); return null; });
    explanations.set(key, p);
    if (explanations.size > 500) explanations.delete(explanations.keys().next().value);
  }
  return explanations.get(key);
}

/** A pharmacist overrides "review" at receiving after looking at the pack. */
export async function acceptAfterReview(sessionId) {
  const session = await ScanSession.findById(sessionId);
  if (!session?.result || session.gate !== 'receiving' || session.result.decision !== 'review') throw Object.assign(new Error('Nothing to accept'), { status: 400 });
  const { fields, ctx } = await rerun(session);
  await logReceived({ serial: fields.serial?.value, gtin: fields.gtin?.value, batch: fields.batch?.value, expiry: fields.expiry?.value, regNo: fields.regNo?.value, productId: ctx.product?._id, shopId: session.shopId, source: session.source ?? {} });
  session.result = { ...session.result, decision: 'accepted_after_review' };
  session.markModified('result');
  await session.save();
  return { sessionId, decision: 'accepted_after_review' };
}

export async function getSession(sessionId) {
  return ScanSession.findById(sessionId).lean();
}
