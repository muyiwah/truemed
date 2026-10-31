// Re-read the sample packs with the 1280 px Muse Spark copy: fields + timings.
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { inspect } from '../src/agents/inspector/index.js';
await mongoose.connect(config.MONGODB_URI);
for (const f of process.argv.slice(2)) {
  const r = await inspect([await readFile(f)]);
  const e = r.extracted ?? {};
  console.log(f.split('/').pop(), JSON.stringify({ brand: e.brandName, reg: e.nafdacRegNo, batch: e.batchNo, mfg: e.manufactureDate, exp: e.expiryDate, tamper: r.visual?.tamper, t: r.timings }));
}
await mongoose.disconnect();
