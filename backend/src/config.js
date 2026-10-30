import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment, validated once at start-up. Missing AI/media keys don't stop the
 * server: the matching features report "unavailable" on /api/health and the UI
 * explains, rather than the whole API refusing to boot.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4080),
  MONGODB_URI: z.string().min(1),
  MODEL_API_KEY: z.string().optional(),
  META_BASE_URL: z.string().default('https://api.meta.ai/v1'),
  SPARK_MODEL: z.string().default('muse-spark-1.3'),
  SAM_MODEL: z.string().default('sam-3.1'),
  VOICE_MODEL: z.string().default('muse-voice-transcribe-1.0'),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_PUBLIC_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().optional(),
  IMAGEKIT_FOLDER: z.string().default('/truemed'),
  DAILY_CALL_CAP: z.coerce.number().default(3000),
  DAILY_SPEND_CAP_USD: z.coerce.number().default(15),
  ADMIN_PIN: z.string().default('change-me-admin'),
  PHARMACIST_DEMO_PIN: z.string().default('2468'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  GREENBOOK_LOOKUP: z.enum(['on', 'off']).default('off'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
export const metaEnabled = Boolean(config.MODEL_API_KEY);
export const imagekitEnabled = Boolean(config.IMAGEKIT_PRIVATE_KEY && config.IMAGEKIT_PUBLIC_KEY && config.IMAGEKIT_URL_ENDPOINT);
export const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
