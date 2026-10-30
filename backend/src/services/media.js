/**
 * Image, audio and video helpers: quality gate, normalising, crops, evidence
 * overlays, and ffmpeg conversions for Voice Transcribe and SAM video.
 */
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { PassThrough } from 'node:stream';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeMaskToSVGPath } from '@meta-sam/parser';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const MAX_SIDE = 1600; // plenty for print legibility; fewer image tokens, faster reads

/** Upright, ≤2000px, JPEG. Returns buffer + size (SAM box tokens need the exact size). */
export async function normalizeImage(input) {
  const img = sharp(input, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const scale = Math.min(1, MAX_SIDE / Math.max(meta.width ?? MAX_SIDE, meta.height ?? MAX_SIDE));
  const out = await img.resize({ width: Math.round((meta.autoOrient?.width ?? meta.width) * scale) || undefined, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

/**
 * Fast local quality gate before spending on AI.
 * @returns {{ ok: boolean, issues: string[], metrics: object }}
 */
export async function qualityGate(buffer) {
  const g = sharp(buffer).greyscale();
  const meta = await g.metadata();
  const stats = await g.stats();
  const mean = stats.channels[0].mean;
  // Laplacian variance: low = blurry.
  const lap = await sharp(buffer).greyscale().resize({ width: 800, withoutEnlargement: true })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 }).stats();
  const sharpness = lap.channels[0].stdev ** 2;
  // Glare: share of near-white pixels.
  const { data } = await sharp(buffer).greyscale().resize({ width: 400, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  let bright = 0;
  for (const v of data) if (v > 250) bright++;
  const glare = bright / data.length;

  const issues = [];
  if ((meta.width ?? 0) < 480 || (meta.height ?? 0) < 480) issues.push('too_small');
  if (mean < 45) issues.push('too_dark');
  if (sharpness < 25) issues.push('blurry');
  // Glare only warns: white cartons are legitimately bright, and Muse Spark's own
  // read-confidence is the better judge of whether text is washed out.
  const hints = glare > 0.35 ? ['glare'] : [];
  return { ok: issues.length === 0, issues, hints, metrics: { mean: Math.round(mean), sharpness: Math.round(sharpness), glare: Number(glare.toFixed(3)), width: meta.width, height: meta.height } };
}

/** Crop a half-open box with padding; returns JPEG. */
export async function crop(buffer, box, { pad = 0.08, width, height } = {}) {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const left = Math.max(0, Math.floor(box.left - w * pad));
  const top = Math.max(0, Math.floor(box.top - h * pad));
  const right = Math.min(width, Math.ceil(box.right + w * pad));
  const bottom = Math.min(height, Math.ceil(box.bottom + h * pad));
  return sharp(buffer).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }).jpeg({ quality: 90 }).toBuffer();
}

/** Muse Spark 0–1000 box → pixel half-open box, clamped. */
export function normBoxToPixels(b, width, height) {
  const cx = (v, d) => Math.max(0, Math.min(d - 1, Math.round((v * d) / 1000)));
  const left = cx(Math.min(b.x1, b.x2), width);
  const top = cx(Math.min(b.y1, b.y2), height);
  const right = Math.max(left + 1, cx(Math.max(b.x1, b.x2), width) + 1);
  const bottom = Math.max(top + 1, cx(Math.max(b.y1, b.y2), height) + 1);
  return { left, top, right: Math.min(width, right), bottom: Math.min(height, bottom) };
}

/** SVG path for a SAM mask, in full-image coordinates (for the web overlay and PNG render). */
export function maskPath(maskRecord) {
  try {
    // The mask raster may be smaller than its box (SAM downsamples large masks),
    // so scale the path from raster pixels to the box it covers.
    const d = decodeMaskToSVGPath(maskRecord.mask);
    const { left, top, right, bottom } = maskRecord.bounds ?? { left: 0, top: 0, right: maskRecord.mask.width, bottom: maskRecord.mask.height };
    const sx = (right - left) / maskRecord.mask.width;
    const sy = (bottom - top) / maskRecord.mask.height;
    return { d, transform: `translate(${left} ${top}) scale(${sx.toFixed(5)} ${sy.toFixed(5)})` };
  } catch {
    return null;
  }
}

/**
 * Render evidence highlights onto the photo for sharing/case files.
 * @param {Buffer} buffer
 * @param {{ width:number, height:number, regions: { label:string, tone:'red'|'amber'|'green', box:{left,top,right,bottom}, path?:{d:string,transform:string} }[] }} o
 */
export async function renderOverlay(buffer, { width, height, regions }) {
  const colors = { red: '#E5484D', amber: '#F5A524', green: '#30A46C' };
  const stroke = Math.max(3, Math.round(width / 300));
  const font = Math.max(18, Math.round(width / 45));
  const shapes = regions.map((r) => {
    const c = colors[r.tone] ?? colors.red;
    const mask = r.path ? `<path d="${r.path.d}" transform="${r.path.transform}" fill="${c}" fill-opacity="0.28" stroke="${c}" stroke-width="${stroke}"/>` : '';
    const rect = `<rect x="${r.box.left}" y="${r.box.top}" width="${r.box.right - r.box.left}" height="${r.box.bottom - r.box.top}" rx="${stroke * 2}" fill="none" stroke="${c}" stroke-width="${stroke}"/>`;
    const ty = Math.max(font + 6, r.box.top - 8);
    const tw = Math.round(r.label.length * font * 0.58) + 16;
    const tag = `<rect x="${r.box.left}" y="${ty - font - 4}" width="${tw}" height="${font + 10}" rx="6" fill="${c}"/><text x="${r.box.left + 8}" y="${ty}" font-size="${font}" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#fff">${escapeXml(r.label)}</text>`;
    return mask + rect + tag;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
  return sharp(buffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

const escapeXml = (s) => String(s).replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));

/** Browser audio (webm/opus, mp4/aac, wav) → 24 kHz mono s16le PCM for Voice Transcribe. */
export function toPcm24k(input) {
  return new Promise((resolve, reject) => {
    const src = new PassThrough();
    src.end(input);
    const out = new PassThrough();
    const chunks = [];
    out.on('data', (c) => chunks.push(c));
    out.on('end', () => resolve(Buffer.concat(chunks)));
    ffmpeg(src).noVideo().audioChannels(1).audioFrequency(24_000).format('s16le').audioCodec('pcm_s16le')
      .on('error', reject).pipe(out, { end: true });
  });
}

/**
 * Any browser video → H.264 MP4 with faststart (SAM rejects WebM/VP9), ≤ 20 s,
 * plus a few keyframes as JPEGs for Muse Spark reading and annotated output.
 */
export async function prepareVideo(input, { maxSeconds = 20, fps = 10, keyframes = 4, width = 960 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'truemed-vid-'));
  try {
    const inPath = join(dir, 'in');
    const outPath = join(dir, 'out.mp4');
    await writeFile(inPath, input);
    await new Promise((resolve, reject) => {
      ffmpeg(inPath).outputOptions([
        '-t', String(maxSeconds), '-r', String(fps), '-vf', `scale=${width}:-2`, '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      ]).save(outPath).on('end', resolve).on('error', reject);
    });
    const info = await probe(outPath);
    const duration = Math.min(info.duration, maxSeconds);
    const frames = Math.round(duration * fps);
    const times = Array.from({ length: keyframes }, (_, i) => (duration * (i + 0.5)) / keyframes);
    const frameFiles = [];
    for (const [i, t] of times.entries()) {
      const p = join(dir, `k${i}.jpg`);
      await new Promise((resolve, reject) => {
        ffmpeg(outPath).seekInput(t).frames(1).outputOptions(['-q:v', '3']).save(p).on('end', resolve).on('error', reject);
      });
      frameFiles.push({ index: Math.round(t * fps), time: t, buffer: await readFile(p) });
    }
    return { mp4: await readFile(outPath), width: info.width, height: info.height, duration, fps, frames, keyframes: frameFiles };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function probe(path) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(err);
      const v = data.streams.find((s) => s.codec_type === 'video');
      resolve({ duration: Number(data.format.duration) || 0, width: v?.width, height: v?.height });
    });
  });
}

