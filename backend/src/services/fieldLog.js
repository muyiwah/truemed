/**
 * Local copy of real scans (photos + what the AI read) for building the eval
 * set from field tests. Used only when ImageKit is not configured.
 * Files land in backend/data/field/<date>/<sessionId>/ (git-ignored).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/field');

export async function saveFieldScan(sessionId, { gate, files, insp }) {
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(ROOT, day, sessionId);
  await mkdir(dir, { recursive: true });
  await Promise.all(files.map((f, i) => writeFile(path.join(dir, `photo-${i}.jpg`), f.buffer)));
  await writeFile(path.join(dir, 'read.json'), JSON.stringify({
    gate, at: new Date().toISOString(),
    extracted: insp.extracted ?? null, barcode: insp.barcode ?? null,
    visual: insp.visual ?? null, quality: insp.quality ?? null, timings: insp.timings ?? null,
  }, null, 2));
}
