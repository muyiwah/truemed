/**
 * Carton receiving by video (Gate 1, D19).
 *
 *   browser video → H.264 MP4 (SAM rejects WebM) → SAM 3.1 tracks "box" across frames
 *   → for each tracked pack, the frame where it is largest → crop → zxing + Muse Spark read
 *   → rule engine per pack (receiving gate) → annotated keyframe + per-pack decisions
 *
 * Packs whose only hard fail rests on AI-read text go to "review", never straight
 * to rejection: there is no per-pack confirm step in a carton flow (rule 2).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { samVideo, sparkJson, imagePart, textPart, toDataUrl } from './meta.js';
import { prepareVideo, renderOverlay } from './media.js';
import { readPackBarcode } from './barcode.js';
import { evaluate, resolveFields } from '../rules/index.js';
import { buildContext, logReceived, notifyClone } from './ledger.js';
import { ScanEvent, Shop, Video } from '../db/models/index.js';
import { log } from '../lib/log.js';
import { store } from './storage.js';
import { frameIndexOf } from '@meta-sam/parser';

const readSchema = {
  type: 'object', additionalProperties: false, required: ['packs'],
  properties: {
    packs: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['index', 'brandName', 'nafdacRegNo', 'batchNo', 'expiryDate', 'serial', 'readable'],
        properties: {
          index: { type: 'integer' }, brandName: { type: ['string', 'null'] }, nafdacRegNo: { type: ['string', 'null'] },
          batchNo: { type: ['string', 'null'] }, expiryDate: { type: ['string', 'null'] }, serial: { type: ['string', 'null'] }, readable: { type: 'boolean' },
        },
      },
    },
  },
};
const readZod = z.object({ packs: z.array(z.object({ index: z.number().int(), brandName: z.string().nullable(), nafdacRegNo: z.string().nullable(), batchNo: z.string().nullable(), expiryDate: z.string().nullable(), serial: z.string().nullable(), readable: z.boolean() })) });

export async function receiveCarton({ video, shopId, source, deviceId, onStep = () => {} }) {
  onStep({ step: 'video', text: 'Preparing the video' });
  const v = await prepareVideo(video, { maxSeconds: 15, fps: 10, keyframes: 4 });

  onStep({ step: 'track', text: 'SAM 3.1 is tracking every pack in the carton' });
  // Real cartons answer to "box"; flat packs and printed mocks to "card" (spike, Oct 30).
  const videoUrl = `data:video/mp4;base64,${v.mp4.toString('base64')}`;
  let sam = null;
  for (const phrase of ['box', 'card', 'package']) {
    sam = await samVideo({ video: videoUrl, phrase, frames: v.frames });
    if (sam.boxes.length) break;
  }

  // Best frame per object = where its box is largest.
  const best = new Map();
  for (const b of sam.boxes) {
    const area = (b.right - b.left) * (b.bottom - b.top);
    const cur = best.get(b.objectId);
    if (!cur || area > cur.area) best.set(b.objectId, { area, frame: frameIndexOf(b), bounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } });
  }
  const objects = [...best.entries()].slice(0, 16).map(([id, o]) => ({ id, ...o }));
  onStep({ step: 'tracked', text: `Found ${objects.length} pack${objects.length === 1 ? '' : 's'}`, count: objects.length });
  if (!objects.length) return { packs: [], summary: { total: 0 }, message: 'No packs were found in the video. Hold the camera closer and move slowly across the carton.' };

  // Pull each object's best frame from the MP4.
  const frames = new Map();
  for (const o of objects) if (!frames.has(o.frame)) frames.set(o.frame, await frameAt(v.mp4, o.frame / v.fps));
  const crops = await Promise.all(objects.map(async (o) => {
    const f = frames.get(o.frame);
    const pad = 6;
    const left = Math.max(0, o.bounds.left - pad);
    const top = Math.max(0, o.bounds.top - pad);
    return sharp(f).extract({ left, top, width: Math.min(v.width - left, o.bounds.right - left + pad), height: Math.min(v.height - top, o.bounds.bottom - top + pad) })
      .resize({ width: 800, withoutEnlargement: false }).jpeg({ quality: 90 }).toBuffer();
  }));

  onStep({ step: 'read', text: 'Muse Spark is reading each pack' });
  const [barcodes, read] = await Promise.all([
    Promise.all(crops.map((c) => readPackBarcode(c).catch(() => ({ found: false })))),
    sparkJson({
      label: 'carton-read',
      instructions: 'Each image is one pack cropped from a video of a carton. For each, read only what is printed: brand, NAFDAC number, batch, expiry (YYYY-MM), unit serial (SN). Null when not legible — never guess. readable=false if the crop is too blurry.',
      content: crops.flatMap((c, i) => [textPart(`Pack index ${i}:`), imagePart(toDataUrl(c))]),
      schema: readSchema,
      zod: readZod,
      timeoutMs: 60_000,
      effort: 'low',
    }).then((r) => r.data.packs).catch(() => []),
  ]);

  onStep({ step: 'check', text: 'Checking each pack against the ledger' });
  const shop = await Shop.findById(shopId).lean();
  const packs = [];
  for (const [i, o] of objects.entries()) {
    const r = read.find((p) => p.index === i) ?? {};
    const extracted = { brandName: r.brandName, nafdacRegNo: r.nafdacRegNo, batchNo: r.batchNo, expiryDate: /^\d{4}-\d{2}$/.test(r.expiryDate ?? '') ? r.expiryDate : null, serial: r.serial };
    const { fields, printed } = resolveFields({ extracted, barcode: barcodes[i] });
    const ctx = await buildContext({ gate: 'carton', fields, printed, confirmed: false, barcode: barcodes[i], visual: {}, deviceId, receivingShopId: shopId });
    const { checks, verdict } = evaluate(ctx);
    // No per-pack confirm step in a carton: a hard fail on machine-read facts
    // (barcode, ledger) rejects; one resting only on AI-read text goes to review.
    const solidHard = checks.some((c) => c.status === 'fail' && c.type === 'hard' && !c.usesReadText);
    const decision = verdict.code === 'high_risk' || solidHard ? 'rejected'
      : verdict.code === 'needs_confirmation' || verdict.code === 'caution' || verdict.code === 'cant_verify' ? 'review' : 'accepted';
    const serial = fields.serial?.value ?? null;
    if (decision === 'accepted') await logReceived({ serial, gtin: fields.gtin?.value, batch: fields.batch?.value, expiry: fields.expiry?.value, regNo: fields.regNo?.value, productId: ctx.product?._id, shopId, source });
    if (checks.some((c) => c.id === 'SERIAL_CLONE' && c.status === 'fail')) await notifyClone({ serial, receivingShop: shop, otherShopId: ctx.pack?.shopId });
    await ScanEvent.create({ type: 'carton', deviceId, shopId, serial, batch: fields.batch?.value?.toUpperCase() ?? null, extracted, barcode: barcodes[i], checks, verdict });
    packs.push({
      objectId: o.id, frame: o.frame, box: o.bounds, serial, batch: fields.batch?.value ?? null, name: r.brandName ?? ctx.product?.brandName ?? null,
      decision, verdict: { code: verdict.code, title: verdict.title, line: verdict.line }, failed: checks.filter((c) => c.status === 'fail').map((c) => ({ id: c.id, reason: c.reason })),
    });
  }

  // Annotated keyframe: the frame with the most packs visible.
  const counts = new Map();
  for (const b of sam.boxes) counts.set(frameIndexOf(b), (counts.get(frameIndexOf(b)) ?? 0) + 1);
  const keyFrame = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const keyImg = frames.get(keyFrame) ?? (await frameAt(v.mp4, keyFrame / v.fps));
  const tone = { accepted: 'green', review: 'amber', rejected: 'red' };
  const regions = sam.boxes.filter((b) => frameIndexOf(b) === keyFrame).map((b) => {
    const p = packs.find((x) => x.objectId === b.objectId);
    return { label: p ? `${p.serial ?? 'no serial'} · ${p.decision}` : 'pack', tone: tone[p?.decision] ?? 'amber', box: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } };
  });
  const annotated = await renderOverlay(keyImg, { width: v.width, height: v.height, regions });
  const stored = await store(annotated, { folder: 'carton', name: `carton-${Date.now()}.jpg`, kind: 'annotated' });

  const summary = { total: packs.length, accepted: packs.filter((p) => p.decision === 'accepted').length, review: packs.filter((p) => p.decision === 'review').length, rejected: packs.filter((p) => p.decision === 'rejected').length };
  saveCartonVideo({ mp4: v.mp4, duration: v.duration, shopId, summary, annotated: stored });
  onStep({ step: 'done', text: 'Done' });
  return { packs, summary, annotatedImage: `data:image/jpeg;base64,${annotated.toString('base64')}`, annotatedStored: stored, video: { width: v.width, height: v.height, duration: v.duration }, cost: sam.cost };
}

async function frameAt(mp4, seconds) {
  const { default: ffmpeg } = await import('fluent-ffmpeg');
  const { PassThrough } = await import('node:stream');
  const { writeFile, rm, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'truemed-f-'));
  const p = join(dir, 'v.mp4');
  await writeFile(p, mp4);
  try {
    return await new Promise((resolve, reject) => {
      const out = new PassThrough();
      const chunks = [];
      out.on('data', (c) => chunks.push(c));
      out.on('end', () => resolve(Buffer.concat(chunks)));
      ffmpeg(p).seekInput(Math.max(0, seconds)).frames(1).format('image2').outputOptions(['-vcodec', 'mjpeg', '-q:v', '3']).on('error', reject).pipe(out);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Keep the carton video for the admin Videos section. In the background; never fails the scan. */
function saveCartonVideo({ mp4, duration, shopId, summary, annotated }) {
  (async () => {
    const media = await store(mp4, { folder: 'carton-video', name: `carton-${Date.now()}.mp4`, kind: 'video' });
    if (!media) return;
    const shop = shopId ? await Shop.findById(shopId).select('name').lean() : null;
    await Video.create({ kind: 'carton', title: `Carton at ${shop?.name ?? 'unknown shop'}`, media, size: mp4.length, durationSec: duration, shopId, summary, annotated });
  })().catch((err) => log.warn({ err: err.message }, 'carton video save failed'));
}
