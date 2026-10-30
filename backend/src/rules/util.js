/**
 * Shared helpers for checks.
 *
 * A check reads values from `ctx.fields`, where every value carries where it
 * came from: `barcode` (machine-read, a hard fact), `text` (read from the print
 * by Muse Spark), or `user` (typed or confirmed by the person). Rule 2 of
 * CLAUDE.md depends on that source: a hard fail built on `text` that the user
 * has not confirmed must not become High risk.
 */

/** @typedef {'pass'|'fail'|'skipped'} Status */
/** @typedef {'hard'|'soft'|'info'} CheckType */
/**
 * @typedef {Object} CheckResult
 * @property {string} id
 * @property {Status} status
 * @property {CheckType} type
 * @property {string} reason          plain-language, safe to show anyone
 * @property {boolean} [usesReadText] the fail rests on AI-read text
 * @property {string[]} [fields]      which fields the user should confirm
 * @property {string} [evidenceRegion] 'date' | 'barcode' | 'label' | 'seal'
 * @property {string} [source]        where the reference fact came from
 * @property {Object} [detail]        gated detail (verified roles only)
 */

export const result = (id, type, status, reason, extra = {}) => ({ id, type, status, reason, ...extra });

export const normBatch = (b) => (b == null ? null : String(b).toUpperCase().replace(/\s+/g, '').trim() || null);

export const normRegNo = (r) =>
  r == null ? null : String(r).toUpperCase().replace(/\s+/g, '').replace(/[‐-―]/g, '-').trim() || null;

export const normText = (t) => (t == null ? '' : String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());

/** "YYYY-MM" → months since year 0, or null. */
export function monthIndex(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  return y * 12 + (m - 1);
}

export const todayMonthIndex = (today) => today.getUTCFullYear() * 12 + today.getUTCMonth();

/** The value of a field, or null. */
export const val = (ctx, name) => ctx.fields?.[name]?.value ?? null;

/** True when this field was read by the AI from print and not confirmed by the user. */
export const isUnconfirmedText = (ctx, name) => ctx.fields?.[name]?.source === 'text' && !ctx.confirmed;

/** Did the value come from the AI reading print (confirmed or not)? */
export const isText = (ctx, name) => ctx.fields?.[name]?.source === 'text';

/** Loose similarity of two product names: shared-token ratio. */
export function nameSimilarity(a, b) {
  const ta = new Set(normText(a).split(' ').filter(Boolean));
  const tb = new Set(normText(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** Strength like "500 mg" / "500MG" / "0.5mg" → canonical "500mg". */
export const normStrength = (s) => (s == null ? null : String(s).toLowerCase().replace(/\s+/g, '').replace(/milligrams?/, 'mg') || null);
