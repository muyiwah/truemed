import multer from 'multer';
import { Device } from '../db/models/index.js';
import { config } from '../config.js';

/** Anonymous device identity from the X-Device-Id header (a random UUID the browser keeps). */
export async function device(req, _res, next) {
  const id = String(req.get('x-device-id') || '').slice(0, 64);
  req.deviceId = /^[a-zA-Z0-9-]{8,64}$/.test(id) ? id : null;
  req.role = 'public';
  req.shopId = null;
  if (req.deviceId) {
    const d = await Device.findOne({ deviceId: req.deviceId }).lean();
    if (d) { req.role = d.role; req.shopId = d.shopId ? String(d.shopId) : null; req.language = d.language; }
  }
  next();
}

export const requireVerified = (req, res, next) =>
  ['pharmacist', 'chemist', 'admin'].includes(req.role) && req.shopId ? next() : res.status(403).json({ error: 'Sign in as a pharmacy or licensed chemist to receive stock.' });

export const requireAdmin = (req, res, next) =>
  req.get('x-admin-pin') && req.get('x-admin-pin') === config.ADMIN_PIN ? next() : res.status(403).json({ error: 'Admin PIN required' });

const mem = multer.memoryStorage();
export const imagesUpload = multer({ storage: mem, limits: { fileSize: 8 * 1024 * 1024, files: 2 }, fileFilter: (_r, f, cb) => cb(null, /^image\//.test(f.mimetype)) }).array('images', 2);
export const videoUpload = multer({ storage: mem, limits: { fileSize: 30 * 1024 * 1024, files: 1 } }).single('video');
export const audioUpload = multer({ storage: mem, limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single('audio');

/** Server-sent events when the client asks for them (`?stream=1`); plain JSON otherwise. */
export function progress(req, res) {
  const streaming = req.query.stream === '1';
  if (streaming) {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
  }
  return {
    step: (data) => { if (streaming) res.write(`event: step\ndata: ${JSON.stringify(data)}\n\n`); },
    done: (data) => (streaming ? (res.write(`event: done\ndata: ${JSON.stringify(data)}\n\n`), res.end()) : res.json(data)),
    fail: (status, message) => (streaming ? (res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`), res.end()) : res.status(status).json({ error: message })),
  };
}

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
