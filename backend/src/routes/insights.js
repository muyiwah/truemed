/**
 * GET /api/insights — public, read-only totals for the Insights page.
 *
 * Totals only: no device ids, photos, serials or exact locations (rule 14).
 * Each section says where its numbers came from: `live` (the ledger),
 * `eval` (eval/results.json), or `sample` (placeholder until real data exists).
 */
import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScanEvent, ScanSession, Pack, Notification, CaseFile, Alert, Usage } from '../db/models/index.js';
import { config } from '../config.js';
import { asyncH } from './middleware.js';
import { SAMPLE_EVAL, SAMPLE_NETWORK, SAMPLE_TIMINGS } from '../insights/placeholder.js';

const r = Router();
const EVAL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../eval/results.json');
// Below this many real scans the network section shows sample data instead.
const MIN_LIVE_SCANS = 20;

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

async function evalSection() {
  try {
    const raw = JSON.parse(await readFile(EVAL_FILE, 'utf8'));
    return { source: 'eval', ...raw.summary, ranAt: raw.ranAt ?? null };
  } catch {
    return { source: 'sample', ...SAMPLE_EVAL };
  }
}

async function networkSection() {
  const total = await ScanEvent.countDocuments();
  if (total < MIN_LIVE_SCANS) return { source: 'sample', liveScans: total, ...SAMPLE_NETWORK };

  const [byType, byVerdict, byFailed, byCity, packsInLedger, shopsWarned, caseFiles, alertsApproved] = await Promise.all([
    ScanEvent.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]),
    ScanEvent.aggregate([{ $group: { _id: '$verdict.code', n: { $sum: 1 } } }]),
    ScanEvent.aggregate([{ $unwind: '$verdict.failed' }, { $group: { _id: '$verdict.failed', n: { $sum: 1 } } }]),
    ScanEvent.aggregate([
      { $match: { city: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$city', scans: { $sum: 1 }, flagged: { $sum: { $cond: [{ $in: ['$verdict.code', ['high_risk', 'caution']] }, 1, 0] } } } },
      { $sort: { scans: -1 } }, { $limit: 8 },
    ]),
    Pack.countDocuments(),
    Notification.distinct('shopId').then((x) => x.length),
    CaseFile.countDocuments({ status: 'done' }),
    Alert.countDocuments({ status: 'approved' }),
  ]);
  const toObj = (rows) => Object.fromEntries(rows.filter((x) => x._id).map((x) => [x._id, x.n]));
  const types = toObj(byType);
  return {
    source: 'live',
    scans: { total, home: types.home ?? 0, receiving: types.receiving ?? 0, carton: types.carton ?? 0 },
    verdicts: toObj(byVerdict),
    caught: toObj(byFailed),
    cities: byCity.map((c) => ({ city: c._id, scans: c.scans, flagged: c.flagged })),
    shopsWarned, caseFiles, packsInLedger, alertsApproved,
  };
}

async function metaSection() {
  const days = await Usage.find().sort({ day: -1 }).limit(14).lean();
  const byModel = {};
  for (const d of days) {
    for (const [k, v] of Object.entries(d.byModel ?? {})) {
      const name = k.replace(/_/g, '.');
      byModel[name] ??= { calls: 0, cost: 0 };
      byModel[name].calls += v.calls ?? 0;
      byModel[name].cost += v.cost ?? 0;
    }
  }
  // Real scans only (samples replay cached reads).
  const sessions = await ScanSession.find({ sampleId: null, 'timings.total': { $exists: true }, 'timings.extraction': { $exists: true }, 'timings.tamper': { $exists: true } }).select('timings').sort({ createdAt: -1 }).limit(200).lean();
  const steps = ['quality', 'extraction', 'samBarcode0', 'tamper', 'total'];
  const timings = sessions.length >= 5
    ? { source: 'live', n: sessions.length, ...Object.fromEntries(steps.map((s) => [s, median(sessions.map((x) => x.timings?.[s]))])) }
    : { source: 'sample', n: sessions.length, ...SAMPLE_TIMINGS };
  return {
    source: 'live',
    days: days.length,
    calls: days.reduce((a, d) => a + (d.calls ?? 0), 0),
    costUsd: Number(days.reduce((a, d) => a + (d.costUsd ?? 0), 0).toFixed(4)),
    byModel: Object.entries(byModel).map(([model, v]) => ({ model, calls: v.calls, costUsd: Number(v.cost.toFixed(4)) })).sort((a, b) => b.calls - a.calls),
    models: { spark: config.SPARK_MODEL, sam: config.SAM_MODEL, voice: config.VOICE_MODEL },
    timings,
  };
}

r.get('/insights', asyncH(async (_req, res) => {
  const [evaluation, network, meta] = await Promise.all([evalSection(), networkSection(), metaSection()]);
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ generatedAt: new Date().toISOString(), evaluation, network, meta });
}));

export default r;
