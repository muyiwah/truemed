import { Router } from 'express';
import { z } from 'zod';
import { Device, Shop, Notification, CaseFile, Usage, Alert, Product } from '../db/models/index.js';
import { config, metaEnabled, imagekitEnabled } from '../config.js';
import { dbState } from '../db/connect.js';
import { investigate } from '../agents/investigator/index.js';
import { getSession } from '../services/scan.js';
import { reconcileShop } from '../services/ledger.js';
import { asyncH, progress } from './middleware.js';
import { log } from '../lib/log.js';

const r = Router();

r.get('/health', asyncH(async (_req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const usage = dbState() === 'connected' ? await Usage.findOne({ day }).lean() : null;
  const [products, alerts, shops] = dbState() === 'connected'
    ? await Promise.all([Product.countDocuments(), Alert.countDocuments({ status: 'approved' }), Shop.countDocuments()])
    : [0, 0, 0];
  res.json({
    status: dbState() === 'connected' ? 'ok' : 'degraded',
    database: dbState(),
    meta: metaEnabled ? 'configured' : 'missing_key',
    models: { spark: config.SPARK_MODEL, sam: config.SAM_MODEL, voice: config.VOICE_MODEL },
    storage: imagekitEnabled ? 'configured' : 'missing_keys',
    data: { products, alerts, shops },
    today: { calls: usage?.calls ?? 0, costUsd: Number((usage?.costUsd ?? 0).toFixed(4)), cap: config.DAILY_SPEND_CAP_USD },
  });
}));

/** Register an anonymous device and its language. */
r.post('/device', asyncH(async (req, res) => {
  if (!req.deviceId) return res.status(400).json({ error: 'Missing device id' });
  const { language } = z.object({ language: z.enum(['en', 'pcm', 'yo', 'ha']).optional() }).parse(req.body ?? {});
  const d = await Device.findOneAndUpdate({ deviceId: req.deviceId }, { $set: { ...(language ? { language } : {}) }, $setOnInsert: { role: 'public' } }, { upsert: true, new: true }).lean();
  const shop = d.shopId ? await Shop.findById(d.shopId).select('name type area city').lean() : null;
  res.json({ role: d.role, language: d.language, shop });
}));

/** Demo sign-in for pharmacists / licensed chemists (a PIN, not real accounts). */
r.post('/auth/pin', asyncH(async (req, res) => {
  const { pin, shopId } = z.object({ pin: z.string(), shopId: z.string() }).parse(req.body);
  if (!req.deviceId) return res.status(400).json({ error: 'Missing device id' });
  if (pin !== config.PHARMACIST_DEMO_PIN) return res.status(401).json({ error: 'Wrong PIN' });
  const shop = await Shop.findById(shopId).lean();
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const role = shop.type === 'pharmacy' ? 'pharmacist' : 'chemist';
  await Device.updateOne({ deviceId: req.deviceId }, { $set: { role, shopId: shop._id } }, { upsert: true });
  res.json({ role, shop: { _id: shop._id, name: shop.name, type: shop.type, area: shop.area, city: shop.city } });
}));

r.post('/auth/signout', asyncH(async (req, res) => {
  if (req.deviceId) await Device.updateOne({ deviceId: req.deviceId }, { $set: { role: 'public' }, $unset: { shopId: 1 } });
  res.json({ role: 'public' });
}));

/** Shops for the "where did you buy it?" list. Never says which shop holds which pack. */
r.get('/shops', asyncH(async (_req, res) => {
  res.json(await Shop.find({ verified: true }).select('name type area city approxLocation').sort({ city: 1, name: 1 }).lean());
}));

r.get('/notifications', asyncH(async (req, res) => {
  if (!req.shopId) return res.json([]);
  res.json(await Notification.find({ shopId: req.shopId }).sort({ createdAt: -1 }).limit(50).lean());
}));

r.post('/notifications/read', asyncH(async (req, res) => {
  if (req.shopId) await Notification.updateMany({ shopId: req.shopId, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}));

r.get('/shops/:id/reconciliation', asyncH(async (req, res) => {
  if (req.shopId !== req.params.id && req.role !== 'admin') return res.status(403).json({ error: 'Not your shop' });
  res.json(await reconcileShop(req.params.id));
}));

/** Investigator: streams its reasoning trail. Body: { sessionId } */
r.post('/investigate', asyncH(async (req, res) => {
  const p = progress(req, res);
  const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
  const s = await getSession(sessionId);
  if (!s?.result) return p.fail(404, 'Finish the scan first.');
  const f = s.result;
  const trigger = {
    gate: s.gate,
    product: f.read,
    serial: s.barcode?.serial ?? s.userValues?.serial ?? s.extracted?.serial ?? null,
    batch: s.barcode?.batch ?? s.userValues?.batch ?? s.extracted?.batchNo ?? null,
    regNo: s.userValues?.regNo ?? s.extracted?.nafdacRegNo ?? null,
    verdict: f.verdict.title,
    failedChecks: f.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.reason}`),
    buyerAnswer: s.answer?.sourceType ?? null,
    at: s.finalizedAt ? new Date(s.finalizedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WAT' : null,
  };
  try {
    const cf = await investigate({ trigger }, (step) => p.step(step));
    p.done({ caseId: String(cf._id), caseFile: cf.caseFile, steps: cf.steps });
  } catch (err) {
    log.error({ err: err.message }, 'investigation failed');
    p.fail(500, 'The investigation could not finish. Try again.');
  }
}));

r.get('/cases/:id', asyncH(async (req, res) => {
  const cf = await CaseFile.findById(req.params.id).lean();
  if (!cf) return res.status(404).json({ error: 'Case not found' });
  res.json(cf);
}));

export default r;
