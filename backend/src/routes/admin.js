import { Router } from 'express';
import { z } from 'zod';
import { Alert, IssuedSerial, ScanSession, Video } from '../db/models/index.js';
import { viewUrl, signUpload, removeMedia } from '../services/storage.js';
import { config } from '../config.js';
import { ingest, approve, matchPacks } from '../agents/sentinel/index.js';
import { issue, dispatch, label, resetDemo, SCENARIOS, DEMO_GTIN } from '../demo/demoquin.js';
import { requireAdmin, requireOwner, asyncH } from './middleware.js';

const r = Router();

// Which PIN is this? The admin page uses it to unlock (owner = full, judge = demo controls).
r.get('/admin-check', requireAdmin, (req, res) => res.json({ role: req.adminRole }));

// --- Sentinel ---
r.get('/alerts', asyncH(async (_req, res) => {
  res.json(await Alert.find().select('-rawText').sort({ status: 1, createdAt: -1 }).lean());
}));
r.post('/alerts/ingest', requireAdmin, asyncH(async (req, res) => {
  const body = z.object({ url: z.string().url().optional(), text: z.string().max(40_000).optional() }).parse(req.body);
  const { alert, via } = await ingest(body);
  const wouldHit = await matchPacks(alert);
  res.json({ alert, via, preview: { packs: wouldHit.length, shops: new Set(wouldHit.map((p) => String(p.shopId))).size } });
}));
r.post('/alerts/:id/approve', requireAdmin, asyncH(async (req, res) => {
  const edits = z.object({ title: z.string().optional(), batches: z.array(z.object({ batchNo: z.string(), expiry: z.string().nullable() })).optional() }).parse(req.body ?? {});
  res.json(await approve(req.params.id, edits));
}));
r.post('/alerts/:id/reject', requireAdmin, asyncH(async (req, res) => {
  await Alert.updateOne({ _id: req.params.id }, { $set: { status: 'rejected' } });
  res.json({ ok: true });
}));

// --- Field-test export (eval set) ---
// Real scans only, with short-lived photo links. Read by scripts/exportField.js.
r.get('/field-scans', requireOwner, asyncH(async (req, res) => {
  const since = z.coerce.date().optional().catch(undefined).parse(req.query.since);
  const sessions = await ScanSession.find({ sampleId: null, ...(since ? { createdAt: { $gte: since } } : {}) })
    .select('gate role city language images extracted barcode visual quality userValues confirmed answer result timings createdAt finalizedAt')
    .sort({ createdAt: 1 }).limit(1000).lean();
  res.json(sessions.map(({ images, ...s }) => ({ ...s, photos: (images ?? []).map((m) => viewUrl(m, { expireSeconds: 900 })).filter(Boolean) })));
}));

// --- Videos: demo footage (uploaded from the browser straight to ImageKit) + carton scans ---
// Videos can't be deleted for 72 hours (needed for editing the demo film), and their links last as long.
const KEEP_SECONDS = 72 * 3600;
const FOOTAGE_FOLDER = `${config.IMAGEKIT_FOLDER.replace(/\/+$/, '')}/footage`;
r.get('/videos/upload-auth', requireOwner, (_req, res) => {
  const auth = signUpload();
  if (!auth) return res.status(503).json({ error: 'Video storage is not configured on the server.' });
  res.json({ ...auth, folder: FOOTAGE_FOLDER });
});
r.post('/videos', requireOwner, asyncH(async (req, res) => {
  const b = z.object({
    fileId: z.string().min(1).max(100), filePath: z.string().min(1).max(500), url: z.string().url(),
    title: z.string().max(200).optional(), size: z.number().nonnegative().optional(), durationSec: z.number().nonnegative().optional(),
  }).parse(req.body);
  if (!b.filePath.startsWith(`${FOOTAGE_FOLDER}/`)) return res.status(400).json({ error: 'Not a footage upload.' });
  const v = await Video.create({ kind: 'footage', title: b.title, size: b.size, durationSec: b.durationSec, media: { fileId: b.fileId, filePath: b.filePath, url: b.url, isPrivate: true, kind: 'video' } });
  res.json({ id: v._id });
}));
r.get('/videos', requireOwner, asyncH(async (_req, res) => {
  const list = await Video.find().sort({ createdAt: -1 }).limit(300).lean();
  res.json(list.map(({ media, annotated, ...v }) => ({
    ...v,
    url: viewUrl(media, { expireSeconds: KEEP_SECONDS }),
    poster: annotated ? viewUrl(annotated, { expireSeconds: KEEP_SECONDS }) : null,
    deletableAt: new Date(new Date(v.createdAt).getTime() + KEEP_SECONDS * 1000),
  })));
}));
r.patch('/videos/:id', requireOwner, asyncH(async (req, res) => {
  const { title } = z.object({ title: z.string().max(200) }).parse(req.body);
  await Video.updateOne({ _id: req.params.id }, { $set: { title } });
  res.json({ ok: true });
}));
r.delete('/videos/:id', requireOwner, asyncH(async (req, res) => {
  const found = await Video.findById(req.params.id).select('createdAt').lean();
  if (found && Date.now() - new Date(found.createdAt).getTime() < KEEP_SECONDS * 1000) {
    return res.status(409).json({ error: 'Videos are kept for 72 hours after upload. Try again later.' });
  }
  const v = await Video.findByIdAndDelete(req.params.id).lean();
  if (v) { await removeMedia(v.media); if (v.annotated) await removeMedia(v.annotated); }
  res.json({ ok: Boolean(v) });
}));

// --- DemoQuin ---
r.get('/demo/scenarios', (_req, res) => res.json({ gtin: DEMO_GTIN, scenarios: SCENARIOS }));
r.post('/demo/reset', requireAdmin, asyncH(async (_req, res) => res.json(await resetDemo())));
r.post('/demo/issue', requireAdmin, asyncH(async (req, res) => {
  const { count } = z.object({ count: z.coerce.number().int().min(1).max(200).default(10) }).parse(req.body ?? {});
  res.json(await issue({ count }));
}));
r.post('/demo/dispatch', requireAdmin, asyncH(async (req, res) => {
  const { serials } = z.object({ serials: z.array(z.string()).min(1).max(200) }).parse(req.body);
  res.json(await dispatch({ serials }));
}));
r.get('/demo/serials', asyncH(async (_req, res) => {
  res.json(await IssuedSerial.find({ gtin: DEMO_GTIN }).sort({ serial: 1 }).lean());
}));
/** Printable label PNG. Any serial can be printed — that is how the "never issued" fake is made. */
r.get('/demo/labels/:serial.png', asyncH(async (req, res) => {
  const serial = String(req.params.serial).toUpperCase();
  if (!/^DQ\d{6}$/.test(serial)) return res.status(400).json({ error: 'DemoQuin serials look like DQ000001' });
  const rec = await IssuedSerial.findOne({ gtin: DEMO_GTIN, serial }).lean();
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(await label({ serial, batch: rec?.batch, expiry: rec?.expiry }));
}));

export default r;
