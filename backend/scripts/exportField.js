/**
 * Pull real field-test scans from the live API into backend/data/field/ for the
 * eval set (git-ignored). Each scan gets its photos plus read.json: what the AI
 * read, what the user corrected on the confirm screen, barcode, verdict, timings.
 * Also writes data/field/index.csv to fill in the true values by hand.
 *
 *   npm run export:field                      # everything still on the server (14 days)
 *   npm run export:field -- --since 2026-11-01
 *
 * Needs the admin PIN: ADMIN_PIN env, else read from .env.production.
 * Scans already exported are skipped.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../data/field');
const API = (process.env.TRUEMED_API ?? 'https://api.truemed.finessedev.space/api').replace(/\/+$/, '');
const since = process.argv.includes('--since') ? process.argv[process.argv.indexOf('--since') + 1] : null;

async function adminPin() {
  if (process.env.ADMIN_PIN) return process.env.ADMIN_PIN;
  const env = await readFile(path.resolve(HERE, '../.env.production'), 'utf8').catch(() => '');
  const pin = env.match(/^ADMIN_PIN=(.+)$/m)?.[1]?.trim();
  if (!pin) throw new Error('Set ADMIN_PIN or add it to backend/.env.production');
  return pin;
}

const exists = (p) => access(p).then(() => true, () => false);
const csv = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

const pin = await adminPin();
const res = await fetch(`${API}/field-scans${since ? `?since=${encodeURIComponent(since)}` : ''}`, { headers: { 'X-Admin-Pin': pin }, signal: AbortSignal.timeout(30_000) });
if (!res.ok) throw new Error(`Export failed: ${res.status} ${await res.text()}`);
const scans = await res.json();

let added = 0;
const rows = [['id', 'date', 'gate', 'photos', 'brand_read', 'regNo_read', 'batch_read', 'expiry_read', 'user_corrected', 'verdict', 'total_ms', 'TRUE_brand', 'TRUE_regNo', 'TRUE_batch', 'TRUE_expiry', 'TRUE_verdict', 'notes']];
for (const s of scans) {
  const day = s.createdAt.slice(0, 10);
  const dir = path.join(ROOT, day, s._id);
  if (!(await exists(path.join(dir, 'read.json')))) {
    await mkdir(dir, { recursive: true });
    for (const [i, url] of s.photos.entries()) {
      const img = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (img.ok) await writeFile(path.join(dir, `photo-${i}.jpg`), Buffer.from(await img.arrayBuffer()));
      else console.warn(`  photo ${i} of ${s._id}: HTTP ${img.status}`);
    }
    const { photos, ...rest } = s;
    await writeFile(path.join(dir, 'read.json'), JSON.stringify({ ...rest, photoCount: photos.length }, null, 2));
    added++;
  }
  const e = s.extracted ?? {};
  rows.push([s._id, day, s.gate, s.photos.length, e.brandName, e.nafdacRegNo, e.batchNo, e.expiryDate,
    s.userValues && Object.keys(s.userValues).length ? JSON.stringify(s.userValues) : '', s.result?.verdict?.code ?? s.result?.decision ?? '', s.timings?.total ?? '', '', '', '', '', '', '']);
}

await mkdir(ROOT, { recursive: true });
const indexPath = path.join(ROOT, 'index.csv');
if (await exists(indexPath)) {
  // Never overwrite hand-filled truth columns: write the fresh listing beside it.
  await writeFile(path.join(ROOT, 'index.new.csv'), rows.map((r) => r.map(csv).join(',')).join('\n'));
  console.log('index.csv exists (may hold your notes); fresh listing written to index.new.csv');
} else {
  await writeFile(indexPath, rows.map((r) => r.map(csv).join(',')).join('\n'));
}
console.log(`${scans.length} real scans on the server, ${added} newly exported → ${ROOT}`);
