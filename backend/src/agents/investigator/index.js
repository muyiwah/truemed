/**
 * The Investigator: Muse Spark with read-only ledger tools builds a case file.
 *
 * Loop (≤ 8 steps): the model calls tools; we run them and feed results back
 * with `previous_response_id`. Every call is stored in `caseFile.steps` and
 * streamed to the UI as the visible reasoning trail. A final structured call
 * writes the case file and a draft report the user reviews and sends (rule 7).
 */
import { z } from 'zod';
import { sparkRaw, sparkJson, textPart } from '../../services/meta.js';
import { CaseFile, Pack, Shop, ScanEvent, Alert, Product } from '../../db/models/index.js';
import { reconcileShop } from '../../services/ledger.js';
import { normBatch, normRegNo } from '../../rules/util.js';

const MAX_STEPS = 8;

const tools = [
  { type: 'function', name: 'getPackHistory', description: 'The ledger record for one unit serial and every scan of it (receiving and home), oldest first.', parameters: { type: 'object', additionalProperties: false, required: ['serial'], properties: { serial: { type: 'string' } } } },
  { type: 'function', name: 'getShop', description: 'A shop in the network: name, type (pharmacy / licensed chemist), area, city.', parameters: { type: 'object', additionalProperties: false, required: ['shopId'], properties: { shopId: { type: 'string' } } } },
  { type: 'function', name: 'getShopReconciliation', description: 'Received vs sold counts for a shop and serials verified by more than one buyer device.', parameters: { type: 'object', additionalProperties: false, required: ['shopId'], properties: { shopId: { type: 'string' } } } },
  { type: 'function', name: 'findAlerts', description: 'Approved NAFDAC alerts matching a batch number and/or registration number.', parameters: { type: 'object', additionalProperties: false, required: ['batch', 'regNo'], properties: { batch: { type: ['string', 'null'] }, regNo: { type: ['string', 'null'] } } } },
  { type: 'function', name: 'getScansForBatch', description: 'All scans of a batch number across shops and homes (count, shops, cities, verdicts).', parameters: { type: 'object', additionalProperties: false, required: ['batch'], properties: { batch: { type: 'string' } } } },
  { type: 'function', name: 'getProduct', description: 'Registry record for a NAFDAC registration number.', parameters: { type: 'object', additionalProperties: false, required: ['regNo'], properties: { regNo: { type: 'string' } } } },
];

const brief = (scan) => ({ type: scan.type, at: scan.createdAt, shopId: scan.shopId ? String(scan.shopId) : null, city: scan.city ?? null, verdict: scan.verdict?.code, failed: scan.verdict?.failed ?? [], answer: scan.answerShop?.sourceType ?? null });

const impl = {
  async getPackHistory({ serial }) {
    const pack = await Pack.findOne({ serial }).lean();
    const scans = await ScanEvent.find({ serial }).sort({ createdAt: 1 }).limit(30).lean();
    return { pack: pack && { serial: pack.serial, batch: pack.batch, expiry: pack.expiry, shopId: String(pack.shopId), source: pack.source, supplierName: pack.supplierName, status: pack.status, receivedAt: pack.receivedAt, soldAt: pack.soldAt }, scans: scans.map(brief) };
  },
  async getShop({ shopId }) {
    const s = await Shop.findById(shopId).lean().catch(() => null);
    return s ? { id: String(s._id), name: s.name, type: s.type, area: s.area, city: s.city, verified: s.verified } : { error: 'not found' };
  },
  async getShopReconciliation({ shopId }) { return reconcileShop(shopId); },
  async findAlerts({ batch, regNo }) {
    const or = [];
    if (batch) or.push({ 'batches.batchNo': new RegExp(`^${normBatch(batch)}$`, 'i') });
    if (regNo) or.push({ regNoOnFake: normRegNo(regNo) }, { genuineRegNo: normRegNo(regNo) });
    if (!or.length) return [];
    const a = await Alert.find({ status: 'approved', $or: or }).lean();
    return a.map((x) => ({ id: String(x._id), alertNo: x.alertNo, title: x.title, type: x.type, batches: x.batches, sourceUrl: x.sourceUrl }));
  },
  async getScansForBatch({ batch }) {
    const scans = await ScanEvent.find({ batch: new RegExp(`^${normBatch(batch)}$`, 'i') }).sort({ createdAt: 1 }).limit(50).lean();
    return { count: scans.length, scans: scans.map(brief) };
  },
  async getProduct({ regNo }) {
    const p = await Product.findOne({ nafdacRegNo: normRegNo(regNo) }).lean();
    return p ? { brandName: p.brandName, genericName: p.genericName, strength: p.strength, manufacturer: p.manufacturer, normalShelfLifeMonths: p.normalShelfLifeMonths, sourceUrl: p.sourceUrl } : { found: false };
  },
};

const INSTRUCTIONS = `You are TrueMed's Investigator, working for pharmacists and regulators in Nigeria. A medicine pack was flagged. Use the tools to establish the facts: the pack's history, the shops involved, matching NAFDAC alerts, other scans of the batch, and shop reconciliation. Call tools step by step, starting with the most informative. Stop when you have enough (at most ${MAX_STEPS} tool calls). Never speculate beyond what the tools return; if something is unknown, say so. Use the names of shops as the tools return them.`;

const caseSchema = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'whatHappened', 'evidence', 'timeline', 'shopsInvolved', 'matchingAlerts', 'recommendedNextStep', 'draftReport'],
  properties: {
    headline: { type: 'string' },
    whatHappened: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    timeline: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['when', 'event'], properties: { when: { type: 'string' }, event: { type: 'string' } } } },
    shopsInvolved: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'role'], properties: { name: { type: 'string' }, role: { type: 'string' } } } },
    matchingAlerts: { type: 'array', items: { type: 'string' } },
    recommendedNextStep: { type: 'string' },
    draftReport: { type: 'string' },
  },
};
const caseZod = z.object({
  headline: z.string(), whatHappened: z.string(), evidence: z.array(z.string()),
  timeline: z.array(z.object({ when: z.string(), event: z.string() })),
  shopsInvolved: z.array(z.object({ name: z.string(), role: z.string() })),
  matchingAlerts: z.array(z.string()), recommendedNextStep: z.string(), draftReport: z.string(),
});

/**
 * @param {{ trigger: object }} input  e.g. { sessionId, serial, batch, regNo, verdict, failed }
 * @param {(step: object) => void} onStep
 */
export async function investigate({ trigger }, onStep = () => {}) {
  const cf = await CaseFile.create({ trigger, serials: trigger.serial ? [trigger.serial] : [], status: 'running', steps: [] });
  const push = async (step) => {
    cf.steps.push({ ...step, at: new Date() });
    cf.markModified('steps');
    await cf.save();
    onStep(step);
  };

  try {
    const opening = `Flagged pack:\n${JSON.stringify(trigger, null, 2)}\n\nInvestigate.`;
    let { res } = await sparkRaw('investigator', { instructions: INSTRUCTIONS, input: [{ type: 'message', role: 'user', content: [textPart(opening)] }], tools });
    const gathered = [];
    let steps = 0;

    while (steps < MAX_STEPS) {
      const calls = (res.output ?? []).filter((o) => o.type === 'function_call');
      if (!calls.length) break;
      const outputs = [];
      for (const call of calls) {
        if (steps >= MAX_STEPS) break;
        steps++;
        let args = {};
        try { args = JSON.parse(call.arguments || '{}'); } catch { /* validated below */ }
        const fn = impl[call.name];
        const output = fn ? await fn(args).catch((e) => ({ error: e.message })) : { error: 'unknown tool' };
        gathered.push({ tool: call.name, args, output });
        await push({ kind: 'tool', tool: call.name, args, summary: summarize(call.name, output) });
        outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output).slice(0, 12_000) });
      }
      ({ res } = await sparkRaw('investigator', { previous_response_id: res.id, input: outputs, tools }));
    }
    if (res.output_text) await push({ kind: 'thought', text: res.output_text.slice(0, 1200) });

    await push({ kind: 'writing', text: 'Writing the case file' });
    const { data } = await sparkJson({
      label: 'case-file',
      instructions: `Write a case file from the investigation facts. Use only these facts. draftReport: a short, formal report to NAFDAC Pharmacovigilance / the Pharmacists Council of Nigeria that the user will review and send themselves; include product, batch, serial, where found, what failed, and dates. No speculation; mark unknowns as unknown. Do not include personal data about buyers.`,
      content: [textPart(JSON.stringify({ trigger, findings: gathered, investigatorNotes: res.output_text ?? null }).slice(0, 60_000))],
      schema: caseSchema,
      zod: caseZod,
      timeoutMs: 60_000,
    });
    cf.caseFile = data;
    cf.summary = data.headline;
    cf.draftReport = data.draftReport;
    cf.status = 'done';
    await cf.save();
    onStep({ kind: 'done', caseId: String(cf._id) });
    return cf.toObject();
  } catch (err) {
    cf.status = 'failed';
    await cf.save();
    onStep({ kind: 'error', message: 'The investigation could not finish. Try again.' });
    throw err;
  }
}

function summarize(tool, out) {
  switch (tool) {
    case 'getPackHistory': return out.pack ? `Serial logged, ${out.scans.length} scan(s) on record` : `No ledger record; ${out.scans.length} scan(s)`;
    case 'getShop': return out.name ? `${out.name}, ${out.city ?? ''}` : 'Shop not found';
    case 'getShopReconciliation': return `${out.received} received, ${out.sold} sold, ${out.serialsVerifiedByManyDevices?.length ?? 0} serial(s) checked by several phones`;
    case 'findAlerts': return out.length ? `${out.length} matching NAFDAC alert(s)` : 'No matching alerts';
    case 'getScansForBatch': return `${out.count} scan(s) of this batch`;
    case 'getProduct': return out.brandName ? `${out.brandName} ${out.strength ?? ''}` : 'Not in registry';
    default: return '';
  }
}
