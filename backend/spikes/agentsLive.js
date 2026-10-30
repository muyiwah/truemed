// Live check of Sentinel, Investigator and carton receiving through the HTTP API.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
const BASE = 'http://localhost:4080/api';
const ADMIN = process.env.ADMIN_PIN;
const call = async (path, { device = 'agents-live-0001', json, form, admin } = {}) => {
  const headers = { 'X-Device-Id': device };
  if (json) headers['Content-Type'] = 'application/json';
  if (admin) headers['X-Admin-Pin'] = ADMIN;
  const r = await fetch(BASE + path, { method: json || form || admin ? 'POST' : 'GET', headers, body: json ? JSON.stringify(json) : form });
  return r.json();
};
const time = async (label, fn) => { const t0 = Date.now(); const r = await fn(); console.log(`\n== ${label} (${Date.now() - t0}ms)`); return r; };

// Sentinel: text built only from facts in the verified Vanguard report.
const s = await time('Sentinel ingest', () => call('/alerts/ingest', { admin: true, json: { text: 'NAFDAC Public Alert No. 07/2026: Falsification and parallel importation of Dostinex 0.5mg tablets. NAFDAC alerts the public to falsified and parallel-imported versions of three batches of Dostinex 0.5mg. Affected batch numbers: GG3470, LG8659 and GG2440. Healthcare providers and consumers should exercise caution and vigilance within the supply chain.' } }));
console.log(JSON.stringify({ title: s.alert?.title, alertNo: s.alert?.alertNo, type: s.alert?.type, batches: s.alert?.batches, status: s.alert?.status, preview: s.preview, error: s.error }));
if (s.alert?._id) await call(`/alerts/${s.alert._id}/reject`, { admin: true, json: {} });

// Investigator on a container-fake sample.
const run = await call('/samples/never-issued/run', { json: { language: 'en' } });
const fin = await call(`/scan/${run.sessionId}/answer`, { json: { sourceType: 'street' } });
console.log('\nsample verdict:', fin.verdict?.title, '—', fin.verdict?.line);
const inv = await time('Investigator', () => call('/investigate', { json: { sessionId: run.sessionId } }));
console.log('steps:', (inv.steps ?? []).map((x) => x.tool ?? x.kind).join(' → '));
console.log('headline:', inv.caseFile?.headline);
console.log('next step:', inv.caseFile?.recommendedNextStep);
console.log('report:', inv.caseFile?.draftReport?.slice(0, 400), inv.error ?? '');

// Carton receiving as a pharmacist.
const ph = 'agents-live-pharm-1';
const shops = await call('/shops', { device: ph });
await call('/auth/pin', { device: ph, json: { pin: process.env.PHARMACIST_DEMO_PIN, shopId: shops.find((x) => x.name.startsWith('Yaba'))._id } });
const form = new FormData();
form.append('video', new Blob([await readFile('/tmp/truemed-pan.webm')], { type: 'video/webm' }), 'carton.webm');
form.append('source', 'open_market');
const c = await time('Carton', () => call('/scan/carton', { device: ph, form }));
console.log(JSON.stringify(c.summary), (c.packs ?? []).map((p) => `${p.serial}:${p.decision}:${p.failed?.[0]?.id ?? ''}`).join('  '), c.error ?? '');
if (c.annotatedImage) await (await import('node:fs/promises')).writeFile(process.env.SP + '/carton.jpg', Buffer.from(c.annotatedImage.split(',')[1], 'base64'));
