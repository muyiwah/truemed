import { SAMPLES, renderSample } from '../src/demo/samples.js';
import { readPackBarcode } from '../src/services/barcode.js';
import { writeFile } from 'node:fs/promises';
for (const s of SAMPLES) {
  const img = await renderSample(s);
  await writeFile(`spikes/sample-${s.id}.jpg`, img);
  const b = await readPackBarcode(img);
  console.log(s.id, b.found, b.serial, b.expiry);
}
