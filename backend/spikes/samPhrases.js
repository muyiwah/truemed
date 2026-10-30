import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../src/db/connect.js';
import { samImage, toDataUrl } from '../src/services/meta.js';
import { normalizeImage } from '../src/services/media.js';
import { SAMPLES, renderSample } from '../src/demo/samples.js';
await connectDb();
const img = await normalizeImage(await renderSample(SAMPLES[1]));
const url = toDataUrl(img.buffer);
const phrases = process.argv.slice(2);
await Promise.all(phrases.map(async (p) => {
  const r = await samImage({ image: url, width: img.width, height: img.height, phrase: p }).catch((e) => ({ error: e.message, boxes: [] }));
  console.log(p.padEnd(16), r.error ?? `${r.boxes.length} → ${r.boxes.map((b) => `[${b.left},${b.top},${b.right},${b.bottom}] c=${b.confidence?.toFixed(2)}`).join(' ')}`);
}));
console.log('image', img.width, img.height);
await mongoose.disconnect();
