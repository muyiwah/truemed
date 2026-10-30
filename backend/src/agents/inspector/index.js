/**
 * The Inspector: one or two pack photos → everything the rule engine needs.
 *
 *   quality gate (local) ─┬─ Muse Spark extraction ──┬─ SAM box prompt on date block
 *                         │                          ├─ Muse Spark tamper check on date crop
 *                         │                          └─ Muse Spark artwork vs reference
 *                         ├─ SAM "barcode" per photo ─→ crops → zxing retry
 *                         ├─ SAM "label" on photo 0
 *                         └─ zxing on full photos
 *
 * Independent steps run in parallel. Every AI step degrades to "skipped"
 * rather than failing the scan: a missing tamper check costs one check, not the
 * whole result.
 */
import { sparkJson, samImage, imagePart, textPart, toDataUrl } from '../../services/meta.js';
import { normalizeImage, qualityGate, crop, normBoxToPixels, maskPath } from '../../services/media.js';
import { readPackBarcode } from '../../services/barcode.js';
import { EXTRACTION, TAMPER, ARTWORK } from './prompts.js';
import { extractionSchema, extractionZod, tamperSchema, tamperZod, artworkSchema, artworkZod } from './schemas.js';
import { log } from '../../lib/log.js';

const settle = async (label, p) => {
  try { return await p; } catch (err) { log.warn({ step: label, err: err?.message }, 'inspector step failed'); return null; }
};

const toRegion = (rec, mask, image, extra = {}) => ({
  image,
  box: { left: rec.bounds.left, top: rec.bounds.top, right: rec.bounds.right, bottom: rec.bounds.bottom },
  confidence: rec.confidence ?? null,
  path: mask ? maskPath(mask) : null,
  ...extra,
});

/** Pair SAM box and mask records by objectId. */
function samRegions(sam, image, extra) {
  if (!sam) return [];
  return sam.boxes.map((b) => toRegion(b, sam.masks.find((m) => m.objectId === b.objectId), image, extra));
}

/**
 * @param {Buffer[]} rawImages 1–2 photos
 * @param {{ lookupProduct?: (extracted) => Promise<object|null>, onStep?: (step:string, data?:object) => void }} opts
 */
export async function inspect(rawImages, { lookupProduct, onStep = () => {} } = {}) {
  const t0 = Date.now();
  const timings = {};
  const mark = (k) => { timings[k] = Date.now() - t0; };

  const images = await Promise.all(rawImages.slice(0, 2).map(normalizeImage));
  const quality = await Promise.all(images.map((i) => qualityGate(i.buffer)));
  mark('quality');
  if (quality.every((q) => !q.ok)) {
    return { retake: { issues: [...new Set(quality.flatMap((q) => q.issues))] }, quality, images, timings };
  }
  onStep('quality', { ok: true });

  const dataUrls = images.map((i) => toDataUrl(i.buffer));

  // Wave 1 — all independent.
  onStep('reading');
  const extractionP = settle('extraction', sparkJson({
    label: 'extraction',
    instructions: EXTRACTION,
    content: [textPart(`Read ${images.length === 2 ? 'these two photos (front and back) of one pack' : 'this pack photo'}.`), ...dataUrls.map(imagePart)],
    schema: extractionSchema,
    zod: extractionZod,
  }).then((r) => { mark('extraction'); onStep('read', { fields: r.data }); return r; }));

  const barcodeSamP = Promise.all(images.map((img, i) => settle('sam-barcode', samImage({ image: dataUrls[i], width: img.width, height: img.height, phrase: 'barcode' }))
    .then((r) => { mark(`samBarcode${i}`); return r; })));
  const labelSamP = settle('sam-label', samImage({ image: dataUrls[0], width: images[0].width, height: images[0].height, phrase: 'label' }));
  const zxingFullP = Promise.all(images.map((img) => settle('zxing', readPackBarcode(img.buffer))));

  const [extraction, barcodeSams, labelSam, zxingFull] = await Promise.all([extractionP, barcodeSamP, labelSamP, zxingFullP]);
  onStep('regions');

  const extracted = extraction?.data ?? null;
  const regions = { barcode: [], label: [], date: null };
  barcodeSams.forEach((s, i) => regions.barcode.push(...samRegions(s, i)));
  regions.label = samRegions(labelSam, 0).slice(0, 1);

  // Barcode: full image first, then SAM crops.
  let barcode = zxingFull.find((b) => b?.found && b.isGs1) ?? zxingFull.find((b) => b?.found) ?? null;
  if (!barcode?.isGs1 && regions.barcode.length) {
    for (const r of regions.barcode) {
      const img = images[r.image];
      const c = await settle('crop', crop(img.buffer, r.box, { width: img.width, height: img.height, pad: 0.15 }));
      const b = c && (await settle('zxing-crop', readPackBarcode(c)));
      if (b?.found && (b.isGs1 || !barcode)) { barcode = b; if (b.isGs1) break; }
    }
  }
  barcode ??= { found: false };
  mark('barcode');

  // Wave 2 — needs extraction.
  const product = extracted && lookupProduct ? await settle('lookup', lookupProduct(extracted, barcode)) : null;
  const dateBox = extracted?.dateRegionBox && images[extracted.dateRegionBox.image] ? extracted.dateRegionBox : null;

  const dateP = dateBox ? (async () => {
    const img = images[dateBox.image];
    const px = normBoxToPixels(dateBox, img.width, img.height);
    const [sam, cropBuf] = await Promise.all([
      settle('sam-date', samImage({ image: dataUrls[dateBox.image], width: img.width, height: img.height, boxes: [{ id: 1, box: px }] })),
      crop(img.buffer, px, { width: img.width, height: img.height, pad: 0.25 }),
    ]);
    const mask = sam?.masks?.[0];
    const samBox = sam?.boxes?.[0];
    regions.date = samBox ? toRegion(samBox, mask, dateBox.image) : { image: dateBox.image, box: px, confidence: null, path: null };
    mark('samDate');
    onStep('tamper');
    const tamper = await settle('tamper', sparkJson({
      label: 'tamper',
      instructions: TAMPER,
      content: [textPart('Crop of the batch/expiry area:'), imagePart(toDataUrl(cropBuf)), textPart('Full pack for context:'), imagePart(dataUrls[dateBox.image])],
      schema: tamperSchema,
      zod: tamperZod,
    }));
    mark('tamper');
    return tamper?.data ?? null;
  })() : Promise.resolve(null);

  const refs = product?.referenceUrls ?? [];
  const artworkP = refs.length ? (async () => {
    onStep('artwork');
    const r = await settle('artwork', sparkJson({
      label: 'artwork',
      instructions: ARTWORK,
      content: [textPart('Genuine reference:'), ...refs.slice(0, 3).map(imagePart), textPart('Pack being checked:'), imagePart(dataUrls[0])],
      schema: artworkSchema,
      zod: artworkZod,
    }));
    mark('artwork');
    return r?.data ?? null;
  })() : Promise.resolve(null);

  const [tamper, artwork] = await Promise.all([dateP, artworkP]);

  const visual = {
    tamper,
    artwork: artwork && artwork.samePackDesign ? artwork : null,
    lookalike: extracted ? { ...extracted.lookalike, readName: extracted.brandName } : null,
  };

  const cost = [extraction, ...barcodeSams, labelSam].reduce((s, r) => s + (r?.cost ?? 0), 0);
  mark('total');
  return { retake: null, quality, images, extracted, barcode, regions, visual, product, timings, cost, aiAvailable: Boolean(extraction) };
}
