/**
 * Simulated NAFDAC registry API: a SANDBOX built by TrueMed, not NAFDAC.
 *
 * NAFDAC publishes no developer API (checked Oct 31 2026, see
 * docs/NAFDAC_INTEGRATION.md). This mock is the contract TrueMed integrates
 * against, so a real NAFDAC endpoint would be one adapter, not a rebuild.
 *
 * Scope: only the fictional DemoQuin brand (DEMO-* registration numbers and the
 * demo GTINs). Anything else gets `outside_sandbox`: the sandbox never says
 * anything about a real product (rules 8 and 10).
 */
import { Router } from 'express';
import { z } from 'zod';
import { Product, IssuedSerial, SandboxEvent } from '../db/models/index.js';
import { normRegNo, normBatch } from '../rules/util.js';
import { asyncH } from '../routes/middleware.js';

export const SANDBOX_NOTICE = 'Simulated NAFDAC sandbox built by TrueMed for the fictional DemoQuin brand. Not operated by or affiliated with NAFDAC.';
export const isSandboxRegNo = (regNo) => /^DEMO-/.test(normRegNo(regNo) ?? '');

const r = Router();
r.use((_req, res, next) => { res.set('X-Sandbox', 'simulated'); next(); });

const send = (res, code, body) => res.status(code).json({ sandbox: true, notice: SANDBOX_NOTICE, ...body });
const outside = (res, what) => send(res, 422, { status: 'outside_sandbox', error: `The sandbox only covers the fictional DemoQuin brand; it has no data on ${what}.` });
const productView = (p) => ({
  regNo: p.nafdacRegNo, brandName: p.brandName, genericName: p.genericName, strength: p.strength,
  dosageForm: p.dosageForm, manufacturer: p.manufacturer, category: p.category, gtins: p.gtins ?? [],
});
const demoProductByGtin = (gtin) => Product.findOne({ demo: true, gtins: gtin }).lean();
// Writes only from this server itself (no X-Forwarded-For through nginx); the public can read.
const isLocal = (req) => !req.get('x-forwarded-for') && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

r.get('/', (_req, res) => send(res, 200, {
  version: '0.1',
  endpoints: {
    'GET /registrations/:regNo': 'Registration status of a NAFDAC number',
    'GET /verify?gtin=&serial=&batch=&expiry=': 'Check a GS1 DataMatrix read: product, registration, serial status, last custody event',
    'GET /events?gtin=&serial=': 'Custody trail of one unit',
    'POST /events': 'Record a custody event (receive, dispense, return, destroy)',
  },
}));

r.get('/registrations/:regNo', asyncH(async (req, res) => {
  const regNo = normRegNo(req.params.regNo);
  if (!isSandboxRegNo(regNo)) return outside(res, `registration ${regNo}`);
  const p = await Product.findOne({ demo: true, nafdacRegNo: regNo }).lean();
  if (!p) return send(res, 404, { status: 'not_registered', regNo });
  send(res, 200, { status: 'registered', regNo, product: productView(p) });
}));

const unitQ = z.object({
  gtin: z.string().regex(/^\d{14}$/),
  serial: z.string().max(40).optional(),
  batch: z.string().max(40).optional(),
  expiry: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

r.get('/verify', asyncH(async (req, res) => {
  const q = unitQ.parse(req.query);
  const p = await demoProductByGtin(q.gtin);
  if (!p) return outside(res, `GTIN ${q.gtin}`);
  const issued = q.serial ? await IssuedSerial.findOne({ gtin: q.gtin, serial: q.serial }).lean() : null;
  const status = !q.serial ? 'not_provided' : !issued ? 'not_issued' : !issued.dispatchedAt ? 'not_dispatched' : 'dispatched';
  const mismatches = [];
  if (issued && q.batch && normBatch(q.batch) !== normBatch(issued.batch)) mismatches.push('batch');
  if (issued && q.expiry && q.expiry !== issued.expiry) mismatches.push('expiry');
  const lastEvent = q.serial ? await SandboxEvent.findOne({ gtin: q.gtin, serial: q.serial }).sort({ eventTime: -1 }).select('-_id -__v').lean() : null;
  send(res, 200, {
    status: 'ok',
    product: productView(p),
    registration: 'registered',
    unit: { serial: q.serial ?? null, status, batch: issued?.batch ?? null, expiry: issued?.expiry ?? null, mismatches },
    lastEvent,
  });
}));

r.get('/events', asyncH(async (req, res) => {
  const q = unitQ.required({ serial: true }).parse(req.query);
  if (!(await demoProductByGtin(q.gtin))) return outside(res, `GTIN ${q.gtin}`);
  const events = await SandboxEvent.find({ gtin: q.gtin, serial: q.serial }).sort({ eventTime: 1 }).limit(50).select('-_id -__v').lean();
  send(res, 200, { status: 'ok', gtin: q.gtin, serial: q.serial, events });
}));

const eventBody = z.object({
  eventType: z.enum(['receive', 'dispense', 'return', 'destroy']),
  gtin: z.string().regex(/^\d{14}$/),
  serial: z.string().min(1).max(40),
  batch: z.string().max(40).nullish(),
  expiry: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
  actor: z.object({ name: z.string().max(120), licenceNo: z.string().max(60).nullish(), city: z.string().max(60).nullish() }),
  source: z.enum(['authorized', 'open_market']).nullish(),
  eventTime: z.coerce.date().optional(),
});

r.post('/events', asyncH(async (req, res) => {
  if (!isLocal(req)) return send(res, 403, { status: 'read_only', error: 'The public sandbox is read-only.' });
  const e = eventBody.parse(req.body);
  if (!(await demoProductByGtin(e.gtin))) return outside(res, `GTIN ${e.gtin}`);
  const doc = await SandboxEvent.create(e);
  send(res, 201, { status: 'recorded', eventId: String(doc._id) });
}));

export default r;
