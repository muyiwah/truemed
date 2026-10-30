import 'dotenv/config';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { connectDb } from '../src/db/connect.js';
import { sparkJson, imagePart, textPart, toDataUrl } from '../src/services/meta.js';
import { SAMPLES, renderSample } from '../src/demo/samples.js';
import { EXTRACTION } from '../src/agents/inspector/prompts.js';
import { extractionSchema, extractionZod } from '../src/agents/inspector/schemas.js';
await connectDb();
const raw = await renderSample(SAMPLES[1]);
const want = { nafdacRegNo: 'DEMO-0001', batchNo: 'DQ2610', expiryDate: '2028-05', manufactureDate: '2026-05', serial: 'DQ000003' };
for (const [effort, width] of [['minimal', 1400], ['low', 1400], ['minimal', 1024], ['low', 1024]]) {
  const img = await sharp(raw).resize({ width }).jpeg({ quality: 85 }).toBuffer();
  const t0 = Date.now();
  const r = await sparkJson({ label: 'extraction', effort, instructions: EXTRACTION, content: [textPart('Read this pack photo.'), imagePart(toDataUrl(img))], schema: extractionSchema, zod: extractionZod });
  const wrong = Object.entries(want).filter(([k, v]) => r.data[k] !== v).map(([k]) => `${k}=${r.data[k]}`);
  console.log(effort.padEnd(8), width, `${Date.now() - t0}ms`, `$${r.cost.toFixed(4)}`, wrong.length ? `WRONG ${wrong}` : 'all fields correct', 'dateBox', JSON.stringify(r.data.dateRegionBox));
}
await mongoose.disconnect();
