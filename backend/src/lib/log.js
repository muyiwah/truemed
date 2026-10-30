import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Never log request bodies, images, transcripts or keys (rule 14).
  redact: ['req.headers.authorization', 'req.headers["x-device-id"]', '*.apiKey', '*.accessToken'],
  ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
});
