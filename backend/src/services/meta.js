/**
 * The one door to Meta's Model API.
 *
 * Every call goes through `guarded()`: daily cap check, timeout, one retry
 * (the OpenAI SDK's own `maxRetries: 1`, which retries 408/429/5xx and dropped
 * connections), and a cost entry in `usages`. Shapes follow docs/API_NOTES.md.
 */
import OpenAI from 'openai';
import { parseImageStream, parseVideoStream, buildObjectPrompt, recordsOfKind } from '@meta-sam/parser';
import { config, metaEnabled } from '../config.js';
import { Usage } from '../db/models/index.js';
import { log } from '../lib/log.js';

export class MetaUnavailableError extends Error {
  constructor(message = 'Meta AI is not configured') { super(message); this.code = 'META_UNAVAILABLE'; this.status = 503; }
}
export class CapReachedError extends Error {
  constructor() { super('Daily AI budget reached'); this.code = 'DAILY_CAP'; this.status = 429; }
}

let client = null;
export function meta() {
  if (!metaEnabled) throw new MetaUnavailableError();
  // The SDK does not read MODEL_API_KEY on its own: pass it explicitly.
  client ??= new OpenAI({ apiKey: config.MODEL_API_KEY, baseURL: config.META_BASE_URL, maxRetries: 1, timeout: 45_000 });
  return client;
}

// Prices per docs/API_NOTES.md.
const PRICE = {
  spark: { in: 1.25 / 1e6, cachedIn: 0.15 / 1e6, out: 4.25 / 1e6 },
  samImage: 2.5 / 1000,
  samFrame: 0.2 / 1000,
  webSearch: 2.5 / 1000,
  voicePerSecond: 0.18 / 3600,
};

const today = () => new Date().toISOString().slice(0, 10);
let capCache = { at: 0, calls: 0, cost: 0 };

async function checkCap() {
  if (Date.now() - capCache.at > 10_000) {
    const u = await Usage.findOne({ day: today() }).lean();
    capCache = { at: Date.now(), calls: u?.calls ?? 0, cost: u?.costUsd ?? 0 };
  }
  if (capCache.calls >= config.DAILY_CALL_CAP || capCache.cost >= config.DAILY_SPEND_CAP_USD) throw new CapReachedError();
}

export async function recordUsage(model, costUsd) {
  capCache.calls += 1;
  capCache.cost += costUsd;
  await Usage.updateOne(
    { day: today() },
    { $inc: { calls: 1, costUsd, [`byModel.${model.replace(/\./g, '_')}.calls`]: 1, [`byModel.${model.replace(/\./g, '_')}.cost`]: costUsd } },
    { upsert: true },
  ).catch((err) => log.warn({ err: err.message }, 'usage write failed'));
}

async function guarded(label, fn) {
  await checkCap();
  const t0 = Date.now();
  try {
    const out = await fn();
    log.info({ call: label, ms: Date.now() - t0, cost: out?.cost }, 'meta call');
    return out;
  } catch (err) {
    log.warn({ call: label, ms: Date.now() - t0, status: err?.status, msg: err?.message }, 'meta call failed');
    throw err;
  }
}

const sparkCost = (usage) => {
  if (!usage) return 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  return (usage.input_tokens - cached) * PRICE.spark.in + cached * PRICE.spark.cachedIn + (usage.output_tokens ?? 0) * PRICE.spark.out;
};

/** An image part for the Responses API. */
export const imagePart = (dataUrlOrHttps) => ({ type: 'input_image', image_url: dataUrlOrHttps });
export const textPart = (text) => ({ type: 'input_text', text });
export const toDataUrl = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;

/**
 * Muse Spark → JSON matching `schema` (strict JSON Schema), validated with zod.
 * One extra attempt if the output parses but fails validation.
 *
 * @param {{ label: string, instructions: string, content: object[], schema: object, zod: import('zod').ZodTypeAny, timeoutMs?: number }} p
 */
export async function sparkJson({ label, instructions, content, schema, zod, timeoutMs = 40_000 }) {
  return guarded(label, async () => {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await meta().responses.create({
        model: config.SPARK_MODEL,
        instructions,
        input: [{ type: 'message', role: 'user', content }],
        text: { format: { type: 'json_schema', name: label.replace(/[^a-zA-Z0-9_-]/g, '_'), schema, strict: true } },
      }, { timeout: timeoutMs });
      const cost = sparkCost(res.usage);
      await recordUsage(config.SPARK_MODEL, cost);
      try {
        const data = zod.parse(JSON.parse(res.output_text));
        return { data, cost, usage: res.usage };
      } catch (err) {
        lastErr = err;
      }
    }
    const e = new Error(`Muse Spark returned invalid ${label} output`);
    e.cause = lastErr;
    throw e;
  });
}

/** Muse Spark plain text (explanations). */
export async function sparkText({ label, instructions, content, timeoutMs = 30_000, tools }) {
  return guarded(label, async () => {
    const res = await meta().responses.create({
      model: config.SPARK_MODEL,
      instructions,
      input: [{ type: 'message', role: 'user', content }],
      ...(tools ? { tools } : {}),
    }, { timeout: timeoutMs });
    const searches = (res.output ?? []).filter((o) => o.type === 'web_search_call').length;
    const cost = sparkCost(res.usage) + searches * PRICE.webSearch;
    await recordUsage(config.SPARK_MODEL, cost);
    return { text: res.output_text, cost, output: res.output };
  });
}

/** One raw Responses call (agent loops manage their own turns). */
export async function sparkRaw(label, body, timeoutMs = 60_000) {
  return guarded(label, async () => {
    const res = await meta().responses.create({ model: config.SPARK_MODEL, ...body }, { timeout: timeoutMs });
    const cost = sparkCost(res.usage);
    await recordUsage(config.SPARK_MODEL, cost);
    return { res, cost };
  });
}

/**
 * SAM 3.1 on one image. Either `phrase` (short noun) or `boxes` ([{id, box:{left,top,right,bottom}}]), never both.
 * Returns parsed box+mask records; zero matches is a valid empty list.
 */
export async function samImage({ image, width, height, phrase, boxes, label = 'sam-image' }) {
  if (Boolean(phrase) === Boolean(boxes)) throw new Error('samImage needs exactly one of phrase or boxes');
  const text = phrase ?? buildObjectPrompt({ size: { width, height }, objects: boxes.map((b) => ({ id: b.id, prompts: [{ box: b.box }] })) });
  return guarded(`${label}:${phrase ?? 'boxes'}`, async () => {
    const stream = await meta().responses.create({
      model: config.SAM_MODEL,
      input: [{ type: 'message', role: 'user', content: [textPart(text), imagePart(image)] }],
      stream: true,
      metadata: { include_confidence: 'true' },
    }, { timeout: 30_000 });
    const result = await parseImageStream(stream).finalResult;
    await recordUsage(config.SAM_MODEL, PRICE.samImage);
    return {
      boxes: recordsOfKind(result.records, 'box'),
      masks: recordsOfKind(result.records, 'mask'),
      outcome: result.outcome,
      diagnostics: result.diagnostics,
      cost: PRICE.samImage,
    };
  });
}

/** SAM 3.1 video tracking with a noun phrase. `video` is an https URL or data URL of an H.264 MP4. */
export async function samVideo({ video, fileId, phrase, frames = 50, label = 'sam-video' }) {
  return guarded(`${label}:${phrase}`, async () => {
    const videoPart = fileId ? { type: 'input_video', file_id: fileId } : { type: 'input_video', video_url: video };
    const stream = await meta().responses.create({
      model: config.SAM_MODEL,
      input: [{ type: 'message', role: 'user', content: [textPart(phrase), videoPart] }],
      stream: true,
      metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
    }, { timeout: 120_000 });
    const result = await parseVideoStream(stream).finalResult;
    const cost = Math.max(50, frames) * PRICE.samFrame;
    await recordUsage(config.SAM_MODEL, cost);
    return { boxes: recordsOfKind(result.records, 'box'), masks: recordsOfKind(result.records, 'mask'), outcome: result.outcome, cost };
  });
}

export { PRICE, checkCap, guarded };
