/**
 * The Sentinel: NAFDAC alerts → structured records → (human approval) → warnings.
 *
 * Ingest never saves an approved alert: it creates a `pending` record that an
 * admin reviews (D24). Approval finds every logged pack matching the alert's
 * batches and notifies the shops holding them.
 */
import { z } from 'zod';
import { sparkJson, sparkText, textPart } from '../../services/meta.js';
import { Alert, Pack, Shop, Notification } from '../../db/models/index.js';
import { normBatch, normRegNo } from '../../rules/util.js';

const INSTRUCTIONS = `You turn a NAFDAC (Nigeria) public alert into a structured record for a counterfeit-screening database.

Copy values exactly as written. Never invent a batch number, registration number, date or alert number: use null or an empty list when the text does not state it.
- alertNo: e.g. "07/2026" if stated.
- type: falsified (counterfeit), recall, unregistered, or revalidated (expired stock with altered dates).
- regNoOnFake: the NAFDAC number printed on the counterfeit/unregistered product, if stated.
- genuineRegNo: the genuine product's NAFDAC number, if stated.
- batches: each affected batch with its expiry as YYYY-MM when stated.
- telltaleSigns: short phrases describing how to spot it, as stated.
- issuedAt: YYYY-MM-DD if stated.`;

const schema = {
  type: 'object', additionalProperties: false,
  required: ['alertNo', 'title', 'productName', 'issuedAt', 'type', 'regNoOnFake', 'genuineRegNo', 'batches', 'telltaleSigns'],
  properties: {
    alertNo: { type: ['string', 'null'] },
    title: { type: 'string' },
    productName: { type: ['string', 'null'] },
    issuedAt: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['falsified', 'recall', 'unregistered', 'revalidated'] },
    regNoOnFake: { type: ['string', 'null'] },
    genuineRegNo: { type: ['string', 'null'] },
    batches: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['batchNo', 'expiry'], properties: { batchNo: { type: 'string' }, expiry: { type: ['string', 'null'] } } } },
    telltaleSigns: { type: 'array', items: { type: 'string' } },
  },
};
const zod = z.object({
  alertNo: z.string().nullable(), title: z.string(), productName: z.string().nullable(), issuedAt: z.string().nullable(),
  type: z.enum(['falsified', 'recall', 'unregistered', 'revalidated']), regNoOnFake: z.string().nullable(), genuineRegNo: z.string().nullable(),
  batches: z.array(z.object({ batchNo: z.string(), expiry: z.string().nullable() })), telltaleSigns: z.array(z.string()),
});

const stripHtml = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { 'user-agent': 'TrueMed-Sentinel/0.1 (+hackathon; single human-triggered fetch)' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return stripHtml(await res.text()).slice(0, 30_000);
}

/** Paste a URL or text → pending alert. */
export async function ingest({ url, text }) {
  let rawText = text?.trim();
  let via = 'pasted';
  if (!rawText && url) {
    try {
      rawText = await fetchText(url);
      via = 'fetched';
    } catch {
      // Fall back to Muse Spark's web search to read the page.
      const r = await sparkText({ label: 'sentinel-search', instructions: 'Find and quote the full text of the NAFDAC alert at the given URL. Quote it; do not summarise or add anything.', content: [textPart(url)], tools: [{ type: 'web_search' }], timeoutMs: 45_000 });
      rawText = r.text;
      via = 'web_search';
    }
  }
  if (!rawText) throw Object.assign(new Error('Give an alert URL or paste its text'), { status: 400 });

  const { data } = await sparkJson({ label: 'sentinel-parse', instructions: INSTRUCTIONS, content: [textPart(rawText)], schema, zod });
  const alert = await Alert.create({
    ...data,
    issuedAt: data.issuedAt && !Number.isNaN(Date.parse(data.issuedAt)) ? new Date(data.issuedAt) : null,
    sourceUrl: url || 'pasted-text',
    rawText: rawText.slice(0, 20_000),
    status: 'pending',
  });
  return { alert, via };
}

/** Find logged packs a (draft or approved) alert would hit. */
export async function matchPacks(alert) {
  const batches = (alert.batches ?? []).map((b) => normBatch(b.batchNo)).filter(Boolean);
  const or = [];
  if (batches.length) or.push({ batch: { $in: batches.map((b) => new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } });
  const fake = normRegNo(alert.regNoOnFake);
  if (fake && fake !== normRegNo(alert.genuineRegNo)) or.push({ regNo: fake });
  if (!or.length) return [];
  return Pack.find({ $or: or, status: 'in_stock' }).lean();
}

/** Approve → warn every shop holding a matching pack. */
export async function approve(alertId, edits = {}) {
  const alert = await Alert.findById(alertId);
  if (!alert) throw Object.assign(new Error('Alert not found'), { status: 404 });
  Object.assign(alert, edits, { status: 'approved', approvedAt: new Date() });
  const packs = await matchPacks(alert);
  const byShop = new Map();
  for (const p of packs) {
    const k = String(p.shopId);
    if (!byShop.has(k)) byShop.set(k, []);
    byShop.get(k).push(p.serial);
  }
  const shops = await Shop.find({ _id: { $in: [...byShop.keys()] } }).lean();
  await Notification.insertMany(shops.map((s) => ({
    shopId: s._id, type: 'recall',
    title: `NAFDAC alert: ${alert.productName ?? alert.title}`,
    message: `${byShop.get(String(s._id)).length} pack(s) on your shelf match ${alert.alertNo ? `Public Alert ${alert.alertNo}` : 'a NAFDAC alert'}. Quarantine them and do not sell.`,
    refs: { alertId: alert._id, serials: byShop.get(String(s._id)) },
  })));
  alert.notifiedShops = shops.length;
  await alert.save();
  return { alert, notified: shops.map((s) => ({ shopId: s._id, name: s.name, city: s.city, packs: byShop.get(String(s._id)).length })) };
}
