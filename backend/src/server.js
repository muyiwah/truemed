import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config, allowedOrigins } from './config.js';
import { connectDb } from './db/connect.js';
import { log } from './lib/log.js';
import { device } from './routes/middleware.js';
import scanRoutes from './routes/scan.js';
import miscRoutes from './routes/misc.js';
import adminRoutes from './routes/admin.js';
import insightsRoutes from './routes/insights.js';
import nafdacSandbox from './sandbox/nafdac.js';
import { SANDBOX_PATH } from './registry/index.js';

const app = express();
app.set('trust proxy', 1); // behind nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)),
  allowedHeaders: ['Content-Type', 'X-Device-Id', 'X-Admin-Pin'],
}));
app.use(express.json({ limit: '200kb' }));
app.use(pinoHttp({ logger: log, autoLogging: { ignore: (req) => req.url === '/api/health' }, serializers: { req: (r) => ({ method: r.method, url: r.url }) } }));

const keyGen = (req) => req.get('x-device-id') || req.ip;
app.use('/api/scan', rateLimit({ windowMs: 60_000, limit: 20, keyGenerator: keyGen, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many scans. Wait a minute and try again.' } }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: keyGen, standardHeaders: true, legacyHeaders: false }));

app.use('/api', device);
app.use('/api', miscRoutes);
app.use('/api', scanRoutes);
app.use('/api', adminRoutes);
app.use('/api', insightsRoutes);

// Simulated NAFDAC registry for DemoQuin (public, read-only from outside).
if (config.NAFDAC_SANDBOX === 'on') {
  app.use(SANDBOX_PATH, rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, skip: (req) => !req.get('x-forwarded-for') && req.socket.remoteAddress?.endsWith('127.0.0.1') }), nafdacSandbox);
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', issues: err.issues?.slice(0, 5) });
  if (err?.name === 'MulterError') return res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'Upload problem.' });
  if (err?.name === 'CastError') return res.status(404).json({ error: 'Not found' });
  log.error({ err: err.message, stack: err.stack, url: req.url }, 'unhandled');
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});

await connectDb();
app.listen(config.PORT, () => log.info(`TrueMed API on :${config.PORT}`));
