// Phase 0: verify every Meta call shape against the live API. Usage: node spikes/phase0.js [only]
import 'dotenv/config';
import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { connectDb } from '../src/db/connect.js';
import { sparkJson, samImage, samVideo, imagePart, textPart, toDataUrl } from '../src/services/meta.js';
import { transcribe } from '../src/services/voice.js';
import { toPcm24k, normalizeImage, prepareVideo, normBoxToPixels } from '../src/services/media.js';
import { SAMPLES, renderSample } from '../src/demo/samples.js';
import { EXTRACTION } from '../src/agents/inspector/prompts.js';
import { extractionSchema, extractionZod } from '../src/agents/inspector/schemas.js';

const only = process.argv[2];
const out = {};
const run = async (name, fn) => {
  if (only && !name.startsWith(only)) return;
  const t0 = Date.now();
  try { const r = await fn(); out[name] = { ok: true, ms: Date.now() - t0, ...r }; console.log(`✔ ${name} ${Date.now() - t0}ms`, JSON.stringify(r).slice(0, 700)); }
  catch (e) { out[name] = { ok: false, ms: Date.now() - t0, error: e.message, status: e.status, body: e.error ?? null }; console.log(`✘ ${name}`, e.status ?? '', e.message, JSON.stringify(e.error ?? '').slice(0, 500)); }
};

await connectDb();
const tampered = await normalizeImage(await renderSample(SAMPLES.find((s) => s.id === 'tampered')));
const url = toDataUrl(tampered.buffer);
let extracted;

await run('spark-extraction', async () => {
  const r = await sparkJson({ label: 'extraction', instructions: EXTRACTION, content: [textPart('Read this pack photo.'), imagePart(url)], schema: extractionSchema, zod: extractionZod });
  extracted = r.data;
  return { cost: r.cost, data: r.data };
});

await run('sam-phrase-barcode', async () => {
  const r = await samImage({ image: url, width: tampered.width, height: tampered.height, phrase: 'qr code' });
  return { n: r.boxes.length, boxes: r.boxes.map((b) => ({ ...b.bounds, c: b.confidence })), masks: r.masks.length, outcome: r.outcome, diag: r.diagnostics.length };
});

await run('sam-box-date', async () => {
  const b = extracted?.dateRegionBox ?? { x1: 600, y1: 560, x2: 860, y2: 700 };
  const px = normBoxToPixels(b, tampered.width, tampered.height);
  const r = await samImage({ image: url, width: tampered.width, height: tampered.height, boxes: [{ id: 1, box: px }] });
  return { prompt: px, n: r.boxes.length, box: r.boxes[0]?.bounds, masks: r.masks.length, outcome: r.outcome };
});

await run('sam-video-box', async () => {
  // Synthetic pan across three sample packs on a table.
  const imgs = await Promise.all(['genuine', 'tampered', 'never-issued'].map(async (id) => (await import('sharp')).default(await renderSample(SAMPLES.find((s) => s.id === id))).resize(640).toBuffer()));
  const sharp = (await import('sharp')).default;
  const strip = await sharp({ create: { width: 2100, height: 600, channels: 3, background: '#7a6a55' } })
    .composite(imgs.map((b, i) => ({ input: b, top: 70, left: 40 + i * 690 }))).jpeg().toBuffer();
  await writeFile('/tmp/truemed-strip.jpg', strip);
  execFileSync((await import('ffmpeg-static')).default, ['-y', '-loop', '1', '-i', '/tmp/truemed-strip.jpg', '-vf', "crop=1280:600:'min(820,t*160)':0,format=yuv420p", '-t', '6', '-r', '10', '-c:v', 'libvpx-vp9', '-b:v', '800k', '/tmp/truemed-pan.webm'], { stdio: 'ignore' });
  const v = await prepareVideo(await readFile('/tmp/truemed-pan.webm'), { maxSeconds: 6, fps: 10 });
  const r = await samVideo({ video: `data:video/mp4;base64,${v.mp4.toString('base64')}`, phrase: 'card', frames: v.frames });
  const ids = new Set(r.boxes.map((b) => b.objectId));
  return { frames: v.frames, records: r.boxes.length, objects: ids.size, outcome: r.outcome, cost: r.cost };
});

const speech = async (text) => {
  execFileSync('say', ['-v', 'Daniel', '-o', '/tmp/truemed-say.aiff', text]);
  return toPcm24k(await readFile('/tmp/truemed-say.aiff'));
};
await run('voice-english', async () => {
  const r = await transcribe(await speech('I bought it from Ikeja Care Pharmacy, near the roundabout.'));
  return { transcript: r.transcript, ms: r.ms };
});
await run('voice-pidgin', async () => {
  const r = await transcribe(await speech('I buy am for the chemist wey dey Ojo junction, na Mama Bisi dey sell am.'));
  return { transcript: r.transcript, ms: r.ms };
});

await writeFile('spikes/phase0-results.json', JSON.stringify(out, null, 2));
await mongoose.disconnect();
