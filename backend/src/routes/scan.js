import { Router } from 'express';
import { z } from 'zod';
import { startScan, confirmValues, setAnswer, acceptAfterReview, getSession } from '../services/scan.js';
import { receiveCarton } from '../services/carton.js';
import { interpretAnswer, explain } from '../agents/voice/index.js';
import { transcribe } from '../services/voice.js';
import { toPcm24k } from '../services/media.js';
import { Shop } from '../db/models/index.js';
import { imagesUpload, videoUpload, audioUpload, requireVerified, progress, asyncH } from './middleware.js';
import { log } from '../lib/log.js';

const r = Router();
const LANGS = ['en', 'pcm', 'yo', 'ha'];
const STEP_TEXT = {
  quality: 'Photo is clear',
  reading: 'Muse Spark is reading the label…',
  read: 'Label read',
  regions: 'SAM 3.1 found the barcode and label',
  tamper: 'Muse Spark is examining the date area…',
  artwork: 'Comparing the artwork with the genuine pack…',
};

const friendly = (err) => (err?.code === 'DAILY_CAP' ? 'TrueMed has reached today\'s AI limit. Please try a sample pack.' : err?.code === 'META_UNAVAILABLE' ? 'Meta AI is not connected yet.' : 'Something went wrong while checking this pack. Please try again.');

function runScan(gate) {
  return asyncH(async (req, res) => {
    const p = progress(req, res);
    if (!req.files?.length) return p.fail(400, 'Add a photo of the pack.');
    const language = LANGS.includes(req.body.language) ? req.body.language : 'en';
    const source = gate === 'receiving' ? {
      source: req.body.source === 'open_market' ? 'open_market' : 'authorized',
      supplierName: String(req.body.supplierName || '').slice(0, 80) || null,
      marketStall: String(req.body.marketStall || '').slice(0, 80) || null,
    } : undefined;
    try {
      const out = await startScan({
        gate, files: req.files, deviceId: req.deviceId, role: req.role, shopId: gate === 'receiving' ? req.shopId : undefined, source,
        city: String(req.body.city || '').slice(0, 40) || undefined, language,
        onStep: (step, data) => p.step({ step, text: STEP_TEXT[step] ?? step, ...(step === 'read' ? { brand: data?.fields?.brandName ?? null } : {}) }),
      });
      p.done(out);
    } catch (err) {
      log.error({ err: err.message, stack: err.stack }, 'scan failed');
      p.fail(err.status ?? 500, friendly(err));
    }
  });
}

r.post('/scan/home', imagesUpload, runScan('home'));
r.post('/scan/receiving', requireVerified, imagesUpload, runScan('receiving'));

r.post('/scan/:id/confirm', asyncH(async (req, res) => {
  const values = z.record(z.string(), z.string().max(60)).catch({}).parse(req.body?.values ?? {});
  res.json(await confirmValues(req.params.id, values));
}));

/**
 * The buyer's answer. Three forms:
 *  { sourceType: 'shop', shopId, confirmed: true }   tapped from the list or confirmed a suggestion
 *  { sourceType: 'market' | 'street' }
 *  { text } or multipart `audio`                       → Voice agent suggests; UI confirms
 */
r.post('/scan/:id/answer', audioUpload, asyncH(async (req, res) => {
  const body = req.body ?? {};
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Scan not found' });

  if (body.sourceType && !body.text && !req.file) {
    const sourceType = ['shop', 'market', 'street', 'unknown'].includes(body.sourceType) ? body.sourceType : 'unknown';
    const shopId = sourceType === 'shop' && body.shopId ? String(body.shopId) : null;
    if (shopId && !(await Shop.exists({ _id: shopId }))) return res.status(400).json({ error: 'Unknown shop' });
    const confirmed = body.confirmed === true || body.confirmed === 'true';
    return res.json(await setAnswer(req.params.id, { sourceType, shopId, confirmed, via: body.via ?? 'tap' }));
  }

  let text = String(body.text || '').slice(0, 500);
  let transcript = null;
  if (req.file) {
    const pcm = await toPcm24k(req.file.buffer);
    const t = await transcribe(pcm);
    transcript = t.transcript;
    text = t.transcript;
  }
  if (!text.trim()) return res.json({ stage: 'ask_shop', sessionId: req.params.id, heard: '', message: "We didn't catch that. Try again or pick from the list." });

  const shops = await Shop.find({ verified: true }).select('name area city aliases').lean();
  const a = await interpretAnswer(text, shops);
  if (a.sourceType === 'shop' && a.shopId) {
    const s = shops.find((x) => String(x._id) === a.shopId);
    // Ask the buyer to confirm before the match can count (D28).
    return res.json({ stage: 'confirm_shop', sessionId: req.params.id, transcript, heard: a.heard, suggestion: { shopId: a.shopId, name: s.name, area: s.area, city: s.city, confidence: a.confidence } });
  }
  if (a.sourceType === 'market' || a.sourceType === 'street') {
    return res.json({ ...(await setAnswer(req.params.id, { sourceType: a.sourceType, shopId: null, confirmed: true, via: req.file ? 'voice' : 'text' })), transcript, heard: a.heard });
  }
  return res.json({ stage: 'ask_shop', sessionId: req.params.id, transcript, heard: a.heard, message: "We couldn't match that to a shop. Pick from the list, or choose market or street seller." });
}));

r.post('/scan/:id/accept', requireVerified, asyncH(async (req, res) => res.json(await acceptAfterReview(req.params.id))));

r.post('/scan/carton', requireVerified, videoUpload, asyncH(async (req, res) => {
  const p = progress(req, res);
  if (!req.file) return p.fail(400, 'Add a short video of the carton.');
  try {
    const out = await receiveCarton({
      video: req.file.buffer, shopId: req.shopId, deviceId: req.deviceId,
      source: { source: req.body.source === 'open_market' ? 'open_market' : 'authorized', supplierName: req.body.supplierName || null, marketStall: req.body.marketStall || null },
      onStep: (s) => p.step(s),
    });
    p.done(out);
  } catch (err) {
    log.error({ err: err.message }, 'carton failed');
    p.fail(err.status ?? 500, friendly(err));
  }
}));

r.post('/voice/transcribe', audioUpload, asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio' });
  const t = await transcribe(await toPcm24k(req.file.buffer));
  res.json({ transcript: t.transcript, ms: t.ms });
}));

/** The same result explained in another language. */
r.post('/explain', asyncH(async (req, res) => {
  const { sessionId, lang } = z.object({ sessionId: z.string(), lang: z.enum(LANGS) }).parse(req.body);
  const s = await getSession(sessionId);
  if (!s?.result) return res.status(404).json({ error: 'No result yet' });
  res.json(await explain({ verdict: s.result.verdict, checks: s.result.checks, provenance: s.result.verdict.provenance, productName: s.result.read }, lang));
}));

export default r;
